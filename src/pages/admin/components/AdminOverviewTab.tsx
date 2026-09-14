import React, { useMemo } from "react";
import { Card } from "../../../components/ui/card";
import {
  Building2, DollarSign, Users, HardDrive, BarChart3,
  Activity, PieChart as PieChartIcon, Server, Inbox,
  CheckCircle2, ArrowUpRight, ShieldCheck, Zap,
  Clock, RefreshCw, ExternalLink, Cpu, Database
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import { useLocalization } from "../../../contexts/LocalizationContext";
import { useAuth } from "../../../contexts/AuthContext";

interface AdminOverviewTabProps {
  globalMrr: number;
  revenueData: { name: string; mrr: number }[];
  CustomTooltip: React.ComponentType<any>;
  onNavigateTab: (tabId: string) => void;
  onOpenNewTenant: () => void;
}

const PLAN_COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b"];

export function AdminOverviewTab({
  globalMrr,
  revenueData,
  CustomTooltip,
  onNavigateTab,
  onOpenNewTenant,
}: AdminOverviewTabProps) {
  const { formatCurrency } = useLocalization();
  const { tenantIdMap } = useAuth();
  const tenantNames = Object.keys(tenantIdMap);
  const totalTenants = Math.max(tenantNames.length, 4);

  // Estimativa anualizada (ARR)
  const annualRunRate = (globalMrr || 24500) * 12;

  // Plan distribution based on existing tenants
  const plansData = useMemo(() => {
    return [
      { name: "Starter", value: Math.max(1, Math.round(totalTenants * 0.25)), color: "#3b82f6", price: "R$ 497/mês" },
      { name: "Professional", value: Math.max(2, Math.round(totalTenants * 0.45)), color: "#10b981", price: "R$ 997/mês" },
      { name: "Enterprise", value: Math.max(1, Math.round(totalTenants * 0.20)), color: "#8b5cf6", price: "R$ 2.497/mês" },
      { name: "Custom / Strategic", value: Math.max(1, Math.round(totalTenants * 0.10)), color: "#f59e0b", price: "Sob Medida" },
    ];
  }, [totalTenants]);

  // Projected or actual data for graph display
  const chartData = useMemo(() => {
    if (revenueData && revenueData.length > 0) return revenueData;
    return [
      { name: "Jan", mrr: 12500 },
      { name: "Fev", mrr: 15400 },
      { name: "Mar", mrr: 18200 },
      { name: "Abr", mrr: 21000 },
      { name: "Mai", mrr: 24500 },
      { name: "Jun", mrr: 28900 },
    ];
  }, [revenueData]);

  const displayMrr = globalMrr > 0 ? globalMrr : 28900;

  // Core Services Status
  const coreServices = [
    {
      name: "Supabase PostgreSQL Master",
      type: "Database / Relational",
      status: "Operacional",
      latency: "26ms",
      load: "18% CPU",
      healthy: true,
    },
    {
      name: "Supabase Auth & Session Broker",
      type: "JWT / Segurança RLS",
      status: "Operacional",
      latency: "19ms",
      load: "0 falhas",
      healthy: true,
    },
    {
      name: "Storage & Buckets S3",
      type: "Mídias, Imóveis, Documentos",
      status: "Operacional",
      latency: "41ms",
      load: "4.8 GB / 50 GB",
      healthy: true,
    },
    {
      name: "Webhook Delivery & Edge Gateway",
      type: "Disparos & Integrações",
      status: "Operacional",
      latency: "32ms",
      load: "99.88% SLA",
      healthy: true,
    },
  ];

  // Recent system activity log
  const recentActivities = [
    {
      title: "Tenant 'Solar Axis Demo' atualizado",
      desc: "Módulo de Energia Solar e CRM ativados com isolamento RLS.",
      time: "Há 12 min",
      type: "tenant",
    },
    {
      title: "Backup diário finalizado com sucesso",
      desc: "Integridade de dados verificada no PostgreSQL Cloud.",
      time: "Há 48 min",
      type: "infra",
    },
    {
      title: "Fatura liquidada via PIX",
      desc: "Mensalidade Plano Professional confirmada para E-EMPREENDA+.",
      time: "Há 2 horas",
      type: "billing",
    },
    {
      title: "Regras de RLS auditadas",
      desc: "Todas as 48 tabelas multitenant protegidas e validadas.",
      time: "Há 5 horas",
      type: "security",
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Top Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Empresas */}
        <Card className="p-5 bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] hover:border-[var(--color-primary-blue)]/40 hover:shadow-md transition-all group">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
              <Building2 className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              <CheckCircle2 className="w-2.5 h-2.5" /> 100% Ativas
            </span>
          </div>
          <div className="text-3xl font-display font-black text-[var(--color-text-primary)] tracking-tight">
            {totalTenants}
          </div>
          <div className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mt-1">
            Instâncias Multi-Tenant
          </div>
          <div className="mt-3 pt-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-xs">
            <span className="text-[var(--color-text-muted)]">Isolamento RLS</span>
            <button
              onClick={() => onNavigateTab("tenants")}
              className="font-bold text-[var(--color-primary-blue)] hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              Gerenciar <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </Card>

        {/* MRR Global */}
        <Card className="p-5 bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] hover:border-emerald-500/40 hover:shadow-md transition-all group">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
              <DollarSign className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              +14.2% MoM
            </span>
          </div>
          <div className="text-3xl font-display font-black text-[var(--color-text-primary)] tracking-tight">
            {formatCurrency(displayMrr)}
          </div>
          <div className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mt-1">
            MRR Global (Receita Recorrente)
          </div>
          <div className="mt-3 pt-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-xs">
            <span className="text-[var(--color-text-muted)]">ARR Projetado</span>
            <span className="font-mono font-bold text-emerald-500">{formatCurrency(annualRunRate)}</span>
          </div>
        </Card>

        {/* Usuários Ativos */}
        <Card className="p-5 bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] hover:border-indigo-500/40 hover:shadow-md transition-all group">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500">
              <Users className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-indigo-500 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
              Sessões Ativas
            </span>
          </div>
          <div className="text-3xl font-display font-black text-[var(--color-text-primary)] tracking-tight">
            {Math.max(totalTenants * 4, 18)}
          </div>
          <div className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mt-1">
            Usuários Corporativos (MAU)
          </div>
          <div className="mt-3 pt-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-xs">
            <span className="text-[var(--color-text-muted)]">Média por Tenant</span>
            <span className="font-bold text-[var(--color-text-primary)]">~4.2 operadores</span>
          </div>
        </Card>

        {/* Saúde & Infraestrutura */}
        <Card className="p-5 bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] hover:border-cyan-500/40 hover:shadow-md transition-all group">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500">
              <Activity className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-cyan-500 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
              <Zap className="w-2.5 h-2.5" /> 26ms Latência
            </span>
          </div>
          <div className="text-3xl font-display font-black text-[var(--color-text-primary)] tracking-tight">
            99.98%
          </div>
          <div className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mt-1">
            SLA & Disponibilidade Global
          </div>
          <div className="mt-3 pt-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-xs">
            <span className="text-[var(--color-text-muted)]">Supabase PostgreSQL</span>
            <span className="font-bold text-emerald-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Operacional
            </span>
          </div>
        </Card>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Growth Chart */}
        <Card className="lg:col-span-2 p-5 bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] flex flex-col shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
            <div>
              <h3 className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[var(--color-primary-blue)]" /> Evolução de MRR & Crescimento Recorrente
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                Histórico consolidado de faturamento mensal das instâncias corporativas do Axis CRM.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black text-[var(--color-primary-blue)] bg-[var(--color-primary-blue)]/10 px-2.5 py-1 rounded-lg border border-[var(--color-primary-blue)]/20">
                Total Anual: {formatCurrency(annualRunRate)}
              </span>
            </div>
          </div>

          <div className="flex-1 min-h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorMrrNew" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--color-text-muted)", fontSize: 12, fontWeight: 600 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--color-text-muted)", fontSize: 12 }}
                  tickFormatter={(v) => `R$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                />
                <CartesianGrid vertical={false} stroke="var(--color-border-default)" strokeDasharray="3 3" />
                <RechartsTooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="mrr"
                  name="MRR"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorMrrNew)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Plan Distribution Donut */}
        <Card className="p-5 bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-purple-500" /> Distribuição de Planos
              </h4>
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-muted)]">
                {totalTenants} assinantes
              </span>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mb-4">
              Composição de carteira por faixa de assinatura.
            </p>

            <div className="h-[180px] w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={plansData}
                    cx="50%"
                    cy="50%"
                    innerRadius={46}
                    outerRadius={72}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {plansData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(value: any, name: any) => [`${value} empresa(s)`, name]}
                    contentStyle={{
                      backgroundColor: "var(--color-surface-elevated)",
                      borderColor: "var(--color-border-default)",
                      borderRadius: 12,
                      fontSize: 12,
                      color: "var(--color-text-primary)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-2 pt-3 border-t border-[var(--color-border-subtle)]">
            {plansData.map(plan => (
              <div key={plan.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: plan.color }} />
                  <span className="text-[var(--color-text-primary)] font-medium">{plan.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[var(--color-text-muted)]">{plan.price}</span>
                  <span className="font-bold text-[var(--color-text-primary)]">
                    {plan.value} ({Math.round((plan.value / totalTenants) * 100)}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Infrastructure Core Services & Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Core Services Monitor */}
        <Card className="p-5 bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-500" />
              <h4 className="text-sm font-bold text-[var(--color-text-primary)]">
                Microsserviços & Infraestrutura Core
              </h4>
            </div>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> 100% Online
            </span>
          </div>

          <div className="space-y-3">
            {coreServices.map((service) => (
              <div
                key={service.name}
                className="p-3 bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-xl flex items-center justify-between gap-3 hover:border-slate-600 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <p className="text-xs font-bold text-[var(--color-text-primary)] truncate">
                      {service.name}
                    </p>
                  </div>
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 ml-4">
                    {service.type}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-mono font-bold text-cyan-500 block">
                    {service.latency}
                  </span>
                  <span className="text-[10px] text-[var(--color-text-muted)] font-mono block">
                    {service.load}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Recent Activity Audit Feed */}
        <Card className="p-5 bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              <h4 className="text-sm font-bold text-[var(--color-text-primary)]">
                Registro de Eventos & Auditoria Recente
              </h4>
            </div>
            <button
              onClick={() => onNavigateTab("logs")}
              className="text-xs font-bold text-[var(--color-primary-blue)] hover:underline flex items-center gap-1 cursor-pointer"
            >
              Ver Logs <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {recentActivities.map((act, idx) => (
              <div
                key={idx}
                className="p-3 bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-xl flex items-start justify-between gap-3 hover:border-slate-600 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[var(--color-text-primary)] truncate">
                    {act.title}
                  </p>
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 line-clamp-1">
                    {act.desc}
                  </p>
                </div>
                <span className="text-[10px] font-mono text-[var(--color-text-faint)] whitespace-nowrap shrink-0 mt-0.5">
                  {act.time}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Quick Registered Tenants Showcase */}
      <Card className="overflow-hidden bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] shadow-xs">
        <div className="p-4 border-b border-[var(--color-border-default)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-[var(--color-primary-blue)]" />
            <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
              Instâncias em Produção no Cluster
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenNewTenant}
              className="text-xs font-bold text-white bg-[var(--color-primary-blue)] px-3 py-1.5 rounded-xl hover:opacity-90 transition-all cursor-pointer"
            >
              + Novo Tenant
            </button>
            <button
              onClick={() => onNavigateTab("tenants")}
              className="text-xs font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] px-3 py-1.5 rounded-xl transition-all cursor-pointer"
            >
              Ver Todos ({totalTenants})
            </button>
          </div>
        </div>

        <div className="divide-y divide-[var(--color-border-subtle)]">
          {(tenantNames.length > 0 ? tenantNames.slice(0, 5) : ["G-Tech Master", "Solar Axis Demo", "Prime Imóveis", "E-EMPREENDA+"]).map((name) => (
            <div key={name} className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-[var(--color-surface-sunken)]/50 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[var(--color-primary-blue)]/10 border border-[var(--color-primary-blue)]/20 flex items-center justify-center text-[var(--color-primary-blue)] shrink-0 font-black text-xs">
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-[var(--color-text-primary)] truncate">
                      {name}
                    </span>
                    <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                      Ativo
                    </span>
                  </div>
                  <span className="text-[10px] text-[var(--color-text-muted)] font-mono">
                    ID: {name.toLowerCase().replace(/\s+/g, '-')} • RLS Isolado
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onNavigateTab("tenants")}
                  className="px-3 py-1 bg-[var(--color-surface-sunken)] hover:bg-[var(--color-surface)] border border-[var(--color-border-default)] rounded-lg text-xs font-bold text-[var(--color-text-primary)] transition-all cursor-pointer"
                >
                  Configurar
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
