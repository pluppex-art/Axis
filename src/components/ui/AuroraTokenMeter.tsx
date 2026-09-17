import { cn } from "../../lib/utils";
import { useAuroraTokenUsage } from "../../hooks/useAuroraTokenUsage";

// Mesmo pacote fixo de 10 mil créditos por ciclo usado em ConfigSistemaAuroraUso
// (Configurações > Sistema > Aurora) — o cliente nunca vê "tokens" na tela, só
// créditos e porcentagem; o limite real de bloqueio continua em tokens por trás.
const CREDITS_PER_CYCLE = 10000;

function barColor(percent: number): string {
  if (percent >= 100) return "bg-rose-500";
  if (percent >= 90) return "bg-amber-500";
  return "bg-violet-500";
}

/**
 * Medidor compacto de consumo da Aurora — "igual da Claude": barra fina + porcentagem.
 * Usado no cabeçalho do painel de chat da Aurora (AuroraWidget). Sem limite configurado pro
 * tenant ainda (tokensLimit null) = não renderiza nada, não é bloqueado nem alarma à toa.
 */
export function AuroraTokenMeter({ className }: { className?: string }) {
  const { usage, loading } = useAuroraTokenUsage();

  if (loading || !usage || usage.tokensLimit === null) return null;

  const percent = usage.percentUsed ?? 0;
  const creditsUsed = Math.round((percent / 100) * CREDITS_PER_CYCLE);

  return (
    <div
      className={cn("flex flex-col gap-1 min-w-[92px]", className)}
      title={`${creditsUsed.toLocaleString("pt-BR")} de ${CREDITS_PER_CYCLE.toLocaleString("pt-BR")} créditos usados neste ciclo (${percent.toFixed(1)}%)${usage.planName ? ` — plano ${usage.planName}` : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn("text-[9px] font-bold tabular-nums", usage.limitReached ? "text-rose-400" : percent >= 90 ? "text-amber-400" : "text-slate-500")}>
          {percent.toFixed(1)}%
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
