import { useMemo, useState } from "react";
import { Button } from "../../components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "../../components/ui/dropdown-menu";
import { Printer, Download, Calendar, Check, Inbox, Wallet, Scale, Repeat2, TrendingUp, TrendingDown, AlertTriangle, Waves } from "lucide-react";
import { useData } from "../../contexts/DataContext";
import { PageContainer } from "../../components/PageContainer";
import { FinanceiroKPIs, type FinanceiroKpiCard } from "./components/FinanceiroVisaoGeral/FinanceiroKPIs";
import { FinanceiroAlertas, type FinanceiroAlertaItem } from "./components/FinanceiroVisaoGeral/FinanceiroAlertas";
import { FinanceiroCashflowChart } from "./components/FinanceiroVisaoGeral/FinanceiroCashflowChart";
import { FinanceiroBottomPanels } from "./components/FinanceiroVisaoGeral/FinanceiroBottomPanels";
import { FinanceiroProjecaoReceita } from "./components/FinanceiroVisaoGeral/FinanceiroProjecaoReceita";
import { downloadCsv } from "../../lib/csvExport";
import { useLocalization } from "../../contexts/LocalizationContext";
import { getMRR, getActiveCustomers, getChurnRate, getRevenueProjection } from "../../lib/revenueMetrics";

const MONTH_NAMES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

type Ciclo = "mes" | "trimestre" | "ano" | "tudo";
const CICLOS: { id: Ciclo; label: string }[] = [
  { id: "mes", label: "Mês Atual" },
  { id: "trimestre", label: "Trimestre Atual" },
  { id: "ano", label: "Ano Atual" },
  { id: "tudo", label: "Tudo" },
];

// `finance_entries.date` nem sempre vem no formato legado DD/MM/AAAA — o
// fluxo de vendas do PDV (finalizar_venda RPC) grava em ISO (AAAA-MM-DD).
// Sem os dois formatos aqui, uma venda paga com data ISO desaparecia de
// todos os totais/gráficos desta tela (só "Tudo" ignora isInCiclo).
function parseEntryDate(dateStr?: string): Date | null {
  if (!dateStr) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (iso) {
    const d = new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  const parts = dateStr.split("/");
  if (parts.length < 3) return null;
  const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  return isNaN(d.getTime()) ? null : d;
}

function isInCiclo(date: Date | null, ciclo: Ciclo, now: Date): boolean {
  if (ciclo === "tudo") return true;
  if (!date) return false;
  if (ciclo === "mes") return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  if (ciclo === "trimestre") {
    const q = Math.floor(now.getMonth() / 3);
    const dq = Math.floor(date.getMonth() / 3);
    return date.getFullYear() === now.getFullYear() && dq === q;
  }
  return date.getFullYear() === now.getFullYear(); // ano
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isInMonth(date: Date | null, year: number, month: number): boolean {
  return !!date && date.getFullYear() === year && date.getMonth() === month;
}

/** `null` = sem base de comparação (mês anterior zerado) — nunca "Infinity%". */
function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

export default function FinanceiroVisaoGeral() {
  const { financeEntries, contracts, leads } = useData();
  const { formatCurrency } = useLocalization();
  const [ciclo, setCiclo] = useState<Ciclo>("mes");

  const cicloEntries = useMemo(() => {
    if (ciclo === "tudo") return financeEntries;
    const now = new Date();
    return financeEntries.filter(f => isInCiclo(parseEntryDate(f.date), ciclo, now));
  }, [financeEntries, ciclo]);

  const { receita, despesa, mrr, receitaAvulsa, clientesAtivos, churnRate } = useMemo(() => {
    const receita = cicloEntries.filter(f => f.type === "Receber" && f.status === "Pago").reduce((s, f) => s + f.value, 0);
    const despesa = cicloEntries.filter(f => f.type === "Pagar"   && f.status === "Pago").reduce((s, f) => s + f.value, 0);
    const mrr = getMRR(contracts);
    // Implantação/Setup é lançado à parte pela reconciliação de propostas
    // (DataContext.tsx syncAcceptedProposal) exatamente pra não entrar no MRR —
    // aqui ela aparece como receita avulsa do período, separada.
    const receitaAvulsa = cicloEntries.filter(f => f.type === "Receber" && f.status === "Pago" && f.category === "Implantação / Setup").reduce((s, f) => s + f.value, 0);
    const clientesAtivos = getActiveCustomers(contracts);
    const churnRate = getChurnRate(contracts);
    return { receita, despesa, mrr, receitaAvulsa, clientesAtivos, churnRate };
  }, [cicloEntries, contracts]);

  const revenueProjection = useMemo(() => getRevenueProjection(contracts), [contracts]);

  // Liquidez = quanto da despesa paga no período a receita paga cobre (100% =
  // cobertura total). Burn Rate = queima de caixa do período (só existe
  // quando a despesa supera a receita — senão não há "queima", há sobra).
  const liquidez = despesa > 0 ? (receita / despesa) * 100 : (receita > 0 ? 100 : null);
  const burnRate = despesa > receita ? despesa - receita : 0;

  // Cartões do topo comparam sempre mês atual vs mês anterior, independente
  // do seletor de ciclo acima (que só afeta o restante do painel) — é o que
  // o card "Receitas · +12,4% vs. mês anterior" pede.
  const kpiCards: FinanceiroKpiCard[] = useMemo(() => {
    const now = new Date();
    const curY = now.getFullYear(), curM = now.getMonth();
    const prevDate = new Date(curY, curM - 1, 1);
    const prevY = prevDate.getFullYear(), prevM = prevDate.getMonth();

    const inCurMonth = (f: typeof financeEntries[number]) => isInMonth(parseEntryDate(f.date), curY, curM);
    const inPrevMonth = (f: typeof financeEntries[number]) => isInMonth(parseEntryDate(f.date), prevY, prevM);

    const receitaMes = financeEntries.filter(f => f.type === "Receber" && f.status === "Pago" && inCurMonth(f)).reduce((s, f) => s + f.value, 0);
    const receitaMesAnt = financeEntries.filter(f => f.type === "Receber" && f.status === "Pago" && inPrevMonth(f)).reduce((s, f) => s + f.value, 0);
    const despesaMes = financeEntries.filter(f => f.type === "Pagar" && f.status === "Pago" && inCurMonth(f)).reduce((s, f) => s + f.value, 0);
    const despesaMesAnt = financeEntries.filter(f => f.type === "Pagar" && f.status === "Pago" && inPrevMonth(f)).reduce((s, f) => s + f.value, 0);
    const resultadoMes = receitaMes - despesaMes;
    const resultadoMesAnt = receitaMesAnt - despesaMesAnt;

    const abertoReceber = financeEntries.filter(f => f.type === "Receber" && (f.status === "A Vencer" || f.status === "Atrasado"));
    const abertoPagar = financeEntries.filter(f => f.type === "Pagar" && (f.status === "A Vencer" || f.status === "Atrasado"));
    const vencidoReceber = financeEntries.filter(f => f.type === "Receber" && f.status === "Atrasado");

    const next30 = new Date(now); next30.setDate(next30.getDate() + 30);
    const previstoReceber30 = financeEntries.filter(f => {
      const d = parseEntryDate(f.date);
      return f.type === "Receber" && f.status === "A Vencer" && d && d >= now && d <= next30;
    }).reduce((s, f) => s + f.value, 0);
    const previstoPagar30 = financeEntries.filter(f => {
      const d = parseEntryDate(f.date);
      return f.type === "Pagar" && f.status === "A Vencer" && d && d >= now && d <= next30;
    }).reduce((s, f) => s + f.value, 0);
    const fluxoProjetado30 = previstoReceber30 - previstoPagar30;

    // MRR não tem snapshot histórico por mês salvo em banco — sem isso não dá
    // pra calcular a variação vs. mês anterior sem inventar número, então o
    // card de MRR fica sem delta (deltaPct: null) até essa série existir.
    const mrrAtual = getMRR(contracts);

    return [
      { label: "Receitas do Mês", value: receitaMes, format: "currency", deltaPct: pctChange(receitaMes, receitaMesAnt), deltaGoodWhenUp: true, icon: Inbox, href: "/app/financeiro/receitas" },
      { label: "Despesas do Mês", value: despesaMes, format: "currency", deltaPct: pctChange(despesaMes, despesaMesAnt), deltaGoodWhenUp: false, icon: TrendingDown, href: "/app/financeiro/despesas" },
      { label: "Resultado do Mês", value: resultadoMes, format: "currency", deltaPct: pctChange(resultadoMes, resultadoMesAnt), deltaGoodWhenUp: true, danger: resultadoMes < 0, icon: Scale, href: "/app/financeiro/transacoes" },
      { label: "MRR Ativo", value: mrrAtual, format: "currency", deltaPct: null, deltaGoodWhenUp: true, icon: Repeat2, href: "/app/financeiro/faturas" },
      { label: "Contas a Receber", value: abertoReceber.reduce((s, f) => s + f.value, 0), format: "currency", count: abertoReceber.length, deltaPct: null, deltaGoodWhenUp: null, icon: TrendingUp, href: "/app/financeiro/receber" },
      { label: "Contas a Pagar", value: abertoPagar.reduce((s, f) => s + f.value, 0), format: "currency", count: abertoPagar.length, deltaPct: null, deltaGoodWhenUp: null, icon: Wallet, href: "/app/financeiro/pagar" },
      { label: "Vencido (Inadimplência)", value: vencidoReceber.reduce((s, f) => s + f.value, 0), format: "currency", count: vencidoReceber.length, deltaPct: null, deltaGoodWhenUp: null, danger: vencidoReceber.length > 0, icon: AlertTriangle, href: "/app/financeiro/cobrancas" },
      { label: "Fluxo Projetado (30d)", value: fluxoProjetado30, format: "currency", deltaPct: null, deltaGoodWhenUp: null, danger: fluxoProjetado30 < 0, icon: Waves, href: "/app/financeiro/fluxo-caixa" },
    ];
  }, [financeEntries, contracts]);

  const alertasResumo = useMemo(() => {
    const now = new Date();
    const hojeEntradas = financeEntries.filter(f => {
      const d = parseEntryDate(f.date);
      return f.type === "Receber" && f.status === "Pago" && d && isSameDay(d, now);
    }).reduce((s, f) => s + f.value, 0);
    const hojeSaidas = financeEntries.filter(f => {
      const d = parseEntryDate(f.date);
      return f.type === "Pagar" && f.status === "Pago" && d && isSameDay(d, now);
    }).reduce((s, f) => s + f.value, 0);

    const next7 = new Date(now); next7.setDate(next7.getDate() + 7);
    const aReceber7 = financeEntries.filter(f => {
      const d = parseEntryDate(f.date);
      return f.type === "Receber" && f.status === "A Vencer" && d && d >= now && d <= next7;
    }).reduce((s, f) => s + f.value, 0);
    const aPagar7 = financeEntries.filter(f => {
      const d = parseEntryDate(f.date);
      return f.type === "Pagar" && f.status === "A Vencer" && d && d >= now && d <= next7;
    }).reduce((s, f) => s + f.value, 0);

    const vencidasReceber = financeEntries.filter(f => f.type === "Receber" && f.status === "Atrasado");
    const vencidasPagar = financeEntries.filter(f => f.type === "Pagar" && f.status === "Atrasado");
    const vencendoEm3 = financeEntries.filter(f => {
      const d = parseEntryDate(f.date);
      const in3 = new Date(now); in3.setDate(in3.getDate() + 3);
      return f.status === "A Vencer" && d && d >= now && d <= in3;
    });

    const alertas: FinanceiroAlertaItem[] = [];
    if (vencidasPagar.length > 0) {
      alertas.push({ tone: "danger", href: "/app/financeiro/pagar", text: `${vencidasPagar.length} conta(s) a pagar vencida(s), somando ${formatCurrency(vencidasPagar.reduce((s, f) => s + f.value, 0))}.` });
    }
    if (vencidasReceber.length > 0) {
      alertas.push({ tone: "danger", href: "/app/financeiro/cobrancas", text: `${vencidasReceber.length} cobrança(s) vencida(s), somando ${formatCurrency(vencidasReceber.reduce((s, f) => s + f.value, 0))}.` });
    }
    if (vencendoEm3.length > 0) {
      alertas.push({ tone: "warning", href: "/app/financeiro/transacoes", text: `${formatCurrency(vencendoEm3.reduce((s, f) => s + f.value, 0))} em lançamentos vencem nos próximos 3 dias.` });
    }

    return { hoje: { entradas: hojeEntradas, saidas: hojeSaidas }, proximos7: { aReceber: aReceber7, aPagar: aPagar7 }, alertas };
  }, [financeEntries, formatCurrency]);

  const upcomingEntries = useMemo(() =>
    financeEntries.filter(f => f.status === "A Vencer").slice(0, 4).map(f => ({
      label: f.description,
      date: f.date,
      value: formatCurrency(f.value),
      type: f.type.toLowerCase() as "pagar" | "receber",
    })),
  [financeEntries, formatCurrency]);

  const chartData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const y = d.getFullYear(); const m = d.getMonth();
      const monthEntries = financeEntries.filter(f => {
        const fd = parseEntryDate(f.date);
        return !!fd && fd.getFullYear() === y && fd.getMonth() === m;
      });
      const rec = monthEntries.filter(f => f.type === "Receber" && f.status === "Pago").reduce((s, f) => s + f.value, 0);
      const des = monthEntries.filter(f => f.type === "Pagar"   && f.status === "Pago").reduce((s, f) => s + f.value, 0);
      return { name: MONTH_NAMES[m], receita: rec, despesa: des };
    });
  }, [financeEntries]);

  const operationalInsights = useMemo(() => {
    const marketingSpend = financeEntries
      .filter(f => f.type === "Pagar" && f.status === "Pago" && (f.category?.toLowerCase().includes("marketing") || f.category?.toLowerCase().includes("anúncio")))
      .reduce((s, f) => s + f.value, 0);
    const cpl = leads.length > 0 ? marketingSpend / leads.length : null;
    const ltvProjetado = mrr > 0 ? mrr * 12 : null;
    const margemEbitda = receita > 0 ? ((receita - despesa) / receita) * 100 : null;
    return { cpl, ltvProjetado, margemEbitda };
  }, [financeEntries, leads, mrr, receita, despesa]);

  const handleExport = () => {
    downloadCsv(
      `painel_financeiro_${ciclo}_${Date.now()}.csv`,
      ["Descrição", "Tipo", "Valor", "Status", "Data"],
      cicloEntries.map(f => [f.description, f.type, f.value, f.status, f.date])
    );
  };

  return (
    <PageContainer
      title="Painel Financeiro"
      description="Saúde financeira, fluxo de caixa, MRR e inadimplência em um só lugar."
      actions={
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="hidden sm:flex print:hidden h-9 px-4 text-xs font-medium gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> {CICLOS.find(c => c.id === ciclo)?.label}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {CICLOS.map(c => (
                <DropdownMenuItem key={c.id} onClick={() => setCiclo(c.id)} className="justify-between">
                  {c.label}
                  {ciclo === c.id && <Check className="w-3.5 h-3.5" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" onClick={() => window.print()} className="print:hidden h-9 px-3 text-xs font-medium" title="Imprimir relatório">
            <Printer className="w-3.5 h-3.5" />
          </Button>
          <Button onClick={handleExport} className="print:hidden h-9 px-4 text-xs font-medium gap-1.5">
            <Download className="w-3.5 h-3.5" /> Exportar
          </Button>
        </div>
      }
    >
      <div className="space-y-4 max-w-[1700px] mx-auto pb-12">
        <FinanceiroKPIs cards={kpiCards} />
        <FinanceiroAlertas {...alertasResumo} />
        <FinanceiroCashflowChart chartData={chartData} liquidez={liquidez} burnRate={burnRate} />
        <FinanceiroProjecaoReceita mrr={mrr} receitaAvulsa={receitaAvulsa} clientesAtivos={clientesAtivos} churnRate={churnRate} projection={revenueProjection} />
        <FinanceiroBottomPanels upcomingEntries={upcomingEntries} {...operationalInsights} />
      </div>
    </PageContainer>
  );
}
