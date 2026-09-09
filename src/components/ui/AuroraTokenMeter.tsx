import { cn } from "../../lib/utils";
import { useAuroraTokenUsage } from "../../hooks/useAuroraTokenUsage";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function barColor(percent: number): string {
  if (percent >= 100) return "bg-rose-500";
  if (percent >= 90) return "bg-amber-500";
  return "bg-violet-500";
}

/**
 * Medidor compacto de uso de tokens — "igual da Claude": barra fina + texto usado/limite.
 * Usado no cabeçalho do painel de chat da Aurora (AuroraWidget). Sem limite configurado pro
 * tenant ainda (tokensLimit null) = não renderiza nada, não é bloqueado nem alarma à toa.
 */
export function AuroraTokenMeter({ className }: { className?: string }) {
  const { usage, loading } = useAuroraTokenUsage();

  if (loading || !usage || usage.tokensLimit === null) return null;

  const percent = usage.percentUsed ?? 0;

  return (
    <div className={cn("flex flex-col gap-1 min-w-[92px]", className)} title={`${usage.tokensUsed.toLocaleString("pt-BR")} de ${usage.tokensLimit.toLocaleString("pt-BR")} tokens usados neste ciclo${usage.planName ? ` — plano ${usage.planName}` : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={cn("text-[9px] font-bold tabular-nums", usage.limitReached ? "text-rose-400" : percent >= 90 ? "text-amber-400" : "text-slate-500")}>
          {formatTokens(usage.tokensUsed)} / {formatTokens(usage.tokensLimit)}
        </span>
      </div>
      <div className="h-1 w-full rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", barColor(percent))}
          style={{ width: `${Math.max(2, percent)}%` }}
        />
      </div>
    </div>
  );
}
