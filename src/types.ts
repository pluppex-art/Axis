export type ProductType = "Serviço" | "Assinatura" | "Digital" | "Físico" | "Imóvel" | "Curso/Turma";

export interface ProductAttachment {
    name: string;
    size: string;
    date: string;
    type: string;
    url: string;
    path: string;
}

export interface Product {
    id: string;
    sku: string;
    name: string;
    category: string;
    type: ProductType;
    price: number;
    cost: number;
    margin: number;
    commission: number;
    active: boolean;
    stockMin: number;
    stockMax: number;
    currentStock: number;
    dimensions?: string;
    weight?: number;
    material?: string;
    description?: string;
    provider: string;
    isBestSeller?: boolean;
    tags: string[];
    attachments?: ProductAttachment[];
    /** Campos que variam por `type` (ex.: endereço/área pra Imóvel, ciclo de
     * cobrança pra Assinatura) — ver src/pages/operative/produtos/produto-modal/ProdutoTabInfo.tsx. */
    typeAttributes?: Record<string, string | number | boolean>;
    /** Recorrência e Duração (SaaS / Assinatura / Serviços Recorrentes) */
    recurrence?: boolean;
    billingCycle?: "Mensal" | "Trimestral" | "Semestral" | "Anual" | "Pontual";
    contractMonths?: number;
    /** Implantação / Setup / Onboarding */
    hasImplementation?: boolean;
    implementationFee?: number;
}

export interface CustomField {
  id: string;
  name: string;
  type: 'Texto' | 'Número' | 'Data';
  required: boolean;
  validationRegex?: string;
}

export interface LeadScoreTrigger {
  id: string;
  scoreThreshold: number;
  condition: 'greater' | 'less';
  targetStageId: string;
  autoMessage: boolean;
}

export interface Lead {
  createdAt?: string;
  id: string;
  name: string;
  company: string;
  cnpj?: string;
  email: string;
  phone: string;
  status: string;
  value: any;
  date: string;
  seller: string;
  source?: string;
  title: string;
  priority?: 'Alta' | 'Média' | 'Baixa';
  stageId: string;
  lead_interesse_cliente?: string;
  pipelineId?: 'sdr' | 'comercial';
  scoreIA?: number;
  /** Derivado do score (0-100) — sem coluna própria em `leads`; updateLead() o descarta antes de gravar. */
  probability?: number;
  temperature?: 'frio' | 'morno' | 'quente';
  iaSummary?: string;
  timeIdle?: number;
  customFields?: Record<string, any>;
  tenantName?: string;
  tenantId?: string;
  clientId?: string;
  clientName?: string;
  productIds?: string[];
  notes?: string;
  tags?: string[];
}

/**
 * Espelha 1:1 as colunas reais da tabela `tasks` no Supabase — ver
 * DataContext.tsx `addTask`/`updateTask` para o motivo de manter esse
 * espelhamento exato (evita inserts com colunas inexistentes, que falhavam
 * silenciosamente antes desse type ser corrigido).
 *
 * Campos que existiam aqui antes mas NÃO têm coluna correspondente no banco
 * foram removidos ou remapeados:
 * - `related` (string livre "empresa X") → `lead_id` (uuid, FK real pra `leads`).
 *   Telas resolvem o nome pra exibição via `leads` do useData(), não mais por
 *   comparação de string.
 * - `seller`/`responsible` (nome em texto) → `assigned_to` (uuid do colaborador).
 *   Telas resolvem o nome exibido via `colaboradores` do useData().
 * - `type`, `tags`, `relatedProductIds` não têm coluna própria — quando havia
 *   informação relevante nesses campos, ela é dobrada dentro de `description`
 *   (texto livre) no momento da criação da tarefa, em vez de inventar schema novo.
 */
export interface Task {
  id: string;
  tenant_id?: string;
  /** FK pra `leads.id` — tarefa vinculada a um lead específico (ou null/undefined = interna). */
  lead_id?: string | null;
  /** uuid do colaborador responsável (ver `Colaborador.id`), não um nome em texto. */
  assigned_to?: string | null;
  creator_id?: string | null;
  title: string;
  description?: string;
  status: 'Atrasado' | 'Cancelado' | 'Em Aberto' | 'Concluída' | 'A Fazer' | 'Aguardando';
  priority?: 'Alta' | 'Média' | 'Baixa';
  /** ISO datetime — prazo/agendamento da tarefa. */
  due_date?: string | null;
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
  filial_id?: string | null;

  // Campos auxiliares de integração com Google Calendar — não são colunas da
  // tabela `tasks` (removidos do payload antes do insert/update em
  // DataContext.tsx), existem só pra feedback imediato na sessão atual
  // (ex.: exibir o link do evento criado logo após salvar).
  convidados?: string[];
  calendarLink?: string;
  googleEventId?: string;
}

export interface Colaborador {
  id: string;
  nome: string;
  cargo: string;
  departamento: string;
  status: 'Ativo' | 'Férias' | 'Afastado' | 'Desligado';
  dataAdmissao: string;
  email: string;
  avatar?: string;
  desempenho: number; // 0-100
  rotationActive?: boolean;
  rotationBlocked?: boolean;
  rotationLeadTypes?: string[];
}

export interface Squad {
  id: string;
  nome: string;
  departamento?: string;
  leader?: string;
  cor?: string;
  logo?: string;
  focoComercial: string;
  membros: string[];
  membrosFuncoes?: Record<string, string>;
  clientes?: string[];
  meta?: number;
  orcamentoMensal?: number;
  faturamentoAlcancado?: number;
  sdrCount?: number;
  closersCount?: number;
}

export interface Contract {
  id: string;
  client: string;
  plan: string;
  mrr: string | number;
  status: string;
  date: string;
  progress: number;
}

export interface LeadActivity {
  id: string;
  leadId: string;
  type: string;
  title: string;
  description: string;
  seller: string;
  date: string;
  files?: any[];
}

export interface FinanceEntry {
  id: string;
  description: string;
  category: string;
  status: string;
  value: number;
  type: 'Pagar' | 'Receber';
  date: string;
}

export interface GlobalWebhook {
  id: string;
  endpoint: string;
  event: string;
  active: boolean;
}

export interface Notification {
  id: string;
  title: string;
  desc: string;
  time: string;
  date: string;
  type: 'success' | 'error' | 'info' | 'warning';
  category: string;
  read: boolean;
}

export interface Appointment {
  id: string;
  time: string;
  patient: string;
  drId: string;
  drName: string;
  status: string;
  type: string;
  room: string;
  specialty: string;
  phone: string;
  date: string;
  notes?: string;
}
