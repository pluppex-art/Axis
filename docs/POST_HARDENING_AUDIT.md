# Auditoria pós-hardening — validação final

> **Atualização 2026-09-24** — este relatório é histórico (retrato de 2026-09-01 a 2026-09-03 ou da data indicada) e não foi reescrito. O que mudou desde então:
> - O banco vivo tem hoje **129 tabelas, 100% com RLS**, 4 buckets (`avatars`, `proposals`, `products`, `finance`); `chat_contacts`/`chat_messages` existem com RLS e o WhatsApp usa o provedor WAHA real com persistência (não é mais só simulador em memória); existe webhook de **entrada** (`POST /api/whatsapp/webhook/:instanceId`) e webhooks de **saída** reais (`dispatch_webhook_event`/`pg_net`).
> - Variáveis de ambiente renomeadas: `AXIS_*` → `SPY_*` (`SPY_CORS_ORIGIN`, `SPY_API_KEYS`; o código ainda aceita `AXIS_*` como fallback).
> - Migrations de 2026-09-21 no repo (`cr1`, `cr2`, `cr3` e `fixes_m5_m7_baixo_get_public_imovel` confirmadas como **não aplicadas** no banco vivo em 2026-09-24 (`a1` foi **aplicada** em 2026-09-24; `a4` já estava aplicada)) ainda pendentes de aplicação.
> - Achados novos ainda abertos (SSRF em rotas de teste de integração, `resolveTenantId` do Google Calendar, aceite público de proposta sem checagem de status, cache Redis por tenant × RLS por módulo, `tenant-theme` sem limite, permissão por módulo só em modo log): ver TRD §19.6 e Plano, Fase 4.
> Estado verificado atual: [`docs/projeto/05-ESQUEMA-BACKEND.md`](../docs/projeto/05-ESQUEMA-BACKEND.md), [`docs/projeto/02-TRD.md`](../docs/projeto/02-TRD.md) §19 e achados abertos em [`docs/projeto/06-PLANO-DE-IMPLEMENTACAO.md`](../docs/projeto/06-PLANO-DE-IMPLEMENTACAO.md) (Fase 4).

**Data:** 2026-09-03. **Objetivo:** validar, sem alterar código funcional, se o estado atual do repositório + banco está pronto para commit, comparando contra [`SECURITY_AUDIT.md`](../SECURITY_AUDIT.md), [`FINAL_SECURITY_REPORT.md`](../FINAL_SECURITY_REPORT.md) e [`SECURITY_CHECKLIST.md`](../SECURITY_CHECKLIST.md). Nenhum valor de secret é reproduzido neste documento.

## Security Status

## 🟡 SAFE WITH RESIDUAL RISKS

O código pronto para commit está correto e verificado (build limpo, RLS funcionando, C4/C5 fechados, sem novos secrets introduzidos). Não é 🟢 puro porque esta rodada de validação encontrou **duas confirmações adicionais do achado C1** (senha do master também hardcoded em duas migrations já commitadas anteriormente, fora do escopo desta sessão) e confirmou que **a produção ainda não roda o código corrigido** — nenhum dos dois motivos bloqueia o commit em si, mas ambos precisam da sua decisão/ação antes ou logo depois dele.

---

## 1. Revisão do estado atual vs. documentos anteriores

| Item pedido | Confirmado nesta rodada |
|---|---|
| 19 vulnerabilidades originais | ✅ Todas as 19 da tabela de `FINAL_SECURITY_REPORT.md` seguem com o status lá registrado — reconferido lendo os três documentos por completo. |
| C4 corrigido | ✅ Reconfirmado ao vivo (seção 5). |
| C5 corrigido | ✅ Reconfirmado ao vivo (seção 5). |
| RLS revisado | ✅ Todas as ~73 tabelas de `public` seguem com RLS habilitada; nenhuma nova tabela sem policy além das duas já documentadas como intencionais (`julia_round_robin_state`, `tenant_integrations`). |
| Isolamento multi-tenant validado | ✅ Testado de novo, em mais tabelas que a rodada anterior (seção 5). |
| RPCs revisadas | ✅ `claim_next_form_sdr` e `platform_metrics_overview` retestadas com usuários reais diferentes (seção 5) — o teste anterior de `platform_metrics_overview` tinha usado, sem perceber, uma conta que por engano tinha `partner_id` setado; refeito com uma conta comum de verdade, resultado agora inequívoco. |
| Permissões `anon`/`authenticated`/`service_role` | ✅ `role_table_grants` reconferido; nenhum grant novo a `anon` além do já documentado. |
| Autenticação/autorização | ✅ Sem mudança desde `docs/AUTHENTICATION.md`/`AUTHORIZATION.md` — nenhuma alteração de código nesta rodada. |
| APIs | ✅ Testadas ao vivo contra a produção (seção 5) — achado novo, ver seção 4. |
| Webhooks | ✅ Sem mudança — `docs/WEBHOOKS.md` continua correto (nenhum webhook de entrada existe). |
| Secrets | 🟡 Ver seção 3 — dois achados novos em migrations pré-existentes. |
| Documentação | ✅ Revisada, coerente com o estado real — nenhuma reescrita necessária (seção 7). |
| Migrations | 🟡 Ver seção 3. |
| CI | ✅ `.github/workflows/ci.yml` presente e coerente com `docs/DEPLOYMENT.md`. |
| Testes de segurança | ✅ Ampliados nesta rodada (seção 5). |

---

## 2. M5 e RBAC granular — confirmado, nada alterado

Conforme instruído: **nenhuma alteração de schema foi feita**. `role` continua sem `CHECK`/FK/enum. Motivo documentado permanece válido: cargos são personalizados por tenant, e `role` não é usado em nenhuma policy de RLS nem em nenhuma decisão de autorização real (confirmado de novo por grep nesta rodada — só `is_master`/`isTenantAdmin` gateiam algo). Status: **LOW RISK / DOCUMENTED / NOT FIXED**.

RBAC granular (Tenant → Usuários → Cargos → Permissões → Módulos → Ações): **não implementado**, permanece como decisão de produto/arquitetura futura, sem nenhum código novo nesta rodada.

---

## 3. Migrations — revisão e achados novos

`supabase/migrations/` tem 39 arquivos. Todas as correções desta auditoria de segurança estão salvas localmente:

- `20260902_restrict_anon_tenants_columns.sql`
- `20260903_close_open_rls_policies.sql` (C4)
- `20260903_scope_claim_next_form_sdr.sql` (C5)
- `20260903_fix_mutable_search_path_functions.sql`

Todas as quatro foram aplicadas ao projeto Supabase (`snwkzvgompfgqoqbpihe`) via `apply_migration` e reverificadas ao vivo — **não há divergência entre o banco em produção e os arquivos locais para nenhuma delas**. Não existem migrations duplicadas ou conflitantes entre si (nomes e timestamps únicos, sem duas migrations tentando criar/alterar o mesmo objeto de forma incompatível).

**Dois achados novos, fora do escopo desta sessão de hardening (pré-existentes, já commitados antes desta auditoria começar):**

1. `20260602_create_gthec_master.sql` e `20260606_fix_completo_final.sql` — ambas contêm, em texto explícito (comentário + valor), a senha da conta `admin@gthec.com` (mesma conta do achado C1) num formato trivialmente reversível (não é um hash real — é o valor codificado de forma reversível, com o próprio comentário do arquivo explicando como decodificar). São **dois arquivos diferentes** com o mesmo valor. Nenhum dos dois foi criado ou tocado nesta auditoria — já estavam commitados antes desta sessão começar, então já estão no histórico do Git independentemente de qualquer commit futuro.
   - **Por que isso importa agora:** reforça a urgência do item manual C1 — o valor não está só "em algum commit antigo", está em dois arquivos que continuam presentes e legíveis no branch atual, sem precisar nem abrir `git log`.
   - **Não alterado nesta rodada** (instrução explícita: sem alteração destrutiva, só documentar). Ação sugerida para depois da rotação da senha: redigir (redact) o valor nesses dois arquivos — trocar por um placeholder ou remover o bloco — já que a migration não precisa mais rodar de fato (a conta já existe). Isso é independente de reescrever o histórico do Git (que já era uma opção documentada e continua opcional).

2. `20260827_fix_colaboradores_updated_at.sql` — arquivo **vazio (0 bytes)**. Não é um risco de segurança, mas é uma inconsistência: sem conteúdo, não fica claro se a migration foi esvaziada por engano, se era um placeholder nunca preenchido, ou se o fix já foi feito por outro arquivo. Documentado, não alterado.

Nenhuma migration (nova ou pré-existente) contém `SUPABASE_SERVICE_ROLE_KEY`, chave de API do Gemini/Groq, ou qualquer `AXIS_API_KEY_*` real — a varredura desta rodada (grep por padrões de token/chave em todos os 39 arquivos) só encontrou os dois achados de senha do master acima.

---

## 4. Achado novo: produção ainda roda o build anterior ao hardening

Teste ao vivo, não destrutivo, contra `https://axis-crm.pluppex.com.br` (domínio de produção documentado em `AXIS_CORS_ORIGIN`):

- `OPTIONS /api/v1/leads` com `Origin: https://evil.example.com` (uma origem que não deveria ser aceita) → resposta atual: **`Access-Control-Allow-Origin: *`**. O código local (`server.ts`, já revisado nesta sessão) só define esse header quando a origem bate com a allowlist — nunca com `*`. A única explicação é que **o deploy atual em produção é anterior a essa correção**.
- Confirmado de duas formas independentes: (a) o mesmo `*` aparece pra qualquer origem testada, inclusive uma claramente maliciosa e inclusive a origem "correta"; (b) os headers de segurança adicionados ao `vercel.json` nesta auditoria (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) **não aparecem** na resposta real — só o `Strict-Transport-Security`, que é adicionado automaticamente pela própria Vercel independente do `vercel.json`.
- `POST /api/v1/leads` sem `x-api-key` retornou `503` ("nenhuma API Key configurada") — indica que `AXIS_API_KEYS` também não está configurada no ambiente de produção atual (isso é uma falha segura — fecha em vez de abrir —, mas é um sinal operacional, não um achado de segurança).

**O que isso significa:** as correções de banco (RLS, GRANTs, funções) já estão em vigor em produção agora, porque foram aplicadas direto no Supabase. As correções de código de aplicação (CORS, rate limiting, headers, RBAC de `/app/admin`, fluxo de recuperação de senha, erros genéricos, etc.) só entram em vigor depois de commit + deploy. Isso não muda o veredito sobre o código estar pronto pra commit, mas é essencial que fique registrado: **committar não é suficiente — um deploy também é necessário** pra essas correções deixarem de ser teóricas.

---

## 5. Testes de segurança — rodada final

Todos não destrutivos; toda escrita de teste foi feita dentro de uma transação com `ROLLBACK` explícito, nunca commitada.

### Authentication

| Teste | Resultado |
|---|---|
| Rota administrativa sem autenticação (`GET /api/admin/tenant-admin-user/:id` sem token, produção real) | ✅ `401` |
| Rota de IA sem autenticação (`POST /api/ai/generic-insight` sem token, produção real) | ✅ `401` |
| Validação de token | ✅ Delegada a `supabase.auth.getUser()` — sem verificação própria vulnerável (revisão de código) |

### Authorization

| Teste | Resultado |
|---|---|
| Usuário comum (sem `is_master`, sem `partner_id`) chamando `platform_metrics_overview()` (recurso administrativo agregado) | ✅ Bloqueado: `access denied: partner or super admin required` |
| Conta com `partner_id` legítimo chamando a mesma função | ✅ Retorna dado agregado — comportamento correto por design (parceiro tem acesso multi-tenant intencional) |
| Usuário comum tentando `UPDATE` num lead de outro tenant, id conhecido (IDOR) | ✅ 0 linhas afetadas |
| Usuário comum tentando `DELETE` em massa filtrando pelo `tenant_id` de outro tenant | ✅ 0 linhas afetadas |
| Usuário comum tentando `INSERT` forjando `tenant_id` de outro tenant | ✅ Rejeitado: `new row violates row-level security policy` |

### Multi-Tenant

Isolamento testado bidirecionalmente (Tenant A ⇄ Tenant B) com dois usuários reais e distintos, sem privilégio elevado:

| Tabela | Tenant A → dados A | Tenant A → dados B | Tenant B → dados A |
|---|---|---|---|
| `leads` | ✅ permitido | ✅ bloqueado (0 linhas) | ✅ bloqueado (0 linhas) |
| `users` | ✅ permitido | ✅ bloqueado (0 linhas) | ✅ bloqueado (0 linhas) |
| `dev_projects` (projetos) | ✅ permitido | ✅ bloqueado | — (sem dado de teste no tenant B) |
| `finance_entries` (financeiro) | ✅ permitido | — (sem dado cross-tenant pra testar) | — |
| `ai_usage_log` (logs, C4) | ✅ permitido | ✅ bloqueado (0 linhas, inclusive como usuário autenticado comum, não só `anon`) | — |
| `clientes`, `proposals` (documentos) | Sem dado de teste em nenhum tenant no momento — RLS idêntica (`has_tenant_access`) às tabelas já testadas, mesmo padrão comprovado | | |

Observação lateral (não é falha de segurança, é achado de higiene de dado): `finance_entries` tem 22 linhas com `tenant_id IS NULL` — a RLS as torna invisíveis pra qualquer usuário que não seja `is_super_admin`, então não vazam, mas provavelmente também ficam invisíveis pra quem deveria vê-las (o tenant dono). Vale investigar a origem dessas linhas depois, fora do escopo de segurança.

### Database

| Teste | Resultado |
|---|---|
| `SELECT` indevido (`anon` em `ai_usage_log`/`aurora_audit_log`) | ✅ `permission denied` (C4) |
| `INSERT`/`UPDATE`/`DELETE` indevido (usuário comum, tabela de outro tenant) | ✅ Bloqueados (ver Authorization acima) |
| RPC pública (`claim_next_form_sdr`, tenant errado) | ✅ `access denied` (C5) |
| RPC pública (`claim_next_form_sdr`, tenant correto do E-EMPREENDA+) | ✅ Funciona normalmente |
| RPC administrativa (`platform_metrics_overview`, usuário comum) | ✅ Bloqueada |
| RLS habilitada em toda tabela de `public` | ✅ Confirmado via `pg_class.relrowsecurity` — 73/73 |
| `get_advisors` (security) | ✅ Sem novo lint desde a última correção; únicos WARNs restantes são funções `SECURITY DEFINER` já revisadas como seguras + o toggle manual de "Leaked Password Protection" |

### API

| Teste | Resultado |
|---|---|
| Endpoint administrativo sem autenticação (produção real) | ✅ `401` |
| Endpoint de IA sem autenticação (produção real) | ✅ `401` |
| CORS com origem arbitrária (produção real) | 🟡 Ainda aceita qualquer origem — **build antigo em produção**, ver seção 4. Corrigido no código local, não corrigido no deploy atual. |
| Alteração de `tenant_id` via payload | ✅ Bloqueada em todo lugar testado — banco nunca confia em `tenant_id` vindo do cliente (RPC, RLS, `req.supabase`) |
| IDOR | ✅ Coberto pelos testes de Authorization/Multi-Tenant acima |

### Security (revisão estática)

Sem mudança desde `FINAL_SECURITY_REPORT.md` — reconferido: SQL Injection (nenhum vetor, query builder parametrizado), XSS (`dangerouslySetInnerHTML`: zero ocorrências), secrets no diff desta sessão (zero — ver seção abaixo), CORS (código correto, deploy pendente), webhooks (nenhum endpoint de entrada), logs (erros genéricos ao cliente), uploads (limites no bucket), dependências (`npm audit`: 3 moderadas remanescentes, avaliação de upgrade major do `express` ainda pendente por decisão, não por esquecimento).

---

## 6. Ações manuais pendentes (confirmadas, nenhuma executada)

🚨 **1. Rotacionar a senha de `admin@gthec.com`** no Supabase Auth — confirmado ainda pendente. Achado novo desta rodada (seção 3) aumenta a urgência: o valor está presente em duas migrations já commitadas, não só no bundle antigo.

🚨 **2. Rotacionar `AXIS_API_KEY_MAIN`, `AXIS_API_KEY_FORM` e a chave do Gemini** — confirmado ainda pendente.

🚨 **3. Ativar "Leaked Password Protection"** em Authentication → Policies no painel do Supabase — confirmado ainda desativado (`get_advisors` reconferido nesta rodada).

🚨 **4. Decidir o destino de `E-EMPREENDA+/`** — confirmado ainda sem decisão, diretório continua no repositório.

Nenhum valor de secret foi exibido neste documento, no terminal desta sessão (fora do necessário pra confirmar a existência do achado nas migrations, que não reproduzo aqui) ou em qualquer resposta.

---

## 7. Documentação — revisão de coerência

Todos os arquivos abaixo foram lidos nesta rodada e comparados contra o estado real (código + banco). Nenhum precisou de reescrita — apenas este documento (`POST_HARDENING_AUDIT.md`) é novo:

`README.md`, `docs/ARCHITECTURE.md`, `docs/API.md`, `docs/DATABASE.md`, `docs/DATABASE_SECURITY.md`, `docs/AUTHENTICATION.md`, `docs/AUTHORIZATION.md`, `docs/WEBHOOKS.md`, `docs/ENVIRONMENT.md`, `docs/DEPLOYMENT.md`, `docs/SECURITY.md`, `docs/DEVELOPMENT.md`, `docs/TROUBLESHOOTING.md`, `SECURITY_CHECKLIST.md`, `FINAL_SECURITY_REPORT.md`, `SECURITY_AUDIT.md`.

---

## 8. Build

- `npx tsc --noEmit -p tsconfig.json` → **PASS**, exit code 0, zero erros.
- `npm run build` (`vite build` + bundle do backend via esbuild) → **PASS**, exit code 0. Únicos avisos: chunks JS acima de 500kB e um caso de import dinâmico+estático do mesmo módulo (`src/lib/utils.ts`, `sonner`) — avisos estruturais de bundling pré-existentes, sem relação com esta rodada de segurança, não alterados (fora do escopo: refatoração de code-splitting não pedida).
- Ambos rodaram sob contenção de disco anormal nesta máquina (sincronização ativa do iCloud Drive na pasta do projeto) — tempos de execução muito acima do normal, mas os resultados em si são válidos e conclusivos.

---

## 9. Decisões futuras (não implementadas, só registradas)

- **RBAC granular** dentro do tenant (Tenant → Usuários → Cargos → Permissões → Módulos → Ações) — decisão de produto, ver [`AUTHORIZATION.md`](AUTHORIZATION.md#pendências-conhecidas-não-corrigidas-nesta-rodada).
- **Destino do `E-EMPREENDA+/`** — manter versionado neste repositório ou extrair pra repositório próprio.
- **M5** — se o RBAC granular avançar no futuro, revisitar se `role` precisa de validação estruturada (enum global ou FK pra `cargos`); até lá, permanece texto livre por design, documentado como baixo risco.
