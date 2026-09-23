import { useMemo } from 'react';
import { DollarSign, Users, Target, TrendingDown, Sun } from 'lucide-react';
import { useLocalization } from '../../../contexts/LocalizationContext';

export type DashboardStatsCard = {
  label: string;
  value: string;
  trend: string;
  color: string;
  bg: string;
  icon: React.ComponentType<any>;
  forecast: string;
  /** Explica de onde vem o número e como é calculado — mostrado como tooltip
   * no card (ver QuickStatsGrid.tsx). Nunca jargão de banco de dados. */
  tooltip?: string;
};

export function DashboardStatsByNiche({
  tenantNiche,
  totalRevenue,
  leadsLength,
  conversionRate,
  churnRate,
  hasContractsData,
}: {
  tenantNiche: string | undefined;
  totalRevenue: number;
  leadsLength: number;
  conversionRate: number;
  churnRate: number;
  hasContractsData: boolean;
}) {
  const { formatCurrency } = useLocalization();
  // 0 contratos/pacientes não é "0% de churn" — é "não dá pra medir ainda".
  // Mostrar "0,0%" nesse caso pareceria uma métrica boa quando na real não
  // existe base nenhuma por trás dela.
  const churnValue = hasContractsData ? `${churnRate.toFixed(1)}%` : 'Sem dados';

  const stats = useMemo<DashboardStatsCard[]>(() => {
    const niche = tenantNiche || 'Master';

    if (niche === 'Tecnologia') {
      return [
        {
          label: 'Hardware & Upgrades',
          value: formatCurrency(totalRevenue),
          trend: '--',
          color: 'text-slate-400',
          bg: 'bg-white/5',
          icon: DollarSign,
          forecast: '--',
        },
        {
          label: 'Aparelhos Trade-In',
          value: leadsLength.toString(),
          trend: '--',
          color: 'text-slate-400',
          bg: 'bg-white/5',
          icon: Users,
          forecast: '--',
        },
        {
          label: 'Ativação SDR',
          value: `${conversionRate}%`,
          trend: '--',
          color: 'text-slate-400',
          bg: 'bg-white/5',
          icon: Target,
          forecast: '--',
        },
        {
          label: 'Foco Conversão',
          value: `${churnRate.toFixed(1)}%`,
          trend: '--',
          color: 'text-slate-400',
          bg: 'bg-white/5',
          icon: TrendingDown,
          forecast: '--',
        },
      ];
    }

    if (niche === 'Solar') {
      return [
        {
          label: 'Potência Total',
          value: '--',
          trend: '--',
          color: 'text-slate-400',
          bg: 'bg-white/5',
          icon: Sun,
          forecast: '--',
        },
        {
          label: 'Projetos em Homologação',
          value: leadsLength.toString(),
          trend: '--',
          color: 'text-slate-400',
          bg: 'bg-white/5',
          icon: Users,
          forecast: '--',
        },
        {
          label: 'Viabilidade Concluída',
          value: '--',
          trend: '--',
          color: 'text-slate-400',
          bg: 'bg-white/5',
          icon: Target,
          forecast: '--',
        },
        {
          label: 'ROI Médio Projetos',
          value: '--',
          trend: '--',
          color: 'text-slate-400',
          bg: 'bg-white/5',
          icon: TrendingDown,
          forecast: '--',
        },
      ];
    }

    if (niche === 'Clínica') {
      return [
        {
          label: 'Faturamento Clínico',
          value: formatCurrency(totalRevenue),
          trend: '--',
          color: 'text-slate-400',
          bg: 'bg-white/5',
          icon: DollarSign,
          forecast: '--',
        },
        {
          label: 'Consultas Agendadas',
          value: leadsLength.toString(),
          trend: '--',
          color: 'text-slate-400',
          bg: 'bg-white/5',
          icon: Users,
          forecast: '--',
        },
        {
          label: 'Teleconsultas Ativas',
          value: '--',
          trend: '--',
          color: 'text-slate-400',
          bg: 'bg-white/5',
          icon: Target,
          forecast: '--',
        },
        {
          label: 'Taxa Churn Pacientes',
          value: churnValue,
          trend: '--',
          color: 'text-slate-400',
          bg: 'bg-white/5',
          icon: TrendingDown,
          forecast: '--',
        },
      ];
    }

    if (niche === 'Imobiliária') {
      return [
        {
          label: 'VGV Estimado',
          value: formatCurrency(totalRevenue),
          trend: '--',
          color: 'text-slate-400',
          bg: 'bg-white/5',
          icon: DollarSign,
          forecast: '--',
        },
        {
          label: 'Visitas Incorporador',
          value: leadsLength.toString(),
          trend: '--',
          color: 'text-slate-400',
          bg: 'bg-white/5',
          icon: Users,
          forecast: '--',
        },
        {
          label: 'Crédito Pré-Aprovado',
          value: `${conversionRate}%`,
          trend: '--',
          color: 'text-slate-400',
          bg: 'bg-white/5',
          icon: Target,
          forecast: '--',
        },
        {
          label: 'Tempo de Campanha',
          value: '--',
          trend: '--',
          color: 'text-slate-400',
          bg: 'bg-white/5',
          icon: TrendingDown,
          forecast: '--',
        },
      ];
    }

    // Default fallback
    return [
      {
        label: 'Receita (MRR)',
        value: formatCurrency(totalRevenue),
        trend: '--',
        color: 'text-slate-400',
        bg: 'bg-white/5',
        icon: DollarSign,
        forecast: '--',
        tooltip: 'Soma do valor recorrente (mrr) de todos os contratos ativos agora — não muda com o período selecionado, é um saldo do momento atual.',
      },
      {
        label: 'Leads Ativos',
        value: leadsLength.toString(),
        trend: '--',
        color: 'text-slate-400',
        bg: 'bg-white/5',
        icon: Users,
        forecast: '--',
        tooltip: 'Leads criados no período selecionado que ainda não foram marcados como Perdido (inclui os já Fechados).',
      },
      {
        label: 'Conversão',
        value: `${conversionRate}%`,
        trend: '--',
        color: 'text-slate-400',
        bg: 'bg-white/5',
        icon: Target,
        forecast: '--',
        tooltip: 'Leads com status Fechado ÷ total de leads criados no período selecionado.',
      },
      {
        label: 'Taxa Churn',
        value: churnValue,
        trend: '--',
        color: 'text-slate-400',
        bg: 'bg-white/5',
        icon: TrendingDown,
        tooltip: 'Contratos cancelados durante o período selecionado ÷ total de contratos existentes nesse intervalo.',
        forecast: '--',
      },
    ];
  }, [tenantNiche, totalRevenue, leadsLength, conversionRate, churnRate, churnValue, formatCurrency]);

  return stats;
}

