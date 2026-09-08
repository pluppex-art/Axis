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
const apiKeyTenantMap = new Map(
  (process.env.SPY_API_KEYS || process.env.AXIS_API_KEYS || "")
    .split(",")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const [key, tenantId] = pair.split(":").map((s) => s.trim());
      return [key, tenantId] as [string, string];
    })
    .filter(([key, tenantId]) => key && tenantId)
);

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
const apiKeyLimiter = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false });
const aiLimiter = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false });
const whatsappLimiter = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false });
const googleCalendarLimiter = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false });
// Mais restritivo que os demais — endpoint sem autenticação nenhuma (formulário
// público do site de marketing), maior risco de abuso/spam automatizado.
const publicLeadLimiter = rateLimit({ windowMs: 60_000, limit: 5, standardHeaders: true, legacyHeaders: false });
app.use("/api/v1/leads", apiKeyLimiter);
app.use("/api/leads", aiLimiter);
app.use("/api/ai", aiLimiter);
app.use("/api/whatsapp", whatsappLimiter);
app.use("/api/google-calendar", googleCalendarLimiter);
app.use("/api/public/lead-capture", publicLeadLimiter);

function requireApiKey(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (apiKeyTenantMap.size === 0) {
    return res.status(503).json({ error: "Nenhuma API Key configurada. Defina SPY_API_KEYS no formato chave:tenantId no .env." });
  }
  const key = req.headers["x-api-key"] as string | undefined;
  const tenantId = key ? apiKeyTenantMap.get(key) : undefined;
  if (!key || !tenantId) {
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

// ── API PÚBLICA ────────────────────────────────────────────────────────────

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

  if (!name) return res.status(400).json({ error: "O campo 'name' é obrigatório." });
  if (!email && !phone) return res.status(400).json({ error: "Informe ao menos 'email' ou 'phone'." });

  const id = randomUUID();
  const now = new Date().toISOString().split("T")[0];
  const rawValue = typeof value === "string"
    ? parseFloat(value.replace(/[^\d.,]/g, "").replace(",", ".")) || 0
    : (value ?? 0);

  // tenant_id vem só da API key (nunca do corpo da requisição) — ver requireApiKey.
  // "createdAt" NÃO existe na tabela (só "created_at", que já tem default
  // now()) — o insert falhava sempre com 42703 antes desta correção.
  const newLead = {
    id, name, company, email, phone, cnpj, title, seller, source,
    status, priority, value: rawValue, stageId, pipelineId,
    lead_interesse_cliente, customFields, clientId, clientName,
    productIds, tenant_id: (req as any).tenantId, tenantName, scoreIA: 50, date: now,
  };

  if (!supabaseService) return res.status(503).json({ error: "SUPABASE_SERVICE_ROLE_KEY não configurada no servidor." });

  const { data, error } = await supabaseService.from("leads").insert(newLead).select().maybeSingle();
  if (error) {
    console.error("[API v1] Erro ao criar lead:", error.message);
    return res.status(500).json({ error: "Falha ao salvar lead no banco." });
  }
  return res.status(201).json({ success: true, lead: data ?? newLead });
});

app.get("/api/v1/leads", requireApiKey, async (req, res) => {
  if (!supabaseService) return res.status(503).json({ error: "SUPABASE_SERVICE_ROLE_KEY não configurada no servidor." });

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
    return res.status(500).json({ error: "Falha ao buscar leads." });
  }
  return res.json({ success: true, count: data?.length ?? 0, leads: data ?? [] });
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

  // Este endpoint atende dois chamadores bem diferentes com a mesma Aurora (n8n AURORA CORE):
  //   1) o widget pessoal do Gustavo/G-TECH (AuroraWidget.tsx) — não manda sessionId, cai no
  //      buffer de memória fixo e compartilhado com o jarvis-os. A UI já esconde esse widget de
  //      quem não é master (Layout.tsx: `user?.isMaster && ...`), mas isso é só a UI — sem essa
  //      checagem aqui, qualquer usuário autenticado de QUALQUER tenant podia chamar a API direto
  //      (fora do widget) e injetar mensagens/ouvir respostas na sessão pessoal do Gustavo.
  //   2) o copilot de reunião (ReuniaoRoom.tsx / useAuroraMeetingPresence.ts) — manda um
  //      sessionId próprio por reunião (`aurora-reuniao-<reuniaoId>`), disponível a qualquer
  //      closer autenticado. Antes de usar esse reuniaoId pra montar a chave de memória, valida
  //      que a reunião existe pro tenant do chamador — via req.supabase (client escopado ao JWT,
  //      sujeito à RLS da Fase 1), então um reuniaoId de outro tenant simplesmente não aparece.
  let sessionId: string;
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
      .from("users").select("is_master").eq("id", req.user.id).maybeSingle();
    if (callerError || !caller?.is_master) {
      return res.status(403).json({ error: "Apenas administradores master podem usar a Aurora pessoal." });
    }
    sessionId = clientSessionId || "aurora-gustavo-principal";
  }

  try {
    const { data } = await axios.post(
      webhookUrl,
      { action: "sendMessage", sessionId, chatInput: message },
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

  const systemInstruction = "Você é a Aurora, assistente operacional do S.P.Y. CRM. Responda SOMENTE com base no resultado real das ferramentas disponíveis — nunca invente números, nomes ou datas. Se a pergunta não puder ser respondida com as ferramentas disponíveis, diga isso claramente em vez de adivinhar. Responda em português do Brasil, de forma direta e objetiva.";

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

  const { tenantName, niche, adminEmail, adminPassword } = req.body ?? {};
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
        plan: "Standard",
        status: "Active",
        timezone: "America/Sao_Paulo",
        modules: { crm: true, sdr: false, advDashboard: false, financeiro: true, marketing: false, educacao: false, clinica: false, produtividade: true, rh: false, bi: false, engajamento: false },
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

