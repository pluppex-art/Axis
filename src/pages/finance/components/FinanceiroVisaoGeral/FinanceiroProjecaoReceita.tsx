import type { ReactNode } from "react";
import { Card } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { TrendingUp, Users, PieChart as PieChartIcon, AlertTriangle } from "lucide-react";
import { useLocalization } from "../../../../contexts/LocalizationContext";
import type { RevenueProjectionResult } from "../../../../lib/revenueMetrics";

interface FinanceiroProjecaoReceitaProps {
  mrr: number;
  receitaAvulsa: number;
  clientesAtivos: number;
  churnRate: number;
  projection: RevenueProjectionResult;
}

/**
 * Receita Recorrente vs Avulsa + projeção real de MRR — separado do resto do
 * painel financeiro porque mistura duas coisas que antes viviam espalhadas e
 * inconsistentes: o "MRR" que cada tela calculava do seu jeito, e uma
 * "projeção" que era só receita do mês * 1.1 (chute fixo, removido do gráfico
 * de fluxo de caixa). Aqui a projeção vem de getRevenueProjection, que só
 * mostra número quando há histórico real o suficiente pra sustentar a conta.
 */
export function FinanceiroProjecaoReceita({ mrr, receitaAvulsa, clientesAtivos, churnRate, projection }: FinanceiroProjecaoReceitaProps) {
  const { formatCurrency } = useLocalization();

  let projectionSection: ReactNode;
  if (projection.insufficientData) {
    projectionSection = (
      <div className="py-8 text-center italic text-[var(--color-text-faint)] text-[10px] font-black uppercase tracking-widest bg-[var(--color-surface-sunken)]/40 rounded-2xl border border-dashed border-[var(--color-border-subtle)]">
        Dados insuficientes para projeção — é preciso pelo menos 2 meses de histórico de contratos.
      </div>
    );
  } else {
    // Cast explícito em vez de depender de narrowing de union discriminada —
    // este projeto roda com strictNullChecks desligado (tsconfig.json), e sem
    // isso o TS não estreita `projection` pro branch `insufficientData: false`
    // mesmo dentro do else de um if/else convencional.
    const { monthlyChurnRate, months } = projection as Extract<RevenueProjectionResult, { insufficientData: false }>;
    projectionSection = (
      <div>
        <p className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mb-3">
          Projeção de MRR (churn mensal observado: {monthlyChurnRate}%)
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {months.map((m) => (
            <div key={m.month} className="bg-[var(--color-surface-sunken)]/60 border border-[var(--color-border-subtle)] rounded-xl p-4 text-center">
              <p className="text-[8px] font-black text-[var(--color-text-faint)] uppercase tracking-widest mb-1">{m.label}</p>
              <p className="text-sm font-black text-[var(--color-text-primary)] font-mono">{formatCurrency(m.mrr)}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <Card className="rounded-3xl p-8 border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)]/80 backdrop-blur-xl mt-6">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <h3 className="font-black flex items-center gap-3 uppercase text-[10px] tracking-[0.2em] text-[var(--color-text-muted)]">
          <TrendingUp className="w-4 h-4 text-emerald-500" /> Receita Recorrente &amp; Projeção
        </h3>
        <Badge className="bg-[var(--color-surface-sunken)] border-[var(--color-border-default)] text-[var(--color-text-muted)] text-[8px] font-black uppercase h-6">
          MRR = só valor recorrente ativo · implantação/setup fica de fora
        </Badge>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-[var(--color-surface-sunken)]/60 border border-[var(--color-border-subtle)] rounded-2xl p-5">
          <p className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mb-1">MRR Ativo</p>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 italic tracking-tighter">{formatCurrency(mrr)}</p>
        </div>
        <div className="bg-[var(--color-surface-sunken)]/60 border border-[var(--color-border-subtle)] rounded-2xl p-5">
          <p className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mb-1 flex items-center gap-1">
            <PieChartIcon className="w-3 h-3" /> Receita Avulsa (Setup)
          </p>
          <p className="text-xl font-black text-[var(--color-text-primary)] italic tracking-tighter">{formatCurrency(receitaAvulsa)}</p>
        </div>
        <div className="bg-[var(--color-surface-sunken)]/60 border border-[var(--color-border-subtle)] rounded-2xl p-5">
          <p className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mb-1 flex items-center gap-1">
            <Users className="w-3 h-3" /> Clientes Ativos
          </p>
          <p className="text-xl font-black text-[var(--color-text-primary)] italic tracking-tighter">{clientesAtivos}</p>
        </div>
        <div className="bg-[var(--color-surface-sunken)]/60 border border-[var(--color-border-subtle)] rounded-2xl p-5">
          <p className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mb-1 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Taxa de Churn
          </p>
          <p className="text-xl font-black text-rose-600 dark:text-rose-400 italic tracking-tighter">{churnRate.toFixed(1)}%</p>
        </div>
      </div>

      {projectionSection}
    </Card>
  );
}
