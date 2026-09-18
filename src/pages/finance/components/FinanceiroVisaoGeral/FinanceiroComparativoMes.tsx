import { Card } from "../../../../components/ui/card";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useLocalization } from "../../../../contexts/LocalizationContext";
import type { ComparativoLinha } from "../../lib/financeEngine";
import { cn } from "../../../../lib/utils";

const LINHAS_DESPESA = new Set(["Despesas", "Despesas fixas", "Despesas variáveis", "Pessoas", "Impostos"]);

/** Comparativo com o mês anterior — sempre usa o PREVISTO (competência),
 * nunca o realizado, mesmo pra "quanto entrou" (financeEngine.comparativoMesAnterior). */
export function FinanceiroComparativoMes({ linhas }: { linhas: ComparativoLinha[] }) {
  const { formatCurrency } = useLocalization();

  return (
    <Card className="p-6">
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Comparativo com o Mês Anterior</h3>
      <div className="space-y-1">
        {linhas.map(l => {
          const isDespesa = LINHAS_DESPESA.has(l.linha);
          // Receita subindo é bom (verde); despesa subindo é atenção (laranja/warning) — nunca o contrário.
          const isUp = l.variacaoValor > 0;
          const tone = l.variacaoPct === null ? "neutral" : isUp === !isDespesa ? "success" : "warning";
          return (
            <div key={l.linha} className="flex items-center justify-between py-2 border-b border-[var(--color-border-subtle)] last:border-0">
              <span className="text-xs text-[var(--color-text-muted)]">{l.linha}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono tabular-nums text-[var(--color-text-primary)]">{formatCurrency(l.atual)}</span>
                {l.variacaoPct === null ? (
                  <span className="text-[11px] text-[var(--color-text-faint)] w-28 text-right">Sem alteração</span>
                ) : (
                  <span className={cn(
                    "inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums w-28 justify-end",
                    tone === "success" ? "text-[var(--color-success)]" : tone === "warning" ? "text-[var(--color-warning)]" : "text-[var(--color-text-muted)]"
                  )}>
                    {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {formatCurrency(Math.abs(l.variacaoValor))} ({Math.abs(l.variacaoPct).toFixed(0)}%)
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
