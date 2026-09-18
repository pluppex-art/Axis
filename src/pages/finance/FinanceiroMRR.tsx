import { useMemo } from "react";
import { PageContainer } from "../../components/PageContainer";
import { Card } from "../../components/ui/card";
import { Repeat2, Users, TrendingDown, Percent, Layers } from "lucide-react";
import { useData } from "../../contexts/DataContext";
import { useLocalization } from "../../contexts/LocalizationContext";
import { StatCell, StatCellRow } from "./components/StatCell";
import {
  getMRR,
  getLostMRR,
  getActiveCustomers,
  getActiveContractsCount,
  getChurnRate,
  getRevenueProjection,
} from "../../lib/revenueMetrics";

export default function FinanceiroMRR() {
  const { contracts } = useData();
  const { formatCurrency } = useLocalization();

  const { mrr, arr, lostMrr, clientesAtivos, contratosAtivos, churnRate, ticketMedio, ativos } = useMemo(() => {
    const mrr = getMRR(contracts);
    const clientesAtivos = getActiveCustomers(contracts);
    const isActive = (c: typeof contracts[number]) => c.status !== "Cancelado" && c.status !== "Perdido";
    return {
      mrr,
      arr: mrr * 12,
      lostMrr: getLostMRR(contracts),
      clientesAtivos,
      contratosAtivos: getActiveContractsCount(contracts),
      churnRate: getChurnRate(contracts),
      ticketMedio: clientesAtivos > 0 ? mrr / clientesAtivos : 0,
      ativos: contracts.filter(isActive).sort((a, b) => (Number(b.mrr) || 0) - (Number(a.mrr) || 0)),
    };
  }, [contracts]);

  const projection = useMemo(() => getRevenueProjection(contracts), [contracts]);

  return (
    <PageContainer
      title="MRR & Receita Recorrente"
      description="Receita recorrente ativa, separada de qualquer projeção — realizado e projetado nunca se misturam aqui."
      breadcrumb={[{ label: "Financeiro", path: "/app/financeiro/dashboard" }, { label: "MRR & Receita Recorrente" }]}
    >
      <div className="space-y-4 max-w-[1700px] mx-auto pb-12">
        <StatCellRow>
          <StatCell label="MRR Ativo" value={formatCurrency(mrr)} icon={Repeat2} />
          <StatCell label="ARR (Projetado a 12m no ritmo atual)" value={formatCurrency(arr)} icon={Layers} />
          <StatCell label="Clientes Ativos" value={clientesAtivos} icon={Users} />
          <StatCell label="Ticket Médio" value={formatCurrency(ticketMedio)} icon={Percent} />
        </StatCellRow>
        <StatCellRow>
          <StatCell label="Contratos Ativos" value={contratosAtivos} icon={Layers} />
          <StatCell label="MRR Perdido (Cancelados)" value={formatCurrency(lostMrr)} icon={TrendingDown} tone={lostMrr > 0 ? "danger" : "neutral"} />
          <StatCell label="Taxa de Churn (Geral)" value={`${churnRate.toFixed(1)}%`} icon={TrendingDown} tone={churnRate > 0 ? "warning" : "neutral"} />
          <StatCell label="Receita Recorrente / Cliente" value={formatCurrency(ticketMedio)} icon={Percent} />
        </StatCellRow>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Projeção de MRR</h3>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-warning)] border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 rounded px-2 py-0.5">
              Projetado — não é receita recebida
            </span>
          </div>
          {projection.insufficientData ? (
            <p className="text-xs text-[var(--color-text-faint)] mt-4">
              Dados insuficientes para projeção — é preciso pelo menos 2 meses de histórico de contratos.
            </p>
          ) : (
            <>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-1 mb-4">
                Churn mensal observado nos últimos 3 meses: {(projection as Extract<typeof projection, { insufficientData: false }>).monthlyChurnRate}%
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {(projection as Extract<typeof projection, { insufficientData: false }>).months.map(m => (
                  <div key={m.month} className="border border-[var(--color-border-subtle)] rounded-[var(--radius-control)] p-3 text-center">
                    <p className="text-[10px] text-[var(--color-text-faint)] mb-1">{m.label}</p>
                    <p className="text-sm font-semibold tabular-nums text-[var(--color-text-primary)]">{formatCurrency(m.mrr)}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="p-4 border-b border-[var(--color-border-subtle)]">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Contratos Ativos (Realizado)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-[10px] uppercase font-semibold tracking-wide text-[var(--color-text-muted)] bg-[var(--color-surface-sunken)] border-b border-[var(--color-border-subtle)]">
                <tr>
                  <th className="px-6 py-3">Cliente</th>
                  <th className="px-6 py-3">Plano</th>
                  <th className="px-6 py-3">Início</th>
                  <th className="px-6 py-3 text-right">MRR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-subtle)]">
                {ativos.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-[var(--color-text-faint)]">Nenhum contrato ativo.</td>
                  </tr>
                ) : ativos.map(c => (
                  <tr key={c.id} className="hover:bg-[var(--color-surface-sunken)]/50 transition-colors">
                    <td className="px-6 py-3.5 font-medium text-[var(--color-text-primary)]">{c.client}</td>
                    <td className="px-6 py-3.5 text-[var(--color-text-muted)]">{c.plan}</td>
                    <td className="px-6 py-3.5 text-[var(--color-text-muted)] font-mono">{c.date}</td>
                    <td className="px-6 py-3.5 text-right tabular-nums font-semibold text-[var(--color-text-primary)]">{formatCurrency(Number(c.mrr) || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}
