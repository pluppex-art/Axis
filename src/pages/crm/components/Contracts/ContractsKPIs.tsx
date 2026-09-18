import { Card } from "../../../../components/ui/card";
import { useLocalization } from "../../../../contexts/LocalizationContext";
import { FileText, DollarSign, AlertCircle, TrendingUp } from "lucide-react";

interface ContractsKPIsProps {
  totalMRR: number;
  ativos: number;
  inadimplentes: number;
}

export function ContractsKPIs({ totalMRR, ativos, inadimplentes }: ContractsKPIsProps) {
  const { formatCurrency } = useLocalization();
  const items = [
    { label: "MRR Total", value: formatCurrency(totalMRR), icon: DollarSign, color: "text-[var(--color-primary-blue)]" },
    { label: "Contratos Ativos", value: ativos, icon: FileText, color: "text-info" },
    { label: "Inadimplência", value: inadimplentes, icon: AlertCircle, color: "text-danger" },
    { label: "Retenção Estimada", value: "96.8%", icon: TrendingUp, color: "text-success" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {items.map(({ label, value, icon: Icon, color }) => (
        <Card key={label} className="p-6">
          <Icon className={`w-5 h-5 ${color} mb-4`} />
          <div className="text-2xl font-display font-black text-[var(--color-text-primary)] mb-1 italic">{value}</div>
          <div className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">{label}</div>
        </Card>
      ))}
    </div>
  );
}
