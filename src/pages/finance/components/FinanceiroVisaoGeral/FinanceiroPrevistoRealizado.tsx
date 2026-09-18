import { Card } from "../../../../components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { useLocalization } from "../../../../contexts/LocalizationContext";
import type { PrevistoRealizado } from "../../lib/financeEngine";

interface FinanceiroPrevistoRealizadoProps {
  recebimentos: PrevistoRealizado;
  despesas: PrevistoRealizado;
}

function Donut({ label, data, color }: { label: string; data: PrevistoRealizado; color: string }) {
  const { formatCurrency } = useLocalization();
  const chartData = [
    { name: "Realizado", value: data.percentual },
    { name: "Resto", value: Math.max(0, 100 - data.percentual) },
  ];
  return (
    <div className="flex-1 flex flex-col items-center text-center">
      <p className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">{label}</p>
      <div className="relative w-32 h-32">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chartData} cx="50%" cy="50%" innerRadius={44} outerRadius={58} startAngle={90} endAngle={-270} dataKey="value" stroke="none">
              <Cell fill={color} />
              <Cell fill="var(--color-border-subtle)" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-semibold tabular-nums text-[var(--color-text-primary)]">{data.percentual}%</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 w-full mt-3 text-[11px]">
        <div>
          <p className="text-[var(--color-text-faint)]">Realizado</p>
          <p className="font-semibold tabular-nums text-[var(--color-text-primary)]">{formatCurrency(data.realizado)}</p>
        </div>
        <div>
          <p className="text-[var(--color-text-faint)]">Falta</p>
          <p className="font-semibold tabular-nums text-[var(--color-text-primary)]">{formatCurrency(data.falta)}</p>
        </div>
        <div>
          <p className="text-[var(--color-text-faint)]">Previsto</p>
          <p className="font-semibold tabular-nums text-[var(--color-text-primary)]">{formatCurrency(data.previsto)}</p>
        </div>
      </div>
    </div>
  );
}

/** Previsto × Realizado do mês — previsto é TODO lançamento do mês
 * (competência), realizado é só o pago (caixa); percentual vem do motor
 * central (financeEngine.previstoRealizado), nunca recalculado aqui. */
export function FinanceiroPrevistoRealizado({ recebimentos, despesas }: FinanceiroPrevistoRealizadoProps) {
  return (
    <Card className="p-6">
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Previsto × Realizado (mês atual)</h3>
      <div className="flex flex-col sm:flex-row gap-6">
        <Donut label="Recebimentos" data={recebimentos} color="var(--color-success)" />
        <Donut label="Despesas" data={despesas} color="var(--color-danger)" />
      </div>
    </Card>
  );
}
