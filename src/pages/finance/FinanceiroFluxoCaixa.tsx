import { useMemo, useState } from "react";
import { PageContainer } from "../../components/PageContainer";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { StatCell, StatCellRow } from "./components/StatCell";
import { ArrowUpRight, ArrowDownRight, Scale, Download, Calendar } from "lucide-react";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { useData } from "../../contexts/DataContext";
import { useLocalization } from "../../contexts/LocalizationContext";
import { downloadCsv } from "../../lib/csvExport";
import { parseEntryDate } from "./lib/financeDates";
import { isPago, round2, type FinanceEntryLike } from "./lib/financeEngine";
import { cn } from "../../lib/utils";

const PERIODOS = [30, 60, 90] as const;

/** Fluxo de caixa REALIZADO (regime de caixa: só status "Pago") dos últimos
 * N dias — irmão do dashboard "Projeção de Caixa", que é o oposto: só
 * "A Vencer". Os dois nunca se misturam. */
export default function FinanceiroFluxoCaixa() {
  const { financeEntries } = useData();
  const { formatCurrency } = useLocalization();
  const [periodo, setPeriodo] = useState<(typeof PERIODOS)[number]>(30);

  const { totalEntradas, totalSaidas, saldoLiquido, fluxoDiario } = useMemo(() => {
    const hoje = new Date(); hoje.setHours(23, 59, 59, 999);
    const inicio = new Date(hoje); inicio.setDate(inicio.getDate() - periodo); inicio.setHours(0, 0, 0, 0);

    const doPeriodo = (financeEntries as FinanceEntryLike[])
      .filter(isPago)
      .map(e => ({ ...e, __data: parseEntryDate(e.date) }))
      .filter((e): e is FinanceEntryLike & { __data: Date } => !!e.__data && e.__data >= inicio && e.__data <= hoje);

    const buckets = new Map<string, { data: Date; entradas: number; saidas: number }>();
    for (const e of doPeriodo) {
      const key = e.__data.toISOString().slice(0, 10);
      const cur = buckets.get(key) || { data: e.__data, entradas: 0, saidas: 0 };
      if (e.type === "Receber") cur.entradas += e.value; else cur.saidas += e.value;
      buckets.set(key, cur);
    }

    const sorted = Array.from(buckets.values()).sort((a, b) => a.data.getTime() - b.data.getTime());
    let acumulado = 0;
    const fluxoDiario = sorted.map(b => {
      const saldoDia = round2(b.entradas - b.saidas);
      acumulado = round2(acumulado + saldoDia);
      return {
        label: b.data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        dataCompleta: b.data.toLocaleDateString("pt-BR"),
        entradas: b.entradas, saidas: b.saidas, saldoDia, acumulado,
      };
    });

    const totalEntradas = doPeriodo.filter(e => e.type === "Receber").reduce((s, e) => s + e.value, 0);
    const totalSaidas = doPeriodo.filter(e => e.type === "Pagar").reduce((s, e) => s + e.value, 0);

    return { totalEntradas, totalSaidas, saldoLiquido: round2(totalEntradas - totalSaidas), fluxoDiario };
  }, [financeEntries, periodo]);

  const handleExport = () => {
    downloadCsv(`fluxo_de_caixa_${periodo}d_${Date.now()}.csv`, ["Data", "Entradas", "Saídas", "Saldo do Dia", "Acumulado"], fluxoDiario.map(d => [d.dataCompleta, d.entradas, d.saidas, d.saldoDia, d.acumulado]));
  };

  return (
    <PageContainer
      title="Fluxo de Caixa"
      description="Entradas e saídas já efetivamente pagas (regime de caixa) — o que já aconteceu de fato, dia a dia."
      breadcrumb={[{ label: "Financeiro", path: "/app/financeiro/dashboard" }, { label: "Fluxo de Caixa" }]}
      actions={
        <div className="flex items-center gap-2 print:hidden">
          <div className="flex items-center gap-1 bg-[var(--color-surface-sunken)] p-1 rounded-[var(--radius-control)] border border-[var(--color-border-subtle)]">
            {PERIODOS.map(p => (
              <Button key={p} size="sm" variant={periodo === p ? "default" : "ghost"} onClick={() => setPeriodo(p)} className="h-7 px-3 text-xs font-medium">{p}d</Button>
            ))}
          </div>
          <Button variant="outline" onClick={handleExport} className="h-9 px-4 text-xs font-medium gap-1.5"><Download className="w-3.5 h-3.5" /> Exportar CSV</Button>
        </div>
      }
    >
      <div className="space-y-4 max-w-[1700px] mx-auto pb-12">
        <StatCellRow>
          <StatCell label={`Entradas (${periodo}d)`} value={formatCurrency(totalEntradas)} icon={ArrowUpRight} tone="success" hint="Só o que já foi pago" />
          <StatCell label={`Saídas (${periodo}d)`} value={formatCurrency(totalSaidas)} icon={ArrowDownRight} tone="danger" hint="Só o que já foi pago" />
          <StatCell label="Saldo Líquido do Período" value={formatCurrency(saldoLiquido)} icon={Scale} tone={saldoLiquido < 0 ? "danger" : "neutral"} />
        </StatCellRow>

        {fluxoDiario.length > 0 && (
          <Card className="p-6 print:hidden">
            <h3 className="text-xs font-semibold text-[var(--color-text-primary)] mb-4">Entradas × Saídas × Acumulado</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={fluxoDiario}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "var(--color-text-muted)", fontSize: 10 }} minTickGap={20} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--color-text-muted)", fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={40} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ backgroundColor: "var(--color-surface-elevated)", border: "1px solid var(--color-border-default)", borderRadius: "var(--radius-control)" }} />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Bar dataKey="entradas" name="Entradas" fill="var(--color-success)" radius={[3, 3, 0, 0]} maxBarSize={18} />
                  <Bar dataKey="saidas" name="Saídas" fill="var(--color-danger)" radius={[3, 3, 0, 0]} maxBarSize={18} />
                  <Line type="monotone" dataKey="acumulado" name="Acumulado" stroke="var(--color-primary-blue)" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        <Card className="overflow-hidden">
          <div className="p-4 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
            <h3 className="text-xs font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-[var(--color-text-faint)]" /> Movimentações por Dia
            </h3>
            <span className="text-[10px] text-[var(--color-text-faint)]">{fluxoDiario.length} dia(s) com movimentação</span>
          </div>
          <table className="w-full text-xs text-left">
            <thead className="text-[10px] uppercase font-semibold tracking-wide text-[var(--color-text-muted)] bg-[var(--color-surface-sunken)] border-b border-[var(--color-border-subtle)]">
              <tr>
                <th className="px-6 py-3">Data</th>
                <th className="px-6 py-3 text-right">Entradas</th>
                <th className="px-6 py-3 text-right">Saídas</th>
                <th className="px-6 py-3 text-right">Saldo do Dia</th>
                <th className="px-6 py-3 text-right">Acumulado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {fluxoDiario.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-[var(--color-text-faint)]">Nenhum lançamento pago nos últimos {periodo} dias.</td></tr>
              ) : [...fluxoDiario].reverse().map(d => (
                <tr key={d.dataCompleta} className="hover:bg-[var(--color-surface-sunken)]/50 transition-colors">
                  <td className="px-6 py-3 font-medium text-[var(--color-text-primary)]">{d.dataCompleta}</td>
                  <td className="px-6 py-3 text-right tabular-nums text-[var(--color-success)]">{d.entradas > 0 ? formatCurrency(d.entradas) : "—"}</td>
                  <td className="px-6 py-3 text-right tabular-nums text-[var(--color-danger)]">{d.saidas > 0 ? formatCurrency(d.saidas) : "—"}</td>
                  <td className={cn("px-6 py-3 text-right tabular-nums font-medium", d.saldoDia < 0 ? "text-[var(--color-danger)]" : "text-[var(--color-text-primary)]")}>{formatCurrency(d.saldoDia)}</td>
                  <td className={cn("px-6 py-3 text-right tabular-nums font-semibold", d.acumulado < 0 ? "text-[var(--color-danger)]" : "text-[var(--color-text-primary)]")}>{formatCurrency(d.acumulado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </PageContainer>
  );
}
