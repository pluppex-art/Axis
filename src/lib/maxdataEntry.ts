/**
 * Mapeamento "Entrada Nota Fiscal" da MaxAPI → nota de entrada do SPY.
 * Puro (sem rede). Formatos conforme a coleção MaxAPI Go v2.0 (GET /entry e
 * GET /entry/{nf_id}/items).
 */
export interface MaxEntry {
  id: number;
  numeroNf?: number | string;
  emissao?: string;
  lancamento?: string;
  fornecedorId?: number;
  fornecedorNome?: string;
  totalnf?: number;
  valorTotalLiquidoProduto?: number;
  frete?: number;
  outrasDespesas?: number;
  seguro?: number;
  status?: string;
  tipoDocumento?: string;
  conferidorNome?: string;
  data_conferencia?: string;
}

export interface MaxEntryItem {
  codBarras?: string;
  codProduto?: number | string;
  descricao?: string;
  un?: string;
  qtde?: number;
  valor?: number;
  valorTotal?: number;
  lote?: string;
}

/** A doc não diz o formato das datas — aceita ISO, DD/MM/AAAA e DD-MM-AAAA. */
export function parseFlexibleDate(v?: string | null): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{2})[\/-](\d{2})[\/-](\d{4})/.exec(s);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

const money = (n: any) => { const x = Number(n); return Number.isFinite(x) ? Math.round(x * 100) / 100 : 0; };

export function mapMaxEntryToNota(entry: MaxEntry, items: MaxEntryItem[]) {
  const itens: any[] = [];
  let ignorados = 0;
  items.forEach((it) => {
    const qtde = Number(it.qtde);
    if (!(qtde > 0)) { ignorados++; return; }
    const valor = money(it.valor);
    const ean = String(it.codBarras ?? "").trim();
    itens.push({
      numero_item: itens.length + 1,
      codigo: it.codProduto !== undefined && it.codProduto !== null ? String(it.codProduto) : null,
      ean: /^\d{8,14}$/.test(ean) ? ean : null,
      descricao: String(it.descricao || "Item sem descrição").trim(),
      unidade: it.un || null,
      quantidade: qtde,
      valor_unitario: valor,
      valor_total: money(it.valorTotal) || money(qtde * valor),
    });
  });
  const nota = {
    origem: "maxdata" as const,
    externo_sistema: "maxdata",
    externo_id: String(entry.id),
    numero: entry.numeroNf !== undefined && entry.numeroNf !== null ? String(entry.numeroNf) : null,
    data_emissao: parseFlexibleDate(entry.emissao),
    fornecedor_nome: entry.fornecedorNome || null,
    natureza_operacao: entry.tipoDocumento || null,
    valor_produtos: money(entry.valorTotalLiquidoProduto) || money(itens.reduce((s, i) => s + i.valor_total, 0)),
    valor_frete: money(entry.frete),
    valor_desconto: 0,
    valor_outras: money((entry.outrasDespesas || 0) + (entry.seguro || 0)),
    valor_total: money(entry.totalnf),
    observacoes: `Importada do Max Data (entrada nº ${entry.id}${entry.status ? `, status: ${entry.status}` : ""}).`,
  };
  return { nota, itens, ignorados };
}

/** A doc mostra respostas ora como lista simples, ora paginadas ({docs}), ora lista com um objeto paginado — normaliza tudo pra lista de itens. */
export function extractDocs<T = any>(body: any): { docs: T[]; pages: number } {
  if (Array.isArray(body)) {
    const docs: T[] = [];
    let pages = 1;
    for (const x of body) {
      if (x && Array.isArray(x.docs)) { docs.push(...x.docs); pages = Math.max(pages, Number(x.pages) || 1); }
      else docs.push(x);
    }
    return { docs, pages };
  }
  if (body && Array.isArray(body.docs)) return { docs: body.docs, pages: Number(body.pages) || 1 };
  return { docs: [], pages: 1 };
}
