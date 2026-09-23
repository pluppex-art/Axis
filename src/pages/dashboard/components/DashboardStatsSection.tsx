import { QuickStatsGrid } from './QuickStatsGrid';
import { DashboardStatsByNiche } from './DashboardStatsByNiche';

export function DashboardStatsSection({
  tenantNiche,
  totalRevenue,
  leadsLength,
  conversionRate,
  churnRate,
  hasContractsData,
  dateFrom,
  dateTo,
}: {
  tenantNiche: string | undefined;
  totalRevenue: number;
  leadsLength: number;
  conversionRate: number | string;
  churnRate: number;
  hasContractsData: boolean;
  dateFrom: string | null;
  dateTo: string | null;
}) {
  const stats = DashboardStatsByNiche({
    tenantNiche,
    totalRevenue,
    leadsLength,
    conversionRate: typeof conversionRate === "string" ? parseFloat(conversionRate) : conversionRate,
    churnRate,
    hasContractsData,
  });

  const periodoLabel = !dateFrom && !dateTo
    ? "Todo o período"
    : `${dateFrom ? dateFrom.split("-").reverse().join("/") : "…"} – ${dateTo ? dateTo.split("-").reverse().join("/") : "…"}`;

  return <QuickStatsGrid stats={stats} periodoLabel={periodoLabel} />;
}

