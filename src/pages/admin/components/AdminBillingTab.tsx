import { Card } from "../../../components/ui/card";
import { DollarSign, TrendingDown, Wallet } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from "recharts";
import { useLocalization } from "../../../contexts/LocalizationContext";

interface AdminBillingTabProps {
  revenueData: { name: string; mrr: number }[];
  CustomTooltip: React.ComponentType<any>;
}

export function AdminBillingTab({ revenueData, CustomTooltip }: AdminBillingTabProps) {
  const { formatCurrency } = useLocalization();
  const fmt = (n: number) => formatCurrency(n);
  const mesesComReceita = revenueData.filter(m => m.mrr > 0);
  const arpu = mesesComReceita.length > 0
    ? mesesComReceita.reduce((s, m) => s + m.mrr, 0) / mesesComReceita.length
    : 0;
  const ltvEstimado = arpu * 12;

  const metricItems = [
    { label: "ARPU (Ticket Médio)", value: arpu > 0 ? fmt(arpu) : "—", icon: DollarSign, color: "text-emerald-500" },
    // Não há acompanhamento real de cancelamento/churn no sistema hoje — mostrar
    // "—" em vez de um número de exemplo até existir uma fonte real de dados.
    { label: "Churn Rate", value: "—", icon: TrendingDown, color: "text-rose-500" },
    { label: "LTV Estimado", value: ltvEstimado > 0 ? fmt(ltvEstimado) : "—", icon: Wallet, color: "text-indigo-500" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {metricItems.map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="p-6 bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] hover:border-blue-500/30 hover:shadow-md transition-all">
            <Icon className={`w-5 h-5 ${color} mb-4`} />
            <div className="text-2xl font-display font-black text-[var(--color-text-primary)] mb-1 italic">{value}</div>
            <div className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">{label}</div>
          </Card>
        ))}
      </div>

      <Card className="p-5 bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)]">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-6">Receita vs Churn</h3>
        {revenueData.length === 0 ? (
          <div className="h-[300px] w-full flex flex-col items-center justify-center gap-3">
            <DollarSign className="w-8 h-8 text-[var(--color-text-faint)]" />
            <span className="text-sm text-[var(--color-text-muted)]">Sem dados para projeção</span>
          </div>
        ) : (
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--color-border-default)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "var(--color-text-muted)", fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--color-text-muted)", fontSize: 12 }} tickFormatter={(v) => `R$${v / 1000}k`} />
                <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: "var(--color-surface-sunken)" }} />
                <Bar dataKey="mrr" fill="#06B6D4" radius={[4, 4, 0, 0]} maxBarSize={60} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}
