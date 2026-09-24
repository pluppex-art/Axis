# Segurança do banco (RLS)

> **Atualização 2026-09-24:** os números e fatos abaixo foram reverificados ao vivo nesta data (metadados apenas: `pg_class`, `pg_policies`, `pg_proc`, `storage.buckets`). Dicionário completo de tabelas/colunas/policies/funções em [`projeto/05-ESQUEMA-BACKEND.md`](projeto/05-ESQUEMA-BACKEND.md) (§10 segurança, §11 drift) e resumo por grupo de policy em [`projeto/02-TRD.md`](projeto/02-TRD.md) §15 e §19. O conteúdo das seções de achados históricos (2026-09-03) foi mantido.

Estado verificado ao vivo no projeto `snwkzvgompfgqoqbpihe` em 2026-09-03 e reconferido em 2026-09-24 (`pg_policies`, `pg_class.relrowsecurity`, `information_schema.role_table_grants`) — não apenas os arquivos de migração. Ver [[rls_policy_without_enable_footgun]] no histórico deste projeto: já aconteceu de uma policy ser criada sem `ENABLE ROW LEVEL SECURITY` na tabela, o que a torna decorativa. Antes de confiar neste documento no futuro, reconfira ao vivo — ele descreve um estado, não uma garantia permanente.

**RLS está habilitada em todas as 129 tabelas de `public` (100%), sem exceção** (2026-09-24). Extensões instaladas: `plpgsql`, `uuid-ossp`, `pgcrypto`, `pg_stat_statements`, `supabase_vault`, `pg_net`, `pg_graphql`, `pg_cron`, `http`, `vector`. Têm `tenant_id` todas exceto `tenants`, `module_manifest`, `tool_registry`, `event_action_map` e `google_oauth_app_config` (plataforma/config global) — `partners`, `tenant_partners` e `user_settings` também são exceções por ownership (parceiro/usuário), ver [DATABASE.md](DATABASE.md#convenção-de-multi-tenant). Quatro tabelas têm RLS ligada e **0 policies** (só `service_role`): `api_key_usage_log`, `external_integrations`, `julia_round_robin_state`, `tenant_integrations`.

## Funções de isolamento

Todas `SECURITY DEFINER`, `STABLE`, `search_path` fixo em `public` (evita sequestro de search_path), lendo `public.users` pelo `auth.uid()` da sessão JWT atual:

```sql
current_tenant_id()  -- SELECT tenant_id FROM users WHERE id = auth.uid()
current_partner_id() -- SELECT partner_id FROM users WHERE id = auth.uid()
is_super_admin()     -- SELECT COALESCE(is_master, false) FROM users WHERE id = auth.uid()

has_tenant_access(target_tenant_id) —
  target_tenant_id = current_tenant_id()
  OR is_super_admin()
  OR EXISTS (SELECT 1 FROM tenant_partners WHERE tenant_id = target AND partner_id = current_partner_id())
```

Existem ainda `is_own_tenant_or_super_admin(target_tenant_id)`, `email_taken(check_email)` e `platform_metrics_overview()`. A migration `20260921_cr1_*` (aplicada em 2026-09-24) adiciona `is_tenant_admin_or_master()` para escrita restrita em `cargos`/`squads`, e `20260921_cr3_*` adiciona `user_has_module_access()` para leitura por módulo em clínica/educação. `users.is_tenant_admin` é uma **coluna real** (`bool`, não derivada) — ver [AUTHORIZATION.md](AUTHORIZATION.md).

`has_tenant_access()` é a policy padrão (`tenant_isolation`) na grande maioria das 129 tabelas — dono direto, master, ou parceiro mapeado, todos passam.

## Padrões de policy em uso

| Padrão | Onde | O que significa |
|---|---|---|
| `tenant_isolation` / `has_tenant_access(tenant_id)`, role `public`, `ALL` | Maioria das tabelas (leads, tasks, clientes, financeiro, marketing, imobiliário, dev*, etc.) | Dono, master ou parceiro — leitura e escrita |
| `tenant_isolation` / `tenant_id = current_tenant_id() OR is_super_admin()`, role `authenticated` | `education_content`, `empresa_filiais`, `finance_categories`, `finance_commission_entries`, `imobiliario_*`, `scheduled_exports` | Igual, mas **sem** o caminho de parceiro (`tenant_partners`) — um parceiro não vê essas tabelas de tenants que administra. Provavelmente intencional (módulos que um parceiro não deveria enxergar), mas não documentado como decisão — se algum desses módulos precisar ser visível a parceiros, é aqui que ajustar. |
| `tenant_id = current_tenant_id()`, sem `is_super_admin()`/parceiro | `julia_interaction_log`, `lead_commercial_memory` | Mais restritiva ainda — nem master enxerga de outro tenant por essa policy. Provavelmente também intencional (logs de IA/automação), mas mesma observação: inconsistência não documentada, revisar se master precisar auditar esses logs cross-tenant. |
| INSERT-only pra `anon`, `with_check: tenant_id = '27ef95ee-...'` (E-EMPREENDA+) | `leads`, `tasks`, `lead_commercial_memory`, `julia_interaction_log` | Formulário público de captura de lead + automação n8n "Julia". Só cria linhas pro tenant fixo do E-EMPREENDA+, nunca lê nem atualiza. Corrigido em `20260901_tighten_anon_rls_policies.sql` — antes dessa migração havia também policies de `SELECT`/`UPDATE` pra `anon` nessas 4 tabelas, removidas por não terem nenhum consumidor no código. |
| Colunas restritas via `GRANT`, não via RLS | `tenants` (`anon`) | RLS permite `SELECT` a `anon` só em linhas `status='Active'`, mas o `GRANT` (`20260902_restrict_anon_tenants_columns.sql`) limita as **colunas** legíveis a `id, name, niche, status, modules, plan, timezone, primary_color, module_*, created_at, updated_at` — colunas sensíveis (`webhook_url`, `evolution_api_url`) não são concedidas a `anon` mesmo que a linha passe na policy. RLS controla linhas; GRANT controla colunas — os dois eram necessários aqui. |
| `qual: true`, role `public`, **todos os comandos liberados** | ~~`ai_usage_log`, `aurora_audit_log`~~ (corrigido) | Achado crítico desta auditoria: policy nomeada `tenant_isolation`/`open_access` mas com `qual` literalmente `true`, combinada com `GRANT` completo (`SELECT/INSERT/UPDATE/DELETE/TRUNCATE`) para `anon` — qualquer pessoa na internet, sem login, lia/escrevia/apagava as duas tabelas inteiras, todos os tenants. Nenhum código do repo referencia essas tabelas. Corrigido em `20260903_close_open_rls_policies.sql`: `REVOKE ALL ... FROM anon` + policy `tenant_isolation`/`has_tenant_access(tenant_id)` igual ao padrão do resto do banco. Verificado ao vivo (`SET ROLE anon`) após o fix. |
| `qual: true`, sem `tenant_id` | `julia_round_robin_state` | Tabela de estado da automação round-robin do n8n. Tinha uma policy `qual: true` pra role `public` (mundo inteiro lê/escreve) — removida em `20260901_tighten_anon_rls_policies.sql`. Hoje tem **0 policies** (RLS habilitada, ninguém além de `service_role`/`postgres` acessa — a automação n8n usa `service_role`, que ignora RLS). Ganhou uma coluna `tenant_id` nullable pra permitir escopar por tenant numa próxima rodada, mas ainda não é usada. |
| 0 policies (deny-all pra roles normais) | `tenant_integrations` | Intencional — guarda credenciais/config de integração por tenant (`20260827_lock_down_tenant_integrations.sql`). Só `service_role` acessa. |
| Ownership direto (não é tenant) | `partners`, `tenant_partners` | `partners_select`: `id = current_partner_id() OR is_super_admin()`. Escrita (`insert`/`update`/`delete`) exige `is_super_admin()` nas duas tabelas — só master cria/edita parceiros e seus mapeamentos pra tenants. |
| Ownership por usuário | `user_settings` | `auth.uid() = user_id` — cada usuário só vê/edita as próprias preferências, independente de tenant. |
| Global-ou-tenant | `app_settings`, `nichos` | `has_tenant_access(tenant_id) OR tenant_id IS NULL` — linha global (`tenant_id IS NULL`) visível a todos, linha específica só ao dono/master/parceiro. `nichos_write` exige `is_super_admin()` pra mexer num nicho global; qualquer tenant pode criar/editar os próprios. |

## Partners e `tenant_partners`

Um `partner` pode enxergar múltiplos tenants sem ser `is_super_admin`. O mapeamento vive em `tenant_partners (tenant_id, partner_id)`, e é isso que `has_tenant_access()` consulta. Só master (`is_super_admin()`) pode criar/editar/remover parceiros ou seus mapeamentos — um parceiro não pode se auto-conceder acesso a um tenant novo.

## Tabelas de chat (antes "ausentes do schema")

`chat_contacts`/`chat_messages` **existem** desde a migration `20260921_whatsapp_real_chat_persistence.sql` (e `20260921_fix_chat_messages_wa_message_id_constraint.sql`), com `tenant_id` obrigatório, RLS habilitada e policy `tenant_isolation`, seguindo o padrão de toda outra tabela. São usadas pelas rotas WhatsApp do `server.ts` (provider WAHA real ou simulador) e pelo webhook de entrada do WAHA (que grava via `service_role` a partir do `tenant_id` da própria linha de `whatsapp_instances`, nunca do payload). Não repetir o erro que gerou o achado de `ai_usage_log`/`aurora_audit_log` acima em tabelas novas.

## Webhooks de saída e permissão por módulo

- `webhooks`/`webhook_logs` **têm uso real**: triggers em `leads`/`tasks` (`webhook_lead_created`, `webhook_lead_status_changed`, `webhook_task_created`) chamam `dispatch_webhook_event(...)`, que dispara via `pg_net` (assíncrono) e registra em `webhook_logs` (migrations `20260919_webhooks_dispatch_real.sql` e `20260919_revoke_public_execute_dispatch_functions.sql`, esta última retirando `EXECUTE` público das funções de despacho). Conectores externos usam `external_integrations` (0 policies, só `service_role`) e `external_integration_logs`.
- **Permissão por módulo em modo log:** os triggers `trg_permission_log_{crm,financeiro,rh,clinica,educacao}` chamam `log_module_permission_check`, que grava em `permission_check_log` (`would_have_blocked`) **sem bloquear nada**. Enforcement real ainda não existe no banco (só `user_has_module_access`/CR3, não aplicado).
- **Migrations de 2026-09-21 no repo (estado em 2026-09-24):** **todas aplicadas em 2026-09-24:** `a1` (bloqueio de período no banco), `cr1` (escrita em cargos/squads só admin/master), `cr2` (módulos/plano só master), `cr3` (leitura de clínica/educação por módulo do cargo), `m5_m7` (produtos sem tenant, revoga escrita do `anon` em `tenants`, imóvel público só com corretor ativo) e `a4` (policies do módulo Dev) (impacto medido antes: 0 usuários perderiam acesso a dados de clínica/educação). Revisar e aplicar (ou remover do repo) — ver [projeto/05-ESQUEMA-BACKEND.md](projeto/05-ESQUEMA-BACKEND.md) §11.

## Storage

Quatro buckets — `avatars`, `proposals`, `products` e `finance` — todos `public: true` (URL de leitura é pública, sem policy — é assim que avatar/proposta abrem em `<img>`/link direto). Escrita (`INSERT`/`UPDATE`/`DELETE` em `storage.objects`) restrita por policy a `(storage.foldername(name))[1] = current_tenant_id()::text` — cada tenant só escreve na própria pasta. Limite de tamanho e MIME type configurado no bucket (`file_size_limit`, `allowed_mime_types`), não apenas confiado ao cliente:

| Bucket | Tamanho máx. | MIME permitidos |
|---|---|---|
| `avatars` | 5 MB | `image/png`, `image/jpeg`, `image/webp`, `image/gif` |
| `proposals` | 20 MB | `application/pdf`, `image/png`, `image/jpeg` |
| `products` | 25 MB | ver migration `20260904_products_storage_and_attributes` (MIME conforme configurado no bucket) |
| `finance` | 25 MB | ver migration `20260918_finance_attachments_bucket_and_table` (anexos financeiros; MIME conforme configurado no bucket) |

Os limites de `avatars`/`proposals` foram verificados em 2026-09-03; para `products`/`finance` o tamanho foi verificado em 2026-09-24 e a lista de MIME deve ser conferida em `storage.buckets.allowed_mime_types` (não transcrita aqui).

## Funções `SECURITY DEFINER` chamáveis via RPC pública

Além das 4 funções de isolamento acima (que só leem, nunca aceitam `tenant_id` como argumento vindo do chamador), o banco expõe outras `SECURITY DEFINER` chamáveis via `/rest/v1/rpc/*`. Duas merecem atenção porque aceitam parâmetro livre do chamador:

- **`claim_next_form_sdr(p_tenant_id uuid)`** — chamada sem login pelo formulário público do E-EMPREENDA+ pra escolher o próximo SDR no rodízio. **Achado crítico desta auditoria (C5)**: não validava `p_tenant_id`, então qualquer chamador anônimo podia passar o `tenant_id` de qualquer empresa e ler nome/telefone/`user_id` do SDR da vez daquela empresa, além de corromper o contador de rodízio dela. Corrigido em `20260903_scope_claim_next_form_sdr.sql` — a função agora só aceita o tenant fixo do E-EMPREENDA+ (`27ef95ee-...`), igual ao padrão das policies `INSERT` de `anon`.
- **`platform_metrics_overview()`** — sem parâmetro, mas devolve contagens agregadas de **todos** os tenants (leads, clientes, propostas, receita). É `SECURITY DEFINER` e o `get_advisors` sinaliza que `anon`/`authenticated` podem chamá-la — mas o corpo da função já checa `current_partner_id() IS NULL AND NOT is_super_admin()` e lança exceção nesse caso, então um chamador sem ser parceiro/master recebe erro, não dado. Verificado por leitura de código, não é uma vulnerabilidade real — mas é o padrão a seguir: **toda função `SECURITY DEFINER` que aceita um parâmetro ou agrega dado sensível precisa desse tipo de checagem própria no corpo**, porque `EXECUTE` pra `anon`/`authenticated` costuma vir liberado por padrão ao criar a função, a menos que revogado explicitamente.

Ao criar uma função `SECURITY DEFINER` nova: (1) se ela aceita um `tenant_id`/id de parâmetro, validar contra `has_tenant_access()` ou um valor fixo conhecido — nunca confiar no argumento; (2) se ela agrega dado cross-tenant, checar `is_super_admin()`/`current_partner_id()` no corpo, como `platform_metrics_overview()` já faz; (3) rodar `get_advisors` (security) depois — ele sinaliza toda função `SECURITY DEFINER` executável por `anon`/`authenticated`, e cada uma precisa ser lida, não só a existência do lint ignorada.

## Verificando isolamento manualmente

`SET ROLE anon;` (ou `authenticated`, com `SET request.jwt.claims` pra simular um usuário) numa sessão SQL direta é o teste mais confiável — mais confiável que ler `information_schema.column_privileges`/`role_table_grants`, que já mostrou metadado enganoso (herdado/estático) numa verificação anterior desta auditoria. Ex.: `SET ROLE anon; SELECT * FROM public.ai_usage_log;` deve retornar `permission denied for table ai_usage_log`.

## Achados fechados nesta auditoria (histórico)

- `20260901_tighten_anon_rls_policies.sql` — removidas policies `SELECT`/`UPDATE` para `anon` em `leads`/`tasks`/`lead_commercial_memory`/`julia_interaction_log` (só `INSERT` do formulário público ficou); removida policy `qual: true` de `julia_round_robin_state`.
- `20260901_nichos_table.sql` / `20260901_nichos_globais_seed.sql` — tabela `nichos` com RLS desde a criação.
- `20260902_restrict_anon_tenants_columns.sql` — `anon` perdeu `SELECT` em colunas sensíveis de `tenants` (mantendo as públicas).
- `20260903_close_open_rls_policies.sql` — `ai_usage_log`/`aurora_audit_log` fechadas (achado crítico desta rodada, ver tabela acima).
- `20260903_scope_claim_next_form_sdr.sql` — `claim_next_form_sdr()` restrita ao tenant fixo do E-EMPREENDA+ (achado crítico C5, ver seção de funções `SECURITY DEFINER` acima).
- `20260903_fix_mutable_search_path_functions.sql` — `search_path` fixado em `set_updated_at()`/`sync_sprint_task_project_from_issue()`.
