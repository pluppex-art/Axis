import { useState, useMemo, useEffect } from 'react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { parseCurrencyBR } from '../../lib/utils';
import { getMRR, getConversionRate, getActiveLeadsCount, getChurnRate } from '../../lib/revenueMetrics';
import { FUNIS_DEFAULT } from '../settings/sections/crm/funisTypes';
import { apiFetch } from '../../lib/apiClient';

export interface DashboardSummary {
  totalRevenue: number;
  conversionRate: number;
  activeLeadsCount: number;
  churnRate: number;
  valorPipelineAberto: number;
  leadsQuentes: number;
  mrrAtivo: number;
  mrrEmRisco: number;
  taxaInadimplencia: number;
  contractsAtivosCount: number;
  contractsEmRiscoCount: number;
  contractsTotalCount: number;
}

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const FUNNEL_COLORS = ['bg-emerald-500', 'bg-emerald-400', 'bg-emerald-300', 'bg-emerald-200', 'bg-emerald-100'];

// Mesma convenção de stageId usada em usePipeline.ts — precisa bater com o
// stageId real gravado no lead pelo Kanban, senão o funil conta tudo errado.
function getStageId(funilId: string, idx: number): string {
  if (funilId === "funil-comercial-default") return String(idx + 1);
  if (funilId === "funil-sdr-ia-default") return `sdr-${idx + 1}`;
  return `${funilId}-${idx}`;
}

export function useDashboard() {
  const { leads: allLeads, contracts, squads, leadActivities, appointments, funis, products, proposals } = useData();
  const { isModuleEnabled, user, activeTenantId } = useAuth();
  const [activeTab, setActiveTab] = useState<'executivo' | 'comercial' | 'sucesso' | 'marketing'>('executivo');
  const [comparisonPeriod, setComparisonPeriod] = useState<'month' | 'year'>('month');

  // Filtro de período do Dashboard — por `date` do lead (data de cadastro/
  // criação), o mesmo campo já usado no gráfico de performance mais abaixo.
  // Vazio (null) = sem filtro, mostra tudo. Afeta os cartões/funil/ranking
  // que dependem de `leads`; o gráfico de performance mantém sua própria
  // janela fixa de 7 meses (é um gráfico de tendência, não um total).
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);

  const leads = useMemo(() => {
    if (!dateFrom && !dateTo) return allLeads;
    return (allLeads as any[]).filter((l) => {
      if (!l.date) return false;
      if (dateFrom && l.date < dateFrom) return false;
      if (dateTo && l.date > dateTo) return false;
      return true;
    });
  }, [allLeads, dateFrom, dateTo]);

  // Goal Alerts
  const goalAlerts = useMemo(() => {
    return squads.filter(sq => (sq.faturamentoAlcancado / sq.meta) >= 0.9);
  }, [squads]);

  // Resumo cacheado (Redis-SPY) das 4 métricas "hero" — GET /api/dashboard/summary
  // em server.ts, mesma fórmula de src/lib/revenueMetrics.ts. Só usado quando
  // não há filtro de data ativo (o endpoint agrega o tenant inteiro, sem
  // recorte por período) — com filtro, sempre cai pro cálculo client-side
  // abaixo, que já respeita dateFrom/dateTo corretamente. Puramente aditivo:
  // se a chamada falhar ou ainda não tiver voltado, o cálculo client-side
  // (que já roda de qualquer forma, sem custo extra real — os arrays já
  // estão em memória por causa de outras telas) continua sendo usado.
  const [serverSummary, setServerSummary] = useState<DashboardSummary | null>(null);
  useEffect(() => {
    setServerSummary(null);
    if (dateFrom || dateTo || !activeTenantId) return;
    let cancelled = false;
    // `tenantId` explícito — essencial pra contas master/parceiro trocando
    // de "empresa visualizada" (switchTenant() em AuthContext.tsx): sem
    // isso, o servidor resolvia sempre o tenant "de casa" do usuário
    // logado, nunca o tenant selecionado na tela. Revalidado no servidor
    // via has_tenant_access antes de usar — nunca aceito às cegas.
    apiFetch(`/api/dashboard/summary?tenantId=${encodeURIComponent(activeTenantId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled && data) setServerSummary(data); })
      .catch(() => { /* silencioso — cálculo client-side abaixo já cobre */ });
    return () => { cancelled = true; };
  }, [activeTenantId, dateFrom, dateTo]);

  // Stats Calculations — via camada única de métricas (src/lib/revenueMetrics.ts)
  // pra usar exatamente a mesma definição de MRR/conversão/leads ativos em
  // todos os dashboards do sistema, não uma fórmula própria por tela.
  const totalRevenueClient = useMemo(() => getMRR(contracts), [contracts]);
  const conversionRateClient = useMemo(() => getConversionRate(leads).toFixed(1), [leads]);
  const activeLeadsCountClient = useMemo(() => getActiveLeadsCount(leads), [leads]);
  const churnRateClient = useMemo(() => {
    if (!appointments || appointments.length === 0) return getChurnRate(contracts);
    const patientMap = new Map<string, Date>();
    appointments.forEach(a => {
      try {
        const appointmentDate = new Date(a.date);
        if (!isNaN(appointmentDate.getTime())) {
          const existing = patientMap.get(a.patient);
          if (!existing || appointmentDate > existing) patientMap.set(a.patient, appointmentDate);
        }
      } catch {}
    });
    const totalPatients = patientMap.size;
    if (totalPatients === 0) return 0;
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const churnedPatients = Array.from(patientMap.values()).filter(d => d < ninetyDaysAgo).length;
    return parseFloat(((churnedPatients / totalPatients) * 100).toFixed(1));
  }, [appointments, contracts]);

  const totalRevenue = serverSummary?.totalRevenue ?? totalRevenueClient;
  const conversionRate = (serverSummary?.conversionRate ?? Number(conversionRateClient)).toFixed(1);
  const activeLeadsCount = serverSummary?.activeLeadsCount ?? activeLeadsCountClient;

  // Performance chart: group leads by month of creation (last 7 months)
  const performanceData = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (6 - i), 1);
      return { year: d.getFullYear(), month: d.getMonth(), name: MONTH_NAMES[d.getMonth()] };
    });

    return months.map(({ year, month, name }) => {
      const monthLeads = leads.filter(l => {
        if (!l.date) return false;
        try {
          const d = new Date(l.date);
          return !isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === month;
        } catch { return false; }
      });
      const closedThisMonth = monthLeads.filter(l => l.status === 'Fechado').length;
      const mrrThisMonth = contracts.filter(c => {
        if (c.status === 'Cancelado') return false;
        if (!c.date) return false;
        try {
          const d = new Date(c.date.split('/').reverse().join('-'));
          return !isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === month;
        } catch { return false; }
      }).reduce((sum, c) => sum + parseCurrencyBR(c.mrr), 0);

      return {
        name,
        vendas: Math.round(mrrThisMonth),
        leads: monthLeads.length,
        retention: closedThisMonth,
      };
    });
  }, [leads, contracts]);

  // Sales ranking: group closed leads by seller
  // Mesma regra de fallback do LeadCard/PipelineKanbanBoard: quando o lead
  // tem produto(s) vinculado(s) o valor real vem da soma dos preços, não do
  // campo value/valor; e quando nem isso existe, cai pra proposta vinculada.
  // Sem isso, leads fechados via produto/proposta apareciam com R$ 0 no
  // pódio. `parseCurrencyBR` também evita o crash silencioso de chamar
  // .replace() num l.value que já vem como number (comum após a sincronização
  // lead↔proposta) — o try/catch anterior engolia esse erro e zerava o total.
  const salesRanking = useMemo(() => {
    // `l.value` é a fonte de verdade (soma corretamente múltiplas propostas já
    // realizadas/aceitas pro mesmo lead) — só cai pra soma de preço de
    // catálogo dos produtos vinculados quando o lead não tem valor nenhum.
    const getLeadValue = (l: any) => {
      const parsed = parseCurrencyBR(l.value ?? l.valor);
      if (parsed > 0) return parsed;
      const linkedProducts = (products as any[] || []).filter((p: any) => (l.productIds || []).includes(p.id));
      if (linkedProducts.length > 0) {
        return linkedProducts.reduce((s: number, p: any) => s + (Number(p.price) || 0), 0);
      }
      const linkedProposal = (proposals as any[] || [])
        .filter((p: any) => p.lead_id === l.id)
        .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0];
      return linkedProposal?.valor ? Number(linkedProposal.valor) || 0 : 0;
    };

    const bySellerMap: Record<string, { name: string; deals: number; total: number }> = {};
    leads.filter(l => l.status === 'Fechado').forEach(l => {
      const seller = l.seller || 'Sem atribuição';
      if (!bySellerMap[seller]) bySellerMap[seller] = { name: seller, deals: 0, total: 0 };
      bySellerMap[seller].deals += 1;
      bySellerMap[seller].total += getLeadValue(l);
    });

    const sorted = Object.values(bySellerMap).sort((a, b) => b.total - a.total);

    return sorted.slice(0, 3).map(s => ({
      name: s.name,
      total: s.total,
      deals: s.deals,
      rate: Math.round((s.deals / Math.max(leads.filter(l => l.seller === s.name).length, 1)) * 100),
    }));
  }, [leads, products, proposals]);

  // Funnel data: count leads by real pipeline stage (stageId), não por um
  // vocabulário fixo de `status`. O Kanban (PipelineKanbanBoard.handleDrop)
  // só grava status "Em Aberto"/"Fechado"/"Perdido" — nunca "Qualificado",
  // "Proposta Enviada" etc. — então o funil ficava quase todo zerado exceto
  // na primeira/última etapa. Usa o funil comercial ativo (por tenant) pra
  // bater com as mesmas etapas/nomes mostrados no Pipeline.
  const funnelData = useMemo(() => {
    const funisConfig: any[] = funis && funis.length > 0 ? funis : FUNIS_DEFAULT;
    const comercialFunil =
      funisConfig.find((f: any) => f.tipo === 'comercial' && f.ativo !== false) ??
      funisConfig.find((f: any) => f.tipo === 'comercial') ??
      FUNIS_DEFAULT[0];

    const stageNames: string[] = comercialFunil.etapasConfig?.map((s: any) => s.nome) ?? comercialFunil.etapas ?? [];
    const stageIds = stageNames.map((_: string, idx: number) => getStageId(comercialFunil.id, idx));
    const lastIdx = stageNames.length - 1;

    const comercialLeads = leads.filter(l => !l.pipelineId || l.pipelineId === 'comercial');
    const total = comercialLeads.length || 1;

    let prevCount = total;
    return stageNames.map((name, i) => {
      let count = comercialLeads.filter(l => l.stageId === stageIds[i]).length;
      if (i === lastIdx) {
        // Leads marcados como "Fechado" contam na etapa final mesmo que o
        // stageId não tenha sido avançado até o fim.
        count = comercialLeads.filter(l => l.stageId === stageIds[i] || l.status === 'Fechado').length;
      }
      const drop = i > 0 && prevCount > 0 ? Math.round((1 - count / prevCount) * 100) : 0;
      const step = { label: name, value: count, drop, color: FUNNEL_COLORS[i] ?? 'bg-emerald-100' };
      prevCount = count;
      return step;
    });
  }, [leads, funis]);

  // Behavioral activities: last 4 lead activities
  const recentActivities = useMemo(() => {
    return [...leadActivities]
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 4);
  }, [leadActivities]);

  // churnRateClient já calculado mais acima (mesma fórmula de antes, sem
  // mudança de comportamento) — só decide aqui se usa o valor do cache do
  // servidor ou o client-side, igual às outras 3 métricas "hero".
  const churnRate = serverSummary?.churnRate ?? churnRateClient;

  return {
    leads,
    contracts,
    squads,
    leadActivities,
    activeLeadsCount,
    serverSummary,
    isModuleEnabled,
    user,
    activeTab,
    setActiveTab,
    comparisonPeriod,
    setComparisonPeriod,
    goalAlerts,
    totalRevenue,
    conversionRate,
    performanceData,
    salesRanking,
    funnelData,
    recentActivities,
    churnRate,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
  };
}
