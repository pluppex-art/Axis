import { useMemo, useState } from "react";
import { Button } from "../../components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "../../components/ui/dropdown-menu";
import { Printer, Download, Calendar, Check } from "lucide-react";
import { useData } from "../../contexts/DataContext";
import { PageContainer } from "../../components/PageContainer";
import { FinanceiroKPIs } from "./components/FinanceiroVisaoGeral/FinanceiroKPIs";
import { FinanceiroCashflowChart } from "./components/FinanceiroVisaoGeral/FinanceiroCashflowChart";
import { FinanceiroBottomPanels } from "./components/FinanceiroVisaoGeral/FinanceiroBottomPanels";
import { downloadCsv } from "../../lib/csvExport";

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

export default function FinanceiroVisaoGeral() {
  const { financeEntries, contracts, leads } = useData();
  const [ciclo, setCiclo] = useState<Ciclo>("mes");

  const cicloEntries = useMemo(() => {
    if (ciclo === "tudo") return financeEntries;
    const now = new Date();
    return financeEntries.filter(f => isInCiclo(parseEntryDate(f.date), ciclo, now));
  }, [financeEntries, ciclo]);

  const { receita, despesa, mrr, inadimplencia } = useMemo(() => {
    const receita = cicloEntries.filter(f => f.type === "Receber" && f.status === "Pago").reduce((s, f) => s + f.value, 0);
    const despesa = cicloEntries.filter(f => f.type === "Pagar"   && f.status === "Pago").reduce((s, f) => s + f.value, 0);
    const mrr = contracts.filter(c => c.status === "Ativo").reduce((s, c) => {
      const raw = c.mrr;
      const valStr = typeof raw === "number" ? String(raw) : (raw ?? "0");
      const val = parseFloat(String(valStr).replace(/[^\d]/g, "") || "0") / 100;
      return s + (isNaN(val) ? 0 : val);
    }, 0);
    const entriesPagar = cicloEntries.filter(f => f.type === "Pagar");
    const inadimplencia = entriesPagar.length > 0 ? (entriesPagar.filter(f => f.status === "Atrasado").length / entriesPagar.length) * 100 : 0;
    return { receita, despesa, mrr, inadimplencia };
  }, [cicloEntries, contracts]);

  const upcomingEntries = useMemo(() =>
    financeEntries.filter(f => f.status === "A Vencer").slice(0, 4).map(f => ({
      label: f.description,
      date: f.date,
      value: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(f.value),
      type: f.type.toLowerCase() as "pagar" | "receber",
    })),
  [financeEntries]);

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
      return { name: MONTH_NAMES[m], receita: rec, despesa: des, projection: Math.round(rec * 1.1) };
    });
  }, [financeEntries]);

  const stabilityScore = receita + despesa > 0 ? Math.round((receita / (receita + despesa)) * 100) : 0;

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
      description="Monitoramento avançado de fluxo, MRR, inadimplência e projeção de caixa em tempo real."
      actions={
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="hidden sm:flex print:hidden h-9 px-4 text-xs font-bold gap-1.5 border-[var(--color-border-default)]"
              >
                <Calendar className="w-3.5 h-3.5 text-[var(--color-primary-blue)]" /> {CICLOS.find(c => c.id === ciclo)?.label}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {CICLOS.map(c => (
                <DropdownMenuItem key={c.id} onClick={() => setCiclo(c.id)} className="justify-between">
                  {c.label}
                  {ciclo === c.id && <Check className="w-3.5 h-3.5 text-[var(--color-primary-blue)]" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            onClick={() => window.print()}
            className="print:hidden h-9 px-3 text-xs font-bold border-[var(--color-border-default)]"
            title="Imprimir relatório"
          >
            <Printer className="w-3.5 h-3.5" />
          </Button>
          <Button
            onClick={handleExport}
            className="print:hidden h-9 px-4 text-xs font-bold gap-1.5 shadow-xs"
          >
            <Download className="w-3.5 h-3.5" /> Exportar
          </Button>
        </div>
      }
    >
      <div className="space-y-6 max-w-[1700px] mx-auto pb-12">
        <FinanceiroKPIs receita={receita} despesa={despesa} mrr={mrr} inadimplencia={inadimplencia} />
        <FinanceiroCashflowChart chartData={chartData} stabilityScore={stabilityScore} />
        <FinanceiroBottomPanels upcomingEntries={upcomingEntries} {...operationalInsights} />
      </div>
    </PageContainer>
  );
}
