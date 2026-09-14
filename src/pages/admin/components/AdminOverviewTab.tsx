import { Card } from "../../../components/ui/card";
import {
  Building2, DollarSign, Users, HardDrive, BarChart3,
  Activity, PieChart as PieChartIcon, Server, Inbox,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from "recharts";
import { useLocalization } from "../../../contexts/LocalizationContext";
import { useAuth } from "../../../contexts/AuthContext";

interface AdminOverviewTabProps {
  globalMrr: number;
  revenueData: { name: string; mrr: number }[];
  CustomTooltip: React.ComponentType<any>;
}

export function AdminOverviewTab({ globalMrr, revenueData, CustomTooltip }: AdminOverviewTabProps) {
  const { formatCurrency } = useLocalization();
  const { tenantIdMap } = useAuth();
  const tenantNames = Object.keys(tenantIdMap);

  // Sem infraestrutura de analytics de uso (MAU) ou medição de storage hoje —
  // mostrar "—" em vez de um zero que parece dado real, mesma convenção já
  // usada no Churn Rate da aba Faturamento.
  const metricItems = [
    { label: "Total de Empresas", value: String(tenantNames.length), icon: Building2, color: "text-indigo-500" },
    {
      label: "MRR Global (SaaS)",
      value: formatCurrency(globalMrr),
      icon: DollarSign,
      color: "text-emerald-500",
    },
    { label: "Usuários Ativos (MAU)", value: "—", icon: Users, color: "text-blue-500" },
    { label: "Storage System", value: "—", icon: HardDrive, color: "text-amber-500" },
  ];

  return (
    <div className="space-y-6">
      {/* Global SaaS Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricItems.map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="p-6 bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] hover:border-blue-500/30 hover:shadow-md transition-all">
            <Icon className={`w-5 h-5 ${color} mb-4`} />
            <div className="text-2xl font-display font-black text-[var(--color-text-primary)] mb-1 italic">{value}</div>
            <div className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">{label}</div>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-5 flex flex-col bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Evolução de MRR Global
            </h3>
          </div>
          {revenueData.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 min-h-[250px]">
              <Inbox className="w-8 h-8 text-[var(--color-text-faint)]" />
              <span className="text-sm text-[var(--color-text-muted)]">Sem histórico financeiro</span>
            </div>
          ) : (
            <div className="flex-1 min-h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorMrr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#06B6D4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "var(--color-text-muted)", fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--color-text-muted)", fontSize: 12 }} tickFormatter={(v) => `R$${v / 1000}k`} />
                  <CartesianGrid vertical={false} stroke="var(--color-border-default)" />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="mrr" stroke="#06B6D4" strokeWidth={2} fillOpacity={1} fill="url(#colorMrr)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card className="p-5 flex flex-col bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)]" style={{ height: "calc(50% - 12px)" }}>
            <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2 flex items-center gap-2">
              <PieChartIcon className="w-4 h-4" /> Distribuição de Planos
            </h4>
            <div className="flex-1 flex flex-col items-center justify-center gap-3 min-h-[140px]">
              <PieChartIcon className="w-8 h-8 text-[var(--color-text-faint)]" />
              <span className="text-sm text-[var(--color-text-muted)]">Nenhum plano ativo</span>
            </div>
          </Card>

          <Card className="p-5 bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)]" style={{ height: "calc(50% - 12px)" }}>
            <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4" /> Instâncias Core
            </h4>
            <div className="space-y-3">
              {[
                { label: "API Gateway", load: "0%", status: "Idle" },
                { label: "PostgreSQL Master", load: "0%", status: "Idle" },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[var(--color-text-primary)]">{item.label}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">Load: {item.load}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    {item.status}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Card className="overflow-hidden bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)]">
        <div className="p-4 border-b border-[var(--color-border-default)] flex items-center justify-between">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] flex items-center gap-2">
            <Server className="w-4 h-4 text-[var(--color-text-muted)]" /> Empresas Cadastradas
          </h3>
          <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-muted)]">
            {tenantNames.length} no total
          </span>
        </div>
        {tenantNames.length === 0 ? (
          <div className="p-10 flex flex-col items-center justify-center gap-3 text-center">
            <Building2 className="w-8 h-8 text-[var(--color-text-faint)]" />
            <span className="text-sm text-[var(--color-text-muted)]">Nenhuma empresa cadastrada ainda</span>
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border-subtle)]">
            {tenantNames.slice(0, 6).map((name) => (
              <div key={name} className="px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-blue)]/10 border border-[var(--color-primary-blue)]/20 flex items-center justify-center text-[var(--color-primary-blue)] shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <span className="text-sm font-bold text-[var(--color-text-primary)] truncate">{name}</span>
              </div>
            ))}
            {tenantNames.length > 6 && (
              <div className="px-4 py-2.5 text-center text-[11px] font-bold text-[var(--color-text-muted)]">
                +{tenantNames.length - 6} outras empresas — veja o diretório completo na aba "Tenants & Módulos"
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
