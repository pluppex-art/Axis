import { cn } from "../../lib/utils";

/** Barra de progresso da implantação — verde ao completar, âmbar no meio, cinza no começo. */
export function ImplementationProgressBar({ percent, className }: { percent: number; className?: string }) {
  const tone = percent >= 100 ? "bg-emerald-500" : percent >= 50 ? "bg-[var(--color-primary-blue)]" : "bg-amber-500";
  return (
    <div className={cn("w-full h-1.5 rounded-full bg-[var(--color-surface-sunken)] overflow-hidden", className)}>
      <div className={cn("h-full rounded-full transition-all duration-500", tone)} style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
    </div>
  );
}
