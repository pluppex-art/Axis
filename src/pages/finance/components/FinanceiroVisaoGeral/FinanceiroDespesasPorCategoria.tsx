import { Card } from "../../../../components/ui/card";
import { PieChart as PieChartIcon } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { useLocalization } from "../../../../contexts/LocalizationContext";

export interface CategoriaGasto { nome: string; valor: number }

const CORES = ["#f43f5e", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#06b6d4", "#8b5cf6", "#ec4899"];

/**
 * Despesas por Categoria do ciclo selecionado no Painel Financeiro — nenhuma
 * tela do módulo tinha essa quebra por categoria fora do DRE (que só mostra
 * a estrutura de lucratividade agregada, sem listar categoria por categoria).
 * Top 6 + "Outras" agrupadas, pra não virar uma lista infinita quando o
 * tenant tem muitas categorias cadastradas.
 */
export function FinanceiroDespesasPorCategoria({ categorias }: { categorias: CategoriaGasto[] }) {
  const { formatCurrency } = useLocalization();

  const ordenadas = [...categorias].filter(c => c.valor > 0).sort((a, b) => b.valor - a.valor);
  const top = ordenadas.slice(0, 6);
  const outras = ordenadas.slice(6).reduce((s, c) => s + c.valor, 0);
  const chartData = outras > 0 ? [...top, { nome: "Outras", valor: outras }] : top;

  return (
    <Card className="p-6">
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
        <PieChartIcon className="w-4 h-4 text-[var(--color-text-faint)]" /> Despesas por Categoria
      </h3>
      {chartData.length === 0 ? (
        <p className="text-xs text-[var(--color-text-faint)] py-6 text-center">Nenhuma despesa paga no período selecionado.</p>
      ) : (
        <div className="w-full" style={{ height: Math.max(140, chartData.length * 34) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis dataKey="nome" type="category" stroke="var(--color-text-muted)" fontSize={11} width={130} tickLine={false} axisLine={false} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ backgroundColor: "var(--color-surface-elevated)", border: "1px solid var(--color-border-default)", borderRadius: "var(--radius-control)" }} itemStyle={{ fontSize: "11px" }} />
              <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => <Cell key={index} fill={CORES[index % CORES.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
