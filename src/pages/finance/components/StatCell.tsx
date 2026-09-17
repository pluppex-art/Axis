import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../../lib/utils";

interface StatCellProps {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  tone?: "neutral" | "danger" | "warning" | "success";
  hint?: string;
}

const TONE_TEXT: Record<NonNullable<StatCellProps["tone"]>, string> = {
  neutral: "text-[var(--color-text-primary)]",
  danger: "text-[var(--color-danger)]",
  warning: "text-[var(--color-warning)]",
  success: "text-[var(--color-success)]",
};

/** Célula de estatística neutra reutilizada pelas telas de análise do
 * financeiro (Inadimplência, MRR, Projeção...) — irmã mais simples do
 * FinanceiroKpiCard do dashboard, sem link nem delta. */
export function StatCell({ label, value, icon: Icon, tone = "neutral", hint }: StatCellProps) {
  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{label}</span>
        {Icon && <Icon className="w-3.5 h-3.5 text-[var(--color-text-faint)]" />}
      </div>
      <div className={cn("text-2xl font-semibold tabular-nums tracking-tight", TONE_TEXT[tone])}>{value}</div>
      {hint && <p className="text-[11px] text-[var(--color-text-faint)] mt-1">{hint}</p>}
    </div>
  );
}

export function StatCellRow({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-[var(--color-border-default)] border border-[var(--color-border-default)] rounded-[var(--radius-panel)] overflow-hidden [&>div]:bg-[var(--color-surface-elevated)]">
      {children}
    </div>
  );
}
