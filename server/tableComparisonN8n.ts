/**
 * Comparação de Tabelas › a IA (Aurora) roda no n8n, não aqui.
 *
 * O workflow "[PLUPPEX AI OS] Comparação de Tabelas - Analisar Itens (IA)" (n8n) é o dono dos
 * prompts, do schema de resposta, da chamada ao modelo (com fallback), do limitador de tokens por
 * empresa e do registro de consumo (ai_usage_log). O S.P.Y. só manda os DADOS e aplica as travas
 * determinísticas (server/tableComparisonAi.ts: decideWithAurora / decideFromExpansion) — nenhuma
 * chave de IA vive neste servidor para esta funcionalidade.
 *
 * Config: TABLE_COMPARISON_AI_WEBHOOK_URL (URL do webhook do workflow; é um segredo — o caminho
 * é imprevisível e não deve ir para o frontend nem para logs).
 */

export type AiCtx = { tenantId: string; mode: "match" | "expand" };
export type AiJson = (prompt: string, ctx: AiCtx) => Promise<string>;
/** Pesquisa externa (web): devolve o texto e as fontes consultadas pela busca. */
export type ResearchCall = (prompt: string, ctx: { tenantId: string }) => Promise<{ text: string; sources: string[] }>;

const TIMEOUT_MS = 120_000;

async function callWorkflow(url: string, payload: Record<string, unknown>): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: ctrl.signal });
    const body: any = await res.json().catch(() => ({}));
    if (res.status === 429 && body?.error === "limite_tokens") throw new Error("limite_tokens: o limite de tokens da empresa foi atingido.");
    if (!res.ok || !body?.ok || typeof body.text !== "string") {
      throw new Error(`${body?.error === "busca_web_indisponivel" ? "busca_web_indisponivel" : "IA (n8n) indisponível"}: HTTP ${res.status}${body?.error ? ` — ${String(body.error).slice(0, 120)}` : ""}`);
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

/** Devolve a função de IA, ou undefined quando o webhook não está configurado (rota responde 503). */
export function makeN8nAiJson(): AiJson | undefined {
  const url = process.env.TABLE_COMPARISON_AI_WEBHOOK_URL;
  if (!url) return undefined;
  return async (prompt, ctx) => (await callWorkflow(url, { tenant_id: ctx.tenantId, mode: ctx.mode, prompt })).text;
}

/** Pesquisa na web (Google Search no n8n). Sem webhook configurado → undefined. */
export function makeN8nResearchCall(): ResearchCall | undefined {
  const url = process.env.TABLE_COMPARISON_AI_WEBHOOK_URL;
  if (!url) return undefined;
  return async (prompt, ctx) => {
    const body = await callWorkflow(url, { tenant_id: ctx.tenantId, mode: "research", prompt });
    return { text: body.text, sources: Array.isArray(body.sources) ? body.sources.map((x: unknown) => String(x)).slice(0, 8) : [] };
  };
}
