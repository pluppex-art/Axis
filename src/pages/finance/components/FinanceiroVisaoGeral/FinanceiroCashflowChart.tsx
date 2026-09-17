import { Card } from "../../../../components/ui/card";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { useLocalization } from "../../../../contexts/LocalizationContext";

interface ChartEntry { name: string; receita: number; despesa: number; }

interface FinanceiroCashflowChartProps {
  chartData: ChartEntry[];
  liquidez: number | null;
  burnRate: number;
}

export function FinanceiroCashflowChart({ chartData, liquidez, burnRate }: FinanceiroCashflowChartProps) {
  const { formatCurrency } = useLocalization();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <Card className="lg:col-span-8 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Receitas x Despesas</h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Realizado (pago) nos últimos 6 meses</p>
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[var(--color-text-primary)]" />
              <span className="text-[11px] text-[var(--color-text-muted)] font-medium">Receita</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[var(--color-danger)]" />
              <span className="text-[11px] text-[var(--color-text-muted)] font-medium">Despesa</span>
            </div>
          </div>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "var(--color-text-muted)", fontSize: 11 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--color-text-muted)", fontSize: 11 }} tickFormatter={(val) => `${val / 1000}k`} width={40} />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{ backgroundColor: "var(--color-surface-elevated)", border: "1px solid var(--color-border-default)", borderRadius: "var(--radius-control)", fontSize: 12 }}
              />
              <Line type="monotone" dataKey="receita" stroke="var(--color-text-primary)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="despesa" stroke="var(--color-danger)" strokeWidth={2} strokeDasharray="4 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="lg:col-span-4 p-6 flex flex-col justify-center gap-6">
        <div>
          <p className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-1.5">Liquidez do período</p>
          <p className="text-xs text-[var(--color-text-faint)] mb-2">Quanto da despesa paga a receita paga cobre</p>
          <p className="text-2xl font-semibold tabular-nums text-[var(--color-text-primary)]">
            {liquidez !== null ? `${liquidez.toFixed(0)}%` : "—"}
          </p>
        </div>
        <div className="pt-6 border-t border-[var(--color-border-subtle)]">
          <p className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-1.5">Queima de caixa (burn rate)</p>
          <p className="text-xs text-[var(--color-text-faint)] mb-2">Despesa paga acima da receita paga no período</p>
          <p className={`text-2xl font-semibold tabular-nums ${burnRate > 0 ? "text-[var(--color-danger)]" : "text-[var(--color-text-primary)]"}`}>
            {formatCurrency(burnRate)}
          </p>
        </div>
      </Card>
    </div>
  );
}
