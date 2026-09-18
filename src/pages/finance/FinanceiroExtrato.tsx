import { useMemo, useState } from "react";
import { PageContainer } from "../../components/PageContainer";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Download, Printer, CheckCircle2, Clock } from "lucide-react";
import { useData } from "../../contexts/DataContext";
import { useLocalization } from "../../contexts/LocalizationContext";
import { downloadCsv } from "../../lib/csvExport";
import { parseEntryDate } from "./lib/financeDates";
import { saldoDaConta, transferenciasDaConta, type FinanceEntryLike } from "./lib/financeEngine";
import { cn } from "../../lib/utils";

/**
 * Extrato (saldo corrido) — §6.5. "Saldo Anterior" é sempre regime de
 * caixa puro (só pago), não muda com o toggle "incluir pendentes" — é o
 * saldo real da conta no início do período. Já o saldo corrido DA TABELA
 * respeita o toggle: com "só pagos" ligado, o Saldo Final tem que bater
 * com o saldo real da conta (validação obrigatória da especificação).
 */
export default function FinanceiroExtrato() {
  const { financeEntries, financeBankAccounts, financeTransfers } = useData();
  const { formatCurrency } = useLocalization();

  const contas = (financeBankAccounts as any[]).filter(c => !c.arquivada);
  const [contaId, setContaId] = useState(() => contas.find(c => c.is_principal)?.id || contas[0]?.id || "");
  const [dataInicial, setDataInicial] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); });
  const [dataFinal, setDataFinal] = useState(() => new Date().toISOString().slice(0, 10));
  const [somentePagos, setSomentePagos] = useState(true);

  const conta = contas.find(c => c.id === contaId);

  const { saldoAnterior, linhas, totalEntradas, totalSaidas, saldoFinal } = useMemo(() => {
    if (!conta) return { saldoAnterior: 0, linhas: [] as any[], totalEntradas: 0, totalSaidas: 0, saldoFinal: 0 };

    const inicio = new Date(dataInicial + "T00:00:00");
    const fim = new Date(dataFinal + "T23:59:59");

    const entriesDaConta = (financeEntries as (FinanceEntryLike & any)[]).filter(e => e.conta_bancaria_id === conta.id);
    const { recebidas, enviadas } = transferenciasDaConta(financeTransfers as any[], conta.id);

    // Saldo anterior = saldo real (caixa) até o dia anterior ao início do período.
    const entriesAntesDoPeriodo = entriesDaConta.filter(e => {
      const d = parseEntryDate(e.date);
      return d && d < inicio && e.status === "Pago";
    });
    const transfersAntes = (financeTransfers as any[]).filter(t => new Date(t.data_pagamento + "T12:00:00") < inicio);
    const { recebidas: recebidasAntes, enviadas: enviadasAntes } = transferenciasDaConta(transfersAntes, conta.id);
    const saldoAnterior = saldoDaConta({
      saldoInicial: conta.saldo_inicial, sinalSaldoInicial: conta.sinal_saldo_inicial,
      entriesDaConta: entriesAntesDoPeriodo, transferenciasRecebidasPagas: recebidasAntes, transferenciasEnviadasPagas: enviadasAntes,
    });

    const doPeriodo = entriesDaConta
      .filter(e => { const d = parseEntryDate(e.date); return d && d >= inicio && d <= fim && (!somentePagos || e.status === "Pago"); })
      .map(e => ({ ...e, __kind: "entry" as const, __data: parseEntryDate(e.date)! }));

    const transfersDoPeriodo = (financeTransfers as any[])
      .filter(t => (t.conta_origem_id === conta.id || t.conta_destino_id === conta.id) && (!somentePagos || t.pago))
      .map(t => ({ ...t, __kind: "transfer" as const, __data: new Date(t.data_pagamento + "T12:00:00") }))
      .filter(t => t.__data >= inicio && t.__data <= fim);

    const todasLinhas = [...doPeriodo, ...transfersDoPeriodo].sort((a, b) => a.__data.getTime() - b.__data.getTime());

    let corrido = saldoAnterior;
    let totalEntradas = 0, totalSaidas = 0;
    const linhas = todasLinhas.map(item => {
      let valorComSinal = 0;
      let descricao = "";
      let categoria = "";
      let pago = false;
      if (item.__kind === "entry") {
        valorComSinal = item.type === "Receber" ? item.value : -item.value;
        descricao = item.description;
        categoria = item.category;
        pago = item.status === "Pago";
      } else {
        const entrando = item.conta_destino_id === conta.id;
        valorComSinal = entrando ? item.valor : -item.valor;
        descricao = `Transferência ${entrando ? "recebida" : "enviada"}${item.descricao ? " — " + item.descricao : ""}`;
        categoria = "Transferência";
        pago = item.pago;
      }
      if (valorComSinal > 0) totalEntradas += valorComSinal; else totalSaidas += Math.abs(valorComSinal);
      corrido += valorComSinal;
      return {
        id: item.id, data: item.__data, descricao, categoria, valor: valorComSinal, pago,
        parcela: item.__kind === "entry" && item.installment_total > 1 ? `${item.installment_number}/${item.installment_total}` : null,
        saldoCorrido: corrido,
        isTransfer: item.__kind === "transfer",
      };
    });

    return { saldoAnterior, linhas, totalEntradas, totalSaidas, saldoFinal: corrido };
  }, [conta, financeEntries, financeTransfers, dataInicial, dataFinal, somentePagos]);

  const handleExport = () => {
    downloadCsv(`extrato_${contaId}_${Date.now()}.csv`, ["Data", "Descrição", "Categoria", "Valor", "Saldo Acumulado"], linhas.map(l => [l.data.toLocaleDateString("pt-BR"), l.descricao, l.categoria, l.valor, l.saldoCorrido]));
  };

  return (
    <PageContainer
      title="Extrato"
      description="Saldo corrido da conta — filtre por 'somente pagos' pra ver o extrato real, igual ao saldo bancário."
      breadcrumb={[{ label: "Financeiro", path: "/app/financeiro/dashboard" }, { label: "Relatórios", path: "/app/financeiro/relatorios" }, { label: "Extrato" }]}
      actions={
        <div className="flex items-center gap-2 print:hidden">
          <Button variant="outline" onClick={() => window.print()} className="h-9 px-3 text-xs font-medium"><Printer className="w-3.5 h-3.5" /></Button>
          <Button onClick={handleExport} className="h-9 px-4 text-xs font-medium gap-1.5"><Download className="w-3.5 h-3.5" /> Exportar CSV</Button>
        </div>
      }
    >
      <div className="space-y-4 max-w-[1700px] mx-auto pb-12">
        <div className="flex flex-wrap items-end gap-3 print:hidden">
          <div>
            <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase mb-1 block">Conta</label>
            <select value={contaId} onChange={(e) => setContaId(e.target.value)} className="bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] px-3 py-2 text-xs cursor-pointer">
              {contas.length === 0 && <option value="">Nenhuma conta cadastrada</option>}
              {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase mb-1 block">De</label>
            <input type="date" value={dataInicial} onChange={(e) => setDataInicial(e.target.value)} className="bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] px-3 py-2 text-xs" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase mb-1 block">Até</label>
            <input type="date" value={dataFinal} onChange={(e) => setDataFinal(e.target.value)} className="bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] px-3 py-2 text-xs" />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] cursor-pointer pb-2">
            <input type="checkbox" checked={somentePagos} onChange={(e) => setSomentePagos(e.target.checked)} /> Somente pagos (saldo real)
          </label>
        </div>

        {!conta ? (
          <Card className="p-12 text-center text-sm text-[var(--color-text-muted)]">Cadastre uma conta bancária para ver o extrato.</Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="p-4 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--color-text-primary)]">{conta.nome} — {new Date(dataInicial + "T12:00:00").toLocaleDateString("pt-BR")} a {new Date(dataFinal + "T12:00:00").toLocaleDateString("pt-BR")}</span>
              <span className="text-xs text-[var(--color-text-muted)]">Saldo Anterior: <span className="font-semibold text-[var(--color-text-primary)]">{formatCurrency(saldoAnterior)}</span></span>
            </div>
            <table className="w-full text-xs text-left">
              <thead className="text-[10px] uppercase font-semibold tracking-wide text-[var(--color-text-muted)] bg-[var(--color-surface-sunken)] border-b border-[var(--color-border-subtle)]">
                <tr>
                  <th className="px-4 py-3 w-8"></th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Descrição</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3 text-right">Saldo Acumulado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-subtle)]">
                {linhas.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-[var(--color-text-faint)]">Nenhuma movimentação no período.</td></tr>
                ) : linhas.map(l => (
                  <tr key={l.id} className="hover:bg-[var(--color-surface-sunken)]/50">
                    <td className="px-4 py-2.5">{l.pago ? <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-success)]" /> : <Clock className="w-3.5 h-3.5 text-[var(--color-danger)]" />}</td>
                    <td className="px-4 py-2.5 font-mono text-[var(--color-text-muted)]">{l.data.toLocaleDateString("pt-BR")}</td>
                    <td className="px-4 py-2.5 text-[var(--color-text-primary)] font-medium">{l.descricao}{l.parcela && <span className="ml-1 text-[10px] text-[var(--color-text-faint)]">({l.parcela})</span>}</td>
                    <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{l.categoria}</td>
                    <td className={cn("px-4 py-2.5 text-right tabular-nums font-medium", l.valor < 0 ? "text-[var(--color-danger)]" : "text-[var(--color-success)]")}>{formatCurrency(l.valor)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-[var(--color-text-primary)]">{formatCurrency(l.saldoCorrido)}</td>
                  </tr>
                ))}
              </tbody>
              {linhas.length > 0 && (
                <tfoot className="bg-[var(--color-surface-sunken)] border-t border-[var(--color-border-subtle)] font-semibold">
                  <tr><td colSpan={4} className="px-4 py-2 text-[10px] uppercase text-[var(--color-text-muted)]">Saldo Anterior</td><td colSpan={2} className="px-4 py-2 text-right tabular-nums">{formatCurrency(saldoAnterior)}</td></tr>
                  <tr><td colSpan={4} className="px-4 py-2 text-[10px] uppercase text-[var(--color-text-muted)]">Total de Entradas</td><td colSpan={2} className="px-4 py-2 text-right tabular-nums text-[var(--color-success)]">{formatCurrency(totalEntradas)}</td></tr>
                  <tr><td colSpan={4} className="px-4 py-2 text-[10px] uppercase text-[var(--color-text-muted)]">Total de Saídas</td><td colSpan={2} className="px-4 py-2 text-right tabular-nums text-[var(--color-danger)]">{formatCurrency(totalSaidas)}</td></tr>
                  <tr><td colSpan={4} className="px-4 py-2 text-[10px] uppercase text-[var(--color-text-muted)]">Balanço no Período</td><td colSpan={2} className="px-4 py-2 text-right tabular-nums">{formatCurrency(totalEntradas - totalSaidas)}</td></tr>
                  <tr className="border-t border-[var(--color-border-default)]"><td colSpan={4} className="px-4 py-2 text-[10px] uppercase text-[var(--color-text-primary)]">Saldo Final</td><td colSpan={2} className="px-4 py-2 text-right tabular-nums text-sm">{formatCurrency(saldoFinal)}</td></tr>
                </tfoot>
              )}
            </table>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
