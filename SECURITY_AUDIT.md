# SECURITY_AUDIT.md — Axis

**Escopo:** auditoria completa (frontend, backend `server.ts`/`api/`, Supabase/Postgres, RLS, Storage, dependências, Git/histórico). Nenhum código foi alterado durante esta auditoria — só leitura, grep, queries `SELECT` e verificação de estado ao vivo no Supabase (`snwkzvgompfgqoqbpihe`).

**Como ler:** cada item tem Onde / Por que é perigoso / Como explorar / Impacto / Correção / Risco de quebrar algo. Itens marcados 🚨 **REQUER AÇÃO MANUAL** não podem ser resolvidos só editando código — dependem de uma decisão ou ação sua (rotacionar chave, confirmar que algo é intencional, etc.).

---

## Resumo executivo

| Severidade | Qtd |
|---|---|
| 🔴 Crítico | 5 |
| 🟠 Alto | 11 |
| 🟡 Médio | 6 |
| 🟢 Baixo | 3 |

**Atualização 2026-09-03:** durante a fase de documentação (`docs/DATABASE_SECURITY.md`), uma nova checagem ao vivo de `pg_policies`/`role_table_grants` (mais rigorosa que a varredura original, que tinha se apoiado em `information_schema.column_privileges` — visto que essa view já se mostrou enganosa nesta mesma auditoria, ver A8) encontrou um quarto crítico não listado na rodada original: **C4**, abaixo. Uma rodada seguinte de `get_advisors` (security) encontrou ainda um quinto: **C5**. Ambos já corrigidos.

O ponto mais importante deste relatório: **as credenciais de um super admin real e ativo em produção (`admin@gthec.com`) estão hardcoded no código-fonte e são enviadas para o navegador de qualquer visitante.** Isso precisa de ação manual imediata (trocar a senha dessa conta), independente de qualquer outra correção de código.

Fora isso, a arquitetura de isolamento multi-tenant no banco (RLS/`has_tenant_access`) está, no geral, bem aplicada — a maior parte dos problemas encontrados é de **superfície** (chaves vazadas no histórico do Git, CORS aberto, RBAC só no frontend, falta de rate limiting) e não de vazamento de dados já em andamento.

---

## 🔴 CRÍTICO

### C1 — Senha de super admin hardcoded no bundle do navegador, conta real e ativa em produção

**Onde:** `src/lib/supabase.ts:421-482` (`setupMasterUser()`), disparado por um botão em `src/pages/admin/AdminSaaS.tsx:63-72,96-99`. A rota `/app/admin` (`src/App.tsx:293`) só é protegida pelo `ProtectedRoute` genérico (`src/components/ProtectedRoute.tsx`, que só checa "existe usuário logado") — **sem checagem de `isMaster`**.

```ts
const MASTER_EMAIL = 'admin@gthec.com';
const MASTER_PASSWORD = '[REDACTADO — valor real removido deste relatório; senha já rotacionada]';
```

A senha ainda era ecoada de volta numa notificação: `AdminSaaS.tsx:68` → `toast.success(... "Senha: [REDACTADO]" ...)`.

**Verificado ao vivo no banco:** essa conta existe de fato, está `active: true` e `is_master: true` no tenant G-Tech Master (`id: 4e065163-73dc-4d31-a616-401fe124b073`) — não é uma conta de exemplo/demo, é o super admin real da plataforma.

**Por que é perigoso:** `is_master=true` dá acesso administrativo à plataforma inteira (criar/desativar tenants, ver métricas agregadas de todos os tenants via `platform_metrics_overview()`, trocar credenciais de outros usuários via `/api/admin/tenant-user/:id/credentials`).

**Como seria explorado:** qualquer pessoa abria o DevTools do navegador em qualquer tela do Axis, lia o JS já minificado (a senha estava lá em texto plano, sem ofuscação), e fazia login direto:
```js
supabase.auth.signInWithPassword({ email: 'admin@gthec.com', password: '<valor hardcoded, não reproduzido aqui>' })
```
sem precisar passar pela UI do app.

**Impacto:** comprometimento total da administração da plataforma.

**Correção:**
1. 🚨 **REQUER AÇÃO MANUAL** — trocar a senha da conta `admin@gthec.com` agora, direto no Supabase Auth (dashboard ou via `supabase.auth.admin.updateUserById`). Isso eu não posso fazer sozinho sem sua confirmação explícita, porque é uma mudança em uma conta real de produção.
2. Remover `MASTER_EMAIL`/`MASTER_PASSWORD` hardcoded do código — mover o bootstrap do master (se ainda for necessário) para rodar só uma vez, server-side, nunca em código que vai pro bundle do cliente.
3. Adicionar uma checagem `isMaster` na rota `/app/admin` como defesa em profundidade (mesmo que o RLS já backstopeie os dados).

**Pode quebrar algo?** Remover o botão "Setup Master" tira a conveniência de recriar o master com um clique — mas a conta já existe, então não há perda funcional real. Trocar a senha exige atualizar quem quer que use essa conta hoje para logar.

---

### C2 — Chaves reais commitadas no histórico do Git (ainda recuperáveis)

**Onde:** `.env.example`, commits `10c4e61`/`f225b54` (2026-06-10/11) até `9d43b25` (2026-06-15), quando foram trocadas por placeholder — mas **permanecem legíveis no histórico do Git para sempre**, em qualquer clone do repositório:

- `GEMINI_API_KEY` / `VITE_GEMINI_API_KEY` — uma chave real da API Gemini.
- `AXIS_API_KEY_MAIN` (`axis_sk_live_...`) e `AXIS_API_KEY_FORM` (`axis_sk_form_...`) — essas são exatamente as chaves que o middleware `requireApiKey` (`server.ts:243-254`) valida para autorizar `POST/GET /api/v1/leads` (criar/ler leads de um tenant via API pública).

**Por que é perigoso:** se qualquer uma dessas chaves ainda estiver configurada como valor real em algum ambiente publicado (variável de ambiente da Vercel, por exemplo), continua válida — o fato de o arquivo atual ter só placeholder não invalida a chave em si.

**Como seria explorado:** `git log -p` ou clonar o repo → achar a chave no histórico → `curl -H "x-api-key: axis_sk_live_..." https://<seu-dominio>/api/v1/leads` para criar/ler leads de um tenant sem autorização real.

**Impacto:** criação/exfiltração não autorizada de leads do tenant associado a essa chave.

**Correção:**
1. 🚨 **REQUER AÇÃO MANUAL** — gerar uma chave Gemini nova (revogar a antiga no Google AI Studio) e gerar novos valores para `AXIS_API_KEY_MAIN`/`AXIS_API_KEY_FORM`, atualizando o `AXIS_API_KEYS` no ambiente de produção (Vercel).
2. Opcional (mais disruptivo): reescrever o histórico do Git (`git filter-repo`) para remover as chaves antigas — só vale a pena se alguém realmente clonou/tem acesso ao histórico completo; a rotação por si só já neutraliza o risco.

**Pode quebrar algo?** Sim — qualquer integração/ambiente que ainda use a chave antiga vai parar de funcionar até você atualizar para a nova. Precisa coordenar a troca com o deploy.

---

### C3 — RBAC é 100% client-side; não existe uma segunda camada de defesa

**Onde:** sistêmico. Nenhuma rota em `src/App.tsx` tem checagem de papel além de "existe sessão" (`ProtectedRoute.tsx`). Toda checagem de `user.isMaster`/`user.isTenantAdmin`/`user.role` encontrada (14 pontos amostrados — ver Alto #A1-A3 abaixo para os mais graves) só esconde item de menu ou botão. A instância mais grave é a própria rota `/app/admin` (ver C1).

**Por que é perigoso:** isso significa que a **única** barreira real de autorização no sistema inteiro é o RLS do Postgres. Não há rede de segurança se uma policy de RLS tiver um erro (e isso já aconteceu duas vezes neste projeto — ver a memória `rls_policy_without_enable_footgun`, tabelas que tiveram RLS habilitado sem policy, ou policy sem RLS habilitado).

**Como seria explorado:** um usuário autenticado de qualquer papel, usando o DevTools, chama `supabase.from('finance_entries').select('*').eq('tenant_id', '<outro-tenant>')` diretamente — se o RLS daquela tabela tiver qualquer furo, funciona, independente do que a interface mostra.

**Impacto:** qualquer regressão futura de RLS vira uma falha crítica sem aviso, porque não existe um segundo obstáculo.

**Correção:** não é "trocar uma linha" — é uma decisão arquitetural. Recomendo: (a) manter o RLS como fonte de verdade (é o padrão correto para apps Supabase-first), mas (b) adicionar guardas de rota no frontend para as telas de maior risco (`/app/admin` no mínimo — ver C1) como defesa em profundidade, e (c) tratar qualquer lacuna de RLS encontrada daqui pra frente como crítica, não como bug de dado.

**Pode quebrar algo?** Adicionar guardas de rota é aditivo e de baixo risco, desde que `isMaster`/`isTenantAdmin` estejam corretamente populados na sessão no momento da checagem (testar).

---

### C4 — `ai_usage_log`/`aurora_audit_log`: RLS decorativa + GRANT completo pra `anon` (achado tardio, já corrigido)

**Onde:** duas tabelas tinham policy com `qual: true`/`with_check: true` pra role `public` (`ai_usage_log_open_access`, e uma policy chamada — de forma enganosa — `aurora_audit_log_tenant_isolation` mas cujo `qual` também era literalmente `true`), **combinado** com `GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ... TO anon` no nível de tabela.

**Por que é perigoso:** RLS controla linha, `GRANT` controla se a role pode tocar a tabela de jeito nenhum — os dois juntos aqui significavam que **qualquer requisição não autenticada** (role `anon`, a mesma usada pelo `VITE_SUPABASE_ANON_KEY` público) podia ler, escrever, atualizar ou apagar as duas tabelas inteiras, de todos os tenants, sem passar por login nenhum.

**Como seria explorado:** `supabase.from('ai_usage_log').select('*')` ou `.delete().neq('id', 0)` direto do navegador, sem sessão — funcionaria.

**Impacto:** mitigado por essas duas tabelas não terem nenhum consumidor no código (`grep` em `src/`, `server.ts` e `E-EMPREENDA+/` não retornou nenhuma referência) — não há evidência de exfiltração/adulteração real tendo ocorrido, mas a superfície esteve aberta desde a criação das tabelas.

**Correção:** `revoke all ... from anon` + policy `tenant_isolation`/`has_tenant_access(tenant_id)`, igual ao padrão de todo o resto do banco. Aplicado via migração `20260903_close_open_rls_policies.sql`, verificado ao vivo (`SET ROLE anon; SELECT * FROM ai_usage_log;` → `permission denied`).

**Pode quebrar algo?** Não — zero código depende dessas tabelas hoje.

---

### C5 — `claim_next_form_sdr(p_tenant_id)`: RPC pública aceitava qualquer tenant (achado tardio, já corrigido)

**Onde:** função `SECURITY DEFINER`, chamada sem login pelo formulário público de inscrição do E-EMPREENDA+ (`E-EMPREENDA+/src/pages/Inscricao/index.tsx:147`, `supabase.rpc('claim_next_form_sdr', { p_tenant_id: AXIS.TENANT_ID })`). O `get_advisors` (security) sinalizou que a função é executável por `anon`/`authenticated` via `/rest/v1/rpc/claim_next_form_sdr` — investigando o código da função, ela **não validava `p_tenant_id` de jeito nenhum**, apesar de vir como parâmetro livre de uma chamada não autenticada.

**Por que é perigoso:** qualquer pessoa podia chamar essa RPC passando o `tenant_id` de **qualquer** empresa do sistema (não só o do E-EMPREENDA+), e a função: (1) devolvia nome, telefone e `user_id` do colaborador SDR "da vez" daquele tenant — PII de funcionário de qualquer empresa cliente; (2) incrementava/corrompia o contador de rodízio daquele tenant em `app_settings`, inclusive criando a linha de config do zero se não existisse; sem rate limiting.

**Como seria explorado:** `supabase.rpc('claim_next_form_sdr', { p_tenant_id: '<uuid de qualquer tenant>' })` direto do navegador, sem login, repetido em loop para varrer todos os tenants.

**Correção:** a função agora recusa (`RAISE EXCEPTION 'access denied'`) qualquer `p_tenant_id` diferente do tenant fixo do E-EMPREENDA+ — mesmo padrão já usado nas policies de `INSERT` `anon` em `leads`/`tasks`/etc. Aplicado em `20260903_scope_claim_next_form_sdr.sql`, verificado ao vivo (`SET ROLE anon`: outro tenant → `access denied`; tenant do E-EMPREENDA+ → funciona normalmente).

**Pode quebrar algo?** Não — o único chamador real (`E-EMPREENDA+`) já usa o tenant correto.

---

### Outros achados do `get_advisors` (security) revisados nesta rodada

- `platform_metrics_overview()` — também sinalizada como executável por `anon`/`authenticated`, mas o próprio corpo da função já checa `current_partner_id() is null and not is_super_admin()` e recusa com exceção — confirmado seguro por leitura de código, não é um achado real.
- `email_taken(check_email)` — checagem de e-mail já cadastrado, usada em validação de formulário. Vaza só um booleano (e-mail existe ou não) pra quem tentar — risco baixo e função esperada de qualquer fluxo de cadastro com verificação de e-mail duplicado; não corrigido, aceito como está.
- `set_updated_at()` / `sync_sprint_task_project_from_issue()` — `search_path` mutável (WARN do linter). Nenhuma das duas é `SECURITY DEFINER` (são triggers comuns), então o risco prático é baixo, mas corrigido mesmo assim por ser mecânico e gratuito: `ALTER FUNCTION ... SET search_path = public`.
- `julia_round_robin_state` / `tenant_integrations` sem nenhuma policy (INFO do linter) — já documentado como intencional em [DATABASE_SECURITY.md](docs/DATABASE_SECURITY.md) (deny-all pra tudo que não seja `service_role`).
- `auth_leaked_password_protection` desabilitada — Supabase Auth pode checar senha nova/de reset contra a base do HaveIBeenPwned. 🚨 **Ação manual, fora do alcance de uma migração SQL**: habilitar em Authentication → Policies no painel do Supabase.

---

## 🟠 ALTO

### A1 — CORS com `Access-Control-Allow-Origin: *`

**Onde:** `server.ts:234-241` (todas as rotas de `/api/*`) e `supabase/functions/analyze-crm-call/index.ts:7-10`. O `.env` atual e o `.env.example` têm `AXIS_CORS_ORIGIN="*"` como valor.

**Por que é perigoso:** com autenticação via `Authorization: Bearer <token>` (não cookie), CORS aberto não permite roubo direto de sessão, mas permite que **qualquer site** leia a resposta de uma chamada autenticada feita por ele mesmo se conseguir um token válido por outro meio (XSS em outro lugar, extensão maliciosa, etc.) — remove uma camada de proteção que deveria existir.

**Correção:** trocar `AXIS_CORS_ORIGIN` para os domínios reais de produção (lista, não wildcard), e validar `req.headers.origin` contra essa lista em vez de simplesmente ecoar `*`.

**Pode quebrar algo?** Sim, se algum outro domínio legítimo (ex.: um site de marketing separado) depende hoje do CORS aberto para chamar a API — precisa ser adicionado explicitamente à allowlist.

---

### A2 — Nenhum rate limiting em lugar nenhum

**Onde:** confirmado por grep — não há `express-rate-limit`, `helmet` nem nenhum limitador custom em `server.ts`/`api/`.

**Não protegidos:** `POST/GET /api/v1/leads` (API pública por chave), todos os `/api/ai/*` (chamam Gemini/Groq — custo real por chamada), `/api/whatsapp/*`. Login/cadastro/reset de senha dependem inteiramente do rate limit nativo do Supabase Auth (não há nada nesta base de código).

**Impacto:** abuso de custo em IA (qualquer sessão válida pode martelar `/api/ai/*` sem limite), força-bruta de `x-api-key`, DoS volumétrico.

**Correção:** adicionar `express-rate-limit` (por IP e/ou por chave/usuário) nas rotas listadas.

**Pode quebrar algo?** Se o limite for baixo demais, pode barrar usuários legítimos com uso pesado — precisa de um valor razoável (ex. 60 req/min) e observação depois de implantar.

---

### A3 — Senha fraca hardcoded como fallback + criação de usuário sem checagem de papel

**Onde:** `src/pages/hr/RHColaboradores.tsx:63` e `src/components/ui/modals/hr/NovoMembroModal.tsx:79` — `password: data.senha || "123456"`. A tela `/app/equipe` não tem nenhuma checagem de `isMaster`/`isTenantAdmin` (confirmado por grep) — **qualquer usuário autenticado de qualquer papel no tenant pode criar novas contas reais no Supabase Auth**, potencialmente com a senha `123456` se o campo ficar em branco.

**Correção:** exigir senha (sem fallback silencioso) ou gerar uma senha temporária aleatória forte + fluxo de troca obrigatória no primeiro login; adicionar checagem de papel (`isTenantAdmin`/`isMaster`) antes de permitir criar usuário, e confirmar que a policy de INSERT em `users` reflete a mesma regra no banco.

**Pode quebrar algo?** Se hoje vendedores comuns convidam colegas como parte do fluxo normal, adicionar o gate muda esse comportamento — vale confirmar com você antes de implementar qual papel deveria poder convidar.

---

### A4 — Não existe fluxo de recuperação de senha

**Onde:** `src/pages/auth/components/LoginForm.tsx:58` — o link "Esqueci a senha" é `href="#"`, morto. Nenhuma chamada a `resetPasswordForEmail` existe no projeto.

**Impacto:** usuários sem acesso de self-service tendem a pedir reset por canais não auditados (WhatsApp, e-mail direto pra um admin) — risco de engenharia social, além de má experiência.

**Correção:** implementar `supabase.auth.resetPasswordForEmail`. Aditivo, sem risco de quebrar algo existente.

---

### A5 — `npm audit`: 1 crítica + 9 altas

**Totais:** 15 vulnerabilidades (1 crítica, 9 altas, 2 médias, 3 baixas) em 536 pacotes instalados. Todas com correção disponível.

| Pacote | Severidade | Resumo |
|---|---|---|
| `websocket-driver` | crítica | bypass de limite de recursos via compressão de mensagem |
| `axios` | alta | bypass de `maxDepth`; prototype pollution |
| `browserslist` | alta | crescimento de memória sem limite (OOM) |
| `form-data` | alta | injeção CRLF via nome de campo/arquivo não escapado |
| `nanoid` | alta | loop infinito com tamanho inválido |
| `postcss` | alta | correção incompleta de path traversal em sourceMappingURL |
| `protobufjs` | alta | DoS por expansão sem limite |
| `react-router` | alta | open redirect (`\` em `Link`/`useNavigate`); XSS em `RSCErrorHandler` |
| `vite` | alta | disclosure de hash NTLMv2 no Windows; bypass de `server.fs.deny` |
| `ws` | alta | DoS por exaustão de memória com fragmentos pequenos |

**Correção:** rodar `npm audit fix` para os que não exigem bump de major. `react-router`/`vite`/`axios` (alto blast radius) precisam de upgrade avaliado e testado manualmente, não `--force` às cegas.

**Pode quebrar algo?** Sim, potencialmente — `react-router` em particular afeta todo o roteamento do app. Não faça upgrade de major sem testar.

---

### A6 — Código morto mas "vivo": auto-cadastro público desativado só por redirect

**Onde:** `src/App.tsx:144-147` — a rota `/register` redireciona pra `/login`, mas `src/pages/auth/Register.tsx` e `registerPartner()` (`src/lib/supabase.ts:259-348`) continuam totalmente funcionais e exportados — essa função cria um **tenant novo + usuário admin** sem nenhum gate de convite/aprovação.

**Correção:** remover o código morto de fato, ou (se autocadastro for uma feature futura real) adicionar um gate de convite/aprovação — não deixar uma função "criar tenant" viva dependendo só de um redirect de rota como proteção.

---

### A7 — Sessão "demo" confia em dado do `sessionStorage` sem verificação server-side

**Onde:** `src/contexts/AuthContext.tsx` — se `supabase` (client) for `null` (env mal configurado) ou `getSession()` não retornar usuário, o app cai pra `readSavedSession()`, que confia cegamente num objeto `UserSession` (incluindo `isMaster`/`isTenantAdmin`) salvo em `sessionStorage`, sem nenhuma verificação. Hoje não encontrei nenhum ponto de entrada na UI que crie essa sessão fabricada sem um login real antes — está dormente, não é uma feature de "acesso demo" ativa.

**Correção:** remover esse fallback agora que o autocadastro/modo demo está desativado, ou proteger explicitamente atrás de uma flag que fica desligada em produção. Baixo esforço, elimina um risco latente.

---

### A8 — `tenants`: policy `anon` sem restrição de coluna

**Onde:** `anon_read_active_tenants` (`FOR SELECT TO anon USING (status='Active')`) — sem restrição de coluna, então inclui `webhook_url` e `evolution_api_url`. Verificado ao vivo: hoje esses campos estão vazios nos 3 tenants ativos, mas a policy não impede que fiquem expostos assim que alguém preencher.

**Correção:** criar uma view `tenants_public` (só `id`, `name`, `niche`, `status`) para o seletor de empresa público usar, e restringir a policy `anon` a essa view em vez da tabela inteira.

---

### A9 — `chat_messages`/`chat_contacts`: rotas sem isolamento de tenant (hoje inertes — tabelas não existem)

**Onde:** `server.ts:1125-1173` — usam o client Supabase padrão (chave anon, não o `req.supabase` já escopado por RLS da sessão) e filtram só por `contact_id`, sem checagem de `tenant_id`. **Verificado ao vivo:** as tabelas `chat_messages`/`chat_contacts` não existem no banco hoje — essas rotas retornariam erro em produção agora, não são um vazamento ativo.

**Por que ainda é Alto (e não Baixo):** se alguém criar essas tabelas pra ativar o chat de verdade sem revisar este ponto, vira um IDOR real (qualquer usuário autenticado de qualquer tenant adivinhando/enumerando `contact_id` acessa conversas de outro tenant).

**Correção:** ao criar essas tabelas, incluir `tenant_id` + policy `tenant_isolation` (mesmo padrão das ~47 tabelas existentes) e trocar essas rotas para usar `req.supabase`.

---

### A10 — Simulador de WhatsApp em memória sem isolamento de tenant (esse sim, ativo)

**Onde:** `server.ts` (arrays em memória `instances`/`contacts`/`messages`, por volta das linhas 51-64, expostos pelas rotas `/api/whatsapp/instances*` e `/api/whatsapp/contacts*`). É um único array compartilhado pelo processo Node inteiro — sem `tenant_id`. Qualquer usuário autenticado de qualquer tenant vê/altera instâncias e contatos simulados de outro tenant.

**Impacto:** parece ser dado de demonstração (não há integração real de WhatsApp conectada), então o impacto de negócio hoje é provavelmente baixo — mas é um vazamento cross-tenant real e ativo dentro do que essa feature simula.

**Correção:** indexar os stores em memória por `tenant_id` (`Map<tenantId, ...>`), ou, melhor, persistir numa tabela de verdade já que o padrão de tenant_id+RLS já existe em todo o resto do app.

---

### A11 — Respostas de erro inconsistentes, algumas vazando detalhe interno

**Onde:** `server.ts:317-321`, `:338-339`, `:958-960`, `:1005-1006`, `:1031`, e o handler global (`server.ts:1227-1232`) devolvem `error.message` do Supabase direto no corpo da resposta HTTP (pode incluir nome de tabela/coluna/constraint). Outras rotas (a maioria das `/api/ai/*`) engolem o erro e devolvem uma mensagem genérica. Nenhum stack trace foi encontrado, só `.message`.

**Correção:** padronizar mensagem genérica pro cliente + log detalhado só server-side (`console.error`/logger), em todas as rotas.

---

## 🟡 MÉDIO

### M1 — Buckets de Storage sem limite de tamanho/tipo de arquivo

**Onde:** buckets `avatars` e `proposals` — leitura pública (ok, é o esperado pra esse caso de uso), escrita corretamente restrita por pasta = `tenant_id` + RLS (não achei brecha aí). Mas nenhum dos dois bucket tem `file_size_limit`/`allowed_mime_types` configurado. O upload de avatar tem uma checagem de 2MB só no cliente (`ConfigPerfilUsuario.tsx:70-73`) — trivialmente contornável (não é enforcement real); o de propostas não tem checagem nenhuma.

**Correção:** configurar `file_size_limit`/`allowed_mime_types` direto no bucket do Supabase Storage (enforcement server-side, não depende do cliente).

---

### M2 — Arquivo Firebase órfão com chave real, dependência morta

**Onde:** `firebase-applet-config.json` (raiz do repo) — config de um projeto Firebase não relacionado ("yachty-shell-2b34d"), provavelmente resquício de um boilerplate. O pacote `firebase` no `package.json` não é importado em lugar nenhum do projeto (confirmado por grep).

**Correção:** apagar o arquivo e remover a dependência `firebase` do `package.json`. Chave de API web do Firebase não é secreta por design (a segurança do Firebase depende das Security Rules, não do sigilo da chave), mas é lixo desnecessário.

---

### M3 — Repositório aninhado (`Axis.git/`) e sub-projeto (`E-EMPREENDA+/`) versionados dentro do próprio repo

**Onde:** `Axis.git/` é um clone espelho completo (52 arquivos rastreados) apontando pra uma conta diferente do GitHub (`gustavohenrique0827/Axis`, enquanto o `origin` deste repo é `pluppex-art/Axis`) — inclui um histórico próprio de 16 commits mais antigo, com a mesma chave Firebase exposta. `E-EMPREENDA+/` é um projeto separado, com seu próprio `.env.example` duplicando a mesma anon key/URL real do Supabase.

**Por que isso importa além de organização:** a presença do `Axis.git/` provavelmente foi a causa dos comandos `git log --all` com wildcard travarem/retornarem vazio durante esta auditoria — dificulta qualquer auditoria futura de histórico.

🚨 **REQUER DECISÃO SUA antes de eu mexer:** `Axis.git/` parece claramente acidental (clone órfão de outra conta) — recomendo remover. Já `E-EMPREENDA+/` é usado ativamente nesta sessão (é o app público de captação de leads da Pluppex, com tenant_id próprio no banco) — não vou tratá-lo como lixo sem sua confirmação; pode ser intencional estar aqui dentro, ou pode ser melhor virar um repositório próprio.

---

### M4 — `.env.example` com chave real (não-secreta por design) em vez de placeholder

**Onde:** `.env.example:14-15` e `E-EMPREENDA+/.env.example:1-2` têm a anon/publishable key real + URL real do projeto Supabase (`snwkzvgompfgqoqbpihe`), em vez de um valor de exemplo genérico.

**Por que é só Médio, não Alto:** essa chave é uma "publishable key" — pública por design, protegida pelo RLS, não pela sua confidencialidade. Ainda assim, não deveria estar num arquivo chamado "example" — revela desnecessariamente qual é o projeto real.

**Correção:** trocar por um valor obviamente fictício.

---

### M5 — Campo `role` de usuário é texto livre, sem validação de enum

**Onde:** criação de usuário (`RHColaboradores.tsx`) aceita qualquer string em `role`/`cargo`. Hoje isso só afeta filtro cosmético de menu lateral, então o risco é baixo — mas se o RBAC for reforçado no futuro (recomendado, ver C3), esse campo precisa de uma lista fechada de valores validada no servidor.

---

### M6 — Limpeza de dependências

`vite` duplicado (`dependencies` e `devDependencies` com a mesma versão — inofensivo, mas redundante). `uuid` é dependência morta (nenhum import encontrado — todo o projeto usa `crypto.randomUUID()` nativo). `axios` (que está na lista de vulnerabilidades altas do `npm audit`) é usado só em 2 pontos de `server.ts`, enquanto o resto do projeto (19 arquivos) usa `fetch` nativo — consolidar em `fetch` elimina essa dependência vulnerável por completo.

---

## 🟢 BAIXO

### B1 — Nenhum header de segurança configurado

`vercel.json` não define CSP, `X-Frame-Options`, `Strict-Transport-Security`, `X-Content-Type-Options`. Recomendo adicionar um bloco `headers` com esses valores básicos.

### B2 — Sem CI/CD

Não existe `.github/workflows` — nenhum `tsc --noEmit`/`npm audit`/lint automático rodando em PR. Não é uma vulnerabilidade em si, mas significa que regressões de segurança (como o padrão "RLS sem ENABLE" que já aconteceu duas vezes neste projeto) não são pegas automaticamente antes do merge.

### B3 — Variáveis não-secretas misturadas no mesmo `.env` que segredos reais

Organizacional — vale documentar em `docs/ENVIRONMENT.md` (fase de documentação) quais variáveis são realmente sensíveis (`SUPABASE_SERVICE_ROLE_KEY`, `AXIS_API_KEYS`) vs. config pública (`AXIS_FORM_CLIENT_ID`, `APP_URL`).

---

## O que já está correto (não precisa de correção, citado pra dar contexto)

- `SUPABASE_SERVICE_ROLE_KEY` nunca é referenciada em `src/` — só em `server.ts`, e nunca é devolvida em nenhuma resposta HTTP (confirmado por grep em todas as rotas).
- `src/lib/supabase.ts` só constrói o client do navegador com a anon key — nunca com a service role.
- As rotas `/api/admin/*` (criar tenant, trocar credenciais) são corretamente protegidas por `requireUser` + `requireMaster` (checagem server-side de `is_master`, não confia em nada vindo do cliente).
- `POST/GET /api/v1/leads` deriva `tenant_id` da chave de API (mapa server-side), nunca confia em `tenant_id` vindo do corpo/query da requisição.
- Nenhum stack trace é devolvido ao cliente em nenhuma rota.
- Nenhum arquivo `.pem`/`.key` existe ou já existiu no histórico do repositório.
- `SUPABASE_SERVICE_ROLE_KEY` nunca teve um valor real commitado no histórico do Git (só o placeholder).
- Buckets de Storage: escrita corretamente restrita por pasta = tenant + RLS.
- A varredura de RLS (feita antes desta auditoria, nesta mesma sessão) confirmou 47 de 49 tabelas de negócio com `tenant_id` + RLS habilitada + policy `tenant_isolation` usando `has_tenant_access()` — e as brechas de RLS encontradas (policies `anon` demais em `leads`/`tasks`/etc.) já foram corrigidas mais cedo nesta mesma sessão.

---

## Status das correções (atualizado após a primeira rodada de fixes)

| Item | Status | Arquivo(s) | Evidência |
|---|---|---|---|
| C1 — senha master hardcoded | 🟢 Corrigido no código / 🚨 senha ainda precisa ser trocada manualmente | `src/lib/supabase.ts`, `src/pages/admin/AdminSaaS.tsx`, `src/components/ProtectedRoute.tsx`, `src/App.tsx` | `setupMasterUser()` e as credenciais hardcoded foram removidas do bundle; `/app/admin` agora exige `isMaster` (`requireMaster`). A senha real de `admin@gthec.com` no Supabase Auth continua a mesma até você trocá-la. |
| C2 — chaves vazadas no histórico | 🚨 Requer ação manual | — | Confirmado: `AXIS_API_KEY_MAIN`/`AXIS_API_KEY_FORM` no `.env` local são as mesmas chaves que vazaram no Git entre 2026-06-10 e 06-15. Rotação não pode ser feita por mim. |
| C3 — RBAC só client-side | 🟡 Parcialmente mitigado | `src/components/ProtectedRoute.tsx` | Rota `/app/admin` ganhou guarda server-verificada (`user.isMaster`, que vem de `public.users` via sessão real). As demais telas (Financeiro, RH, etc.) continuam sem guarda de rota — RLS é a única barreira lá. |
| A1 — CORS `*` | 🟢 Corrigido | `server.ts`, `supabase/functions/analyze-crm-call/index.ts`, `.env`, `.env.example` | Trocado por allowlist de origem (`AXIS_CORS_ORIGIN`, agora `https://axis-crm.pluppex.com.br` + localhost). Sem a env var configurada, nenhuma origem é liberada. |
| A2 — sem rate limiting | 🟢 Corrigido | `server.ts`, `package.json` | `express-rate-limit` adicionado em `/api/v1/leads` (60/min), `/api/leads/*` e `/api/ai/*` (20/min), `/api/whatsapp/*` (60/min). |
| A3 — senha fraca "123456" + convite sem checagem de papel | 🟢 Corrigido | `src/components/ui/modals/hr/NovoMembroModal.tsx`, `src/pages/hr/RHColaboradores.tsx` | Fallback agora gera senha temporária aleatória forte (mostrada ao admin via toast). Botão "Novo Registro" e o handler agora exigem `isMaster`/`isTenantAdmin`. |
| A4 — sem recuperação de senha | 🟢 Corrigido | `src/lib/supabase.ts`, `src/pages/auth/components/LoginForm.tsx`, `src/pages/auth/ResetPassword.tsx`, `src/App.tsx` | Fluxo completo: "Esqueci a senha" → `resetPasswordForEmail` → link → `/redefinir-senha` → `updateUser({password})`. |
| A5 — `npm audit` (1 crítica + 9 altas) | 🟢 Corrigido (parcial) | `package.json`, `package-lock.json` | `npm audit fix` aplicado — de 15 vulnerabilidades (1 crítica, 9 altas) para 3 moderadas (cadeia `express`→`body-parser`→`qs`, exige bump de major do `express`, não feito automaticamente por ser mudança de maior risco). |
| A6 — rota `/register` morta mas viva | 🟢 Corrigido | `src/lib/supabase.ts`, `src/pages/auth/Register.tsx` (removido) | `Register.tsx` e `registerPartner()` removidos — nada mais cria tenant+admin sem gate. |
| A7 — sessão demo confia em `sessionStorage` | 🟢 Corrigido | `src/contexts/AuthContext.tsx` | Sem sessão real do Supabase Auth, o usuário agora vira `null` em vez de confiar num objeto salvo localmente sem verificação. |
| A8 — `tenants` sem restrição de coluna pra `anon` | 🟢 Corrigido | migração `20260902_restrict_anon_tenants_columns.sql` | Testado ao vivo via `SET ROLE anon`: `SELECT webhook_url FROM tenants` agora retorna "permission denied"; `SELECT id, name, status` continua funcionando (tela de login não quebra). |
| A9 — `chat_messages`/`chat_contacts` sem tenant_id | 🟢 Corrigido | migração `20260921_whatsapp_real_chat_persistence.sql`, `server.ts` | Tabelas criadas com `tenant_id` + policy `tenant_isolation` (`has_tenant_access()`, mesmo padrão das demais) desde a origem — rotas trocadas para `req.supabase`/`resolveRequestedTenantId`. WhatsApp passou de simulador em memória para conexão real via WAHA com webhook + auto-reply da Aurora (ver commit `feat: WhatsApp real por tenant, conectado à Aurora`). |
| A10 — WhatsApp em memória sem tenant_id | 🟢 Corrigido | `server.ts`, migração `20260921_whatsapp_real_chat_persistence.sql` | Objetos em memória (`contactsByTenant`/`messagesByTenant`) removidos por completo — contatos/mensagens persistem de verdade em `chat_contacts`/`chat_messages` (RLS por tenant), populados pelo webhook real do WAHA. |
| A11 — erros crus na resposta | 🟢 Corrigido | `server.ts` | `/api/v1/leads`, `/api/admin/tenant-user/:id/credentials`, `/api/admin/tenant` e o handler global de erro agora devolvem mensagem genérica ao cliente; detalhe completo só em `console.error`. |
| M1 — buckets sem limite de tamanho/tipo | 🟢 Corrigido | Supabase Storage (`avatars`, `proposals`) | `avatars`: 5MB, só imagem. `proposals`: 20MB, PDF/imagem. Configurado direto no bucket (enforcement server-side). |
| M2 — arquivo/dependência Firebase órfãos | 🟢 Corrigido | `firebase-applet-config.json` (removido), `package.json` | Arquivo apagado, dependência `firebase` removida. |
| M3 — `Axis.git/`/`E-EMPREENDA+/` versionados | 🟡 Parcial | `Axis.git/` removido | `Axis.git/` (clone órfão) apagado e adicionado ao `.gitignore`. `E-EMPREENDA+/` mantido — ainda aguardando sua confirmação. |
| M4 — chave real no `.env.example` | 🟢 Corrigido | `.env.example` | Anon key e URL real trocadas por placeholder. |
| M5 — `role` sem validação de enum | 🟡 Não alterado | — | Baixo risco hoje (só afeta filtro cosmético). |
| M6 — dependências duplicadas/mortas | 🟢 Corrigido | `package.json` | Removidos `uuid` (não usado) e a duplicata de `vite` em `dependencies`. |
| B1 — sem headers de segurança | 🟢 Corrigido | `vercel.json` | Adicionado `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Strict-Transport-Security`. CSP não incluída — precisa de levantamento dos recursos externos carregados pra não quebrar nada. |
| B2 — sem CI/CD | 🟢 Corrigido | `.github/workflows/ci.yml` | Roda em todo PR/push a `main`: `npm ci` → `tsc --noEmit` → `npm audit --audit-level=high` → `npm run build`. |
| C4 — `ai_usage_log`/`aurora_audit_log` abertas pra `anon` (achado tardio) | 🟢 Corrigido | migração `20260903_close_open_rls_policies.sql` | `REVOKE ALL ... FROM anon` + policy `tenant_isolation`/`has_tenant_access(tenant_id)`. Testado ao vivo via `SET ROLE anon` → `permission denied`. |
| C5 — `claim_next_form_sdr` aceitava qualquer tenant (achado tardio) | 🟢 Corrigido | migração `20260903_scope_claim_next_form_sdr.sql` | Função agora recusa qualquer `p_tenant_id` que não seja o do E-EMPREENDA+. Testado ao vivo via `SET ROLE anon`: outro tenant → `access denied`; tenant correto → funciona. |
| `search_path` mutável em `set_updated_at`/`sync_sprint_task_project_from_issue` (achado tardio, baixo risco) | 🟢 Corrigido | migração `20260903_fix_mutable_search_path_functions.sql` | `ALTER FUNCTION ... SET search_path = public` nas duas. |
| `auth_leaked_password_protection` desabilitada (achado tardio) | 🚨 Requer ação manual | — | Habilitar em Authentication → Policies no painel do Supabase — não é uma migração SQL. |

Todas as mudanças de código passaram em `tsc --noEmit` e num build de produção (`npm run build`) sem erros novos.

## Próximos passos sugeridos

Concluído desde a rodada de diagnóstico original: todas as correções de código automatizáveis (tabela acima), `.env.example` reorganizado, suíte completa de documentação (`docs/ARCHITECTURE.md`, `API.md`, `DATABASE.md`, `DATABASE_SECURITY.md`, `AUTHENTICATION.md`, `AUTHORIZATION.md`, `WEBHOOKS.md`, `ENVIRONMENT.md`, `DEPLOYMENT.md`, `SECURITY.md`, `DEVELOPMENT.md`, `TROUBLESHOOTING.md`), CI (B2), e este achado tardio (C4).

Ainda pendente, e não automatizável por mim:
1. 🚨 **C1** — trocar a senha de `admin@gthec.com` no Supabase Auth.
2. 🚨 **C2** — rotacionar `AXIS_API_KEY_MAIN`, `AXIS_API_KEY_FORM` e a chave do Gemini (valores vazados no histórico do Git continuam em uso).
3. 🚨 Habilitar "Leaked Password Protection" em Authentication → Policies no painel do Supabase (achado tardio do `get_advisors`).
4. Decidir o destino de `E-EMPREENDA+/` (M3) — manter versionado aqui ou extrair pra repositório próprio.
5. Decisão de produto sobre granularidade de RBAC dentro do tenant (C3 — hoje qualquer usuário autenticado do tenant chama qualquer rota `requireUser`).
6. Testes de segurança formais (seção 20 do pedido original) — ver [`FINAL_SECURITY_REPORT.md`](FINAL_SECURITY_REPORT.md) pra o que foi possível testar sem uma sessão de usuário real no navegador.
