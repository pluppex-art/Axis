# API

Todas as rotas vivem em `server.ts` (Express) e `server/googleCalendar.ts`, servidas via `api/index.ts` na Vercel. Base path: `/api`.

> **Inventário completo, rota a rota** (entrada, resposta, erros, tabelas, cache, limiter e achados de segurança): [`projeto/02-TRD.md`](projeto/02-TRD.md) §14.2, e matriz middleware × rota em §19.1. Este documento é um resumo por grupo — em caso de divergência, vale o TRD (verificado em 2026-09-24).

**Autenticação** (ver [AUTHENTICATION.md](AUTHENTICATION.md)/[AUTHORIZATION.md](AUTHORIZATION.md) para detalhe):
- `requireUser` — header `Authorization: Bearer <jwt-do-supabase-auth>`. Anexa `req.user` e `req.supabase` (client escopado pela sessão — toda query subsequente respeita RLS automaticamente).
- `requireApiKey` — header `x-api-key: <chave>`. O tenant vem do mapeamento `SPY_API_KEYS` (`chave:tenantId`), nunca do corpo da requisição.
- `requireMaster` — usado depois de `requireUser`; confirma `users.is_master=true` no banco.
- `requireTenantAdmin` — depois de `requireUser`; exige `is_master` ou `users.is_tenant_admin` (usado em `/api/integrations/external*`).
- Rotas **públicas** (sem nenhum dos anteriores) estão listadas na seção própria abaixo.

**Rate limiting** (`express-rate-limit`, janela de 60 s): `/api/v1/*` 60/min por chave; `/api/leads` e `/api/ai` 20/min por IP; `/api/whatsapp` e `/api/google-calendar` 60/min; `/api/public/lead-capture` 5/min. Resumos/listas, `/api/admin/*`, `/api/integrations/*` e `/api/settings/*` não tinham limiter em 2026-09-24. Ver `server.ts` (bloco de `app.use(...Limiter)`) pros valores atuais.

**Cache Redis** (`server/redisClient.ts`, opcional via `REDIS_URL`, falha aberta): resumos e listas (`/api/dashboard/*`, `/api/finance/*-summary`, `/api/crm/*-list`, `/api/operative/*-list`, `/api/data/table-preview`…) usam cache-aside por TTL (20–60 s) com header `X-Cache: HIT|MISS`. A chave é por tenant, não por usuário — ver o achado em TRD §14.2.

---

## API pública (por chave)

### `POST /api/v1/leads`
Cria um lead. **Auth:** `requireApiKey`. **Tenant:** da chave de API. **Body:** `name` (obrigatório), `company`, `email`, `phone`, `cnpj`, `title`, `seller`, `source`, `status`, `priority`, `value`, `stageId`, `pipelineId`, `customFields`, `clientId`, `clientName`, `productIds`. **Resposta:** `201 { success, lead }` ou `500 { error }` (mensagem genérica; detalhe só em log). Usa `supabaseService` (service_role) — a única forma de escrever sem sessão de usuário.

### `GET /api/v1/leads`
Lista leads do tenant da chave. **Auth:** `requireApiKey`. **Query:** `seller`, `status`, `limit` (default 100), `offset`. **Resposta:** `{ success, count, leads }`.

### `POST /api/v1/lead-activities`
Registra uma atividade (nota, ligação, avaliação, sugestão etc.) no histórico de um lead **já existente**. **Auth:** `requireApiKey`. **Body:** `phone`/`email` (ao menos um, usados só pra localizar o lead — nunca cria um novo), `type`, `title` (obrigatório), `description`, `date`, `seller`, `externalId` (opcional, garante idempotência via `id = tnp_live_<externalId>`). **Resposta:** `201 { success }`, ou `200 { success, skipped: true }` se não achar lead pro contato.

### `POST /api/v1/finance-entries`
Cria ou atualiza (upsert por `externalId`) um lançamento em `finance_entries`. **Auth:** `requireApiKey`. **Body:** `externalId` (obrigatório — chave de idempotência, vira `id = tnp_fat_<externalId>`), `description` (obrigatório), `value`, `date`, `category`, `type` (default `"Receber"`), `status` (default `"Pago"`). **Resposta:** `201 { success }`.

---

## Rotas públicas (sem autenticação)

Usam `service_role` no servidor; por isso cada uma valida o próprio escopo. Detalhes e achados em [TRD §14.2](projeto/02-TRD.md).

| Rota | O que faz |
|---|---|
| `POST /api/public/lead-capture` | Captura de lead do formulário público; tenant fixo por `SPY_FORM_TENANT_ID` (nunca do corpo). Limiter 5/min por IP |
| `GET /api/public-proposal/:token` | Dados da proposta pública (token `view_token`, ≥ 16 caracteres); incrementa visualizações |
| `POST /api/public-proposal/:token/accept` | Aceite público da proposta (marca `status='Aceita'`) |
| `GET /api/auth/tenant-theme` | Cor/nome do tenant por e-mail, host ou nome (tela de login) |
| `POST /api/whatsapp/webhook/:instanceId?secret=` | **Webhook de entrada do WAHA** (ver [WEBHOOKS.md](WEBHOOKS.md)) |
| `GET /api/google-calendar/oauth/callback` | Callback OAuth do Google (valida `state` HMAC) |
| `GET /api/health/redis` | Saúde do Redis (`{configured, connected, latencyMs}`) |

## Resumos e listas cacheados (sessão de usuário)

`GET` com `requireUser` + cliente RLS, `?tenantId=` opcional validado por `has_tenant_access`: `/api/dashboard/summary`, `/api/dashboard/bi-summary`, `/api/finance/{visao-geral,inadimplencia,dre,performance-mensal,performance-anual,fluxo-caixa}-summary`, `/api/marketing/{campanhas,analytics}-summary`, `/api/crm/{relatorios-executivos,dashboard-performance}-summary`, `/api/clinica/*-summary`, `/api/education/mensalidades-summary`, `/api/crm/{leads,clientes,reunioes}-list`, `/api/operative/{produtos,tasks}-list`, `/api/finance/entries-list` e `/api/data/table-preview?table=` (allowlist). São aproximações com teto de linhas; a fonte de verdade é a busca do `DataContext`.

## IA / Leads (sessão de usuário)

Todas exigem `requireUser`. Nenhuma tem checagem de papel adicional — qualquer usuário autenticado do tenant pode chamar.

| Rota | O que faz |
|---|---|
| `POST /api/leads/suggest-tags` | Sugere tags pra um lead via IA |
| `POST /api/cnpj/validate` | Valida/enriquece um CNPJ |
| `POST /api/leads/calculate-score` | Recalcula `scoreIA`/`temperature`/`iaSummary` de um lead |
| `POST /api/ai/performance-audit` | Auditoria de performance de vendas via IA |
| `POST /api/ai/pipeline-audit` | Auditoria do pipeline via IA |
| `POST /api/ai/marketing-advisor` | Sugestões de marketing via IA |
| `POST /api/ai/settings-audit` | Auditoria de configurações via IA |
| `POST /api/ai/suggest-new-config` | Sugere nova configuração via IA |
| `POST /api/ai/generic-insight` | Insight genérico via IA (usado por vários módulos) |
| `POST /api/ai/aurora-chat` | Proxy pro webhook n8n da Aurora (chat). URL do webhook nunca é devolvida ao cliente |
| `POST /api/ai/aurora-tenant-chat` | Aurora "operacional": Gemini com ferramentas que consultam dados do tenant via `req.supabase` (RLS) |
| `POST /api/ai/student-performance-insight`, `/solar-analyze-fatura`, `/content-script` | Insights de educação, OCR de fatura solar (imagem ≤ ~4 MB) e roteiro de conteúdo |
| `POST /api/ai/corrigir-nota` | Corrige/formata uma nota via IA |
| `POST /api/ai/lead-copilot` | Copiloto de vendas por lead |
| `POST /api/ai/reuniao-relatorio` | Gera relatório de reunião via IA; grava em `reunioes` usando `req.supabase` (RLS aplica) |

## Settings genéricos (fallback em memória)

`crm_funis`/`sources`/`custom-fields`/`task-categories`/`templates` que não têm tabela própria no banco caem num fallback em memória, isolado por tenant (`current_tenant_id()` via RPC).

| Rota | O que faz |
|---|---|
| `GET /api/settings/:category` | Lê a categoria (`sources`, `custom-fields`, `task-categories`, `templates`) |
| `POST /api/settings/:category` | Adiciona um item à categoria |
| `DELETE /api/settings/:category/:id` | Remove um item |

## Integrações (`/api/integrations/*`)

| Rota | Auth | O que faz |
|---|---|---|
| `POST/PUT/DELETE /api/integrations/external[/:id]`, `POST …/:id/test` | `requireUser` + `requireTenantAdmin` | CRUD e teste de **conectores externos** (`external_integrations`; segredo só no servidor; front lê a view `external_integrations_safe`) |
| `POST /api/integrations/webhook-test`, `/smtp-test`, `/meta-pixel-test`, `/ga4-test`, `/payment-gateway-test` | `requireUser` | Testes de conexão a host/URL informado pelo usuário — superfície de SSRF; devem passar por `server/ssrfGuard.ts` (ver [SECURITY_CHECKLIST.md](../SECURITY_CHECKLIST.md)) |

## Google Calendar (`/api/google-calendar/*`)

Router em `server/googleCalendar.ts` (limiter 60/min). `requireUser` em tudo exceto o callback OAuth: `GET /connect/start`, `GET /oauth/callback`, `GET /status`, `POST /disconnect`, `GET|POST /events`, `POST /meet-space`, `POST /sync`. Tokens ficam em `google_calendar_connections` (só `service_role`).

## Admin de plataforma (`requireUser` + `requireMaster`)

Só usuários com `is_master=true`. Usam `supabaseService` (service_role). Exceção: `GET /api/admin/permission-check-log` só exige `requireUser` (depende da RLS de `permission_check_log`).

| Rota | O que faz |
|---|---|
| `GET /api/admin/tenant-admin-user/:tenantId` | Busca o usuário admin de um tenant |
| `POST /api/admin/tenant-user/:userId/credentials` | Troca e-mail/senha de um usuário (qualquer tenant) |
| `POST /api/admin/tenant` | Cria um novo tenant + usuário admin inicial |

## WhatsApp (`requireUser`, exceto o webhook)

Provedor escolhido por `getActiveProviderName()` (`server/whatsappProvider.ts`): **WAHA real** quando `WAHA_API_URL` (e `WAHA_API_KEY`) estão definidas, senão o `SimulatorProvider` (QR falso, conexão instantânea, envio sempre "ok"). Em ambos os casos a persistência é real: `whatsapp_instances`, `chat_contacts` e `chat_messages` (com RLS). `GET /api/whatsapp/provider-status` informa `{provider, configured}`.

| Rota | O que faz |
|---|---|
| `GET /api/whatsapp/provider-status` | Provedor ativo (`waha` ou `simulator`) |
| `GET/POST /api/whatsapp/instances` | Lista / cria instância (gera `webhook_secret` e URL de webhook) |
| `POST /api/whatsapp/instances/:id/qrcode`, `/connect` | QR code / estado da conexão |
| `PUT/DELETE /api/whatsapp/instances/:id` | Atualiza / remove instância |
| `GET/POST /api/whatsapp/contacts` | Lista (até 500) / cria contato |
| `GET /api/whatsapp/messages/:contactId` | Mensagens de um contato (até 200) |
| `POST /api/whatsapp/messages/send` | Envia via provedor e registra em `chat_messages` |
| `POST /api/whatsapp/copilot/analyze` | Sugestão de resposta via IA a partir do histórico |
| `POST /api/whatsapp/webhook/:instanceId?secret=` | **Público**: recebe eventos do WAHA, valida o segredo da instância e grava contato/mensagem; depois pode acionar a resposta automática da Aurora |

> A rota antiga `simulate-incoming` e os mapas em memória do simulador foram removidos. O contrato do payload WAHA foi implementado a partir da documentação e, segundo comentário no código, ainda não foi exercitado contra um servidor WAHA real neste ambiente ([TRD §14.2](projeto/02-TRD.md)).

## Supabase Edge Function

`supabase/functions/analyze-crm-call` — análise de transcrição de call via Gemini/Groq. CORS restrito por `ALLOWED_ORIGINS` (env da função). Não usa `service_role`, não toca o banco — só encaminha texto pra IA.
