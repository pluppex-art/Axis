import React, { useEffect, useMemo, useState } from "react";
import { Card } from "../../../components/ui/card";
import {
  DollarSign, TrendingDown, Wallet, Download, CheckCircle2,
  Clock, CreditCard, Sparkles, Building2, ArrowUpRight,
  ShieldCheck, AlertCircle, Calendar, Inbox
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer
} from "recharts";
import { useLocalization } from "../../../contexts/LocalizationContext";
import { useAuth } from "../../../contexts/AuthContext";
import { supabase } from "../../../lib/supabase";
import { Button } from "../../../components/ui/button";
import { toast } from "sonner";

interface AdminBillingTabProps {
  revenueData: { name: string; mrr: number }[];
  CustomTooltip: React.ComponentType<any>;
}

export function AdminBillingTab({ revenueData, CustomTooltip }: AdminBillingTabProps) {
  const { formatCurrency } = useLocalization();
  const { tenantIdMap } = useAuth();

  const tenantNames = Object.keys(tenantIdMap || {});

  // Real revenue calculation
  const mesesComReceita = revenueData.filter(m => m.mrr > 0);
  const totalMrr = revenueData.reduce((sum, m) => sum + m.mrr, 0);
  const arpu = mesesComReceita.length > 0 ? totalMrr / mesesComReceita.length : 0;
  const ltvEstimado = arpu > 0 ? arpu * 12 : 0;

  // `useData().financeEntries` só enxerga o tenant ativo — usar isso aqui
  // fazia todo tenant da lista mostrar o MESMO valor (o do tenant atual),
  // já que o filtro rodava sempre sobre o mesmo array dentro do .map().
  // Esta tela é master-only, então busca direto por tenant_id — RLS
  // (has_tenant_access) já libera a conta master pra ver todos os tenants.
  const [entriesByTenant, setEntriesByTenant] = useState<Record<string, { value: number; count: number }>>({});
  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("finance_entries")
      .select("tenant_id, value")
      .eq("type", "Receber")
      .eq("status", "Pago")
      .then(({ data, error }) => {
        if (error || !data) return;
        const grouped: Record<string, { value: number; count: number }> = {};
        data.forEach((row: any) => {
          const key = row.tenant_id;
          if (!key) return;
          if (!grouped[key]) grouped[key] = { value: 0, count: 0 };
          grouped[key].value += Number(row.value) || 0;
          grouped[key].count += 1;
        });
        setEntriesByTenant(grouped);
      });
  }, []);

  // Real subscriptions derived from active tenants in the database
  const subscriptions = useMemo(() => {
    return tenantNames.map((name, index) => {
      const isMaster = name === "G-Tech Master";
      const tenantId = tenantIdMap[name];
      const agg = tenantId ? entriesByTenant[tenantId] : undefined;
      const tenantValue = agg && agg.count > 0
        ? Math.round(agg.value / agg.count)
        : (isMaster ? 0 : 997);

      return {
        id: `tenant-sub-${index + 1}`,
        tenantName: name,
        niche: isMaster ? "Tecnologia" : "Parceira",
        plan: isMaster ? "Enterprise" : "Professional",
        cycle: "Mensal",
        value: tenantValue,
        status: "Pago",
        nextBilling: "Próximo ciclo",
        paymentMethod: "Faturamento Direto",
      };
    });
  }, [tenantNames, tenantIdMap, entriesByTenant]);

  // Export to CSV Functionality
  const handleExportCSV = () => {
    if (subscriptions.length === 0) {
      toast.info("Nenhuma assinatura cadastrada para exportação.");
      return;
    }

    try {
      const headers = ["ID", "Empresa", "Nicho", "Plano", "Ciclo", "Valor Mensal", "Status", "Forma de Pagamento", "Proxima Cobranca"];
      const rows = subscriptions.map(s => [
        s.id,
        `"${s.tenantName}"`,
        `"${s.niche}"`,
        s.plan,
        s.cycle,
        s.value,
        s.status,
        `"${s.paymentMethod}"`,
        `"${s.nextBilling}"`
      ]);

      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `faturamento_saas_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Relatório de Faturamento exportado com sucesso!");
    } catch {
      toast.error("Não foi possível gerar a exportação CSV.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Financial Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
              <DollarSign className="w-5 h-5" />
            </div>
            {totalMrr > 0 && (
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                MRR Ativo
              </span>
            )}
          </div>
          <div className="text-3xl font-display font-black text-[var(--color-text-primary)]">
            {formatCurrency(totalMrr)}
          </div>
          <div className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mt-1">
            Receita Recorrente Mensal (MRR)
          </div>
        </Card>

        <Card className="p-5 bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
              <Wallet className="w-5 h-5" />
            </div>
            {arpu > 0 && (
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                Ticket Médio
              </span>
            )}
          </div>
          <div className="text-3xl font-display font-black text-[var(--color-text-primary)]">
            {arpu > 0 ? formatCurrency(arpu) : "—"}
          </div>
          <div className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mt-1">
            ARPU (Receita Média por Empresa)
          </div>
        </Card>

        <Card className="p-5 bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500">
              <Sparkles className="w-5 h-5" />
            </div>
            {ltvEstimado > 0 && (
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-500 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                12 Meses
              </span>
            )}
          </div>
          <div className="text-3xl font-display font-black text-[var(--color-text-primary)]">
            {ltvEstimado > 0 ? formatCurrency(ltvEstimado) : "—"}
          </div>
          <div className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mt-1">
            LTV Estimado por Cliente
          </div>
        </Card>

        <Card className="p-5 bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-display font-black text-[var(--color-text-primary)]">
            —
          </div>
          <div className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mt-1">
            Taxa de Churn
          </div>
        </Card>
      </div>

      {/* Revenue Graph & SaaS Plan Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Graph Card */}
        <Card className="lg:col-span-2 p-5 bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                Faturamento Recorrente Mensal (MRR)
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                Receita consolidada de lançamentos financeiros dos tenants.
              </p>
            </div>
            {totalMrr > 0 && (
              <span className="text-xs font-mono font-bold text-emerald-500">
                Total: {formatCurrency(totalMrr)}
              </span>
            )}
          </div>

          {revenueData.length === 0 ? (
            <div className="h-[260px] w-full flex flex-col items-center justify-center gap-3 text-center p-8">
              <DollarSign className="w-8 h-8 text-[var(--color-text-faint)]" />
              <span className="text-sm font-bold text-[var(--color-text-muted)]">Sem dados de faturamento para projeção</span>
              <p className="text-xs text-[var(--color-text-faint)]">
                Lançamentos do tipo Receber com status Pago aparecerão aqui no gráfico.
              </p>
            </div>
          ) : (
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--color-border-default)" strokeDasharray="3 3" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "var(--color-text-muted)", fontSize: 12, fontWeight: 600 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--color-text-muted)", fontSize: 12 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: "var(--color-surface-sunken)" }} />
                  <Bar dataKey="mrr" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Plan Tiers Breakdown */}
        <Card className="p-5 bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] shadow-xs space-y-4">
          <div>
            <h4 className="text-sm font-bold text-[var(--color-text-primary)]">
              Estrutura de Planos do SaaS
            </h4>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Tabela de precificação do Axis CRM
            </p>
          </div>

          <div className="space-y-3">
            {[
              { name: "Starter", price: "R$ 497", desc: "CRM Comercial, Funil e WhatsApp", color: "border-blue-500/30" },
              { name: "Professional", price: "R$ 997", desc: "SDR IA, Catálogo, BI e Automações", color: "border-emerald-500/30" },
              { name: "Enterprise", price: "R$ 2.497", desc: "Módulos Verticais, Ilimitado e SLA 24/7", color: "border-purple-500/30" },
            ].map(p => (
              <div key={p.name} className={`p-3 rounded-xl bg-[var(--color-surface-sunken)] border ${p.color} flex items-center justify-between`}>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-xs text-[var(--color-text-primary)]">{p.name}</span>
                  </div>
                  <span className="text-[10px] text-[var(--color-text-muted)] block mt-0.5">{p.desc}</span>
                </div>
                <div className="text-right">
                  <span className="font-black text-xs text-[var(--color-text-primary)] block">{p.price}</span>
                  <span className="text-[9px] text-[var(--color-text-muted)]">/mês</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Subscriptions Table Card */}
      <Card className="bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] rounded-3xl overflow-hidden shadow-xs">
        <div className="p-5 border-b border-[var(--color-border-default)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[var(--color-primary-blue)]" />
              <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                Assinaturas das Empresas
              </h3>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Relação de empresas cadastradas e status de faturamento.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={subscriptions.length === 0}
              className="text-xs font-bold"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" /> Exportar CSV
            </Button>
          </div>
        </div>

        {subscriptions.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
            <Inbox className="w-10 h-10 text-[var(--color-text-faint)]" />
            <span className="text-sm font-bold text-[var(--color-text-muted)]">Nenhuma empresa ativa para faturamento</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--color-surface-sunken)] border-b border-[var(--color-border-default)] text-[10px] font-black uppercase tracking-wider text-[var(--color-text-muted)]">
                <tr>
                  <th className="py-3 px-4">Empresa / Tenant</th>
                  <th className="py-3 px-4">Nicho</th>
                  <th className="py-3 px-4">Plano</th>
                  <th className="py-3 px-4">Ciclo</th>
                  <th className="py-3 px-4">Valor</th>
                  <th className="py-3 px-4">Forma de Pgto</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-subtle)]">
                {subscriptions.map(sub => (
                  <tr key={sub.id} className="hover:bg-[var(--color-surface-sunken)]/50 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-[var(--color-text-primary)]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-[var(--color-primary-blue)]/10 border border-[var(--color-primary-blue)]/20 flex items-center justify-center text-[var(--color-primary-blue)] font-bold">
                          <Building2 className="w-3.5 h-3.5" />
                        </div>
                        <span>{sub.tenantName}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[var(--color-text-muted)] font-medium">
                      {sub.niche}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-[var(--color-text-primary)]">
                      {sub.plan}
                    </td>
                    <td className="py-3.5 px-4 text-[var(--color-text-muted)]">
                      {sub.cycle}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-500">
                      {sub.value > 0 ? formatCurrency(sub.value) : "Cortesia / Master"}
                    </td>
                    <td className="py-3.5 px-4 text-[var(--color-text-muted)]">
                      {sub.paymentMethod}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Ativo
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
