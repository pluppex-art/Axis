import { CalendarRange, X } from "lucide-react";
import { PageContainer } from "../../components/PageContainer";
import { Button } from "../../components/ui/button";

import { useDashboard } from "./useDashboard";
import { DashboardGoalAlerts } from "./components/DashboardGoalAlerts";
import { DashboardActionsTabs } from "./components/DashboardActionsTabs";
import { DashboardTabContent } from "./components/DashboardTabContent";
import { DashboardStatsSection } from "./components/DashboardStatsSection";



export default function Dashboard() {
  const {
    activeLeadsCount,
    activeTab,
    setActiveTab,
    comparisonPeriod,
    setComparisonPeriod,
    goalAlerts,
    totalRevenue,
    conversionRate,
    squads,
    contracts,
    user,
    performanceData,
    salesRanking,
    funnelData,
    recentActivities,
    churnRate,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
  } = useDashboard();

  return (

    <PageContainer
      title="Inteligência S.P.Y."
      description="Painel de comando estratégico para decisões baseadas em dados."
      actions={
        <DashboardActionsTabs activeTab={activeTab as any} onTabChange={setActiveTab as any} />
      }
    >
      <div className="space-y-6 max-w-[1600px] mx-auto pb-10">

        {/* Filtro de período — afeta cartões, funil e ranking (por data de
            cadastro do lead); o gráfico de tendência mantém sua janela fixa. */}
        <div className="flex flex-wrap items-center gap-2 bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] px-3 py-2 w-fit">
          <CalendarRange className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
          <input
            type="date"
            value={dateFrom ?? ""}
            onChange={(e) => setDateFrom(e.target.value || null)}
            className="bg-transparent text-xs text-[var(--color-text-primary)] focus:outline-none cursor-pointer"
          />
          <span className="text-xs text-[var(--color-text-faint)]">até</span>
          <input
            type="date"
            value={dateTo ?? ""}
            onChange={(e) => setDateTo(e.target.value || null)}
            className="bg-transparent text-xs text-[var(--color-text-primary)] focus:outline-none cursor-pointer"
          />
          {(dateFrom || dateTo) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setDateFrom(null); setDateTo(null); }}
              className="h-6 px-2 text-[10px] gap-1"
            >
              <X className="w-3 h-3" /> Limpar
            </Button>
          )}
        </div>

        {/* Goal Alerts Banner */}
        <DashboardGoalAlerts goalAlerts={goalAlerts} />


        {/* Quick Stats Grid */}
        <DashboardStatsSection
          tenantNiche={user?.tenantNiche}
          totalRevenue={totalRevenue}
          leadsLength={activeLeadsCount}
          conversionRate={conversionRate}
          churnRate={churnRate}
        />



        <DashboardTabContent
          activeTab={activeTab as any}
          comparisonPeriod={comparisonPeriod}
          setComparisonPeriod={setComparisonPeriod}
          performanceData={performanceData}
          squads={squads}
          contracts={contracts}
          salesRanking={salesRanking}
          funnelData={funnelData}
          recentActivities={recentActivities}
        />


      </div>
    </PageContainer>
  );
}
