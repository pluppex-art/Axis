# Webhooks

> **Atualização 2026-09-24:** existem webhooks de **saída** reais (triggers no banco + `pg_net`) e um webhook de **entrada** real (WAHA). Inventário de rotas em [API.md](API.md) e [`projeto/02-TRD.md`](projeto/02-TRD.md) §14.2.

## Saída (o sistema chama webhooks externos)

### Aurora chat → n8n
`POST /api/ai/aurora-chat` (`server.ts`, `requireUser`) recebe a mensagem do usuário e repassa pro webhook do n8n configurado em `AURORA_WEBHOOK_URL` (variável só de servidor, nunca `VITE_`-prefixada). **A URL do webhook nunca chega ao navegador** — o frontend só fala com `/api/ai/aurora-chat`, e é o backend quem conhece e chama a URL real. Isso evita que a URL do n8n (que normalmente não tem autenticação própria forte) fique exposta no bundle do cliente.

### Rodízio de leads ("Julia") → n8n
Automação externa (n8n) que lê/escreve em `julia_interaction_log`/`julia_round_robin_state` usando `service_role` (não passa pelo `server.ts`, não é uma rota HTTP deste repo). RLS dessas tabelas não afeta `service_role` (que sempre ignora RLS) — o isolamento por tenant nelas existe pra proteger contra acesso via `anon`/`authenticated`, não contra a própria automação. Ver [DATABASE_SECURITY.md](DATABASE_SECURITY.md).

### Webhooks de saída configuráveis por tenant (banco → URL externa)
Triggers em `leads`/`tasks` (`webhook_lead_created`, `webhook_lead_status_changed`, `webhook_task_created`) chamam a função `dispatch_webhook_event(...)`, que faz o POST via extensão `pg_net` (assíncrono, fora da transação) para as URLs cadastradas em `webhooks` / `app_settings.globalWebhooks` e registra o resultado em `webhook_logs` (`status_code`, `payload`, `response`). Migrations: `20260919_webhooks_dispatch_real.sql` e `20260919_revoke_public_execute_dispatch_functions.sql` (remove `EXECUTE` público das funções de despacho). Conectores externos por tenant usam `external_integrations` (tabela sem policy — só `service_role`) e `external_integration_logs`, com os triggers `trg_external_lead_created`/`_status_changed`/`trg_external_task_created`; o CRUD passa por `/api/integrations/external*` (`requireTenantAdmin`). O teste de URL (`POST /api/integrations/webhook-test`) faz requisição a URL arbitrária e deve passar pelo guard de SSRF (`server/ssrfGuard.ts`).

### WhatsApp (WAHA)
O backend fala com o WAHA (`WAHA_API_URL`/`WAHA_API_KEY`) via `server/whatsappProvider.ts` para criar sessão, QR, conexão e envio. Sem essas variáveis o `SimulatorProvider` assume e nenhuma chamada real é feita. Ao criar uma instância, o backend gera um `webhook_secret` e a URL de retorno (`.../api/whatsapp/webhook/:instanceId?secret=...`) que o WAHA deve chamar (ver "Entrada" abaixo).

## RPC pública chamada pelo formulário do E-EMPREENDA+

Não é um webhook (não é um evento assinado empurrado por outro sistema), mas é a mesma categoria de risco: `claim_next_form_sdr(p_tenant_id)` é uma função Postgres `SECURITY DEFINER` chamada **sem login** pelo formulário de inscrição do E-EMPREENDA+ (`supabase.rpc(...)`, role `anon`) pra escolher o próximo SDR no rodízio. Tinha o mesmo defeito que um webhook mal validado teria: aceitava `p_tenant_id` como veio do chamador, sem checar se fazia sentido pra quem estava chamando — corrigido nesta auditoria (C5, ver [DATABASE_SECURITY.md](DATABASE_SECURITY.md#funções-security-definer-chamáveis-via-rpc-pública)) pra só aceitar o tenant fixo do próprio E-EMPREENDA+.

## Entrada (webhooks que chegam de fora)

### WAHA → `POST /api/whatsapp/webhook/:instanceId?secret=<webhook_secret>`
Rota **pública** (sem `requireUser`), em `server.ts`. Comportamento verificado em 2026-09-24 (TRD §14.2):
- Responde `200 {received:true}` **antes** de processar; `403` se o `secret` não confere com `whatsapp_instances.webhook_secret` daquela instância; `503` sem Supabase/service key.
- O `tenant_id` vem da **linha da instância** no banco, nunca do payload.
- Processa `event: "message"` (`payload.from/body/id/fromMe`): faz upsert em `chat_contacts` e insert em `chat_messages` (`wa_message_id` único — `23505` é tratado como duplicata e ignorado) via `service_role`; depois pode disparar `runAuroraAutoReply` (resposta automática por IA).
- Rate limit de `/api/whatsapp` (60/min por IP).
- **Pontos de atenção (TRD §14.2/§19.6):** o segredo vai na query string (o WAHA só suporta esse formato **[a validar]**) e no TRD (2026-09-24) era comparado com `!==`; o `server.ts` atual (working tree) já usa `safeEqual` (`crypto.timingSafeEqual`). O contrato do payload WAHA ainda não foi exercitado contra um servidor real neste ambiente.

### Outros pontos de entrada
- `POST /api/v1/leads`, `/api/v1/lead-activities`, `/api/v1/finance-entries` — API própria autenticada por `x-api-key` (ver [API.md](API.md#api-pública-por-chave)), não um webhook assinado.
- `GET /api/google-calendar/oauth/callback` — callback OAuth, validado por `state` assinado com HMAC (`GOOGLE_OAUTH_STATE_SECRET`).
- `POST /api/public/lead-capture` — formulário público (limiter 5/min).

Padrão mínimo para **qualquer webhook de entrada novo**:
- Verificar assinatura/segredo do provedor (HMAC ou segredo por instância) em **tempo constante** antes de processar o payload — nunca confiar em "veio de tal IP" ou em header arbitrário.
- Resolver o `tenant_id` a partir de algo que o provedor não pode forjar (ex.: instância já cadastrada), nunca de um `tenant_id` solto no corpo.
- Rate limiting próprio (`express-rate-limit`).
- Responder rápido (2xx) e processar depois, se o provedor exigir; tratar duplicatas (idempotência por ID do evento).

## Tabelas `webhooks` / `webhook_logs`

Têm **uso real** (webhooks de saída acima), com RLS `tenant_isolation`/`has_tenant_access(tenant_id)`. `webhook_logs` recebe as respostas do `pg_net`. A origem exata das URLs (`webhooks` × `app_settings.globalWebhooks`) está descrita em [`projeto/02-TRD.md`](projeto/02-TRD.md) §15.1. Estrutura de colunas em [`projeto/05-ESQUEMA-BACKEND.md`](projeto/05-ESQUEMA-BACKEND.md) (A.6).
