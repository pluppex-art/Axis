// Carrega .env/.env.local pro process.env — nada fazia isso antes (dotenv era dependência mas
// nunca era importado), então qualquer variável só-arquivo (ex: AURORA_WEBHOOK_URL) sempre esteve
// vazia em dev local. Em produção (Vercel) isso é um no-op inofensivo, já que as variáveis já
// chegam injetadas de verdade no processo.
import "dotenv/config";
import express from "express";
import rateLimit from "express-rate-limit";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import axios from "axios";
import { createGoogleCalendarRouter } from "./server/googleCalendar.js";
import { getWhatsAppProvider, getActiveProviderName, isWahaConfigured } from "./server/whatsappProvider.js";
import { cacheGet, cacheSet, redisHealthCheck } from "./server/redisClient.js";
import nodemailer from "nodemailer";

// ── Types ──────────────────────────────────────────────────────────────────

interface ChatContact {
  id: string;
  name: string;
  avatar: string;
  channel: "WhatsApp" | "Instagram" | "Email";
  lastMessage: string;
  time: string;
  unread: number;
  online: boolean;
  phone?: string;
  email?: string;
  tags?: string[];
  slaStatus?: string;
}

interface ChatMessage {
  id: string;
  text: string;
  sender: "me" | "them";
  time: string;
  status?: "sent" | "read";
  timestamp: number;
}

// ── In-Memory State ────────────────────────────────────────────────────────
//
// contacts/messages do simulador de WhatsApp eram arrays únicos e globais no
// processo — sem tenant_id, qualquer usuário autenticado de QUALQUER tenant
// via esses mesmos contatos/mensagens simulados de outro tenant. Agora seguem
// o mesmo padrão já usado logo abaixo pra sources/customFields/etc.
// (tenantBucket): um bucket por tenant, resolvido via current_tenant_id()
// (RPC, roda com a sessão real do chamador).
//
// Instâncias de WhatsApp NÃO vivem mais em memória — ver
// server/whatsappProvider.ts + rotas /api/whatsapp/instances abaixo, que
// agora persistem de verdade na tabela whatsapp_instances (RLS por tenant).

const contactsByTenant: Record<string, ChatContact[]> = {};
const messagesByTenant: Record<string, Record<string, ChatMessage[]>> = {};

function tenantMessages(tenantId: string): Record<string, ChatMessage[]> {
  if (!messagesByTenant[tenantId]) messagesByTenant[tenantId] = {};
  return messagesByTenant[tenantId];
}

// Fallback in-memory de /api/settings/:category para quando não há tabela
// crm_<categoria> no banco (sources/custom-fields/task-categories/templates
// nunca tiveram tabela própria). Isolado por tenant abaixo — antes disso eram
// arrays únicos no processo, então tenant A criando um campo customizado
// aparecia instantaneamente pra tenant B (todo mundo lia/escrevia o mesmo
// array). Cada tenant recebe sua própria cópia, semeada a partir do exemplo
// padrão na primeira vez que é acessado.
const DEFAULT_SOURCES = [
  { id: "1", name: "Instagram" },
  { id: "2", name: "WhatsApp" },
  { id: "3", name: "Indicação" },
  { id: "4", name: "Site" },
  { id: "5", name: "Google Ads" }
];
const DEFAULT_CUSTOM_FIELDS = [
  { id: "1", label: "CPF/CNPJ", type: "text", required: true },
  { id: "2", label: "Setor", type: "select", options: ["Varejo", "Serviços", "Indústria"] }
];
const DEFAULT_TASK_CATEGORIES = [
  { id: "1", name: "Follow-up", color: "bg-blue-500" },
  { id: "2", name: "Reunião", color: "purple" },
  { id: "3", name: "Proposta", color: "emerald" }
];
const DEFAULT_TEMPLATES = [
  { id: "1", name: "Saudação Inicial", content: "Olá {{name}}, como posso ajudar?", category: "Vendas" }
];

const sourcesByTenant: Record<string, any[]> = {};
const customFieldsByTenant: Record<string, any[]> = {};
const taskCategoriesByTenant: Record<string, any[]> = {};
const templatesByTenant: Record<string, any[]> = {};

function tenantBucket<T>(store: Record<string, T[]>, tenantId: string, seed: T[]): T[] {
  if (!store[tenantId]) store[tenantId] = structuredClone(seed);
  return store[tenantId];
}

// ── Singletons ─────────────────────────────────────────────────────────────

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "";

// createClient lança de forma síncrona se a URL vier malformada (espaço extra,
// protocolo faltando etc.) — sem o try/catch, isso derruba o módulo inteiro no
// carregamento e TODA rota da API vira FUNCTION_INVOCATION_FAILED no Vercel, não
// só as que usam Supabase. Preferimos degradar para null (rotas já checam
// `if (!supabase)`) a derrubar o servidor inteiro por uma env var ruim.
function safeCreateClient(url: string, key: string) {
  if (!url || !key) return null;
  try {
    return createClient(url, key);
  } catch (err: any) {
    console.error("[Supabase] Falha ao criar client:", err?.message);
    return null;
  }
}

const supabase = safeCreateClient(supabaseUrl, supabaseKey);

// Client privilegiado (bypassa RLS). Usado por:
// - /api/v1/leads: chamada por integrações externas (não por usuário logado),
//   sem JWT de sessão pra respeitar RLS normalmente — tenant_id vem só do
//   mapeamento de API key (apiKeyTenantMap), nunca do corpo da requisição.
// - /api/google-calendar/*: google_calendar_connections não dá NENHUM grant
//   direto a anon/authenticated (só SELECT de colunas não-sensíveis, sem
//   token) — só este client grava/lê tokens, e só depois que a rota já
//   validou tenant_id (current_tenant_id()/has_tenant_access(), nunca vindo
//   direto do corpo da requisição) e user_id (req.user.id, do JWT validado
//   por requireUser). Ver server/googleCalendar.ts.
// Em ambos os casos, o isolamento por tenant é mantido pela rota, não pelo
// client — só use supabaseService atrás de uma validação de tenant explícita.
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseService = safeCreateClient(supabaseUrl, supabaseServiceKey);

let ai: GoogleGenAI;
try {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || "dummy_key_to_prevent_crash_at_load_time",
    httpOptions: { headers: { "User-Agent": "aistudio-build" } },
  });
} catch (err: any) {
  console.error("[GoogleGenAI] Falha ao inicializar:", err?.message);
  ai = new GoogleGenAI({ apiKey: "dummy_key_to_prevent_crash_at_load_time" });
}

// Formato: "chave1:tenantIdA,chave2:tenantIdB" — cada API key é vinculada a
// exatamente um tenant. Uma chave nunca pode ler/gravar leads de outro tenant,
// mesmo que o chamador informe um tenantId diferente no corpo da requisição.
// Entradas malformadas (sem ":tenantId") são ignoradas — mas agora avisadas no
// log de startup em vez de falharem silenciosamente como um 503 sem explicação.
const rawApiKeyPairs = (process.env.SPY_API_KEYS || process.env.AXIS_API_KEYS || "")
  .split(",")
  .map((pair) => pair.trim())
  .filter(Boolean);
const apiKeyTenantMap = new Map<string, string>();
for (const pair of rawApiKeyPairs) {
  const [key, tenantId] = pair.split(":").map((s) => s.trim());
  if (key && tenantId) {
    apiKeyTenantMap.set(key, tenantId);
  } else {
    console.warn(`[API Keys] Entrada malformada ignorada (esperado "chave:tenantId"): "${pair.slice(0, 8)}..."`);
  }
}
console.log(`[API Keys] ${apiKeyTenantMap.size} chave(s) válida(s) carregada(s) para /api/v1/leads.`);

const FORM_CLIENT_ID = process.env.SPY_FORM_CLIENT_ID || process.env.AXIS_FORM_CLIENT_ID || "";

// ── AI Helpers: Gemini → Groq fallback ────────────────────────────────────

async function callGroq(prompt: string): Promise<string> {
  const key = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY não configurada.");
  const res = await axios.post(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 1500,
    },
    {
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      timeout: 20000,
    }
  );
  return (res.data.choices?.[0]?.message?.content ?? "") as string;
}

async function callGemini(prompt: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
  });
  let text = "";
  try {
    text = (typeof response.text === "function"
      ? (response as any).text()
      : response.text ?? "") as string;
  } catch {
    text = (response as any)?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }
  return text;
}

// Tenta Gemini; se falhar, usa Groq automaticamente
async function generateAI(prompt: string): Promise<string> {
  if (process.env.GEMINI_API_KEY) {
    try {
      const text = await callGemini(prompt);
      if (text.trim()) return text;
      throw new Error("Gemini retornou vazio.");
    } catch (err) {
      console.warn("[AI] Gemini falhou, usando Groq:", (err as any)?.message?.slice(0, 100));
    }
  }
  return callGroq(prompt);
}

// Extrai JSON de respostas que podem ter markdown ou texto extra
function extractJSON(raw: string): any {
  let text = raw.trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = text.indexOf("{");
  const end   = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Sem JSON válido na resposta: " + text.slice(0, 200));
  return JSON.parse(text.slice(start, end + 1));
}

// ── Express App ────────────────────────────────────────────────────────────

const app = express();
app.set("trust proxy", 1);

// Vercel pre-parses the body before passing to Express — skip json() if already parsed
app.use((req: any, res, next) => {
  if (req.body !== undefined) return next();
  express.json({ limit: "5mb" })(req, res, next);
});

// SPY_CORS_ORIGIN: lista separada por vírgula (ex.: "https://axis-crm.pluppex.com.br,http://localhost:5173").
// Antes era "*" por padrão — qualquer site podia ler resposta de rotas autenticadas
// (Authorization: Bearer) se conseguisse um token válido por outro caminho (XSS em
// outro lugar, extensão maliciosa). Sem SPY_CORS_ORIGIN configurada, não reflete
// nenhuma origem (mais seguro que abrir geral por omissão). Fallback pro nome antigo
// AXIS_CORS_ORIGIN — produção na Vercel ainda só tem a variável antiga configurada.
const allowedOrigins = (process.env.SPY_CORS_ORIGIN || process.env.AXIS_CORS_ORIGIN || "https://axis-crm.pluppex.com.br").split(",").map(o => o.trim()).filter(Boolean);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (allowedOrigins.includes(origin) || allowedOrigins.includes("*"))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key, Authorization, x-active-tenant-id");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Rate limiting — nada disso existia antes. Cobre: a API pública por chave (contra
// força-bruta de x-api-key e abuso volumétrico), as rotas de IA (custo real por
// chamada a Gemini/Groq) e o simulador de WhatsApp. Login/cadastro/reset de senha
// não passam por aqui — dependem do rate limit nativo do próprio Supabase Auth.
// keyGenerator por x-api-key (não por IP): sem isso, duas integrações reais de
// tenants diferentes atrás do mesmo IP de saída (ex.: mesma hospedagem/proxy)
// dividiriam uma única cota de 60/min. Cai pro IP só quando não há chave no
// header (requisição que vai ser rejeitada como 401 de qualquer forma).
const apiKeyLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.headers["x-api-key"] as string | undefined) || req.ip || "unknown",
});
const aiLimiter = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false });
const whatsappLimiter = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false });
const googleCalendarLimiter = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false });
// Mais restritivo que os demais — endpoint sem autenticação nenhuma (formulário
// público do site de marketing), maior risco de abuso/spam automatizado.
const publicLeadLimiter = rateLimit({ windowMs: 60_000, limit: 5, standardHeaders: true, legacyHeaders: false });
app.use("/api/v1/leads", apiKeyLimiter);
app.use("/api/v1/lead-activities", apiKeyLimiter);
app.use("/api/v1/finance-entries", apiKeyLimiter);
app.use("/api/leads", aiLimiter);
app.use("/api/ai", aiLimiter);
app.use("/api/whatsapp", whatsappLimiter);
app.use("/api/google-calendar", googleCalendarLimiter);
app.use("/api/public/lead-capture", publicLeadLimiter);

function requireApiKey(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (apiKeyTenantMap.size === 0) {
    logApiKeyUsage(req, 503);
    return res.status(503).json({ error: "Nenhuma API Key configurada. Defina SPY_API_KEYS no formato chave:tenantId no .env." });
  }
  const key = req.headers["x-api-key"] as string | undefined;
  const tenantId = key ? apiKeyTenantMap.get(key) : undefined;
  if (!key || !tenantId) {
    // tenantId ainda não existe no req aqui — logApiKeyUsage grava tenant_id
    // null neste caso (tentativa com chave inválida/ausente, não atribuível
    // a nenhum tenant real).
    logApiKeyUsage(req, 401);
    return res.status(401).json({ error: "API Key inválida ou ausente." });
  }
  (req as any).tenantId = tenantId;
  next();
}

/**
 * Exige uma sessão real do Supabase Auth (JWT no header Authorization).
 * Anexa req.user (usuário autenticado) e req.supabase (client escopado com o
 * token do chamador, para que toda query subsequente respeite a RLS por
 * tenant automaticamente, sem precisar filtrar tenant_id manualmente na rota).
 */
async function requireUser(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    if (!supabase) return res.status(503).json({ error: "Banco de dados não configurado no servidor." });

    const authHeader = req.headers["authorization"] as string | undefined;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
    if (!token) return res.status(401).json({ error: "Autenticação obrigatória." });

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return res.status(401).json({ error: "Sessão inválida ou expirada." });

    (req as any).user = data.user;
    (req as any).supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    next();
  } catch (err: any) {
    console.error("[requireUser]", err?.message);
    res.status(500).json({ error: "Erro ao validar autenticação." });
  }
}

// Status do Redis-SPY (ping + latência). Não expõe dado de tenant nenhum,
// só topologia/saúde de infra — mesmo nível de sensibilidade de um /healthz
// comum, por isso fica sem autenticação.
app.get("/api/health/redis", async (_req, res) => {
  const status = await redisHealthCheck();
  res.json(status);
});

// Mesma exceção de negócio documentada em src/pages/dashboard/useDashboard.ts:
// pra esse tenant, "leads ativos" é a base inteira de leads cadastrados, não
// a definição padrão (aberto = nem Fechado nem Perdido) — reserva resolve
// rápido (confirma/comparece ou cancela), então quase tudo termina
// Fechado/Perdido e sobraria pouquíssimo "aberto" pela regra padrão.
const TO_NA_PISTA_TENANT_ID = "65469cc6-5cc6-4115-a48b-782e7250a10c";

/**
 * Resumo agregado do dashboard executivo (mesmas 4 métricas "hero" de
 * src/lib/revenueMetrics.ts + useDashboard.ts: receita recorrente,
 * conversão, leads ativos, churn), com cache-aside no Redis-SPY (TTL curto
 * — são agregados, não precisam ser em tempo real). Se o Redis estiver fora
 * do ar, cacheGet/cacheSet apenas não fazem nada (ver server/redisClient.ts)
 * e a rota calcula direto no Supabase — sem essa rota quebrar.
 *
 * Tenant: aceita `?tenantId=` opcional (o `activeTenantId` do
 * AuthContext.tsx no frontend — necessário pra contas master/parceiro, que
 * trocam de "empresa visualizada" sem que isso mude a própria linha do
 * usuário em `users`; sem isso, o resumo de um master sempre voltava os
 * dados do tenant "de casa" dele, nunca o tenant que ele selecionou na tela).
 * NUNCA aceito às cegas: sempre revalidado no servidor via has_tenant_access
 * (a mesma função usada pela RLS), então um tenantId que o usuário não tem
 * acesso retorna 403 — nunca dado de outro tenant. Sem o parâmetro, cai pro
 * tenant do próprio usuário (comportamento anterior, ainda correto pro caso
 * comum sem troca de tenant).
 *
 * Só as 4 métricas "hero" (número grande no topo) — performanceData
 * (tendência de 7 meses), salesRanking (fallback lead→produto→proposta) e
 * funnelData (depende da configuração dinâmica de funil por tenant) ficam
 * de fora de propósito: replicar a lógica deles no servidor tem risco real
 * de divergir sutilmente do cálculo no cliente; continuam calculados lá,
 * sem mudança nesta rodada.
 */
/**
 * Resolve qual tenant um endpoint de resumo/KPI cacheado deve usar: o do
 * próprio usuário por padrão, ou um `?tenantId=` explícito (necessário pra
 * contas master/parceiro trocando de "empresa visualizada", ver
 * AuthContext.tsx switchTenant()) — sempre revalidado no servidor via
 * has_tenant_access (mesma função usada pela RLS) antes de aceitar. Retorna
 * `null` e já responde 403 se a checagem falhar; o chamador deve checar
 * `if (!tenantId) return;` logo em seguida.
 */
async function resolveRequestedTenantId(req: any, res: any): Promise<string | null> {
  const { data: caller, error: callerError } = await req.supabase
    .from("users").select("tenant_id").eq("id", req.user.id).maybeSingle();
  if (callerError || !caller?.tenant_id) {
    res.status(403).json({ error: "Não foi possível identificar o tenant do usuário." });
    return null;
  }
  const requestedTenantId = typeof req.query.tenantId === "string" ? req.query.tenantId : null;
  if (!requestedTenantId || requestedTenantId === caller.tenant_id) {
    return caller.tenant_id as string;
  }
  const { data: allowed, error: accessError } = await req.supabase
    .rpc("has_tenant_access", { target_tenant_id: requestedTenantId });
  if (accessError || !allowed) {
    res.status(403).json({ error: "Sem acesso a este tenant." });
    return null;
  }
  return requestedTenantId;
}

app.get("/api/dashboard/summary", requireUser, async (req: any, res) => {
  try {
    const tenantId = await resolveRequestedTenantId(req, res);
    if (!tenantId) return;
    const cacheKey = `dashboard:tenant:${tenantId}:summary`;

    const cached = await cacheGet<Record<string, unknown>>(cacheKey);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      return res.json(cached);
    }

    const sb = req.supabase;

    // Leads: uma busca só (status, value, scoreIA) cobre conversão/ativos
    // (getConversionRate/getActiveLeadsCount em src/lib/revenueMetrics.ts)
    // + pipeline em aberto/leads quentes (StrategicalView.tsx).
    const { data: leadsRows } = await sb.from("leads")
      .select('status,value,"scoreIA"').eq("tenant_id", tenantId);
    const leadsAll = (leadsRows || []) as { status: string; value: number | null; scoreIA: number | null }[];
    const leadsTotal = leadsAll.length;
    const leadsWon = leadsAll.filter((l) => l.status === "Fechado").length;
    const leadsOpenRows = leadsAll.filter((l) => l.status !== "Fechado" && l.status !== "Perdido");
    const conversionRate = leadsTotal > 0 ? Math.round((leadsWon / leadsTotal) * 1000) / 10 : 0;
    const activeLeadsCount = tenantId === TO_NA_PISTA_TENANT_ID ? leadsTotal : leadsOpenRows.length;
    const valorPipelineAberto = leadsOpenRows.reduce((s, l) => s + (Number(l.value) || 0), 0);
    const leadsQuentes = leadsOpenRows.filter((l) => (l.scoreIA ?? 0) > 80).length;

    // Contratos: mrr_value já é numeric de verdade (sem parsing de texto
    // tipo parseCurrencyBR) — soma direta dos não cancelados/perdidos,
    // mesma regra de getMRR(). Reaproveitado pra MRR ativo/em risco e taxa
    // de inadimplência (CustomerSuccessView.tsx/StrategicalView.tsx — a
    // mesma métrica "taxaInadimplencia"/"taxaRisco" nos dois arquivos).
    const { data: contractsRows } = await sb.from("contracts")
      .select("mrr_value,status").eq("tenant_id", tenantId);
    const contracts = (contractsRows || []) as { mrr_value: number | null; status: string }[];
    const totalRevenue = contracts
      .filter((c) => c.status !== "Cancelado" && c.status !== "Perdido")
      .reduce((sum, c) => sum + (Number(c.mrr_value) || 0), 0);
    const contractsAtivos = contracts.filter((c) => c.status === "Ativo");
    const contractsEmRisco = contracts.filter((c) => c.status === "Inadimplente");
    const mrrEmRisco = contractsEmRisco.reduce((s, c) => s + (Number(c.mrr_value) || 0), 0);
    const taxaInadimplencia = contracts.length > 0 ? Math.round((contractsEmRisco.length / contracts.length) * 1000) / 10 : 0;

    // Churn: mesma regra condicional de useDashboard.ts — tenant com agenda
    // (appointments) usa churn por paciente (sem visita nos últimos 90 dias);
    // senão, cai pra contratos cancelados/total.
    const { count: appointmentsCount } = await sb.from("appointments")
      .select("*", { count: "exact", head: true }).eq("tenant_id", tenantId);

    let churnRate = 0;
    if ((appointmentsCount ?? 0) > 0) {
      const { data: apptRows } = await sb.from("appointments")
        .select("patient,date").eq("tenant_id", tenantId);
      const lastVisitByPatient = new Map<string, string>();
      for (const a of (apptRows || []) as { patient: string | null; date: string | null }[]) {
        if (!a.patient || !a.date) continue;
        const prev = lastVisitByPatient.get(a.patient);
        if (!prev || a.date > prev) lastVisitByPatient.set(a.patient, a.date);
      }
      const totalPatients = lastVisitByPatient.size;
      if (totalPatients > 0) {
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        const cutoff = ninetyDaysAgo.toISOString().slice(0, 10);
        let churned = 0;
        for (const lastVisit of lastVisitByPatient.values()) {
          if (lastVisit < cutoff) churned++;
        }
        churnRate = Math.round((churned / totalPatients) * 1000) / 10;
      }
    } else {
      const totalContracts = contracts.length;
      const cancelledContracts = contracts.filter((c) => c.status === "Cancelado").length;
      churnRate = totalContracts > 0 ? Math.round((cancelledContracts / totalContracts) * 1000) / 10 : 0;
    }

    const summary = {
      totalRevenue, conversionRate, activeLeadsCount, churnRate,
      valorPipelineAberto, leadsQuentes,
      mrrAtivo: totalRevenue, mrrEmRisco, taxaInadimplencia,
      contractsAtivosCount: contractsAtivos.length, contractsEmRiscoCount: contractsEmRisco.length, contractsTotalCount: contracts.length,
      cachedAt: new Date().toISOString(),
    };

    await cacheSet(cacheKey, summary, 60);
    res.setHeader("X-Cache", "MISS");
    return res.json(summary);
  } catch (err: any) {
    console.error("[dashboard/summary]", err?.message);
    return res.status(500).json({ error: "Erro ao calcular resumo do dashboard." });
  }
});

/**
 * Resumo cacheado da Visão Geral do Financeiro (src/pages/finance/FinanceiroVisaoGeral.tsx)
 * — os cards do topo + resumo de alertas. Mesma resolução/validação de
 * tenant de /api/dashboard/summary (aceita ?tenantId=, revalidado via
 * has_tenant_access). Usa `date_normalized` (coluna gerada — ver
 * supabase/migrations/20260920_finance_entries_date_normalized.sql) em vez
 * de reimplementar o parsing de data dupla-formato no servidor.
 *
 * Deixados de fora de propósito (ficam só no cliente): "Saldo em Contas"
 * (depende de src/pages/finance/lib/financeEngine.ts — saldo corrente por
 * conta bancária, incl. transferências, lógica não trivial o bastante pra
 * arriscar divergência), Previsto×Realizado, Comparativo com mês anterior
 * e gráfico de fluxo de caixa (mesmo motivo) — nenhum desses é recalculado
 * aqui, todos continuam vindo do financeEngine.ts no navegador.
 */
app.get("/api/finance/visao-geral-summary", requireUser, async (req: any, res) => {
  try {
    const tenantId = await resolveRequestedTenantId(req, res);
    if (!tenantId) return;
    const cacheKey = `finance-visao-geral:tenant:${tenantId}:summary`;

    const cached = await cacheGet<Record<string, unknown>>(cacheKey);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      return res.json(cached);
    }

    const sb = req.supabase;
    const [{ data: entriesRows }, { data: contractsRows }] = await Promise.all([
      sb.from("finance_entries").select("type,status,value,date_normalized,category").eq("tenant_id", tenantId),
      sb.from("contracts").select("mrr_value,status").eq("tenant_id", tenantId),
    ]);
    const entries = (entriesRows || []) as { type: string; status: string; value: number; date_normalized: string | null; category: string | null }[];
    const contracts = (contractsRows || []) as { mrr_value: number | null; status: string }[];

    const sum = (rows: typeof entries) => rows.reduce((s, f) => s + (Number(f.value) || 0), 0);

    const pad = (n: number) => String(n).padStart(2, "0");
    const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const now = new Date();
    const todayIso = isoDate(now);
    const curMonthPrefix = todayIso.slice(0, 7);
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthPrefix = isoDate(prevMonthDate).slice(0, 7);
    const next3Iso = isoDate(new Date(now.getTime() + 3 * 86400000));
    const next7Iso = isoDate(new Date(now.getTime() + 7 * 86400000));
    const next30Iso = isoDate(new Date(now.getTime() + 30 * 86400000));
    const inMonth = (d: string | null, prefix: string) => !!d && d.startsWith(prefix);
    const inRange = (d: string | null, from: string, to: string) => !!d && d >= from && d <= to;

    const receitaMes = sum(entries.filter(f => f.type === "Receber" && f.status === "Pago" && inMonth(f.date_normalized, curMonthPrefix)));
    const receitaMesAnt = sum(entries.filter(f => f.type === "Receber" && f.status === "Pago" && inMonth(f.date_normalized, prevMonthPrefix)));
    const despesaMes = sum(entries.filter(f => f.type === "Pagar" && f.status === "Pago" && inMonth(f.date_normalized, curMonthPrefix)));
    const despesaMesAnt = sum(entries.filter(f => f.type === "Pagar" && f.status === "Pago" && inMonth(f.date_normalized, prevMonthPrefix)));

    const abertoReceber = entries.filter(f => f.type === "Receber" && (f.status === "A Vencer" || f.status === "Atrasado"));
    const abertoPagar = entries.filter(f => f.type === "Pagar" && (f.status === "A Vencer" || f.status === "Atrasado"));
    const vencidoReceber = entries.filter(f => f.type === "Receber" && f.status === "Atrasado");
    const vencidoPagar = entries.filter(f => f.type === "Pagar" && f.status === "Atrasado");

    const previstoReceber30 = sum(entries.filter(f => f.type === "Receber" && f.status === "A Vencer" && inRange(f.date_normalized, todayIso, next30Iso)));
    const previstoPagar30 = sum(entries.filter(f => f.type === "Pagar" && f.status === "A Vencer" && inRange(f.date_normalized, todayIso, next30Iso)));

    const mrrAtual = contracts
      .filter(c => c.status !== "Cancelado" && c.status !== "Perdido")
      .reduce((s, c) => s + (Number(c.mrr_value) || 0), 0);

    const hojeEntradas = sum(entries.filter(f => f.type === "Receber" && f.status === "Pago" && f.date_normalized === todayIso));
    const hojeSaidas = sum(entries.filter(f => f.type === "Pagar" && f.status === "Pago" && f.date_normalized === todayIso));
    const aReceber7 = sum(entries.filter(f => f.type === "Receber" && f.status === "A Vencer" && inRange(f.date_normalized, todayIso, next7Iso)));
    const aPagar7 = sum(entries.filter(f => f.type === "Pagar" && f.status === "A Vencer" && inRange(f.date_normalized, todayIso, next7Iso)));
    const vencendoEm3 = entries.filter(f => f.status === "A Vencer" && inRange(f.date_normalized, todayIso, next3Iso));

    const summary = {
      kpis: {
        receitaMes, receitaMesAnt, despesaMes, despesaMesAnt,
        resultadoMes: receitaMes - despesaMes, resultadoMesAnt: receitaMesAnt - despesaMesAnt,
        mrrAtual,
        abertoReceber: { value: sum(abertoReceber), count: abertoReceber.length },
        abertoPagar: { value: sum(abertoPagar), count: abertoPagar.length },
        vencidoReceber: { value: sum(vencidoReceber), count: vencidoReceber.length },
        previstoReceber30, previstoPagar30, fluxoProjetado30: previstoReceber30 - previstoPagar30,
      },
      alertas: {
        hoje: { entradas: hojeEntradas, saidas: hojeSaidas },
        proximos7: { aReceber: aReceber7, aPagar: aPagar7 },
        vencidasPagar: { value: sum(vencidoPagar), count: vencidoPagar.length },
        vencidasReceber: { value: sum(vencidoReceber), count: vencidoReceber.length },
        vencendoEm3: { value: sum(vencendoEm3), count: vencendoEm3.length },
      },
      cachedAt: new Date().toISOString(),
    };

    await cacheSet(cacheKey, summary, 60);
    res.setHeader("X-Cache", "MISS");
    return res.json(summary);
  } catch (err: any) {
    console.error("[finance/visao-geral-summary]", err?.message);
    return res.status(500).json({ error: "Erro ao calcular resumo financeiro." });
  }
});

const WEEKDAYS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/**
 * Resumo cacheado de Marketing (src/pages/marketing/MarketingCampanhas.tsx)
 * — KPIs + gráficos, nada de listagem de registro individual (a tela toda
 * é agregada: cards, 2 gráficos e uma tabela "por origem" já sumarizada).
 * Mesma resolução/validação de tenant das rotas anteriores.
 *
 * `leads.date` é texto — 4373/4396 em ISO válido, ~20 com o literal "Hoje"
 * (dado legado) que o cliente já ignora silenciosamente via try/catch no
 * new Date(); replicado aqui filtrando só datas que batem o formato ISO
 * antes de agrupar por dia da semana. Sem formato BR misturado (diferente
 * de finance_entries) — confirmado ao vivo antes de implementar.
 */
app.get("/api/marketing/campanhas-summary", requireUser, async (req: any, res) => {
  try {
    const tenantId = await resolveRequestedTenantId(req, res);
    if (!tenantId) return;
    const cacheKey = `marketing-campanhas:tenant:${tenantId}:summary`;

    const cached = await cacheGet<Record<string, unknown>>(cacheKey);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      return res.json(cached);
    }

    const sb = req.supabase;
    const [{ data: leadsRows }, { data: entriesRows }] = await Promise.all([
      sb.from("leads").select("status,date,source").eq("tenant_id", tenantId),
      sb.from("finance_entries").select("type,status,value").eq("tenant_id", tenantId),
    ]);
    const leadsAll = (leadsRows || []) as { status: string; date: string | null; source: string | null }[];
    const entries = (entriesRows || []) as { type: string; status: string; value: number }[];

    const totalLeads = leadsAll.length;
    const closedLeads = leadsAll.filter(l => l.status === "Fechado").length;
    const totalRevenue = entries.filter(f => f.type === "Receber" && f.status === "Pago").reduce((s, f) => s + (Number(f.value) || 0), 0);
    const totalSpent = entries.filter(f => f.type === "Pagar" && f.status === "Pago").reduce((s, f) => s + (Number(f.value) || 0), 0);
    const cpa = totalLeads > 0 ? totalSpent / totalLeads : 0;

    const trafficCounts = [0, 0, 0, 0, 0, 0, 0];
    for (const l of leadsAll) {
      if (!l.date || !/^\d{4}-\d{2}-\d{2}/.test(l.date)) continue;
      const d = new Date(l.date);
      if (isNaN(d.getTime())) continue;
      trafficCounts[d.getDay()]++;
    }
    const trafficData = WEEKDAYS_PT.map((name, i) => ({ name, leads: trafficCounts[i], spend: 0 }));

    const bySourceMap: Record<string, { leads: number; closed: number }> = {};
    for (const l of leadsAll) {
      const src = l.source || "Orgânico / Direto";
      if (!bySourceMap[src]) bySourceMap[src] = { leads: 0, closed: 0 };
      bySourceMap[src].leads++;
      if (l.status === "Fechado") bySourceMap[src].closed++;
    }
    const bySource = Object.entries(bySourceMap)
      .sort((a, b) => b[1].leads - a[1].leads)
      .map(([source, data]) => ({ source, leads: data.leads, closed: data.closed }));

    const summary = { totalLeads, closedLeads, totalRevenue, totalSpent, cpa, trafficData, bySource, cachedAt: new Date().toISOString() };

    await cacheSet(cacheKey, summary, 60);
    res.setHeader("X-Cache", "MISS");
    return res.json(summary);
  } catch (err: any) {
    console.error("[marketing/campanhas-summary]", err?.message);
    return res.status(500).json({ error: "Erro ao calcular resumo de campanhas." });
  }
});

const AGING_BUCKETS = [
  { id: "1-7", label: "1–7 dias", min: 1, max: 7 },
  { id: "8-30", label: "8–30 dias", min: 8, max: 30 },
  { id: "31-60", label: "31–60 dias", min: 31, max: 60 },
  { id: "61-90", label: "61–90 dias", min: 61, max: 90 },
  { id: "90+", label: "+90 dias", min: 91, max: Infinity },
];
function bucketFor(dias: number) {
  return AGING_BUCKETS.find((b) => dias >= b.min && dias <= b.max) ?? AGING_BUCKETS[AGING_BUCKETS.length - 1];
}

/**
 * Resumo cacheado de Inadimplência (src/pages/finance/FinanceiroInadimplencia.tsx)
 * — KPIs + aging buckets + agrupamento por cliente (não lançamento
 * individual, só link pra tela de Cobranças). Usa date_normalized (coluna
 * gerada) pra calcular dias de atraso — mesma semântica de
 * daysBetween()/parseEntryDate() em financeDates.ts, sem reimplementar
 * parsing de texto: dias = diferença em dias UTC entre hoje e a data de
 * vencimento, calculado a partir dos componentes y/m/d, igual ao cliente.
 */
app.get("/api/finance/inadimplencia-summary", requireUser, async (req: any, res) => {
  try {
    const tenantId = await resolveRequestedTenantId(req, res);
    if (!tenantId) return;
    const cacheKey = `finance-inadimplencia:tenant:${tenantId}:summary`;

    const cached = await cacheGet<Record<string, unknown>>(cacheKey);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      return res.json(cached);
    }

    const sb = req.supabase;
    const { data: rows } = await sb.from("finance_entries")
      .select("value,counterparty,date_normalized")
      .eq("tenant_id", tenantId).eq("type", "Receber").eq("status", "Atrasado");
    const vencidosRaw = (rows || []) as { value: number; counterparty: string | null; date_normalized: string | null }[];

    const now = new Date();
    const nowUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const vencidos = vencidosRaw.map((f) => {
      let dias = 0;
      if (f.date_normalized) {
        const [y, m, d] = f.date_normalized.split("-").map(Number);
        dias = Math.max(0, Math.round((nowUTC - Date.UTC(y, m - 1, d)) / 86400000));
      }
      return { value: Number(f.value) || 0, cliente: f.counterparty || "Sem cliente identificado", dias };
    });

    const totalVencido = vencidos.reduce((s, f) => s + f.value, 0);
    const clientesUnicos = new Set(vencidos.map((f) => f.cliente)).size;
    const atrasoMedio = vencidos.length > 0 ? vencidos.reduce((s, f) => s + f.dias, 0) / vencidos.length : 0;

    const buckets = AGING_BUCKETS.map((b) => {
      const items = vencidos.filter((f) => bucketFor(f.dias).id === b.id);
      return { id: b.id, label: b.label, count: items.length, value: items.reduce((s, f) => s + f.value, 0) };
    });

    const byClient = new Map<string, { titulos: number; valor: number; maiorAtraso: number }>();
    for (const f of vencidos) {
      const cur = byClient.get(f.cliente) || { titulos: 0, valor: 0, maiorAtraso: 0 };
      cur.titulos += 1;
      cur.valor += f.value;
      cur.maiorAtraso = Math.max(cur.maiorAtraso, f.dias);
      byClient.set(f.cliente, cur);
    }
    const porCliente = Array.from(byClient.entries())
      .map(([cliente, v]) => ({ cliente, ...v }))
      .sort((a, b) => b.valor - a.valor);

    const summary = {
      vencidosCount: vencidos.length, totalVencido, clientesUnicos, atrasoMedio,
      buckets, porCliente, cachedAt: new Date().toISOString(),
    };

    await cacheSet(cacheKey, summary, 60);
    res.setHeader("X-Cache", "MISS");
    return res.json(summary);
  } catch (err: any) {
    console.error("[finance/inadimplencia-summary]", err?.message);
    return res.status(500).json({ error: "Erro ao calcular resumo de inadimplência." });
  }
});

// DRE — regime de competência, mesmo cálculo de calcularDRE() em
// src/pages/finance/lib/financeEngine.ts. O intervalo [startDate, endDate]
// vem pronto do cliente (periodoRange() em FinanceiroDRE.tsx) pra evitar
// qualquer divergência de fuso horário entre o cálculo de "período atual"
// no servidor e no navegador do usuário.
app.get("/api/finance/dre-summary", requireUser, async (req: any, res) => {
  try {
    const tenantId = await resolveRequestedTenantId(req, res);
    if (!tenantId) return;

    const startDate = typeof req.query.startDate === "string" ? req.query.startDate : null;
    const endDate = typeof req.query.endDate === "string" ? req.query.endDate : null;
    const isoDateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (!startDate || !endDate || !isoDateRe.test(startDate) || !isoDateRe.test(endDate)) {
      return res.status(400).json({ error: "Parâmetros startDate/endDate (YYYY-MM-DD) são obrigatórios." });
    }
    const cacheKey = `finance-dre:tenant:${tenantId}:${startDate}:${endDate}`;

    const cached = await cacheGet<Record<string, unknown>>(cacheKey);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      return res.json(cached);
    }

    const sb = req.supabase;
    const [{ data: entriesRows }, { data: categoryRows }] = await Promise.all([
      sb.from("finance_entries")
        .select("type,status,value,category_id")
        .eq("tenant_id", tenantId)
        .gte("date_normalized", startDate)
        .lte("date_normalized", endDate),
      sb.from("finance_categories")
        .select("id,subtipo")
        .eq("tenant_id", tenantId),
    ]);

    const entries = (entriesRows || []) as { type: string; status: string; value: number; category_id: string | null }[];
    const categoriesMap = new Map((categoryRows || []).map((c: any) => [c.id, c]));

    const dreTipoDe = (e: (typeof entries)[number]) => {
      if (e.type === "Receber") return "RECEBIMENTO";
      const cat = e.category_id ? categoriesMap.get(e.category_id) : undefined;
      return (cat as any)?.subtipo ?? "DESPESA_VARIAVEL";
    };
    const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
    const somaPorTipo = (tipo: string) =>
      round2(entries.filter((e) => e.type === "Pagar" && dreTipoDe(e) === tipo).reduce((s, e) => s + (Number(e.value) || 0), 0));

    const receitaBruta = round2(entries.filter((e) => e.type === "Receber").reduce((s, e) => s + (Number(e.value) || 0), 0));
    const impostos = somaPorTipo("IMPOSTOS");
    const lucroBruto = round2(receitaBruta - impostos);
    const despesasVariaveis = somaPorTipo("DESPESA_VARIAVEL");
    const lucroOperacional = round2(lucroBruto - despesasVariaveis);
    const despesasFixas = somaPorTipo("DESPESA_FIXA");
    const gastosComPessoal = somaPorTipo("PESSOAS");
    const lucroLiquido = round2(lucroOperacional - despesasFixas - gastosComPessoal);

    const summary = {
      receitaBruta, impostos, lucroBruto, despesasVariaveis, lucroOperacional,
      despesasFixas, gastosComPessoal, lucroLiquido,
      entriesCount: entries.length,
      entriesPendentesCount: entries.filter((e) => e.status !== "Pago").length,
      cachedAt: new Date().toISOString(),
    };

    await cacheSet(cacheKey, summary, 60);
    res.setHeader("X-Cache", "MISS");
    return res.json(summary);
  } catch (err: any) {
    console.error("[finance/dre-summary]", err?.message);
    return res.status(500).json({ error: "Erro ao calcular DRE." });
  }
});

const PERF_MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// Performance Mensal — mesma fórmula de FinanceiroPerformanceMensal.tsx:
// regime de CAIXA (status "Pago"), últimos N meses (6/12/24) ancorados no
// mês corrente do servidor.
app.get("/api/finance/performance-mensal-summary", requireUser, async (req: any, res) => {
  try {
    const tenantId = await resolveRequestedTenantId(req, res);
    if (!tenantId) return;

    const janelaParam = Number(req.query.janela);
    const janela = [6, 12, 24].includes(janelaParam) ? janelaParam : 12;
    const cacheKey = `finance-performance-mensal:tenant:${tenantId}:janela:${janela}`;

    const cached = await cacheGet<Record<string, unknown>>(cacheKey);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      return res.json(cached);
    }

    const now = new Date();
    const months = Array.from({ length: janela }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (janela - 1 - i), 1);
      return { y: d.getFullYear(), m: d.getMonth(), label: `${PERF_MONTH_NAMES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}` };
    });
    const startDate = `${months[0].y}-${String(months[0].m + 1).padStart(2, "0")}-01`;

    const sb = req.supabase;
    const { data: rows } = await sb.from("finance_entries")
      .select("type,value,date_normalized")
      .eq("tenant_id", tenantId).eq("status", "Pago")
      .gte("date_normalized", startDate);

    const byMonth = new Map<string, { receita: number; despesa: number }>();
    for (const r of (rows || []) as { type: string; value: number; date_normalized: string | null }[]) {
      if (!r.date_normalized) continue;
      const key = r.date_normalized.slice(0, 7);
      const cur = byMonth.get(key) || { receita: 0, despesa: 0 };
      if (r.type === "Receber") cur.receita += Number(r.value) || 0;
      else if (r.type === "Pagar") cur.despesa += Number(r.value) || 0;
      byMonth.set(key, cur);
    }

    const meses = months.map(({ y, m, label }) => {
      const v = byMonth.get(`${y}-${String(m + 1).padStart(2, "0")}`) || { receita: 0, despesa: 0 };
      return { label, receita: v.receita, despesa: v.despesa, resultado: v.receita - v.despesa };
    });

    const receitaTotal = meses.reduce((s, m) => s + m.receita, 0);
    const despesaTotal = meses.reduce((s, m) => s + m.despesa, 0);
    const melhorMes = meses.reduce((best, m) => (!best || m.resultado > best.resultado ? m : best), meses[0]);

    const summary = { meses, receitaTotal, despesaTotal, resultadoTotal: receitaTotal - despesaTotal, melhorMes, cachedAt: new Date().toISOString() };

    await cacheSet(cacheKey, summary, 60);
    res.setHeader("X-Cache", "MISS");
    return res.json(summary);
  } catch (err: any) {
    console.error("[finance/performance-mensal-summary]", err?.message);
    return res.status(500).json({ error: "Erro ao calcular performance mensal." });
  }
});

const PERF_DRE_TIPO_LABEL: Record<string, string> = { DESPESA_FIXA: "Despesas Fixas", DESPESA_VARIAVEL: "Despesas Variáveis", PESSOAS: "Pessoal", IMPOSTOS: "Impostos" };

// Performance Anual — mesma fórmula de FinanceiroPerformanceAnual.tsx:
// regime de CAIXA, ano vs. ano anterior. Saldo das contas (saldosContas)
// fica de fora, igual à Visão Geral — depende de financeBankAccounts +
// financeTransfers, domínio à parte, sempre client-side.
app.get("/api/finance/performance-anual-summary", requireUser, async (req: any, res) => {
  try {
    const tenantId = await resolveRequestedTenantId(req, res);
    if (!tenantId) return;

    const anoParam = Number(req.query.ano);
    const ano = Number.isInteger(anoParam) && anoParam > 2000 && anoParam < 2100 ? anoParam : new Date().getFullYear();
    const cacheKey = `finance-performance-anual:tenant:${tenantId}:ano:${ano}`;

    const cached = await cacheGet<Record<string, unknown>>(cacheKey);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      return res.json(cached);
    }

    const sb = req.supabase;
    const [{ data: entryRows }, { data: categoryRows }] = await Promise.all([
      sb.from("finance_entries")
        .select("id,type,value,description,category,category_id,date_normalized")
        .eq("tenant_id", tenantId).eq("status", "Pago")
        .gte("date_normalized", `${ano - 1}-01-01`)
        .lte("date_normalized", `${ano}-12-31`),
      sb.from("finance_categories").select("id,subtipo").eq("tenant_id", tenantId),
    ]);

    const categoriesMap = new Map((categoryRows || []).map((c: any) => [c.id, c]));
    type PerfEntry = { id: string; type: string; value: number; description: string | null; category: string | null; category_id: string | null; date_normalized: string | null };
    const dreTipoDe = (e: PerfEntry) => {
      if (e.type === "Receber") return "RECEBIMENTO";
      const cat = e.category_id ? categoriesMap.get(e.category_id) : undefined;
      return (cat as any)?.subtipo ?? "DESPESA_VARIAVEL";
    };

    const all = (entryRows || []) as PerfEntry[];
    const atual = all.filter((e) => e.date_normalized && e.date_normalized.slice(0, 4) === String(ano));
    const anterior = all.filter((e) => e.date_normalized && e.date_normalized.slice(0, 4) === String(ano - 1));

    const somaTipo = (arr: PerfEntry[], type: string) => arr.filter((e) => e.type === type).reduce((s, e) => s + (Number(e.value) || 0), 0);
    const receitaAtual = somaTipo(atual, "Receber"), receitaAnterior = somaTipo(anterior, "Receber");
    const despesaAtual = somaTipo(atual, "Pagar"), despesaAnterior = somaTipo(anterior, "Pagar");

    const maioresGastos = [...atual].filter((e) => e.type === "Pagar").sort((a, b) => b.value - a.value).slice(0, 5)
      .map((e) => ({ id: e.id, description: e.description, value: Number(e.value) || 0 }));
    const maioresReceitas = [...atual].filter((e) => e.type === "Receber").sort((a, b) => b.value - a.value).slice(0, 5)
      .map((e) => ({ id: e.id, description: e.description, value: Number(e.value) || 0 }));

    const porCategoriaReceita = new Map<string, number>();
    atual.filter((e) => e.type === "Receber").forEach((e) => {
      const k = e.category || "Sem categoria";
      porCategoriaReceita.set(k, (porCategoriaReceita.get(k) || 0) + (Number(e.value) || 0));
    });

    const porTipoDespesa = new Map<string, number>();
    atual.filter((e) => e.type === "Pagar").forEach((e) => {
      const t = dreTipoDe(e);
      porTipoDespesa.set(t, (porTipoDespesa.get(t) || 0) + (Number(e.value) || 0));
    });

    const linhasTipo = (["DESPESA_FIXA", "DESPESA_VARIAVEL", "PESSOAS", "IMPOSTOS"] as const).map((tipo) => {
      const val = porTipoDespesa.get(tipo) || 0;
      const valAnt = anterior.filter((e) => e.type === "Pagar" && dreTipoDe(e) === tipo).reduce((s, e) => s + (Number(e.value) || 0), 0);
      return { label: PERF_DRE_TIPO_LABEL[tipo], atual: val, anterior: valAnt };
    });

    const summary = {
      receitaAtual, receitaAnterior, despesaAtual, despesaAnterior,
      maioresGastos, maioresReceitas,
      donutReceita: Array.from(porCategoriaReceita.entries()).map(([name, value]) => ({ name, value })),
      donutDespesa: Array.from(porTipoDespesa.entries()).map(([tipo, value]) => ({ name: PERF_DRE_TIPO_LABEL[tipo] || tipo, value })),
      linhasTipo,
      cachedAt: new Date().toISOString(),
    };

    await cacheSet(cacheKey, summary, 60);
    res.setHeader("X-Cache", "MISS");
    return res.json(summary);
  } catch (err: any) {
    console.error("[finance/performance-anual-summary]", err?.message);
    return res.status(500).json({ error: "Erro ao calcular performance anual." });
  }
});

// Fluxo de Caixa — regime de caixa, dia a dia. [startDate, endDate] vem
// pronto do cliente (mesma janela de 30/60/90 dias calculada em
// FinanceiroFluxoCaixa.tsx) pra evitar divergência de fuso horário entre
// o "hoje" do servidor e o do navegador — mesmo motivo do DRE.
app.get("/api/finance/fluxo-caixa-summary", requireUser, async (req: any, res) => {
  try {
    const tenantId = await resolveRequestedTenantId(req, res);
    if (!tenantId) return;

    const startDate = typeof req.query.startDate === "string" ? req.query.startDate : null;
    const endDate = typeof req.query.endDate === "string" ? req.query.endDate : null;
    const isoDateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (!startDate || !endDate || !isoDateRe.test(startDate) || !isoDateRe.test(endDate)) {
      return res.status(400).json({ error: "Parâmetros startDate/endDate (YYYY-MM-DD) são obrigatórios." });
    }
    const cacheKey = `finance-fluxo-caixa:tenant:${tenantId}:${startDate}:${endDate}`;

    const cached = await cacheGet<Record<string, unknown>>(cacheKey);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      return res.json(cached);
    }

    const sb = req.supabase;
    const { data: rows } = await sb.from("finance_entries")
      .select("type,value,date_normalized")
      .eq("tenant_id", tenantId).eq("status", "Pago")
      .gte("date_normalized", startDate).lte("date_normalized", endDate);

    const buckets = new Map<string, { entradas: number; saidas: number }>();
    for (const r of (rows || []) as { type: string; value: number; date_normalized: string | null }[]) {
      if (!r.date_normalized) continue;
      const cur = buckets.get(r.date_normalized) || { entradas: 0, saidas: 0 };
      if (r.type === "Receber") cur.entradas += Number(r.value) || 0;
      else if (r.type === "Pagar") cur.saidas += Number(r.value) || 0;
      buckets.set(r.date_normalized, cur);
    }

    const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
    let acumulado = 0;
    const fluxoDiario = Array.from(buckets.keys()).sort().map((key) => {
      const b = buckets.get(key)!;
      const [y, m, d] = key.split("-");
      const saldoDia = round2(b.entradas - b.saidas);
      acumulado = round2(acumulado + saldoDia);
      return { label: `${d}/${m}`, dataCompleta: `${d}/${m}/${y}`, entradas: b.entradas, saidas: b.saidas, saldoDia, acumulado };
    });

    const totalEntradas = fluxoDiario.reduce((s, d) => s + d.entradas, 0);
    const totalSaidas = fluxoDiario.reduce((s, d) => s + d.saidas, 0);

    const summary = { totalEntradas, totalSaidas, saldoLiquido: round2(totalEntradas - totalSaidas), fluxoDiario, cachedAt: new Date().toISOString() };

    await cacheSet(cacheKey, summary, 60);
    res.setHeader("X-Cache", "MISS");
    return res.json(summary);
  } catch (err: any) {
    console.error("[finance/fluxo-caixa-summary]", err?.message);
    return res.status(500).json({ error: "Erro ao calcular fluxo de caixa." });
  }
});

// ── API PÚBLICA ────────────────────────────────────────────────────────────

// Fire-and-forget: nunca aguarda nem propaga erro pro chamador real — uma
// falha aqui não pode derrubar/atrasar a chamada de quem depende da API
// (landing page, Zapier/Make, ERP de cliente). Só 8 primeiros chars da chave,
// nunca a chave inteira.
function logApiKeyUsage(req: express.Request, statusCode: number) {
  if (!supabaseService) return;
  const key = req.headers["x-api-key"] as string | undefined;
  supabaseService
    .from("api_key_usage_log")
    .insert({
      tenant_id: (req as any).tenantId ?? null,
      api_key_prefix: key ? key.slice(0, 8) : "unknown",
      method: req.method,
      path: req.path,
      status_code: statusCode,
      ip: req.ip ?? null,
    })
    .then(({ error }: { error: any }) => {
      if (error) console.warn("[API Keys] Falha ao gravar log de uso:", error.message);
    });
}

// Espelha customFields.reservation (quando presente) na agenda comercial
// (tabela reunioes) — reaproveita a tela de Agenda/Calendário existente pra
// mostrar reservas de sistemas externos (ex.: to na pista) como compromissos,
// já que não existe hoje uma tela de calendário genérica separada de vendas.
// Upsert por id = reservation.id, então reprocessar a mesma reserva (retry,
// migração re-rodada) atualiza em vez de duplicar. Best-effort: falha aqui
// nunca derruba a criação/atualização do lead.
async function syncReuniaoFromReservation(
  reservation: any, tenantId: string, leadId: string, leadName: string, leadEmail: string, company: string
) {
  if (!reservation?.id || !reservation?.date) return;
  const s = String(reservation.status || "").toLowerCase();
  const reuniaoStatus = s.includes("cancel") || s.includes("no-show") || s.includes("no show")
    || s.includes("não compare") || s.includes("nao compare") ? "Cancelada"
    : s.includes("check") ? "Concluída"
    : "Agendada";
  const time = reservation.time ? String(reservation.time).slice(0, 8) : "00:00:00";
  const scheduledAt = `${reservation.date}T${time}`;
  const durationMinutes = Math.max(30, Math.round((Number(reservation.duration) || 1) * 60));
  const pauta = `Reserva de Boliche${reservation.eventType ? " - " + reservation.eventType : ""}`;
  const relatorio = [
    reservation.peopleCount ? `${reservation.peopleCount} pessoa(s)` : null,
    reservation.laneCount ? `${reservation.laneCount} pista(s)` : null,
    reservation.totalValue != null ? `R$ ${reservation.totalValue}` : null,
  ].filter(Boolean).join(" · ");

  const { error } = await supabaseService!.from("reunioes").upsert({
    id: reservation.id,
    leadId, leadName, leadEmail, companyName: company || "",
    closerName: "", closerEmail: "",
    scheduledAt, durationMinutes,
    status: reuniaoStatus, pauta, relatorio,
    tenant_id: tenantId,
  }, { onConflict: "id" });
  if (error) console.error("[API v1] Falha ao sincronizar reunião/agenda:", error.message);
}

app.post("/api/v1/leads", requireApiKey, async (req, res) => {
  const {
    name, company = "", email = "", phone = "", cnpj = "",
    title = "", seller = "", source = "", status = "Novo",
    priority = "Média", value = 0, stageId = "sdr-1",
    pipelineId = "sdr", lead_interesse_cliente = "",
    customFields = {}, clientId = FORM_CLIENT_ID, clientName = "",
    productIds = [],
    tenantName = ""
  } = req.body;

  if (!name) { logApiKeyUsage(req, 400); return res.status(400).json({ error: "O campo 'name' é obrigatório." }); }
  if (!email && !phone) { logApiKeyUsage(req, 400); return res.status(400).json({ error: "Informe ao menos 'email' ou 'phone'." }); }
  if (!supabaseService) { logApiKeyUsage(req, 503); return res.status(503).json({ error: "SUPABASE_SERVICE_ROLE_KEY não configurada no servidor." }); }

  const tenantId = (req as any).tenantId;
  const now = new Date().toISOString().split("T")[0];
  const rawValue = typeof value === "string"
    ? parseFloat(value.replace(/[^\d.,]/g, "").replace(",", ".")) || 0
    : (value ?? 0);
  const normalizedPhone = phone ? String(phone).replace(/\D/g, "") : "";
  const normalizedEmail = email ? String(email).trim().toLowerCase() : "";

  // Dedup por tenant, por telefone/e-mail — evita criar um lead novo a cada chamada
  // pro mesmo contato (ex.: integrações que reportam um evento por cliente, como
  // reservas recorrentes de um sistema de agendamento). Duas queries com .eq()
  // (parametrizadas pelo supabase-js) em vez de um único .or() com string
  // concatenada — phone/email vêm de fora via x-api-key (sem sessão de usuário), e
  // um .or() interpolado permitiria injetar filtros extra na sintaxe do PostgREST
  // (valor contendo vírgula/parênteses).
  let existing: any = null;
  if (normalizedPhone) {
    const { data } = await supabaseService.from("leads").select("id, customFields")
      .eq("tenant_id", tenantId).eq("phone", normalizedPhone).limit(1).maybeSingle();
    existing = data;
  }
  if (!existing && normalizedEmail) {
    const { data } = await supabaseService.from("leads").select("id, customFields")
      .eq("tenant_id", tenantId).eq("email", normalizedEmail).limit(1).maybeSingle();
    existing = data;
  }

  // customFields.reservation (se vier) é acumulado num histórico, deduplicado por
  // id e limitado às últimas 30 entradas — assim tanto uma chamada avulsa quanto
  // uma migração em massa (uma chamada por reserva, em ordem cronológica) resultam
  // no mesmo lead único por contato com o histórico completo.
  const prevCustomFields = existing?.customFields || {};
  const prevHistory = Array.isArray(prevCustomFields.reservationsHistory) ? prevCustomFields.reservationsHistory : [];
  const incomingReservation = customFields?.reservation;
  const mergedHistory = incomingReservation
    ? [...prevHistory.filter((h: any) => h?.id !== incomingReservation.id), incomingReservation].slice(-30)
    : prevHistory;
  const mergedCustomFields = {
    ...prevCustomFields,
    ...customFields,
    reservationsHistory: mergedHistory,
    totalReservations: mergedHistory.length,
  };

  if (existing) {
    // Uma chamada sem reserva (ex.: cadastro avulso de cliente no CRM interno
    // do chamador) nunca deve regredir um lead que já tem histórico de
    // reserva — senão um cliente com reserva confirmada volta pra etapa
    // "Agendado" e perde o valor só porque foi re-cadastrado. Só move
    // etapa/produto/valor quando a chamada realmente traz uma reserva nova,
    // ou quando o lead ainda não tinha nenhuma reserva registrada.
    const canAdvanceStage = !!incomingReservation || prevHistory.length === 0;
    const updatePayload: Record<string, any> = {
      name, company, email: normalizedEmail, phone: normalizedPhone, cnpj,
      priority, source, customFields: mergedCustomFields, tenantName,
      updated_at: new Date().toISOString(),
    };
    if (canAdvanceStage) {
      updatePayload.value = rawValue;
      updatePayload.status = status;
      updatePayload.stageId = stageId;
      updatePayload.pipelineId = pipelineId;
      updatePayload.productIds = productIds;
    }
    const { data, error } = await supabaseService.from("leads").update(updatePayload).eq("id", existing.id).select().maybeSingle();
    if (error) {
      console.error("[API v1] Erro ao atualizar lead:", error.message);
      logApiKeyUsage(req, 500);
      return res.status(500).json({ error: "Falha ao atualizar lead no banco." });
    }
    if (incomingReservation) await syncReuniaoFromReservation(incomingReservation, tenantId, existing.id, name, normalizedEmail, company);
    // syncProposalFromReservation foi REMOVIDO daqui (2026-09-19): a receita
    // de reserva agora é mantida por um pipeline dedicado e determinístico
    // (POST /api/v1/finance-entries, chamado por sync-to-spy a cada update de
    // reserva — ver to-na-pista-boliche/supabase/functions/sync-to-spy). Criar
    // uma "proposta" por reserva aqui duplicava a receita (via a reconciliação
    // proposals→contracts→finance_entries do DataContext.tsx, rodando no
    // browser de quem tiver o Spy aberto) E causava uma rajada de milhares de
    // PATCH em `contracts` de uma vez só quando muitas reservas fechavam junto
    // (ex.: sync em massa) — o mesmo padrão de storm já visto antes nesse
    // arquivo, só que disparado por reserva em vez de por tenant cruzado.
    logApiKeyUsage(req, 200);
    return res.status(200).json({ success: true, lead: data, deduped: true });
  }

  // tenant_id vem só da API key (nunca do corpo da requisição) — ver requireApiKey.
  // "createdAt" NÃO existe na tabela (só "created_at", que já tem default
  // now()) — o insert falhava sempre com 42703 antes desta correção.
  const id = randomUUID();
  const newLead = {
    id, name, company, email: normalizedEmail, phone: normalizedPhone, cnpj, title, seller, source,
    status, priority, value: rawValue, stageId, pipelineId,
    lead_interesse_cliente, customFields: mergedCustomFields, clientId, clientName,
    productIds, tenant_id: tenantId, tenantName, scoreIA: 50, date: now,
  };

  const { data, error } = await supabaseService.from("leads").insert(newLead).select().maybeSingle();
  if (error) {
    console.error("[API v1] Erro ao criar lead:", error.message);
    logApiKeyUsage(req, 500);
    return res.status(500).json({ error: "Falha ao salvar lead no banco." });
  }
  if (incomingReservation) await syncReuniaoFromReservation(incomingReservation, tenantId, id, name, normalizedEmail, company);
  // syncProposalFromReservation removido aqui também — mesmo motivo do bloco
  // de update acima.
  logApiKeyUsage(req, 201);
  return res.status(201).json({ success: true, lead: data ?? newLead, deduped: false });
});

app.get("/api/v1/leads", requireApiKey, async (req, res) => {
  if (!supabaseService) { logApiKeyUsage(req, 503); return res.status(503).json({ error: "SUPABASE_SERVICE_ROLE_KEY não configurada no servidor." }); }

  const { seller, status, limit = "100", offset = "0" } = req.query as Record<string, string>;

  // tenant_id vem só da API key (nunca de query string) — ver requireApiKey.
  let query = supabaseService.from("leads").select("*").eq("tenant_id", (req as any).tenantId)
    .order("created_at", { ascending: false })
    .limit(parseInt(limit)).range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

  if (seller) query = query.eq("seller", seller);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    console.error("[API v1] Erro ao buscar leads:", error.message);
    logApiKeyUsage(req, 500);
    return res.status(500).json({ error: "Falha ao buscar leads." });
  }
  logApiKeyUsage(req, 200);
  return res.json({ success: true, count: data?.length ?? 0, leads: data ?? [] });
});

// Registra uma atividade (nota, ligação, avaliação, sugestão etc.) no
// histórico de um lead já existente — usado por integrações "ao vivo" que
// não têm outro dado além de um evento pontual pra reportar (ex.: to-na-pista-
// boliche registrando uma interação de CRM interna). Nunca cria lead: se o
// contato (telefone/e-mail) não tiver lead correspondente nesse tenant, a
// atividade é descartada (best-effort, sem erro pro chamador) — não faz
// sentido um histórico de atividade "pendurado" sem lead dono.
app.post("/api/v1/lead-activities", requireApiKey, async (req, res) => {
  const {
    phone = "", email = "", type = "Nota", title = "", description = "",
    date = "", seller = "", externalId = "",
  } = req.body;

  if (!title) { logApiKeyUsage(req, 400); return res.status(400).json({ error: "O campo 'title' é obrigatório." }); }
  if (!phone && !email) { logApiKeyUsage(req, 400); return res.status(400).json({ error: "Informe ao menos 'phone' ou 'email'." }); }
  if (!supabaseService) { logApiKeyUsage(req, 503); return res.status(503).json({ error: "SUPABASE_SERVICE_ROLE_KEY não configurada no servidor." }); }

  const tenantId = (req as any).tenantId;
  const normalizedPhone = phone ? String(phone).replace(/\D/g, "") : "";
  const normalizedEmail = email ? String(email).trim().toLowerCase() : "";

  // Mesma lógica de resolução de contato do POST /api/v1/leads (telefone
  // primeiro, e-mail como fallback) — ver ali o porquê de duas queries .eq()
  // em vez de um .or() concatenado.
  let lead: any = null;
  if (normalizedPhone) {
    const { data } = await supabaseService.from("leads").select("id")
      .eq("tenant_id", tenantId).eq("phone", normalizedPhone).limit(1).maybeSingle();
    lead = data;
  }
  if (!lead && normalizedEmail) {
    const { data } = await supabaseService.from("leads").select("id")
      .eq("tenant_id", tenantId).eq("email", normalizedEmail).limit(1).maybeSingle();
    lead = data;
  }
  if (!lead) { logApiKeyUsage(req, 200); return res.status(200).json({ success: true, skipped: true, reason: "Nenhum lead encontrado pra esse contato." }); }

  // Idempotência: reenvio do mesmo evento externo (retry, reprocessamento)
  // nunca duplica a atividade — mesma estratégia de id determinístico usada
  // na migração em massa original (`tnp_interacao_<id>` etc.), só que
  // genérica pra qualquer origem externa daqui em diante.
  const id = externalId ? `tnp_live_${externalId}` : randomUUID();
  const { error } = await supabaseService.from("lead_activities").upsert({
    id, tenant_id: tenantId, lead_id: lead.id, type, title, description,
    date: date || new Date().toISOString().split("T")[0], seller,
  }, { onConflict: "id", ignoreDuplicates: true });

  if (error) {
    console.error("[API v1] Erro ao criar lead_activity:", error.message);
    logApiKeyUsage(req, 500);
    return res.status(500).json({ error: "Falha ao salvar atividade no banco." });
  }
  logApiKeyUsage(req, 201);
  return res.status(201).json({ success: true });
});

// Cria/atualiza um lançamento financeiro a partir de uma fonte externa (ex.:
// fechamento mensal do to-na-pista-boliche). Upsert de verdade (não ignora
// conflito) porque um mês já lançado pode ser revisado depois — o valor mais
// recente pro mesmo externalId deve substituir o anterior.
app.post("/api/v1/finance-entries", requireApiKey, async (req, res) => {
  const {
    externalId = "", description = "", value = 0, date = "",
    category = "", type = "Receber", status = "Pago",
  } = req.body;

  if (!externalId) { logApiKeyUsage(req, 400); return res.status(400).json({ error: "O campo 'externalId' é obrigatório." }); }
  if (!description) { logApiKeyUsage(req, 400); return res.status(400).json({ error: "O campo 'description' é obrigatório." }); }
  if (!supabaseService) { logApiKeyUsage(req, 503); return res.status(503).json({ error: "SUPABASE_SERVICE_ROLE_KEY não configurada no servidor." }); }

  const tenantId = (req as any).tenantId;
  const rawValue = typeof value === "string"
    ? parseFloat(value.replace(/[^\d.,]/g, "").replace(",", ".")) || 0
    : (value ?? 0);
  const id = `tnp_fat_${externalId}`;

  const { error } = await supabaseService.from("finance_entries").upsert({
    id, tenant_id: tenantId, description, value: rawValue,
    date: date || new Date().toISOString().split("T")[0],
    category, type, status,
  }, { onConflict: "id" });

  if (error) {
    console.error("[API v1] Erro ao criar finance_entry:", error.message);
    logApiKeyUsage(req, 500);
    return res.status(500).json({ error: "Falha ao salvar lançamento no banco." });
  }
  logApiKeyUsage(req, 201);
  return res.status(201).json({ success: true });
});

// ── Captação pública do site de marketing (InteractiveForm.tsx, /f/:niche) ──
//
// Antes disso, o formulário só fazia `console.log('Lead Capturado', ...)` e
// mostrava "Nossa equipe já recebeu seus dados" — mentira: ninguém recebia
// nada. Isso é o site de marketing do próprio S.P.Y. (não um formulário
// embutido no site de um tenant cliente), então o lead vai para o tenant
// configurado em SPY_FORM_TENANT_ID — variável que já existia documentada em
// .env.example (ao lado de SPY_FORM_CLIENT_ID) mas nunca tinha sido lida em
// lugar nenhum do código até agora.
app.post("/api/public/lead-capture", async (req, res) => {
  const { niche, name, phone, email, summary } = req.body ?? {};
  if (!name?.toString().trim()) return res.status(400).json({ error: "Nome é obrigatório." });

  const tenantId = process.env.SPY_FORM_TENANT_ID || process.env.AXIS_FORM_TENANT_ID;
  if (!tenantId) return res.status(503).json({ error: "Captação de leads do site não está configurada neste ambiente." });
  if (!supabaseService) return res.status(503).json({ error: "SUPABASE_SERVICE_ROLE_KEY não configurada no servidor." });

  const id = randomUUID();
  const now = new Date().toISOString().split("T")[0];
  const newLead = {
    id,
    name: name.toString().trim().slice(0, 200),
    email: email?.toString().trim().slice(0, 200) || "",
    phone: phone?.toString().trim().slice(0, 30) || "",
    source: `Formulário do site (${niche || "não identificado"})`,
    status: "Novo",
    priority: "Média",
    value: 0,
    notes: summary?.toString().slice(0, 4000) || "",
    tenant_id: tenantId,
    scoreIA: 50,
    date: now,
  };

  try {
    const { error } = await supabaseService.from("leads").insert(newLead);
    if (error) throw new Error(error.message);
    return res.json({ success: true });
  } catch (err: any) {
    console.error("[public/lead-capture]", err?.message);
    return res.status(500).json({ error: "Erro ao registrar sua inscrição. Tente novamente em instantes." });
  }
});

// ── Tenant Theme Discovery (Público para tela de login) ──────────────────────
app.get("/api/auth/tenant-theme", async (req, res) => {
  const { email, host, tenant } = req.query as Record<string, string>;
  const client = supabaseService || supabase;
  if (!client) {
    return res.status(503).json({ error: "Supabase client indisponível." });
  }

  try {
    // 1. Se informou e-mail, busca primeiro na tabela users
    if (email && email.trim()) {
      const cleanEmail = email.trim().toLowerCase();
      const { data: user } = await client
        .from("users")
        .select("tenant_id, tenants(id, name, primary_color, status)")
        .eq("email", cleanEmail)
        .maybeSingle();

      if (user?.tenants && (user.tenants as any).status !== "Inactive") {
        const t = user.tenants as any;
        return res.json({
          primaryColor: t.primary_color || null,
          tenantName: t.name || "",
          tenantId: t.id || "",
          matchedBy: "email_exact",
        });
      }

      // Se não achou na tabela users, analisa partes do e-mail
      const parts = cleanEmail.split("@");
      const userPrefix = parts[0]?.replace(/[^a-zA-Z0-9]/g, " ").trim();
      const domainPart = parts[1]?.split(".")[0]?.trim();
      const tokens = [userPrefix, domainPart].filter(
        (t) => t && t.length > 2 && !["gmail", "hotmail", "outlook", "yahoo"].includes(t.toLowerCase())
      );

      for (const token of tokens) {
        const { data: matchedTenant } = await client
          .from("tenants")
          .select("id, name, primary_color")
          .ilike("name", `%${token}%`)
          .eq("status", "Active")
          .maybeSingle();

        if (matchedTenant) {
          return res.json({
            primaryColor: matchedTenant.primary_color || null,
            tenantName: matchedTenant.name || "",
            tenantId: matchedTenant.id || "",
            matchedBy: "email_token",
          });
        }
      }
    }

    // 2. Se informou host ou tenant específico
    const searchTarget = tenant || host || "";
    if (searchTarget.trim()) {
      const cleanTarget = searchTarget.trim().toLowerCase();
      const hostClean = cleanTarget.replace(/^https?:\/\//, "").split(":")[0];
      const hostParts = hostClean
        .split(".")
        .filter((p) => p.length > 2 && !["com", "br", "app", "io", "net", "crm", "axis-crm", "localhost"].includes(p));

      const { data: activeTenants } = await client
        .from("tenants")
        .select("id, name, primary_color")
        .eq("status", "Active");

      if (activeTenants && activeTenants.length > 0) {
        for (const t of activeTenants) {
          const tName = t.name.toLowerCase();
          if (hostParts.some((hp) => tName.includes(hp)) || tName.includes(cleanTarget)) {
            return res.json({
              primaryColor: t.primary_color || null,
              tenantName: t.name,
              tenantId: t.id,
              matchedBy: "host_or_tenant",
            });
          }
        }
      }
    }

    // 3. Fallback: nenhum tenant identificado
    return res.json({
      primaryColor: null,
      tenantName: "",
      tenantId: "",
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Public Proposal Authenticated Fetch with Full Multi-Tenant Branding ─────
app.get("/api/public-proposal/:token", async (req, res) => {
  const { token } = req.params;
  const client = supabaseService || supabase;
  if (!client) {
    return res.status(503).json({ error: "Supabase client indisponível." });
  }

  try {
    if (!token || token.length < 16) {
      return res.status(400).json({ error: "Token de proposta inválido." });
    }

    // 1. Busca a proposta pelo view_token
    const { data: proposal, error: propErr } = await client
      .from("proposals")
      .select("*")
      .eq("view_token", token)
      .maybeSingle();

    if (propErr || !proposal) {
      return res.status(404).json({ error: "Proposta não encontrada ou link expirado." });
    }

    // 2. Incrementa contador de visualização e timestamp de auditoria
    await client
      .from("proposals")
      .update({
        view_count: (proposal.view_count || 0) + 1,
        last_viewed_at: new Date().toISOString(),
        first_viewed_at: proposal.first_viewed_at || new Date().toISOString(),
      })
      .eq("id", proposal.id);

    // 3. Busca itens da proposta
    const { data: items } = await client
      .from("proposal_items")
      .select("product_name, quantidade, preco_unitario")
      .eq("proposal_id", proposal.id)
      .order("created_at", { ascending: true });

    // 4. Busca dados do tenant responsável pela proposta
    let tenantData: any = null;
    if (proposal.tenant_id) {
      const { data: tenant } = await client
        .from("tenants")
        .select("id, name, primary_color, niche")
        .eq("id", proposal.tenant_id)
        .maybeSingle();
      tenantData = tenant;
    }

    // 5. Busca configurações corporativas (empresa_dados) do tenant
    let empresaDados: any = null;
    if (proposal.tenant_id) {
      const { data: setting } = await client
        .from("app_settings")
        .select("value")
        .eq("key", "empresa_dados")
        .eq("tenant_id", proposal.tenant_id)
        .maybeSingle();
      if (setting?.value) {
        empresaDados = setting.value;
      }
    }

    const tenantPrimaryColor = tenantData?.primary_color || "#2563EB";
    const tenantName =
      empresaDados?.nomeFantasia ||
      empresaDados?.razaoSocial ||
      tenantData?.name ||
      "Empresa Proponente";

    return res.json({
      id: proposal.id,
      titulo: proposal.titulo,
      cliente: proposal.cliente,
      valor: proposal.valor,
      status: proposal.status,
      validade: proposal.validade,
      tipo: proposal.tipo,
      conteudoTexto: proposal.conteudo_texto,
      criadaEm: proposal.created_at,
      vendedor: proposal.vendedor,
      tenantId: proposal.tenant_id,
      tenantName,
      tenantPrimaryColor,
      tenantNiche: tenantData?.niche || "",
      empresaDados: empresaDados || {
        razaoSocial: tenantName,
        nomeFantasia: tenantName,
        cnpj: "",
        emailContato: "",
        telefoneContato: "",
        endereco: "",
      },
      itens: (items || []).map((i: any) => ({
        productName: i.product_name,
        quantidade: i.quantidade,
        precoUnitario: i.preco_unitario,
      })),
    });
  } catch (err: any) {
    console.error("[public-proposal] Erro ao carregar proposta:", err?.message);
    return res.status(500).json({ error: "Erro interno ao processar proposta comercial." });
  }
});

app.post("/api/public-proposal/:token/accept", async (req, res) => {
  const { token } = req.params;
  const { clientName, clientDoc } = req.body || {};
  const client = supabaseService || supabase;
  if (!client) {
    return res.status(503).json({ error: "Supabase client indisponível." });
  }

  try {
    if (!token || token.length < 16) {
      return res.status(400).json({ error: "Token de proposta inválido." });
    }

    const { data: proposal, error: propErr } = await client
      .from("proposals")
      .select("id, status, tenant_id, titulo, cliente")
      .eq("view_token", token)
      .maybeSingle();

    if (propErr || !proposal) {
      return res.status(404).json({ error: "Proposta não encontrada." });
    }

    const { data: updated, error: updateErr } = await client
      .from("proposals")
      .update({
        status: "Aceita",
        updated_at: new Date().toISOString(),
      })
      .eq("id", proposal.id)
      .select()
      .single();

    if (updateErr) {
      console.error("[public-proposal] Erro ao registrar aceite:", updateErr);
      return res.status(500).json({ error: "Erro ao registrar aceite no banco de dados." });
    }

    return res.json({ success: true, status: "Aceita", proposal: updated });
  } catch (err: any) {
    console.error("[public-proposal] Erro ao processar aceite:", err?.message);
    return res.status(500).json({ error: "Erro interno ao processar aceite." });
  }
});

// ── AI Routes ──────────────────────────────────────────────────────────────

app.post("/api/leads/suggest-tags", requireUser, async (req, res) => {
  const { name, company, notes } = req.body;
  if (!process.env.GEMINI_API_KEY) return res.json({ tags: ["Interesse", "Novo Lead", "PME"] });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `Suggest 3-5 relevant tags for a lead with the following info:
      Name: ${name}
      Company: ${company}
      Description: ${notes}
      Return the tags as a JSON array of strings.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
    });
    res.json({ tags: JSON.parse(response.text ?? "[]") });
  } catch (error) {
    console.error("AI Tag Suggestion Error:", error);
    res.status(500).json({ error: "Failed to suggest tags" });
  }
});

// Análise de desempenho de aluno (nicho Educação) — o botão "Solicitar
// Análise" no modal de notas simulava um spinner "Analisando..." e devolvia
// sempre a mesma frase de template (progress% + "desempenho consistente"),
// sem nenhuma IA de verdade por trás. Agora chama Gemini de fato.
app.post("/api/ai/student-performance-insight", requireUser, async (req, res) => {
  const { name, progress, grades } = req.body || {};
  if (!process.env.GEMINI_API_KEY) {
    return res.json({ insight: "IA indisponível no momento — configure a chave de IA para habilitar esta análise." });
  }
  try {
    const gradesText = Array.isArray(grades) && grades.length > 0
      ? grades.map((g: any) => `${g.subject}: ${g.value}`).join(", ")
      : "sem notas lançadas ainda";
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `Você é um coordenador pedagógico. Analise o desempenho deste aluno e escreva 2-3 frases objetivas
em português, destacando pontos fortes, riscos de evasão/desengajamento e uma recomendação prática.
Nome: ${name || "Aluno"}
Progresso no curso: ${progress ?? "desconhecido"}%
Notas lançadas: ${gradesText}
Não invente notas ou fatos que não foram informados acima.`,
    });
    res.json({ insight: (response.text || "Não foi possível gerar uma análise no momento.").trim() });
  } catch (error: any) {
    console.error("Student Performance Insight Error:", error?.message);
    res.status(500).json({ error: "Falha ao gerar análise de desempenho." });
  }
});

// OCR de fatura de energia (nicho Energia Solar) — chave Gemini nunca sai do
// servidor; o frontend manda só a imagem em base64, nunca a API key.
const ALLOWED_FATURA_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

app.post("/api/ai/solar-analyze-fatura", requireUser, async (req, res) => {
  const { imageBase64, mimeType } = req.body || {};
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "IA Offline — GEMINI_API_KEY não configurada." });
  if (!imageBase64 || typeof imageBase64 !== "string") return res.status(400).json({ error: "Imagem da fatura é obrigatória." });
  if (!ALLOWED_FATURA_MIME_TYPES.has(mimeType)) return res.status(400).json({ error: "Formato de imagem não suportado. Use JPEG, PNG ou WebP." });
  // ~4MB decodificados (base64 é ~33% maior que o binário original)
  if (imageBase64.length > 5_600_000) return res.status(400).json({ error: "Imagem muito grande. Envie uma foto de até 4MB." });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: imageBase64 } },
            {
              text: `Esta imagem é uma fatura de energia elétrica brasileira. Extraia exatamente estes campos.
Se um campo não estiver legível ou não existir na fatura, retorne null para ele — nunca invente um valor.
- distribuidora: nome da distribuidora de energia (ex: "CPFL", "Enel", "Light")
- consumoMedioKwh: consumo do mês em kWh (número, sem unidade)
- valorFatura: valor total da fatura em reais (número, sem "R$")
- mesReferencia: mês/ano de referência da fatura (ex: "Março/2026")`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            distribuidora: { type: Type.STRING, nullable: true },
            consumoMedioKwh: { type: Type.NUMBER, nullable: true },
            valorFatura: { type: Type.NUMBER, nullable: true },
            mesReferencia: { type: Type.STRING, nullable: true },
          },
        },
      },
    });

    const extraido = JSON.parse(response.text ?? "{}");
    const consumoMedioKwh = typeof extraido.consumoMedioKwh === "number" ? extraido.consumoMedioKwh : null;
    const valorFatura = typeof extraido.valorFatura === "number" ? extraido.valorFatura : null;

    // Dimensionamento por HSP (Horas de Sol Pico) médio nacional ~4.5h e perdas
    // do sistema ~20% — fórmula padrão de dimensionamento fotovoltaico, não uma
    // cotação exata (varia por região/telhado/orientação — é uma estimativa).
    const HSP_MEDIO_BRASIL = 4.5;
    const EFICIENCIA_SISTEMA = 0.8;
    const potenciaEstimadaKwp = consumoMedioKwh
      ? Math.round((consumoMedioKwh / (HSP_MEDIO_BRASIL * 30 * EFICIENCIA_SISTEMA)) * 100) / 100
      : null;
    // Economia estimada conservadora: sistemas solares tipicamente não zeram a
    // conta (custo de disponibilidade mínimo da distribuidora permanece).
    const economiaMensalEstimada = valorFatura ? Math.round(valorFatura * 0.85 * 100) / 100 : null;

    res.json({
      distribuidora: extraido.distribuidora ?? null,
      consumoMedioKwh,
      valorFatura,
      mesReferencia: extraido.mesReferencia ?? null,
      potenciaEstimadaKwp,
      economiaMensalEstimada,
      economiaAnualEstimada: economiaMensalEstimada ? Math.round(economiaMensalEstimada * 12 * 100) / 100 : null,
    });
  } catch (error: any) {
    console.error("Solar Fatura OCR Error:", error?.message);
    res.status(500).json({ error: "Falha ao analisar a fatura. Tente novamente com uma foto mais nítida." });
  }
});

app.post("/api/cnpj/validate", requireUser, async (req, res) => {
  const { cnpj } = req.body;
  if (!cnpj) return res.status(400).json({ error: "O CNPJ é obrigatório" });

  const cleanCnpj = cnpj.replace(/\D/g, "");
  if (cleanCnpj.length !== 14) return res.json({ valid: false, message: "O CNPJ precisa conter exatamente 14 dígitos." });

  const validateCNPJPattern = (val: string): boolean => {
    if (/^(\d)\1+$/.test(val)) return false;
    let size = val.length - 2;
    let numbers = val.substring(0, size);
    const digits = val.substring(size);
    let sum = 0;
    let pos = size - 7;
    for (let i = size; i >= 1; i--) {
      sum += Number(numbers.charAt(size - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== Number(digits.charAt(0))) return false;
    size += 1;
    numbers = val.substring(0, size);
    sum = 0;
    pos = size - 7;
    for (let i = size; i >= 1; i--) {
      sum += Number(numbers.charAt(size - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    return result === Number(digits.charAt(1));
  };

  if (!validateCNPJPattern(cleanCnpj)) return res.json({ valid: false, message: "CNPJ possui dígito verificador matemático inválido!" });

  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
    if (response.ok) {
      const data = await response.json();
      const isCnpjActive = data.descricao_situacao_cadastral === "ATIVA" || data.situacao_cadastral === 2 || data.situacao_cadastral === "2";
      return res.json({
        valid: true, active: isCnpjActive,
        statusText: data.descricao_situacao_cadastral || "ATIVA",
        companyName: data.razao_social || data.nome_fantasia || "Empresa sob análise",
        message: isCnpjActive
          ? `Empresa ativa: ${data.razao_social || data.nome_fantasia}`
          : `Alerta: Situação cadastral ${data.descricao_situacao_cadastral || "INATIVA"} na Receita Federal.`
      });
    }
    const receitaResponse = await fetch(`https://receitaws.com.br/v1/cnpj/${cleanCnpj}`);
    if (receitaResponse.ok) {
      const rData = await receitaResponse.json();
      if (rData.status === "ERROR") return res.json({ valid: false, message: rData.message || "CNPJ não localizado na Receita Federal." });
      const isCnpjActive = rData.situacao === "ATIVA";
      return res.json({
        valid: true, active: isCnpjActive,
        statusText: rData.situacao || "ATIVA",
        companyName: rData.nome || "Empresa sob análise",
        message: isCnpjActive ? `Empresa ativa: ${rData.nome}` : `Alerta: Situação cadastral ${rData.situacao || "INATIVA"} na Receita Federal.`
      });
    }
    return res.json({ valid: true, active: true, companyName: "Empresa Cadastrada (Validação Offline)", message: "CNPJ com padrão matemático correto (Bancos de dados federais offline)." });
  } catch {
    return res.json({ valid: true, active: true, companyName: "Empresa Cadastrada (Validação Offline)", message: "CNPJ computacionalmente válido (Bancos de dados federais instáveis)." });
  }
});

app.post("/api/leads/calculate-score", requireUser, async (req, res) => {
  const { lead, activities } = req.body;
  if (!lead) return res.status(400).json({ error: "Lead data is required for score calculation" });

  if (process.env.GEMINI_API_KEY) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: `Analyze this CRM lead and its recent activities, and compute:
        1. An AI score (0 to 100) indicating closeness to buying or closing.
        2. A lead temperature ('frio', 'morno', or 'quente').
        3. A brief, informative summary of why the score was given.

        Lead Details:
        - Name: ${lead.name}
        - Title: ${lead.title}
        - Company: ${lead.company}
        - Current Status: ${lead.status}
        - Estimated Value: ${lead.value}
        - Priority: ${lead.priority}

        Recent Activities:
        ${JSON.stringify(activities || [])}

        Return the result strictly as a JSON object with properties: "scoreIA" (integer), "temperature" (string: 'frio' | 'morno' | 'quente'), "iaSummary" (string).`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              scoreIA: { type: Type.INTEGER },
              temperature: { type: Type.STRING },
              iaSummary: { type: Type.STRING }
            },
            required: ["scoreIA", "temperature", "iaSummary"]
          }
        }
      });
      const result = JSON.parse(response.text || "{}");
      return res.json({
        scoreIA: result.scoreIA ?? 50,
        temperature: result.temperature ?? "morno",
        iaSummary: result.iaSummary ?? "Não foi possível gerar a justificativa da IA."
      });
    } catch (error) {
      console.error("AI Lead Scoring failed, falling back to deterministic:", error);
    }
  }

  let score = 50;
  if (lead.status === "Novo") score += 5;
  else if (lead.status === "Prospecção") score += 10;
  else if (lead.status === "Qualificado") score += 20;
  else if (lead.status === "Em Negociação") score += 30;
  else if (lead.status === "Fechado") score += 50;
  else if (lead.status === "Perdido") score -= 30;
  if (lead.priority === "Alta") score += 15;
  else if (lead.priority === "Média") score += 5;
  else if (lead.priority === "Baixa") score -= 10;
  if (activities && Array.isArray(activities)) {
    const leadActivities = activities.filter((a: any) => a.leadId === lead.id);
    score += leadActivities.length * 8;
    if (leadActivities.some((a: any) => a.type === "Reunião")) score += 15;
  }
  score = Math.max(0, Math.min(100, score));

  let temp: "frio" | "morno" | "quente" = "morno";
  if (score < 45) temp = "frio";
  else if (score > 75) temp = "quente";

  const actCount = activities ? activities.filter((a: any) => a.leadId === lead.id).length : 0;
  return res.json({
    scoreIA: score,
    temperature: temp,
    iaSummary: `Cálculo automático (Offline): Lead com prioridade ${lead.priority} na etapa ${lead.status}. Possui ${actCount} atividades registradas no histórico recente.`
  });
});

app.post("/api/ai/performance-audit", requireUser, async (req, res) => {
  const { mrr, cac, ltv, leadsCount, dealsCount } = req.body;
  const mrrNum = Number(mrr) || 0;
  const cacNum = Number(cac) || 0;
  const ltvNum = Number(ltv) || 0;
  const ratio = cacNum > 0 ? (ltvNum / cacNum).toFixed(1) : "3.8";

  const fallbackRecommendations = [
    {
      title: "Otimização de LTV/CAC e Retenção",
      desc: `Relação LTV/CAC calculada em ${ratio}x. Priorize estratégias de onboarding guiado e upsell nos primeiros 60 dias para elevar a retenção em 20%.`,
      impact: "+35% ROI",
      color: "text-blue-400"
    },
    {
      title: "Eficiência do Funil Comercial",
      desc: `Base ativa de ${leadsCount || 0} oportunidades com ${dealsCount || 0} conversões registradas. Reduza o tempo de primeiro contato para menos de 15 minutos para maximizar o fechamento.`,
      impact: "+42% Conversão",
      color: "text-emerald-400"
    },
    {
      title: "Expansão da Receita Recorrente (MRR)",
      desc: `MRR atual de R$ ${mrrNum.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}. Ofereça incentivos e planos anuais com desconto para estabilizar o fluxo de caixa.`,
      impact: "+28% Previsibilidade",
      color: "text-purple-400"
    }
  ];

  if (!process.env.GEMINI_API_KEY) {
    return res.json(fallbackRecommendations);
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `Você é o Master IA do S.P.Y. CRM. Analise estes indicadores:
      MRR: ${mrr}, CAC: ${cac}, LTV: ${ltv}, Leads: ${leadsCount}, Fechamentos: ${dealsCount}.
      Gere 3 recomendações estratégicas baseadas em dados para otimizar o ROI.
      Retorne estritamente um JSON array de objetos: [{"title": string, "desc": string, "impact": string, "color": "text-blue-400" | "text-emerald-400" | "text-purple-400"}].`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING }, desc: { type: Type.STRING },
              impact: { type: Type.STRING }, color: { type: Type.STRING }
            },
            required: ["title", "desc", "impact", "color"]
          }
        }
      }
    });
    const parsed = JSON.parse(response.text ?? "[]");
    if (Array.isArray(parsed) && parsed.length > 0) {
      return res.json(parsed);
    }
    res.json(fallbackRecommendations);
  } catch (err: any) {
    console.warn("[performance-audit] Gemini fallback:", err?.message);
    res.json(fallbackRecommendations);
  }
});

app.post("/api/ai/content-script", requireUser, async (req, res) => {
  const { title, desc, platform } = req.body;
  if (!title) return res.status(400).json({ error: "Informe o título da pauta." });
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "Chave de IA não configurada." });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `Você é um redator de conteúdo para redes sociais. Crie um roteiro curto (15-30 segundos de leitura) para um post de "${platform || "Instagram"}" com o tema "${title}". Contexto adicional: ${desc || "nenhum"}.
      Retorne estritamente um JSON: {"script": string, "hashtags": string[]} (hashtags sem o caractere #, só a palavra).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            script: { type: Type.STRING },
            hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["script", "hashtags"],
        },
      },
    });
    res.json(JSON.parse(response.text ?? "{}"));
  } catch {
    res.status(500).json({ error: "Falha ao gerar script." });
  }
});

app.post("/api/ai/pipeline-audit", requireUser, async (req, res) => {
  const { stageName, leads } = req.body;
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "IA Offline" });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `Analise a etapa "${stageName}" do funil com estes leads:
      ${JSON.stringify(leads.map((l: any) => ({ name: l.name, score: l.scoreIA, temp: l.temperature })))}
      Forneça um insight rápido e uma ação imediata para o vendedor.
      Retorne JSON: {"insight": string, "action": string}.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: { insight: { type: Type.STRING }, action: { type: Type.STRING } },
          required: ["insight", "action"]
        }
      }
    });
    res.json(JSON.parse(response.text ?? "{}"));
  } catch {
    res.status(500).json({ error: "Falha ao auditar funil." });
  }
});

app.post("/api/ai/marketing-advisor", requireUser, async (req, res) => {
  const { leads, spent } = req.body;
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "IA Offline" });
  try {
    const sourceData = leads.reduce((acc: any, l: any) => {
      const src = l.source || "Orgânico";
      acc[src] = (acc[src] || 0) + 1;
      return acc;
    }, {});
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `Análise de Marketing:
      Gasto Total: R$ ${spent}
      Conversão por Origem: ${JSON.stringify(sourceData)}
      Sugira onde realocar verba para diminuir o CAC.
      Retorne JSON: {"suggestion": string, "rationale": string}.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: { suggestion: { type: Type.STRING }, rationale: { type: Type.STRING } },
          required: ["suggestion", "rationale"]
        }
      }
    });
    res.json(JSON.parse(response.text ?? "{}"));
  } catch {
    res.status(500).json({ error: "Falha na análise de marketing." });
  }
});

app.post("/api/ai/settings-audit", requireUser, async (req, res) => {
  const { type, config } = req.body;
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "IA Offline" });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `Você é o Auditor Master do S.P.Y. CRM. Analise esta configuração de ${type}:
      ${JSON.stringify(config)}
      Identifique possíveis gargalos, regras redundantes ou melhorias na lógica.
      Retorne estritamente um JSON: {"audit": string, "suggestions": string[]}.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            audit: { type: Type.STRING },
            suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["audit", "suggestions"]
        }
      }
    });
    res.json(JSON.parse(response.text ?? "{}"));
  } catch {
    res.status(500).json({ error: "Falha ao auditar configurações." });
  }
});

app.get("/api/settings/:category", requireUser, async (req: any, res) => {
  const { category } = req.params;
  if (supabase) {
    // req.supabase (escopado com o JWT do chamador) em vez do client de
    // módulo com a anon key, para respeitar RLS caso a categoria algum dia
    // vire uma tabela real de verdade.
    const tableName = `crm_${category.replace("-", "_")}`;
    const { data, error } = await req.supabase.from(tableName).select("*");
    if (!error && data) return res.json(data);
  }
  // Nenhuma das categorias abaixo tem tabela própria no banco — fallback
  // em memória, isolado por tenant (ver tenantBucket): sem isso, tenant A
  // criando uma origem/campo customizado aparecia pra todo mundo na
  // plataforma, porque era um único array compartilhado pelo processo.
  const { data: tenantId } = await req.supabase.rpc("current_tenant_id");
  if (!tenantId) return res.status(401).json({ error: "Tenant não identificado." });
  switch (category) {
    case "sources": return res.json(tenantBucket(sourcesByTenant, tenantId, DEFAULT_SOURCES));
    case "fields": case "custom-fields": case "custom_lead_fields":
      return res.json(tenantBucket(customFieldsByTenant, tenantId, DEFAULT_CUSTOM_FIELDS));
    case "task-categories": case "categories":
      return res.json(tenantBucket(taskCategoriesByTenant, tenantId, DEFAULT_TASK_CATEGORIES));
    case "templates": return res.json(tenantBucket(templatesByTenant, tenantId, DEFAULT_TEMPLATES));
    default: return res.status(404).json({ error: "Categoria não encontrada" });
  }
});

app.post("/api/settings/:category", requireUser, async (req: any, res) => {
  const { category } = req.params;
  const item = req.body;
  const id = Math.random().toString(36).substring(2, 9);
  const newItem = { id, ...item };
  if (supabase) {
    const tableName = `crm_${category.replace("-", "_")}`;
    const { data, error } = await req.supabase.from(tableName).insert([newItem]).select();
    if (!error && data) return res.json(data[0]);
  }
  const { data: tenantId } = await req.supabase.rpc("current_tenant_id");
  if (!tenantId) return res.status(401).json({ error: "Tenant não identificado." });
  switch (category) {
    case "sources": {
      const newSource = { id, name: item.name || item.nome };
      tenantBucket(sourcesByTenant, tenantId, DEFAULT_SOURCES).push(newSource);
      return res.json(newSource);
    }
    case "fields": case "custom-fields": case "custom_lead_fields":
      tenantBucket(customFieldsByTenant, tenantId, DEFAULT_CUSTOM_FIELDS).push(newItem);
      return res.json(newItem);
    case "task-categories":
      tenantBucket(taskCategoriesByTenant, tenantId, DEFAULT_TASK_CATEGORIES).push(newItem);
      return res.json(newItem);
    case "templates":
      tenantBucket(templatesByTenant, tenantId, DEFAULT_TEMPLATES).push(newItem);
      return res.json(newItem);
    default: return res.status(404).json({ error: "Categoria inválida" });
  }
});

app.delete("/api/settings/:category/:id", requireUser, async (req: any, res) => {
  const { category, id } = req.params;
  if (supabase) {
    const tableName = `crm_${category.replace("-", "_")}`;
    await req.supabase.from(tableName).delete().eq("id", id);
  }
  const { data: tenantId } = await req.supabase.rpc("current_tenant_id");
  if (!tenantId) return res.status(401).json({ error: "Tenant não identificado." });
  switch (category) {
    case "sources":
      sourcesByTenant[tenantId] = tenantBucket(sourcesByTenant, tenantId, DEFAULT_SOURCES).filter((s) => s.id !== id);
      break;
    case "fields": case "custom-fields": case "custom_lead_fields":
      customFieldsByTenant[tenantId] = tenantBucket(customFieldsByTenant, tenantId, DEFAULT_CUSTOM_FIELDS).filter((f) => f.id !== id);
      break;
    case "task-categories": case "categories":
      taskCategoriesByTenant[tenantId] = tenantBucket(taskCategoriesByTenant, tenantId, DEFAULT_TASK_CATEGORIES).filter((c) => c.id !== id);
      break;
    case "templates":
      templatesByTenant[tenantId] = tenantBucket(templatesByTenant, tenantId, DEFAULT_TEMPLATES).filter((t) => t.id !== id);
      break;
  }
  res.json({ success: true });
});

app.post("/api/ai/suggest-new-config", requireUser, async (req, res) => {
  const { type } = req.body;
  if (!process.env.GEMINI_API_KEY) return res.json({ suggestion: null });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `Você é um consultor de CRM. Sugira um exemplo para "${type}".
      NÃO inclua campos como 'target'. Use os campos exatos abaixo.
      Responda APENAS com JSON:
      - Se for "Campo Personalizado": {"name": "Data de Aniversário", "type": "Data", "required": false}
      - Se for "Origem": {"nome": "Indicação Parceiro Premium"}
      - Se for "Categoria de Tarefa": {"nome": "Follow-up Estratégico", "cor": "bg-purple-500"}
      - Se for "Modelo": {"name": "Boas-vindas", "content": "Olá {{name}}, seja bem-vindo!", "category": "Vendas"}`,
      config: { responseMimeType: "application/json" }
    });
    res.json(JSON.parse(response.text ?? "{}"));
  } catch {
    res.status(500).json({ error: "Erro na sugestão da IA" });
  }
});

app.post("/api/ai/generic-insight", requireUser, async (req, res) => {
  const { context, data } = req.body;
  if (!process.env.GEMINI_API_KEY) {
    return res.json({ insight: "A Master IA está em modo offline no momento. Conecte sua API Key para obter insights estratégicos." });
  }
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `Você é o cérebro analítico do S.P.Y. CRM.
      Contexto da solicitação: ${context}.
      Dados brutos para análise: ${JSON.stringify(data)}.
      Sua tarefa: Forneça um insight estratégico curto, direto e acionável em português (máximo 3 frases).
      Foque em melhoria de ROI, conversão ou retenção.`,
    });
    res.json({ insight: response.text ?? "" });
  } catch (error) {
    console.error("Erro na Master IA:", error);
    res.status(500).json({ error: "Falha ao processar insight cerebral." });
  }
});

// ── Post-Meeting Report ────────────────────────────────────────────────────
// (o antigo Copilot de Reunião — /api/ai/reuniao-copilot, Gemini cru e paralelo à Aurora —
// foi removido: a própria Aurora agora cobre esse papel dentro da sala, ver
// useAuroraMeetingPresence.ts + AuroraJitsiVoice.tsx.)

// ── Aurora (chat com o G-TECH AI OS, embutido no S.P.Y.) ─────────────────────
// Proxy autenticado para o webhook do Chat Trigger da Aurora no n8n (workflow AURORA CORE).
// A URL do webhook nunca chega ao navegador — só este backend a conhece (AURORA_WEBHOOK_URL).
app.post("/api/ai/aurora-chat", requireUser, async (req: any, res: any) => {
  const { message, sessionId: clientSessionId } = req.body ?? {};
  if (!message?.trim()) return res.status(400).json({ error: "Mensagem vazia." });

  const webhookUrl = process.env.AURORA_WEBHOOK_URL;
  if (!webhookUrl) return res.status(503).json({ error: "Aurora não está configurada neste ambiente." });

  // Este endpoint atende dois chamadores diferentes com a mesma Aurora (n8n AURORA CORE):
  //   1) o widget da Aurora (AuroraWidget.tsx) — liberado pra qualquer empresa com o módulo
  //      "aurora" ativo (Layout.tsx), não só G-Tech. Cada usuário ganha sua própria sessão de
  //      memória (aurora-user-<id>), isolada das outras empresas; o master/G-Tech mantém a
  //      sessão pessoal histórica ("aurora-gustavo-principal") por compatibilidade com o que já
  //      estava configurado no workflow. tenantId/tenantName/isMaster vão no payload pro workflow
  //      do n8n rotear as ferramentas de escrita (calendário/WhatsApp) pra credencial da empresa
  //      certa — essa parametrização está sendo feita no n8n em paralelo a esta mudança.
  //   2) o copilot de reunião (ReuniaoRoom.tsx / useAuroraMeetingPresence.ts) — manda um
  //      sessionId próprio por reunião (`aurora-reuniao-<reuniaoId>`), disponível a qualquer
  //      closer autenticado. Antes de usar esse reuniaoId pra montar a chave de memória, valida
  //      que a reunião existe pro tenant do chamador — via req.supabase (client escopado ao JWT,
  //      sujeito à RLS da Fase 1), então um reuniaoId de outro tenant simplesmente não aparece.
  let sessionId: string;
  let tenantId: string | null = null;
  let tenantName: string | null = null;
  let isMasterCaller = false;

  const meetingMatch = typeof clientSessionId === "string" ? clientSessionId.match(/^aurora-reuniao-(.+)$/) : null;
  if (meetingMatch) {
    const { data: reuniao, error: reuniaoError } = await req.supabase
      .from("reunioes").select("id").eq("id", meetingMatch[1]).maybeSingle();
    if (reuniaoError || !reuniao) {
      return res.status(403).json({ error: "Reunião não encontrada ou sem permissão de acesso." });
    }
    sessionId = clientSessionId;
  } else {
    const { data: caller, error: callerError } = await req.supabase
      .from("users").select("is_master, tenant_id, tenants(name)").eq("id", req.user.id).maybeSingle();
    if (callerError || !caller) {
      return res.status(403).json({ error: "Não foi possível identificar o usuário." });
    }
    isMasterCaller = !!caller.is_master;
    tenantId = caller.tenant_id ?? null;
    tenantName = (caller as any).tenants?.name ?? null;
    sessionId = isMasterCaller
      ? (clientSessionId || "aurora-gustavo-principal")
      : (clientSessionId || `aurora-user-${req.user.id}`);
  }

  try {
    const { data } = await axios.post(
      webhookUrl,
      { action: "sendMessage", sessionId, chatInput: message, tenantId, tenantName, isMaster: isMasterCaller },
      { timeout: 60000 }
    );
    return res.json({ output: data?.output ?? "", audioBase64: data?.audioBase64 ?? null });
  } catch (err: any) {
    console.error("[Aurora Chat]", err?.response?.data ?? err?.message);
    return res.status(502).json({ error: "Aurora está indisponível agora." });
  }
});

// ── Aurora tenant-scoped: IA operacional que consulta dados reais do tenant ──
//
// Distinta da Aurora Master acima (que fala com um webhook n8n externo e é
// exclusiva de master/reuniões) — esta é a evolução pedida de "chatbot" pra
// "IA operacional": qualquer usuário autenticado pode perguntar em linguagem
// natural ("quais leads estão sem contato há mais de 3 dias?") e a Aurora
// consulta o banco de verdade, nunca inventa números.
//
// Isolamento: cada "tool" abaixo usa req.supabase (client escopado ao JWT do
// chamador, sujeito a RLS) — nunca supabaseService, e nunca um tenantId vindo
// do corpo da requisição. A IA só decide QUAL tool chamar e com quais
// argumentos; a query em si roda com os mesmos privilégios que o usuário já
// tem no resto do sistema. Aurora de um tenant não pode, estruturalmente,
// consultar dado de outro tenant — o mesmo RLS de sempre continua sendo o
// único ponto de verdade sobre isolamento.
//
// NÃO TESTADO contra credencial real (GEMINI_API_KEY) neste ambiente — ver
// regra do projeto sobre marcar como "requer ambiente/credencial externa".
const AURORA_TOOLS = [
  {
    name: "leads_sem_contato",
    description: "Lista leads do funil que estão sem nenhum contato registrado há mais de N dias (ou nunca tiveram contato registrado).",
    parameters: {
      type: Type.OBJECT,
      properties: { dias: { type: Type.NUMBER, description: "Número mínimo de dias sem contato" } },
      required: ["dias"],
    },
  },
  {
    name: "resumo_pipeline",
    description: "Retorna a contagem de leads ativos por status/etapa do funil de vendas do tenant.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "proximas_reunioes",
    description: "Lista as próximas reuniões/compromissos agendados nos próximos N dias.",
    parameters: {
      type: Type.OBJECT,
      properties: { dias: { type: Type.NUMBER, description: "Janela de dias à frente a considerar" } },
      required: ["dias"],
    },
  },
  {
    name: "resumo_financeiro",
    description: "Soma receitas e despesas lançadas nos últimos N dias, por tipo de lançamento.",
    parameters: {
      type: Type.OBJECT,
      properties: { dias: { type: Type.NUMBER, description: "Janela de dias retroativos a considerar" } },
      required: ["dias"],
    },
  },
  {
    name: "tarefas_pendentes",
    description: "Lista tarefas operacionais e follow-ups em aberto ou atrasados do tenant.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "vendas_e_propostas",
    description: "Retorna resumo de propostas comerciais emitidas e vendas registradas no tenant.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "clientes_resumo",
    description: "Retorna a lista e quantidade de clientes cadastrados no tenant por setor e situação.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "solar_funil_resumo",
    description: "Retorna o resumo do funil fotovoltaico do tenant: quantidade de análises por estágio, propostas enviadas, vendas fechadas e potência instalada. Use para perguntas sobre leads solares, propostas e status do funil de energia solar.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
];

async function runAuroraTool(name: string, args: any, supabaseClient: any): Promise<any> {
  const dias = Number(args?.dias) > 0 ? Number(args.dias) : 3;

  if (name === "leads_sem_contato") {
    const cutoff = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabaseClient
      .from("leads")
      .select("name, company, status, last_contact_at")
      .is("deleted_at", null)
      .or(`last_contact_at.is.null,last_contact_at.lt.${cutoff}`)
      .order("last_contact_at", { ascending: true, nullsFirst: true })
      .limit(25);
    if (error) return { error: error.message };
    return { dias_considerados: dias, total: data?.length ?? 0, leads: data ?? [] };
  }

  if (name === "resumo_pipeline") {
    const { data, error } = await supabaseClient.from("leads").select("status").is("deleted_at", null);
    if (error) return { error: error.message };
    const contagem: Record<string, number> = {};
    for (const row of data ?? []) {
      const s = row.status || "Sem status";
      contagem[s] = (contagem[s] || 0) + 1;
    }
    return { total_leads: data?.length ?? 0, por_status: contagem };
  }

  if (name === "proximas_reunioes") {
    const nowIso = new Date().toISOString();
    const futureIso = new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabaseClient
      .from("reunioes")
      .select('leadName, closerName, scheduledAt, status')
      .gte("scheduledAt", nowIso)
      .lte("scheduledAt", futureIso)
      .order("scheduledAt", { ascending: true })
      .limit(25);
    if (error) return { error: error.message };
    return { dias_considerados: dias, total: data?.length ?? 0, reunioes: data ?? [] };
  }

  if (name === "resumo_financeiro") {
    const cutoff = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabaseClient
      .from("finance_entries")
      .select("type, value, status")
      .gte("created_at", cutoff);
    if (error) return { error: error.message };
    const porTipo: Record<string, number> = {};
    for (const row of data ?? []) {
      const t = row.type || "Outro";
      porTipo[t] = (porTipo[t] || 0) + (Number(row.value) || 0);
    }
    return { dias_considerados: dias, total_lancamentos: data?.length ?? 0, soma_por_tipo: porTipo };
  }

  if (name === "tarefas_pendentes") {
    const { data, error } = await supabaseClient
      .from("tasks")
      .select("title, status, priority, date, responsible")
      .neq("status", "Concluída")
      .limit(25);
    if (error) return { error: error.message };
    return { total_pendentes: data?.length ?? 0, tarefas: data ?? [] };
  }

  if (name === "vendas_e_propostas") {
    const { data: propostas, error: propErr } = await supabaseClient
      .from("proposals")
      .select("titulo, cliente, valor, status, created_at")
      .order("created_at", { ascending: false })
      .limit(15);
    if (propErr) return { error: propErr.message };

    const { data: vendas, error: vendErr } = await supabaseClient
      .from("vendas")
      .select("id, valor_total, forma_pagamento, status, created_at")
      .order("created_at", { ascending: false })
      .limit(15);

    return {
      propostas: propostas ?? [],
      vendas_recentes: vendErr ? [] : (vendas ?? [])
    };
  }

  if (name === "clientes_resumo") {
    const { data, error } = await supabaseClient
      .from("clientes")
      .select("name, industry, status, city, state")
      .limit(30);
    if (error) return { error: error.message };
    return { total_clientes: data?.length ?? 0, clientes: data ?? [] };
  }

  if (name === "solar_funil_resumo") {
    const { data, error } = await supabaseClient
      .from("solar_analises")
      .select("status, potencia_estimada_kwp, valor_proposta");
    if (error) return { error: error.message };
    const rows = data ?? [];
    const porEstagio: Record<string, number> = {};
    rows.forEach((r: any) => { porEstagio[r.status] = (porEstagio[r.status] ?? 0) + 1; });
    const fechados = rows.filter((r: any) => r.status === "Concluído");
    const propostasEnviadas = rows.filter((r: any) =>
      ["Proposta Enviada", "Homologação", "Instalação", "Concluído"].includes(r.status)
    ).length;
    return {
      total_leads_solares: rows.length,
      por_estagio: porEstagio,
      propostas_enviadas: propostasEnviadas,
      vendas_fechadas: fechados.length,
      potencia_instalada_kwp: fechados.reduce((s: number, r: any) => s + Number(r.potencia_estimada_kwp ?? 0), 0),
      receita_fechada: fechados.reduce((s: number, r: any) => s + Number(r.valor_proposta ?? 0), 0),
    };
  }

  return { error: `Ferramenta desconhecida: ${name}` };
}

app.post("/api/ai/aurora-tenant-chat", requireUser, async (req: any, res: any) => {
  const { message } = req.body ?? {};
  if (!message?.trim()) return res.status(400).json({ error: "Mensagem vazia." });
  if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: "Aurora operacional não está configurada neste ambiente (GEMINI_API_KEY ausente)." });

  // Gate real de "Agentes vinculados à Aurora" (config em Sistema > Aurora):
  // req.supabase já é escopado por RLS ao tenant do usuário logado, mesmo
  // padrão usado pelas AURORA_TOOLS abaixo — nenhum filtro manual de tenant_id
  // necessário aqui. As AURORA_TOOLS de hoje não têm correspondência 1:1 com
  // esses agentes nomeados (não existe roteamento por ferramenta-por-agente),
  // então o bloqueio é por menção direta do nome na mensagem — o mais honesto
  // dado o que a arquitetura atual realmente suporta.
  let agentGateNotice = "";
  try {
    const { data: agents } = await req.supabase.from("aurora_agents").select("name, active");
    if (agents && agents.length > 0) {
      const lowerMessage = message.toLowerCase();
      const mentionedInactive = (agents as { name: string; active: boolean }[]).find(
        (a) => !a.active && lowerMessage.includes(a.name.toLowerCase())
      );
      if (mentionedInactive) {
        return res.json({ output: `O agente "${mentionedInactive.name}" está desativado nas configurações da Aurora. Ative-o em Configurações > Sistema > Aurora para usá-lo.` });
      }
      const inactiveNames = agents.filter((a: any) => !a.active).map((a: any) => a.name);
      if (inactiveNames.length > 0) {
        agentGateNotice = ` Os seguintes agentes estão desativados e você NUNCA deve agir em nome deles nem sugerir que estão disponíveis: ${inactiveNames.join(", ")}.`;
      }
    }
  } catch (err: any) {
    console.error("[Aurora Tenant Chat] agent gate check failed:", err?.message);
  }

  const systemInstruction = "Você é a Aurora, assistente operacional do S.P.Y. CRM. Responda SOMENTE com base no resultado real das ferramentas disponíveis — nunca invente números, nomes ou datas. Se a pergunta não puder ser respondida com as ferramentas disponíveis, diga isso claramente em vez de adivinhar. Responda em português do Brasil, de forma direta e objetiva." + agentGateNotice;

  try {
    const first = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: message }] }],
      config: { systemInstruction, tools: [{ functionDeclarations: AURORA_TOOLS }] },
    });

    const call = (first as any).functionCalls?.[0];
    if (!call) {
      const text = typeof first.text === "function" ? (first as any).text() : (first.text ?? "");
      return res.json({ output: text || "Não consegui gerar uma resposta agora." });
    }

    const toolResult = await runAuroraTool(call.name, call.args, req.supabase);

    const second = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        { role: "user", parts: [{ text: message }] },
        { role: "model", parts: [{ functionCall: call }] },
        { role: "user", parts: [{ functionResponse: { name: call.name, response: toolResult } }] },
      ],
      config: { systemInstruction, tools: [{ functionDeclarations: AURORA_TOOLS }] },
    });
    const text = typeof second.text === "function" ? (second as any).text() : (second.text ?? "");
    return res.json({ output: text || "Não consegui interpretar o resultado agora.", tool: call.name });
  } catch (err: any) {
    console.error("[Aurora Tenant Chat]", err?.message);
    return res.status(502).json({ error: "Aurora está indisponível agora." });
  }
});

// ── Correção ortográfica de notas ─────────────────────────────────────────────
app.post("/api/ai/corrigir-nota", requireUser, async (req: any, res: any) => {
  const { texto } = req.body ?? {};
  if (!texto?.trim()) return res.json({ corrigido: texto ?? "" });
  const hasAI = process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
  if (!hasAI) return res.json({ corrigido: texto });
  try {
    const corrigido = await generateAI(
      `Corrija apenas os erros ortográficos e de digitação do texto abaixo. Mantenha exatamente o mesmo estilo, tom e conteúdo. Retorne APENAS o texto corrigido, sem explicações, sem aspas, sem prefixos.\n\nTexto: ${texto}`
    );
    return res.json({ corrigido: corrigido.trim() || texto });
  } catch {
    return res.json({ corrigido: texto });
  }
});

// ── Copilot de Lead (pré-reunião — análise estática do perfil) ────────────────
app.post("/api/ai/lead-copilot", requireUser, async (req: any, res: any) => {
  const { leadContext } = req.body ?? {};
  const hasAI = process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
  if (!hasAI) return res.json({ analysis: null, error: "Nenhuma chave de IA configurada." });
  if (!leadContext) return res.status(400).json({ error: "Contexto do lead ausente." });

  try {
    const prompt = `Você é o Copilot de CRM do S.P.Y.. Analise o perfil do lead e retorne SOMENTE o JSON, sem markdown, sem texto extra.

PERFIL DO LEAD:
Nome: ${leadContext.name ?? "Não informado"}
Empresa: ${leadContext.company ?? "Não informado"}
Score IA: ${leadContext.scoreIA ?? "N/A"}
Temperatura: ${leadContext.temperature ?? "N/A"}
Estágio: ${leadContext.stage ?? "Desconhecido"}
Interesse declarado: ${leadContext.lead_interesse ?? "Não informado"}
Resumo SDR: ${leadContext.iaSummary ?? "Sem histórico"}
Produto de interesse: ${leadContext.product ?? "Não definido"}

Responda APENAS com este JSON:
{"resumo_curto":"...","probabilidade_fechamento":70,"recomendacao_proximo_passo":"...","abordagem_ideal":"...","pergunta_abertura":"...","objecoes_previstas":["...","..."],"alerta":""}`;

    const raw  = await generateAI(prompt);
    const data = extractJSON(raw);
    return res.json({ analysis: data });
  } catch (err: any) {
    console.error("[Copilot Lead] Erro:", err?.message);
    return res.json({
      analysis: {
        resumo_curto: "Análise indisponível no momento. Tente novamente.",
        probabilidade_fechamento: null,
        recomendacao_proximo_passo: "Clique em 'Analisar Lead' para tentar novamente.",
        abordagem_ideal: null,
        pergunta_abertura: null,
        objecoes_previstas: [],
        alerta: "Falha ao conectar com a IA: " + (err?.message ?? "erro desconhecido"),
      },
    });
  }
});

app.post("/api/ai/reuniao-relatorio", requireUser, async (req: any, res: any) => {
  const { transcript, notes, leadContext, pauta, reuniaoId } = req.body ?? {};
  const hasAI = process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
  if (!hasAI) return res.json({ relatorio: "Relatório não disponível — configure uma chave de IA." });

  try {
    const relatorio = await generateAI(`Você é o analista de vendas do S.P.Y. CRM. Gere um relatório completo desta reunião.

LEAD: ${leadContext?.name ?? "N/A"} | ${leadContext?.company ?? "N/A"}
Score IA: ${leadContext?.scoreIA ?? "N/A"} | Temperatura: ${leadContext?.temperature ?? "N/A"}
Relatório SDR: ${leadContext?.iaSummary ?? "Sem relatório"}
Pauta: ${pauta ?? "Não definida"}

TRANSCRIÇÃO:
${(transcript ?? "Sem transcrição capturada").slice(0, 4000)}

NOTAS DO CLOSER:
${notes ?? "Sem notas"}

Gere um relatório executivo em markdown com:
## Resumo Executivo
## Pontos-Chave Discutidos
## Análise BANT Final
## Objeções e Como Foram Tratadas
## Próximos Passos (com responsáveis e prazos)
## Recomendação de Fechamento (Alta/Média/Baixa probabilidade e por quê)`);

    if (reuniaoId) {
      // Usa o client escopado com o JWT do chamador (req.supabase, de
      // requireUser) em vez do client anônimo do módulo — a RLS da Fase 1 só
      // libera esse UPDATE para quem está autenticado e pertence ao tenant
      // dono da reunião.
      const { error: updateError } = await req.supabase.from("reunioes").update({
        relatorio_ia: relatorio,
        ...(transcript ? { transcricao: transcript } : {}),
        ...(notes ? { notas_closer: notes } : {}),
        status: "Concluída",
      }).eq("id", reuniaoId);
      if (updateError) console.error("[Relatório Reunião] Erro ao salvar:", updateError.message);
    }

    res.json({ relatorio });
  } catch (err: any) {
    console.error("[Relatório Reunião]", err?.message);
    res.status(500).json({ error: "Erro ao gerar relatório." });
  }
});

// ── Admin: Gestão de Empresas Parceiras (Master) ──────────────────────────

/**
 * Exige que o usuário autenticado (via requireUser) seja Master. Só o Master
 * pode gerenciar credenciais de login de OUTROS usuários — esse é o motivo de
 * essas rotas existirem no backend: alterar e-mail/senha de outro usuário no
 * Supabase Auth exige a Admin API (auth.admin.*), que só funciona com a
 * SUPABASE_SERVICE_ROLE_KEY — uma chave que nunca pode ir para o browser.
 */
async function requireMaster(req: any, res: express.Response, next: express.NextFunction) {
  try {
    const { data: caller, error } = await req.supabase.from("users").select("is_master").eq("id", req.user.id).maybeSingle();
    if (error || !caller?.is_master) {
      return res.status(403).json({ error: "Apenas administradores master podem executar esta ação." });
    }
    next();
  } catch (err: any) {
    console.error("[requireMaster]", err?.message);
    res.status(500).json({ error: "Erro ao verificar permissões de administrador." });
  }
}

// Fase 3 (modo de log) do plano de permissões — expõe o que os triggers de
// permission_check_log já registraram (nunca bloqueia nada, só audita).
// RLS (has_tenant_access) já garante que cada tenant só vê seu próprio log,
// por isso não exige requireMaster — qualquer usuário autenticado do tenant.
app.get("/api/admin/permission-check-log", requireUser, async (req: any, res) => {
  const { data, error } = await req.supabase
    .from("permission_check_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return res.status(500).json({ error: "Erro ao carregar o log de permissões." });
  res.json(data || []);
});

app.get("/api/admin/tenant-admin-user/:tenantId", requireUser, requireMaster, async (req: any, res) => {
  try {
    if (!supabaseService) return res.status(503).json({ error: "SUPABASE_SERVICE_ROLE_KEY não configurada no servidor." });

    const { tenantId } = req.params;
    const { data: adminUser, error } = await supabaseService
      .from("users")
      .select("id, email, name")
      .eq("tenant_id", tenantId)
      .eq("is_master", false)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error || !adminUser) {
      return res.status(404).json({ error: "Nenhum usuário administrador encontrado para esta empresa." });
    }
    res.json({ success: true, user: adminUser });
  } catch (err: any) {
    console.error("[tenant-admin-user]", err?.message);
    res.status(500).json({ error: "Erro ao buscar administrador da empresa." });
  }
});

app.post("/api/admin/tenant-user/:userId/credentials", requireUser, requireMaster, async (req: any, res) => {
  try {
    if (!supabaseService) return res.status(503).json({ error: "SUPABASE_SERVICE_ROLE_KEY não configurada no servidor." });

    const { userId } = req.params;
    const { email, password } = req.body ?? {};

    if (!email && !password) {
      return res.status(400).json({ error: "Informe um novo e-mail e/ou senha para atualizar." });
    }
    if (password && password.length < 6) {
      return res.status(400).json({ error: "A senha precisa ter pelo menos 6 caracteres." });
    }

    const authUpdates: { email?: string; password?: string } = {};
    if (email) authUpdates.email = email;
    if (password) authUpdates.password = password;

    const { error: authError } = await supabaseService.auth.admin.updateUserById(userId, authUpdates);
    if (authError) {
      console.error("[tenant-user-credentials] Falha ao atualizar credenciais:", authError.message);
      return res.status(500).json({ error: "Falha ao atualizar credenciais." });
    }

    if (email) {
      await supabaseService.from("users").update({ email }).eq("id", userId);
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("[tenant-user-credentials]", err?.message);
    res.status(500).json({ error: "Erro ao atualizar credenciais do administrador." });
  }
});

/**
 * Cria uma empresa parceira + o usuário administrador inicial dela, num
 * fluxo administrativo (é o Master quem define e-mail/senha, não a própria
 * empresa se auto-cadastrando). Por isso usamos a Admin API com
 * email_confirm: true — a conta já nasce confirmada, sem depender de e-mail
 * de confirmação (que além de desnecessário aqui, saía com o link apontando
 * para a Site URL configurada no Supabase, não para o domínio do S.P.Y.).
 */
app.post("/api/admin/tenant", requireUser, requireMaster, async (req: any, res) => {
  if (!supabaseService) return res.status(503).json({ error: "SUPABASE_SERVICE_ROLE_KEY não configurada no servidor." });

  const { tenantName, niche, adminEmail, adminPassword, plan, primaryColor, timezone, modules } = req.body ?? {};
  if (!tenantName?.trim()) return res.status(400).json({ error: "Informe o nome da empresa." });
  if (!adminEmail?.trim()) return res.status(400).json({ error: "Informe o e-mail do administrador da empresa." });
  if (!adminPassword || adminPassword.length < 6) return res.status(400).json({ error: "A senha do administrador precisa ter pelo menos 6 caracteres." });

  try {
    const { data: existingUser } = await supabaseService.from("users").select("id").eq("email", adminEmail.trim()).maybeSingle();
    if (existingUser) return res.status(409).json({ error: "Este e-mail já está cadastrado no sistema." });

    const { data: tenantData, error: tenantError } = await supabaseService
      .from("tenants")
      .insert({
        name: tenantName.trim(),
        niche: niche || "Parceira",
        plan: typeof plan === "string" && plan.trim() ? plan.trim().slice(0, 50) : "start",
        status: "Active",
        timezone: timezone?.trim() || "America/Sao_Paulo",
        primary_color: /^#[0-9A-Fa-f]{6}$/.test(primaryColor) ? primaryColor : "#2563EB",
        modules: modules && typeof modules === "object"
          ? modules
          : { crm: true, sdr: false, advDashboard: false, financeiro: true, marketing: false, educacao: false, clinica: false, produtividade: true, rh: false, bi: false, engajamento: false },
      })
      .select()
      .maybeSingle();
    if (tenantError || !tenantData) {
      console.error("[tenant-create] Falha ao criar tenant:", tenantError?.message);
      return res.status(500).json({ error: "Erro ao criar empresa." });
    }

    const { data: authData, error: authError } = await supabaseService.auth.admin.createUser({
      email: adminEmail.trim(),
      password: adminPassword,
      email_confirm: true,
    });
    if (authError || !authData.user) {
      console.error("[tenant-create] Falha ao criar conta de acesso:", authError?.message);
      await supabaseService.from("tenants").delete().eq("id", tenantData.id);
      return res.status(500).json({ error: "Erro ao criar conta de acesso do administrador." });
    }

    const { error: profileError } = await supabaseService.from("users").insert({
      id: authData.user.id,
      tenant_id: tenantData.id,
      name: `Admin ${tenantName.trim()}`,
      email: adminEmail.trim(),
      role: "Admin",
      is_master: false,
      active: true,
    });
    if (profileError) {
      console.error("[tenant-create] Falha ao criar perfil do admin:", profileError.message);
      await supabaseService.from("tenants").delete().eq("id", tenantData.id);
      await supabaseService.auth.admin.deleteUser(authData.user.id);
      return res.status(500).json({ error: "Erro ao criar o perfil do administrador." });
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("[tenant-create]", err?.message);
    res.status(500).json({ error: "Erro ao cadastrar empresa." });
  }
});

// ── WhatsApp — Simulador ou WAHA real (ver server/whatsappProvider.ts) ──
//
// Instâncias agora são persistidas de verdade em whatsapp_instances (RLS por
// tenant) em vez de um array em memória do processo. Qual provider concreto
// (Simulador ou WAHA) faz o trabalho por trás de cada chamada depende só de
// WAHA_API_URL estar configurada no ambiente — nunca é decidido pelo cliente.
// O frontend deve sempre consultar
// GET /api/whatsapp/provider-status antes de apresentar essas telas como uma
// conexão real, em vez de assumir isso.

function bodyWithFallback(req: any) { return req.body || {}; }

function mapInstanceRow(row: any) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone || "-",
    status: row.status,
    apiKey: row.api_key,
    webhookUrl: row.webhook_url || "",
    qrcode: row.qrcode || "",
    provider: row.provider,
    createdAt: row.created_at,
  };
}

app.get("/api/whatsapp/provider-status", requireUser, async (_req: any, res) => {
  res.json({ provider: getActiveProviderName(), configured: isWahaConfigured() });
});

app.get("/api/whatsapp/instances", requireUser, async (req: any, res) => {
  const { data, error } = await req.supabase.from("whatsapp_instances").select("*").order("created_at", { ascending: false });
  if (error) {
    console.error("[whatsapp/instances GET]", error.message);
    return res.status(500).json({ error: "Erro ao carregar instâncias." });
  }
  res.json((data || []).map(mapInstanceRow));
});

app.post("/api/whatsapp/instances", requireUser, async (req: any, res) => {
  const { name, webhookUrl = "" } = req.body;
  if (!name) return res.status(400).json({ error: "Nome da instância é obrigatório" });

  const provider = getWhatsAppProvider();
  const { data: row, error: insertError } = await req.supabase
    .from("whatsapp_instances")
    .insert({ name, webhook_url: webhookUrl, status: "DISCONNECTED", provider: provider.name })
    .select().maybeSingle();
  if (insertError || !row) {
    console.error("[whatsapp/instances POST]", insertError?.message);
    return res.status(500).json({ error: "Erro ao criar instância." });
  }

  try {
    const created = await provider.createInstance(row.id, webhookUrl);
    const { data: updated } = await req.supabase
      .from("whatsapp_instances")
      .update({ api_key: created.apiKey })
      .eq("id", row.id).select().maybeSingle();
    return res.json(mapInstanceRow(updated || row));
  } catch (err: any) {
    console.error(`[whatsapp/instances POST] provider=${provider.name}`, err?.message);
    // A linha já existe no banco (estado DISCONNECTED) — devolve mesmo assim
    // em vez de deixar o usuário sem instância nenhuma; ele pode tentar
    // conectar de novo depois.
    return res.json(mapInstanceRow(row));
  }
});

app.post("/api/whatsapp/instances/:id/qrcode", requireUser, async (req: any, res) => {
  const { id } = req.params;
  const { data: inst, error } = await req.supabase.from("whatsapp_instances").select("*").eq("id", id).maybeSingle();
  if (error || !inst) return res.status(404).json({ error: "Instância não encontrada" });

  const provider = getWhatsAppProvider();
  try {
    const result = await provider.getQrCode(id);
    await req.supabase.from("whatsapp_instances").update({ status: result.status, qrcode: result.qrcode }).eq("id", id);
    res.json(result);
  } catch (err: any) {
    console.error(`[whatsapp/instances/qrcode] provider=${provider.name}`, err?.message);
    res.status(502).json({ error: `Falha ao gerar QR code (${provider.name}): ${err?.message || "erro desconhecido"}` });
  }
});

app.post("/api/whatsapp/instances/:id/connect", requireUser, async (req: any, res) => {
  const { id } = req.params;
  const { data: inst, error } = await req.supabase.from("whatsapp_instances").select("*").eq("id", id).maybeSingle();
  if (error || !inst) return res.status(404).json({ error: "Instância não encontrada" });

  const provider = getWhatsAppProvider();
  try {
    const result = await provider.getConnectionState(id);
    const { data: updated } = await req.supabase
      .from("whatsapp_instances")
      .update({ status: result.status, phone: result.phone ?? inst.phone, qrcode: null })
      .eq("id", id).select().maybeSingle();
    res.json({ status: result.status, instance: mapInstanceRow(updated || inst) });
  } catch (err: any) {
    console.error(`[whatsapp/instances/connect] provider=${provider.name}`, err?.message);
    res.status(502).json({ error: `Falha ao verificar conexão (${provider.name}): ${err?.message || "erro desconhecido"}` });
  }
});

app.delete("/api/whatsapp/instances/:id", requireUser, async (req: any, res) => {
  const { id } = req.params;
  const provider = getWhatsAppProvider();
  try { await provider.deleteInstance(id); } catch (err: any) { console.error(`[whatsapp/instances DELETE] provider=${provider.name}`, err?.message); }
  const { error } = await req.supabase.from("whatsapp_instances").delete().eq("id", id).select("id");
  if (error) return res.status(500).json({ error: "Erro ao remover instância." });
  res.json({ success: true, message: `Instância ${id} removida` });
});

app.put("/api/whatsapp/instances/:id", requireUser, async (req: any, res) => {
  const { id } = req.params;
  const { webhookUrl, name, phone, status } = req.body;
  const updates: Record<string, any> = {};
  if (webhookUrl !== undefined) updates.webhook_url = webhookUrl;
  if (name !== undefined) updates.name = name;
  if (phone !== undefined) updates.phone = phone;
  if (status !== undefined) updates.status = status;

  const { data: updated, error } = await req.supabase.from("whatsapp_instances").update(updates).eq("id", id).select().maybeSingle();
  if (error || !updated) return res.status(404).json({ error: "Instância não encontrada" });
  res.json(mapInstanceRow(updated));
});

app.get("/api/whatsapp/contacts", requireUser, async (req: any, res) => {
  const { data: tenantId } = await req.supabase.rpc("current_tenant_id");
  res.json(tenantBucket(contactsByTenant, tenantId, []));
});

app.post("/api/whatsapp/contacts", requireUser, async (req: any, res) => {
  const { name, phone, email, tags = ["lead"] } = req.body;
  if (!name || !phone) return res.status(400).json({ error: "Nome e Telefone são obrigatórios" });
  const { data: tenantId } = await req.supabase.rpc("current_tenant_id");
  const contacts = tenantBucket(contactsByTenant, tenantId, []);
  const cleanPhone = phone.startsWith("+") ? phone : `+55 ${phone}`;
  const existing = contacts.find((c) => c.phone === cleanPhone);
  if (existing) return res.json(existing);
  const initials = name.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase() || "WA";
  const newContact: ChatContact = {
    id: Math.random().toString(36).substring(2, 9),
    name, avatar: initials, channel: "WhatsApp",
    lastMessage: "Nova conversa iniciada",
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    unread: 0, online: Math.random() > 0.5,
    phone: cleanPhone, email, tags, slaStatus: "Dentro do Prazo"
  };
  contacts.unshift(newContact);
  tenantMessages(tenantId)[newContact.id] = [];
  res.json(newContact);
});

app.get("/api/whatsapp/messages/:contactId", requireUser, async (req: any, res) => {
  const { contactId } = req.params;
  const { data, error } = await req.supabase.from("chat_messages").select("*").eq("contact_id", contactId).order("timestamp", { ascending: true });
  if (!error && data) return res.json(data);
  const { data: tenantId } = await req.supabase.rpc("current_tenant_id");
  res.json(tenantMessages(tenantId)[contactId] || []);
});

app.post("/api/whatsapp/messages/send", requireUser, async (req: any, res) => {
  const { contactId, text } = req.body;
  if (!contactId || !text) return res.status(400).json({ error: "ID do contato e texto são obrigatórios" });
  const { data: tenantId } = await req.supabase.rpc("current_tenant_id");

  const provider = getWhatsAppProvider();
  if (provider.name === "waha") {
    // Só entra aqui se WAHA_API_URL estiver configurada — nesse modo o envio
    // precisa ser real (nada de eco local fingindo sucesso).
    const contactForSend = tenantBucket(contactsByTenant, tenantId, []).find((c) => c.id === contactId);
    if (!contactForSend) return res.status(404).json({ error: "Contato não encontrado" });
    if (!contactForSend.phone) return res.status(400).json({ error: "Contato sem telefone cadastrado — não é possível enviar via WhatsApp." });
    const { data: inst } = await req.supabase.from("whatsapp_instances").select("id").eq("status", "CONNECTED").limit(1).maybeSingle();
    if (!inst) return res.status(409).json({ error: "Nenhuma instância WhatsApp conectada. Conecte uma instância antes de enviar mensagens." });
    try {
      await provider.sendTextMessage(inst.id, contactForSend.phone, text);
    } catch (err: any) {
      console.error("[whatsapp/messages/send] waha", err?.message);
      return res.status(502).json({ error: `Falha ao enviar mensagem via WAHA: ${err?.message || "erro desconhecido"}` });
    }
  }

  const timeString = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const userMsg: ChatMessage = {
    id: "msg_" + Math.random().toString(36).substring(2, 9),
    text, sender: "me", time: timeString, status: "sent", timestamp: Date.now()
  };
  const msgsByContact = tenantMessages(tenantId);
  if (!msgsByContact[contactId]) msgsByContact[contactId] = [];
  msgsByContact[contactId].push(userMsg);
  // req.supabase (escopado pela sessão do chamador, respeita RLS) em vez do client
  // anon module-level — essas tabelas não existem hoje (ver SECURITY_AUDIT.md item
  // A9), então isso é um no-op silencioso, mas já fica correto pra quando existirem.
  await req.supabase.from("chat_messages").insert([{ id: userMsg.id, text: userMsg.text, sender: userMsg.sender, time: userMsg.time, status: userMsg.status, timestamp: userMsg.timestamp, contact_id: contactId, tenant_id: tenantId }]);
  await req.supabase.from("chat_contacts").update({ lastMessage: text, time: timeString }).eq("id", contactId);
  const contact = tenantBucket(contactsByTenant, tenantId, []).find((c) => c.id === contactId);
  if (contact) { contact.lastMessage = text; contact.time = timeString; }
  res.json({ success: true, message: userMsg });
});

app.post("/api/whatsapp/simulate-incoming", requireUser, async (req: any, res) => {
  // Só existe pra testar a UI de conversas sem depender de tráfego real —
  // não deve funcionar (e muito menos ser oferecido) quando há uma conexão
  // WAHA real ativa, pra nunca ser confundido com uma mensagem que de fato
  // chegou de um cliente no WhatsApp.
  if (getActiveProviderName() !== "simulator") {
    return res.status(409).json({ error: "Simulação de mensagem indisponível: há uma conexão WhatsApp real ativa (WAHA)." });
  }
  const { contactId, text } = req.body;
  if (!contactId || !text) return res.status(400).json({ error: "contactId e texto são obrigatórios" });
  const { data: tenantId } = await req.supabase.rpc("current_tenant_id");
  const contact = tenantBucket(contactsByTenant, tenantId, []).find((c) => c.id === contactId);
  if (!contact) return res.status(404).json({ error: "Contato não encontrado" });
  const timeString = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const inMsg: ChatMessage = {
    id: "msg_sim_" + Math.random().toString(36).substring(2, 9),
    text, sender: "them", time: timeString, timestamp: Date.now()
  };
  const msgsByContact = tenantMessages(tenantId);
  if (!msgsByContact[contactId]) msgsByContact[contactId] = [];
  msgsByContact[contactId].push(inMsg);
  contact.lastMessage = text;
  contact.time = timeString;
  contact.unread += 1;
  await req.supabase.from("chat_messages").insert([{ id: inMsg.id, text: inMsg.text, sender: inMsg.sender, time: inMsg.time, timestamp: inMsg.timestamp, contact_id: contactId, tenant_id: tenantId }]);
  await req.supabase.from("chat_contacts").update({ lastMessage: text, time: timeString, unread: contact.unread }).eq("id", contactId);
  res.json({ message: inMsg, contact });
});

app.post("/api/whatsapp/copilot/analyze", requireUser, async (req: any, res) => {
  const { contactId } = req.body;
  if (!contactId) return res.status(400).json({ error: "contactId é obrigatório" });
  const { data: tenantId } = await req.supabase.rpc("current_tenant_id");
  const chatHistory = tenantMessages(tenantId)[contactId] || [];
  const contact = tenantBucket(contactsByTenant, tenantId, []).find((c) => c.id === contactId);
  if (chatHistory.length === 0) {
    return res.json({
      suggestion: "Ainda não há mensagens registradas com este contato para analisar. Tente fazer uma saudação cortês, introduzindo o S.P.Y. CRM e perguntando como pode auxiliá-lo.",
      sentiment: "Neutro"
    });
  }
  const conversationText = chatHistory.map((m) => `${m.sender === "me" ? "Vendedor/Atendente" : "Cliente"}: ${m.text}`).join("\n");
  const promptContext = `Você é o S.P.Y. Copilot, um assistente especializado em CRM, Vendas e Atendimento via WhatsApp.
  O cliente se chama: ${contact ? contact.name : "Cliente"}.
  O histórico de mensagens é este:
  ${conversationText}
  Sua tarefa é:
  1. Analisar brevemente o status/intenção do cliente (especialmente dúvidas de frete, preço, fechamento).
  2. Sugerir a RESPOSTA PERFEITA em português para o vendedor copiar e enviar.
  Retorne a resposta no formato JSON:
  - analysis (uma frase resumindo o sentimento e status das negociações)
  - suggestion (o rascunho exato da mensagem pronta para o vendedor usar)
  - sentiment (Positivo, Neutro ou Negativo)`;
  try {
    if (!process.env.GEMINI_API_KEY) {
      const lastMsg = chatHistory[chatHistory.length - 1];
      let sugg = `Olá ${contact ? contact.name : ""}, compreendo sua dúvida! Estamos analisando sua solicitação. De qualquer forma, gostaria de agendar uma ligação rápida hoje às 14h para fecharmos os detalhes?`;
      if (lastMsg.text.toLowerCase().includes("frete")) {
        sugg = `Olá ${contact ? contact.name : ""}, com certeza! Para sua região, nós conseguimos fazer o frete com um desconto especial de 50%, ou até GRÁTIS se fecharmos o contrato Pro hoje. O que acha?`;
      }
      return res.json({ analysis: "O cliente demonstrou interesse inicial. A IA sugere oferecer atendimento ágil para acelerar o fechamento.", suggestion: sugg, sentiment: "Positivo" });
    }
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: promptContext,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: { analysis: { type: Type.STRING }, suggestion: { type: Type.STRING }, sentiment: { type: Type.STRING } },
          required: ["analysis", "suggestion", "sentiment"]
        },
      },
    });
    res.json(JSON.parse(response.text ?? "{}"));
  } catch (e) {
    console.error("Copilot analysis failure:", e);
    res.status(500).json({ error: "Erro de processamento da IA" });
  }
});

// ── Testes reais de integrações (Configurações → Integrações) ──────────────
//
// "Disparar Teste" (webhooks globais e SDR) e "Testar Conexão TLS" (SMTP)
// eram puro teatro: um toast.promise em cima de um setTimeout, sem nenhuma
// chamada de rede de verdade — sempre "sucesso", mesmo com URL/credencial
// inválida ou vazia. Isso roda no backend (não no navegador) porque muitos
// receptores de webhook (n8n, Make, Zapier) não respondem com header CORS,
// então um fetch direto do browser falharia mesmo com a URL certa.

app.post("/api/integrations/webhook-test", requireUser, async (req: any, res) => {
  const { url, event, payload } = req.body ?? {};
  if (!url) return res.status(400).json({ error: "URL do webhook é obrigatória." });
  try {
    const started = Date.now();
    const response = await axios.post(
      url,
      payload ?? { event: event || "test_ping", test: true, timestamp: new Date().toISOString() },
      { timeout: 8000, validateStatus: () => true }
    );
    const ok = response.status >= 200 && response.status < 300;
    res.json({ ok, status: response.status, latencyMs: Date.now() - started });
  } catch (err: any) {
    res.json({ ok: false, status: null, error: err?.code === "ECONNABORTED" ? "Tempo de resposta esgotado (timeout)." : (err?.message || "Falha ao conectar ao endpoint.") });
  }
});

// ── Conector Externo (FASE 5.4 — mandato Aurora+SPY+Integrações, V1 API/Webhook-only) ──────
// Escrita/leitura do secret_value nunca passa pelo cliente do tenant (RLS nega tudo na tabela
// base) — só estas rotas, via supabaseService. tenant_id nunca vem do corpo da requisição:
// resolvido aqui a partir do próprio usuário autenticado (mesmo princípio de /api/v1/leads).
async function requireTenantAdmin(req: any, res: express.Response, next: express.NextFunction) {
  try {
    const { data: caller, error } = await req.supabase
      .from("users")
      .select("is_master, is_tenant_admin, tenant_id")
      .eq("id", req.user.id)
      .maybeSingle();
    if (error || !caller) {
      return res.status(403).json({ error: "Não foi possível verificar permissões." });
    }
    if (!caller.is_master && !caller.is_tenant_admin) {
      return res.status(403).json({ error: "Apenas administradores da empresa podem gerenciar conectores externos." });
    }
    req.tenantId = caller.tenant_id;
    next();
  } catch (err: any) {
    console.error("[requireTenantAdmin]", err?.message);
    res.status(500).json({ error: "Erro ao verificar permissões." });
  }
}

app.post("/api/integrations/external", requireUser, requireTenantAdmin, async (req: any, res) => {
  if (!supabaseService) return res.status(503).json({ error: "SUPABASE_SERVICE_ROLE_KEY não configurada no servidor." });
  const { name, base_url, auth_type = "none", auth_header_name, secret_value, sync_events = [] } = req.body ?? {};
  if (!name || !base_url) return res.status(400).json({ error: "Nome e URL base são obrigatórios." });
  if (!["none", "api_key", "bearer", "basic"].includes(auth_type)) {
    return res.status(400).json({ error: "Tipo de autenticação inválido." });
  }
  try {
    new URL(base_url);
    if (!base_url.startsWith("https://")) return res.status(400).json({ error: "A URL base deve usar HTTPS." });
  } catch {
    return res.status(400).json({ error: "URL base inválida." });
  }

  const { data, error } = await supabaseService
    .from("external_integrations")
    .insert({
      tenant_id: req.tenantId,
      name,
      base_url,
      auth_type,
      auth_header_name: auth_header_name || null,
      secret_value: secret_value || null,
      sync_events,
      updated_by: req.user.id,
    })
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[Conector Externo] Erro ao criar:", error.message);
    return res.status(500).json({ error: "Falha ao salvar o conector." });
  }
  res.status(201).json({ success: true, id: data?.id });
});

app.put("/api/integrations/external/:id", requireUser, requireTenantAdmin, async (req: any, res) => {
  if (!supabaseService) return res.status(503).json({ error: "SUPABASE_SERVICE_ROLE_KEY não configurada no servidor." });
  const { name, base_url, auth_type, auth_header_name, secret_value, sync_events, active } = req.body ?? {};

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: req.user.id };
  if (name !== undefined) updates.name = name;
  if (base_url !== undefined) {
    if (!base_url.startsWith("https://")) return res.status(400).json({ error: "A URL base deve usar HTTPS." });
    updates.base_url = base_url;
  }
  if (auth_type !== undefined) updates.auth_type = auth_type;
  if (auth_header_name !== undefined) updates.auth_header_name = auth_header_name || null;
  // secret_value só é sobrescrito se um valor novo, não-vazio, foi enviado — permite editar
  // outros campos (ex.: desativar) sem precisar re-digitar o segredo já salvo.
  if (secret_value) updates.secret_value = secret_value;
  if (sync_events !== undefined) updates.sync_events = sync_events;
  if (active !== undefined) updates.active = active;

  // .eq("tenant_id", ...) garante que um admin não pode editar o conector de outro tenant
  // mesmo sabendo o id (RLS na tabela base nega tudo pro cliente, mas esta rota usa
  // supabaseService — o isolamento aqui é feito explicitamente na query, não pela RLS).
  const { error } = await supabaseService
    .from("external_integrations")
    .update(updates)
    .eq("id", req.params.id)
    .eq("tenant_id", req.tenantId);
  if (error) {
    console.error("[Conector Externo] Erro ao atualizar:", error.message);
    return res.status(500).json({ error: "Falha ao atualizar o conector." });
  }
  res.json({ success: true });
});

app.delete("/api/integrations/external/:id", requireUser, requireTenantAdmin, async (req: any, res) => {
  if (!supabaseService) return res.status(503).json({ error: "SUPABASE_SERVICE_ROLE_KEY não configurada no servidor." });
  const { error } = await supabaseService
    .from("external_integrations")
    .delete()
    .eq("id", req.params.id)
    .eq("tenant_id", req.tenantId);
  if (error) {
    console.error("[Conector Externo] Erro ao excluir:", error.message);
    return res.status(500).json({ error: "Falha ao excluir o conector." });
  }
  res.json({ success: true });
});

// Teste real: busca o conector (com o segredo) no backend, monta o mesmo header que o
// dispatcher (dispatch_external_integration_event) montaria, e faz uma chamada de verdade —
// não é um setTimeout/Math.random() fingindo sucesso (mesmo cuidado já aplicado no teste do
// Meta Pixel).
app.post("/api/integrations/external/:id/test", requireUser, requireTenantAdmin, async (req: any, res) => {
  if (!supabaseService) return res.status(503).json({ error: "SUPABASE_SERVICE_ROLE_KEY não configurada no servidor." });
  const { data: integration, error } = await supabaseService
    .from("external_integrations")
    .select("*")
    .eq("id", req.params.id)
    .eq("tenant_id", req.tenantId)
    .maybeSingle();
  if (error || !integration) return res.status(404).json({ error: "Conector não encontrado." });

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (integration.auth_type === "bearer" && integration.secret_value) {
    headers["Authorization"] = `Bearer ${integration.secret_value}`;
  } else if (integration.auth_type === "api_key" && integration.secret_value) {
    headers[integration.auth_header_name || "X-API-Key"] = integration.secret_value;
  } else if (integration.auth_type === "basic" && integration.secret_value) {
    headers["Authorization"] = `Basic ${Buffer.from(integration.secret_value).toString("base64")}`;
  }

  try {
    const started = Date.now();
    const response = await axios.post(
      integration.base_url,
      { event: "test_ping", integration: integration.name, timestamp: new Date().toISOString() },
      { headers, timeout: 8000, validateStatus: () => true }
    );
    const ok = response.status >= 200 && response.status < 300;
    res.json({ ok, status: response.status, latencyMs: Date.now() - started });
  } catch (err: any) {
    res.json({ ok: false, status: null, error: err?.code === "ECONNABORTED" ? "Tempo de resposta esgotado (timeout)." : (err?.message || "Falha ao conectar ao endpoint.") });
  }
});

app.post("/api/integrations/smtp-test", requireUser, async (req: any, res) => {
  const { smtpServer, smtpPort, encryption, smtpUser, smtpPass } = req.body ?? {};
  if (!smtpServer || !smtpPort || !smtpUser || !smtpPass) {
    return res.status(400).json({ error: "Preencha host, porta, usuário e senha antes de testar." });
  }
  try {
    const transporter = nodemailer.createTransport({
      host: smtpServer,
      port: Number(smtpPort),
      secure: encryption === "SSL/TLS", // true = TLS implícito (465); StartTLS/Nenhuma negociam na porta 587/25
      auth: { user: smtpUser, pass: smtpPass },
      connectionTimeout: 8000,
    });
    await transporter.verify();
    res.json({ ok: true });
  } catch (err: any) {
    res.json({ ok: false, error: err?.message || "Falha na autenticação SMTP." });
  }
});

// Meta Conversions API (CAPI) — dispara um evento de teste real contra a
// Graph API usando o Pixel ID e o token informados pelo tenant. Antes disso o
// botão de teste era um setTimeout com Math.random() que "sempre dava certo"
// — corrigido pra ser uma chamada HTTP real, cuja resposta (aceita/rejeitada)
// é repassada ao frontend sem reinterpretação.
app.post("/api/integrations/meta-pixel-test", requireUser, async (req: any, res) => {
  const { pixelId, accessToken, event } = req.body ?? {};
  if (!pixelId || !accessToken) return res.status(400).json({ error: "Pixel ID e Token de Acesso são obrigatórios." });
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v19.0/${encodeURIComponent(pixelId)}/events`,
      {
        data: [{
          event_name: event || "Lead",
          event_time: Math.floor(Date.now() / 1000),
          action_source: "system_generated",
          user_data: { client_user_agent: "S.P.Y. CRM Integration Test" },
        }],
        access_token: accessToken,
      },
      { timeout: 10000, validateStatus: () => true }
    );
    const ok = response.status >= 200 && response.status < 300 && !response.data?.error;
    res.json({ ok, status: response.status, error: response.data?.error?.message });
  } catch (err: any) {
    res.json({ ok: false, status: null, error: err?.message || "Falha ao contatar a Graph API do Meta." });
  }
});

// GA4 Measurement Protocol — usa o endpoint oficial de depuração do Google
// (/debug/mp/collect), que valida o payload sem exigir OAuth. Não confundir
// com a API de conversões do Google Ads propriamente dita (essa exige
// developer token + OAuth via Google Ads API e não está implementada).
app.post("/api/integrations/ga4-test", requireUser, async (req: any, res) => {
  const { measurementId, apiSecret, event } = req.body ?? {};
  if (!measurementId || !apiSecret) return res.status(400).json({ error: "Measurement ID e API Secret são obrigatórios." });
  try {
    const response = await axios.post(
      `https://www.google-analytics.com/debug/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`,
      { client_id: "spy-crm-integration-test", events: [{ name: event || "generate_lead", params: {} }] },
      { timeout: 10000, validateStatus: () => true }
    );
    const messages = response.data?.validationMessages || [];
    const ok = response.status === 200 && messages.length === 0;
    res.json({ ok, status: response.status, validationMessages: messages });
  } catch (err: any) {
    res.json({ ok: false, status: null, error: err?.message || "Falha ao contatar o endpoint de validação do GA4." });
  }
});

// Teste de credenciais de gateway de pagamento — chamada real e de baixo
// impacto (endpoint de "quem sou eu"/conta) contra cada gateway, nunca uma
// cobrança de verdade. Antes disso o botão fazia só um setTimeout que sempre
// resolvia com sucesso e o "Salvar Credenciais" nem persistia o que o usuário
// digitava (inputs eram `defaultValue` sem `onChange`) — os dois foram
// corrigidos (o salvamento no frontend, em ConfigIntegracoesApps.tsx).
app.post("/api/integrations/payment-gateway-test", requireUser, async (req: any, res) => {
  const { provider, environment, secretKey } = req.body ?? {};
  if (!provider || !secretKey) return res.status(400).json({ error: "Provider e chave secreta são obrigatórios." });
  try {
    if (provider === "mercadopago") {
      const { data } = await axios.get("https://api.mercadopago.com/users/me", {
        headers: { Authorization: `Bearer ${secretKey}` }, timeout: 10000,
      });
      return res.json({ ok: true, accountLabel: data?.email || data?.nickname || `Usuário ${data?.id}` });
    }
    if (provider === "stripe") {
      const { data } = await axios.get("https://api.stripe.com/v1/account", {
        headers: { Authorization: `Bearer ${secretKey}` }, timeout: 10000,
      });
      return res.json({ ok: true, accountLabel: data?.settings?.dashboard?.display_name || data?.id });
    }
    if (provider === "asaas") {
      const base = environment === "production" ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3";
      const { data } = await axios.get(`${base}/myAccount`, {
        headers: { access_token: secretKey }, timeout: 10000,
      });
      return res.json({ ok: true, accountLabel: data?.email || data?.name });
    }
    return res.status(400).json({ error: "Gateway não reconhecido." });
  } catch (err: any) {
    const status = err?.response?.status;
    res.json({ ok: false, error: status ? `Gateway recusou as credenciais (HTTP ${status}).` : (err?.message || "Falha ao contatar o gateway.") });
  }
});

app.use("/api/google-calendar", createGoogleCalendarRouter({ requireUser, supabaseService }));

// Global error handler — catches any unhandled throws in async routes. Nunca
// devolve err.message pro cliente (pode conter detalhe de tabela/coluna/constraint
// do Postgres) — detalhe completo só no log do servidor.
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[S.P.Y.] Unhandled error:", err?.message || err);
  if (!res.headersSent) {
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// ── Export for Vercel Serverless ───────────────────────────────────────────

export default app;

