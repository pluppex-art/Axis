import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Activity, Server, DollarSign, TerminalSquare, Bell, Plus, Cpu } from "lucide-react";
import { Button } from "../../components/ui/button";
import { PageContainer } from "../../components/PageContainer";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { toast } from "sonner";
import { ModuleConfigModal } from "./components/ModuleConfigModal";
import { AdminOverviewTab } from "./components/AdminOverviewTab";
import { AdminTenantsTab } from "./components/AdminTenantsTab";
import { AdminBillingTab } from "./components/AdminBillingTab";
import { AdminLogsTab } from "./components/AdminLogsTab";
import { NovoTenantModal } from "./components/NovoTenantModal";
import ConfigModulosDemos from "../settings/ConfigModulosDemos";

const TABS = [
  { id: "overview", label: "Visão Geral", icon: Activity },
  { id: "modules", label: "Módulos & Demos", icon: Cpu },
  { id: "tenants", label: "Tenants & Instâncias", icon: Server },
  { id: "billing", label: "Faturamento", icon: DollarSign },
  { id: "logs", label: "Logs do Sistema", icon: TerminalSquare },
];

export const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0f172a] border border-white/10 p-3 rounded-lg">
        <p className="text-white text-sm mb-1">{label}</p>
        <p className="text-slate-300 text-sm">R$ {(payload[0].value / 1000).toFixed(0)}k</p>
      </div>
    );
  }
  return null;
};

export default function AdminSaaS() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(tabFromUrl || "overview");
  const [selectedTenant, setSelectedTenant] = useState<any | null>(null);
  const [isCreateTenantOpen, setIsCreateTenantOpen] = useState(false);
  const [crmEnabled, setCrmEnabled] = useState(true);

  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  };
  const [sdrEnabled, setSdrEnabled] = useState(false);
  const [advDashboardEnabled, setAdvDashboardEnabled] = useState(false);

  const { getTenantModules, updateTenantModules } = useAuth();
  const { financeEntries } = useData();

  const revenueData = useMemo(() => {
    const months: Record<string, { name: string; mrr: number }> = {};
    financeEntries
      .filter((f) => f.type === "Receber" && f.status === "Pago")
      .forEach((f) => {
        try {
          const d = new Date(f.date || "");
          if (isNaN(d.getTime())) return;
          const month = d.toLocaleDateString("pt-BR", { month: "short" });
          if (!months[month]) months[month] = { name: month, mrr: 0 };
          months[month].mrr += f.value;
        } catch {}
      });
    return Object.values(months);
  }, [financeEntries]);

  const globalMrr = revenueData.reduce((acc, curr) => acc + curr.mrr, 0);

  const handleOpenModules = (tenantName: string) => {
    setSelectedTenant(tenantName);
    const mods = getTenantModules(tenantName);
    setCrmEnabled(mods.crm);
    setSdrEnabled(mods.sdr);
    setAdvDashboardEnabled(mods.advDashboard);
  };

  const handleSaveModules = () => {
    if (selectedTenant) {
      updateTenantModules(selectedTenant, { crm: crmEnabled, sdr: sdrEnabled, advDashboard: advDashboardEnabled });
      toast.success(`Módulos do tenant "${selectedTenant}" atualizados com sucesso!`);
      setSelectedTenant(null);
    }
  };

  return (
    <PageContainer
      title="Gestão de Infraestrutura S.P.Y."
      description="Controle centralizado de instâncias, faturamento e saúde global da plataforma."
      actions={
        <div className="flex gap-2">
          <Button variant="outline" className="h-10 px-4 border-slate-700 bg-slate-800 text-slate-300 hover:text-white" disabled>
            <Bell className="w-4 h-4 mr-2" /> Alertas
          </Button>
          <Button
            onClick={() => setIsCreateTenantOpen(true)}
            className="h-10 px-4 bg-blue-600 hover:bg-blue-500 text-white font-black shadow-lg"
          >
            <Plus className="w-4 h-4 mr-2" /> Novo Tenant
          </Button>
        </div>
      }
    >
      {/* Tabs */}
      <div className="flex gap-2 border-b border-[var(--color-border-default)] mb-8 pb-2 overflow-x-auto scrollbar-none">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id ? "bg-blue-600/10 text-blue-600 border border-blue-600/20" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-sunken)]"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "overview" && (
        <AdminOverviewTab globalMrr={globalMrr} revenueData={revenueData} CustomTooltip={CustomTooltip} />
      )}
      {activeTab === "modules" && (
        <div className="pt-1">
          <ConfigModulosDemos />
        </div>
      )}
      {activeTab === "tenants" && (
        <AdminTenantsTab
          onConfigureModules={handleOpenModules}
          onOpenNewTenant={() => setIsCreateTenantOpen(true)}
        />
      )}
      {activeTab === "billing" && (
        <AdminBillingTab revenueData={revenueData} CustomTooltip={CustomTooltip} />
      )}
      {activeTab === "logs" && <AdminLogsTab />}

      {selectedTenant && (
        <ModuleConfigModal
          selectedTenant={selectedTenant}
          setSelectedTenant={setSelectedTenant}
          crmEnabled={crmEnabled}
          setCrmEnabled={setCrmEnabled}
          sdrEnabled={sdrEnabled}
          setSdrEnabled={setSdrEnabled}
          advDashboardEnabled={advDashboardEnabled}
          setAdvDashboardEnabled={setAdvDashboardEnabled}
          handleSaveModules={handleSaveModules}
        />
      )}

      <NovoTenantModal
        isOpen={isCreateTenantOpen}
        onClose={() => setIsCreateTenantOpen(false)}
        onCreated={() => {
          toast.success("Novo Tenant cadastrado com sucesso!");
        }}
      />
    </PageContainer>
  );
}
