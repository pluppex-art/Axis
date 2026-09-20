import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { ResponsiveContainer, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, Area, Line } from 'recharts';
import { BarChart3, RefreshCw, Target, Trophy, Layers, Zap, Briefcase, ChevronDown } from 'lucide-react';
import { useData } from '../../../contexts/DataContext';
import { useLocalization } from '../../../contexts/LocalizationContext';
import { parseCurrencyBR } from '../../../lib/utils';
import { getMRR } from '../../../lib/revenueMetrics';
import type { DashboardSummary } from '../useDashboard';

interface Squad {
  nome: string;
  meta?: number;
  faturamentoAlcancado?: number;
}

interface Contract {
  mrr: string | number;
  status: string;
}

interface StrategicalViewProps {
  comparisonPeriod: 'month' | 'year';
  setComparisonPeriod: (p: 'month' | 'year') => void;
  performanceData: any[];
  squads?: Squad[];
  contracts?: Contract[];
  serverSummary?: DashboardSummary | null;
}

export function StrategicalView({
  comparisonPeriod,
  setComparisonPeriod,
  performanceData,
  squads = [],
  contracts = [],
  serverSummary,
}: StrategicalViewProps) {
  const { leads } = useData();
  const { formatCurrency } = useLocalization();
  const leadsAbertos = leads.filter(l => l.status !== 'Fechado' && l.status !== 'Perdido');
  // Cada métrica abaixo prefere o valor cacheado de GET /api/dashboard/summary
  // (ver useDashboard.ts) quando disponível — mesma fórmula, só calculada no
  // servidor sobre a base inteira do tenant em vez do array já em memória.
  const valorPipelineAberto = serverSummary?.valorPipelineAberto ?? leadsAbertos.reduce((s, l) => s + parseCurrencyBR(l.value), 0);
  const leadsQuentes = serverSummary?.leadsQuentes ?? leadsAbertos.filter(l => (l.scoreIA ?? 0) > 80).length;

  const contratosInadimplentesClient = contracts.filter(c => c.status === 'Inadimplente').length;
  const taxaInadimplencia = serverSummary
    ? (contracts.length > 0 ? serverSummary.taxaInadimplencia : null)
    : (contracts.length > 0 ? (contratosInadimplentesClient / contracts.length) * 100 : null);

  // Compute Goal Meter from real squads
  const totalMeta = squads.reduce((s, sq) => s + (sq.meta || 0), 0);
  const totalAlcancado = squads.reduce((s, sq) => s + (sq.faturamentoAlcancado || 0), 0);
  const goalPct = totalMeta > 0 ? Math.min(100, Math.round((totalAlcancado / totalMeta) * 100)) : 0;

  // Compute real MRR from contracts (camada única de métricas)
  const activeMRR = serverSummary?.mrrAtivo ?? getMRR(contracts);

  const hasSquads = squads.length > 0;
  const hasContracts = contracts.length > 0;
  const [showDetails, setShowDetails] = useState(false);

  return (
    <motion.div
      key="executivo"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="space-y-6 text-left"
    >
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6 bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] relative overflow-hidden shadow-sm">
          <div className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
            <div>
              <h3 className="text-lg font-black text-[var(--color-text-primary)] uppercase tracking-tight flex items-center gap-2.5">
                <BarChart3 className="w-5 h-5 text-[var(--color-primary-blue)]" /> Fluxo de Performance
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-1 font-medium">Correlação entre volume de leads prospectados e faturamento recorrente.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] p-1 rounded-[var(--radius-control)] gap-1">
                {(['MRR', 'Retenção'] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setComparisonPeriod(type === 'MRR' ? 'month' : 'year')}
                    className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all border-none cursor-pointer ${
                      comparisonPeriod === (type === 'MRR' ? 'month' : 'year')
                        ? 'bg-[var(--color-primary-blue)] text-white shadow-xs'
                        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mb-3">
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-[var(--color-primary-blue)]/10 rounded-full border border-[var(--color-primary-blue)]/20">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary-blue)]" />
              <span className="text-[10px] text-[var(--color-primary-blue)] font-bold uppercase tracking-wider">Real</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-cyan-500/10 rounded-full border border-cyan-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 opacity-60" />
              <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold uppercase tracking-wider">Volume de Leads</span>
            </div>
          </div>

          <div className="h-[340px] w-full min-w-0 -mx-2">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300}>
              <AreaChart data={performanceData}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--color-text-faint)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--color-text-faint)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-surface-elevated)',
                    border: '1px solid var(--color-border-default)',
                    borderRadius: '12px',
                    boxShadow: 'var(--shadow-panel)',
                    color: 'var(--color-text-primary)',
                    fontSize: '12px',
                  }}
                  itemStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="vendas" stroke="#2563EB" fillOpacity={1} fill="url(#colorSales)" strokeWidth={3} strokeLinecap="round" />
                <Area type="monotone" dataKey="leads" stroke="#06B6D4" fillOpacity={0} strokeWidth={2.5} strokeDasharray="5 5" name="Volume de Leads" />
                <Line type="stepAfter" dataKey="retention" stroke="#8B5CF6" strokeWidth={2} dot={false} name="Health Index" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-6 bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] relative overflow-hidden h-full flex flex-col shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xs font-black text-[var(--color-text-primary)] uppercase tracking-wider flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-500" /> Medidor de Metas
              </h3>
              <Trophy className="w-4 h-4 text-amber-500" />
            </div>
            <div className="flex-1 flex flex-col justify-center items-center py-4">
              {!hasSquads ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 opacity-50">
                  <Target className="w-8 h-8 text-[var(--color-text-faint)]" />
                  <p className="text-xs font-bold text-[var(--color-text-muted)] text-center">Cadastre squads para visualizar as metas</p>
                </div>
              ) : (
                <>
                  <div className="relative w-44 h-44 mb-6">
                    <svg className="w-full h-full" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="45" fill="none" stroke="var(--color-border-default)" strokeWidth="8" />
                      <motion.circle
                        cx="50" cy="50" r="45"
                        fill="none" stroke="#10b981" strokeWidth="8"
                        strokeDasharray="282.7"
                        initial={{ strokeDashoffset: 282.7 }}
                        animate={{ strokeDashoffset: 282.7 * (1 - goalPct / 100) }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        strokeLinecap="round"
                        transform="rotate(-90 50 50)"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-black text-[var(--color-text-primary)] font-mono">{goalPct}%</span>
                      <span className="text-[10px] text-[var(--color-text-muted)] font-black uppercase">Alcançado</span>
                    </div>
                  </div>
                  <div className="w-full space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-xs text-[var(--color-text-muted)] font-medium">Realizado:</span>
                      </div>
                      <span className="text-xs font-black text-[var(--color-text-primary)]">{formatCurrency(totalAlcancado)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[var(--color-text-faint)]" />
                        <span className="text-xs text-[var(--color-text-muted)] font-medium">Meta Global:</span>
                      </div>
                      <span className="text-xs font-bold text-[var(--color-text-faint)]">{formatCurrency(totalMeta)}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>
      </div>

      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3 bg-[var(--color-surface-elevated)] hover:bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-[var(--radius-panel)] transition-colors text-left cursor-pointer shadow-xs"
        >
          <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-[var(--color-primary-blue)]" />
            {showDetails ? "Ocultar Detalhes Estratégicos" : "Expandir Insights & Snapshot Financeiro"}
          </span>
          <ChevronDown className={`w-4 h-4 text-[var(--color-text-muted)] shrink-0 transition-transform ${showDetails ? "rotate-180" : ""}`} />
        </button>

        {showDetails && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <Card className="p-5 bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] flex flex-col shadow-sm">
              <h3 className="text-xs font-black text-[var(--color-text-muted)] mb-4 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-[var(--color-primary-blue)]" /> Insights de Operação
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-bold text-[var(--color-text-primary)] mb-1 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-500" /> Pipeline em Aberto
                  </p>
                  <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
                    {leadsAbertos.length} lead(s) em negociação, somando {formatCurrency(valorPipelineAberto)}.
                  </p>
                </div>
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-[var(--radius-control)]">
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-0.5">Oportunidade Mapeada</p>
                  <p className="text-[11px] text-[var(--color-text-muted)]">
                    {leadsQuentes > 0
                      ? `${leadsQuentes} lead(s) quente(s) com Score IA > 80 aguardando follow-up.`
                      : "Nenhum lead com Score IA > 80 em aberto no momento."}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="lg:col-span-3 p-6 bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xs font-black text-[var(--color-text-primary)] uppercase tracking-wider flex items-center gap-2.5">
                  <Briefcase className="w-4 h-4 text-purple-500" /> Snapshot de Contratos & Retenção
                </h3>
                {taxaInadimplencia !== null && (
                  <Badge variant={taxaInadimplencia > 0 ? "destructive" : "success"} dot>
                    {taxaInadimplencia === 0 ? "Sem inadimplência" : `${taxaInadimplencia.toFixed(1)}% inadimplente`}
                  </Badge>
                )}
              </div>
              <div className="grid md:grid-cols-3 gap-6">
                {!hasContracts ? (
                  <div className="col-span-3 flex flex-col items-center justify-center py-6 gap-2 opacity-50">
                    <Briefcase className="w-6 h-6 text-[var(--color-text-faint)]" />
                    <p className="text-xs font-medium text-[var(--color-text-muted)]">Cadastre contratos para ver as métricas financeiras</p>
                  </div>
                ) : (
                  [
                    { label: "MRR Ativo", value: formatCurrency(activeMRR), desc: "Contratos ativos em execução", color: "text-emerald-600 dark:text-emerald-400" },
                    { label: "Contratos Ativos", value: contracts.filter(c => c.status === 'Ativo').length.toString(), desc: "Carteira de clientes recorrentes", color: "text-[var(--color-primary-blue)]" },
                    { label: "Ticket Médio", value: contracts.filter(c => c.status === 'Ativo').length > 0 ? formatCurrency(activeMRR / contracts.filter(c => c.status === 'Ativo').length) : formatCurrency(0), desc: "Receita média por contrato", color: "text-purple-600 dark:text-purple-400" },
                  ].map((item, i) => (
                    <div key={i} className="space-y-1.5 border-r border-[var(--color-border-subtle)] last:border-0 pr-6 last:pr-0">
                      <p className="text-[10px] text-[var(--color-text-faint)] font-bold uppercase tracking-wider">{item.label}</p>
                      <h4 className={`text-xl font-black ${item.color} font-mono tracking-tight`}>{item.value}</h4>
                      <p className="text-[10px] text-[var(--color-text-muted)]">{item.desc}</p>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </motion.div>
  );
}
