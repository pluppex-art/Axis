import { Link } from "react-router-dom";
import { Card } from "../../../../components/ui/card";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useLocalization } from "../../../../contexts/LocalizationContext";

interface UpcomingEntry { label: string; date: string; value: string; type: "pagar" | "receber"; }

interface FinanceiroBottomPanelsProps {
  upcomingEntries: UpcomingEntry[];
  cpl: number | null;
  ltvProjetado: number | null;
  margemEbitda: number | null;
}

export function FinanceiroBottomPanels({ upcomingEntries, cpl, ltvProjetado, margemEbitda }: FinanceiroBottomPanelsProps) {
  const { formatCurrency } = useLocalization();
  const fmtBRL = (n: number) => formatCurrency(n);
  const insights = [
    { label: "Custo por Lead (CPL)", value: cpl !== null ? fmtBRL(cpl) : "—" },
    { label: "LTV Projetado (12m)", value: ltvProjetado !== null ? fmtBRL(ltvProjetado) : "—" },
    { label: "Margem Ebitda", value: margemEbitda !== null ? `${margemEbitda.toFixed(1)}%` : "—" },
  ];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="p-6">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Próximos Vencimentos</h3>
        <div className="space-y-1">
          {upcomingEntries.length === 0 ? (
            <div className="py-10 text-center text-xs text-[var(--color-text-faint)] border border-dashed border-[var(--color-border-subtle)] rounded-[var(--radius-control)]">
              Nenhum lançamento a vencer.
            </div>
          ) : upcomingEntries.map((item, i) => (
            <div key={i} className="flex items-center justify-between py-2.5 border-b border-[var(--color-border-subtle)] last:border-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-7 h-7 rounded-[var(--radius-control)] flex items-center justify-center shrink-0 ${item.type === "receber" ? "text-[var(--color-success)] bg-[var(--color-success)]/10" : "text-[var(--color-danger)] bg-[var(--color-danger)]/10"}`}>
                  {item.type === "receber" ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">{item.label}</p>
                  <p className="text-[11px] text-[var(--color-text-faint)]">{item.date}</p>
                </div>
              </div>
              <p className="text-xs font-semibold tabular-nums text-[var(--color-text-primary)] shrink-0 ml-2">{item.value}</p>
            </div>
          ))}
        </div>
        <Link to="/app/financeiro/transacoes" className="block text-center text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] mt-4 pt-3 border-t border-[var(--color-border-subtle)]">
          Ver todas as movimentações
        </Link>
      </Card>

      <Card className="lg:col-span-2 p-6">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-6">Indicadores Operacionais</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {insights.map((insight, idx) => (
            <div key={idx}>
              <p className="text-[11px] text-[var(--color-text-muted)] mb-1">{insight.label}</p>
              <p className="text-lg font-semibold tabular-nums text-[var(--color-text-primary)]">{insight.value}</p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-[var(--color-text-faint)] mt-6 pt-4 border-t border-[var(--color-border-subtle)]">
          Calculado a partir dos lançamentos e leads do período selecionado.
        </p>
      </Card>
    </div>
  );
}
