import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { PageContainer } from "../../components/PageContainer";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { StatCell, StatCellRow } from "./components/StatCell";
import { Download, Printer, Hash, Layers, TrendingUp, Crown } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, CartesianGrid } from "recharts";
import { useData } from "../../contexts/DataContext";
import { useLocalization } from "../../contexts/LocalizationContext";
import { downloadCsv } from "../../lib/csvExport";
import { parseEntryDate } from "./lib/financeDates";
import { dreTipoDe, categoriesById, type FinanceEntryLike, type FinanceCategoryLike } from "./lib/financeEngine";

type Dimension = "description" | "day" | "dreTipo" | "category" | "tags" | "centroCusto" | "counterparty";
type Periodo = "mes" | "trimestre" | "ano" | "tudo";

interface ReportConfig {
  type: "Pagar" | "Receber";
  dimension: Dimension;
  title: string;
  description: string;
  groupLabel: string;
}

const DRE_TIPO_LABEL: Record<string, string> = {
  DESPESA_FIXA: "Despesa Fixa",
  DESPESA_VARIAVEL: "Despesa Variável",
  PESSOAS: "Pessoas",
  IMPOSTOS: "Impostos",
  RECEBIMENTO: "Recebimento",
};

const REPORT_CONFIGS: Record<string, ReportConfig> = {
  "despesas-descricao": { type: "Pagar", dimension: "description", title: "Despesas por Descrição", description: "Total pago/previsto agrupado por descrição do lançamento.", groupLabel: "Descrição" },
  "despesas-dia": { type: "Pagar", dimension: "day", title: "Despesas por Dia", description: "Total de despesas por dia do período.", groupLabel: "Dia" },
  "despesas-tipo": { type: "Pagar", dimension: "dreTipo", title: "Despesas por Tipo", description: "Total agrupado por linha do DRE (fixa, variável, pessoal, impostos).", groupLabel: "Tipo" },
  "despesas-categoria": { type: "Pagar", dimension: "category", title: "Despesas por Categoria", description: "Total agrupado por categoria financeira.", groupLabel: "Categoria" },
  "despesas-tags": { type: "Pagar", dimension: "tags", title: "Despesas por Tags", description: "Total agrupado por marcador — um lançamento com várias tags aparece em cada uma.", groupLabel: "Tag" },
  "despesas-centro-custo": { type: "Pagar", dimension: "centroCusto", title: "Despesas por Centro de Custo", description: "Total agrupado por centro de custo.", groupLabel: "Centro de Custo" },
  "despesas-fornecedor": { type: "Pagar", dimension: "counterparty", title: "Pago a…", description: "Total agrupado por fornecedor/beneficiário.", groupLabel: "Fornecedor" },
  "recebimentos-descricao": { type: "Receber", dimension: "description", title: "Recebimentos por Descrição", description: "Total recebido/previsto agrupado por descrição do lançamento.", groupLabel: "Descrição" },
  "recebimentos-dia": { type: "Receber", dimension: "day", title: "Recebimentos por Dia", description: "Total de recebimentos por dia do período.", groupLabel: "Dia" },
  "recebimentos-categoria": { type: "Receber", dimension: "category", title: "Recebimentos por Categoria", description: "Total agrupado por categoria financeira.", groupLabel: "Categoria" },
  "recebimentos-tags": { type: "Receber", dimension: "tags", title: "Recebimentos por Tags", description: "Total agrupado por marcador — um lançamento com várias tags aparece em cada uma.", groupLabel: "Tag" },
  "recebimentos-centro-custo": { type: "Receber", dimension: "centroCusto", title: "Recebimentos por Centro de Custo", description: "Total agrupado por centro de custo.", groupLabel: "Centro de Custo" },
  "recebimentos-cliente": { type: "Receber", dimension: "counterparty", title: "Recebido de…", description: "Total agrupado por cliente.", groupLabel: "Cliente" },
};

const PERIODOS: { id: Periodo; label: string }[] = [
  { id: "mes", label: "Este Mês" },
  { id: "trimestre", label: "Este Trimestre" },
  { id: "ano", label: "Este Ano" },
  { id: "tudo", label: "Tudo" },
];

function isInPeriodo(date: Date | null, periodo: Periodo, now: Date): boolean {
  if (periodo === "tudo") return true;
  if (!date) return false;
  if (periodo === "mes") return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  if (periodo === "trimestre") return date.getFullYear() === now.getFullYear() && Math.floor(date.getMonth() / 3) === Math.floor(now.getMonth() / 3);
  return date.getFullYear() === now.getFullYear();
}

export default function FinanceiroRelatorioAgrupado() {
  const { slug } = useParams<{ slug: string }>();
  const config = slug ? REPORT_CONFIGS[slug] : undefined;
  const { financeEntries, financeCategories, financeCentrosCusto } = useData();
  const { formatCurrency } = useLocalization();
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [incluirPagos, setIncluirPagos] = useState(true);
  const [incluirNaoPagos, setIncluirNaoPagos] = useState(true);

  const catMap = useMemo(() => categoriesById(financeCategories as FinanceCategoryLike[]), [financeCategories]);
  const centroCustoMap = useMemo(() => new Map((financeCentrosCusto as any[]).map(c => [c.id, c.nome])), [financeCentrosCusto]);

  const linhas = useMemo(() => {
    if (!config) return [];
    const now = new Date();
    const base = (financeEntries as (FinanceEntryLike & any)[]).filter(e => {
      if (e.type !== config.type) return false;
      if (e.status === "Pago" && !incluirPagos) return false;
      if (e.status !== "Pago" && !incluirNaoPagos) return false;
      return isInPeriodo(parseEntryDate(e.date), periodo, now);
    });

    const grupos = new Map<string, { label: string; valor: number; qtd: number }>();
    const addTo = (key: string, label: string, valor: number) => {
      const cur = grupos.get(key) || { label, valor: 0, qtd: 0 };
      cur.valor += valor; cur.qtd += 1;
      grupos.set(key, cur);
    };

    for (const e of base) {
      switch (config.dimension) {
        case "description":
          addTo(e.description || "Sem descrição", e.description || "Sem descrição", e.value);
          break;
        case "day": {
          const d = parseEntryDate(e.date);
          const key = d ? d.toISOString().slice(0, 10) : "sem-data";
          const label = d ? d.toLocaleDateString("pt-BR") : "Sem data";
          addTo(key, label, e.value);
          break;
        }
        case "dreTipo": {
          const tipo = dreTipoDe(e, catMap);
          addTo(tipo, DRE_TIPO_LABEL[tipo] || tipo, e.value);
          break;
        }
        case "category":
          addTo(e.category || "Sem categoria", e.category || "Sem categoria", e.value);
          break;
        case "tags": {
          const tags: string[] = Array.isArray(e.tags) ? e.tags : [];
          if (tags.length === 0) addTo("__sem_tag__", "Sem tag", e.value);
          else tags.forEach(t => addTo(t, t, e.value));
          break;
        }
        case "centroCusto": {
          const nome = e.centro_custo_id ? centroCustoMap.get(e.centro_custo_id) : null;
          addTo(nome || "__sem_cc__", nome || "Sem centro de custo", e.value);
          break;
        }
        case "counterparty":
          addTo(e.counterparty || "__sem_cp__", e.counterparty || (config.type === "Pagar" ? "Sem fornecedor" : "Sem cliente"), e.value);
          break;
      }
    }

    return Array.from(grupos.values()).sort((a, b) => b.valor - a.valor);
  }, [config, financeEntries, catMap, centroCustoMap, periodo, incluirPagos, incluirNaoPagos]);

  const total = linhas.reduce((s, l) => s + l.valor, 0);
  const qtdTotal = linhas.reduce((s, l) => s + l.qtd, 0);
  const media = qtdTotal > 0 ? total / qtdTotal : 0;
  const corBarra = config?.type === "Pagar" ? "var(--color-danger)" : "var(--color-success)";

  const chartData = useMemo(() => {
    const top = linhas.slice(0, 8).map(l => ({ name: l.label, valor: l.valor }));
    const resto = linhas.slice(8).reduce((s, l) => s + l.valor, 0);
    if (resto > 0) top.push({ name: "Outros", valor: resto });
    return top;
  }, [linhas]);

  if (!config) {
    return (
      <PageContainer title="Relatório não encontrado" description="">
        <p className="text-sm text-[var(--color-text-muted)]">
          Este relatório não existe. Volte para a <Link to="/app/financeiro/relatorios" className="text-[var(--color-primary-blue)] hover:underline">Central de Relatórios</Link>.
        </p>
      </PageContainer>
    );
  }

  const handleExport = () => {
    downloadCsv(`${slug}_${Date.now()}.csv`, [config.groupLabel, "Quantidade", "Valor", "% do Total"], linhas.map(l => [l.label, l.qtd, l.valor, total > 0 ? `${((l.valor / total) * 100).toFixed(1)}%` : "0%"]));
  };

  return (
    <PageContainer
      title={config.title}
      description={config.description}
      breadcrumb={[{ label: "Financeiro", path: "/app/financeiro/dashboard" }, { label: "Relatórios", path: "/app/financeiro/relatorios" }, { label: config.title }]}
      actions={
        <div className="flex items-center gap-2 print:hidden">
          <Button variant="outline" onClick={() => window.print()} className="h-9 px-3 text-xs font-medium"><Printer className="w-3.5 h-3.5" /></Button>
          <Button onClick={handleExport} className="h-9 px-4 text-xs font-medium gap-1.5"><Download className="w-3.5 h-3.5" /> Exportar CSV</Button>
        </div>
      }
    >
      <div className="space-y-4 max-w-[1700px] mx-auto pb-12">
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <div className="flex items-center gap-1 bg-[var(--color-surface-sunken)] p-1 rounded-[var(--radius-control)] border border-[var(--color-border-subtle)]">
            {PERIODOS.map(p => (
              <Button key={p.id} size="sm" variant={periodo === p.id ? "default" : "ghost"} onClick={() => setPeriodo(p.id)} className="h-7 px-3 text-xs font-medium">{p.label}</Button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] cursor-pointer">
            <input type="checkbox" checked={incluirPagos} onChange={(e) => setIncluirPagos(e.target.checked)} /> Pagos
          </label>
          <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] cursor-pointer">
            <input type="checkbox" checked={incluirNaoPagos} onChange={(e) => setIncluirNaoPagos(e.target.checked)} /> Não pagos
          </label>
        </div>

        <StatCellRow>
          <StatCell label="Total" value={formatCurrency(total)} icon={TrendingUp} tone={config.type === "Pagar" ? "danger" : "success"} />
          <StatCell label="Lançamentos" value={qtdTotal} icon={Hash} />
          <StatCell label="Média por Lançamento" value={formatCurrency(media)} icon={Layers} />
          <StatCell label={`Maior ${config.groupLabel}`} value={linhas[0] ? formatCurrency(linhas[0].valor) : "—"} hint={linhas[0]?.label} icon={Crown} />
        </StatCellRow>

        {chartData.length > 0 && (
          <Card className="p-6 print:hidden">
            <h3 className="text-xs font-semibold text-[var(--color-text-primary)] mb-4">Distribuição por {config.groupLabel}</h3>
            <div style={{ height: Math.max(180, chartData.length * 34) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 24, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} axisLine={false} tickLine={false} tick={{ fill: "var(--color-text-muted)", fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" width={140} axisLine={false} tickLine={false} tick={{ fill: "var(--color-text-muted)", fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ backgroundColor: "var(--color-surface-elevated)", border: "1px solid var(--color-border-default)", borderRadius: "var(--radius-control)" }} />
                  <Bar dataKey="valor" radius={[0, 4, 4, 0]} maxBarSize={20}>
                    {chartData.map((_, i) => <Cell key={i} fill={corBarra} fillOpacity={i === chartData.length - 1 && chartData[i].name === "Outros" ? 0.4 : 1 - i * 0.06} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        <Card className="overflow-hidden">
          <table className="w-full text-xs text-left">
            <thead className="text-[10px] uppercase font-semibold tracking-wide text-[var(--color-text-muted)] bg-[var(--color-surface-sunken)] border-b border-[var(--color-border-subtle)]">
              <tr>
                <th className="px-6 py-3">{config.groupLabel}</th>
                <th className="px-6 py-3 text-right">Qtd.</th>
                <th className="px-6 py-3 text-right">Valor</th>
                <th className="px-6 py-3 text-right">% do Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {linhas.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-10 text-center text-[var(--color-text-faint)]">Nenhum lançamento no período.</td></tr>
              ) : linhas.map(l => (
                <tr key={l.label} className="hover:bg-[var(--color-surface-sunken)]/50 transition-colors">
                  <td className="px-6 py-3 font-medium text-[var(--color-text-primary)]">{l.label}</td>
                  <td className="px-6 py-3 text-right tabular-nums text-[var(--color-text-muted)]">{l.qtd}</td>
                  <td className="px-6 py-3 text-right tabular-nums font-semibold text-[var(--color-text-primary)]">{formatCurrency(l.valor)}</td>
                  <td className="px-6 py-3 text-right tabular-nums text-[var(--color-text-muted)]">{total > 0 ? `${((l.valor / total) * 100).toFixed(1)}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
            {linhas.length > 0 && (
              <tfoot className="bg-[var(--color-surface-sunken)] border-t border-[var(--color-border-subtle)] font-semibold">
                <tr>
                  <td className="px-6 py-3 text-[var(--color-text-muted)] uppercase text-[10px]">Total</td>
                  <td className="px-6 py-3 text-right tabular-nums">{linhas.reduce((s, l) => s + l.qtd, 0)}</td>
                  <td className="px-6 py-3 text-right tabular-nums">{formatCurrency(total)}</td>
                  <td className="px-6 py-3 text-right">100%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </Card>
      </div>
    </PageContainer>
  );
}
