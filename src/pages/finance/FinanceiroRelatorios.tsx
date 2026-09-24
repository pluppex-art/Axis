import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { PageContainer } from "../../components/PageContainer";
import { Card } from "../../components/ui/card";
import { StatCell, StatCellRow } from "./components/StatCell";
import {
  PieChart, Waves, LineChart, Repeat2, AlertTriangle, Inbox, TrendingDown,
  TrendingUp, Wallet, Target, ArrowUpRight, Calendar, Users, Truck,
  BarChart3, Landmark, Search, ChevronRight, Scale, type LucideIcon,
} from "lucide-react";
import { useData } from "../../contexts/DataContext";
import { useLocalization } from "../../contexts/LocalizationContext";
import { resultadoAtualDoMes, saldoDaConta, transferenciasDaConta, isInMonth, categoriesById, getMonthlyDreSeries, type FinanceEntryLike, type FinanceCategoryLike } from "./lib/financeEngine";
import { cn } from "../../lib/utils";

interface ReportLink { title: string; href: string; icon: LucideIcon; }
interface ReportGroup { title: string; tone: "danger" | "success" | "info" | "neutral"; reports: ReportLink[]; }

const TONE_BADGE: Record<ReportGroup["tone"], string> = {
  danger: "bg-[var(--color-danger)]/10 text-[var(--color-danger)]",
  success: "bg-[var(--color-success)]/10 text-[var(--color-success)]",
  info: "bg-[var(--color-info)]/10 text-[var(--color-info)]",
  neutral: "bg-[var(--color-text-muted)]/10 text-[var(--color-text-muted)]",
};

const TONE_DOT: Record<ReportGroup["tone"], string> = {
  danger: "bg-[var(--color-danger)]",
  success: "bg-[var(--color-success)]",
  info: "bg-[var(--color-info)]",
  neutral: "bg-[var(--color-text-muted)]",
};

const GROUPS: ReportGroup[] = [
  {
    title: "Despesas",
    tone: "danger",
    reports: [
      { title: "Por Descrição", href: "/app/financeiro/relatorios/despesas-descricao", icon: TrendingDown },
      { title: "Por Dia", href: "/app/financeiro/relatorios/despesas-dia", icon: Calendar },
      { title: "Por Tipo", href: "/app/financeiro/relatorios/despesas-tipo", icon: PieChart },
      { title: "Por Categoria", href: "/app/financeiro/relatorios/despesas-categoria", icon: BarChart3 },
      { title: "Por Tags", href: "/app/financeiro/relatorios/despesas-tags", icon: Target },
      { title: "Por Centro de Custo", href: "/app/financeiro/relatorios/despesas-centro-custo", icon: Target },
      { title: "Pago a…", href: "/app/financeiro/relatorios/despesas-fornecedor", icon: Truck },
    ],
  },
  {
    title: "Recebimentos",
    tone: "success",
    reports: [
      { title: "Por Descrição", href: "/app/financeiro/relatorios/recebimentos-descricao", icon: TrendingUp },
      { title: "Por Dia", href: "/app/financeiro/relatorios/recebimentos-dia", icon: Calendar },
      { title: "Por Categoria", href: "/app/financeiro/relatorios/recebimentos-categoria", icon: BarChart3 },
      { title: "Por Tags", href: "/app/financeiro/relatorios/recebimentos-tags", icon: Target },
      { title: "Por Centro de Custo", href: "/app/financeiro/relatorios/recebimentos-centro-custo", icon: Target },
      { title: "Recebido de…", href: "/app/financeiro/relatorios/recebimentos-cliente", icon: Users },
    ],
  },
  {
    title: "Fluxo de Caixa",
    tone: "info",
    reports: [
      { title: "Extrato", href: "/app/financeiro/relatorios/extrato", icon: Landmark },
      { title: "Fluxo de Caixa Diário", href: "/app/financeiro/fluxo-caixa", icon: Waves },
      { title: "Despesas / Receitas", href: "/app/financeiro/transacoes", icon: ArrowUpRight },
      { title: "Demonstrativo (DRE)", href: "/app/financeiro/dre", icon: PieChart },
      { title: "Performance Mensal", href: "/app/financeiro/relatorios/performance-mensal", icon: LineChart },
      { title: "Performance Anual", href: "/app/financeiro/relatorios/performance-anual", icon: BarChart3 },
      { title: "Saldos", href: "/app/financeiro/bancos", icon: Wallet },
    ],
  },
];

const EXTRAS: ReportLink[] = [
  { title: "Inadimplência", href: "/app/financeiro/inadimplencia", icon: AlertTriangle },
  { title: "MRR & Receita Recorrente", href: "/app/financeiro/mrr", icon: Repeat2 },
  { title: "Fluxo de Caixa Projetado", href: "/app/financeiro/projecao", icon: Waves },
  { title: "Busca Financeira", href: "/app/financeiro/busca", icon: Search },
  { title: "Importar Movimentações", href: "/app/financeiro/importar", icon: Inbox },
];

export default function FinanceiroRelatorios() {
  const { financeEntries, financeBankAccounts, financeTransfers, financeCategories } = useData();
  const { formatCurrency } = useLocalization();

  const catMap = useMemo(() => categoriesById(financeCategories as FinanceCategoryLike[]), [financeCategories]);
  const monthlySeries = useMemo(() => getMonthlyDreSeries(financeEntries as FinanceEntryLike[], catMap, 6), [financeEntries, catMap]);

  const kpis = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const receitaMes = (financeEntries as FinanceEntryLike[]).filter(e => e.type === "Receber" && e.status === "Pago" && isInMonth(e.date, y, m)).reduce((s, e) => s + e.value, 0);
    const despesaMes = (financeEntries as FinanceEntryLike[]).filter(e => e.type === "Pagar" && e.status === "Pago" && isInMonth(e.date, y, m)).reduce((s, e) => s + e.value, 0);
    const resultadoMes = resultadoAtualDoMes(financeEntries as FinanceEntryLike[], now);
    const saldoEmContas = (financeBankAccounts as any[]).filter(c => !c.arquivada).reduce((s, conta) => {
      const entriesDaConta = (financeEntries as FinanceEntryLike[]).filter((e: any) => e.conta_bancaria_id === conta.id);
      const { recebidas, enviadas } = transferenciasDaConta(financeTransfers as any[], conta.id);
      return s + saldoDaConta({ saldoInicial: conta.saldo_inicial, sinalSaldoInicial: conta.sinal_saldo_inicial, entriesDaConta, transferenciasRecebidasPagas: recebidas, transferenciasEnviadasPagas: enviadas });
    }, 0);
    return { receitaMes, despesaMes, resultadoMes, saldoEmContas };
  }, [financeEntries, financeBankAccounts, financeTransfers]);

  return (
    <PageContainer
      title="Central de Relatórios"
      description="Todos os relatórios financeiros disponíveis, organizados por área."
      breadcrumb={[{ label: "Financeiro", path: "/app/financeiro/dashboard" }, { label: "Central de Relatórios" }]}
    >
      <div className="space-y-8 max-w-[1700px] mx-auto pb-12">
        <StatCellRow>
          <StatCell label="Receitas do Mês" value={formatCurrency(kpis.receitaMes)} icon={TrendingUp} tone="success" hint="Regime de caixa" />
          <StatCell label="Despesas do Mês" value={formatCurrency(kpis.despesaMes)} icon={TrendingDown} tone="danger" hint="Regime de caixa" />
          <StatCell label="Resultado do Mês" value={formatCurrency(kpis.resultadoMes)} icon={Scale} tone={kpis.resultadoMes < 0 ? "danger" : "neutral"} />
          <StatCell label="Saldo em Contas" value={formatCurrency(kpis.saldoEmContas)} icon={Wallet} tone={kpis.saldoEmContas < 0 ? "danger" : "neutral"} />
        </StatCellRow>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[var(--color-text-faint)]" /> Receita x Despesa — Últimos 6 Meses
            </h3>
            <Link to="/app/financeiro/dre" className="text-[11px] font-semibold text-[var(--color-primary-blue)] hover:underline flex items-center gap-0.5">
              Ver DRE completo <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthlySeries} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
                <XAxis dataKey="label" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ backgroundColor: "var(--color-surface-elevated)", border: "1px solid var(--color-border-default)", borderRadius: "var(--radius-control)" }} itemStyle={{ fontSize: "11px" }} />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Bar dataKey="receitaBruta" name="Receita" fill="var(--color-success)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesaTotal" name="Despesa" fill="var(--color-danger)" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="lucroLiquido" name="Lucro Líquido" stroke="var(--color-primary-blue)" strokeWidth={2.5} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {GROUPS.map(group => (
          <div key={group.title}>
            <div className="flex items-center gap-2 mb-3">
              <span className={cn("w-1.5 h-1.5 rounded-full", TONE_DOT[group.tone])} />
              <h3 className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{group.title}</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {group.reports.map(report => {
                const Icon = report.icon;
                return (
                  <Link key={report.title} to={report.href}>
                    <Card className="p-4 h-full hover:border-[var(--color-text-muted)] hover:shadow-[var(--shadow-panel)] transition-all group flex items-center gap-3">
                      <span className={cn("w-8 h-8 rounded-[var(--radius-control)] flex items-center justify-center shrink-0", TONE_BADGE[group.tone])}>
                        <Icon className="w-4 h-4" />
                      </span>
                      <h4 className="text-xs font-medium text-[var(--color-text-primary)] flex-1">{report.title}</h4>
                      <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-faint)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)]" />
            <h3 className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Análises &amp; Ferramentas</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {EXTRAS.map(report => {
              const Icon = report.icon;
              return (
                <Link key={report.title} to={report.href}>
                  <Card className="p-4 h-full hover:border-[var(--color-text-muted)] hover:shadow-[var(--shadow-panel)] transition-all group flex items-center gap-3">
                    <span className={cn("w-8 h-8 rounded-[var(--radius-control)] flex items-center justify-center shrink-0", TONE_BADGE.neutral)}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <h4 className="text-xs font-medium text-[var(--color-text-primary)] flex-1">{report.title}</h4>
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-faint)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
