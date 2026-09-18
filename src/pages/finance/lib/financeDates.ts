/**
 * `finance_entries.date` nem sempre vem no formato legado DD/MM/AAAA — o
 * fluxo de vendas do PDV (finalizar_venda RPC) grava em ISO (AAAA-MM-DD).
 * Sem aceitar os dois formatos aqui, um lançamento com data ISO some de
 * qualquer tela que filtre/soma por data. Usado por todas as telas do
 * módulo financeiro que precisam ler `date` como Date.
 */
export function parseEntryDate(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (iso) {
    const d = new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  const parts = dateStr.split("/");
  if (parts.length < 3) return null;
  const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  return isNaN(d.getTime()) ? null : d;
}

export function daysBetween(a: Date, b: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / msPerDay);
}
