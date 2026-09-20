# API

Todas as rotas vivem em `server.ts` (Express), servidas via `api/index.ts` na Vercel. Base path: `/api`.

**Autenticação** (ver [AUTHENTICATION.md](AUTHENTICATION.md)/[AUTHORIZATION.md](AUTHORIZATION.md) para detalhe):
- `requireUser` — header `Authorization: Bearer <jwt-do-supabase-auth>`. Anexa `req.user` e `req.supabase` (client escopado pela sessão — toda query subsequente respeita RLS automaticamente).
- `requireApiKey` — header `x-api-key: <chave>`. O tenant vem do mapeamento `SPY_API_KEYS` (`chave:tenantId`), nunca do corpo da requisição.
- `requireMaster` — usado depois de `requireUser`; confirma `users.is_master=true` no banco.

**Rate limiting**: `/api/v1/leads` e `/api/leads/*` e `/api/ai/*`: 20-60 req/min por IP. `/api/whatsapp/*`: 60/min. Ver `server.ts` pros valores exatos.

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

## Admin de plataforma (`requireUser` + `requireMaster`)

Só usuários com `is_master=true`. Usam `supabaseService` (service_role).

| Rota | O que faz |
|---|---|
| `GET /api/admin/tenant-admin-user/:tenantId` | Busca o usuário admin de um tenant |
| `POST /api/admin/tenant-user/:userId/credentials` | Troca e-mail/senha de um usuário (qualquer tenant) |
| `POST /api/admin/tenant` | Cria um novo tenant + usuário admin inicial |

## WhatsApp (simulador — `requireUser`)

Estado isolado por tenant (`instancesByTenant`/`contactsByTenant`/`messagesByTenant`, resolvidos via `current_tenant_id()`). `GET /api/whatsapp/instances` tenta primeiro a tabela real `whatsapp_instances` (tem RLS própria) antes de cair no fallback em memória.

| Rota | O que faz |
|---|---|
| `GET /api/whatsapp/instances` | Lista instâncias do tenant |
| `POST /api/whatsapp/instances` | Cria instância |
| `POST /api/whatsapp/instances/:id/qrcode` | Gera QR code simulado |
| `POST /api/whatsapp/instances/:id/connect` | Simula conexão |
| `DELETE /api/whatsapp/instances/:id` | Remove instância |
| `PUT /api/whatsapp/instances/:id` | Atualiza instância |
| `GET /api/whatsapp/contacts` | Lista contatos do tenant |
| `POST /api/whatsapp/contacts` | Cria contato |
| `GET /api/whatsapp/messages/:contactId` | Lista mensagens de um contato |
| `POST /api/whatsapp/messages/send` | Envia mensagem (simulado) |
| `POST /api/whatsapp/simulate-incoming` | Simula mensagem recebida |
| `POST /api/whatsapp/copilot/analyze` | Sugestão de resposta via IA a partir do histórico |

> `chat_messages`/`chat_contacts` (tabelas reais que essas rotas tentam usar em paralelo ao fallback em memória) **não existem hoje** no banco — ver [DATABASE_SECURITY.md](DATABASE_SECURITY.md#tabelas-que-não-existem-ainda). Antes de criá-las, adicionar `tenant_id` + RLS seguindo o padrão das demais tabelas.

## Supabase Edge Function

`supabase/functions/analyze-crm-call` — análise de transcrição de call via Gemini/Groq. CORS restrito por `ALLOWED_ORIGINS` (env da função). Não usa `service_role`, não toca o banco — só encaminha texto pra IA.
