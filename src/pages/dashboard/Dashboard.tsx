import { PageContainer } from "../../components/PageContainer";

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
