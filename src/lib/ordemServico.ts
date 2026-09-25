// Ordem de Serviço (Operações): tipos, totais e o documento imprimível.

export const OS_STATUSES = ["Rascunho", "Aberta", "Em execução", "Concluída", "Faturada", "Cancelada"] as const;
export type OsStatus = (typeof OS_STATUSES)[number];

export const OS_PRIORIDADES = ["Baixa", "Normal", "Alta", "Urgente"] as const;

export const OS_STATUS_TONE: Record<OsStatus, string> = {
  Rascunho: "bg-slate-500/10 text-slate-500 border-slate-500/25",
  Aberta: "bg-blue-500/10 text-blue-600 border-blue-500/25",
  "Em execução": "bg-amber-500/10 text-amber-600 border-amber-500/25",
  Concluída: "bg-emerald-500/10 text-emerald-600 border-emerald-500/25",
  Faturada: "bg-purple-500/10 text-purple-600 border-purple-500/25",
  Cancelada: "bg-rose-500/10 text-rose-600 border-rose-500/25",
};

/** Próximos passos permitidos a partir de cada status (o botão principal é o primeiro). */
export const OS_NEXT: Record<OsStatus, OsStatus[]> = {
  Rascunho: ["Aberta", "Cancelada"],
  Aberta: ["Em execução", "Cancelada"],
  "Em execução": ["Concluída", "Cancelada"],
  Concluída: ["Faturada", "Cancelada"],
  Faturada: [],
  Cancelada: ["Rascunho"],
};

export interface OsItem {
  id?: string;
  tipo: "Serviço" | "Material";
  descricao: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
  product_id?: string | null;
}

export const num = (v: any) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return isNaN(n) ? 0 : n;
};

export const itemTotal = (i: Pick<OsItem, "quantidade" | "valor_unitario">) =>
  Math.round(num(i.quantidade) * num(i.valor_unitario) * 100) / 100;

export function osTotals(items: OsItem[], desconto: number) {
  const servicos = items.filter((i) => i.tipo === "Serviço").reduce((s, i) => s + itemTotal(i), 0);
  const materiais = items.filter((i) => i.tipo === "Material").reduce((s, i) => s + itemTotal(i), 0);
  const subtotal = servicos + materiais;
  const total = Math.max(0, Math.round((subtotal - Math.max(0, desconto)) * 100) / 100);
  return { servicos, materiais, subtotal, total };
}

export const osCode = (numero: number) => `OS-${String(numero).padStart(4, "0")}`;

/** Cancelada/Faturada não editam mais o conteúdo (só Cancelada volta pra Rascunho). */
export const isOsLocked = (status: string) => status === "Faturada" || status === "Cancelada";

const esc = (s: any) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

const fmtDate = (d?: string | null) => (d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "—");

/** Documento imprimível (abre numa janela e chama print → "Salvar como PDF"). */
export function buildOsPrintHtml(params: {
  os: any;
  items: OsItem[];
  empresa: any;
  formatCurrency: (v: number) => string;
}): string {
  const { os, items, empresa, formatCurrency } = params;
  const t = osTotals(items, num(os.valor_desconto));
  const rows = items
    .map(
      (i, idx) => `<tr>
        <td>${idx + 1}</td><td>${esc(i.tipo)}</td><td>${esc(i.descricao)}</td><td>${esc(i.unidade || "un")}</td>
        <td class="r">${num(i.quantidade)}</td><td class="r">${formatCurrency(num(i.valor_unitario))}</td><td class="r">${formatCurrency(itemTotal(i))}</td>
      </tr>`
    )
    .join("");
  const nome = empresa?.nomeFantasia || empresa?.razaoSocial || "";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(osCode(os.numero))}</title>
<style>
  *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;padding:28px;font-size:12px}
  .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:14px}
  .head h1{margin:0;font-size:20px} .muted{color:#555} .box{border:1px solid #bbb;border-radius:6px;padding:10px;margin-bottom:12px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 18px} .lbl{font-size:10px;text-transform:uppercase;color:#666;display:block}
  table{width:100%;border-collapse:collapse;margin-bottom:12px} th,td{border:1px solid #bbb;padding:6px 8px;text-align:left}
  th{background:#f0f0f0;font-size:10px;text-transform:uppercase} .r{text-align:right} .tot{width:280px;margin-left:auto}
  .tot div{display:flex;justify-content:space-between;padding:3px 0} .tot .g{font-weight:bold;font-size:14px;border-top:2px solid #111;margin-top:4px;padding-top:6px}
  .sign{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:48px} .sign div{border-top:1px solid #111;padding-top:6px;text-align:center}
  @media print{body{padding:0}}
</style></head><body>
<div class="head">
  <div>${empresa?.logoUrl ? `<img src="${esc(empresa.logoUrl)}" style="max-height:48px;margin-bottom:6px"><br>` : ""}
    <strong>${esc(nome)}</strong><br>
    <span class="muted">${esc(empresa?.cnpj ? "CNPJ " + empresa.cnpj : "")} ${esc(empresa?.endereco || "")}<br>${esc(empresa?.telefoneContato || "")} ${esc(empresa?.emailContato || "")}</span></div>
  <div style="text-align:right"><h1>ORDEM DE SERVIÇO</h1><strong style="font-size:16px">${esc(osCode(os.numero))}</strong><br>
    <span class="muted">Status: ${esc(os.status)} · Prioridade: ${esc(os.prioridade)}</span></div>
</div>
<div class="box"><div class="grid">
  <div><span class="lbl">Cliente</span>${esc(os.cliente_nome || "—")}</div>
  <div><span class="lbl">CPF/CNPJ</span>${esc(os.cliente_documento || "—")}</div>
  <div><span class="lbl">Telefone</span>${esc(os.cliente_telefone || "—")}</div>
  <div><span class="lbl">E-mail</span>${esc(os.cliente_email || "—")}</div>
  <div style="grid-column:1/3"><span class="lbl">Endereço</span>${esc(os.cliente_endereco || "—")}</div>
</div></div>
<div class="box"><div class="grid">
  <div style="grid-column:1/3"><span class="lbl">Serviço</span><strong>${esc(os.titulo || "—")}</strong></div>
  <div><span class="lbl">Abertura</span>${fmtDate(os.data_abertura)}</div>
  <div><span class="lbl">Previsão</span>${fmtDate(os.data_prevista)}</div>
  <div><span class="lbl">Responsável</span>${esc(os.responsavel || "—")}</div>
  <div><span class="lbl">Local de execução</span>${esc(os.local_execucao || "—")}</div>
  ${os.descricao ? `<div style="grid-column:1/3"><span class="lbl">Descrição</span>${esc(os.descricao).replace(/\n/g, "<br>")}</div>` : ""}
</div></div>
<table><thead><tr><th>#</th><th>Tipo</th><th>Descrição</th><th>Un.</th><th class="r">Qtd</th><th class="r">Valor unit.</th><th class="r">Total</th></tr></thead>
<tbody>${rows || `<tr><td colspan="7" class="muted">Nenhum item.</td></tr>`}</tbody></table>
<div class="tot">
  <div><span>Serviços</span><span>${formatCurrency(t.servicos)}</span></div>
  <div><span>Materiais</span><span>${formatCurrency(t.materiais)}</span></div>
  ${num(os.valor_desconto) > 0 ? `<div><span>Desconto</span><span>- ${formatCurrency(num(os.valor_desconto))}</span></div>` : ""}
  <div class="g"><span>Total</span><span>${formatCurrency(t.total)}</span></div>
</div>
<div class="box"><div class="grid">
  <div><span class="lbl">Forma de pagamento</span>${esc(os.forma_pagamento || "—")}</div>
  <div><span class="lbl">Condições</span>${esc(os.condicoes_pagamento || "—")}</div>
  <div style="grid-column:1/3"><span class="lbl">Garantia</span>${esc(os.garantia || "—")}</div>
  ${os.observacoes ? `<div style="grid-column:1/3"><span class="lbl">Observações</span>${esc(os.observacoes).replace(/\n/g, "<br>")}</div>` : ""}
</div></div>
<div class="sign"><div>${esc(nome || "Prestador")}</div><div>${esc(os.cliente_nome || "Cliente")}</div></div>
<script>window.onload=function(){setTimeout(function(){window.print()},250)}</script>
</body></html>`;
}
