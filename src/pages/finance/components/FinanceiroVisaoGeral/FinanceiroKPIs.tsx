import { Card } from "../../../../components/ui/card";
import { TrendingUp, AlertCircle, Wallet, Globe } from "lucide-react";
import { motion } from "motion/react";
import { useLocalization } from "../../../../contexts/LocalizationContext";

interface FinanceiroKPIsProps {
  receita: number;
  despesa: number;
  mrr: number;
  inadimplencia: number;
}

export function FinanceiroKPIs({ receita, despesa, mrr, inadimplencia }: FinanceiroKPIsProps) {
  const { formatCurrency } = useLocalization();
  const fmt = (n: number) => formatCurrency(n);
  const kpis = [
    { label: "Receita (Real)",      value: fmt(receita),               trend: "--", positive: true,  icon: TrendingUp,  color: "text-emerald-500" },
    { label: "Custo Operacional",   value: fmt(despesa),               trend: "--", positive: true,  icon: Wallet,      color: "text-rose-500" },
    { label: "MRR Global",          value: fmt(mrr),                   trend: "--", positive: true,  icon: Globe,       color: "text-blue-500" },
    { label: "Contas a Pagar em Atraso", value: `${inadimplencia.toFixed(1)}%`, trend: "--", positive: false, icon: AlertCircle, color: "text-amber-500" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi, i) => (
        <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
          <Card className="p-6 bg-[var(--color-surface-elevated)]/50 border hover:border-white/10 border-white/5 backdrop-blur-md transition-all h-full">
            <kpi.icon className={`w-5 h-5 ${kpi.color} mb-4`} />
            <div className="text-2xl font-display font-black text-white mb-1 italic">{kpi.value}</div>
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{kpi.label}</div>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
