import React, { useState, useMemo } from "react";
import { toast } from "sonner";
import { Target, Activity, Zap, Users } from "lucide-react";
import { useData } from "../../../contexts/DataContext";
import { confirmDialog } from "../../../components/ui/confirm-dialog";
import { exportToCSV } from "../../../lib/exportCsv";
import { useLocalization } from "../../../contexts/LocalizationContext";
import { parseCurrencyBR } from "../../../lib/utils";
import { getMRR } from "../../../lib/revenueMetrics";

export function useIndicadores() {
  const { leads, financeEntries, contracts, financialGoals, scheduledExports, addScheduledExport, updateScheduledExport, deleteScheduledExport } = useData();
  const { formatCurrency } = useLocalization();

  const schedules = scheduledExports as { id: string; email: string; weekday: string; time: string; active: boolean }[];

  const [selectedKPI, setSelectedKPI] = useState<any>(null);
  const [criticalKPIs] = useState<string[]>(["Retention Rate"]);

  // Form states for scheduled exports
  const [newEmail, setNewEmail] = useState("");
  const [newWeekday, setNewWeekday] = useState("Segunda-feira");
  const [newTime, setNewTime] = useState("08:00");

  const handleCreateSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newEmail.includes("@")) {
      toast.error("Formato de e-mail inválido.");
      return;
    }

    const itemExists = schedules.find(s => s.email.toLowerCase() === newEmail.trim().toLowerCase());
    if (itemExists) {
      toast.warning("Este e-mail já possui um agendamento.");
      return;
    }

    addScheduledExport({
      email: newEmail.trim(),
      weekday: newWeekday,
      time: newTime,
      active: true
    });
    setNewEmail("");
    toast.success(`Exportação agendada com sucesso para toda ${newWeekday}!`);
  };

  const handleToggleSchedule = (id: string) => {
    const item = schedules.find(s => s.id === id);
    if (item) updateScheduledExport(id, { active: !item.active });
  };

  const handleDeleteSchedule = async (id: string) => {
    const item = schedules.find(s => s.id === id);
    if (!(await confirmDialog({
      title: "Excluir agendamento",
      description: `Excluir o agendamento de exportação para ${item?.email || "este e-mail"}? Essa ação não pode ser desfeita.`,
    }))) return;
    deleteScheduledExport(id);
    toast.success("Agendamento de e-mail removido.");
  };

  // KPIs dinâmicos
  const kpiCards = useMemo(() => {
    const closedLeads = leads.filter(l => l.status === 'Fechado');
    const totalClosedValue = closedLeads.reduce((s, l) => s + parseCurrencyBR(l.value), 0);
    const ticketMedio = closedLeads.length > 0 ? totalClosedValue / closedLeads.length : 0;

    const mrr = getMRR(contracts) || (ticketMedio / 12);
    const ltv = mrr * 12; // LTV simples de 1 ano

    // Ticket médio por mês (com base em l.date), pra calcular uma tendência real
    // mês a mês em vez de um número de exemplo.
    const porMes: Record<string, { soma: number; qtd: number }> = {};
    closedLeads.forEach(l => {
      const d = new Date(l.date || '');
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!porMes[key]) porMes[key] = { soma: 0, qtd: 0 };
      porMes[key].soma += parseCurrencyBR(l.value);
      porMes[key].qtd += 1;
    });
    const mesesOrdenados = Object.keys(porMes).sort();
    let ticketTrend = "—";
    if (mesesOrdenados.length >= 2) {
      const atual = porMes[mesesOrdenados[mesesOrdenados.length - 1]];
      const anterior = porMes[mesesOrdenados[mesesOrdenados.length - 2]];
      const ticketAtual = atual.soma / atual.qtd;
      const ticketAnterior = anterior.soma / anterior.qtd;
      if (ticketAnterior > 0) {
        const pct = ((ticketAtual - ticketAnterior) / ticketAnterior) * 100;
        ticketTrend = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
      }
    }

    return [
       { label: "Ticket Médio", value: closedLeads.length > 0 ? formatCurrency(ticketMedio) : "—", trend: ticketTrend, icon: Target, color: "text-[#06B6D4]" },
       // Ciclo de Vendas, LTV Projetado (sem série histórica de MRR pra comparar) e Retention Rate
       // ainda não têm tendência real medida em nenhum lugar do S.P.Y. — mostrar "—" em vez de um
       // número de exemplo até existir uma fonte real (ex.: datas de estágio do funil, snapshots de MRR).
       { label: "Ciclo de Vendas", value: "—", trend: "—", icon: Activity, color: "text-[#06B6D4]" },
       { label: "LTV Projetado", value: ltv > 0 ? formatCurrency(ltv) : "—", trend: "—", icon: Zap, color: "text-[#06B6D4]" },
       { label: "Retention Rate", value: "—", trend: "—", icon: Users, color: "text-[#06B6D4]" },
    ];
  }, [leads, contracts, formatCurrency]);

  // Evolução MRR vs Meta — receita real (finance_entries pagos) contra a meta real
  // cadastrada em financial_goals para o mês (soma de monthly_goal entre squads); 0 quando
  // nenhuma meta foi cadastrada para aquele mês, em vez de um valor de exemplo.
  const monthlyData = useMemo(() => {
    const months: Record<string, { receita: number, meta: number, monthKey: string }> = {};
    const receivables = financeEntries.filter(f => f.type === 'Receber' && f.status === 'Pago');

    receivables.forEach(f => {
      try {
        const d = new Date(f.date || '');
        if (isNaN(d.getTime())) return;
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const month = d.toLocaleDateString('pt-BR', { month: 'short' });

        if (!months[month]) {
          months[month] = { receita: 0, meta: 0, monthKey };
        }
        months[month].receita += f.value;
      } catch {}
    });

    (financialGoals || []).forEach((g: any) => {
      try {
        const d = new Date(g.valid_month || '');
        if (isNaN(d.getTime())) return;
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const month = d.toLocaleDateString('pt-BR', { month: 'short' });
        if (!months[month]) {
          months[month] = { receita: 0, meta: 0, monthKey };
        }
        if (months[month].monthKey === monthKey) {
          months[month].meta += Number(g.monthly_goal) || 0;
        }
      } catch {}
    });

    return Object.entries(months).map(([name, data]) => ({ name, receita: data.receita, meta: data.meta }));
  }, [financeEntries, financialGoals]);

  // Gera e baixa de verdade o CSV de receita vs. meta por mês — o envio automático
  // por e-mail via rotina agendada (CRON) ainda não existe; este botão só cobre a
  // parte que já é real: gerar o arquivo agora.
  const simulateRunAndDownloadCSV = () => {
    if (monthlyData.length === 0) {
      toast.error("Nenhum dado de receita/meta para exportar ainda.");
      return;
    }
    exportToCSV(monthlyData.map(m => ({ Mês: m.name, Receita: m.receita, Meta: m.meta })), `indicadores_receita_meta_${Date.now()}`);
    toast.success("CSV gerado e baixado.");
  };

  // Distribuição de Leads por Origem
  const pieData = useMemo(() => {
    const origens: Record<string, number> = {};
    leads.forEach(l => {
      const orig = l.source || 'Desconhecida';
      origens[orig] = (origens[orig] || 0) + 1;
    });
    const colors = ['#2563EB', '#06B6D4', '#8B5CF6', '#F59E0B', '#10B981'];
    let idx = 0;
    return Object.entries(origens).map(([name, value]) => ({
      name,
      value,
      color: colors[idx++ % colors.length]
    }));
  }, [leads]);

  return {
    schedules,
    selectedKPI,
    setSelectedKPI,
    criticalKPIs,
    newEmail,
    setNewEmail,
    newWeekday,
    setNewWeekday,
    newTime,
    setNewTime,
    handleCreateSchedule,
    handleToggleSchedule,
    handleDeleteSchedule,
    simulateRunAndDownloadCSV,
    kpiCards,
    monthlyData,
    pieData
  };
}
