import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Activity, Server, DollarSign, TerminalSquare, Bell, Plus, Cpu } from "lucide-react";
import { Button } from "../../components/ui/button";
import { PageContainer } from "../../components/PageContainer";
import { useData } from "../../contexts/DataContext";
import { toast } from "sonner";
import { AdminOverviewTab } from "./components/AdminOverviewTab";
import { AdminBillingTab } from "./components/AdminBillingTab";
import { AdminLogsTab } from "./components/AdminLogsTab";
import { NovoTenantModal } from "./components/NovoTenantModal";
import ConfigModulosDemos from "../settings/ConfigModulosDemos";

const TABS = [
  { id: "overview", label: "Visão Geral", icon: Activity },
  { id: "tenants", label: "Tenants & Módulos", icon: Server },
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
  const normalizedTab = useMemo(() => {
    if (tabFromUrl === "modules" || tabFromUrl === "tenants" || tabFromUrl === "tenants_modules") {
      return "tenants";
    }
    return tabFromUrl || "overview";
  }, [tabFromUrl]);

  const [activeTab, setActiveTab] = useState(normalizedTab);
  const [isCreateTenantOpen, setIsCreateTenantOpen] = useState(false);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  useEffect(() => {
    if (normalizedTab && normalizedTab !== activeTab) {
      setActiveTab(normalizedTab);
    }
  }, [normalizedTab]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  };

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

  return (
    <PageContainer
      title="Gestão de Infraestrutura S.P.Y."
      description="Controle centralizado de instâncias, faturamento e saúde global da plataforma."
      actions={
        <div className="flex gap-2">
          <Button variant="outline" className="h-10 px-4" disabled title="Em breve">
            <Bell className="w-4 h-4 mr-2" /> Alertas
          </Button>
          <Button
            onClick={() => setIsCreateTenantOpen(true)}
            className="h-10 px-4 font-black"
          >
            <Plus className="w-4 h-4 mr-2" /> Novo Tenant
          </Button>
        </div>
      }
    >
      {/* Tabs Bar */}
      <div className="flex items-center gap-1.5 p-1.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] rounded-2xl mb-8 overflow-x-auto scrollbar-none shadow-sm">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? "bg-[var(--color-primary-blue)] text-white shadow-md shadow-[var(--color-primary-blue)]/25"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-sunken)]"
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
      {(activeTab === "tenants" || activeTab === "modules") && (
        <div className="pt-1">
          <ConfigModulosDemos 
            embedded={true} 
            onOpenNewTenant={() => setIsCreateTenantOpen(true)}
            reloadTrigger={reloadTrigger}
          />
        </div>
      )}
      {activeTab === "billing" && (
        <AdminBillingTab revenueData={revenueData} CustomTooltip={CustomTooltip} />
      )}
      {activeTab === "logs" && <AdminLogsTab />}

      <NovoTenantModal
        isOpen={isCreateTenantOpen}
        onClose={() => setIsCreateTenantOpen(false)}
        onCreated={() => {
          toast.success("Novo Tenant cadastrado com sucesso!");
          setReloadTrigger(v => v + 1);
        }}
      />
    </PageContainer>
  );
}
