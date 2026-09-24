# Checklist de segurança pré-deploy

Use antes de cada deploy pra produção e sempre que uma tabela, rota ou variável de ambiente nova for adicionada.

## Banco de dados / RLS

- [ ] Tabela nova tem `tenant_id uuid references tenants(id)` (a menos que seja ownership por usuário/parceiro, como `user_settings`/`partners` — documentar a exceção)
- [ ] `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` foi executado (já aconteceu neste projeto de esquecer isso — uma policy sem RLS habilitada na tabela é decorativa)
- [ ] Existe uma policy `tenant_isolation` usando `has_tenant_access(tenant_id)` (ou o padrão equivalente documentado em [docs/DATABASE_SECURITY.md](docs/DATABASE_SECURITY.md))
- [ ] Nenhuma policy nova tem `qual: true`/`with_check: true` sem que isso seja intencional e documentado (esse exato padrão gerou o achado crítico C4 nesta auditoria)
- [ ] Nenhum `GRANT` a `anon` além do estritamente necessário (leitura pública de verdade, tipo formulário de captação) — checar com `select * from information_schema.role_table_grants where grantee='anon'`
- [ ] Testado com `SET ROLE anon;` (e, se aplicável, `SET ROLE authenticated; SET request.jwt.claims = '{"sub":"<uid>"}';` — de preferência dentro de `begin; ... rollback;` com `set local` — simulando um usuário de outro tenant) que o acesso indevido retorna `permission denied` ou zero linhas — não confiar só em `information_schema.column_privileges`, que já se mostrou enganosa nesta auditoria
- [ ] `get_advisors` (security) rodado depois da migração, sem novo lint
- [ ] Função `SECURITY DEFINER` nova que aceita um parâmetro de tenant/id valida esse parâmetro contra `has_tenant_access()` ou um valor fixo conhecido — nunca confia cegamente no argumento (foi exatamente esse o achado crítico C5 desta auditoria, em `claim_next_form_sdr`)
- [ ] Função `SECURITY DEFINER` nova que agrega dado cross-tenant checa `is_super_admin()`/`current_partner_id()` no próprio corpo antes de devolver algo (padrão já usado em `platform_metrics_overview()`)

## Backend (`server.ts`)

- [ ] Rota nova tem `requireUser`, `requireApiKey` ou `requireMaster` explicitamente — nunca uma rota que grava dado sem nenhum dos três
- [ ] Rota que faz ação de plataforma (criar tenant, trocar credencial de outro usuário) tem `requireMaster`, não só um botão escondido no frontend
- [ ] Nenhum `error.message`/stack trace do Supabase devolvido cru no corpo da resposta HTTP — mensagem genérica pro cliente, detalhe só em `console.error`
- [ ] Rota nova de custo real (chamada de IA, envio de mensagem) está sob um rate limiter (`express-rate-limit`)
- [ ] Se a rota recebe `tenant_id` de algum lugar, ele vem da sessão/API key (`req.supabase`, `current_tenant_id()`, mapa de API key) — nunca do corpo/query da requisição. Quando um `?tenantId=`/header `x-active-tenant-id` é aceito (master/parceiro), o resultado de `has_tenant_access` precisa **de fato** decidir (negar em caso de falso/erro) — ver o achado do Google Calendar em [docs/projeto/02-TRD.md](docs/projeto/02-TRD.md) §14.2
- [ ] Rota que faz requisição a URL/host informado pelo usuário (`webhook-test`, `smtp-test`, testes de gateway, conector externo) passa por proteção contra **SSRF**: só `https`, resolve DNS e bloqueia loopback/RFC1918/link-local (`169.254.x`, metadata de cloud)/CGNAT/IPv6 local, com timeout (ver `server/ssrfGuard.ts`, quando presente no repo; achado de alta prioridade em [TRD §19.6](docs/projeto/02-TRD.md))
- [ ] Comparação de segredo (segredo de webhook, chave de API, `state` de OAuth) usa comparação em tempo constante (`crypto.timingSafeEqual` com checagem de tamanho), não `===`/`!==`
- [ ] Rota **pública** (sem `requireUser`/`requireApiKey`: `/api/public/lead-capture`, `/api/public-proposal/:token`, `/api/auth/tenant-theme`, webhook do WAHA) tem rate limit próprio, não devolve `err.message` cru, não permite enumerar tenants/e-mails, e ação de escrita (ex.: `accept` de proposta) confere o estado atual do registro
- [ ] Rota que cacheia resposta no Redis (`-summary`, `-list`, `table-preview`) não serve dado protegido por RLS de **módulo/cargo** a outro usuário do mesmo tenant: a chave de cache hoje é por tenant, não por usuário — para módulos com policy por permissão (`user_has_module_access`, clínica/educação), incluir usuário/cargo na chave ou não cachear
- [ ] Rota de administração/auditoria (`/api/admin/*`, `permission-check-log`) exige `requireMaster` (ou `requireTenantAdmin`), não só `requireUser`

## Segredos e variáveis de ambiente

- [ ] Nenhuma variável que precisa ficar secreta tem prefixo `VITE_` (tudo `VITE_*` vai pro bundle público)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` não aparece em nenhum arquivo dentro de `src/`
- [ ] `.env` não foi commitado (`git status` limpo antes do commit, `.env` no `.gitignore`)
- [ ] `.env.example` só tem placeholders, nunca valor real
- [ ] `SPY_CORS_ORIGIN` é uma lista de domínios reais, nunca `"*"`, em produção (o código ainda aceita `AXIS_CORS_ORIGIN` como fallback legado — remova a variável antiga do painel da Vercel após migrar)
- [ ] `SPY_API_KEYS` (`chave:tenantId,...`) tem chaves longas e aleatórias (`openssl rand -hex 32`), uma por integração/tenant; `AXIS_API_KEYS` só existe como fallback legado
- [ ] Segredos server-only (`GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_STATE_SECRET`, `WAHA_API_KEY`, `AURORA_WEBHOOK_URL`, `REDIS_URL`) só no painel da Vercel/`.env`, nunca `VITE_*`; `GOOGLE_OAUTH_STATE_SECRET` definido (senão cai no `SUPABASE_SERVICE_ROLE_KEY` como fallback)

## Dependências

- [ ] `npm audit --audit-level=high` passa (rodado em CI, mas confira antes de mergear se adicionou dependência nova)
- [ ] Dependência nova é realmente usada (evitar repetir M2/M6 desta auditoria: pacotes importados de lugar nenhum)

## Git

- [ ] `git status` revisado antes de um `git add` amplo — nenhum arquivo com aparência de config/credencial sendo commitado sem checar o conteúdo
- [ ] Nenhuma chave/segredo real em qualquer commit novo (uma vez commitado, precisa de rotação, não só de deletar o arquivo depois)

## Frontend / autorização

- [ ] Uma tela/botão nova restrito a um papel (`isMaster`/`isTenantAdmin`) tem o controle real correspondente na RLS ou no backend — esconder no frontend é UX, não segurança (ver [docs/AUTHORIZATION.md](docs/AUTHORIZATION.md))
- [ ] Upload de arquivo novo passa por um bucket com `file_size_limit`/`allowed_mime_types` configurado no Storage, não só validação no cliente

## Antes de ir pra produção (checklist única, não recorrente)

- [ ] 🚨 Senha de `admin@gthec.com` trocada no Supabase Auth (C1 — pendente, ver [`SECURITY_AUDIT.md`](SECURITY_AUDIT.md))
- [ ] 🚨 Chaves de `SPY_API_KEYS` (antes `AXIS_API_KEY_MAIN`/`AXIS_API_KEY_FORM`) e chave do Gemini rotacionadas (C2 — pendente)
- [ ] Migrations de `supabase/migrations/20260921_*` revisadas e aplicadas no banco vivo (a1 bloqueio de período, cr1 cargos/squads, cr2 plano/módulos, cr3 clínica/educação — não aplicadas em 2026-09-24; ver [docs/projeto/05-ESQUEMA-BACKEND.md](docs/projeto/05-ESQUEMA-BACKEND.md) §11)
- [ ] 🚨 "Leaked Password Protection" habilitada em Authentication → Policies no painel do Supabase (pendente)
- [ ] Decisão tomada sobre `E-EMPREENDA+/` continuar versionado neste repositório (M3)
- [ ] CI (`.github/workflows/ci.yml`) passando no branch antes do merge
