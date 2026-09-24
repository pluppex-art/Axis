# Banco de dados

Supabase/Postgres 17, projeto `snwkzvgompfgqoqbpihe`. Schema `public`, **129 tabelas, todas com RLS** (verificado ao vivo em 2026-09-24). Migrações versionadas em [`supabase/migrations/`](../supabase/migrations/) — atenção: as `20260921_cr1/cr2/cr3` e `m5_m7` do repo **ainda não estão aplicadas** no banco vivo (`a1` e `a4` estão). O dicionário de dados completo (tabelas, colunas, FKs, funções, triggers) está em [`projeto/05-ESQUEMA-BACKEND.md`](projeto/05-ESQUEMA-BACKEND.md), que é a fonte de verdade; este documento só resume convenções. Extensões: `plpgsql`, `uuid-ossp`, `pgcrypto`, `pg_stat_statements`, `supabase_vault`, `pg_net`, `pg_graphql`, `pg_cron`, `http`, `vector`.

## Convenção de multi-tenant

Toda tabela de dado operacional tem uma coluna `tenant_id uuid references public.tenants(id)`. As únicas exceções são:
- `tenants` — é o próprio tenant, não pertence a um.
- `module_manifest`, `tool_registry`, `event_action_map`, `google_oauth_app_config` — catálogos/configuração global da plataforma.
- `partners` / `tenant_partners` — pertencem a um parceiro (`partner_id`), que por sua vez enxerga vários tenants (ver [DATABASE_SECURITY.md](DATABASE_SECURITY.md#partners-e-tenant_partners)).
- `user_settings` — pertence a um usuário (`user_id`), não a um tenant diretamente (o usuário já carrega seu próprio `tenant_id`).

Toda tabela nova **deve** seguir esse padrão: `tenant_id` + policy `tenant_isolation` usando `has_tenant_access(tenant_id)` (ver [DATABASE_SECURITY.md](DATABASE_SECURITY.md)). Isso é checado por `mcp__Supabase__get_advisors` (security) depois de qualquer migração — uma tabela nova sem RLS ou sem `tenant_id` aparece lá.

## Nichos

`nichos` (`tenant_id` nullable) substitui o antigo enum fixo de "segmento de negócio". `tenant_id IS NULL` = nicho global, disponível pra qualquer tenant escolher (seed em `20260901_nichos_globais_seed.sql`); `tenant_id` preenchido = nicho customizado só daquele tenant. `tenants.niche` continua existindo (referenciado por `DashboardStatsByNiche.tsx` e outras telas) — `nichos` é o catálogo administrável, não substitui a coluna.

## Fallbacks em memória (sem tabela própria)

Algumas "entidades" de configuração não têm tabela dedicada — vivem em memória no processo do `server.ts`, isoladas por tenant via `tenantBucket()`/`current_tenant_id()`: `sources`, `custom-fields` (settings genéricos, distinto de `custom_fields` que é tabela real), `task-categories`, `templates`. Isso significa que esse estado **não sobrevive a um redeploy/cold-start** da função serverless — é aceitável para dados de configuração de baixo risco, mas não deve crescer para guardar nada que precise persistir de verdade (previsto: tabela `tenant_settings`, ver [projeto/06-PLANO-DE-IMPLEMENTACAO.md](projeto/06-PLANO-DE-IMPLEMENTACAO.md)). Ver [API.md](API.md#settings-genéricos-fallback-em-memória).

O **WhatsApp não usa mais estado em memória**: instâncias em `whatsapp_instances`, contatos em `chat_contacts` e mensagens em `chat_messages` (tabelas reais, com RLS). O `SimulatorProvider` só simula o provedor (QR/conexão/envio), a persistência é real.

## Tabelas de chat e webhooks

`chat_contacts` e `chat_messages` **existem** (migration `20260921_whatsapp_real_chat_persistence.sql`), com `tenant_id` e RLS `tenant_isolation`; `chat_messages.wa_message_id` evita duplicatas do webhook do WAHA. `webhooks`/`webhook_logs` têm uso real: triggers em `leads`/`tasks` chamam `dispatch_webhook_event` (via `pg_net`) e gravam o log. Ver [DATABASE_SECURITY.md](DATABASE_SECURITY.md#tabelas-de-chat-antes-ausentes-do-schema) e [WEBHOOKS.md](WEBHOOKS.md).

## Permissões e papéis no banco

`users.is_master` e `users.is_tenant_admin` são colunas reais (`users.role` continua texto livre). A permissão por módulo (cargo → módulos) hoje roda em **modo log** (`permission_check_log`, triggers `trg_permission_log_*`): registra `would_have_blocked` sem bloquear. Ver [AUTHORIZATION.md](AUTHORIZATION.md).

## Storage

Quatro buckets, todos `public: true` (leitura pública por URL, escrita restrita por policy):

| Bucket | Limite de tamanho | Tipos permitidos |
|---|---|---|
| `avatars` | 5 MB | png, jpeg, webp, gif |
| `proposals` | 20 MB | pdf, png, jpeg |
| `products` | 25 MB | conferir `storage.buckets` |
| `finance` | 25 MB | conferir `storage.buckets` (anexos financeiros) |

Escrita restrita por pasta = `tenant_id` do usuário (ver policies de storage em [DATABASE_SECURITY.md](DATABASE_SECURITY.md#storage)).

## Funções auxiliares

Ver definições completas e o que cada uma resolve em [DATABASE_SECURITY.md](DATABASE_SECURITY.md#funções-de-isolamento). Resumo: `current_tenant_id()`, `current_partner_id()`, `is_super_admin()` (e `is_own_tenant_or_super_admin()`) leem `public.users` pelo `auth.uid()` da sessão; `has_tenant_access(tenant_id)` combina as três pra decidir se o usuário logado pode ver aquele tenant (dono direto, super admin/master, ou parceiro mapeado via `tenant_partners`).

## Tipos gerados

Não há um arquivo de tipos TypeScript gerado automaticamente do schema versionado no repo hoje — os tipos usados em `src/` são escritos à mão (`src/types.ts` e afins). Gerar com `mcp__Supabase__generate_typescript_types` é seguro a qualquer momento pra conferir drift, mas isso não está automatizado em CI.
