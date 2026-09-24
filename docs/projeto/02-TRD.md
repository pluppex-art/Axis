# 02 — TRD: Documento de Requisitos Técnicos

> Versão 1.1 · 2026-09-24 · Complementa [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md), [`API.md`](../API.md), [`DATABASE.md`](../DATABASE.md).
>
> **Sumário:** §1-11 visão geral e invariantes · §12 estrutura de pastas e convenções · §13 frontend em detalhe · §14 backend em detalhe · §15 banco (visão técnica) · §16 erros, logging e observabilidade · §17 estratégia de testes · §18 performance · §19 segurança técnica detalhada · §20 guia de contribuição · §21 ADRs.
>
> **Convenção de verificação:** tudo que está nas seções 12-21 foi conferido lendo o código em 2026-09-24 (arquivos citados em crases, com nº de linha quando útil). Itens marcados **[Não verificado]** não puderam ser confirmados só pela leitura do repositório (ex.: estado real do banco de produção, configuração da Vercel/Supabase). Itens marcados **[Achado]** são divergências ou riscos encontrados durante a leitura, ainda não corrigidos.

## 1. Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 19, Vite 6, TypeScript ~5.8, React Router 7, Tailwind CSS 4 |
| UI | Radix (dropdown, select, tabs, slot), lucide-react, motion, sonner (toasts), recharts, `@hello-pangea/dnd` (Kanban) |
| Formulários/validação | react-hook-form, zod |
| Tabelas / dados | @tanstack/react-table, papaparse (CSV), jspdf + jspdf-autotable (PDF), date-fns |
| Backend | Node 20+, Express 4 (`server.ts`), express-rate-limit, nodemailer, ioredis (cache opcional) |
| Banco/Auth/Storage | Supabase (Postgres + Auth + Storage), `@supabase/supabase-js` 2.x |
| IA | Gemini (`@google/genai`), Groq; automações via n8n |
| Hospedagem | Vercel (SPA + 1 função serverless `api/index.ts`) |
| Qualidade | `tsc --noEmit` (`npm run lint`), CI em GitHub Actions (typecheck → `npm audit` → build). `playwright` está em `devDependencies`, mas **não há specs nem config do Playwright no repositório** (ver §17) |

## 2. Arquitetura

```
Navegador (SPA React)
  ├─ @supabase/supabase-js (anon key + JWT do usuário) ──► Supabase Postgres  [RLS = autoridade]
  └─ fetch /api/* (Bearer JWT | x-api-key) ──► server.ts (Express, serverless) ──► Supabase
                                                    ├─ client escopado pela sessão (respeita RLS)
                                                    └─ service_role (só /api/admin/* e /api/v1/leads)
Externos: Gemini/Groq · n8n (Julia, Aurora) · Google Calendar · Redis · SMTP
```

**Decisão central:** o CRM fala **direto com o Postgres** via Supabase no navegador; o Express existe só para o que não pode rodar no cliente (segredos de IA, `service_role`, API pública). A segurança real está na **RLS**, não em checagens de UI.

## 3. Multi-tenancy

- Toda tabela operacional tem `tenant_id` + policy `tenant_isolation` usando `has_tenant_access(tenant_id)`.
- `has_tenant_access` = dono direto **ou** `is_master` **ou** parceiro mapeado em `tenant_partners`.
- Funções auxiliares: `current_tenant_id()`, `current_partner_id()`, `is_super_admin()` (`auth.uid()` → `public.users`).
- O frontend **também** filtra por `activeTenantId` (contas master/parceiro veem vários tenants via RLS; o filtro extra evita misturar). `activeTenantId` vem de `AuthContext`.
- **Regra para tabela nova:** `tenant_id` + RLS + índice; validar com `get_advisors` (security) após cada migração.
- Módulos por tenant: colunas `module_*` e `tenants.modules jsonb`, lidas por `isModuleEnabled()` (`AuthContext`) para esconder menus. `ProtectedRoute requireModule` é outra coisa: confere se o **cargo** do usuário (`cargos.modulos`) inclui o módulo (`src/components/ProtectedRoute.tsx`, linhas 70-79); não lê `tenants.modules`.

## 4. Estado e acesso a dados (frontend)

- **Contexts:** `AuthContext` (sessão, tenant ativo, papéis, módulos) e `DataContext` (todas as entidades de negócio + CRUD que carimba `tenant_id`).
- **`createCrudHelper(tabela, setter)`** padroniza add/update/delete com atualização otimista e realtime (`postgres_changes` com debounce → refetch).
- **Carga em duas fases:** prévia via `/api/.../list` (Redis, TTL 20s) + busca autoritativa no Supabase, que sempre tem a palavra final (ex.: `Clientes.tsx`).
- **Mapeamento de linha:** `mapProductRow`, `mapLeadRow` etc. "desachatam" campos guardados em JSONB (`type_attributes`) para propriedades de primeira classe (ex.: `contractMonths`, `hasLoyalty`).

## 5. Módulos de código relevantes

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/saleCalculator.ts` | Cálculo central de venda: recorrência × parcelamento, desconto (`first_charge`/`recurring`/`total`/`percentage`), implantação, cronograma (`paymentSchedule`), `addMonthsClamped`, `splitInstallments` |
| `src/components/ui/modals/crm/AddProdutoLeadModal.tsx` | Fechamento de venda multi-produto (carrinho): 1 proposta, N itens, lançamentos por item |
| `DataContext.createProposalWithItems` | Cria proposta + itens; recalcula `leads.value` como soma das propostas do lead |
| `DataContext.syncAcceptedProposal` | Aceite → contrato + lançamentos; idempotente por `proposal_id`; MRR = total recorrente ÷ meses |
| `DataContext.createClientFromWonLead` | Lead ganho → cliente (dedup por documento/e-mail; guarda `reconciledWonLeadIdsRef` contra corrida) |
| `PropostaEditorWordModal` | Editor de contrato/PDF/link público |
| `pages/operative/produtos/*` | Catálogo; `useProdutoForm` → `ProdutoModal` → `ProdutoTabComercial` |

## 6. Regras técnicas de negócio (invariantes)

1. **Recorrência nunca é multiplicada numa cobrança única.** N ciclos = N lançamentos do valor do ciclo; `totalProjectedAmount` é só projeção.
2. **Parcelamento divide o mesmo total**; última parcela absorve o resto de centavos.
3. **`proposal_items.quantidade` em item recorrente = ciclos × unidades** (convenção legada usada no cálculo de MRR). A **exibição** compensa (mostra 1× valor do ciclo). Mudar isso exige ajustar `syncAcceptedProposal` (MRR e `discountRatio`) — ver §9.
4. **`leads.value` = soma dos `valor` das propostas do lead**, sempre recalculado (nunca sobrescrito por um valor avulso).
5. **Contrato/lançamento por proposta é idempotente** (`proposal_id`); reconciliação roda no máximo uma vez por sessão por proposta.
6. **Nunca processar proposta de outro tenant** (`prop.tenant_id !== tenantId` → return).
7. **Cliente novo nunca recebe cidade/telefone/e-mail inventados**; localização ausente = "Não informado".
8. **Sem RBAC confiável no cliente**: UI esconde, RLS/`requireMaster` decidem.

## 7. Backend (`server.ts`)

- Middlewares: `requireUser` (JWT → `req.supabase` escopado), `requireApiKey` (`x-api-key` → tenant via `SPY_API_KEYS`), `requireMaster` (confere `users.is_master` no banco), `requireTenantAdmin` (`is_master` ou `is_tenant_admin`; usado só em `/api/integrations/external*`).
- Rate limiting: API pública por chave, IA, WhatsApp, Google Calendar e captação pública (valores em §14.1). CORS por allowlist (`SPY_CORS_ORIGIN`; sem a variável, o código usa como default a origem `https://axis-crm.pluppex.com.br`, nunca `*` — `server.ts` linha 220).
- Rotas: API pública por chave (`/api/v1/*`), captação pública (`/api/public/lead-capture`, `/api/public-proposal/:token`, `/api/auth/tenant-theme`), resumos e prévias cacheadas em Redis (`/api/*/…-summary`, `/api/*/…-list`), IA (`/api/ai/*`, `/api/leads/*`, `/api/cnpj/validate`), settings genéricos (memória), admin (`/api/admin/*`), WhatsApp (WAHA real ou simulador, com persistência em `chat_*`/`whatsapp_instances`), conectores externos (`/api/integrations/*`) e Google Calendar (`/api/google-calendar/*`). Inventário rota a rota em §14; `docs/API.md` cobre só parte delas.
- Edge Function: `analyze-crm-call` (Gemini/Groq, sem tocar no banco).
- **Dívida:** os settings genéricos (`/api/settings/:category`) ainda caem em memória do processo quando não existe tabela `crm_<categoria>` (perdem-se no cold start). O WhatsApp **deixou** de ser em memória: instâncias e conversas persistem em `whatsapp_instances`/`chat_contacts`/`chat_messages`; o `SimulatorProvider` só é usado quando `WAHA_API_URL` não está definida.

## 8. Segurança (resumo)

- RLS em todas as tabelas de negócio; `TRUNCATE` revogado de `anon`/`authenticated`; funções com `search_path` fixo; RPCs `SECURITY DEFINER` validam tenant.
- Headers: `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, HSTS. **CSP ainda não definida.**
- Storage: buckets `avatars` (5 MB), `proposals` (20 MB), `products` (25 MB) e `finance` (25 MB), leitura pública por URL e escrita restrita à pasta `tenant_id` (detalhes em §15.5).
- Pendências herdadas do `SECURITY_AUDIT.md`: chaves no histórico do Git, `VITE_GEMINI/GROQ_API_KEY` no bundle, `role` como texto livre, RBAC raso em rotas de IA, gate por nome de tenant no `Sidebar`.

## 9. Dívidas técnicas e decisões em aberto

| # | Item | Impacto | Direção |
|---|---|---|---|
| D1 | `quantidade = ciclos × unidades` em itens recorrentes | Confunde exibição/relatórios; acopla MRR | Guardar `quantidade` real + `cycles` explícito; MRR = `preco × quantidade` |
| D2 | Tipos escritos à mão (`types.ts`) | Deriva do schema | Gerar com `generate_typescript_types` e checar em CI |
| D3 | `schema.sql` desatualizado vs migrations/banco | Documentação enganosa (ex.: `proposal_items` ausente) | Migrations = fonte de verdade; regenerar dump |
| D4 | Estado em memória no backend | Perda no cold start | Tabelas `tenant_settings`, `chat_*` com RLS |
| D5 | Multa de fidelidade só armazenada | Sem efeito financeiro | Gerar lançamento ao cancelar contrato antes do prazo |
| D6 | `ProductsSection` mostra só a proposta mais recente | Histórico invisível | Listar todas as propostas do lead |
| D7 | Chamadas de IA no cliente | Custo/exposição de chave | Proxy no backend |
| D8 | Refactor por blocos inacabado (`TODO.md`) | Arquivos grandes | Concluir Etapas 3–4 |
| D9 | Sem suíte de testes automatizados de regra financeira | Regressões silenciosas | Testes unitários para `saleCalculator` e reconciliações |

## 10. Ambientes e deploy

- **Local:** `npm run dev` (`tsx dev-server.ts`, Vite + Express). **Build:** `vite build` + `esbuild server.ts → dist/server.cjs`.
- **Produção:** Vercel; `vercel.json` reescreve `/api/*` → função única e o resto → SPA. Variáveis no painel da Vercel (`docs/ENVIRONMENT.md`).
- **CI:** `.github/workflows/ci.yml` em PR/push para `main`.
- **Migrações:** `supabase/migrations/*.sql`, aplicadas via Supabase; sempre rodar advisors de segurança depois.

## 11. Critérios de aceite técnicos

- `npm run lint` e `npm run build` limpos.
- Toda tabela nova com `tenant_id` + RLS + índice.
- Toda regra financeira nova com teste sobre `saleCalculator` ou função pura equivalente.
- Nenhum segredo em `VITE_*` além de URL/anon key do Supabase.

---

## 12. Estrutura de pastas e convenções

### 12.1 Árvore comentada (verificada em 2026-09-24)

```
/                          raiz do repositório
├─ server.ts               backend Express inteiro (~4,6 mil linhas): middlewares, ~90 rotas, helpers de IA
├─ server/                 módulos extraídos do server.ts
│   ├─ googleCalendar.ts   router OAuth + eventos + Meet (736 linhas), montado em /api/google-calendar
│   ├─ redisClient.ts      cacheGet/cacheSet/redisHealthCheck, "fail open" (69 linhas)
│   └─ whatsappProvider.ts interface WhatsAppProvider + WAHAProvider + SimulatorProvider (194 linhas)
├─ api/index.ts            2 linhas: reexporta o app do server.ts como função serverless da Vercel
├─ dev-server.ts           sobe Express + Vite em middleware mode na porta 3002 (fixa)
├─ vite.config.ts          plugins react + tailwind; alias "@" aponta para a RAIZ (não para src/); hmr: false
├─ vercel.json             rewrites (/api/* → /api/index, resto → SPA) + 4 headers de segurança
├─ index.html              entry do Vite
├─ schema.sql, supabase-fix-rls.sql   dumps/patches legados (desatualizados; ver D3)
├─ E-EMPREENDA+/           sub-projeto separado (ignorado pelo .gitignore e pelo build)
├─ dist/                   saída do build (ignorada pelo git)
├─ docs/                   documentação (docs/projeto/ = PRD/TRD etc.)
├─ .github/workflows/ci.yml  único workflow (typecheck, audit, build)
├─ supabase/
│   ├─ migrations/         120 arquivos .sql (versionados por data no nome, AAAAMMDD_descricao.sql)
│   ├─ functions/analyze-crm-call/index.ts   única Edge Function (Deno)
│   └─ tests/tenant_isolation_test.sql       único teste automatizado do repo (SQL, colar no editor)
└─ src/
    ├─ main.tsx            bootstrap: aplica cor padrão, patches de DOM (extensões de navegador), filtra ruído de WebSocket do Vite
    ├─ App.tsx             providers + tabela de rotas (564 linhas)
    ├─ types.ts            tipos de domínio escritos à mão (259 linhas)
    ├─ contexts/           AuthContext, DataContext (3.072 linhas), DataContextTypes, LocalizationContext, dataMocks
    ├─ components/         Layout, ProtectedRoute, ErrorBoundary, CommandPalette, OnboardingWizard, PageContainer
    │   ├─ layout/         Sidebar, SectionSidebar, Topbar, MobileNav, navData.ts (itens do menu)
    │   └─ ui/             primitivos (button, modal, table, tabs, select…) + modais de negócio (ui/modals/*), lead-details, new-lead, auroraCore
    ├─ pages/<módulo>/     uma pasta por módulo (ver 12.2)
    ├─ hooks/              12 hooks compartilhados (só de integrações/Aurora/config; ver 13.5)
    └─ lib/                utilitários e clientes (ver 13.4); lib/i18n/translations.ts (524 linhas)
```

Observação: a documentação anterior (`docs/DEVELOPMENT.md`) descreve `hooks/` e `lib/` de forma resumida; a lista real de arquivos está em §13.4-13.5.

### 12.2 Módulos em `src/pages/`

`admin`, `agenda`, `auth`, `automotivo`, `clinica`, `common`, `crm`, `dashboard`, `dev`, `education`, `finance`, `hr`, `imobiliario`, `landing`, `lp`, `marketing`, `operative`, `partners`, `public`, `reunioes`, `settings`, `solar`, `varejo`. As rotas (React Router 7) estão todas em `src/App.tsx`; a maioria das páginas é `import` estático (ver 13.1 sobre code-splitting).

### 12.3 Convenções observadas no código

| Tema | Convenção real | Exemplo |
|---|---|---|
| Página | Um arquivo `PascalCase.tsx` por tela na raiz do módulo | `pages/crm/Clientes.tsx`, `pages/finance/FinanceiroDRE.tsx` |
| "Blocos" por página | Subpasta `components/` do módulo guarda os blocos visuais da página; a página só orquestra | `pages/crm/components/Propostas/PropostasKPIs.tsx`, `PropostasTable.tsx` |
| Hook por página | `use<Página>.ts` ao lado da página, com estado de tela, filtros e queries; nome varia entre `use<X>List` (listagem paginada) e `use<X>` | `pages/crm/useLeadsList.ts`, `usePropostasList.ts`, `usePipeline.ts`, `pages/dashboard/useDashboard.ts`, `pages/finance/useFinanceEntriesList.ts`, `pages/operative/produtos/useProdutoForm.ts` |
| Modal em abas | Pasta `<nome>-modal/` com `<Modal>Tab<Aba>.tsx` | `pages/operative/produtos/produto-modal/ProdutoTabComercial.tsx` |
| Utilitários de domínio | `pages/<módulo>/lib/` ou `utils/` quando a regra é só do módulo | `pages/finance/lib/financeEngine.ts` (`isDateLocked`), `pages/crm/utils/proposalPdf.ts` |
| Utilitários globais | `src/lib/`, `camelCase.ts` (uma exceção com hífen: `google-auth.ts`, `google-calendar.ts`) | `src/lib/saleCalculator.ts` |
| Hooks compartilhados | `src/hooks/use<Coisa>.ts`, cada um encapsula uma tabela/config e devolve `{ data, loading, ... }` | `useTenantAiConfig.ts`, `useToolRegistry.ts` |
| Nomes de tabela/coluna | Tabelas novas em `snake_case`; **tabelas antigas misturam** colunas `camelCase` com aspas (`"currentStock"`, `"scoreIA"`, `"stageId"`, `"customFields"`) e `snake_case` | ver `baixar_estoque_proposta_aceita()` (`"currentStock"`) e `server.ts` (`scoreIA`, `stageId`) |
| Mapeamento | Linha do banco → objeto de tela em funções `map*Row`/`rowTo*` dentro do `DataContext` | `mapLeadRow`, `mapProductRow`, `rowToContract`, `rowToFunil` |
| Arquivos de migração | `AAAAMMDD_<descricao_em_snake_case>.sql`; vários por dia são normais | `20260921_cr1_cargos_squads_admin_only_write.sql` |
| Idioma | Código e nomes de negócio em pt-BR (`propostas`, `clientes`, `reunioes`), infra em inglês (`tenant_id`, `finance_entries`) | — |
| Alias de import | Praticamente não usado: só 1 ocorrência de `@/` em `src/`; imports são relativos | — |

**[Achado]** Não há regra de lint/format (o `npm run lint` é só `tsc --noEmit`) nem convenção forçada de nomes de hook de listagem: `useLeadsList` duplica `mapLeadRow` de propósito (comentário no arquivo) para não depender do `DataContext`.

---

## 13. Frontend em detalhe

### 13.1 Bootstrap, providers, roteamento e code-splitting

- **Árvore de providers** (`src/App.tsx`, linhas 553-563): `AuthProvider` → `LocalizationProvider` → `DataProvider` → `Router` → `AppContent`. O `DataProvider` fica **fora** do `Router` (não usa hooks de rota).
- **`main.tsx`** (72 linhas): aplica a cor de marca padrão (`applyThemeColor(DEFAULT_BRAND_COLOR)`), reduz `removeChild`/`insertBefore` do DOM a no-op seguro quando o pai mudou (workaround para extensões de navegador que mutam inputs), engole `unhandledrejection` de WebSocket e filtra ruído do HMR em `console.error/warn`. Monta em `StrictMode`.
- **Rotas**: públicas (`/`, `/landing`, `/lp`, `/login`, `/redefinir-senha`, `/corretor/:slug`, `/imovel/:id`, `/catalogo/:tenantId`, `/proposta/:token`, `/f/:niche`) e autenticadas sob `/app` (`<ProtectedRoute><Layout/></ProtectedRoute>`), com sub-rotas por módulo (`crm`, `agenda`, `marketing`, `dev`, `reunioes`, `configuracoes`…). Há vários `Navigate` de compatibilidade (ex.: `/app/leads` → `/app/crm/pipeline`) e um curinga `configuracoes/*` → `SettingsGenericForm`. `/register` foi desativado (redireciona para `/login`).
- **`ProtectedRoute`** (`src/components/ProtectedRoute.tsx`): espera `authLoading`; sem `user` → `/login` (guarda `state.from`); flags `requireMaster` (`/app/admin`), `requirePartner` (`/app/parceiros`), `requireTenantAdmin` e `requireModule`. É defesa em profundidade; a autoridade é a RLS.
- **Code-splitting**: **[Achado]** existe **um único** `React.lazy` em todo o app: `SPYLandingPage` (`App.tsx` linha 7). Todas as demais páginas (~160 arquivos em `pages/`) são importadas estaticamente e entram no bundle principal. O `vite.config.ts` não define `manualChunks`. Um build local encontrado em `dist/assets/` tinha `index-*.js` com ~4,96 MB (sem gzip), `AuroraCore3D-*.js` ~0,89 MB (three.js, já em chunk separado por import dinâmico), `html2canvas` ~0,20 MB — **[Não verificado]** se esse `dist/` corresponde ao commit atual; refazer a medição com `npm run build` (ver §18).
- **`ErrorBoundary`** (`src/components/ErrorBoundary.tsx`, 117 linhas): captura erros de renderização; variantes página inteira e `compact` (bloco). Tem `resetKey` (reseta ao mudar) e reconhece o `NotFoundError` benigno de `insertBefore/removeChild` causado por extensões: refaz o mount automaticamente (até 8 vezes; o contador "esfria" após 4 s). Erros reais vão para `console.error("[S.P.Y.] Erro de renderização capturado:", …)` — **não há envio a serviço externo**.

### 13.2 `AuthContext` (`src/contexts/AuthContext.tsx`, 300 linhas)

- **Estado**: `user: UserSession | null` (id, name, email, role, tenantId, tenantName, tenantNiche, `isMaster`, `isTenantAdmin`, `partnerId`, phone, bio, avatarUrl, preferences), `authLoading`, `allTenantModules` (nome do tenant → `{módulo: boolean}`), `tenantIdMap` (nome → uuid), overrides de tenant e filial.
- **Sessão**: fonte de verdade é o Supabase Auth. `getSession()` + `onAuthStateChange` chamam `fetchUserProfile(userId)` (`src/lib/supabase.ts` linha 103) que resolve o perfil em `public.users`. Sem sessão real, `user` fica `null` — o `sessionStorage['spy_user_session']` **só** é lido quando o client Supabase não está configurado (modo degradado/demo); comentário no código explica que confiar nele com Supabase ativo permitiria forjar `isMaster` no console.
- **Tenant ativo**: `activeTenantId = tenantOverride?.id ?? user.tenantId`. `switchTenant(id, name)` só age para `isMaster` ou usuário com `partnerId`; ao trocar, zera a filial. Os overrides são resetados quando `user.id` muda.
- **Filial ativa**: `activeFilialId`/`switchFilial` (só `isMaster` ou `isTenantAdmin`); `null` = "todas as filiais".
- **Módulos**: `isModuleEnabled(nome)` usa `getTenantModules(activeTenantName || user.tenantName)` com match **exato** case-insensitive por nome (histórico: `.includes` vazava módulos entre tenants de nome parecido). Master **também** respeita os módulos do tenant visualizado. Sem correspondência, cai em `{crm:true, sdr:false, advDashboard:false}`.
- **Persistência de módulos**: `updateTenantModules` atualiza o estado e chama `updateTenantModulesInDB` (`lib/supabase.ts` linha 673); a coluna é protegida por trigger contra escrita de não-master (`guard_tenant_modules_plan_update`, §15.2).
- **Preferências**: `updatePreferences` faz merge otimista e grava em `users.preferences`; em erro só faz `console.error` (sem rollback).
- **Tenants demo**: `DEFAULT_TENANT_MODULES` (4 tenants fixos) serve de fallback até o banco responder.
- **Ruído de log**: `console.log` com emoji em cada carga (`[AuthContext] 🔄 …`).

### 13.3 `DataContext` (`src/contexts/DataContext.tsx`, 3.072 linhas)

**Papel.** Guarda todas as entidades de negócio do tenant ativo, expõe CRUD que carimba `tenant_id`/`filial_id`, mantém realtime e roda reconciliações automáticas. Tipos do contexto em `DataContextTypes.ts` (392 linhas); mocks em `dataMocks.ts`.

**Entidades (estados `useState`, 49 ao todo).** Agrupadas:

| Grupo | Estados |
|---|---|
| CRM | `leads`, `leadActivities`, `tasks`, `contracts`, `clienteBase`, `proposals`, `proposalItems`, `funis`, `squads`, `squadMetas`, `cargos`, `indicacoes`, `customLeadFields`, `leadScoreTriggers` |
| Agenda/reuniões | `appointments`, `reunioes`, `notifications` |
| Financeiro | `financeEntries`, `financeCategories`, `financeBudgets`, `financeBankAccounts`, `financeTransfers`, `financeCentrosCusto`, `financeAttachments`, `financePeriodLocks`, `financeAuditLog`, `financeCommissionEntries`, `scheduledExports`, `financialGoals` |
| Operação/catálogo | `products`, `colaboradores`, `empresaFiliais`, `nichos` |
| Marketing | `marketingAutomations`, `marketingContent`, `marketingCampaigns`, `marketingLandingPages`, `marketingForms` |
| Educação | `turmas`, `students`, `certificates`, `educationContent` |
| Config/UI | `appSettings` (mapa key→value de `app_settings`), `sidebarModules`, `globalWebhooks`, `whatsappWebhookUrl`, `tenantPrimaryColor`, `theme`, `auroraAgents` |

`leads`, `tasks`, `contracts`, `appointments`, `financeEntries`, `products`, `proposals` e `colaboradores` têm versão "raw" + `useMemo(filterByFilial)`: quando há filial ativa, linhas com `filial_id` diferente somem; linhas **sem** `filial_id` continuam visíveis em qualquer filial.

**Mapeadores.** `mapLeadRow` (achata `customFields.productIds/tags`, default `scoreIA` 50), `mapAppointmentRow`, `mapSquadRow`, `mapProductRow` (desempacota `type_attributes` JSONB para `contractMonths`, `hasLoyalty` etc.), `rowToContract` (a tabela `contracts` não tem `client/plan/date`; reconstrói de `notes` "Cliente: X | Plano: Y", `title` e `signed_date`; datas viram `dd/mm/aaaa`), `rowToFunil`. **O mesmo mapeador precisa ser usado na carga inicial e no realtime** — comentário no código relata o bug de o realtime sobrescrever o estado com linhas cruas.

**Carga inicial (efeito com deps `[tenantId]`, ~linhas 1010-1325).**
1. Ao trocar de tenant, **zera todos os estados de negócio e as flags** `*AuthoritativeLoadedRef`, `contractsLoaded`, `proposalsLoaded`, e limpa `reconciledProposalIdsRef`/`reconciledWonLeadIdsRef`. Isso corrige os bugs históricos de dados de um tenant aparecendo em outro.
2. Uma variável `cancelled` (fechada sobre o `tenantId` do efeito) descarta respostas atrasadas.
3. Só carrega com `supabase && !authLoading && tenantId`.
4. Cada tabela é um "job" `{name, promise, apply}` que aplica seu próprio `setState` **assim que termina** (sem `Promise.all` global). `leads` é o primeiro da fila. Erros de cada job são acumulados e avisados **uma vez** por toast ao fim (`Promise.allSettled`).
5. Tabelas carregadas na fase inicial (≈30): `leads`, `tasks`, `contracts`, `lead_activities`, `finance_entries`, `appointments`, `squads`, `notifications`, `marketing_landing_pages`, `app_settings` (linhas globais `tenant_id IS NULL` + do tenant; tenant vence o global), `products`, `proposals`, `proposal_items`, `colaboradores`, `cargos`, `clientes`, `reunioes`, `crm_funis`, `empresa_filiais`, `nichos`, `finance_commission_entries`, `indicacoes`, `finance_bank_accounts`, `finance_transfers`, `finance_period_locks`, `finance_audit_log` etc. (ver a lista `name:` no efeito).
6. **Módulos de nicho sob demanda**: `ensureNicheModulesLoaded()` (linha 1285) carrega Educação (`turmas`, `students`, `certificates`, `education_content`, `financial_goals`, `scheduled_exports`), Marketing e Financeiro avançado só quando a tela chama; uma ref evita repetir. `squad_metas` tem listener realtime mas nenhuma carga inicial (comentário: nenhuma tela lê).

**Paginação e concorrência.**
- `PAGE_STEP = 1000` (teto do PostgREST). `fetchAllRowsForTenant` pede a 1ª página com `count: 'exact'` e dispara **em paralelo** as demais; cada página tem até 3 tentativas com backoff de 500 ms × tentativa; falha parcial devolve o que foi obtido e sinaliza `error`.
- `dbLimit = createLimiter(10)` (linha 82): no máximo **10 requisições simultâneas** ao Supabase em toda a carga. O comentário registra o incidente de 2026-09-19 (statement timeout com concorrência 15/6) e por que ficou em 10.
- **Cache de sessão**: `cachedFetchAllRowsForTenant` usa `sessionStorage` (`spy_cache:<tenant>:<tabela>`, TTL 5 min, `CACHE_TTL_MS`) para `products`, `crm_funis`, `squads`; um refetch disparado por realtime ignora o cache e o atualiza.
- **Prévia via backend/Redis**: em paralelo à busca autoritativa, o cliente chama `/api/crm/leads-list`, `/api/operative/produtos-list`, `/api/crm/reunioes-list`, `/api/finance/entries-list`, `/api/operative/tasks-list` e `/api/data/table-preview?table=…` (19 tabelas menores) para pintar a tela antes. A prévia é **descartada** se a busca autoritativa já chegou (`*AuthoritativeLoadedRef`) ou se o tenant mudou; falhas da prévia são silenciosas.

**Realtime (efeito `[tenantId]`, linhas ~826-915).** Um único canal `global-db-changes` com ~40 `postgres_changes` (`event: '*'`, schema `public`; `finance_audit_log` só `INSERT`). Dois padrões:
- **Patch incremental** (`applyRealtimeUpsert`, linha 203): `leads`, `finance_entries`, `proposal_items`, `reunioes`. Só aplica linhas cujo `tenant_id === tenantId`; `DELETE` filtra por `id` (id de outro tenant é no-op).
- **Refetch com debounce** (`debouncedRefetch(key, fn, 1500ms)`): as demais (`tasks`, `contracts`, `proposals`, `squads`, `products`…). `contracts` e `proposals` **não** usam patch de propósito, porque a reconciliação depende do array completo.
O debounce foi introduzido após incidentes de rajada (migração de reservas do To Na Pista) que saturaram o Postgres; ver comentários em `applyRealtimeUpsert`.

**`createCrudHelper(tabela, setter, filialAware=false)`** (linha 2141) devolve `{add, update, del}`:
- `add`: gera `id` (`crypto.randomUUID()`), carimba `tenant_id` do tenant **ativo** (não do chamador) e, se `filialAware`, `filial_id`; insere no estado **antes** do `insert` (otimista); em erro do Supabase só mostra `toast.error(friendlyError(error))` — **não desfaz** a inserção local.
- `update`: merge otimista no estado, remove `updated_at` do payload (conflito com trigger), e para `products` aplica lista de colunas permitidas (`allowed`) e normaliza `is_recurring`/`recurring_period`/`implementation_fee`/preços. Em erro: toast, **sem rollback**.
- `del`: remove otimista, guarda o item removido; usa `.delete().select('id')` para detectar DELETE de 0 linhas (RLS); em erro ou 0 linhas **reinsere o item** e retorna `false`. É o único caminho com rollback explícito.
Helpers instanciados (linhas 2259-2532): `productCrud`, `proposalCrud`, `proposalItemCrud`, `turmaCrud`, `reuniaoCrud`, `studentCrud`, `colabCrud`, marketing (`mktCampCrud`…), `squadMetaCrud`, `cargoCrud`, `auroraAgentCrud`, `empresaFilialCrud`, `nichoCrud`, financeiros (`financeCategoryCrud`, `financeBudgetCrud`, `financeBankAccountCrud`…), `clienteBaseCrud`, `certCrud`, `indicacaoCrud` etc. Filial-aware: `products`, `proposals`, `colaboradores`.

**Padrão otimista e rollback (resumo real).** Otimista em toda escrita; rollback **só** em `del` do helper. `updateLead`, `deleteLead`, `addStudent/updateStudent/deleteStudent`, `updateFinanceEntry`, `deleteFinanceEntry`, `updatePreferences` atualizam o estado antes, mostram toast em falha e **não revertem** — a tela fica divergente do banco até o próximo refetch/realtime. **[Achado]** `deleteLead` e `deleteStudent` sequer verificam `error`. `updateFinanceEntry`/`deleteFinanceEntry` respeitam `checkFinanceEntryLock` (bloqueio de período; a mesma regra existe no banco — §15.2).

**Reconciliações automáticas (efeitos globais).**
1. **Proposta aceita → contrato + lançamentos** (`syncAcceptedProposal`, linha 2582; efeito ~2803 com deps `[proposals, contracts, contractsLoaded, proposalsLoaded]`). Guarda de tenant (`prop.tenant_id !== tenantId` → `return false`), idempotência por `proposal_id` (fallback por nome para contratos antigos sem `proposal_id`), recalcula `leads.value` como soma das propostas (`sumProposalsValueForLead`), calcula MRR = total recorrente (ponderado por `discountRatio = prop.valor / soma dos itens`) ÷ `contractMonths`, cria `addContract` + `addFinanceEntry` ("Contrato / Recorrente") e, se houver item `one_time`, um lançamento "Implantação / Setup". Se o contrato já existe, só faz backfill de `plan`, `endDate`, `proposalId`, `description`, e no máximo **uma vez por sessão** por proposta (`reconciledProposalIdsRef`) — trava criada após incidente de PATCH em milhares de contratos (2026-09-20).
2. **Lead "Fechado" → cliente** (`createClientFromWonLead`, linha 1614; efeito ~1793 com deps `[leads, clienteBase]`). Só roda depois de `leadsAuthoritativeLoadedRef` e `clientesAuthoritativeLoadedRef`; trata `clientId` órfão (cliente excluído) como não vinculado; processa **sequencialmente**; marca `reconciledWonLeadIdsRef` **antes** do `await` (síncrono) — a mesma guarda é usada dentro de `updateLead` na transição ao vivo, para fechar a corrida que duplicou "Wemerson Carvalho"/"Guruseg". Dedup é por **consulta** (`documento` ou `email`), não por constraint única no banco. **[Achado]** duas abas/sessões do mesmo tenant ainda podem criar duplicatas (as refs são por sessão do navegador).
3. **Propostas × contratos**: a trava `contractsLoaded`/`proposalsLoaded` (resetada na troca de tenant) evita recriar contrato antes de `contracts` carregar (erro 409 `contracts_proposal_id_unique` já visto em produção). **[Achado]** o índice único `contracts_proposal_id_unique` é citado nos comentários mas **não aparece em nenhuma migration do repositório**, mas **existe no banco vivo** (verificado em 2026-09-24) — foi aplicado fora do controle de versão.
4. Outras rotinas de fundo: verificação de leads frios (Score IA < 40), recálculo de score após mudança de status/etapa (`setTimeout` 400 ms), notificações push (`sendPushNotification`).

**Fluxo de criação de proposta** (`createProposalWithItems`, linha 2265): `proposalCrud.add` → `for` sequencial de `proposalItemCrud.add` → `updateLead` (valor = soma das propostas do lead, `productIds` mesclados). **[Achado]** não há transação: se um item falhar, a proposta e os itens anteriores permanecem (o erro só vira toast). `deleteProposal` (linha 2350) limpa lançamentos, contrato e valor do lead; `proposal_items` é `ON DELETE CASCADE` no banco (comentário no código).

### 13.4 `src/lib/*` (um parágrafo por arquivo)

- **`supabase.ts`** (688 linhas): cria o client (`createClient(url, anonKey)`; `null` se as variáveis faltam ou a URL é inválida — o app degrada em vez de quebrar), loga o estado da configuração no import (`console.log`), cacheia em `sessionStorage` se o Supabase é alcançável (`isSupabaseReachable`, chave `axis_supabase_connection_status`), e concentra as funções de auth e de plataforma: `signIn`, `requestPasswordReset`, `updatePassword`, `fetchUserProfile`, `createUserWithProfile`, `setUserPartnerTenantAccess`, `fetchTenants`, `fetchTenantIdMap`, `fetchTenantsDetailed`, `updateTenantInfo/Plan/Theme`, `deactivateTenant`, `updateTenantModulesInDB`, `createTenantAdmin`, `fetchSpyLicenseProducts`. Exporta `PLUPPEX_TENANT_ID` (constante de tenant no código do frontend).
- **`apiClient.ts`** (16 linhas): `apiFetch(input, init)` = `fetch` + header `Authorization: Bearer <access_token>` da sessão atual. Não define base URL nem tratamento de erro/refresh; quem chama decide.
- **`friendlyError.ts`** (39 linhas): traduz mensagens cruas do Postgres/Supabase para pt-BR (RLS/permission denied, duplicate key, FK, not-null, tamanho, rede/timeout, JWT/401) com fallback genérico. O comentário do arquivo registra ~77 pontos que interpolavam `error.message` cru antes dele existir. Não faz log.
- **`saleCalculator.ts`** (212 linhas): função pura `calculateSale(input)` → `SaleCalculationResult` (`cycleAmount`, `setupAmount`, `firstChargeAmount`, `recurringChargeAmount`, `totalProjectedAmount`, `numberOfCycles`, `isOpenEnded`, `nextDueDate`, `paymentSchedule`). Auxiliares exportados: `cycleMonthsFor`, `addMonthsClamped`, `addPeriodo`, `splitInstallments`, `FREQUENCY_LABELS`, `OPEN_ENDED_BATCH_CYCLES = 12`. Único chamador de `calculateSale` hoje: `AddProdutoLeadModal.tsx` (linha 197); `addPeriodo`/`splitInstallments` são reaproveitados por `NovaOperacaoModal.tsx` e `GenericFinanceiroList.tsx` (comentário do arquivo).
- **`revenueMetrics.ts`** (134 linhas): "fonte única" de métricas (`getMRR`, `getLostMRR`, `getActiveCustomers`, `getActiveContractsCount`, `getChurnRate`, `getWonDeals`, `getActiveLeadsCount`, `getConversionRate`, `getPipelineValue`, `getRevenueProjection`). Recebe arrays já filtrados por tenant, com tipos "duck-typed"; MRR = soma de `contracts.mrr` dos contratos que não estão `Cancelado`/`Perdido`. Ver §17 para casos de teste.
- **`revenueIntelligence.ts`** (265 linhas): `buildPrompt` + `analyzeCall` para análise BANT/qualidade de call via Gemini ou Groq (provedor no parâmetro); é o consumidor da Edge Function `analyze-crm-call` e das chaves `VITE_*` de IA no navegador (ver §19.5).
- **`leadScore.ts`** (226 linhas): `calculateLeadScore` (etapa do funil + notas + prioridade → score, temperatura, probabilidade, motivos) e `parseLeadNotes`. Existe também a rota `/api/leads/calculate-score` no backend.
- **`utils.ts`** (129 linhas): `cn` (clsx + tailwind-merge), máscaras/validações (`formatCNPJ`, `formatPhone`, `validatePhone`, `validateCNPJ`), `parseCurrencyBR` (aceita "1.500,50", "1,500.50", "50,00"…), `formatCurrencyBR`, `formatPercentage`.
- **`ibgeLocalidades.ts`** (75 linhas): `fetchEstados`/`fetchMunicipios` + hook `useIbgeLocalidades` sobre a API pública do IBGE, com cache em memória de módulo; existe para eliminar o default "São Paulo/SP" em formulários.
- **`csvExport.ts`** (16 linhas): `downloadCsv(filename, headers, rows)` com separador `;`, valores sempre entre aspas, via `data:` URI (sem BOM). **`exportCsv.ts`** (41 linhas): `exportToCSV(data, filename)` com separador `,`, BOM UTF-8 e `Blob`. **[Achado]** são duas implementações concorrentes de export CSV com formatos diferentes.
- **`notifications.ts`** (73 linhas): wrappers da Notification API do navegador (`requestNotificationPermission`, `sendPushNotification`, `playNotificationSound`).
- **`theme.ts`** (73 linhas): 4 cores de marca (`BRAND_COLORS`), `applyThemeColor` (CSS + favicon SVG dinâmico) por tenant (`tenants.primary_color`).
- **`google-auth.ts`** (136 linhas): cliente das rotas `/api/google-calendar/*` (status, connect, disconnect, sync, leitura do resultado de redirect); nenhum token Google passa pelo navegador. **`google-calendar.ts`** (76 linhas) e **`meet.ts`** (21 linhas): proxies finos para eventos e sala Meet, enviando `x-active-tenant-id`. **`firebase.ts`** (194 linhas, nome enganoso): cliente **Google Identity Services** (popup, token implícito ~1 h guardado em `localStorage`), usado por Google Tasks; **[Achado]** convive com a integração server-side de Calendar — dois mecanismos de Google no mesmo app.
- **`publicCatalog.ts`, `publicCorretor.ts`, `publicImovel.ts`, `publicProposal.ts`**: acesso das páginas públicas via RPC `SECURITY DEFINER` (`get_public_catalog`, `get_public_corretor_portfolio`, `get_public_imovel`, `get_public_proposal`), sem `SELECT` direto para `anon`. `acceptPublicProposal` usa `POST /api/public-proposal/:token/accept` (backend).
- **`solarOcr.ts`** (40 linhas): converte a foto da fatura em base64 e chama `POST /api/ai/solar-analyze-fatura`.
- **`i18n/translations.ts`** (524 linhas) + **`contexts/LocalizationContext.tsx`** (163 linhas): idioma e moeda de **exibição** (BRL/USD/EUR; taxas via `open.er-api.com`, cache em `localStorage` por 6 h). Todo valor gravado no banco é BRL.

### 13.5 `src/hooks/*`

Todos são pequenos hooks de dados (Supabase direto, RLS resolve o tenant): `useAgentPrompts` (`ai_agent_prompts`), `useAuroraAuditLog` (`aurora_audit_log`), `useAuroraTokenUsage` (`tenant_token_limits`, `tenant_token_usage_current_month`, com polling padrão de 60 s), `useAuroraMeetingPresence` e `useAuroraVoice` (Web Speech API, presença em reunião), `useDepartamentoOptions`, `useExternalIntegrations` (view `external_integrations_safe`; escrita via `/api/integrations/external*`), `useKanbanConfig` (colunas padrão do Kanban), `useModuleManifest` (`module_manifest`), `useTenantAiConfig` (`tenant_ai_config`), `useTenantDynamicLinks` (`tenant_dynamic_links`), `useToolRegistry` (`tool_registry`, `PlanTier`). Hooks de **página** ficam junto da página (§12.3), não aqui.

---

## 14. Backend em detalhe

### 14.1 Infraestrutura do `server.ts`

- **Carregamento** (linhas 1-15): `dotenv/config`; clients: `supabase` (anon, para validar JWT), `supabaseService` (service_role, pode ser `null`), `ai` (Gemini; usa chave "dummy" se ausente para não quebrar no load). `safeCreateClient` devolve `null` em vez de lançar com env inválida.
- **IA**: `generateAI(prompt)` tenta Gemini (`gemini-3.6-flash`) e, se falhar, Groq (`llama-3.3-70b-versatile`, timeout 20 s). Várias rotas `/api/ai/*` chamam `ai.models.generateContent` direto, sem fallback para Groq.
- **Body**: `express.json({limit: "5mb"})` (pulado se a Vercel já parseou).
- **CORS** (linhas 220-234): allowlist `SPY_CORS_ORIGIN` (fallback `AXIS_CORS_ORIGIN`, default `https://axis-crm.pluppex.com.br`); métodos `GET, POST, PUT, DELETE, OPTIONS`; headers permitidos `Content-Type, x-api-key, Authorization, x-active-tenant-id`; `OPTIONS` → 204. **[Achado]** `PATCH` não está em `Allow-Methods` (nenhuma rota usa PATCH hoje).
- **Rate limits** (`express-rate-limit`, janela 60 s, por IP salvo indicação): `/api/v1/leads|lead-activities|finance-entries` = 60 (chave = `x-api-key`), `/api/leads` e `/api/ai` = 20, `/api/whatsapp` = 60, `/api/google-calendar` = 60, `/api/public/lead-capture` = 5. **Sem limiter**: `/api/public-proposal/*`, `/api/auth/tenant-theme`, `/api/health/redis`, `/api/dashboard|finance|crm|…-summary|list`, `/api/admin/*`, `/api/integrations/*`, `/api/settings/*`, `/api/cnpj/validate`. O store do limiter é **em memória do processo** (padrão do pacote) — em serverless cada instância conta separado **[Não verificado]** o comportamento real na Vercel.
- **Middlewares**:
  - `requireApiKey` (linha 263): `503` se `SPY_API_KEYS` vazio, `401` se chave ausente/desconhecida; grava `req.tenantId`. Registra uso em `api_key_usage_log` (fire-and-forget, 8 primeiros caracteres da chave).
  - `requireUser` (linha 287): `503` sem Supabase, `401` sem Bearer ou `getUser` falha; injeta `req.user` e `req.supabase` (client com o JWT do chamador → RLS).
  - `requireMaster` (linha 3791) e `requireTenantAdmin` (linha 4378): leem `users` via `req.supabase`; `403` se não autorizado.
  - `resolveRequestedTenantId` (linha 353): tenant do usuário, ou `?tenantId=` validado por RPC `has_tenant_access` (`403` se falhar). Usado por todas as rotas `-summary`/`-list`/`table-preview` e em `whatsapp/contacts` e `messages/send`.
- **Cache Redis** (`server/redisClient.ts`): `cacheGet/cacheSet` com `ioredis` (`lazyConnect`, `connectTimeout` 3 s, `maxRetriesPerRequest` 1, reconexão até 3 vezes). Sem `REDIS_URL` ou com erro → retorna `null`/no-op (fail open). Estratégia **cache-aside, só por TTL, sem invalidação ativa**. Resposta traz `X-Cache: HIT|MISS`.
- **Erro global** (linha 4629): `console.error("[S.P.Y.] Unhandled error:")` + `500 {error:"Erro interno do servidor."}`. Nas rotas, o padrão é log detalhado no servidor e mensagem genérica ao cliente.
- **Paginação server-side** (`fetchAllRowsPaginated`, `SERVER_PAGE_SIZE = 1000`): usada pelos resumos para totais exatos (o teto de `db-max-rows` do PostgREST cortava silenciosamente em 1.000 linhas).

### 14.2 Inventário de rotas

Legenda de middleware: **U** = `requireUser`; **K** = `requireApiKey`; **M** = `+requireMaster`; **TA** = `+requireTenantAdmin`; **—** = sem autenticação. "Cliente" indica qual client Supabase a rota usa: **RLS** (`req.supabase`), **SVC** (`supabaseService`, bypassa RLS).

#### Saúde e resumos/prévias cacheados (todos `GET`, U, cliente RLS, exceto o primeiro)

| Path | Entrada | Resposta / erros | Tabelas | Cache (TTL) |
|---|---|---|---|---|
| `/api/health/redis` (—) | — | `{configured, connected, latencyMs?}` | — | — |
| `/api/dashboard/summary` | `?tenantId` | 4 métricas "hero" (receita recorrente, conversão, leads ativos, churn) · 403/500 | `leads`, `contracts`, `appointments` | `dashboard:tenant:<id>:summary` (60 s) |
| `/api/finance/visao-geral-summary` | `?tenantId` | agregados financeiros | `contracts`, `finance_entries` | 60 s |
| `/api/dashboard/bi-summary` | `?from`, `?to` (AAAA-MM-DD; default = janela padrão) | KPIs de BI + `periodo` | `clientes`, `contracts`, `finance_entries`, `leads`, `reunioes`, `tasks` | chave inclui from/to (60 s) |
| `/api/marketing/campanhas-summary`, `/api/marketing/analytics-summary` | `?tenantId` | resumos de marketing | `finance_entries`, `leads` | 60 s |
| `/api/finance/inadimplencia-summary` | `?tenantId` | inadimplência | `finance_entries` | 60 s |
| `/api/finance/dre-summary` | `startDate`, `endDate` obrigatórios (400 se faltar) | DRE | `finance_entries`, `finance_categories` | chave inclui datas (60 s) |
| `/api/finance/performance-mensal-summary` | `janela` ∈ {6,12,24} (default 12) | série mensal | `finance_entries` | 60 s |
| `/api/finance/performance-anual-summary` | `ano` (2001-2099; default ano atual) | série anual | `finance_entries`, `finance_categories` | 60 s |
| `/api/finance/fluxo-caixa-summary` | `startDate`, `endDate` obrigatórios (400) | fluxo de caixa | `finance_entries` | 60 s |
| `/api/crm/relatorios-executivos-summary` | `periodo` ∈ {30dias, mes, trimestre, ano, todos} (default mes) | relatório executivo | `contracts`, `finance_entries`, `leads`, `tasks` | 60 s |
| `/api/crm/dashboard-performance-summary` | — | performance comercial | `leads` | 60 s |
| `/api/clinica/estatisticas-summary`, `/painel-geral-summary` | — | estatísticas da clínica | `appointments` | 60 s |
| `/api/clinica/faturamento-summary` | — | faturamento | `finance_entries` (+`appointments`) | 60 s |
| `/api/education/mensalidades-summary` | — | mensalidades | `mensalidades` | 60 s |
| `/api/crm/leads-list` | `?tenantId` | `{data: Lead[]}` (colunas `LEADS_PREVIEW_COLUMNS`, até 8000, ordenado por `created_at` desc) | `leads` | 20 s |
| `/api/crm/clientes-list` | idem | `{data}` (até 2000) | `clientes` | 20 s |
| `/api/operative/produtos-list` | idem | `{data}` (até 2000) | `products` | 30 s |
| `/api/crm/reunioes-list` | idem | `{data}` (`REUNIOES_PREVIEW_COLUMNS`, até 8000) | `reunioes` | 20 s |
| `/api/finance/entries-list` | idem | `{data}` (`FINANCE_ENTRIES_PREVIEW_COLUMNS`, até 8000) | `finance_entries` | 20 s |
| `/api/operative/tasks-list` | idem | `{data}` (até 1000) | `tasks` | 20 s |
| `/api/data/table-preview` | `?table` ∈ allowlist (`notifications`, `proposal_items`, `lead_activities`, `colaboradores`, `students`, `turmas`, `finance_bank_accounts`, `finance_transfers`, `finance_attachments`, `finance_commission_entries`, `marketing_*` (4), `education_content`, `aurora_agents`, `indicacoes`, `scheduled_exports`, `finance_period_locks`) | `{data}` (até 1000) · **400** se fora da allowlist | tabela pedida | 30 s |

Erros padrão: `403` ("Sem acesso a este tenant" / tenant não identificado), `500` ("Erro ao buscar …"), `401` do `requireUser`. **Sem rate limit.** As prévias são "aproximações" com teto de linhas; a fonte de verdade é a busca autoritativa do `DataContext`.

**[Achado]** A chave de cache é **por tenant, não por usuário**. Como o cliente é `req.supabase` (RLS do usuário que gerou o cache) e existem políticas por módulo/cargo (`user_has_module_access`, migrations CR3 para clínica/educação), um usuário do mesmo tenant **sem** permissão no módulo pode receber, do Redis, a resposta gerada para outro usuário com permissão (`/api/clinica/*`, `/api/education/*`, `table-preview?table=students|turmas`). Inferido da leitura; **[Não verificado]** por teste.

#### API pública por chave (K, cliente SVC, `tenant_id` sempre da chave)

| Método e path | Corpo/query | Resposta e erros | Tabelas | Limiter |
|---|---|---|---|---|
| `POST /api/v1/leads` | `name` (obrigatório) e ao menos um entre `email`/`phone`; opcionais `company`, `cnpj`, `title`, `seller`, `source`, `status` (default "Novo"), `priority` ("Média"), `value`, `stageId` ("sdr-1"), `pipelineId` ("sdr"), `lead_interesse_cliente`, `customFields` (`customFields.reservation` dispara upsert em `reunioes`), `clientId`, `clientName`, `productIds`, `tenantName` | **Dedup** por telefone (só dígitos) e depois e-mail, dentro do tenant: existente → `200 {success, lead, deduped:true}` (só avança status/valor/etapa se veio reserva ou não há histórico); novo → `201 {…, deduped:false}`. Erros: `400` (campos), `401`/`503` (chave), `500` genérico | `leads`, `reunioes` (upsert por `id = reservation.id`) | 60/min por chave |
| `GET /api/v1/leads` | `seller`, `status`, `limit` (100), `offset` (0) | `{success, count, leads}` · `500` | `leads` | idem |
| `POST /api/v1/lead-activities` | `title` (obrig.), `phone`/`email` (um dos dois, só localiza lead), `type` ("Nota"), `description`, `date`, `seller`, `externalId` | `201 {success}`; lead não encontrado → `200 {success, skipped:true}`; idempotência `id = tnp_live_<externalId>` (`upsert ignoreDuplicates`) | `lead_activities`, `leads` | idem |
| `POST /api/v1/finance-entries` | `externalId`, `description` (obrig.), `value`, `date`, `category`, `type` ("Receber"), `status` ("Pago") | `201 {success}`; `id = tnp_fat_<externalId>`, upsert | `finance_entries` | idem |

**[Achado]** os prefixos `tnp_live_`/`tnp_fat_` e o `syncReuniaoFromReservation` (reservas de boliche → `reunioes`) estão embutidos na API "genérica" `/api/v1/*` — acoplamento a um cliente específico, em tensão com a regra de o S.P.Y. ficar genérico (ver memória do projeto e ADR sugerido em §21).

#### Rotas públicas (sem autenticação)

| Método e path | Entrada | Resposta e erros | Tabelas/cliente | Limiter |
|---|---|---|---|---|
| `POST /api/public/lead-capture` | `name` (obrig.), `phone`, `email`, `niche`, `summary` | `{success:true}` · `400`, `503` (sem `SPY_FORM_TENANT_ID` ou service key), `500` | `leads` (SVC); tenant fixo por env | 5/min por IP |
| `GET /api/auth/tenant-theme` | `email`, `host` ou `tenant` | `{primaryColor, tenantName, tenantId, matchedBy?}` (vazio se não achar) · `503`/`500` (500 devolve `err.message` cru) | `users`, `tenants` (SVC ou anon) | nenhum |
| `GET /api/public-proposal/:token` | token com ≥ 16 caracteres | proposta + itens + dados da empresa + cor do tenant; **incrementa** `view_count` e datas de visualização · `400`/`404`/`503`/`500` | `proposals`, `proposal_items`, `tenants`, `app_settings` (SVC) | nenhum |
| `POST /api/public-proposal/:token/accept` | `clientName`, `clientDoc` (lidos mas **não gravados**) | `{success, status:"Aceita", proposal}` · `400`/`404`/`500` | `proposals` (SVC): `status='Aceita'` | nenhum |
| `POST /api/whatsapp/webhook/:instanceId?secret=` | payload do WAHA (`event:"message"`, `payload.from/body/id/fromMe`) | `200 {received:true}` **antes** de processar; `403` se o segredo não bate com `whatsapp_instances.webhook_secret`; `503` | `whatsapp_instances`, `chat_contacts` (upsert), `chat_messages` (insert; `23505` = duplicata ignorada) (SVC) → depois `runAuroraAutoReply` | 60/min por IP (`/api/whatsapp`) |
| `GET /api/google-calendar/oauth/callback` | `code`, `state` (HMAC), `error` | redireciona ao front com resultado | `google_calendar_connections` (SVC) | 60/min |

**[Achado]** (a) `accept` **não confere o status atual** (pode "aceitar" proposta recusada/expirada; ignora `validade`) nem grava quem aceitou; (b) o `view_count` é lido-e-somado (`view_count + 1`), não atômico; (c) `tenant-theme` permite descobrir se um e-mail existe (resposta muda com `matchedBy: "email_exact"`) e enumerar tenants por nome, sem rate limit; (d) o `?secret=` do webhook vai na URL e é comparado com `!==` (não constant-time) — o webhook WAHA só suporta esse formato **[Não verificado]**.

#### IA e utilidades (U, cliente RLS; limiter `/api/ai` e `/api/leads` = 20/min)

| Método e path | Corpo | Resposta / erros | Tabelas |
|---|---|---|---|
| `POST /api/leads/suggest-tags` | `name`, `company`, `notes` | `{tags: string[]}` · `500` | — |
| `POST /api/leads/calculate-score` | `lead`, `activities` | score/temperatura/resumo · `400` sem `lead` | — |
| `POST /api/cnpj/validate` | `cnpj` | `{valid, active, companyName, message}`; se as bases externas falham, devolve "Validação Offline" com `valid:true` se o dígito verificador bate · `400` · **sem limiter** (fora de `/api/leads`/`/api/ai`) | — |
| `POST /api/ai/student-performance-insight` | `name`, `progress`, `grades` | `{insight}` (texto de "IA indisponível" sem chave) | — |
| `POST /api/ai/solar-analyze-fatura` | `imageBase64` (≤ ~4 MB), `mimeType` ∈ JPEG/PNG/WebP | dados da fatura · `400` | — |
| `POST /api/ai/performance-audit` | `mrr`, `cac`, `ltv`, `leadsCount`, `dealsCount` | recomendações (fallback estático se a IA falha) | — |
| `POST /api/ai/content-script` | `title` (obrig.), `desc`, `platform` | roteiro JSON · `400` | — |
| `POST /api/ai/pipeline-audit` | `stageName`, `leads` | JSON | — |
| `POST /api/ai/marketing-advisor` | `leads`, `spent` | JSON | — |
| `POST /api/ai/settings-audit`, `/suggest-new-config`, `/generic-insight` | `type`+`config` / `type` / `context`+`data` | JSON / `{insight}` | — |
| `POST /api/ai/corrigir-nota` | `texto` | `{corrigido}` (devolve o texto original se a IA falha) | — |
| `POST /api/ai/lead-copilot` | `leadContext` | `{analysis}` · `400` | — |
| `POST /api/ai/reuniao-relatorio` | `transcript`, `notes`, `leadContext`, `pauta`, `reuniaoId` | `{relatorio}`; grava em `reunioes` com `req.supabase` · `403`/`500` | `reunioes`, `users` |
| `POST /api/ai/aurora-chat` | `message`, `sessionId?` | `{output, audioBase64}`; encaminha ao webhook n8n (`AURORA_WEBHOOK_URL`, timeout 60 s) com `tenantId`, `tenantName`, `isMaster`; `sessionId` `aurora-reuniao-<id>` só é aceito se a reunião existe para o usuário (RLS) · `400`/`403`/`502`/`503` | `reunioes`, `users` |
| `POST /api/ai/aurora-tenant-chat` | `message` | Aurora "operacional": Gemini com ferramentas (`AURORA_TOOLS`) que consultam `leads`, `clientes`, `products`, `proposals`, `reunioes`, `tasks`, `vendas`, `chat_*` **com `req.supabase`**; respeita `aurora_agents.active` por menção do nome · `400`/`502`/`503` | várias (RLS) |

`aurora-chat`/`aurora-tenant-chat` e `runAuroraAutoReply` (linha 3553, resposta automática de WhatsApp) compõem ~450 linhas do `server.ts`.

#### Configuração, integrações e administração

| Método e path | MW | Corpo/query | Resposta e erros | Tabelas |
|---|---|---|---|---|
| `GET/POST /api/settings/:category`, `DELETE /api/settings/:category/:id` | U | `category` ∈ `sources`, `fields`/`custom-fields`, `task-categories`, `templates` | tenta a tabela `crm_<categoria>` via RLS; senão **memória por tenant** (`tenantBucket`); `401` sem tenant, `404` categoria inválida | `crm_*` (se existir) + RPC `current_tenant_id` |
| `POST /api/integrations/webhook-test` | U | `url`, `event`, `payload` | `{ok, status, latencyMs}`; POST com timeout 8 s para **qualquer URL** · `400` | — |
| `POST /api/integrations/external`, `PUT/DELETE /api/integrations/external/:id`, `POST …/:id/test` | U+TA | `name`, `base_url` (HTTPS), `auth_type` ∈ none/api_key/bearer/basic, `auth_header_name`, `secret_value`, `sync_events`, `active` | `201 {success,id}` / `{success}` / `{ok,status,latencyMs}`; `400`/`404`/`503`/`500`; escopo por `req.tenantId` do usuário | `external_integrations` (SVC) |
| `POST /api/integrations/smtp-test` | U | `smtpServer`, `smtpPort`, `encryption`, `smtpUser`, `smtpPass` | `{ok}`/`{ok:false,error}`; `nodemailer.verify()` contra host arbitrário · `400` | — |
| `POST /api/integrations/meta-pixel-test`, `/ga4-test`, `/payment-gateway-test` | U | `pixelId`+`accessToken`; `measurementId`+`apiSecret`; `provider` ∈ mercadopago/stripe/asaas + `secretKey` | `{ok,…}`; chamam Graph API, GA4 debug, APIs dos gateways · `400` | — |
| `GET /api/admin/permission-check-log` | U | — | últimas 200 linhas · `500`. **[Achado]** só exige `requireUser` (sem `requireMaster`); o acesso depende da RLS de `permission_check_log` **[Não verificado]** | `permission_check_log` (RLS) |
| `GET /api/admin/tenant-admin-user/:tenantId` | U+M | — | `{success,user:{id,email,name}}` · `404`/`503`/`500` | `users` (SVC) |
| `POST /api/admin/tenant-user/:userId/credentials` | U+M | `email` e/ou `password` (≥ 6) | `{success}` · `400`/`503`/`500` | `auth.admin.updateUserById`, `users` |
| `POST /api/admin/tenant` | U+M | `tenantName`, `adminEmail`, `adminPassword` (≥ 6), `niche`, `plan`, `primaryColor`, `timezone`, `modules` | `{success}` · `400`/`409` (e-mail existente)/`500`. Cria `tenants` → usuário Auth (`email_confirm: true`) → `users`; **compensa** apagando o que já criou se uma etapa falha (não é transação) | `tenants`, `users`, Auth (SVC) |

#### WhatsApp (U; limiter 60/min; cliente RLS salvo o webhook)

| Método e path | Corpo | Resposta e erros | Tabelas |
|---|---|---|---|
| `GET /api/whatsapp/provider-status` | — | `{provider: "waha"\|"simulator", configured}` | — |
| `GET/POST /api/whatsapp/instances` | POST: `name` | lista / cria instância (`webhook_url` com `webhook_secret`, provider `createInstance`); falha do provider ainda devolve a linha criada · `400`/`500` | `whatsapp_instances` |
| `POST /api/whatsapp/instances/:id/qrcode`, `/connect` | — | QR / estado da conexão · `404`/`502` | `whatsapp_instances` |
| `PUT/DELETE /api/whatsapp/instances/:id` | PUT: `name`, `phone`, `status` | · `404`/`500` | `whatsapp_instances` |
| `GET /api/whatsapp/contacts`, `POST` | POST: `name`, `phone`, `tags` | até 500 contatos; cria com `+55` se faltar DDI · `400`/`500` | `chat_contacts`, `whatsapp_instances` |
| `GET /api/whatsapp/messages/:contactId` | — | até 200 mensagens · `500` | `chat_messages` |
| `POST /api/whatsapp/messages/send` | `contactId`, `text` | envia via WAHA (se configurado) e registra · `400`/`404`/`409` (sem instância conectada)/`502`/`500` | `chat_contacts`, `chat_messages`, `whatsapp_instances` |
| `POST /api/whatsapp/copilot/analyze` | `contactId` | sugestão de resposta com IA · `400`/`500` | `chat_messages`, `chat_contacts` |

`server/whatsappProvider.ts`: `WAHAProvider` (gateway único por deployment, `WAHA_API_URL`/`WAHA_API_KEY`) e `SimulatorProvider` (QR falso, conexão instantânea, envio sempre "ok"), escolhidos por `getActiveProviderName()` (waha se `WAHA_API_URL` existe). O comentário do webhook admite que o contrato do payload WAHA **nunca foi exercitado contra um servidor real neste ambiente**.

#### Google Calendar (`server/googleCalendar.ts`, montado em `/api/google-calendar`, limiter 60/min)

Todas `U` exceto o callback. Tenant vem de `resolveTenantId`: `current_tenant_id()` ou o header `x-active-tenant-id`.

| Método e path | Entrada | Resposta e erros |
|---|---|---|
| `GET /connect/start` | `returnTo` (sanitizado) | `{url}` de consentimento; `state` assinado por HMAC (`GOOGLE_OAUTH_STATE_SECRET`) |
| `GET /oauth/callback` | `code`, `state`, `error` | valida `state` (`timingSafeEqual`), troca o código, grava tokens em `google_calendar_connections` (só SVC), redireciona |
| `GET /status` | — | `{connected, email, status, lastSyncAt, calendarId}` |
| `POST /disconnect` | — | `{success}`; grava auditoria |
| `GET /events` | `timeMin`, `timeMax`, `maxResults` (≤ 250) | `{events}` · `404 google_calendar_not_connected`, `409 google_calendar_reauth_required`, `502`, `500` |
| `POST /events` | `title`, `startISO`, `endISO` (obrig.), `description`, `location`, `attendeeEmails`, `skipConferenceData` | `{id, htmlLink, hangoutLink}` · `400`/`404`/`409`/`502`/`500` |
| `POST /meet-space` | — | `{name, meetingUri, meetingCode}` |
| `POST /sync` | `timeMin`, `timeMax` | importa eventos para `reunioes` (via RLS) |

**[Achado crítico]** `resolveTenantId` (`server/googleCalendar.ts` linhas 146-182): quando o header `x-active-tenant-id` está presente e diferente do tenant do usuário, o código chama `has_tenant_access`, mas **em qualquer desfecho retorna `{ tenantId: requested }`** (linhas 165, 169 e 171). Ou seja, a checagem de acesso é efetivamente ignorada e o comentário do topo do arquivo ("só é aceito depois de validado") não corresponde ao comportamento. Sem o header e sem tenant resolvido, retorna o tenant literal `"default"`. Como a conexão é buscada por `(tenant_id, user_id)` com `user_id` vindo do JWT, o impacto principal é gravar/ler conexões e auditoria sob um `tenant_id` arbitrário e importar eventos para um tenant que o usuário não acessa (o `req.supabase` do `/sync` ainda passa pela RLS). Corrigir: retornar `403` quando `has_tenant_access` falha. **[Não verificado]** por teste dinâmico.

### 14.3 Outros artefatos de backend

- **`dev-server.ts`** (21 linhas): importa o app do `server.ts`; em desenvolvimento usa `createServer` do Vite em `middlewareMode` (`appType: "spa"`) na **porta 3002 fixa** (`0.0.0.0`); em produção serve `dist/` estático com fallback para `index.html`. Como o Vite carrega o `vite.config.ts`, `hmr: false` vale também no dev (comentário: desligado por causa do AI Studio) — sem hot reload de tela.
- **`api/index.ts`** (2 linhas): `import app from "../server.js"; export default app;` — a Vercel trata o Express como uma função. O `vercel.json` reescreve `/api/(.*)` → `/api/index` e o restante → `/index.html`. Não há `functions`/`maxDuration` configurados no `vercel.json`; rotas com espera longa (Aurora chat 60 s, Gemini) dependem do limite do plano **[Não verificado]**.
- **`npm run build`**: `vite build` + `esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs`. O `dist/server.cjs` serve `npm start`; na Vercel o handler é o `api/index.ts` (compilado pela plataforma).
- **`supabase/functions/analyze-crm-call/index.ts`** (118 linhas, Deno): `POST` com `{promptData:{transcript,…}, provider:"gemini"|"groq"}` → monta prompt e chama Gemini (`gemini-1.5-flash-latest`, chave na query string) ou Groq (`llama-3.3-70b-versatile`). Erros: `400` sem `transcript`, `500` com `err.message`. CORS por `ALLOWED_ORIGINS`. **[Achado]** o código **não valida JWT**; a proteção depende de `verify_jwt` da plataforma (padrão do Supabase), e não há `supabase/config.toml` no repositório **[Não verificado]** como está configurada em produção. O modelo Gemini diverge do usado em `server.ts` (`gemini-3.6-flash`).
- **Variáveis de ambiente lidas no backend** (grep em `server.ts`/`server/*.ts`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SPY_API_KEYS`/`AXIS_API_KEYS`, `SPY_CORS_ORIGIN`/`AXIS_CORS_ORIGIN`, `SPY_FORM_TENANT_ID`/`AXIS_FORM_TENANT_ID`, `SPY_FORM_CLIENT_ID`/`AXIS_FORM_CLIENT_ID`, `GEMINI_API_KEY`, `GROQ_API_KEY` (e `VITE_GROQ_API_KEY` como fallback), `AURORA_WEBHOOK_URL`, `REDIS_URL`, `PUBLIC_APP_URL`, `APP_URL`, `WAHA_API_URL`, `WAHA_API_KEY`, `GOOGLE_CLIENT_ID`/`VITE_GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`, `GOOGLE_OAUTH_STATE_SECRET`, `GOOGLE_OAUTH_SUCCESS_ORIGIN`. **[Achado]** `STATE_SECRET` cai para `SUPABASE_SERVICE_ROLE_KEY` e, na falta, para o literal `"axis-state-secret"` (`googleCalendar.ts` linha 27).

---

## 15. Banco de dados (visão técnica)

Base: `docs/DATABASE.md` e `docs/DATABASE_SECURITY.md` (estado verificado ao vivo em 2026-09-03 no projeto Supabase; as migrations posteriores estão listadas abaixo). O repositório tem **120 migrations** (`20260602_…` a `20260924_…`), mas as ~70 tabelas-base foram criadas por scripts iniciais e pelo dashboard (`schema.sql` está desatualizado — D3); nem tudo que existe em produção está versionado (ex.: `contracts_proposal_id_unique`, publicação realtime).

### 15.1 Funções e RPCs (busca por `create [or replace] function` em `supabase/migrations`)

| Função | Migration | Tipo/uso |
|---|---|---|
| `current_tenant_id()`, `is_super_admin()` | `20260803_auth_migration_phase0` | isolamento (`SECURITY DEFINER`, `STABLE`) |
| `current_partner_id()`, `has_tenant_access(uuid)`, `platform_metrics_overview()` | `20260803_partners_phase4` | isolamento e métricas cross-tenant (a última valida `current_partner_id()`/`is_super_admin()` no corpo) |
| `has_tenant_access` (reescrita) | `20260920_optimize_has_tenant_access` | 1 busca em `users` em vez de 3 por linha; medido: leads 804 ms → 198 ms |
| `is_own_tenant_or_super_admin(uuid)` | `20260920_consolidate_tenant_or_admin_rls_check` | policies `tenant_*` de `tenants`/`users` |
| `is_tenant_admin_or_master()` | `20260921_cr1_cargos_squads_admin_only_write` | escrita restrita em `cargos`/`squads` |
| `user_has_module_access(…)`, `log_module_permission_check()` | `20260921_cr3_…`, `20260906_permission_check_log_mode` | enforcement/registro de acesso por módulo (clínica, educação; modo "log" em crm/financeiro/rh) |
| `email_taken(text)` | `20260827_enable_rls_tenants_users` | checagem de e-mail (RPC) |
| `claim_next_form_sdr(uuid)` | `20260903_scope_claim_next_form_sdr` | rodízio de SDR do formulário público (tenant fixo) |
| `assign_lead_round_robin()` | `20260905_lead_round_robin_closers` | trigger `BEFORE INSERT` em `leads`; só atua sem `seller`; lock de linha em `app_settings` serializa por tenant |
| `get_public_proposal(token)`, `get_public_imovel(id)`, `get_public_corretor_portfolio(slug)`, `get_public_catalog(tenant)` | migrations `20260906_*` | acesso anônimo por RPC `SECURITY DEFINER`, sem `SELECT` direto para `anon` |
| `finalizar_venda(uuid)`, `registrar_movimentacao_estoque(…)` | `20260906_varejo_*` | varejo: fechamento de venda e movimentação de estoque (chamadas de `Vendas.tsx`, `Estoque.tsx`, `ComprasVarejo.tsx`) |
| `baixar_estoque_proposta_aceita()` | `20260906_baixa_estoque_venda_aceita` | trigger em `proposals`: ao virar `Aceita`, `products."currentStock" -= proposal_items.quantidade` |
| `gerar_mensalidades_matricula(…)`, `atualizar_inadimplencia_mensalidades()` | `20260906_educacao_mensalidades` | educação |
| `registrar_repasse_consignacao(uuid)`, `increment_veiculo_test_drive()` | `20260906_veiculos_*` | automotivo |
| `guard_finance_period_lock()` | `20260921_a1_finance_period_lock_db_trigger` | trigger: bloqueia UPDATE/DELETE de lançamento `Pago` em período fechado (usa `date_normalized`); não bloqueia chamadas sem usuário (service role/jobs) |
| `guard_tenant_modules_plan_update()` | `20260921_cr2_guard_tenant_modules_plan_update` | trigger em `tenants`: só master altera `modules`/`plan`/`module_*` |
| `provision_tenant_ai_config()` | `20260921_tenant_ai_config_autoprovision` | trigger de provisionamento de config de IA por tenant |
| `dispatch_webhook_event(…)`, `trg_dispatch_lead_created/lead_status_changed/task_created` | `20260919_webhooks_dispatch_real` | webhooks reais via `pg_net` (assíncrono), lidos de `app_settings.globalWebhooks`; log em `webhook_logs` |
| `dispatch_external_integration_event(…)`, `trg_dispatch_external_*` | `20260919_external_integrations_connector` | conectores externos por tenant |
| `set_updated_at()` | `20260606_app_settings` | trigger genérico |

Chamadas RPC no frontend (grep `rpc(`): `get_public_*` (4), `gerar_mensalidades_matricula`, `atualizar_inadimplencia_mensalidades`, `registrar_movimentacao_estoque`, `finalizar_venda`, `platform_metrics_overview`, `registrar_repasse_consignacao`; no backend: `has_tenant_access`, `current_tenant_id`.

### 15.2 Triggers relevantes (resumo)

`trg_assign_lead_round_robin`, `trg_baixar_estoque_proposta_aceita`, `trg_guard_finance_period_lock`, `trg_guard_tenant_modules_plan`, `trg_permission_log_{crm,financeiro,rh,clinica,educacao}`, `webhook_lead_created`/`webhook_lead_status_changed`/`webhook_task_created`, `trg_external_lead_created`/`_status_changed`/`trg_external_task_created`, `trg_provision_tenant_ai_config`, `trg_increment_veiculo_test_drive`, `trg_imobiliario_veiculos_updated_at`, `update_google_calendar_connections_modtime`, `app_settings_updated_at`.

**[Achado]** `baixar_estoque_proposta_aceita` usa `proposal_items.quantidade`. Como itens recorrentes gravam `quantidade = ciclos × unidades` (§6.3), se um produto **com controle de estoque** for vendido como assinatura, a baixa seria multiplicada pelos ciclos. Hoje não há evidência de produtos recorrentes com estoque **[Não verificado]**; é mais um custo da convenção D1.

### 15.3 Policies-padrão (resumo; detalhe em `docs/DATABASE_SECURITY.md`)

- Padrão majoritário: `tenant_isolation` (`FOR ALL`, `USING`/`WITH CHECK` com `has_tenant_access(tenant_id)`) em ~55 das ~73 tabelas.
- Variantes: sem caminho de parceiro (`tenant_id = current_tenant_id() OR is_super_admin()`), só dono (`julia_interaction_log`, `lead_commercial_memory`), `INSERT`-only para `anon` com `tenant_id` fixo (formulário público), global-ou-tenant (`app_settings`, `nichos`), por usuário (`user_settings`), deny-all (`tenant_integrations`, `julia_round_robin_state`).
- Endurecimentos posteriores no repositório: `20260921_cr1_…` (escrita de `cargos`/`squads` só para admin do tenant/master), `20260921_a4_dev_module_rls_policies`, `20260921_cr3_…` (leitura de clínica/educação por módulo), `20260921_tenants_select_partner_access`, `20260905_revoke_*_truncate`, `20260906_revoke_truncate_default_privileges`, `20260919_revoke_public_execute_dispatch_functions`.

### 15.4 Índices

- `20260803_tenant_id_indexes_phase5`: 34 índices em `tenant_id` nas tabelas de negócio.
- `20260920_perf_indexes_high_volume_tables`: compostos `(tenant_id, created_at DESC)` em `leads`, `finance_entries`, `appointments`, `lead_activities`, `notifications`, `tasks`, `proposals` — motivo: `ORDER BY created_at DESC LIMIT N` caía em scan sequencial.
- Pontuais: `idx_leads_tenant_phone`/`idx_leads_tenant_email` parciais (`20260918_leads_dedup_indexes`, dedup de `/api/v1/leads`); `clientes`, `products`, `reunioes` `(tenant, created)`; `mensalidades (tenant, vencimento)`; `finance_entries.date_normalized` (coluna gerada, usada pelo trigger de bloqueio de período).
- Restrições únicas citadas em comentários: `contracts_proposal_id_unique` (**existe no banco vivo, mas não versionado**, ver 13.3). `chat_contacts (whatsapp_instance_id, phone)` é o `onConflict` do webhook (`20260921_whatsapp_real_chat_persistence`); `chat_messages` tem constraint em `wa_message_id` (`20260921_fix_chat_messages_wa_message_id_constraint`).

### 15.5 Realtime e storage

- **Realtime**: o front assina `postgres_changes` em ~40 tabelas (§13.3), mas **nenhuma migration do repositório** faz `alter publication supabase_realtime add table …` (`grep` sem resultados). A publicação foi configurada fora do versionamento. **Verificado no banco vivo em 2026-09-24:** `supabase_realtime` publica **111 tabelas** de `public` (inclui `leads`, `proposals`, `proposal_items`, `contracts`, `finance_entries`, `clientes`, `products`). **Não estão publicadas** (mas o app assina ou pode assinar): `finance_audit_log`, `finance_bank_accounts`, `finance_transfers`, `finance_budgets`, `finance_period_locks`, `finance_attachments`, `chat_contacts`, `chat_messages`, `aurora_events`, `aurora_insights`, `tenant_ai_config`. Nessas, o evento não chega e a tela só atualiza no próximo reload. Ação: versionar a publicação em migration e publicar as tabelas que o front escuta (Plano, tarefa 1.7).
- **Buckets** (migrations): `avatars` (5 MB), `proposals` (20 MB), `products` (25 MB; `20260904_products_storage_and_attributes`), `finance` (25 MB; `20260918_finance_attachments_bucket_and_table`). Todos `public: true` (leitura por URL), escrita/edição/exclusão por policy em `storage.objects` com `(storage.foldername(name))[1] = current_tenant_id()::text` (ou `is_super_admin()`). O bucket `finance` **não define `allowed_mime_types`** na migration (só tamanho), ao contrário de `products`, `avatars` e `proposals` **[Não verificado]** o estado real.

### 15.6 Migrations mais importantes (por tema)

| Migration | Por que importa |
|---|---|
| `20260803_auth_migration_phase0`, `_rls_tenant_isolation_phase1`, `_partners_phase4`, `_tenant_id_indexes_phase5` | Base do modelo: funções de isolamento, RLS em todas as tabelas, parceiros e índices |
| `20260827_enable_rls_tenants_users`, `_lock_down_tenant_integrations` | RLS em `tenants`/`users`; credenciais de integração só via service role |
| `20260901_tighten_anon_rls_policies`, `20260902_restrict_anon_tenants_columns`, `20260903_close_open_rls_policies`, `20260903_scope_claim_next_form_sdr` | Fechamento de acesso anônimo (achados críticos da auditoria) |
| `20260904_google_calendar_connections` (+`_hardening`) | Tokens Google só via service role |
| `20260904_products_storage_and_attributes` | Bucket `products` e `type_attributes` JSONB (ADR-3) |
| `20260906_public_proposal_view_tracking` | `view_token` (CSPRNG), `view_count`, RPC anônima |
| `20260906_baixa_estoque_venda_aceita`, `20260906_varejo_*`, `_educacao_mensalidades`, `_veiculos_*` | Regras de nicho dentro do banco |
| `20260918_finance_*` | Contas, transferências, categorias, bloqueio de período, auditoria, anexos |
| `20260919_webhooks_dispatch_real`, `_external_integrations_connector` | Eventos reais via `pg_net` |
| `20260920_optimize_has_tenant_access`, `_perf_indexes_high_volume_tables` | Resposta ao incidente de `statement timeout` (2026-09-20) |
| `20260921_a1_…`, `_cr1_…`, `_cr2_…`, `_cr3_…` | Achados da auditoria de 2026-09-21 movidos para o banco |
| `20260921_whatsapp_real_chat_persistence` | `chat_contacts`/`chat_messages` reais (fim do simulador em memória) |
| `20260923_finance_entries_proposal_id`, `_proposal_items_frequency`, `_proposals_decisor_fields` | Vínculo lançamento↔proposta e frequência do ciclo (venda multi-produto) |

---

## 16. Tratamento de erros, logging e observabilidade

### 16.1 O que existe hoje

| Camada | Mecanismo | Onde |
|---|---|---|
| Erro de render | `ErrorBoundary` (página/compacto, auto-retry para `NotFoundError` de extensões) | `src/components/ErrorBoundary.tsx` |
| Erro de escrita/consulta (UI) | `toast.error(\`…: ${friendlyError(error)}\`)` (sonner); `friendlyError` traduz e esconde jargão | `DataContext.tsx` e páginas |
| Log de diagnóstico no navegador | `console.log/warn/error` (10 `console.log`, dezenas de `console.error`); `AuthContext` e `supabase.ts` logam configuração a cada carga | `src/**` |
| Carga parcial | 1 toast agregado listando tabelas que falharam após 3 tentativas | `DataContext.tsx` (fim da carga inicial) |
| Erro no servidor | `console.error("[rota] …")` com detalhe + resposta genérica; handler global `500` | `server.ts` (linha 4629) |
| Log de uso da API pública | tabela `api_key_usage_log` (tenant, prefixo da chave, método, path, status, IP) | `logApiKeyUsage` (`server.ts` linha 2017) |
| Auditoria financeira | `finance_audit_log` (CRIACAO/ATUALIZACAO/EXCLUSAO com diff) alimentado por `writeFinanceAuditLog` | `DataContext.tsx` |
| Auditoria de permissão | `permission_check_log` via triggers `trg_permission_log_*` | migrations 20260906/20260919/20260921 |
| Auditoria Aurora/IA | `aurora_audit_log`, `aurora_model_failures`, `tenant_token_usage_current_month` (hooks `useAuroraAuditLog`, `useAuroraTokenUsage`) | migrations 20260921 |
| Webhooks | `webhook_logs` (status/resposta por disparo) | `20260919_webhooks_dispatch_real` |
| Google | `logAudit` em `googleCalendar.ts` | `server/googleCalendar.ts` linha 125 |
| Saúde | `GET /api/health/redis` (sem autenticação) | `server.ts` linha 312 |

### 16.2 Lacunas

1. **Sem monitoramento de erros** (Sentry ou equivalente): nenhuma referência no `package.json`, `src/` ou `server.ts`. Erros de render e de rotas ficam só no console do navegador do usuário / logs da Vercel.
2. **Sem logs estruturados** no backend (texto livre com prefixo entre colchetes); sem `request id`/correlação, sem nível configurável.
3. **Sem `unhandledRejection` handler** no servidor além do handler de erro do Express (rotas `async` sem `try/catch` podem gerar rejeição não tratada em Express 4) **[Não verificado]** por rota.
4. **Sem rollback** nas escritas otimistas (13.3) — o usuário vê sucesso local e um toast de erro; o dado não some da tela.
5. **Ruído**: `console.log` de configuração em toda carga; `console.error/warn` filtrados em `main.tsx` (pode ocultar erros legítimos de WebSocket).
6. **Health check** só de Redis; não há check de Supabase, service key ou versão do build.
7. **Erros ao cliente**: `tenant-theme` devolve `err.message` cru; a Edge Function devolve `err.message` cru.
8. **Sem métricas** (latência por rota, taxa de HIT do Redis — só o header `X-Cache`), nem alertas para `statement timeout` (foi descoberto por incidente).

### 16.3 Recomendações mínimas

Adicionar Sentry (front + back) com `tenant_id` como tag; middleware de request-id e log JSON; `/api/health` agregando Supabase/Redis/versão; reverter estado otimista em `updateLead`/`deleteLead`/`updateFinanceEntry`; reduzir `console.log` de configuração para `import.meta.env.DEV`.

---

## 17. Estratégia de testes

### 17.1 O que existe hoje

- **`supabase/tests/tenant_isolation_test.sql`** (93 linhas): bloco `DO $$` para colar no SQL editor. Cria 2 tenants, 3 usuários (2 comuns + 1 master) e 2 leads; simula sessões com `set_config('role','authenticated')` e `request.jwt.claims`; afirma que o tenant A não lê/edita/apaga lead do B (e vice-versa) e que o master vê os dois; limpa no fim (numa falha, a limpeza pode ficar pendente — o próprio arquivo avisa). Não é executado por CI.
- **`.github/workflows/ci.yml`**: `npm ci` → `npm run lint` (`tsc --noEmit`) → `npm audit --audit-level=high` → `npm run build`. Node 20. **Nenhum teste automatizado de código.**
- **Playwright**: `playwright ^1.63.0` em `devDependencies`, mas **sem** `playwright.config.*`, sem pasta `e2e/`/`tests/` e sem `*.spec.*` (busca no repositório). `plain_test.mjs` (na raiz) é só um teste de importação de `@supabase/auth-js`, não um teste de produto.
- **Sem** Vitest/Jest, sem testes de componentes, sem `scripts/` de teste. Verificações de segurança foram manuais (`SET ROLE anon`, `get_advisors`).

### 17.2 Pirâmide proposta (concreta para este código)

**Base — unitários (Vitest, sem rede, < 5 s)**. Alvos: funções puras já isoladas.

`src/lib/saleCalculator.ts` (`calculateSale`, `splitInstallments`, `addMonthsClamped`, `addPeriodo`, `cycleMonthsFor`):
| Caso | Entrada | Esperado (derivado do código) |
|---|---|---|
| Parcelamento com centavos | `splitInstallments(100, 3)` | `[33.33, 33.33, 33.34]` |
| Soma preservada | `splitInstallments(0.10, 3)` | soma = 0,10 |
| Fim de mês | `addMonthsClamped(31/01/2026, 1)` | 28/02/2026; em 2028: 29/02/2028 |
| Recorrente mensal, 12 meses | `unitPrice=997, quantity=1, billingType="recurring", frequency="mensal", durationMonths=12` | `numberOfCycles=12`, `paymentSchedule.length=12`, `totalProjectedAmount=11964`, nenhuma cobrança individual = 11964 (invariante §6.1) |
| Trimestral, 12 meses | idem com `frequency="trimestral"` | `numberOfCycles=4` |
| Sem prazo | `durationMonths=null` | `isOpenEnded=true`, `numberOfCycles=12` (`OPEN_ENDED_BATCH_CYCLES`) |
| Desconto 1ª cobrança | `first_charge`, 200 | `firstChargeAmount = 797`, `recurringChargeAmount = 997` |
| Desconto total | `total`, 1200 em 12 ciclos | `cycleAmount = 897` |
| Desconto % | `percentage`, 10 | `cycleAmount = 897,3`; 150 é limitado a 100 % |
| Setup | `setupFee=500` | só na 1ª cobrança |
| Pontual em 3x | `one_time`, installments 3 | 3 itens, soma = total, 2ª data = +1 mês |
| Entrada inválida | `quantity=0`, preço negativo | trata como 1 / 0 (`Math.max`) |
| **Possível bug** | `frequency="semanal"`, `durationMonths=12` | `cycleMonthsFor("semanal")` cai em `1` (não está em `CYCLE_MONTHS`) → 12 ciclos espaçados de 7 dias (12 semanas, não 12 meses). Documentar como comportamento ou corrigir |

`src/lib/revenueMetrics.ts`: `getMRR` ignora `Cancelado`/`Perdido`; aceita `mrr` como string BRL ("R$ 997,00"); `getChurnRate` com e sem `months`; `getConversionRate` com lista vazia = 0; `getRevenueProjection`.
`src/lib/utils.ts`: `parseCurrencyBR` ("1.500,50"→1500.5, "1,500.50", "50,00", "15.000"→15000; **"0.500" → 500** por regra de milhar), `validateCNPJ` (válidos/inválidos, com máscara), `formatPhone`.
`src/lib/friendlyError.ts`: cada regra de mensagem; entrada `null`/string.
`src/lib/leadScore.ts`: temperatura por faixas, efeito das notas.

**Meio — integração (Vitest + Supabase local/branch, ou Testing Library com client mockado)**.
1. **Reconciliações do `DataContext`** (extrair a lógica para funções puras ou testar via provider com Supabase mockado):
   - `syncAcceptedProposal`: proposta `Aceita` sem contrato → 1 contrato + 1 lançamento "Contrato / Recorrente" (+1 "Implantação / Setup" se houver item `one_time`); reexecutar → **0** novas criações (idempotência); proposta de outro `tenant_id` → nenhuma escrita; `discountRatio` (proposta de R$ 4.367 com itens de catálogo somando R$ 11.964 → contrato pelo valor com desconto); MRR = total ÷ `contractMonths`; **caso de risco**: assinatura sem prazo (`contract_months = null`) e produto sem `contractMonths` → MRR igual ao total de 12 ciclos (divisão por `undefined`) — o teste deve fixar o comportamento desejado.
   - `createClientFromWonLead`: lead `Fechado` sem cliente → 1 cliente; dois leads com o mesmo `cnpj` → 1 cliente e 2 vínculos; `clientId` órfão → recria; troca de tenant no meio da carga → nada é gravado no tenant errado; lead sem cidade/telefone → campos `null` (nunca "São Paulo").
   - `createProposalWithItems`: `leads.value` = soma das propostas; falha no 2º item → estado esperado (hoje: proposta e 1º item permanecem — documentar ou tornar transacional).
   - `createCrudHelper.del`: DELETE de 0 linhas (RLS) → item reinserido e `false`.
2. **Backend (`supertest` sobre o `app` exportado)**: `requireApiKey` (503/401/ok), dedup de `POST /api/v1/leads` (2 chamadas com o mesmo telefone → 201 depois 200 `deduped:true`), idempotência de `lead-activities` por `externalId`, `resolveRequestedTenantId` (403 para tenant sem acesso), allowlist de `table-preview` (400), limites de rate limit (`lead-capture` 6ª chamada → 429), `public-proposal/:token/accept` (status inicial), `resolveTenantId` do Google Calendar (regressão do achado da §14.2).
3. **Banco (pgTAP ou o SQL existente automatizado)**: transformar `tenant_isolation_test.sql` em job de CI contra um Supabase local (`supabase start`), e ampliar: uma asserção por grupo de tabelas de §19.2; `guard_finance_period_lock`; `guard_tenant_modules_plan_update`; `assign_lead_round_robin` (concorrência); `get_public_*` sem vazar outro tenant.

**Topo — e2e (Playwright, poucos e estáveis; já é dependência)**. Fluxos centrais, contra um tenant de teste:
1. Login → trocar de tenant (master) → dados do tenant anterior não aparecem.
2. Novo lead → mover no Kanban até "Fechado" → cliente aparece na Base de Clientes **uma única vez** (recarregar a página e conferir).
3. Fechamento multi-produto: adicionar 2 produtos (1 recorrente 12x, 1 avulso com setup) → 1 proposta com N itens → aceitar via link público `/proposta/:token` → contrato com MRR correto e lançamentos (1ª cobrança com setup) em Financeiro.
4. Excluir proposta → valor do lead recalculado e lançamentos/contrato órfãos removidos.
5. Bloqueio de período financeiro: lançamento pago em período fechado não pode ser editado (UI e banco).
6. Usuário sem cargo com módulo "clínica" acessando `/app/clinica/...` → redirecionado.

### 17.3 Pipeline sugerido e metas

`lint` → `vitest run` (unit+integração) → `supabase db test` (isolamento) → `build` → Playwright em preview (só `main`/nightly). Metas mensuráveis: cobertura de linhas ≥ 90 % em `saleCalculator`/`revenueMetrics`/`utils`/`friendlyError`; 100 % dos invariantes §6.1-6.6 com ao menos um teste nomeado; suíte unit + backend < 60 s; e2e flake rate < 2 %. Regra de PR: toda mudança financeira traz teste (já é critério de aceite em §11 — hoje sem ferramenta que o cumpra, D9).

---

## 18. Performance

### 18.1 Estado atual (medido/documentado no código)

- **Carga inicial**: ~30 tabelas na fase 1 + módulos de nicho sob demanda (§13.3), concorrência máxima 10 (`dbLimit`), páginas de 1.000 linhas em paralelo após a 1ª, retry 3× (500 ms, 1 s, 1,5 s).
- **Cache em 2 níveis**: (1) `sessionStorage` 5 min para `products`/`crm_funis`/`squads`; (2) Redis TTL 20-60 s no backend (prévias e resumos). Não há biblioteca de cache de dados no cliente (React Query/SWR): cada tela/contexto controla o próprio estado.
- **Paginação real** (server-side) existe em telas específicas: `useLeadsList` (`PAGE_SIZE = 50`, busca com debounce de 300 ms, ordenação por temperatura só dentro da página), `usePropostasList`, `useFinanceEntriesList`, `useFinanceTransacoesList`, `useMensalidadesList`, componente `ui/Pagination.tsx`. As demais telas trabalham sobre o array completo do `DataContext`.
- **Índices**: `(tenant_id, created_at DESC)` nas tabelas quentes; `has_tenant_access` otimizada (RLS por linha) — leads de 804 ms para 198 ms por página; `reunioes` (~4.600 linhas) 213 ms (antes: timeout).
- **Realtime**: `applyRealtimeUpsert` (patch) para as tabelas de alto volume; debounce 1,5 s nas demais.
- **Bundle**: `vite.config.ts` sem `manualChunks`; 1 `lazy`. Chunks separados existentes: landing (`SPYLandingPage`) e `AuroraCore3D` (three.js). Build encontrado em `dist/`: entrada principal ~4,96 MB sem compressão **[Não verificado]** se corresponde ao HEAD. Dependências pesadas no bundle principal por import estático: `recharts`, `jspdf` + `jspdf-autotable`, `@hello-pangea/dnd`, `papaparse`, `three`/`@react-three/fiber` (só via chunk da Aurora), `@google/genai`.

### 18.2 Gargalos prováveis

1. **`DataContext` carrega tudo**: cada usuário baixa todos os leads (milhares), reuniões, lançamentos, propostas… do tenant; tudo vive em estado React de um único provider, então qualquer `setState` re-renderiza todos os consumidores de `useData()` (contexto único com ~200 valores) — custo de render cresce com o volume.
2. **Bundle monolítico**: 4-5 MB de JS antes do login em rede móvel.
3. **Efeitos de reconciliação** dependentes de arrays grandes (`[leads, clienteBase]`, `[proposals, contracts…]`) reexecutam a cada mudança realtime.
4. **Latência de região**: comentário no código cita projeto Supabase em `us-west-2` (~150-250 ms por requisição a partir do Brasil); ~30 requisições em fila de 10 = 3+ ondas mínimas.
5. **Resumos** paginam a tabela inteira no servidor (até N páginas de 1.000) a cada MISS de 60 s, por tenant.
6. **Cache por TTL sem invalidação**: dado até 20-60 s defasado após escrita; e vazamento entre usuários com permissões diferentes (14.2).
7. **RLS por linha** continua custo relevante em tabelas grandes (mesmo após otimização).

### 18.3 Recomendações mensuráveis

| # | Ação | Métrica / meta |
|---|---|---|
| 1 | Converter as páginas por módulo em `React.lazy` + `Suspense` e configurar `manualChunks` (`recharts`, `jspdf`, `dnd`, vendor) | JS inicial (gzip) do `/login` e do `/app/dashboard` < 400 kB; medir com `vite build` + `rollup-plugin-visualizer` |
| 2 | Não carregar no boot o que a tela não usa: mover `leads`, `finance_entries`, `reunioes` para carga por rota com paginação (hooks `use*List` já existem) e manter no contexto só o necessário (funis, produtos, cargos, settings) | Tempo até "primeiro Kanban/lista útil" p75 < 2 s; nº de requisições no boot < 12 |
| 3 | Dividir `DataContext` em contextos por domínio (CRM, Financeiro, Config) ou usar seletores (`use-context-selector`/Zustand) | Re-renders por evento realtime (React Profiler) reduzidos ≥ 70 % na tela de Pipeline |
| 4 | Adotar TanStack Query (já há `@tanstack/react-table`) para cache/stale-while-revalidate, retry e invalidation por chave | Requisições duplicadas em navegação entre telas → ~0 |
| 5 | Chave de cache por tenant **e** por perfil de permissão (ou não cachear rotas com RLS por módulo) | 0 respostas cross-permissão em teste |
| 6 | Mover somas pesadas dos resumos para SQL (views/RPC `GROUP BY`) em vez de paginar linhas no Node | p95 dos `-summary` em MISS < 800 ms para tenant com 10 mil leads |
| 7 | Monitorar `statement timeout`/latência (logs do Supabase + alerta) e considerar região/compute maior | 0 erros 57014 por semana |
| 8 | `EXPLAIN (ANALYZE)` sob `SET ROLE authenticated` para as 10 consultas mais lentas e revisar índices (ex.: `finance_entries (tenant_id, date_normalized)` para DRE/fluxo) | p95 por consulta < 300 ms |
| 9 | Web Vitals no front (LCP/INP) enviados a um coletor | LCP p75 < 2,5 s no dashboard |

---

## 19. Segurança técnica detalhada

### 19.1 Matriz middleware × rota

| Grupo de rotas | Middleware | Client DB | Rate limit | Observações |
|---|---|---|---|---|
| `/api/v1/*` | `requireApiKey` | SVC | 60/min por chave | tenant só da chave; usa service role |
| `/api/public/lead-capture` | — | SVC | 5/min por IP | tenant fixo por env |
| `/api/public-proposal/:token[/accept]` | — (token ≥ 16 car.) | SVC (ou anon) | **nenhum** | token = `view_token` (CSPRNG) |
| `/api/auth/tenant-theme` | — | SVC (ou anon) | **nenhum** | enumeração de tenants/e-mails |
| `/api/whatsapp/webhook/:id` | segredo na query | SVC | 60/min por IP | `tenant_id` da linha da instância |
| `/api/google-calendar/oauth/callback` | `state` HMAC | SVC | 60/min | — |
| `/api/health/redis` | — | — | nenhum | só topologia |
| `-summary`, `-list`, `table-preview` | `requireUser` + `has_tenant_access` (se `?tenantId`) | RLS | nenhum | cache por tenant |
| `/api/ai/*`, `/api/leads/*` | `requireUser` | RLS (ou nenhum) | 20/min por IP | sem RBAC por papel |
| `/api/cnpj/validate` | `requireUser` | — | nenhum | chama serviços externos |
| `/api/settings/*` | `requireUser` | RLS + memória | nenhum | estado em memória |
| `/api/whatsapp/*` (exceto webhook) | `requireUser` | RLS | 60/min | — |
| `/api/integrations/external*` | `requireUser` + `requireTenantAdmin` | SVC | nenhum | segredo (`secret_value`) só no servidor; leitura pelo front via view `external_integrations_safe` |
| `/api/integrations/*-test` | `requireUser` | — | nenhum | chamadas a URL/host informados pelo usuário |
| `/api/google-calendar/*` (exceto callback) | `requireUser` | SVC/RLS | 60/min | ver achado em 14.2 |
| `/api/admin/*` | `requireUser` + `requireMaster` | SVC | nenhum | exceção: `permission-check-log` só `requireUser` |
| Edge Function `analyze-crm-call` | `verify_jwt` da plataforma (não verificado) | — | da plataforma | sem checagem no código |

### 19.2 RLS por grupo de tabelas (resumo de `docs/DATABASE_SECURITY.md`)

| Grupo | Policy | Tabelas típicas |
|---|---|---|
| Operacionais multi-tenant | `tenant_isolation` com `has_tenant_access(tenant_id)` (dono, master ou parceiro) | leads, tasks, clientes, contracts, proposals, finance_*, marketing_*, dev_*, whatsapp/chat_* |
| Sem parceiro | `tenant_id = current_tenant_id() OR is_super_admin()` | education_content, empresa_filiais, finance_categories, finance_commission_entries, imobiliario_*, scheduled_exports |
| Só dono | `tenant_id = current_tenant_id()` | julia_interaction_log, lead_commercial_memory |
| Escrita restrita | `is_tenant_admin_or_master()` | cargos, squads (CR1) |
| Módulo/cargo | `user_has_module_access()` | clínica, educação (CR3) |
| Global-ou-tenant | `has_tenant_access OR tenant_id IS NULL` | app_settings, nichos |
| Por usuário | `auth.uid() = user_id` | user_settings |
| Plataforma | escrita só `is_super_admin()` | partners, tenant_partners |
| Deny-all | 0 policies; só service role | tenant_integrations, julia_round_robin_state |
| Sem grant de tokens | `authenticated` lê só colunas não sensíveis; tokens só via service role | google_calendar_connections (`20260904`/`20260905_*_hardening`) |
| `anon` INSERT-only | `tenant_id` fixo do formulário | leads, tasks, lead_commercial_memory, julia_interaction_log |
| Acesso anônimo por RPC | `SECURITY DEFINER` sem grant de tabela | proposals/proposal_items, imóveis, corretores, catálogo |

Ressalvas: o documento base foi verificado em 2026-09-03; as migrations de 09-04 a 09-24 acrescentaram tabelas e policies — reconferir com `get_advisors` e com o teste SQL (§17) antes de confiar.

### 19.3 Segredos

- `VITE_*` é público: apenas URL e anon key do Supabase (e `VITE_GOOGLE_CLIENT_ID`, público por natureza). **[Achado]** `VITE_GEMINI_API_KEY`/`VITE_GROQ_API_KEY` ainda existem e são usadas por `revenueIntelligence.ts`/pontos do front (D7); o backend aceita `VITE_GROQ_API_KEY` como fallback (`callGroq`).
- Service role só no backend (`supabaseService`), atrás de validação explícita de tenant na rota. `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_STATE_SECRET`, `WAHA_API_KEY`, `AURORA_WEBHOOK_URL` só no servidor.
- Segredos de conector externo (`external_integrations.secret_value`) ficam na tabela; o front só lê a view `external_integrations_safe` **[Não verificado]** que a view omita o campo (não lida neste levantamento).
- Chaves de API públicas: `SPY_API_KEYS` (`chave:tenantId`), guardadas só em env; log de uso mostra só 8 caracteres. Rotação exige redeploy.
- **[Achado]** `.env` real existe no diretório de trabalho (ignorado pelo git: `.env*` exceto `.env.example`); `SECURITY_AUDIT.md` registra chaves no histórico do Git ainda não rotacionadas.
- `STATE_SECRET` do OAuth com fallback previsível (14.3).

### 19.4 CORS e headers

- CORS na API: allowlist por env, `Vary: Origin`, sem credenciais de cookie (autenticação por Bearer). A Edge Function tem allowlist própria.
- `vercel.json` aplica a todas as rotas: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security: max-age=63072000; includeSubDomains`. **Ausentes**: `Content-Security-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`. Em dev (`dev-server.ts`) não há esses headers.
- `X-Frame-Options: DENY` impede embutir o CRM em iframe (inclusive páginas públicas de proposta/catálogo).

### 19.5 Uploads e conteúdo de usuário

- Uploads vão direto do navegador para o Storage (`avatars`, `proposals`, `products`, `finance`), com limite de tamanho e MIME por bucket (exceto observação em 15.5) e escrita restrita à pasta do tenant. Leitura pública por URL (quem tem o link acessa; nomes de arquivo são previsíveis se o padrão do path for — **[Não verificado]** o padrão de nome usado nos componentes).
- `POST /api/ai/solar-analyze-fatura` valida MIME (JPEG/PNG/WebP) e tamanho (~4 MB) no servidor.
- Corpo JSON até 5 MB em toda a API.
- Conteúdo de proposta (`conteudo_texto`) é HTML/texto renderizado nas páginas públicas — **[Não verificado]** se há sanitização no `PropostaPublica` (há `dompurify` no bundle, chunk `purify.es`, mas o uso não foi rastreado).

### 19.6 Riscos abertos priorizados (novos + herdados)

| Prioridade | Risco | Origem |
|---|---|---|
| Alta | `resolveTenantId` do Google Calendar aceita qualquer `x-active-tenant-id` | 14.2 |
| Alta | SSRF autenticado: `/api/integrations/webhook-test` (URL arbitrária), `smtp-test` (host/porta arbitrários) e gateways; sem allowlist nem bloqueio de IPs privados | `server.ts` 4357, 4518 |
| Alta | `POST /api/public-proposal/:token/accept` sem checagem de status/validade e sem rate limit | 14.2 |
| Média | Cache Redis por tenant serve dado protegido por RLS de módulo a outro usuário | 14.2 |
| Média | `/api/auth/tenant-theme` sem limite, com enumeração | 14.2 |
| Média | Sem CSP; chaves de IA no bundle (`VITE_*`); RBAC raso nas rotas de IA | §8 |
| Média | `permission-check-log` sem `requireMaster` | 14.2 |
| Baixa | Segredo de webhook em query string comparado com `!==` | 14.2 |
| Baixa | `PATCH` ausente do CORS; `state` do OAuth com fallback fixo | 14.1/14.3 |

---

## 20. Guia de contribuição técnico

### 20.1 Rodar local

```bash
npm install
cp .env.example .env        # preencher no mínimo VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run dev                 # tsx dev-server.ts → http://localhost:3002 (Express + Vite)
npm run lint                # tsc --noEmit
npm run build               # vite build + esbuild do server.ts → dist/server.cjs
npm start                   # roda dist/server.cjs (testa o artefato de produção)
```
Sem `SUPABASE_SERVICE_ROLE_KEY` as rotas `/api/v1/*`, `/api/admin/*` e `/api/integrations/external*` respondem `503`. Sem `REDIS_URL` tudo funciona sem cache. Sem `WAHA_API_URL` o WhatsApp usa o simulador. Node 20 (igual ao CI).

### 20.2 CI local equivalente

```bash
npm ci && npm run lint && npm audit --audit-level=high && npm run build
```

### 20.3 Como criar uma tabela nova (checklist)

1. Migration `supabase/migrations/AAAAMMDD_<descricao>.sql` (idempotente: `if not exists`).
2. `tenant_id uuid not null references public.tenants(id) on delete cascade` (exceção só documentada).
3. `alter table … enable row level security;` **e** policy — uma policy sem `ENABLE ROW LEVEL SECURITY` é decorativa (já aconteceu).
4. Índices: `(tenant_id, created_at desc)` e os de filtro real; FKs indexadas.
5. `revoke truncate` (default privileges já revogados em `20260906_revoke_truncate_default_privileges`, mas conferir).
6. Se precisar de `anon`: **nunca** `USING (true)`; usar RPC `SECURITY DEFINER` com validação no corpo.
7. Se tiver `updated_at`: trigger `set_updated_at()`. Evitar enviar `updated_at` do cliente (o `createCrudHelper` o remove).
8. Se for realtime: adicionar à publicação (`alter publication supabase_realtime add table …`) **na própria migration** (hoje isso não está versionado).
9. Aplicar → `get_advisors` (security e performance) → `SET ROLE authenticated` + claims de dois tenants → atualizar `docs/DATABASE.md`/`DATABASE_SECURITY.md` e, se houver tipo, `src/types.ts`.
10. Adicionar caso em `supabase/tests/tenant_isolation_test.sql`.

Modelo:
```sql
create table if not exists public.minha_tabela (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  filial_id uuid references public.empresa_filiais(id) on delete set null,  -- só se a tabela for por filial
  nome text not null,
  dados jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.minha_tabela enable row level security;

create policy tenant_isolation on public.minha_tabela
  for all
  using (public.has_tenant_access(tenant_id))
  with check (public.has_tenant_access(tenant_id));

create index if not exists idx_minha_tabela_tenant_created
  on public.minha_tabela (tenant_id, created_at desc);

create trigger minha_tabela_updated_at
  before update on public.minha_tabela
  for each row execute function public.set_updated_at();

-- se a tela usar realtime:
-- alter publication supabase_realtime add table public.minha_tabela;
```
(Variante com escrita só para admin: usar `public.is_tenant_admin_or_master()` no `with check`, como em `cargos`/`squads`.)

### 20.4 Rota nova em `server.ts`

1. Escolher o middleware **antes** de escrever: `requireUser` (padrão), `requireApiKey` (integração), `requireMaster`/`requireTenantAdmin` (admin) ou nenhum (só se pública de verdade — então exija rate limit e token não adivinhável).
2. Client: `req.supabase` (RLS) por padrão; `supabaseService` **somente** com `tenant_id` derivado do servidor (chave de API, `resolveRequestedTenantId`, linha da própria instância), nunca do body.
3. Se aceitar `?tenantId`, use `resolveRequestedTenantId(req, res)` e `if (!tenantId) return;`.
4. Validar entrada (obrigatórios, tipos, tamanho, allowlists) e responder `400`; erros de banco → `console.error("[rota] …")` + mensagem genérica (`500`).
5. Rate limit: registrar o prefixo em `app.use(...)` junto dos limiters (linhas 254-261).
6. Cache Redis só em GET de agregados; chave `<rota>:tenant:<id>:…` e **considerar permissões por usuário** (14.2).
7. CORS: se usar novo header/método, incluí-lo na lista (linhas 220-234).
8. Documentar em `docs/API.md` (e nesta §14) e adicionar teste `supertest`.

### 20.5 Tela nova

1. Criar `src/pages/<módulo>/<Nome>.tsx` + `use<Nome>.ts` (estado/queries) + `components/` se passar de ~300 linhas (arquivos > 1.000 linhas já são dívida — D8).
2. Registrar a rota em `src/App.tsx` (idealmente com `React.lazy`) e o item em `components/layout/navData.ts`; se o módulo é opcional, proteger com `isModuleEnabled` no menu **e** `ProtectedRoute requireModule` na rota, e garantir a RLS equivalente.
3. Dados: preferir consulta paginada própria (padrão `useLeadsList`) a inflar o `DataContext`; usar `friendlyError` em toasts; tratar loading/empty/erro (`ui/skeleton`, `ui/empty-state`, `ErrorBoundary compact`).
4. Nunca confiar em UI para restringir acesso (§6.8).

### 20.6 Entidade nova no `DataContext`

1. Tipo em `DataContextTypes.ts` (e `types.ts` se de domínio); `useState` (raw + `filterByFilial` se por filial).
2. Carga: adicionar job em `jobs` (usar `fetchAllRowsForTenant`; `cachedFetchAllRowsForTenant` só para catálogos que mudam pouco) **ou** `ensureNicheModulesLoaded` se for de módulo opcional; limpar o estado (e flags) no bloco de reset de troca de tenant; aplicar `if (cancelled) return`.
3. Realtime: `applyRealtimeUpsert` (alto volume, mapeador idêntico ao da carga) ou `debouncedRefetch`; a tabela precisa estar publicada.
4. Escrita: `createCrudHelper('<tabela>', setX, filialAware)`; expor `add/update/delete` no value do provider; se precisar de rollback em `update`/`add`, implementar explicitamente (o helper não faz).
5. Se houver preview cacheado, incluir a tabela em `GENERIC_PREVIEW_TABLES` (`server.ts` linha 1972) e no efeito de preview.
6. Se depender de outra entidade em reconciliação, exigir a flag de "carregado" (padrão `contractsLoaded`).

### 20.7 Definition of Done (por PR)

- [ ] `npm run lint` e `npm run build` sem erro; `npm audit --audit-level=high` sem falha.
- [ ] Testes novos/atualizados para regra financeira, reconciliação ou rota alterada (§17); teste de isolamento se tocou RLS.
- [ ] Migration idempotente com `tenant_id` + RLS + índice; `get_advisors` sem novo alerta; `docs/DATABASE*.md` atualizados.
- [ ] Nenhum segredo em `VITE_*`; nenhum `service_role` fora de rota validada; nenhuma rota que grava sem middleware.
- [ ] Erros do usuário passam por `friendlyError`; nenhum `error.message` cru em toast/resposta.
- [ ] Estados de loading/vazio/erro; funciona com filial ativa e após troca de tenant (sem dado do tenant anterior).
- [ ] Sem lógica específica de cliente (a plataforma é genérica; personalização via configuração/`type_attributes`).
- [ ] Docs tocadas: `docs/API.md` (rota), este TRD (regra/ADR), `docs/TROUBLESHOOTING.md` (se corrigiu bug recorrente).
- [ ] Verificado manualmente em pelo menos 2 tenants e com um usuário não-admin.

---

## 21. ADRs (registros curtos de decisão)

### ADR-1 — Acesso direto ao Supabase pelo navegador, com RLS como autoridade
- **Contexto:** CRM multi-tenant com dezenas de módulos e prazo curto; escrever uma API REST para cada entidade dobraria o trabalho. O Supabase já expõe PostgREST + Auth + Realtime.
- **Decisão:** o SPA usa `@supabase/supabase-js` com anon key + JWT do usuário; o isolamento vive em policies (`has_tenant_access`). Filtros no front (`tenant_id = activeTenantId`, filial) existem só para UX de contas master/parceiro.
- **Consequências:** (+) velocidade de entrega, realtime nativo, menos código de servidor. (−) regra de negócio espalhada no cliente (reconciliações no `DataContext`), sem transações entre tabelas, RLS vira ponto único de falha (por isso testes SQL e `get_advisors`), custo de RLS por linha (incidente 2026-09-20), estado inteiro carregado no navegador (§18). Exige tratar como inseguro qualquer checagem só de UI.

### ADR-2 — Backend fino (`server.ts`) apenas para o que o navegador não pode fazer
- **Contexto:** segredos de IA, `service_role`, API pública por chave, OAuth do Google, webhooks de entrada e agregações pesadas não podem ficar no cliente.
- **Decisão:** um Express único servido como função serverless (`api/index.ts`); `requireUser` cria um client escopado por JWT (RLS continua valendo); `service_role` só atrás de validação explícita de tenant; Redis opcional como cache "fail open".
- **Consequências:** (+) deploy simples (1 função), segurança consistente por padrão (`req.supabase`). (−) arquivo com ~4,6 mil linhas, estado em memória perdido no cold start (settings), rate limit em memória por instância, rotas longas sujeitas ao timeout da plataforma, e tendência a acumular regra específica de cliente (§14.2). Meta: extrair rotas para módulos em `server/` conforme crescem (já feito para Google Calendar/WhatsApp/Redis).

### ADR-3 — Atributos de produto em JSONB (`products.type_attributes`)
- **Contexto:** o catálogo atende nichos diferentes (serviço, assinatura, digital, imóvel, curso, físico) com campos distintos; colunas por nicho gerariam tabelas esparsas e migrações constantes.
- **Decisão:** campos comuns em colunas; campos condicionais por tipo em `type_attributes jsonb`. Colunas usadas em cálculo/relatório (`is_recurring`, `recurring_period`, `implementation_fee`) são **duplicadas** como colunas reais e sincronizadas pelo `createCrudHelper` (lista `allowed`). `mapProductRow` desempacota para propriedades de primeira classe (`contractMonths`, `hasLoyalty`).
- **Consequências:** (+) novos atributos sem migration; formulário condicional por tipo. (−) sem validação de schema no banco, duas fontes para o mesmo fato (JSON × coluna) que podem divergir, consultas/índices em JSON são mais caros, e a lista `allowed` precisa ser mantida à mão. Mitigar: validação (zod) no formulário, CHECK/`jsonb_typeof` quando o atributo virar regra, e promover a coluna quando entrar em relatório.

### ADR-4 — `saleCalculator` como fonte central do cálculo de venda
- **Contexto:** o mesmo cálculo (recorrência × parcelamento × desconto × implantação) existia copiado em modais e telas do Financeiro; uma cópia multiplicava o preço pelos ciclos numa cobrança única (bug real, auditoria de 2026-09-23).
- **Decisão:** `src/lib/saleCalculator.ts` é uma função **pura** (`calculateSale`) que devolve valores por cobrança e o cronograma; recorrência nunca é multiplicada em uma cobrança; parcelas absorvem centavos; datas usam `addMonthsClamped`. Métricas agregadas seguem o mesmo princípio em `revenueMetrics.ts`.
- **Consequências:** (+) regra testável isoladamente (§17) e única. (−) hoje só o `AddProdutoLeadModal` chama `calculateSale`; os demais reaproveitam só helpers de data/parcela, e a regra de MRR pós-aceite vive em `syncAcceptedProposal` (dupla fonte). Critério de aceite (§11): toda regra financeira nova passa por função pura com teste. Ainda sem testes automatizados (D9).

### ADR-5 — Carrinho multi-produto: 1 proposta, N itens, lançamentos por item
- **Contexto:** o fluxo antigo criava uma proposta por produto; adicionar um produto novo "escondia" o anterior (a aba Produtos mostrava só a proposta mais recente).
- **Decisão:** `AddProdutoLeadModal` monta todos os itens e chama `createProposalWithItems` uma vez: 1 proposta, N `proposal_items` (mais um item `one_time` por taxa de implantação), `leads.value` = soma de todas as propostas do lead (`sumProposalsValueForLead`), contrato e lançamentos gerados no aceite por `syncAcceptedProposal` (idempotente por `proposal_id`).
- **Consequências:** (+) histórico coerente, valor do lead determinístico e idempotente. (−) sem transação (proposta/itens/lead gravados em chamadas separadas; falha parcial deixa resíduo), `ProductsSection` ainda mostra só a proposta mais recente (D6), aceitação recalcula desconto proporcional (`discountRatio`) porque `proposal_items` não guarda desconto.

### ADR-6 — Convenção `quantidade = ciclos × unidades` em itens recorrentes (com plano de saída)
- **Contexto:** `proposal_items` só tinha `quantidade` e `preco_unitario`; para que "preço × quantidade" desse o total do período (usado por MRR, desconto proporcional e por `valor` da proposta), itens recorrentes passaram a gravar `quantidade = numberOfCycles × unidades` (`AddProdutoLeadModal.tsx` linha 320); a exibição compensa.
- **Decisão (vigente):** manter a convenção; MRR = (Σ `preco_unitario × quantidade` dos itens recorrentes × `discountRatio`) ÷ `contract_months` (`syncAcceptedProposal`).
- **Consequências:** (−) `quantidade` deixa de significar unidades; relatórios de volume e o trigger `baixar_estoque_proposta_aceita` leem o número "inflado"; itens **sem prazo** (`contract_months = null`) usam 12 ciclos como lote e, se o produto não tiver `contractMonths`, o MRR é calculado sem divisão (**[Achado]** possível superestimativa do MRR, inferida da leitura de `syncAcceptedProposal`/`AddProdutoLeadModal`; não reproduzida); `frequency` já foi adicionada (`20260923_proposal_items_frequency`) mas o MRR ainda divide por meses de contrato.
- **Plano de saída (D1):** (1) migration: `proposal_items.cycles int` (nullable) e backfill `cycles = quantidade / unidades` onde `billing_type = 'recurring'` e `contract_months`/`frequency` permitem inferir, guardando `quantidade` real; (2) escrita dupla (novo formato + convenção antiga) por uma release, com teste de equivalência sobre `calculateSale`; (3) trocar leitura em `syncAcceptedProposal` (MRR = `preco_unitario × quantidade` por ciclo ÷ meses do ciclo) e na exibição; (4) ajustar/atestar o trigger de estoque; (5) remover a compensação de exibição e a escrita antiga; (6) teste e2e de aceite (§17) como rede de segurança antes de cada passo.

### ADR-7 (proposto) — Manter a plataforma genérica
- **Contexto:** a memória do projeto define o S.P.Y. como produto genérico (~80/20); há vestígios de cliente específico em `/api/v1/*` (`tnp_live_`, `tnp_fat_`, sincronização de reservas) e `PLUPPEX_TENANT_ID` no front.
- **Decisão proposta:** integrações específicas viram configuração (mapeamento por chave de API/`tenant_integrations`) ou conectores externos, não código no core.
- **Consequências:** (+) menor acoplamento; (−) trabalho de refatoração e migração dos clientes existentes. Status: **proposto**, não implementado.
