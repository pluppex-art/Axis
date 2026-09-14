import React, { useState } from "react";
import { Card } from "../../../components/ui/card";
import {
  DollarSign, TrendingDown, Wallet, Download, CheckCircle2,
  Clock, CreditCard, Sparkles, Building2, ArrowUpRight,
  ShieldCheck, AlertCircle, Calendar
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer
} from "recharts";
import { useLocalization } from "../../../contexts/LocalizationContext";
import { Button } from "../../../components/ui/button";
import { toast } from "sonner";

interface AdminBillingTabProps {
  revenueData: { name: string; mrr: number }[];
  CustomTooltip: React.ComponentType<any>;
}

interface TenantSubscription {
  id: string;
  tenantName: string;
  niche: string;
  plan: "Starter" | "Professional" | "Enterprise" | "Custom";
  cycle: "Mensal" | "Anual";
  value: number;
  status: "Pago" | "Pendente" | "Trial";
  nextBilling: string;
  paymentMethod: "Cartão de Crédito" | "Boleto Bancário" | "PIX";
}

const SUBSCRIPTIONS: TenantSubscription[] = [
  {
    id: "sub-1",
    tenantName: "G-Tech Master",
    niche: "Tecnologia",
    plan: "Enterprise",
    cycle: "Anual",
    value: 2497,
    status: "Pago",
    nextBilling: "15/10/2026",
    paymentMethod: "Cartão de Crédito",
  },
  {
    id: "sub-2",
    tenantName: "E-EMPREENDA+",
    niche: "Educação",
    plan: "Professional",
    cycle: "Mensal",
    value: 997,
    status: "Pago",
    nextBilling: "01/10/2026",
    paymentMethod: "PIX",
  },
  {
    id: "sub-3",
    tenantName: "Solar Axis Demo",
    niche: "Solar",
    plan: "Enterprise",
    cycle: "Mensal",
    value: 2497,
    status: "Pago",
    nextBilling: "18/10/2026",
    paymentMethod: "Boleto Bancário",
  },
  {
    id: "sub-4",
    tenantName: "Prime Imóveis",
    niche: "Imobiliária",
    plan: "Professional",
    cycle: "Mensal",
    value: 997,
    status: "Pago",
    nextBilling: "05/10/2026",
    paymentMethod: "Cartão de Crédito",
  },
  {
    id: "sub-5",
    tenantName: "Clínica Vitta Saúde",
    niche: "Clínica",
    plan: "Enterprise",
    cycle: "Anual",
    value: 2497,
    status: "Pago",
    nextBilling: "12/10/2026",
    paymentMethod: "Cartão de Crédito",
  },
  {
    id: "sub-6",
    tenantName: "Auto Motors Prime",
    niche: "Concessionária",
    plan: "Starter",
    cycle: "Mensal",
    value: 497,
    status: "Pendente",
    nextBilling: "20/09/2026",
    paymentMethod: "Boleto Bancário",
  },
];

export function AdminBillingTab({ revenueData, CustomTooltip }: AdminBillingTabProps) {
  const { formatCurrency } = useLocalization();
  const [subscriptions] = useState<TenantSubscription[]>(SUBSCRIPTIONS);

  const mesesComReceita = revenueData.filter(m => m.mrr > 0);
  const totalMrrCalculated = subscriptions.reduce((sum, s) => sum + s.value, 0);
  const arpu = totalMrrCalculated / subscriptions.length;
  const ltvEstimado = arpu * 24; // LTV 24 meses

  // Export to CSV Functionality
  const handleExportCSV = () => {
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
        s.nextBilling
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

  const chartData = revenueData.length > 0 ? revenueData : [
    { name: "Jan", mrr: 14200 },
    { name: "Fev", mrr: 16800 },
    { name: "Mar", mrr: 19500 },
    { name: "Abr", mrr: 22100 },
    { name: "Mai", mrr: 25400 },
    { name: "Jun", mrr: totalMrrCalculated },
  ];

  return (
    <div className="space-y-6">
      {/* Top Financial Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
              <DollarSign className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              MRR Ativo
            </span>
          </div>
          <div className="text-3xl font-display font-black text-[var(--color-text-primary)]">
            {formatCurrency(totalMrrCalculated)}
          </div>
          <div className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mt-1">
            Receita Recorrente Mensal
          </div>
        </Card>

        <Card className="p-5 bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
              <Wallet className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
              Ticket Médio
            </span>
          </div>
          <div className="text-3xl font-display font-black text-[var(--color-text-primary)]">
            {formatCurrency(arpu)}
          </div>
          <div className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mt-1">
            ARPU (Receita por Empresa)
          </div>
        </Card>

        <Card className="p-5 bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-purple-500 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
              24 Meses
            </span>
          </div>
          <div className="text-3xl font-display font-black text-[var(--color-text-primary)]">
            {formatCurrency(ltvEstimado)}
          </div>
          <div className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mt-1">
            LTV Estimado por Cliente
          </div>
        </Card>

        <Card className="p-5 bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-500">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              Retenção 98.4%
            </span>
          </div>
          <div className="text-3xl font-display font-black text-emerald-500">
            0.8%
          </div>
          <div className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mt-1">
            Churn Rate Mensal
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
                Valores consolidados de assinaturas dos tenants parceiros.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-500">
              ARR: {formatCurrency(totalMrrCalculated * 12)}
            </span>
          </div>

          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--color-border-default)" strokeDasharray="3 3" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "var(--color-text-muted)", fontSize: 12, fontWeight: 600 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--color-text-muted)", fontSize: 12 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: "var(--color-surface-sunken)" }} />
                <Bar dataKey="mrr" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Plan Tiers Breakdown */}
        <Card className="p-5 bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] shadow-xs space-y-4">
          <div>
            <h4 className="text-sm font-bold text-[var(--color-text-primary)]">
              Planos & Categorias do SaaS
            </h4>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Tabela de precificação padrão do Axis CRM
            </p>
          </div>

          <div className="space-y-3">
            {[
              { name: "Starter", price: "R$ 497", desc: "CRM Básico, Leads, até 3 operadores", count: "1 empresa", color: "border-blue-500/30" },
              { name: "Professional", price: "R$ 997", desc: "SDR IA, Catálogo, BI, até 10 operadores", count: "2 empresas", color: "border-emerald-500/30" },
              { name: "Enterprise", price: "R$ 2.497", desc: "Módulos Verticais, Ilimitado, SLA 24/7", count: "3 empresas", color: "border-purple-500/30" },
            ].map(p => (
              <div key={p.name} className={`p-3 rounded-xl bg-[var(--color-surface-sunken)] border ${p.color} flex items-center justify-between`}>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-xs text-[var(--color-text-primary)]">{p.name}</span>
                    <span className="text-[10px] text-[var(--color-text-muted)] font-mono">{p.count}</span>
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
                Assinaturas & Cobranças Ativas das Empresas
              </h3>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Gestão financeira direta de mensalidades e status de faturamento por tenant.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="text-xs font-bold"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" /> Exportar CSV
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--color-surface-sunken)] border-b border-[var(--color-border-default)] text-[10px] font-black uppercase tracking-wider text-[var(--color-text-muted)]">
              <tr>
                <th className="py-3 px-4">Empresa / Tenant</th>
                <th className="py-3 px-4">Nicho</th>
                <th className="py-3 px-4">Plano</th>
                <th className="py-3 px-4">Ciclo</th>
                <th className="py-3 px-4">Valor Mensal</th>
                <th className="py-3 px-4">Forma de Pgto</th>
                <th className="py-3 px-4">Próx. Vencimento</th>
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
                  <td className="py-3.5 px-4">
                    <span className="font-bold text-[var(--color-text-primary)]">
                      {sub.plan}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-[var(--color-text-muted)]">
                    {sub.cycle}
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-emerald-500">
                    {formatCurrency(sub.value)}
                  </td>
                  <td className="py-3.5 px-4 text-[var(--color-text-muted)]">
                    {sub.paymentMethod}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[var(--color-text-primary)]">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-[var(--color-text-muted)]" /> {sub.nextBilling}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    {sub.status === "Pago" ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Em dia
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/10 border border-amber-500/20 text-amber-500">
                        <Clock className="w-2.5 h-2.5" /> Pendente
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
