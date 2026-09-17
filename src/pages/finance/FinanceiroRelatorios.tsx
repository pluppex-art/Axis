import { Link } from "react-router-dom";
import { PageContainer } from "../../components/PageContainer";
import { Card } from "../../components/ui/card";
import {
  PieChart, Waves, LineChart, Repeat2, AlertTriangle, Inbox, TrendingDown,
  TrendingUp, Wallet, Target, ArrowUpRight, type LucideIcon,
} from "lucide-react";

interface ReportLink {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

interface ReportGroup {
  title: string;
  reports: ReportLink[];
}

const GROUPS: ReportGroup[] = [
  {
    title: "Gerencial",
    reports: [
      { title: "DRE Gerencial", description: "Receita, custos, despesas e resultado por período.", href: "/app/financeiro/dre", icon: PieChart },
      { title: "Fluxo de Caixa", description: "Entradas e saídas realizadas por dia, semana ou mês.", href: "/app/financeiro/fluxo-caixa", icon: Waves },
      { title: "Fluxo de Caixa Projetado", description: "Recebimentos e pagamentos previstos, separados do realizado.", href: "/app/financeiro/projecao", icon: LineChart },
      { title: "MRR & Receita Recorrente", description: "Receita recorrente ativa, churn e projeção de MRR.", href: "/app/financeiro/mrr", icon: Repeat2 },
    ],
  },
  {
    title: "Recebimentos",
    reports: [
      { title: "Contas a Receber", description: "Títulos em aberto, a vencer e vencidos.", href: "/app/financeiro/receber", icon: TrendingUp },
      { title: "Receitas", description: "Receitas recebidas, por categoria e período.", href: "/app/financeiro/receitas", icon: Inbox },
      { title: "Inadimplência", description: "Aging de recebimento e clientes em atraso.", href: "/app/financeiro/inadimplencia", icon: AlertTriangle },
    ],
  },
  {
    title: "Pagamentos",
    reports: [
      { title: "Contas a Pagar", description: "Títulos em aberto, a vencer e vencidos.", href: "/app/financeiro/pagar", icon: Wallet },
      { title: "Despesas", description: "Despesas pagas, por categoria e período.", href: "/app/financeiro/despesas", icon: TrendingDown },
    ],
  },
  {
    title: "Gestão",
    reports: [
      { title: "Centros de Custo", description: "Orçado x realizado por centro de custo.", href: "/app/financeiro/centros-custo", icon: Target },
      { title: "Todas as Movimentações", description: "Extrato completo de lançamentos financeiros.", href: "/app/financeiro/transacoes", icon: ArrowUpRight },
    ],
  },
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {group.reports.map(report => {
                const Icon = report.icon;
                return (
                  <Link key={report.href} to={report.href}>
                    <Card className="p-5 h-full hover:border-[var(--color-text-muted)] transition-colors">
                      <Icon className="w-4 h-4 text-[var(--color-text-faint)] mb-3" />
                      <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">{report.title}</h4>
                      <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{report.description}</p>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </PageContainer>
  );
}
