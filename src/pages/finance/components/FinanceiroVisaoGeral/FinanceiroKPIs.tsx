import { Link } from "react-router-dom";
import { Card } from "../../../../components/ui/card";
import { ArrowUpRight, ArrowDownRight, Minus, type LucideIcon } from "lucide-react";
import { useLocalization } from "../../../../contexts/LocalizationContext";
import { cn } from "../../../../lib/utils";

export interface FinanceiroKpiCard {
  label: string;
  value: number;
  format: "currency" | "percent";
  /** Variação percentual vs. o mês anterior. `null` = sem base de comparação (mês anterior zerado). */
  deltaPct: number | null;
  /** Quando a alta do indicador é boa (receita) ou ruim (despesa/vencido). `null` = delta neutro, sem cor. */
  deltaGoodWhenUp: boolean | null;
  /** Colore o próprio valor de vermelho quando negativo/crítico (ex: resultado negativo, vencido > 0). */
  danger?: boolean;
  count?: number;
  icon: LucideIcon;
  href: string;
}

function DeltaBadge({ deltaPct, deltaGoodWhenUp }: { deltaPct: number | null; deltaGoodWhenUp: boolean | null }) {
  if (deltaPct === null) {
    return <span className="text-[11px] font-medium text-[var(--color-text-faint)]">Sem base no mês anterior</span>;
  }
  const isUp = deltaPct > 0;
  const isFlat = Math.abs(deltaPct) < 0.05;
  const isGood = deltaGoodWhenUp === null ? null : deltaGoodWhenUp === isUp;
  const colorClass = isFlat || isGood === null
    ? "text-[var(--color-text-muted)]"
    : isGood
    ? "text-[var(--color-success)]"
    : "text-[var(--color-danger)]";
  const Icon = isFlat ? Minus : isUp ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums", colorClass)}>
      <Icon className="w-3 h-3" />
      {Math.abs(deltaPct).toFixed(1)}% vs. mês anterior
    </span>
  );
}

export function FinanceiroKPIs({ cards }: { cards: FinanceiroKpiCard[] }) {
  const { formatCurrency } = useLocalization();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-[var(--color-border-default)] border border-[var(--color-border-default)] rounded-[var(--radius-panel)] overflow-hidden">
      {cards.map((kpi) => {
        const Icon = kpi.icon;
        const displayValue = kpi.format === "percent" ? `${kpi.value.toFixed(1)}%` : formatCurrency(kpi.value);
        const valueColor = kpi.danger && kpi.value !== 0 ? "text-[var(--color-danger)]" : "text-[var(--color-text-primary)]";
        return (
          <Link key={kpi.label} to={kpi.href} className="group">
            <Card className="rounded-none border-0 p-5 h-full shadow-none bg-[var(--color-surface-elevated)] group-hover:bg-[var(--color-surface-sunken)] transition-colors">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{kpi.label}</span>
                <Icon className="w-3.5 h-3.5 text-[var(--color-text-faint)]" />
              </div>
              <div className={cn("text-2xl font-semibold tabular-nums tracking-tight mb-2", valueColor)}>
                {displayValue}
                {typeof kpi.count === "number" && (
                  <span className="text-xs font-medium text-[var(--color-text-faint)] ml-1.5">({kpi.count})</span>
                )}
              </div>
              <DeltaBadge deltaPct={kpi.deltaPct} deltaGoodWhenUp={kpi.deltaGoodWhenUp} />
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
