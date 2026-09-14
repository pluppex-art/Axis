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
};

export function DashboardStatsByNiche({
  tenantNiche,
  totalRevenue,
  leadsLength,
  conversionRate,
  churnRate,
}: {
  tenantNiche: string | undefined;
  totalRevenue: number;
  leadsLength: number;
  conversionRate: number;
  churnRate: number;
}) {
  const { formatCurrency } = useLocalization();

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
          value: `${churnRate.toFixed(1)}%`,
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
      },
      {
        label: 'Leads Ativos',
        value: leadsLength.toString(),
        trend: '--',
        color: 'text-slate-400',
        bg: 'bg-white/5',
        icon: Users,
        forecast: '--',
      },
      {
        label: 'Conversão',
        value: `${conversionRate}%`,
        trend: '--',
        color: 'text-slate-400',
        bg: 'bg-white/5',
        icon: Target,
        forecast: '--',
      },
      {
        label: 'Taxa Churn',
        value: `${churnRate.toFixed(1)}%`,
        trend: '--',
        color: 'text-slate-400',
        bg: 'bg-white/5',
        icon: TrendingDown,
        forecast: '--',
      },
    ];
  }, [tenantNiche, totalRevenue, leadsLength, conversionRate, churnRate, formatCurrency]);

  return stats;
}

