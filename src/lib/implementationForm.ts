/**
 * Definição do formulário de implantação (CRM > Implementações). Vive no
 * código — as respostas ficam em `implementations.data` (jsonb) chaveadas
 * por `field.id`, então adicionar/renomear campo aqui não exige migração.
 *
 * NUNCA pedir senha/token de acesso neste formulário: integrações registram
 * só STATUS e identificadores públicos (ID do pixel, número...). Acesso é
 * concedido na própria plataforma (ex.: Business Manager), não digitado aqui.
 */

export type ImplFieldType = "text" | "textarea" | "select" | "boolean" | "date";
/** `client` = o cliente pode preencher pelo link público (Etapa 2); `internal` = só a equipe. */
export type ImplAudience = "client" | "internal";
/** Como o campo conta pro progresso: `answered` = preenchido; `status` = Concluída/Não se aplica; `check` = marcado. Sem `track` não conta. */
export type ImplTrack = "answered" | "status" | "check";

export interface ImplField {
  id: string;
  label: string;
  type: ImplFieldType;
  audience: ImplAudience;
  options?: string[];
  help?: string;
  placeholder?: string;
  track?: ImplTrack;
  /** Subtítulo exibido quando muda de um campo pro outro dentro da seção. */
  group?: string;
}

export interface ImplSection {
  id: string;
  title: string;
  description: string;
  fields: ImplField[];
}

export const INTEGRATION_STATUS_OPTIONS = ["Pendente", "Em andamento", "Concluída", "Não se aplica"];

export const IMPLEMENTATION_STATUSES = ["Em andamento", "Aguardando cliente", "Bloqueada", "Concluída"] as const;
export type ImplementationStatus = (typeof IMPLEMENTATION_STATUSES)[number];

export const IMPLEMENTATION_STATUS_TONE: Record<ImplementationStatus, string> = {
  "Em andamento": "bg-blue-500/10 text-blue-500 border-blue-500/30",
  "Aguardando cliente": "bg-amber-500/10 text-amber-500 border-amber-500/30",
  Bloqueada: "bg-rose-500/10 text-rose-500 border-rose-500/30",
  "Concluída": "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
};

const statusField = (id: string, label: string, group?: string): ImplField => ({
  id, label, type: "select", options: INTEGRATION_STATUS_OPTIONS, audience: "internal", track: "status", group,
});

export const IMPLEMENTATION_SECTIONS: ImplSection[] = [
  {
    id: "empresa",
    title: "Dados da empresa",
    description: "Quem é o cliente e como a operação funciona hoje.",
    fields: [
      { id: "razao_social", label: "Razão social", type: "text", audience: "client", track: "answered" },
      { id: "nome_fantasia", label: "Nome fantasia", type: "text", audience: "client" },
      { id: "cnpj", label: "CNPJ", type: "text", audience: "client", track: "answered" },
      { id: "segmento", label: "Segmento de atuação", type: "text", audience: "client", track: "answered" },
      { id: "site", label: "Site / Instagram", type: "text", audience: "client" },
      { id: "endereco", label: "Endereço", type: "text", audience: "client" },
      { id: "faixa_colaboradores", label: "Nº de colaboradores", type: "select", options: ["1–5", "6–20", "21–50", "51–200", "200+"], audience: "client" },
      { id: "operacao_descricao", label: "Como a operação funciona hoje?", type: "textarea", audience: "client", track: "answered", help: "Do primeiro contato do cliente até a entrega/cobrança." },
    ],
  },
  {
    id: "responsaveis",
    title: "Responsáveis",
    description: "Quem fala com a gente e quem valida o go-live.",
    fields: [
      { id: "resp_nome", label: "Responsável principal", type: "text", audience: "client", track: "answered" },
      { id: "resp_cargo", label: "Cargo", type: "text", audience: "client" },
      { id: "resp_whatsapp", label: "WhatsApp", type: "text", audience: "client", track: "answered" },
      { id: "resp_email", label: "E-mail", type: "text", audience: "client", track: "answered" },
      { id: "tec_nome", label: "Responsável técnico", type: "text", audience: "client", help: "Quem gerencia domínio, DNS e contas de anúncio." },
      { id: "tec_contato", label: "Contato do responsável técnico", type: "text", audience: "client" },
      { id: "decisor_nome", label: "Sócio/decisor que valida o go-live", type: "text", audience: "client" },
    ],
  },
  {
    id: "comercial",
    title: "CRM & Comercial",
    description: "Como o time vende e o que precisa entrar configurado no SPY.",
    fields: [
      { id: "qtd_usuarios", label: "Quantos usuários vão usar o sistema?", type: "text", audience: "client", track: "answered" },
      { id: "usuarios_lista", label: "Usuários (nome, e-mail e perfil)", type: "textarea", audience: "client", help: "Um por linha. Ex.: Maria — maria@empresa.com — Vendedora" },
      { id: "etapas_funil", label: "Etapas do funil de vendas", type: "textarea", audience: "client", track: "answered", help: "Ex.: Novo lead → Qualificado → Proposta → Fechado" },
      { id: "origens_leads", label: "De onde vêm os leads hoje?", type: "textarea", audience: "client" },
      { id: "meta_mensal", label: "Meta mensal de vendas", type: "text", audience: "client" },
      { id: "importar_base", label: "Tem base de clientes/leads pra importar?", type: "boolean", audience: "client" },
      { id: "importar_base_origem", label: "Onde está essa base? (planilha, outro CRM…)", type: "text", audience: "client" },
    ],
  },
  {
    id: "integracoes",
    title: "Integrações",
    description: "Cada integração tem o que o cliente informa e o status que a equipe controla. Não colocar senhas aqui.",
    fields: [
      { id: "whats_usa", label: "Vai usar WhatsApp?", type: "boolean", audience: "client", group: "WhatsApp" },
      { id: "whats_numero", label: "Número que será conectado", type: "text", audience: "client", group: "WhatsApp" },
      { id: "whats_tipo", label: "Tipo de conta", type: "select", options: ["WhatsApp Business (app)", "API oficial (Meta)", "Ainda não sei"], audience: "client", group: "WhatsApp" },
      statusField("whats_status", "Status da integração", "WhatsApp"),

      { id: "meta_usa", label: "Investe em Meta Ads (Facebook/Instagram)?", type: "boolean", audience: "client", group: "Meta Ads" },
      { id: "meta_conta_id", label: "ID da conta de anúncios", type: "text", audience: "client", group: "Meta Ads" },
      { id: "meta_pixel_id", label: "ID do Pixel", type: "text", audience: "client", group: "Meta Ads" },
      { id: "meta_acesso", label: "Já concedeu acesso no Business Manager?", type: "boolean", audience: "client", group: "Meta Ads" },
      statusField("meta_status", "Status da integração", "Meta Ads"),

      { id: "google_usa", label: "Investe em Google Ads / usa GA4?", type: "boolean", audience: "client", group: "Google Ads / GA4" },
      { id: "google_ads_id", label: "ID da conta Google Ads", type: "text", audience: "client", group: "Google Ads / GA4" },
      { id: "google_ga4_id", label: "ID da propriedade GA4", type: "text", audience: "client", group: "Google Ads / GA4" },
      { id: "google_acesso", label: "Já concedeu acesso?", type: "boolean", audience: "client", group: "Google Ads / GA4" },
      statusField("google_status", "Status da integração", "Google Ads / GA4"),

      { id: "pag_gateway", label: "Gateway de pagamento", type: "select", options: ["Mercado Pago", "Stripe", "Asaas", "Outro", "Nenhum"], audience: "client", group: "Pagamentos" },
      { id: "pag_conta_criada", label: "A conta no gateway já existe?", type: "boolean", audience: "client", group: "Pagamentos" },
      statusField("pag_status", "Status da integração", "Pagamentos"),

      { id: "email_usa", label: "Vai enviar e-mails pelo sistema?", type: "boolean", audience: "client", group: "E-mail (SMTP)" },
      { id: "email_provedor", label: "Provedor de e-mail", type: "text", audience: "client", group: "E-mail (SMTP)" },
      { id: "email_remetente", label: "E-mail remetente", type: "text", audience: "client", group: "E-mail (SMTP)" },
      statusField("email_status", "Status da integração", "E-mail (SMTP)"),

      { id: "dominio", label: "Domínio", type: "text", audience: "client", group: "Domínio / Site" },
      { id: "dominio_dns_por", label: "Quem gerencia o DNS?", type: "text", audience: "client", group: "Domínio / Site" },
      statusField("dominio_status", "Status da integração", "Domínio / Site"),

      { id: "agenda_usa", label: "Usa Google Calendar pra agendar reuniões?", type: "boolean", audience: "client", group: "Agenda" },
      statusField("agenda_status", "Status da integração", "Agenda"),

      { id: "outras_integracoes", label: "Outras ferramentas que precisam se conectar", type: "textarea", audience: "client", group: "Outras" },
    ],
  },
  {
    id: "financeiro",
    title: "Financeiro",
    description: "Como o cliente cobra e recebe.",
    fields: [
      { id: "fin_cobranca_auto", label: "Quer cobrança automática?", type: "boolean", audience: "client" },
      { id: "fin_formas", label: "Formas de recebimento", type: "select", options: ["Pix", "Boleto", "Cartão", "Várias"], audience: "client" },
      { id: "fin_importar", label: "Precisa importar lançamentos existentes?", type: "boolean", audience: "client" },
      { id: "fin_obs", label: "Observações do financeiro", type: "textarea", audience: "client" },
      statusField("fin_status", "Status da configuração do financeiro"),
    ],
  },
  {
    id: "aurora",
    title: "Aurora (IA)",
    description: "Como o assistente deve falar e atender.",
    fields: [
      { id: "ia_usar", label: "Vai usar a Aurora no atendimento?", type: "boolean", audience: "client" },
      { id: "ia_tom", label: "Tom de voz", type: "select", options: ["Formal", "Consultivo", "Descontraído"], audience: "client" },
      { id: "ia_horario", label: "Horário de atendimento", type: "text", audience: "client" },
      { id: "ia_transferir", label: "Quando passar pra um humano?", type: "textarea", audience: "client" },
      { id: "ia_faq", label: "Perguntas frequentes dos clientes", type: "textarea", audience: "client" },
      { id: "ia_produtos", label: "Produtos/serviços que a Aurora pode oferecer", type: "textarea", audience: "client" },
      statusField("ia_status", "Status da configuração da Aurora"),
    ],
  },
  {
    id: "golive",
    title: "Go-live (equipe)",
    description: "Checklist interno de entrega — não aparece pro cliente.",
    fields: [
      { id: "chk_usuarios", label: "Usuários criados", type: "boolean", audience: "internal", track: "check" },
      { id: "chk_funil", label: "Funil configurado", type: "boolean", audience: "internal", track: "check" },
      { id: "chk_base", label: "Base importada", type: "boolean", audience: "internal", track: "check" },
      { id: "chk_integracoes", label: "Integrações testadas ponta a ponta", type: "boolean", audience: "internal", track: "check" },
      { id: "chk_treinamento", label: "Treinamento realizado", type: "boolean", audience: "internal", track: "check" },
      { id: "chk_validacao", label: "Cliente validou a entrega", type: "boolean", audience: "internal", track: "check" },
      { id: "golive_obs", label: "Observações do go-live", type: "textarea", audience: "internal" },
    ],
  },
];

export type ImplData = Record<string, any>;

export function isFieldDone(field: ImplField, data: ImplData): boolean {
  const v = data?.[field.id];
  if (field.track === "answered") return typeof v === "string" ? v.trim().length > 0 : !!v;
  if (field.track === "status") return v === "Concluída" || v === "Não se aplica";
  if (field.track === "check") return v === true;
  return false;
}

export function isFieldFilled(field: ImplField, data: ImplData): boolean {
  const v = data?.[field.id];
  if (field.type === "boolean") return v === true || v === false;
  return typeof v === "string" ? v.trim().length > 0 : v !== undefined && v !== null && v !== "";
}

export interface ImplProgress { done: number; total: number; percent: number }

const toProgress = (done: number, total: number): ImplProgress => ({
  done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100),
});

/** Progresso geral e por seção — só campos com `track` contam. */
export function computeProgress(data: ImplData): { overall: ImplProgress; sections: Record<string, ImplProgress> } {
  let done = 0, total = 0;
  const sections: Record<string, ImplProgress> = {};
  for (const s of IMPLEMENTATION_SECTIONS) {
    const tracked = s.fields.filter(f => f.track);
    const sDone = tracked.filter(f => isFieldDone(f, data)).length;
    sections[s.id] = toProgress(sDone, tracked.length);
    done += sDone;
    total += tracked.length;
  }
  return { overall: toProgress(done, total), sections };
}

/** Campos acompanhados que ainda não estão prontos — usado em "O que falta" no relatório. */
export function pendingFields(data: ImplData, audience?: ImplAudience): { section: ImplSection; field: ImplField }[] {
  const out: { section: ImplSection; field: ImplField }[] = [];
  for (const section of IMPLEMENTATION_SECTIONS) {
    for (const field of section.fields) {
      if (!field.track || isFieldDone(field, data)) continue;
      if (audience && field.audience !== audience) continue;
      out.push({ section, field });
    }
  }
  return out;
}
