import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { sendPushNotification } from "../lib/notifications";
import { isSupabaseReachable, supabase, fetchTenantPrimaryColor, updateTenantTheme } from '../lib/supabase';
import { DEFAULT_BRAND_COLOR, applyThemeColor } from '../lib/theme';
import { useAuth } from './AuthContext';
import { Lead, Task, Contract, CustomField, LeadScoreTrigger, Squad } from '../types';
import {
  defaultCustomLeadFields,
  defaultFinanceEntries,
  defaultGlobalWebhooks,
  defaultLeads,
  defaultTasks,
  defaultContracts,
  defaultActivitiesOnLoad,
  getDefaultAppointments,
  defaultSquads,
  defaultLeadScoreTriggers,
  defaultProducts
} from './dataMocks';
import { DataContext, DataContextType, LeadActivity, Notification, Appointment, GlobalWebhook, FinanceEntry, Reuniao, Indicacao, useData } from './DataContextTypes';
import { apiFetch } from "../lib/apiClient";
import { parseCurrencyBR } from "../lib/utils";

export { useData };
export type { DataContextType, LeadActivity, Notification, Appointment, GlobalWebhook, FinanceEntry, Reuniao };

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user, authLoading, updatePreferences, activeTenantId, activeFilialId } = useAuth();
  const tenantId = activeTenantId;

  // Tabelas com segregação por filial: quando uma filial está ativa (activeFilialId),
  // a lista exposta pelo contexto já vem filtrada — linhas sem filial_id (legado, ou
  // nunca atribuídas) continuam visíveis em qualquer filial para não sumir dado antigo.
  function filterByFilial<T>(list: T[]): T[] {
    if (!activeFilialId) return list;
    return list.filter((item: any) => !item.filial_id || item.filial_id === activeFilialId);
  }

  const [theme, setTheme] = useState<'dark' | 'light'>('light');

  useEffect(() => {
    const saved = user?.preferences?.theme;
    if (saved === 'dark' || saved === 'light') setTheme(saved);
  }, [user?.preferences?.theme]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    updatePreferences({ theme: next });
  };

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const DEFAULT_SIDEBAR_MODULES = {
    crm: true,
    educacao: true,
    produtividade: true,
    financeiro: true,
    catalogo: true,
    marketing: true,
    engajamento: true,
    rh: true,
    bi: true,
    clinica: true,
  };

  const [sidebarModules, setSidebarModulesState] = useState<Record<string, boolean>>(DEFAULT_SIDEBAR_MODULES);

  const [customLeadFields, setCustomLeadFields] = useState<CustomField[]>(defaultCustomLeadFields);

  const updateCustomLeadFields = (fields: CustomField[]) => {
    setCustomLeadFields(fields);
    syncSetting('customLeadFields', fields);
  };

  const [leadScoreTriggers, setLeadScoreTriggers] = useState<LeadScoreTrigger[]>(defaultLeadScoreTriggers);

  const updateLeadScoreTriggers = (triggers: LeadScoreTrigger[]) => {
    setLeadScoreTriggers(triggers);
    syncSetting('leadScoreTriggers', triggers);
  };

  const [financeEntriesRaw, setFinanceEntries] = useState<FinanceEntry[]>(defaultFinanceEntries as FinanceEntry[]);
  const financeEntries = useMemo(() => filterByFilial(financeEntriesRaw), [financeEntriesRaw, activeFilialId]);

  // Mapa genérico key -> value de app_settings, para telas de configuração
  // que não precisam de um campo dedicado no contexto (ver saveAppSetting).
  const [appSettings, setAppSettings] = useState<Record<string, any>>({});
  // Sinaliza que a busca inicial de app_settings já rodou (mesmo que não
  // exista nenhuma linha ainda) — telas que fazem auto-save de config
  // hidratada usam isso pra saber quando é seguro persistir, em vez de
  // inferir "carregou" só pela presença de uma chave específica (que nunca
  // existiria pra um tenant novo, travando o auto-save pra sempre).
  const [appSettingsLoaded, setAppSettingsLoaded] = useState(false);

  const syncSetting = async (key: string, value: any) => {
    setAppSettings(prev => ({ ...prev, [key]: value }));
    if (!supabase || !tenantId) return;
    try {
      // Escopado por tenant explicitamente — sem isso, duas empresas usando a
      // mesma "key" (ex.: "spy_sidebar_modules") acabariam lendo/sobrescrevendo
      // a configuração uma da outra.
      const { data } = await supabase.from('app_settings').select('id').eq('key', key).eq('tenant_id', tenantId).maybeSingle();
      const { error } = data
        ? await supabase.from('app_settings').update({ value }).eq('id', data.id)
        : await supabase.from('app_settings').insert({ key, value, tenant_id: tenantId });
      if (error) {
        console.error(`Supabase sync setting failed for ${key}:`, error.message);
      }
    } catch (err) {
      console.error(`Supabase sync setting failed for ${key}:`, err);
    }
  };

  const saveAppSetting = async (key: string, value: any) => {
    if (supabase) {
      await syncSetting(key, value);
    }
  };

  const setSidebarModules = async (modules: Record<string, boolean>) => {
    setSidebarModulesState(modules);
    await saveAppSetting('spy_sidebar_modules', modules);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('spy_modules_changed', { detail: modules }));
    }
  };

  const [globalWebhooks, setGlobalWebhooks] = useState<GlobalWebhook[]>(defaultGlobalWebhooks);

  const addGlobalWebhook = (webhook: Omit<GlobalWebhook, 'id'>) => {
    const newVal = [{ ...webhook, id: `w${Math.random().toString(36).substring(2, 9)}` }, ...globalWebhooks];
    setGlobalWebhooks(newVal);
    syncSetting('globalWebhooks', newVal);
  };

  const updateGlobalWebhook = (id: string, updates: Partial<GlobalWebhook>) => {
    const newVal = globalWebhooks.map(w => w.id === id ? { ...w, ...updates } : w);
    setGlobalWebhooks(newVal);
    syncSetting('globalWebhooks', newVal);
  };

  const deleteGlobalWebhook = (id: string) => {
    const newVal = globalWebhooks.filter(w => w.id !== id);
    setGlobalWebhooks(newVal);
    syncSetting('globalWebhooks', newVal);
  };

  const toggleGlobalWebhook = (id: string) => {
    const newVal = globalWebhooks.map(w => w.id === id ? { ...w, active: !w.active } : w);
    setGlobalWebhooks(newVal);
    syncSetting('globalWebhooks', newVal);
  };

  // Tema de cor por tenant: uma das 4 cores de marca do S.P.Y. (ou hex custom),
  // escolhida em Configurações → Empresa → Tema e persistida em tenants.primary_color.
  // Só o token de destaque principal muda por tenant — o resto da paleta (fundo,
  // accent cyan) é identidade fixa do produto, não do cliente.
  const [tenantPrimaryColor, setTenantPrimaryColorState] = useState<string>(DEFAULT_BRAND_COLOR);

  useEffect(() => {
    let cancelled = false;
    async function loadTenantColor() {
      if (!tenantId) {
        setTenantPrimaryColorState(DEFAULT_BRAND_COLOR);
        return;
      }
      const hex = await fetchTenantPrimaryColor(tenantId);
      if (!cancelled && hex) {
        setTenantPrimaryColorState(hex);
        applyThemeColor(hex);
      }
    }
    loadTenantColor();
    return () => { cancelled = true; };
  }, [tenantId]);

  useEffect(() => {
    applyThemeColor(tenantPrimaryColor);
  }, [tenantPrimaryColor]);

  const updateTenantPrimaryColor = async (hex: string) => {
    setTenantPrimaryColorState(hex);
    applyThemeColor(hex);
    if (!tenantId) return { success: false, error: 'Nenhum tenant ativo' };
    const result = await updateTenantTheme(tenantId, hex);
    if (!result.success) toast.error(result.error || 'Erro ao salvar tema.');
    return result;
  };

  const [leadsRaw, setLeads] = useState<Lead[]>(defaultLeads);

  const [tasksRaw, setTasks] = useState<Task[]>(defaultTasks);

  const [contractsRaw, setContracts] = useState<Contract[]>(defaultContracts);

  const [leadActivities, setLeadActivities] = useState<LeadActivity[]>([]);

  const [whatsappWebhookUrl, setWhatsappWebhookUrl] = useState<string>("");

  const [appointmentsRaw, setAppointments] = useState<Appointment[]>(() => getDefaultAppointments() as Appointment[]);

  const leads = useMemo(() => filterByFilial(leadsRaw), [leadsRaw, activeFilialId]);
  const tasks = useMemo(() => filterByFilial(tasksRaw), [tasksRaw, activeFilialId]);
  const contracts = useMemo(() => filterByFilial(contractsRaw), [contractsRaw, activeFilialId]);
  const appointments = useMemo(() => filterByFilial(appointmentsRaw), [appointmentsRaw, activeFilialId]);

  const [squads, setSquads] = useState<Squad[]>(defaultSquads);

  const addSquad = async (squad: Omit<Squad, 'id'>) => {
    const newSquad = { ...squad, id: `sq${Math.random().toString(36).substring(2, 9)}` };
    setSquads(prev => [...prev, newSquad]);
    if (!supabase) {
      toast.success('Squad criado com sucesso!');
      return;
    }
    if (supabase) {
      try {
        const { id, nome, departamento, focoComercial, membros, leader, cor, logo, membrosFuncoes, clientes } = newSquad as any;
        const { error } = await supabase.from('squads').insert({
          id, nome,
          ...(tenantId ? { tenant_id: tenantId } : {}),
          departamento: departamento || 'Geral',
          foco_comercial: focoComercial || '',
          membros: membros || [],
          leader: leader || '',
          cor: cor || '#6366f1',
          logo: logo || '',
          membros_funcoes: membrosFuncoes || {},
          clientes: clientes || [],
        });
        if (error) {
          console.error("Supabase add squad failed:", error.message);
          toast.error(`Erro ao criar squad: ${error.message}`);
          setSquads(prev => prev.filter(s => s.id !== newSquad.id));
        } else {
          toast.success('Squad criado com sucesso!');
        }
      } catch (err) {
        console.error("Supabase add squad failed:", err);
        toast.error('Erro ao criar squad.');
        setSquads(prev => prev.filter(s => s.id !== newSquad.id));
      }
    }
  };

  const updateSquad = async (id: string, updates: Partial<Squad>) => {
    setSquads(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    if (supabase) {
      try {
        const payload: any = { ...updates };
        if ('focoComercial' in payload) { payload.foco_comercial = payload.focoComercial; delete payload.focoComercial; }
        if ('membrosFuncoes' in payload) { payload.membros_funcoes = payload.membrosFuncoes; delete payload.membrosFuncoes; }
        await supabase.from('squads').update(payload).eq('id', id);
      } catch (err) {
        console.error("Supabase update squad failed:", err);
      }
    }
  };

  const deleteSquad = async (id: string) => {
    setSquads(prev => prev.filter(s => s.id !== id));
    toast.info('Squad removido.');
    if (supabase) {
      try {
        await supabase.from('squads').delete().eq('id', id);
      } catch (err) {
        console.error("Supabase delete squad failed:", err);
      }
    }
  };

  const updateWhatsappWebhookUrl = (url: string) => {
    setWhatsappWebhookUrl(url);
  };

  // ─── Funis do CRM (crm_funis) ────────────────────────────────────────────
  // Substitui o antigo "axis_funis_config" (localStorage + app_settings sem
  // filtro de tenant) pela tabela dedicada que já existia sem uso.
  const [funis, setFunis] = useState<any[]>([]);

  const rowToFunil = (r: any) => ({
    id: r.id,
    nome: r.nome,
    tipo: r.tipo,
    etapas: r.etapas || [],
    etapasConfig: r.etapas_config?.length ? r.etapas_config : undefined,
    ativo: r.ativo,
    clientIds: r.client_ids || [],
    sdrEtapaEntrada: r.sdr_etapa_entrada || '',
    sdrEtapaHandoff: r.sdr_etapa_handoff || '',
    sdrScoreMinimo: r.sdr_score_minimo ?? 65,
    sdrDelayResposta: r.sdr_delay_resposta ?? 2,
    sdrMsgBoasVindas: r.sdr_msg_boas_vindas || '',
    sdrCriterioDesqualificacao: r.sdr_criterio_desqualificacao || 'sem_interesse',
  });

  const funilToRow = (f: any) => ({
    ...(f.id ? { id: f.id } : {}),
    ...(f.nome !== undefined ? { nome: f.nome } : {}),
    ...(f.tipo !== undefined ? { tipo: f.tipo } : {}),
    ...(f.etapas !== undefined ? { etapas: f.etapas } : {}),
    ...(f.etapasConfig !== undefined ? { etapas_config: f.etapasConfig || [] } : {}),
    ...(f.ativo !== undefined ? { ativo: f.ativo } : {}),
    ...(f.clientIds !== undefined ? { client_ids: f.clientIds || [] } : {}),
    ...(f.sdrEtapaEntrada !== undefined ? { sdr_etapa_entrada: f.sdrEtapaEntrada } : {}),
    ...(f.sdrEtapaHandoff !== undefined ? { sdr_etapa_handoff: f.sdrEtapaHandoff } : {}),
    ...(f.sdrScoreMinimo !== undefined ? { sdr_score_minimo: f.sdrScoreMinimo } : {}),
    ...(f.sdrDelayResposta !== undefined ? { sdr_delay_resposta: f.sdrDelayResposta } : {}),
    ...(f.sdrMsgBoasVindas !== undefined ? { sdr_msg_boas_vindas: f.sdrMsgBoasVindas } : {}),
    ...(f.sdrCriterioDesqualificacao !== undefined ? { sdr_criterio_desqualificacao: f.sdrCriterioDesqualificacao } : {}),
  });

  const fetchFunis = async () => {
    if (!supabase || !tenantId) return;
    const { data } = await supabase.from('crm_funis').select('*').eq('tenant_id', tenantId);
    if (data) setFunis(data.map(rowToFunil));
  };

  // Inclui nichos globais (tenant_id null) + os do tenant ativo — não dá pra usar
  // fetchTableData genérico aqui porque ele só filtra por .eq('tenant_id', tenantId).
  const fetchNichos = async () => {
    if (!supabase || !tenantId) return;
    const { data } = await supabase.from('nichos').select('*').or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
    if (data) setNichos(data);
  };

  const addFunil = async (f: any) => {
    const newFunil = { ...f, id: f.id || Math.random().toString(36).slice(2) };
    setFunis(prev => [...prev, newFunil]);
    if (supabase) {
      const { error } = await supabase.from('crm_funis').insert(funilToRow(newFunil));
      if (error) { console.error('[Supabase] insert crm_funis error:', error.message); toast.error(`Erro ao salvar funil: ${error.message}`); }
    }
  };

  const updateFunil = async (id: string, updates: any) => {
    setFunis(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
    if (supabase) {
      const { error } = await supabase.from('crm_funis').update(funilToRow(updates)).eq('id', id);
      if (error) console.error('[Supabase] update crm_funis error:', error.message);
    }
  };

  const deleteFunil = async (id: string) => {
    setFunis(prev => prev.filter(f => f.id !== id));
    if (supabase) {
      const { error } = await supabase.from('crm_funis').delete().eq('id', id);
      if (error) console.error('[Supabase] delete crm_funis error:', error.message);
    }
  };

  const [notifications, setNotifications] = useState<Notification[]>([]);

  const [marketingAutomations, setMarketingAutomations] = useState<any[]>([]);
  const [marketingContent, setMarketingContent] = useState<any[]>([]);
  const [marketingCampaigns, setMarketingCampaigns] = useState<any[]>([]);
  const [marketingLandingPages, setMarketingLandingPages] = useState<any[]>([]);
  const [marketingForms, setMarketingForms] = useState<any[]>([]);
  const [productsRaw, setProducts] = useState<any[]>(defaultProducts);

  const [proposalsRaw, setProposals] = useState<any[]>([]);
  const [proposalItems, setProposalItems] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [reunioes, setReunioes] = useState<Reuniao[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [colaboradoresRaw, setColaboradores] = useState<any[]>([]);
  const [squadMetas, setSquadMetas] = useState<any[]>([]);
  const [financialGoals, setFinancialGoals] = useState<any[]>([]);
  const [cargos, setCargos] = useState<any[]>([]);
  const [empresaFiliais, setEmpresaFiliais] = useState<any[]>([]);
  const [nichos, setNichos] = useState<any[]>([]);
  const [financeCategories, setFinanceCategories] = useState<any[]>([]);
  const [financeCommissionEntries, setFinanceCommissionEntries] = useState<any[]>([]);
  const [scheduledExports, setScheduledExports] = useState<any[]>([]);
  const [educationContent, setEducationContent] = useState<any[]>([]);
  const [clienteBase, setClienteBase] = useState<any[]>([]);
  const [indicacoes, setIndicacoes] = useState<Indicacao[]>([]);

  const products = useMemo(() => filterByFilial(productsRaw), [productsRaw, activeFilialId]);
  const proposals = useMemo(() => filterByFilial(proposalsRaw), [proposalsRaw, activeFilialId]);
  const colaboradores = useMemo(() => filterByFilial(colaboradoresRaw), [colaboradoresRaw, activeFilialId]);

  const addStudent = async (student: any) => {
    const newStudent = { ...student, id: `st${Math.random().toString(36).substring(2, 9)}`, ...(tenantId ? { tenant_id: tenantId } : {}) };
    setStudents(prev => [...prev, newStudent]);
    if (supabase) {
      const { error } = await supabase.from('students').insert(newStudent);
      if (error) {
        console.error("Supabase add student failed:", error.message);
        toast.error(`Erro ao matricular aluno: ${error.message}`);
      }
    }
    return newStudent;
  };

  const updateStudent = async (id: string, updates: any) => {
    setStudents(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    if (supabase) {
      const { error } = await supabase.from('students').update(updates).eq('id', id);
      if (error) {
        console.error("Supabase update student failed:", error.message);
        toast.error(`Erro ao atualizar aluno: ${error.message}`);
      }
    }
  };

  const deleteStudent = async (id: string) => {
    setStudents(prev => prev.filter(s => s.id !== id));
    if (supabase) await supabase.from('students').delete().eq('id', id);
  };

  // Persistence & Supabase Synchronization
  //
  // Filtra por tenantId explicitamente aqui, além do que a RLS já garante —
  // contas de parceiro (G-Tech, Nicolas Rocha, Pluppex Holding) têm
  // has_tenant_access() verdadeiro para vários tenants ao mesmo tempo (fase 4
  // de parceiros), então um select('*') sem esse filtro devolve linhas de
  // todos os tenants que a conta pode acessar, não só o tenant ativo na tela.
  const fetchTableData = async (tableName: string, setter: React.Dispatch<React.SetStateAction<any[]>>) => {
    if (!supabase || !tenantId) return;
    const { data } = await supabase.from(tableName).select('*').eq('tenant_id', tenantId);
    if (data) setter(data);
  };

  useEffect(() => {
    let channel: any = null;

    async function setupRealtime() {
      // Sem tenantId ainda (sessão não resolveu) — não assina; o efeito reroda
      // quando tenantId chega (está nas deps abaixo), e as closures capturadas
      // aqui precisam do valor atual de tenantId, não de um valor congelado.
      if (!supabase || !tenantId) return;

      channel = supabase.channel('global-db-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload) => {
          if (payload.eventType === 'INSERT') {
            // Mesmo motivo do fetchTableData: o evento pode vir de outro
            // tenant que esta conta de parceiro também acessa — só entra na
            // lista se for do tenant ativo. payload.new é a linha crua do
            // Postgres (snake_case), daí o acesso via `any`.
            if (payload.new && (payload.new as any).tenant_id === tenantId) {
              setLeads(prev => [payload.new as Lead, ...prev]);
              toast.info(`Novo lead: ${payload.new.name}`, { description: 'Recebido via Realtime' });
            }
          } else {
            fetchTableData('leads', setLeads);
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => fetchTableData('tasks', setTasks))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'contracts' }, () => fetchTableData('contracts', setContracts))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_entries' }, () => fetchTableData('finance_entries', setFinanceEntries))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'squads' }, () => fetchTableData('squads', setSquads))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => fetchTableData('appointments', setAppointments))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => fetchTableData('products', setProducts))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'proposals' }, () => fetchTableData('proposals', setProposals))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'proposal_items' }, () => fetchTableData('proposal_items', setProposalItems))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'turmas' }, () => fetchTableData('turmas', setTurmas))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, () => fetchTableData('students', setStudents))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'colaboradores' }, () => fetchTableData('colaboradores', setColaboradores))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'squad_metas' }, () => fetchTableData('squad_metas', setSquadMetas))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_goals' }, () => fetchTableData('financial_goals', setFinancialGoals))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'cargos' }, () => fetchTableData('cargos', setCargos))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'certificates' }, () => fetchTableData('certificates', setCertificates))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reunioes' }, () => fetchTableData('reunioes', setReunioes as any))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_funis' }, () => fetchFunis())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'empresa_filiais' }, () => fetchTableData('empresa_filiais', setEmpresaFiliais))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'nichos' }, () => fetchNichos())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_categories' }, () => fetchTableData('finance_categories', setFinanceCategories))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_commission_entries' }, () => fetchTableData('finance_commission_entries', setFinanceCommissionEntries))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'scheduled_exports' }, () => fetchTableData('scheduled_exports', setScheduledExports))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'education_content' }, () => fetchTableData('education_content', setEducationContent))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'indicacoes' }, () => fetchTableData('indicacoes', setIndicacoes as any))
        .subscribe();
    }

    setupRealtime();

    return () => {
      if (channel && supabase) supabase.removeChannel(channel);
    };
  }, [tenantId]);

  useEffect(() => {
    async function loadInitialData() {
      // Aguarda a sessão resolver e o tenant ser conhecido antes de buscar
      // dados — evita disparar a carga como "anon" (RLS devolveria tudo
      // vazio) numa corrida contra o login, já que este efeito não reroda
      // sozinho depois (dependências abaixo cobrem isso quando o tenant muda).
      if (supabase && !authLoading && tenantId) {
        console.log('[DataContext] 🔄 Carregando dados do Supabase (tenant ' + tenantId + ')...');
        try {
            const [
              leadsRes, tasksRes, contractsRes, actsRes, financeRes, apptRes, squadsRes,
              notifRes, mktCampRes, mktContRes, mktLpRes, settingsRes,
              productsRes, proposalsRes, proposalItemsRes, turmasRes, studentsRes, colabRes, squadMetasRes, certRes, cargosRes,
              clienteBaseRes, reunioesRes, financialGoalsRes, funisRes, filiaisRes,
              financeCategoriesRes, scheduledExportsRes, educationContentRes,
              marketingFormsRes, nichosRes, financeCommissionEntriesRes, indicacoesRes, mktAutoRes
            ] = await Promise.all([
              supabase.from('leads').select('*').eq('tenant_id', tenantId),
              supabase.from('tasks').select('*').eq('tenant_id', tenantId),
              supabase.from('contracts').select('*').eq('tenant_id', tenantId),
              supabase.from('lead_activities').select('*').eq('tenant_id', tenantId),
              supabase.from('finance_entries').select('*').eq('tenant_id', tenantId),
              supabase.from('appointments').select('*').eq('tenant_id', tenantId),
              supabase.from('squads').select('*').eq('tenant_id', tenantId),
              supabase.from('notifications').select('*').eq('tenant_id', tenantId),
              supabase.from('marketing_campaigns').select('*').eq('tenant_id', tenantId),
              supabase.from('marketing_content').select('*').eq('tenant_id', tenantId).is('deleted_at', null),
              supabase.from('marketing_landing_pages').select('*').eq('tenant_id', tenantId),
              // Inclui linhas globais (tenant_id IS NULL) + as do tenant ativo, explicitamente —
              // sem esse filtro, contas master/parceiro (has_tenant_access verdadeiro pra vários
              // tenants) recebiam via RLS configurações de TODOS os tenants acessíveis misturadas
              // num único mapa por key (ver merge abaixo), fazendo "configs grudarem" ao trocar de empresa.
              supabase.from('app_settings').select('*').or(`tenant_id.eq.${tenantId},tenant_id.is.null`),
              supabase.from('products').select('*').eq('tenant_id', tenantId),
              supabase.from('proposals').select('*').eq('tenant_id', tenantId),
              supabase.from('proposal_items').select('*').eq('tenant_id', tenantId),
              supabase.from('turmas').select('*').eq('tenant_id', tenantId),
              supabase.from('students').select('*').eq('tenant_id', tenantId),
              supabase.from('colaboradores').select('*').eq('tenant_id', tenantId),
              supabase.from('squad_metas').select('*').eq('tenant_id', tenantId),
              supabase.from('certificates').select('*').eq('tenant_id', tenantId),
              supabase.from('cargos').select('*').eq('tenant_id', tenantId),
              supabase.from('clientes').select('*').eq('tenant_id', tenantId),
              supabase.from('reunioes').select('*').eq('tenant_id', tenantId),
              supabase.from('financial_goals').select('*').eq('tenant_id', tenantId),
              supabase.from('crm_funis').select('*').eq('tenant_id', tenantId),
              supabase.from('empresa_filiais').select('*').eq('tenant_id', tenantId),
              supabase.from('finance_categories').select('*').eq('tenant_id', tenantId),
              supabase.from('scheduled_exports').select('*').eq('tenant_id', tenantId),
              supabase.from('education_content').select('*').eq('tenant_id', tenantId),
              supabase.from('marketing_forms').select('*').eq('tenant_id', tenantId),
              // Nichos globais (tenant_id null) + os do tenant ativo, mesmo motivo do app_settings acima.
              supabase.from('nichos').select('*').or(`tenant_id.eq.${tenantId},tenant_id.is.null`),
              supabase.from('finance_commission_entries').select('*').eq('tenant_id', tenantId),
              supabase.from('indicacoes').select('*').eq('tenant_id', tenantId),
              supabase.from('marketing_automations').select('*').eq('tenant_id', tenantId),
            ]);

            if (!leadsRes.error && leadsRes.data && leadsRes.data.length > 0) {
              setLeads((leadsRes.data as any[]).map(r => ({
                ...r,
                productIds: r.productIds || r.customFields?.productIds || [],
                scoreIA: r.scoreIA ?? r.score_ia ?? 50,
                tags: Array.isArray(r.tags) ? r.tags : (r.customFields?.tags || []),
              })) as Lead[]);
            }
            if (!tasksRes.error && tasksRes.data && tasksRes.data.length > 0) setTasks(tasksRes.data as Task[]);
            if (!actsRes.error && actsRes.data && actsRes.data.length > 0) setLeadActivities(actsRes.data as LeadActivity[]);
            if (!financeRes.error && financeRes.data && financeRes.data.length > 0) setFinanceEntries(financeRes.data as FinanceEntry[]);
            if (!apptRes.error && apptRes.data && apptRes.data.length > 0) setAppointments(apptRes.data.map((r: any): Appointment => ({
              id: r.id, time: r.time, patient: r.patient, patientId: r.patient_id ?? null,
              drId: r.dr_id, drName: r.dr_name, status: r.status, type: r.type,
              room: r.room, specialty: r.specialty, phone: r.phone, date: r.date, notes: r.notes,
            })));
            if (!squadsRes.error && squadsRes.data && squadsRes.data.length > 0) setSquads(squadsRes.data.map((r: any): Squad => ({
              id: r.id, nome: r.nome,
              departamento: r.departamento || 'Geral',
              focoComercial: r.foco_comercial || '',
              membros: r.membros || [],
              leader: r.leader || '',
              cor: r.cor || '#6366f1',
              logo: r.logo || '',
              membrosFuncoes: r.membros_funcoes || {},
              clientes: r.clientes || [],
            })));
            if (!notifRes.error && notifRes.data && notifRes.data.length > 0) setNotifications(notifRes.data as Notification[]);
            if (!mktCampRes.error && mktCampRes.data) setMarketingCampaigns(mktCampRes.data);
            if (!mktContRes.error && mktContRes.data) setMarketingContent(mktContRes.data);
            if (!mktLpRes.error && mktLpRes.data) setMarketingLandingPages(mktLpRes.data);
            if (!productsRes.error && productsRes.data) {
              setProducts(productsRes.data.map((p: any) => ({
                ...p,
                typeAttributes: p.typeAttributes || p.type_attributes || {},
                attachments: Array.isArray(p.attachments) ? p.attachments : [],
              })));
            }
            if (!proposalsRes.error && proposalsRes.data) setProposals(proposalsRes.data);
            if (!proposalItemsRes.error && proposalItemsRes.data) setProposalItems(proposalItemsRes.data);
            if (!turmasRes.error && turmasRes.data) setTurmas(turmasRes.data);
            if (!studentsRes.error && studentsRes.data) setStudents(studentsRes.data);
            if (colabRes.error) console.error('[Supabase] colaboradores load error:', colabRes.error.message);
            else if (colabRes.data) setColaboradores(colabRes.data);
            if (!squadMetasRes.error && squadMetasRes.data) setSquadMetas(squadMetasRes.data);
            if (!financialGoalsRes.error && financialGoalsRes.data) setFinancialGoals(financialGoalsRes.data);
            if (!certRes.error && certRes.data) setCertificates(certRes.data);
            if (!cargosRes.error && cargosRes.data) setCargos(cargosRes.data);
            if (!clienteBaseRes.error && clienteBaseRes.data) setClienteBase(clienteBaseRes.data);
            if (!reunioesRes.error && reunioesRes.data) setReunioes(reunioesRes.data as Reuniao[]);
            if (!funisRes.error && funisRes.data) setFunis(funisRes.data.map(rowToFunil));
            if (!filiaisRes.error && filiaisRes.data) setEmpresaFiliais(filiaisRes.data);
            if (!nichosRes.error && nichosRes.data) setNichos(nichosRes.data);
            if (!financeCategoriesRes.error && financeCategoriesRes.data) setFinanceCategories(financeCategoriesRes.data);
            if (!financeCommissionEntriesRes.error && financeCommissionEntriesRes.data) setFinanceCommissionEntries(financeCommissionEntriesRes.data);
            if (!indicacoesRes.error && indicacoesRes.data) setIndicacoes(indicacoesRes.data as Indicacao[]);
            if (!mktAutoRes.error && mktAutoRes.data) setMarketingAutomations(mktAutoRes.data);
            if (!scheduledExportsRes.error && scheduledExportsRes.data) setScheduledExports(scheduledExportsRes.data);
            if (!educationContentRes.error && educationContentRes.data) setEducationContent(educationContentRes.data);
            if (!marketingFormsRes.error && marketingFormsRes.data) setMarketingForms(marketingFormsRes.data);

            if (!settingsRes.error && settingsRes.data) {
              const settingsMap: Record<string, any> = {};
              // Processa as linhas globais (tenant_id null) primeiro, depois as do tenant ativo —
              // assim, se a mesma key existir nos dois níveis, o valor específico do tenant sempre
              // vence o default global, em vez de depender da ordem que o Postgres devolveu.
              const orderedSettings = [...settingsRes.data].sort((a: any, b: any) =>
                (a.tenant_id === null ? 0 : 1) - (b.tenant_id === null ? 0 : 1)
              );
              orderedSettings.forEach((setting: any) => {
                settingsMap[setting.key] = setting.value;
                switch (setting.key) {
                  case 'globalWebhooks': setGlobalWebhooks(setting.value); break;
                  case 'customLeadFields': setCustomLeadFields(setting.value); break;
                  case 'leadScoreTriggers': setLeadScoreTriggers(setting.value); break;
                }
              });
              // Lê a chave nova; se o tenant ainda não tem nada salvo nela (rename
              // Axis → S.P.Y.), cai pra chave antiga em vez de perder a preferência
              // de sidebar já salva.
              const sidebarModules = settingsMap['spy_sidebar_modules'] ?? settingsMap['axis_sidebar_modules'];
              if (sidebarModules !== undefined) setSidebarModulesState(sidebarModules);
              setAppSettings(settingsMap);
              setAppSettingsLoaded(true);
            }
            console.log('[DataContext] ✅ Dados carregados do Supabase.');
        } catch (err) {
          console.error('[DataContext] ❌ Erro ao fetch Supabase:', err);
        }
      }
    }
    loadInitialData();
  }, [authLoading, tenantId]);

  const notifiedRemindersRef = React.useRef<Record<string, boolean>>({});

  useEffect(() => {
    const checkTeleconsultations = () => {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];

      appointments.forEach(apt => {
        if (apt.type === 'Teleconsulta' && apt.date === todayStr && apt.status !== 'Finalizado') {
          const [hour, minute] = apt.time.split(':').map(Number);
          const aptTime = new Date();
          aptTime.setHours(hour, minute, 0, 0);

          const diffMs = aptTime.getTime() - now.getTime();
          const diffMins = Math.floor(diffMs / 60000);

          if (diffMins >= 28 && diffMins <= 32 && !notifiedRemindersRef.current[apt.id]) {
            notifiedRemindersRef.current[apt.id] = true;
            const message = `Olá ${apt.patient}, aqui é da S.P.Y. Telemedicina. Lembramos que sua teleconsulta com ${apt.drName} inicia em 30 minutos. Prepare sua conexão!`;
            console.log(`[WHATSAPP AUTOMÁTICO] Enviando para ${apt.phone || 'N/A'}: ${message}`);

            toast.info(`Lembrete WhatsApp enviado para ${apt.patient}`, {
              description: "Teleconsulta em 30 minutos.",
              icon: "📱"
            });

            addNotification({
              title: "Lembrete de Teleconsulta Enviado",
              desc: `Mensagem de WhatsApp disparada para ${apt.patient} (${apt.phone}).`,
              type: "info",
              category: "Telemedicina"
            });
          }
        }
      });
    };

    const interval = setInterval(checkTeleconsultations, 30000);
    return () => clearInterval(interval);
  }, [appointments]);

  // Automated background checker for cold leads (Score IA < 40)
  const handledColdLeadsRef = React.useRef<Record<string, boolean>>({});
  const leadsRef = React.useRef(leads);
  leadsRef.current = leads;
  const tasksRef = React.useRef(tasks);
  tasksRef.current = tasks;
  const leadScoreTriggersRef = React.useRef(leadScoreTriggers);
  leadScoreTriggersRef.current = leadScoreTriggers;

  useEffect(() => {
    const checkColdLeads = () => {
      leadsRef.current.forEach(lead => {
        if (lead.id && !handledColdLeadsRef.current[lead.id] && lead.scoreIA !== undefined && lead.scoreIA < 40) {
          const nurturingTaskTitle = `Nutrição de Reengajamento: ${lead.name}`;
          // Sem coluna `tags` na tabela `tasks` — dedupe por lead_id + prefixo do
          // título (ambos colunas reais), em vez da antiga tag "reengajamento".
          const hasNurturingTask = tasksRef.current.some(t =>
            t.lead_id === lead.id && t.title === nurturingTaskTitle
          );

          if (!hasNurturingTask) {
            handledColdLeadsRef.current[lead.id] = true;
            const tomorrow9am = new Date();
            tomorrow9am.setDate(tomorrow9am.getDate() + 1);
            tomorrow9am.setHours(9, 0, 0, 0);
            const newTask: Omit<Task, 'id'> = {
              title: nurturingTaskTitle,
              description: "Tipo: E-mail — automação de reengajamento (lead frio, Score IA < 40).",
              lead_id: lead.id,
              due_date: tomorrow9am.toISOString(),
              status: "Em Aberto",
              priority: "Média",
            };

            addTask(newTask);

            addNotification({
              title: "Reengajamento Iniciado",
              desc: `Automação detectou o lead frio '${lead.name}' (Score IA: ${lead.scoreIA}) e gerou uma tarefa de Nutrição.`,
              type: "info",
              category: "Automação"
            }, true);
          } else {
            handledColdLeadsRef.current[lead.id] = true;
          }
        }
      });
    };

    const timer = setTimeout(checkColdLeads, 10000);
    const interval = setInterval(checkColdLeads, 60000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  // Motor real dos Gatilhos de Lead Score IA (Configurações > CRM > Gatilhos IA):
  const movedByTriggerRef = React.useRef<Record<string, true>>({});
  useEffect(() => {
    const checkLeadScoreTriggers = () => {
      if (leadScoreTriggersRef.current.length === 0) return;
      leadsRef.current.forEach(lead => {
        if (lead.pipelineId !== 'sdr' || lead.scoreIA === undefined) return;
        for (const trigger of leadScoreTriggersRef.current) {
          const matches = trigger.condition === 'greater'
            ? lead.scoreIA >= trigger.scoreThreshold
            : lead.scoreIA <= trigger.scoreThreshold;
          if (!matches) continue;
          if (lead.stageId === trigger.targetStageId) continue;
          const key = `${lead.id}-${trigger.id}-${trigger.targetStageId}`;
          if (movedByTriggerRef.current[key]) continue;
          movedByTriggerRef.current[key] = true;
          moveLead(lead.id, trigger.targetStageId, 0);
          addNotification({
            title: "Gatilho de Lead Score Aplicado",
            desc: `${lead.name} (Score IA: ${lead.scoreIA}) foi movido automaticamente para a etapa configurada no gatilho.`,
            type: "info",
            category: "Automação"
          }, true);
          break;
        }
      });
    };
    const timer = setTimeout(checkLeadScoreTriggers, 12000);
    const interval = setInterval(checkLeadScoreTriggers, 60000);
    return () => { clearTimeout(timer); clearInterval(interval); };
  }, []);

  // Automated background checker for squad goals (90% threshold)
  const notifiedSquadsRef = React.useRef<Record<string, boolean>>({});
  useEffect(() => {
    squads.forEach(sq => {
      if (!sq.meta || !sq.faturamentoAlcancado) return;
      const percentage = (sq.faturamentoAlcancado / sq.meta) * 100;
      if (percentage >= 90 && !notifiedSquadsRef.current[sq.id]) {
        addNotification({
          title: "Meta Próxima (90%+)",
          desc: `O ${sq.nome} atingiu 90% da meta mensal! Faturamento atual: R$ ${sq.faturamentoAlcancado.toLocaleString()}`,
          type: "success",
          category: "Performance"
        }, true);
        toast.success(`Alerta de Meta: ${sq.nome} atingiu 90%!`, {
          description: "Excelente desempenho do time.",
          duration: 10000
        });
        notifiedSquadsRef.current[sq.id] = true;
      } else if (percentage < 90) {
        notifiedSquadsRef.current[sq.id] = false;
      }
    });
  }, [squads]);

  const simulateNewLeadAssignment = () => {
    const uniqueSellers = Array.from(new Set(leads.map(l => l.seller).filter(Boolean)));
    if (leads.length === 0 || uniqueSellers.length === 0) return;
    const randomSeller = uniqueSellers[Math.floor(Math.random() * uniqueSellers.length)];
    const randomLead = leads[Math.floor(Math.random() * leads.length)];
    updateLead(randomLead.id, { seller: randomSeller });
  };

  const simulateOverdueTask = () => {
    if (leads.length === 0) return;
    const randomLead = leads[Math.floor(Math.random() * leads.length)];
    const uniqueSellers = Array.from(new Set(leads.map(l => l.seller).filter(Boolean)));
    const randomSellerName = uniqueSellers.length > 0
      ? uniqueSellers[Math.floor(Math.random() * uniqueSellers.length)]
      : "";
    const randomSellerColaborador = (colaboradores as any[]).find(c => c.nome === randomSellerName);

    const today9am = new Date();
    today9am.setHours(9, 0, 0, 0);

    const newTask: Omit<Task, 'id'> = {
      title: "Retornar contato com lead",
      description: "Tipo: Call",
      lead_id: randomLead.id,
      due_date: today9am.toISOString(),
      status: "Atrasado",
      priority: "Alta",
      assigned_to: randomSellerColaborador?.user_id,
    };
    addTask(newTask);
  };

  const triggerScoreRecalculation = async (leadId: string, currentLeadsList?: Lead[], currentActivitiesList?: LeadActivity[]) => {
    const listLeads = currentLeadsList || leads;
    const listActivities = currentActivitiesList || leadActivities;
    const targetLead = listLeads.find(l => l.id === leadId);
    if (!targetLead) return;

    try {
      const response = await apiFetch("/api/leads/calculate-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead: targetLead, activities: listActivities })
      });
      if (response.ok) {
        const result = await response.json();
        setLeads(prev => prev.map(l => l.id === leadId ? {
          ...l,
          scoreIA: result.scoreIA,
          temperature: result.temperature,
          iaSummary: result.iaSummary,
          stageId: (l.pipelineId === 'sdr' && (!l.stageId || l.stageId === 's1' || l.stageId === 's2')) ? 's_qual' : l.stageId
        } : l));

        if (supabase) {
          const updatedStage = (targetLead.pipelineId === 'sdr' && (!targetLead.stageId || targetLead.stageId === 's1' || targetLead.stageId === 's2')) ? 's_qual' : targetLead.stageId;
          await supabase.from('leads').update({
            scoreIA: result.scoreIA,
            temperature: result.temperature,
            iaSummary: result.iaSummary,
            stageId: updatedStage
          }).eq('id', leadId);
        }
      }
    } catch (err) {
      console.error("Failed to run AI score calculation service:", err);
    }
  };

  const addLead = async (lead: Omit<Lead, 'id'>) => {
    const effectiveTenantId = tenantId || user?.tenantId || "default";
    const newId = crypto.randomUUID();
    const newLead = { ...lead, id: newId, scoreIA: 50 };
    setLeads(prev => [newLead, ...prev]);
    toast.success('Novo lead adicionado com sucesso!');
    addNotification({
      title: "Novo Lead",
      desc: `${lead.name} da empresa ${lead.company || "lead"} foi adicionado.`,
      link: `/app/crm/pipeline?leadId=${newId}`,
      category: "CRM",
      type: "success"
    });

    if (supabase) {
      try {
        const rawValue = parseCurrencyBR(lead.value);

        const dbPayload = {
          id: newId,
          name: lead.name,
          company: lead.company ?? '',
          email: lead.email ?? '',
          phone: lead.phone ?? '',
          cnpj: lead.cnpj ?? '',
          seller: lead.seller ?? '',
          title: lead.title ?? '',
          date: lead.date ?? '',
          status: lead.status ?? 'Novo',
          priority: lead.priority ?? 'Média',
          temperature: lead.temperature ?? undefined,
          value: rawValue,
          stageId: lead.stageId ?? '1',
          pipelineId: lead.pipelineId ?? 'comercial',
          scoreIA: 50,
          tenant_id: effectiveTenantId,
          filial_id: activeFilialId,
          tenantName: lead.tenantName ?? '',
          lead_interesse_cliente: lead.lead_interesse_cliente ?? '',
          customFields: lead.customFields ?? {},
          clientId: lead.clientId ?? '',
          clientName: lead.clientName ?? '',
          source: lead.source ?? '',
          productIds: lead.productIds ?? [],
        };

        const { error } = await supabase.from('leads').insert(dbPayload);
        if (error) {
          console.error("Supabase add lead failed:", error.message, error.details);
        }
      } catch (err) {
        console.error("Supabase add lead failed:", err);
      }
    }
    setTimeout(() => { triggerScoreRecalculation(newLead.id, [newLead]); }, 400);
  };

  const updateLead = async (id: string, updates: Partial<Lead>) => {
    let hasStatusOrStageChange = false;
    // Capturado dentro do updater para repassar pro recálculo de score abaixo —
    // sem isso, o setTimeout usava a variável `leads` do closure desta render
    // (o estado ANTES deste update), e reescrevia o stageId antigo no Supabase
    // ~400ms depois, revertendo silenciosamente qualquer mudança de coluna do
    // Kanban (ex: soltar em "Ganho" e o lead voltar pra "Contrato" ao recarregar).
    let mergedLead: Lead | undefined;
    setLeads(prev => {
      const target = prev.find(l => l.id === id);
      if (target && (
        (updates.status !== undefined && updates.status !== target.status) ||
        (updates.stageId !== undefined && updates.stageId !== target.stageId)
      )) {
        hasStatusOrStageChange = true;
      }

      return prev.map(l => {
        if (l.id === id) {
          const updatedLead = { ...l, ...updates };
          mergedLead = updatedLead;
          if (l.pipelineId === 'sdr' && updates.pipelineId === 'comercial') {
            const tempLabel = updatedLead.temperature ? updatedLead.temperature.toUpperCase() : 'Não avaliada';
            toast.success('Lead Qualificado!', {
              description: `${updatedLead.name} foi movido para o Comercial com temperatura ${tempLabel}.`
            });
            addNotification({
              title: "Lead Qualificado (SDR -> Comercial)",
              desc: `O lead ${updatedLead.name} foi qualificado pela Master AI com temperatura ${tempLabel} e enviado ao pipeline comercial.`,
              link: "/app/pipeline",
              type: "success",
              category: "CRM & Vendas"
            });
          }
          if (updates.status === 'Fechado' && l.status !== 'Fechado') {
            addNotification({
              title: "Automação: E-mail de Boas Vindas",
              desc: `Boas vindas enviadas para ${updatedLead.name} por ter se tornado cliente!`,
              type: "success",
              category: "Engajamento"
            });
            toast.success("E-mail de Boas Vindas enviado!");
          }
          return updatedLead;
        }
        return l;
      });
    });

    if (supabase) {
      try {
        // Strip unknown / non-DB fields and fix value type
        const { customTags, productIds, probability, ...safeUpdates } = updates as any;
        if (safeUpdates.value !== undefined) {
          safeUpdates.value = parseCurrencyBR(safeUpdates.value);
        }
        if (productIds !== undefined) {
          safeUpdates.customFields = {
            ...(safeUpdates.customFields || {}),
            productIds,
          };
        }
        if (safeUpdates.scoreIA !== undefined && safeUpdates.score_ia === undefined) {
          safeUpdates.score_ia = safeUpdates.scoreIA;
        }
        const { error } = await supabase.from('leads').update(safeUpdates).eq('id', id);
        if (error) {
          console.error("Supabase update lead failed:", error.message);
          toast.error(`Erro ao salvar lead: ${error.message}`);
        }
      } catch (err) {
        console.error("Supabase update lead failed:", err);
        toast.error("Erro ao salvar lead.");
      }
    }
    if (hasStatusOrStageChange) {
      setTimeout(() => { triggerScoreRecalculation(id, mergedLead ? [mergedLead] : undefined); }, 400);
    }
  };

  const deleteLead = async (id: string) => {
    setLeads(prev => prev.filter(l => l.id !== id));
    toast.info('Lead removido.');
    if (supabase) {
      try {
        await supabase.from('leads').delete().eq('id', id);
      } catch (err) {
        console.error("Supabase delete lead failed:", err);
      }
    }
  };

  const moveLead = async (leadId: string, destStageId: string, index: number) => {
    setLeads(prev => {
      const lead = prev.find(l => l.id === leadId);
      if (!lead) return prev;
      const otherLeads = prev.filter(l => l.id !== leadId);
      const updatedLead = { ...lead, stageId: destStageId };

      if (destStageId === 's_qual' && lead.pipelineId === 'sdr') {
        addNotification({
          title: "Análise Master AI Concluída",
          desc: `O lead ${lead.name} foi movido para Qualificação IA. A análise estrutural da Master AI foi finalizada.`,
          type: "success",
          category: "SDR",
          link: `/app/pipeline?search=${encodeURIComponent(lead.name)}`
        });
      }
      return [...otherLeads, updatedLead];
    });

    if (supabase) {
      try {
        await supabase.from('leads').update({ stageId: destStageId }).eq('id', leadId);
      } catch (err) {
        console.error("Supabase move lead failed:", err);
      }
    }
    setTimeout(() => { triggerScoreRecalculation(leadId); }, 400);
  };

  // Colunas reais da tabela `tasks` — qualquer outro campo (ex.: convidados/
  // calendarLink, usados só pra feedback imediato de Google Calendar na UI)
  // é decorativo no estado local e NUNCA deve ir pro insert/update do Supabase,
  // ou o Postgres rejeita a linha inteira com "column does not exist".
  const TASK_COLUMNS = [
    'id', 'tenant_id', 'lead_id', 'assigned_to', 'creator_id', 'title',
    'description', 'status', 'priority', 'due_date', 'completed_at',
    'created_at', 'updated_at', 'deleted_at', 'filial_id',
  ] as const;

  const pickTaskColumns = (obj: Record<string, any>) => {
    const picked: Record<string, any> = {};
    for (const key of TASK_COLUMNS) {
      if (key in obj) picked[key] = obj[key];
    }
    return picked;
  };

  const addTask = async (task: Omit<Task, 'id'>) => {
    const newTask: Task = { ...task, id: crypto.randomUUID() };
    if (tenantId) newTask.tenant_id = tenantId;
    if (user?.id) newTask.creator_id = user.id;
    newTask.filial_id = activeFilialId ?? null;
    setTasks(prev => [newTask, ...prev]);
    addNotification({
      title: "Nova Tarefa",
      desc: `Agendada: ${task.title}`,
      link: task.lead_id ? `/app/crm/pipeline?leadId=${task.lead_id}` : `/app/tarefas`,
      category: "CRM",
      type: "info"
    }, true);

    if (supabase) {
      const { error } = await supabase.from('tasks').insert(pickTaskColumns(newTask));
      if (error) {
        console.error("[Supabase] insert tasks error:", error.message, error.details);
        setTasks(prev => prev.filter(t => t.id !== newTask.id));
        toast.error(`Erro ao salvar tarefa: ${error.message}`);
        return;
      }
    }
    toast.success('Tarefa agendada!');
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    const previousTask = tasks.find(t => t.id === id);
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    if (supabase) {
      const { error } = await supabase.from('tasks').update(pickTaskColumns(updates)).eq('id', id);
      if (error) {
        console.error("[Supabase] update tasks error:", error.message, error.details);
        if (previousTask) setTasks(prev => prev.map(t => t.id === id ? previousTask : t));
        toast.error(`Erro ao atualizar tarefa: ${error.message}`);
      }
    }
  };

  const deleteTask = async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    toast.info('Tarefa removida.');
    if (supabase) {
      try {
        await supabase.from('tasks').delete().eq('id', id);
      } catch (err) {
        console.error("Supabase delete task failed:", err);
      }
    }
  };

  const addContract = async (contract: Omit<Contract, 'id'>) => {
    const newContract: any = { ...contract, id: Math.random().toString(36).substr(2, 9) };
    if (tenantId) newContract.tenant_id = tenantId;
    newContract.filial_id = activeFilialId;
    setContracts(prev => [...prev, newContract]);
    toast.success('Contrato registrado!');
    addNotification({
      title: "Novo Contrato",
      desc: `Cliente: ${contract.client}`,
      type: "success"
    });

    if (supabase) {
      // `contracts` real não tem client/plan/mrr/date/progress — mapeia pros campos
      // reais (title/value/mrr_value/signed_date), guardando cliente/plano em `notes`
      // já que não existem colunas próprias pra eles. Sem esse remapeamento o insert
      // falhava em 100% dos casos (0 linhas na tabela em produção).
      const mrrNumber = parseCurrencyBR(contract.mrr);
      const dateMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(contract.date);
      const signedDate = dateMatch ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : (/^\d{4}-\d{2}-\d{2}$/.test(contract.date) ? contract.date : null);
      const { error } = await supabase.from('contracts').insert({
        id: newContract.id,
        ...(tenantId ? { tenant_id: tenantId } : {}),
        filial_id: newContract.filial_id,
        title: `${contract.plan} - ${contract.client}`,
        value: mrrNumber,
        mrr_value: mrrNumber,
        status: contract.status,
        ...(signedDate ? { signed_date: signedDate } : {}),
        notes: `Cliente: ${contract.client} | Plano: ${contract.plan}`,
      });
      if (error) {
        console.error("Supabase add contract failed:", error.message);
        toast.error(`Erro ao registrar contrato: ${error.message}`);
      }
    }
  };

  const deleteContract = async (id: string) => {
    setContracts(prev => prev.filter(c => c.id !== id));
    toast.info('Contrato removido.');
    if (supabase) {
      try {
        await supabase.from('contracts').delete().eq('id', id);
      } catch (err) {
        console.error("Supabase delete contract failed:", err);
      }
    }
  };

  const addNotification = (notification: Omit<Notification, 'id' | 'time' | 'date' | 'read'>, push?: boolean) => {
    const newNotification: Notification = {
      ...notification,
      id: Math.random().toString(36).substr(2, 9),
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      date: "Hoje",
      read: false
    };
    if (push) {
      sendPushNotification(newNotification.title, newNotification.desc);
    }
    setNotifications(prev => [newNotification, ...prev]);
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllNotificationsAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const addLeadActivity = async (leadId: string, type: 'Ligação' | 'E-mail' | 'Reunião' | 'Outro', title: string, description: string, seller: string, customDate?: string, files?: { name: string; size: string; }[]) => {
    const newActivity: LeadActivity = {
      id: Math.random().toString(36).substr(2, 9),
      leadId,
      type,
      title,
      description,
      date: customDate || `Hoje, ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
      seller,
      files
    };
    const updatedActivities = [newActivity, ...leadActivities];
    setLeadActivities(updatedActivities);

    if (supabase) {
      // `lead_activities` não tem coluna `files` nem `leadId` (camelCase) — a FK real é
      // `lead_id`, NOT NULL. Sem esse remapeamento o insert falhava em 100% dos casos.
      const { error } = await supabase.from('lead_activities').insert({
        id: newActivity.id,
        lead_id: leadId,
        type: newActivity.type,
        title: newActivity.title,
        description: newActivity.description,
        date: newActivity.date,
        seller: newActivity.seller,
        ...(tenantId ? { tenant_id: tenantId } : {}),
      });
      if (error) {
        console.error("Supabase add lead activity failed:", error.message);
        toast.error(`Erro ao registrar atividade: ${error.message}`);
      }
    }
    triggerScoreRecalculation(leadId, leads, updatedActivities);
  };

  const getSmartInsight = async (context: string, data: any): Promise<string> => {
    try {
      const response = await apiFetch("/api/ai/generic-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, data })
      });
      if (!response.ok) throw new Error("IA offline");
      const result = await response.json();
      return result.insight || "Análise concluída com sucesso.";
    } catch (err) {
      return "Erro na conexão com o motor neural da Master IA.";
    }
  };

  const createCrudHelper = (tableName: string, stateSetter: React.Dispatch<React.SetStateAction<any[]>>, filialAware = false) => {
    return {
      add: async (item: any) => {
        // tenant_id sempre vem do tenant ATIVO (não do que o caller calculou) — garante
        // que criar um registro enquanto um master estiver "dentro" de outro cliente
        // grava nesse cliente, não no tenant de login do master. filial_id só é
        // carimbado em tabelas que de fato têm essa coluna (filialAware).
        const stamped = {
          ...item,
          id: item.id || crypto.randomUUID(),
          ...(tenantId ? { tenant_id: tenantId } : {}),
          ...(filialAware && activeFilialId && item.filial_id === undefined ? { filial_id: activeFilialId } : {}),
        };
        stateSetter(prev => [stamped, ...prev]);
        if (supabase) {
          let payloadToDb = stamped;
          if (tableName === 'products') {
            const allowed = [
              'id', 'sku', 'name', 'category', 'type', 'price', 'cost', 'margin', 'commission',
              'active', 'stockMin', 'stockMax', 'currentStock', 'dimensions', 'weight', 'material',
              'description', 'provider', 'isBestSeller', 'tags', 'tenant_id', 'currency',
              'type_attributes', 'attachments'
            ];
            const pCopy: any = { ...stamped };
            if (pCopy.typeAttributes && !pCopy.type_attributes) pCopy.type_attributes = pCopy.typeAttributes;
            payloadToDb = Object.fromEntries(Object.entries(pCopy).filter(([k]) => allowed.includes(k)));
            if (payloadToDb.price !== undefined) payloadToDb.price = Number(payloadToDb.price) || 0;
            if (payloadToDb.cost !== undefined) payloadToDb.cost = Number(payloadToDb.cost) || 0;
            if (payloadToDb.commission !== undefined) payloadToDb.commission = Number(payloadToDb.commission) || 0;
          }
          const { error } = await supabase.from(tableName).insert(payloadToDb);
          if (error) {
            console.error(`[Supabase] insert ${tableName} error:`, error.message, error.details);
            toast.error(`Erro ao salvar: ${error.message}`);
          }
        }
        return stamped;
      },
      update: async (id: string, updates: any) => {
        // Atualiza estado local imediatamente (optimistic update)
        stateSetter(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
        if (supabase) {
          // Remove campos que podem causar conflito com triggers do banco
          let safeUpdates = { ...updates };
          delete safeUpdates.updated_at;
          if (tableName === 'products') {
            const allowed = [
              'id', 'sku', 'name', 'category', 'type', 'price', 'cost', 'margin', 'commission',
              'active', 'stockMin', 'stockMax', 'currentStock', 'dimensions', 'weight', 'material',
              'description', 'provider', 'isBestSeller', 'tags', 'tenant_id', 'currency',
              'type_attributes', 'attachments'
            ];
            if (safeUpdates.typeAttributes && !safeUpdates.type_attributes) {
              safeUpdates.type_attributes = safeUpdates.typeAttributes;
            }
            safeUpdates = Object.fromEntries(Object.entries(safeUpdates).filter(([k]) => allowed.includes(k)));
            if (safeUpdates.price !== undefined) safeUpdates.price = Number(safeUpdates.price) || 0;
            if (safeUpdates.cost !== undefined) safeUpdates.cost = Number(safeUpdates.cost) || 0;
            if (safeUpdates.commission !== undefined) safeUpdates.commission = Number(safeUpdates.commission) || 0;
          }
          const { error } = await supabase.from(tableName).update(safeUpdates).eq('id', id);
          if (error) {
            console.error(`[Supabase] update ${tableName} error:`, error.message);
            if (error.message?.includes('updated_at')) {
              console.warn(`[Supabase] Trigger issue on ${tableName} — execute a migration 20260827_fix_colaboradores_updated_at.sql no Supabase SQL Editor`);
            }
            toast.error(`Erro ao salvar alterações: ${error.message}`);
          }
        }
      },
      del: async (id: string) => {
        const removed = await new Promise<any>(resolve => {
          stateSetter(prev => {
            resolve(prev.find(item => item.id === id));
            return prev.filter(item => item.id !== id);
          });
        });
        if (!supabase) return true;
        // .select() força o Postgrest a devolver as linhas afetadas — sem isso, um DELETE
        // filtrado a 0 linhas pela RLS (tenant errado, sem permissão) retorna error: null
        // e pareceria bem-sucedido mesmo sem apagar nada no banco.
        const { data, error } = await supabase.from(tableName).delete().eq('id', id).select('id');
        if (error) {
          console.error(`[Supabase] delete ${tableName} error:`, error.message);
          toast.error(`Erro ao remover: ${error.message}`);
          if (removed) stateSetter(prev => [removed, ...prev]);
          return false;
        }
        if (!data || data.length === 0) {
          console.error(`[Supabase] delete ${tableName}: nenhuma linha afetada (id=${id})`);
          toast.error('Não foi possível remover — sem permissão ou registro não encontrado.');
          if (removed) stateSetter(prev => [removed, ...prev]);
          return false;
        }
        return true;
      }
    };
  };

  const productCrud = createCrudHelper('products', setProducts, true);
  const proposalCrud = createCrudHelper('proposals', setProposals, true);
  const proposalItemCrud = createCrudHelper('proposal_items', setProposalItems);

  // Cria uma proposta e seus itens (produtos do catálogo ou avulsos) numa única chamada —
  // usado tanto pela tela de Propostas quanto pelo botão "Vender" no catálogo de Produtos.
  const createProposalWithItems = async (payload: {
    titulo: string;
    cliente: string;
    valor: number;
    validade?: string | null;
    status?: string;
    vendedor: string;
    leadId?: string | null;
    tipo?: 'itens' | 'texto' | 'arquivo';
    conteudoTexto?: string | null;
    linkPdf?: string | null;
    itens?: Array<{ productId?: string | null; descricao: string; quantidade: number; precoUnitario: number }>;
  }) => {
    const proposalId = Math.random().toString(36).substring(2, 9);
    await proposalCrud.add({
      id: proposalId,
      titulo: payload.titulo,
      cliente: payload.cliente,
      valor: payload.valor,
      validade: payload.validade || null,
      status: payload.status || 'Enviada',
      vendedor: payload.vendedor,
      lead_id: payload.leadId || null,
      tipo: payload.tipo || 'itens',
      conteudo_texto: payload.conteudoTexto || null,
      link_pdf: payload.linkPdf || null,
    });
    for (const item of payload.itens || []) {
      await proposalItemCrud.add({
        id: `${proposalId}-${Math.random().toString(36).substring(2, 7)}`,
        proposal_id: proposalId,
        product_id: item.productId || null,
        product_name: item.descricao,
        quantidade: item.quantidade,
        preco_unitario: item.precoUnitario,
      });
    }
    return proposalId;
  };
  const turmaCrud = createCrudHelper('turmas', setTurmas);
  const reuniaoCrud = createCrudHelper('reunioes', setReunioes as any);
  const studentCrud = createCrudHelper('students', setStudents);
  const colabCrud = createCrudHelper('colaboradores', setColaboradores, true);
  const mktCampCrud = createCrudHelper('marketing_campaigns', setMarketingCampaigns);
  const mktContCrud = createCrudHelper('marketing_content', setMarketingContent);
  const mktLpCrud = createCrudHelper('marketing_landing_pages', setMarketingLandingPages);
  const mktFormsCrud = createCrudHelper('marketing_forms', setMarketingForms);
  const mktAutoCrud = createCrudHelper('marketing_automations', setMarketingAutomations);
  const squadMetaCrud = createCrudHelper('squad_metas', setSquadMetas);
  const cargoCrud = createCrudHelper('cargos', setCargos);
  const empresaFilialCrud = createCrudHelper('empresa_filiais', setEmpresaFiliais);
  const nichoCrud = createCrudHelper('nichos', setNichos);
  const financeCategoryCrud = createCrudHelper('finance_categories', setFinanceCategories);
  const financeCommissionEntryCrud = createCrudHelper('finance_commission_entries', setFinanceCommissionEntries);
  const scheduledExportCrud = createCrudHelper('scheduled_exports', setScheduledExports);
  const educationContentCrud = createCrudHelper('education_content', setEducationContent);
  const certCrud = createCrudHelper('certificates', setCertificates);
  const indicacaoCrud = createCrudHelper('indicacoes', setIndicacoes as any);

  const addFinanceEntry = async (entry: Omit<FinanceEntry, 'id'>) => {
    const newEntry: any = { ...entry, id: `f${Math.random().toString(36).substring(2, 9)}` };
    if (tenantId) newEntry.tenant_id = tenantId;
    newEntry.filial_id = activeFilialId;
    setFinanceEntries(prev => [newEntry, ...prev]);
    if (supabase) {
      const { error } = await supabase.from('finance_entries').insert(newEntry);
      if (error) {
        console.error("Supabase add finance_entries failed:", error.message, error.details);
        toast.error(`Erro ao salvar lançamento: ${error.message}`);
        return;
      }
    }
    toast.success(`${entry.type === 'Pagar' ? 'Despesa' : 'Receita'} registrada!`);
  };

  const deleteFinanceEntry = async (id: string) => {
    setFinanceEntries(prev => prev.filter(f => f.id !== id));
    if (supabase) {
      const { error } = await supabase.from('finance_entries').delete().eq('id', id);
      if (error) {
        console.error("Supabase delete finance_entries failed:", error.message);
        toast.error(`Erro ao remover lançamento: ${error.message}`);
        return;
      }
    }
    toast.info('Lançamento financeiro removido.');
  };

  const updateFinanceEntry = async (id: string, updates: Partial<FinanceEntry>) => {
    setFinanceEntries(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
    if (supabase) {
      const { error } = await supabase.from('finance_entries').update(updates).eq('id', id);
      if (error) {
        console.error("Supabase update finance_entries failed:", error.message);
        toast.error(`Erro ao atualizar lançamento: ${error.message}`);
      }
    }
  };

  const addAppointment = async (apt: Omit<Appointment, 'id'>) => {
    const newApt: any = { ...apt, id: Math.random().toString(36).substr(2, 9) };
    if (tenantId) newApt.tenant_id = tenantId;
    newApt.filial_id = activeFilialId;
    setAppointments(prev => [newApt, ...prev]);
    toast.success('Agendamento realizado!');
    if (supabase) {
      try {
        const { id, patient, patientId, phone, drId, drName, specialty, room, type, status, date, time } = newApt as any;
        await supabase.from('appointments').insert({
          id, patient, patient_id: patientId ?? null, phone, dr_id: drId, dr_name: drName, specialty, room, type, status, date, time,
          tenant_id: newApt.tenant_id, filial_id: newApt.filial_id,
        });
      } catch (err) {
        console.error("Supabase add appointment failed:", err);
      }
    }
  };

  const updateAppointment = async (id: string, updates: Partial<Appointment>) => {
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
    if (supabase) {
      try {
        const payload: any = { ...updates };
        if ('drId' in payload) payload.dr_id = payload.drId;
        if ('drName' in payload) payload.dr_name = payload.drName;
        if ('patientId' in payload) payload.patient_id = payload.patientId;
        delete payload.drId; delete payload.drName; delete payload.patientId;
        await supabase.from('appointments').update(payload).eq('id', id);
      } catch (err) {
        console.error("Supabase update appointment failed:", err);
      }
    }
  };

  const deleteAppointment = async (id: string) => {
    setAppointments(prev => prev.filter(a => a.id !== id));
    toast.info('Agendamento removido.');
    if (supabase) {
      try {
        await supabase.from('appointments').delete().eq('id', id);
      } catch (err) {
        console.error("Supabase delete appointment failed:", err);
      }
    }
  };

  return (
    <DataContext.Provider value={{
      leads, tasks, contracts, notifications, leadActivities, financeEntries, appointments,
      theme, toggleTheme,
      addLead, updateLead, deleteLead, moveLead,
      addTask, updateTask, deleteTask, addContract, deleteContract,
      addNotification, markNotificationAsRead, markAllNotificationsAsRead,
      addLeadActivity,
      getSmartInsight,
      addFinanceEntry, deleteFinanceEntry, updateFinanceEntry,
      addAppointment, updateAppointment, deleteAppointment,
      simulateNewLeadAssignment,
      simulateOverdueTask,
      whatsappWebhookUrl,
      setWhatsappWebhookUrl: updateWhatsappWebhookUrl,
      customLeadFields,
      setCustomLeadFields: updateCustomLeadFields,
      leadScoreTriggers,
      setLeadScoreTriggers: updateLeadScoreTriggers,
      sidebarModules,
      setSidebarModules,
      tenantPrimaryColor,
      updateTenantPrimaryColor,
      saveAppSetting,
      appSettings,
      appSettingsLoaded,
      globalWebhooks,
      addGlobalWebhook,
      updateGlobalWebhook,
      deleteGlobalWebhook,
      toggleGlobalWebhook,
      squads,
      updateSquad,
      addSquad,
      deleteSquad,
      funis,
      addFunil,
      updateFunil,
      deleteFunil,
      empresaFiliais,
      addEmpresaFilial: empresaFilialCrud.add,
      updateEmpresaFilial: empresaFilialCrud.update,
      deleteEmpresaFilial: empresaFilialCrud.del,
      nichos,
      addNicho: nichoCrud.add,
      updateNicho: nichoCrud.update,
      deleteNicho: nichoCrud.del,
      financeCategories,
      addFinanceCategory: financeCategoryCrud.add,
      updateFinanceCategory: financeCategoryCrud.update,
      deleteFinanceCategory: financeCategoryCrud.del,
      financeCommissionEntries,
      addFinanceCommissionEntry: financeCommissionEntryCrud.add,
      updateFinanceCommissionEntry: financeCommissionEntryCrud.update,
      deleteFinanceCommissionEntry: financeCommissionEntryCrud.del,
      scheduledExports,
      addScheduledExport: scheduledExportCrud.add,
      updateScheduledExport: scheduledExportCrud.update,
      deleteScheduledExport: scheduledExportCrud.del,
      educationContent,
      addEducationContent: educationContentCrud.add,
      updateEducationContent: educationContentCrud.update,
      deleteEducationContent: educationContentCrud.del,
      addCertificate: certCrud.add,
      updateCertificate: certCrud.update,
      deleteCertificate: certCrud.del,
      marketingAutomations,
      setMarketingAutomations,
      addMarketingAutomation: mktAutoCrud.add,
      updateMarketingAutomation: mktAutoCrud.update,
      deleteMarketingAutomation: mktAutoCrud.del,
      marketingContent,
      setMarketingContent,
      addMarketingContent: mktContCrud.add,
      updateMarketingContent: mktContCrud.update,
      deleteMarketingContent: mktContCrud.del,
      marketingCampaigns,
      setMarketingCampaigns,
      addMarketingCampaign: mktCampCrud.add,
      updateMarketingCampaign: mktCampCrud.update,
      deleteMarketingCampaign: mktCampCrud.del,
      marketingLandingPages,
      setMarketingLandingPages,
      addMarketingLandingPage: mktLpCrud.add,
      updateMarketingLandingPage: mktLpCrud.update,
      deleteMarketingLandingPage: mktLpCrud.del,
      marketingForms,
      setMarketingForms,
      addMarketingForm: mktFormsCrud.add,
      updateMarketingForm: mktFormsCrud.update,
      deleteMarketingForm: mktFormsCrud.del,
      products,
      setProducts,
      addProduct: productCrud.add,
      updateProduct: productCrud.update,
      deleteProduct: productCrud.del,
      proposals,
      setProposals,
      addProposal: proposalCrud.add,
      updateProposal: proposalCrud.update,
      deleteProposal: proposalCrud.del,
      proposalItems,
      createProposalWithItems,
      certificates,
      setCertificates,
      turmas,
      setTurmas,
      addTurma: turmaCrud.add,
      updateTurma: turmaCrud.update,
      deleteTurma: turmaCrud.del,
      reunioes,
      addReuniao: (r: Omit<Reuniao, 'id' | 'createdAt'>) => reuniaoCrud.add({ ...r, createdAt: new Date().toISOString() }),
      updateReuniao: reuniaoCrud.update,
      deleteReuniao: reuniaoCrud.del,
      indicacoes,
      addIndicacao: indicacaoCrud.add,
      updateIndicacao: indicacaoCrud.update,
      deleteIndicacao: indicacaoCrud.del,
      students,
      setStudents,
      addStudent: studentCrud.add,
      updateStudent: studentCrud.update,
      deleteStudent: studentCrud.del,
      colaboradores,
      setColaboradores,
      addColaborador: colabCrud.add,
      updateColaborador: colabCrud.update,
      deleteColaborador: colabCrud.del,
      squadMetas,
      setSquadMetas,
      addSquadMeta: squadMetaCrud.add,
      updateSquadMeta: squadMetaCrud.update,
      deleteSquadMeta: squadMetaCrud.del,
      financialGoals,
      cargos,
      setCargos,
      addCargo: cargoCrud.add,
      updateCargo: cargoCrud.update,
      deleteCargo: cargoCrud.del,
      clienteBase,
      setClienteBase,
    }}>
      {children}
    </DataContext.Provider>
  );
}
