import { Link } from "react-router-dom";
import { PageContainer } from "../../components/PageContainer";
import { Card } from "../../components/ui/card";
import {
  PieChart, Waves, LineChart, Repeat2, AlertTriangle, Inbox, TrendingDown,
  TrendingUp, Wallet, Target, ArrowUpRight, Calendar, Users, Truck,
  BarChart3, Landmark, Search, type LucideIcon,
} from "lucide-react";

interface ReportLink { title: string; href: string; icon: LucideIcon; }
interface ReportGroup { title: string; reports: ReportLink[]; }

const GROUPS: ReportGroup[] = [
  {
    title: "Despesas",
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
    reports: [
      { title: "Extrato", href: "/app/financeiro/relatorios/extrato", icon: Landmark },
      { title: "Despesas / Receitas", href: "/app/financeiro/transacoes", icon: ArrowUpRight },
      { title: "Histórico", href: "/app/financeiro/transacoes", icon: ArrowUpRight },
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
  return (
    <PageContainer
      title="Central de Relatórios"
      description="Todos os relatórios financeiros disponíveis, organizados por área."
      breadcrumb={[{ label: "Financeiro", path: "/app/financeiro/dashboard" }, { label: "Central de Relatórios" }]}
    >
      <div className="space-y-8 max-w-[1700px] mx-auto pb-12">
        {GROUPS.map(group => (
          <div key={group.title}>
            <h3 className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">{group.title}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {group.reports.map(report => {
                const Icon = report.icon;
                return (
                  <Link key={report.title} to={report.href}>
                    <Card className="p-4 h-full hover:border-[var(--color-text-muted)] transition-colors flex items-center gap-3">
                      <Icon className="w-4 h-4 text-[var(--color-text-faint)] shrink-0" />
                      <h4 className="text-xs font-medium text-[var(--color-text-primary)]">{report.title}</h4>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        <div>
          <h3 className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">Análises &amp; Ferramentas</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {EXTRAS.map(report => {
              const Icon = report.icon;
              return (
                <Link key={report.title} to={report.href}>
                  <Card className="p-4 h-full hover:border-[var(--color-text-muted)] transition-colors flex items-center gap-3">
                    <Icon className="w-4 h-4 text-[var(--color-text-faint)] shrink-0" />
                    <h4 className="text-xs font-medium text-[var(--color-text-primary)]">{report.title}</h4>
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
