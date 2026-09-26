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

const TIMEOUT_MS = 120_000;

/** Devolve a função de IA, ou undefined quando o webhook não está configurado (rota responde 503). */
export function makeN8nAiJson(): AiJson | undefined {
  const url = process.env.TABLE_COMPARISON_AI_WEBHOOK_URL;
  if (!url) return undefined;

  return async (prompt, ctx) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: ctx.tenantId, mode: ctx.mode, prompt }),
        signal: ctrl.signal,
      });
      const body: any = await res.json().catch(() => ({}));
      if (res.status === 429 && body?.error === "limite_tokens") throw new Error("limite_tokens: o limite de tokens da empresa foi atingido.");
      if (!res.ok || !body?.ok || typeof body.text !== "string") {
        throw new Error(`IA (n8n) indisponível: HTTP ${res.status}${body?.error ? ` — ${String(body.error).slice(0, 120)}` : ""}`);
      }
      return body.text;
    } finally {
      clearTimeout(timer);
    }
  };
}
