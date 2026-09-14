import { useMemo, useState } from "react";
import { PageContainer } from "../../components/PageContainer";
import { Button } from "../../components/ui/button";
import {
  TrendingUp, TrendingDown, DollarSign, Calendar, Download,
  ArrowUpRight, ArrowDownRight, Wallet, Filter, CheckCircle2
} from "lucide-react";
import { Card } from "../../components/ui/card";
import { useData } from "../../contexts/DataContext";
import { downloadCsv } from "../../lib/csvExport";
import { useLocalization } from "../../contexts/LocalizationContext";

export default function FinanceiroFluxoCaixa() {
  const { financeEntries } = useData();
  const { formatCurrency } = useLocalization();
  const [periodo, setPeriodo] = useState<"30d" | "60d" | "90d">("30d");

  const { totalEntradas, totalSaidas, saldoProjetado, fluxoDiario } = useMemo(() => {
    let entradas = 0;
    let saidas = 0;

    financeEntries.forEach(item => {
      if (item.type === "Receber") entradas += item.value;
      else if (item.type === "Pagar") saidas += item.value;
    });

    const saldo = entradas - saidas;

    // Daily breakdown projection
    const dailyMap: Record<string, { date: string; entradas: number; saidas: number; saldo: number }> = {};
    financeEntries.forEach(item => {
      const d = item.date || "Hoje";
      if (!dailyMap[d]) dailyMap[d] = { date: d, entradas: 0, saidas: 0, saldo: 0 };
      if (item.type === "Receber") dailyMap[d].entradas += item.value;
      else dailyMap[d].saidas += item.value;
      dailyMap[d].saldo = dailyMap[d].entradas - dailyMap[d].saidas;
    });

    return {
      totalEntradas: entradas,
      totalSaidas: saidas,
      saldoProjetado: saldo,
      fluxoDiario: Object.values(dailyMap),
    };
  }, [financeEntries]);

  const handleExport = () => {
    downloadCsv(
      `fluxo_de_caixa_${Date.now()}.csv`,
      ["Data", "Entradas (R$)", "Saídas (R$)", "Saldo Líquido (R$)"],
      fluxoDiario.map(d => [d.date, d.entradas.toFixed(2), d.saidas.toFixed(2), d.saldo.toFixed(2)])
    );
  };

  return (
    <PageContainer
      title="Fluxo de Caixa & Projeções"
      description="Análise preditiva de liquidez, saldo projetado e conciliação de entradas e saídas."
      actions={
        <Button variant="outline" onClick={handleExport} className="h-9 px-3.5 text-xs font-bold gap-1.5 rounded-xl">
          <Download className="w-3.5 h-3.5" /> Exportar Relatório
        </Button>
      }
    >
      {/* Top Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="p-5 bg-[var(--color-surface)] border border-emerald-500/25 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Entradas Projetadas</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-500">
            {formatCurrency(totalEntradas)}
          </div>
        </Card>

        <Card className="p-5 bg-[var(--color-surface)] border border-rose-500/25 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Saídas Programadas</span>
            <ArrowDownRight className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-500">
            {formatCurrency(totalSaidas)}
          </div>
        </Card>

        <Card className={`p-5 bg-[var(--color-surface)] border shadow-xs ${saldoProjetado >= 0 ? 'border-[var(--color-primary-blue)]/30' : 'border-rose-500/30'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Saldo Líquido Projetado</span>
            <Wallet className="w-4 h-4 text-[var(--color-primary-blue)]" />
          </div>
          <div className={`text-2xl font-black ${saldoProjetado >= 0 ? 'text-[var(--color-primary-blue)]' : 'text-rose-500'}`}>
            {formatCurrency(saldoProjetado)}
          </div>
        </Card>
      </div>

      {/* Daily Cash Flow Table */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border-default)] rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
          <h4 className="text-xs font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[var(--color-primary-blue)]" /> Movimentações por Data / Vencimento
          </h4>
          <span className="text-[10px] text-[var(--color-text-muted)] font-mono">{fluxoDiario.length} registros</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-sunken)]/60 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                <th className="px-5 py-3">Data / Vencimento</th>
                <th className="px-4 py-3 text-right">Entradas (R$)</th>
                <th className="px-4 py-3 text-right">Saídas (R$)</th>
                <th className="px-5 py-3 text-right">Saldo do Dia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {fluxoDiario.map((row, idx) => (
                <tr key={idx} className="hover:bg-[var(--color-surface-sunken)]/40 transition-colors">
                  <td className="px-5 py-3.5 font-bold text-[var(--color-text-primary)]">{row.date}</td>
                  <td className="px-4 py-3.5 text-right font-medium text-emerald-500">
                    {row.entradas > 0 ? `+ ${formatCurrency(row.entradas)}` : "-"}
                  </td>
                  <td className="px-4 py-3.5 text-right font-medium text-rose-500">
                    {row.saidas > 0 ? `- ${formatCurrency(row.saidas)}` : "-"}
                  </td>
                  <td className={`px-5 py-3.5 text-right font-bold ${row.saldo >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {formatCurrency(row.saldo)}
                  </td>
                </tr>
              ))}
              {fluxoDiario.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-[var(--color-text-muted)]">
                    Nenhum lançamento no período para compor o fluxo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </PageContainer>
  );
}
