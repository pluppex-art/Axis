import { StrategicalView } from "./StrategicalView";
import { CommercialView } from "./CommercialView";
import { MarketingView } from "./MarketingView";
import { CustomerSuccessView } from "./CustomerSuccessView";
import { BusinessIntelligenceView } from "./BusinessIntelligenceView";
import type { DashboardSummary } from "../useDashboard";

export function DashboardTabContent(props: {
  activeTab: "executivo" | "comercial" | "marketing" | "sucesso" | "bi";
  comparisonPeriod: "month" | "year";
  setComparisonPeriod: (p: "month" | "year") => void;
  performanceData: any[];
  squads: any[];
  contracts: any[];
  salesRanking: any[];
  funnelData: any[];
  recentActivities: any[];
  serverSummary: DashboardSummary | null;
}) {
  const {
    activeTab,
    comparisonPeriod,
    setComparisonPeriod,
    performanceData,
    squads,
    contracts,
    salesRanking,
    funnelData,
    recentActivities,
    serverSummary,
  } = props;

  return (
    <>
      {activeTab === "executivo" && (
        <StrategicalView
          comparisonPeriod={comparisonPeriod}
          setComparisonPeriod={setComparisonPeriod}
          performanceData={performanceData}
          squads={squads}
          contracts={contracts}
          serverSummary={serverSummary}
        />
      )}

      {activeTab === "comercial" && (
        <CommercialView
          salesRanking={salesRanking}
          funnelData={funnelData}
          recentActivities={recentActivities}
        />
      )}

      {activeTab === "marketing" && <MarketingView />}

      {activeTab === "sucesso" && <CustomerSuccessView serverSummary={serverSummary} />}

      {activeTab === "bi" && <BusinessIntelligenceView />}
    </>
  );
}

