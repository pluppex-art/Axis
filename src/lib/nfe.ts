import { XMLParser } from "fast-xml-parser";

/**
 * Leitor de XML de NF-e (modelo 55) — extrai só o que a entrada de mercadoria
 * precisa. Puro (roda no navegador e no servidor). Não valida assinatura nem
 * consulta a SEFAZ: quem VALIDA a nota é o processo externo (ex.: a API que
 * recebe a nota); aqui é só leitura dos dados.
 */

export interface NFeItem {
  numero_item: number;
  codigo: string;
  ean: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
}

export interface NFeData {
  chave_acesso: string;
  numero: string;
  serie: string;
  data_emissao: string; // YYYY-MM-DD
  natureza_operacao: string;
  fornecedor_nome: string;
  fornecedor_cnpj: string;
  destinatario_cnpj: string;
  valor_produtos: number;
  valor_frete: number;
  valor_desconto: number;
  valor_outras: number;
  valor_total: number;
  itens: NFeItem[];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  // Códigos (CNPJ, chave, NCM, EAN, número da nota) precisam continuar TEXTO:
  // se virarem número, "00123" perde o zero à esquerda e a chave estoura a precisão.
  parseTagValue: false,
  isArray: (name) => name === "det" || name === "dup",
});

const num = (v: any) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return isNaN(n) ? 0 : n;
};
const str = (v: any) => (v === undefined || v === null ? "" : String(v).trim());
// EAN "SEM GTIN" é o preenchimento oficial de item sem código de barras.
const ean = (v: any) => { const s = str(v); return /^\d{8,14}$/.test(s) ? s : ""; };

export function parseNFeXml(xml: string): NFeData {
  let doc: any;
  try {
    doc = parser.parse(xml);
  } catch {
    throw new Error("Arquivo não é um XML válido.");
  }
  // Raiz pode ser <nfeProc> (com protocolo), <NFe> solta ou <procNFe>.
  const nfe = doc?.nfeProc?.NFe ?? doc?.procNFe?.NFe ?? doc?.NFe;
  const inf = nfe?.infNFe;
  if (!inf) throw new Error("Não encontrei uma NF-e (infNFe) neste XML.");

  const ide = inf.ide || {};
  const emit = inf.emit || {};
  const dest = inf.dest || {};
  const tot = inf.total?.ICMSTot || {};
  const chave = str(inf["@_Id"]).replace(/^NFe/i, "") || str(doc?.nfeProc?.protNFe?.infProt?.chNFe);

  const itens: NFeItem[] = (inf.det || []).map((d: any, i: number) => {
    const p = d.prod || {};
    return {
      numero_item: parseInt(str(d["@_nItem"]), 10) || i + 1,
      codigo: str(p.cProd),
      ean: ean(p.cEAN) || ean(p.cEANTrib),
      descricao: str(p.xProd),
      ncm: str(p.NCM),
      cfop: str(p.CFOP),
      unidade: str(p.uCom),
      quantidade: num(p.qCom),
      valor_unitario: num(p.vUnCom),
      valor_total: num(p.vProd),
    };
  });
  if (itens.length === 0) throw new Error("A NF-e não tem itens.");

  const emissao = str(ide.dhEmi || ide.dEmi);
  return {
    chave_acesso: /^\d{44}$/.test(chave) ? chave : "",
    numero: str(ide.nNF),
    serie: str(ide.serie),
    data_emissao: /^\d{4}-\d{2}-\d{2}/.test(emissao) ? emissao.slice(0, 10) : "",
    natureza_operacao: str(ide.natOp),
    fornecedor_nome: str(emit.xNome),
    fornecedor_cnpj: str(emit.CNPJ || emit.CPF),
    destinatario_cnpj: str(dest.CNPJ || dest.CPF),
    valor_produtos: num(tot.vProd),
    valor_frete: num(tot.vFrete),
    valor_desconto: num(tot.vDesc),
    valor_outras: num(tot.vOutro),
    valor_total: num(tot.vNF),
    itens,
  };
}

/** Confere a soma dos itens com o total de produtos da nota — pega XML adulterado/lido pela metade. */
export function nfeTotalsMismatch(n: Pick<NFeData, "itens" | "valor_produtos">): number {
  const soma = n.itens.reduce((s, i) => s + i.valor_total, 0);
  const diff = Math.round((soma - n.valor_produtos) * 100) / 100;
  return Math.abs(diff) > 0.05 ? diff : 0;
}

export const formatCnpj = (v: string) => {
  const d = (v || "").replace(/\D/g, "");
  return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : v;
};
