/**
 * Clínica & Saúde › Comparação de Tabelas — camada de serviço (API-first).
 *
 * A lógica vive aqui e em src/lib/tableMatch.ts, NÃO na tela: a mesma rota pode ser consumida por
 * um sistema externo. Tudo passa pelo cliente Supabase do usuário (`req.supabase`) → a RLS por
 * tenant vale em cada leitura/escrita; `tenant_id` também é explícito em cada linha gravada.
 *
 *   POST /api/health/table-comparison                              cria e processa uma comparação
 *   POST /api/health/table-comparison/:id/items/:itemId/decision   confirma/rejeita/troca (revisão humana)
 *
 * Nada aqui expõe chaves de IA ou prompts. A Aurora (casos ambíguos) entra numa fase seguinte,
 * sempre DEPOIS das regras determinísticas.
 */
import type { Express, RequestHandler } from "express";
import {
  DEFAULT_FINANCE_RULES, DEFAULT_MATCH_CONFIG, MATCH_ENGINE_VERSION,
  buildBaseIndex, computeFinance, matchItem, normalizeName,
  type BaseItem, type Equivalence, type FinanceRules, type MatchConfig,
} from "../src/lib/tableMatch.js";

export const MAX_COMPARISON_ROWS = 8000;
const INSERT_BATCH = 500;
const PAGE = 1000;

interface Deps {
  requireUser: RequestHandler;
  resolveRequestedTenantId: (req: any, res: any) => Promise<string | null>;
  limiter: RequestHandler;
}

const clean = (v: unknown, max: number): string => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
const toNum = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && Math.abs(n) < 1e12 ? n : null;
};
const clampInt = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

async function fetchAll(sb: any, table: string, columns: string, filter: (q: any) => any): Promise<any[]> {
  const all: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await filter(sb.from(table).select(columns)).range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  return all;
}

export function registerTableComparisonRoutes(app: Express, { requireUser, resolveRequestedTenantId, limiter }: Deps) {
  app.use("/api/health/table-comparison", limiter);

  app.post("/api/health/table-comparison", requireUser, async (req: any, res) => {
    let comparisonId: string | null = null;
    const sb = req.supabase;
    try {
      const tenantId = await resolveRequestedTenantId(req, res);
      if (!tenantId) return;

      // ── Validação de entrada ──
      const parceiro = clean(req.body?.parceiro, 120);
      if (!parceiro) return res.status(400).json({ error: "Informe o parceiro/origem da tabela." });
      const rawRows = req.body?.rows;
      if (!Array.isArray(rawRows) || rawRows.length === 0) return res.status(400).json({ error: "A tabela não tem linhas." });
      if (rawRows.length > MAX_COMPARISON_ROWS) {
        return res.status(413).json({ error: `Tabela grande demais (${rawRows.length} linhas). O limite por comparação é ${MAX_COMPARISON_ROWS}.` });
      }
      const rows = rawRows
        .map((r: any, i: number) => ({
          linha: clampInt(r?.linha, 1, 10_000_000, i + 1),
          nome: clean(r?.nome, 300),
          codigo: clean(r?.codigo, 80) || null,
          quantidade: toNum(r?.quantidade),
          valor: toNum(r?.valor),
          custo: toNum(r?.custo),
          extras: typeof r?.extras === "object" && r.extras && !Array.isArray(r.extras)
            ? Object.fromEntries(Object.entries(r.extras).slice(0, 20).map(([k, v]) => [clean(k, 60), clean(v, 200)]))
            : {},
        }))
        .filter((r) => r.nome || r.codigo);
      if (rows.length === 0) return res.status(400).json({ error: "Nenhuma linha com nome ou código de exame." });

      const cfgIn = req.body?.config || {};
      const matchCfg: MatchConfig = {
        autoThreshold: clampInt(cfgIn.autoThreshold, 80, 100, DEFAULT_MATCH_CONFIG.autoThreshold),
        reviewThreshold: clampInt(cfgIn.reviewThreshold, 50, 99, DEFAULT_MATCH_CONFIG.reviewThreshold),
        autoMargin: clampInt(cfgIn.autoMargin, 0, 50, DEFAULT_MATCH_CONFIG.autoMargin),
      };
      const rulesIn = req.body?.rules || {};
      const rules: FinanceRules = {
        baseValueField: rulesIn.baseValueField === "custo" ? "custo" : DEFAULT_FINANCE_RULES.baseValueField,
        marginOn: rulesIn.marginOn === "base" ? "base" : DEFAULT_FINANCE_RULES.marginOn,
      };

      // ── Base do tenant + memória ──
      const baseRows = await fetchAll(sb, "saude_exames_base",
        "id,nome,codigo_interno,codigo_externo,nomes_alternativos,custo,valor",
        (q) => q.eq("tenant_id", tenantId).eq("ativo", true));
      if (baseRows.length === 0) {
        return res.status(400).json({ error: "A base de exames está vazia. Cadastre ou importe a base antes de comparar." });
      }
      const memRows = await fetchAll(sb, "saude_equivalencias",
        "exame_base_id,nome_parceiro_norm,codigo_parceiro,parceiro",
        (q) => q.eq("tenant_id", tenantId).eq("status", "ativa").in("parceiro", ["", parceiro]));

      // ── Cria a comparação e acompanha o status ──
      const { data: comp, error: compErr } = await sb.from("saude_comparacoes").insert({
        tenant_id: tenantId, parceiro, arquivo_nome: clean(req.body?.arquivo_nome, 200) || null,
        status: "validando", total: rows.length, config: { match: matchCfg, rules }, versao_motor: MATCH_ENGINE_VERSION,
        created_by: req.user?.id ?? null,
      }).select("id").single();
      if (compErr || !comp) throw compErr || new Error("Falha ao criar a comparação.");
      comparisonId = comp.id as string;
      const setStatus = (status: string) => sb.from("saude_comparacoes").update({ status }).eq("id", comparisonId).eq("tenant_id", tenantId);

      await setStatus("normalizando");
      const baseById = new Map<string, BaseItem>(baseRows.map((b: any) => [b.id, { ...b, custo: toNum(b.custo), valor: toNum(b.valor) }]));
      const index = buildBaseIndex([...baseById.values()], memRows as Equivalence[], matchCfg);

      await setStatus("processando");
      const itens = rows.map((r) => {
        const m = matchItem({ nome: r.nome, codigo: r.codigo }, index);
        const base = m.exame_base_id ? baseById.get(m.exame_base_id) ?? null : null;
        // Financeiro só faz sentido quando existe uma correspondência sugerida/aceita.
        const fin = computeFinance(r.valor, m.status === "nao_identificado" ? null : base, rules);
        return {
          tenant_id: tenantId, comparacao_id: comparisonId, linha: r.linha,
          nome_parceiro: r.nome, codigo_parceiro: r.codigo, quantidade: r.quantidade,
          valor_parceiro: r.valor, custo_parceiro: r.custo, extras: r.extras,
          exame_base_id: m.status === "nao_identificado" ? null : m.exame_base_id,
          score: m.score, status: m.status, origem_decisao: m.origin,
          motivo: m.reason.slice(0, 500), evidencias: m.evidence.slice(0, 6),
          candidatos: m.candidates.map((c) => ({ exame_base_id: c.exame_base_id, score: c.score, reason: c.reason })),
          custo_base: fin.custo_base, valor_base: fin.valor_base, diferenca: fin.diferenca,
          diferenca_pct: fin.diferenca_pct, margem: fin.margem,
        };
      });
      for (let i = 0; i < itens.length; i += INSERT_BATCH) {
        const { error } = await sb.from("saude_comparacao_itens").insert(itens.slice(i, i + INSERT_BATCH));
        if (error) throw error;
      }
      const { error: recalcErr } = await sb.rpc("saude_comparacao_recalcular", { p_comparacao_id: comparisonId });
      if (recalcErr) throw recalcErr;

      const { data: summary } = await sb.from("saude_comparacoes").select("*").eq("id", comparisonId).eq("tenant_id", tenantId).single();
      return res.status(201).json({ id: comparisonId, summary });
    } catch (e: any) {
      console.error("[table-comparison] falha:", e?.message || e);
      if (comparisonId) {
        await sb.from("saude_comparacoes").update({ status: "erro", erro_mensagem: String(e?.message || "erro").slice(0, 300) }).eq("id", comparisonId);
      }
      return res.status(500).json({ error: "Não foi possível processar a comparação.", id: comparisonId });
    }
  });

  app.post("/api/health/table-comparison/:id/items/:itemId/decision", requireUser, async (req: any, res) => {
    const sb = req.supabase;
    try {
      const tenantId = await resolveRequestedTenantId(req, res);
      if (!tenantId) return;
      const action = String(req.body?.action || "");
      if (!["confirm", "reject", "select"].includes(action)) return res.status(400).json({ error: "Ação inválida." });

      const { data: item, error: itemErr } = await sb.from("saude_comparacao_itens").select("*")
        .eq("id", req.params.itemId).eq("comparacao_id", req.params.id).eq("tenant_id", tenantId).maybeSingle();
      if (itemErr) throw itemErr;
      if (!item) return res.status(404).json({ error: "Item não encontrado." });
      const { data: comp } = await sb.from("saude_comparacoes").select("id,parceiro,config").eq("id", req.params.id).eq("tenant_id", tenantId).maybeSingle();
      if (!comp) return res.status(404).json({ error: "Comparação não encontrada." });

      let baseId: string | null = null;
      if (action === "confirm") baseId = item.exame_base_id;
      if (action === "select") baseId = clean(req.body?.exame_base_id, 64) || null;
      if ((action === "confirm" || action === "select") && !baseId) {
        return res.status(400).json({ error: "Nenhum exame da base para confirmar." });
      }

      let base: any = null;
      if (baseId) {
        const { data } = await sb.from("saude_exames_base").select("id,nome,custo,valor").eq("id", baseId).eq("tenant_id", tenantId).maybeSingle();
        if (!data) return res.status(404).json({ error: "Exame da base não encontrado." });
        base = data;
      }

      const rulesCfg = comp.config?.rules || DEFAULT_FINANCE_RULES;
      const fin = base
        ? computeFinance(toNum(item.valor_parceiro), { custo: toNum(base.custo), valor: toNum(base.valor) }, rulesCfg)
        : { custo_base: null, valor_base: null, diferenca: null, diferenca_pct: null, margem: null };

      const { error: upErr } = await sb.from("saude_comparacao_itens").update({
        status: action === "reject" ? "rejeitado" : "confirmado",
        exame_base_id: action === "reject" ? null : baseId,
        origem_decisao: "manual",
        motivo: action === "reject" ? "Rejeitado por revisão humana." : (action === "select" ? "Exame escolhido manualmente." : item.motivo),
        ...fin,
        revisado_por: req.user?.id ?? null,
        revisado_em: new Date().toISOString(),
      }).eq("id", item.id).eq("tenant_id", tenantId);
      if (upErr) throw upErr;

      // Memória do tenant: confirmação/troca vira conhecimento para as próximas comparações.
      if (baseId && item.nome_parceiro) {
        const norm = normalizeName(item.nome_parceiro);
        if (norm) {
          const entry = { at: new Date().toISOString(), by: req.user?.id ?? null, acao: action, exame_base_id: baseId };
          const { data: existing } = await sb.from("saude_equivalencias").select("id,historico")
            .eq("tenant_id", tenantId).eq("parceiro", comp.parceiro).eq("nome_parceiro_norm", norm).maybeSingle();
          const historico = [...(Array.isArray(existing?.historico) ? existing.historico : []), entry].slice(-50);
          const { error: memErr } = await sb.from("saude_equivalencias").upsert({
            ...(existing ? { id: existing.id } : {}),
            tenant_id: tenantId, parceiro: comp.parceiro, exame_base_id: baseId,
            nome_parceiro: item.nome_parceiro, nome_parceiro_norm: norm, codigo_parceiro: item.codigo_parceiro,
            origem: "manual", confianca: item.score, observacao: clean(req.body?.observacao, 300) || null,
            status: "ativa", confirmado_por: req.user?.id ?? null, confirmado_em: new Date().toISOString(), historico,
          }, { onConflict: "tenant_id,parceiro,nome_parceiro_norm" });
          if (memErr) console.error("[table-comparison] memória não gravada:", memErr.message);
        }
      }

      const { error: recalcErr } = await sb.rpc("saude_comparacao_recalcular", { p_comparacao_id: comp.id });
      if (recalcErr) throw recalcErr;
      const { data: summary } = await sb.from("saude_comparacoes").select("*").eq("id", comp.id).eq("tenant_id", tenantId).single();
      return res.json({ ok: true, summary });
    } catch (e: any) {
      console.error("[table-comparison] decisão falhou:", e?.message || e);
      return res.status(500).json({ error: "Não foi possível registrar a decisão." });
    }
  });
}
