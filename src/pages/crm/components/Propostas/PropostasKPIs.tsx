import { Card } from "../../../../components/ui/card";
import { useLocalization } from "../../../../contexts/LocalizationContext";
import { Send, CheckCircle2, ArrowUpRight, FileText } from "lucide-react";

interface PropostasKpisValue {
  aguardandoAceite: number;
  convertidasMes: number;
  taxaConversao: number;
  propostasAtivas: number;
}

// Os quatro números já vêm calculados de src/pages/crm/usePropostasList.ts
// (query server-side, não o array de propostas inteiro) — este componente só
// formata e renderiza. "Convertidas (Mês)" é sempre o mês corrente de verdade,
// independente do filtro de data aplicado na tela (indicador fixo, não a lista filtrada).
export function PropostasKPIs({ kpis }: { kpis: PropostasKpisValue }) {
  const { formatCurrency } = useLocalization();
  const stats = [
    { label: "Aguardando Aceite", value: formatCurrency(kpis.aguardandoAceite), icon: Send, color: "text-info" },
    { label: "Convertidas (Mês)", value: formatCurrency(kpis.convertidasMes), icon: CheckCircle2, color: "text-success" },
    { label: "Taxa de Conversão", value: `${kpis.taxaConversao}%`, icon: ArrowUpRight, color: "text-[var(--color-primary-blue)]" },
    { label: "Propostas Ativas", value: kpis.propostasAtivas.toString(), icon: FileText, color: "text-warning" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {stats.map((stat) => (
        <Card key={stat.label} className="p-6">
          <stat.icon className={`w-5 h-5 ${stat.color} mb-4`} />
          <div className="text-2xl font-display font-black text-[var(--color-text-primary)] mb-1 italic">{stat.value}</div>
          <div className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">{stat.label}</div>
        </Card>
      ))}
    </div>
  );
}
