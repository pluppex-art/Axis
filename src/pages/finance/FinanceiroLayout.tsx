import { Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Inbox,
  TrendingUp,
  Wallet,
  TrendingDown,
  Landmark,
  Waves,
  RefreshCw,
  CreditCard,
  Repeat,
  Target,
  FolderTree,
  Users,
  PieChart,
  Handshake,
  BarChart3,
  Repeat2,
  LineChart,
  Receipt,
  AlertTriangle,
  Search,
  Upload,
} from "lucide-react";
import { SectionSidebar, type SectionNavGroup } from "../../components/layout/SectionSidebar";

const groups: SectionNavGroup[] = [
  {
    title: "Visão Geral",
    icon: LayoutDashboard,
    items: [
      { title: "Painel Financeiro", path: "/app/financeiro/dashboard", icon: LayoutDashboard },
      { title: "Busca Financeira", path: "/app/financeiro/busca", icon: Search },
    ],
  },
  {
    title: "Movimentações",
    icon: ArrowLeftRight,
    items: [
      { title: "Todas as Movimentações", path: "/app/financeiro/transacoes", icon: ArrowLeftRight },
      { title: "Contas a Receber", path: "/app/financeiro/receber", icon: TrendingUp },
      { title: "Receitas", path: "/app/financeiro/receitas", icon: Inbox },
      { title: "Contas a Pagar", path: "/app/financeiro/pagar", icon: Wallet },
      { title: "Despesas", path: "/app/financeiro/despesas", icon: TrendingDown },
      { title: "Contratos & Faturas", path: "/app/financeiro/faturas", icon: Receipt },
    ],
  },
  {
    title: "Cobrança",
    icon: Receipt,
    items: [
      { title: "Cobranças", path: "/app/financeiro/cobrancas", icon: Receipt },
      { title: "Inadimplência", path: "/app/financeiro/inadimplencia", icon: AlertTriangle },
    ],
  },
  {
    title: "Caixa e Bancos",
    icon: Landmark,
    items: [
      { title: "Fluxo de Caixa", path: "/app/financeiro/fluxo-caixa", icon: Waves },
      { title: "Conciliação Bancária", path: "/app/financeiro/conciliacao", icon: RefreshCw },
      { title: "Contas Bancárias", path: "/app/financeiro/bancos", icon: CreditCard },
      { title: "Transferências entre Contas", path: "/app/financeiro/transferencias", icon: Repeat },
    ],
  },
  {
    title: "Gestão",
    icon: FolderTree,
    items: [
      { title: "Centros de Custo", path: "/app/financeiro/centros-custo", icon: Target },
      { title: "Plano de Contas", path: "/app/financeiro/plano-contas", icon: FolderTree, soon: true },
      { title: "Orçamentos", path: "/app/financeiro/orcamentos", icon: Target, soon: true },
      { title: "Contatos (Clientes & Fornecedores)", path: "/app/financeiro/contatos", icon: Users },
    ],
  },
  {
    title: "Análises & Relatórios",
    icon: PieChart,
    items: [
      { title: "Central de Relatórios", path: "/app/financeiro/relatorios", icon: BarChart3 },
      { title: "DRE Gerencial", path: "/app/financeiro/dre", icon: PieChart },
      { title: "MRR & Receita Recorrente", path: "/app/financeiro/mrr", icon: Repeat2 },
      { title: "Projeção de Caixa", path: "/app/financeiro/projecao", icon: LineChart },
      { title: "Indicações & Parcerias", path: "/app/financeiro/indicacoes", icon: Handshake },
    ],
  },
  {
    title: "Importação",
    icon: Upload,
    items: [
      { title: "Importar Movimentações", path: "/app/financeiro/importar", icon: Upload },
    ],
  },
];

export default function FinanceiroLayout() {
  return (
    <SectionSidebar heading="Financeiro" subheading="Gestão Financeira" groups={groups}>
      <Outlet />
    </SectionSidebar>
  );
}
