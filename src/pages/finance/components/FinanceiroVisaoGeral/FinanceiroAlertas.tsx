import { Link } from "react-router-dom";
import { Card } from "../../../../components/ui/card";
import { CheckCircle2 } from "lucide-react";
import { useLocalization } from "../../../../contexts/LocalizationContext";
import { cn } from "../../../../lib/utils";

export interface FinanceiroAlertaItem {
  tone: "danger" | "warning" | "info";
  text: string;
  href: string;
}

const TONE_DOT: Record<FinanceiroAlertaItem["tone"], string> = {
  danger: "bg-[var(--color-danger)]",
  warning: "bg-[var(--color-warning)]",
  info: "bg-[var(--color-success)]",
};

interface FinanceiroAlertasProps {
  hoje: { entradas: number; saidas: number };
  proximos7: { aReceber: number; aPagar: number };
  alertas: FinanceiroAlertaItem[];
}

/**
 * Resumo Inteligente do painel: recorta "hoje" e "próximos 7 dias" a partir
 * dos mesmos finance_entries (nada de número inventado), e lista alertas só
 * quando há de fato algo vencido/vencendo — sem alerta nenhum, a lista some
 * em vez de mostrar uma linha "tudo certo" genérica de novo.
 */
export function FinanceiroAlertas({ hoje, proximos7, alertas }: FinanceiroAlertasProps) {
  const { formatCurrency } = useLocalization();
  const resultadoHoje = hoje.entradas - hoje.saidas;
  const saldoProjetado7 = proximos7.aReceber - proximos7.aPagar;

  return (
    <Card className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <p className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">Hoje</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-text-muted)]">Entradas</span>
              <span className="font-medium tabular-nums text-[var(--color-success)]">{formatCurrency(hoje.entradas)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-text-muted)]">Saídas</span>
              <span className="font-medium tabular-nums text-[var(--color-danger)]">{formatCurrency(hoje.saidas)}</span>
            </div>
            <div className="flex items-center justify-between pt-1.5 border-t border-[var(--color-border-subtle)]">
              <span className="text-[var(--color-text-primary)] font-medium">Resultado</span>
              <span className={cn("font-semibold tabular-nums", resultadoHoje >= 0 ? "text-[var(--color-text-primary)]" : "text-[var(--color-danger)]")}>
                {formatCurrency(resultadoHoje)}
              </span>
            </div>
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">Próximos 7 dias</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-text-muted)]">A receber</span>
              <span className="font-medium tabular-nums text-[var(--color-success)]">{formatCurrency(proximos7.aReceber)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-text-muted)]">A pagar</span>
              <span className="font-medium tabular-nums text-[var(--color-danger)]">{formatCurrency(proximos7.aPagar)}</span>
            </div>
            <div className="flex items-center justify-between pt-1.5 border-t border-[var(--color-border-subtle)]">
              <span className="text-[var(--color-text-primary)] font-medium">Saldo projetado</span>
              <span className={cn("font-semibold tabular-nums", saldoProjetado7 >= 0 ? "text-[var(--color-text-primary)]" : "text-[var(--color-danger)]")}>
                {formatCurrency(saldoProjetado7)}
              </span>
            </div>
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">Atenção</p>
          {alertas.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
              <CheckCircle2 className="w-4 h-4 text-[var(--color-success)] shrink-0" />
              Nenhuma pendência crítica no momento.
            </div>
          ) : (
            <div className="space-y-2">
              {alertas.map((a, i) => (
                <Link key={i} to={a.href} className="flex items-start gap-2 text-sm text-[var(--color-text-primary)] hover:underline">
                  <span className={cn("w-1.5 h-1.5 rounded-full mt-1.5 shrink-0", TONE_DOT[a.tone])} />
                  {a.text}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
