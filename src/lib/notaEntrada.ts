/** Regras puras das Notas de Entrada do Varejo (vínculo item↔produto, estados). */

export const NOTA_STATUSES = ["Rascunho", "Pronta para envio", "Enviada", "Validada", "No estoque", "Erro", "Cancelada"] as const;
export type NotaStatus = (typeof NOTA_STATUSES)[number];

export const NOTA_STATUS_TONE: Record<NotaStatus, string> = {
  Rascunho: "bg-slate-500/10 text-slate-500 border-slate-500/30",
  "Pronta para envio": "bg-blue-500/10 text-blue-500 border-blue-500/30",
  Enviada: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  Validada: "bg-violet-500/10 text-violet-500 border-violet-500/30",
  "No estoque": "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
  Erro: "bg-rose-500/10 text-rose-500 border-rose-500/30",
  Cancelada: "bg-slate-500/10 text-slate-400 border-slate-500/20 line-through",
};

/** Status que a pessoa pode marcar à mão (Enviada/Validada valem enquanto o envio por API não é automático). "No estoque" só pela função do banco e "Cancelada" pelo botão próprio. */
export const NOTA_STATUS_MANUAL: NotaStatus[] = ["Rascunho", "Pronta para envio", "Enviada", "Validada", "Erro"];

export const isNotaLocked = (status: string) => status === "No estoque" || status === "Cancelada";

export interface ProductLike {
  id: string;
  name?: string;
  sku?: string;
  active?: boolean;
  typeAttributes?: any;
  type_attributes?: any;
}

export const normText = (s: string) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

const eanOf = (p: ProductLike): string => {
  const ta = p.typeAttributes || p.type_attributes || {};
  return String(ta.ean || ta.barcode || "").trim();
};

export type MatchBy = "ean" | "sku" | "nome";

/**
 * Acha o produto do catálogo pra um item da nota — só quando NÃO há dúvida:
 * mais de um produto com a mesma chave = sem vínculo automático (a pessoa escolhe).
 * Ordem: código de barras (EAN) → SKU igual ao código do fornecedor → nome idêntico.
 */
export function findProductForItem(
  item: { codigo?: string | null; ean?: string | null; descricao: string },
  products: ProductLike[]
): { product: ProductLike; by: MatchBy } | null {
  const active = products.filter((p) => p.active !== false);
  const unique = (list: ProductLike[], by: MatchBy) => (list.length === 1 ? { product: list[0], by } : null);

  const ean = String(item.ean || "").trim();
  if (ean) {
    const hit = unique(active.filter((p) => eanOf(p) === ean), "ean");
    if (hit) return hit;
  }
  const cod = normText(item.codigo || "");
  if (cod) {
    const hit = unique(active.filter((p) => normText(p.sku || "") === cod), "sku");
    if (hit) return hit;
  }
  const nome = normText(item.descricao);
  if (nome) {
    const hit = unique(active.filter((p) => normText(p.name || "") === nome), "nome");
    if (hit) return hit;
  }
  return null;
}

/** Quantidade de entrada padrão = a da nota (só se for inteira; senão a pessoa converte — ex.: caixa → unidades). */
export const defaultQtdEstoque = (quantidade: number): number | null =>
  Number.isInteger(quantidade) && quantidade > 0 ? quantidade : null;

/** Motivos pelos quais a nota ainda não pode dar entrada no estoque (espelha as validações da função do banco). */
export function stockBlockers(itens: { numero_item: number; descricao: string; product_id: string | null; qtd_estoque: number | null }[]): string[] {
  const out: string[] = [];
  if (itens.length === 0) out.push("A nota não tem itens.");
  for (const i of itens) {
    if (!i.product_id) out.push(`Item ${i.numero_item} (${i.descricao}): ligue a um produto.`);
    else if (!i.qtd_estoque || i.qtd_estoque <= 0 || !Number.isInteger(Number(i.qtd_estoque))) out.push(`Item ${i.numero_item} (${i.descricao}): informe a quantidade de entrada (inteira).`);
  }
  return out;
}
