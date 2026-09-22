# Auditoria SPY — Dev + Segurança, usando o tenant "Nicolas" como ambiente de teste

**Data:** 2026-09-21
**Autor:** Claude (Sonnet 5), a pedido do Gustavo
**Escopo:** todas as páginas, módulos e funções do S.P.Y. (frontend `src/`, backend `server.ts`, banco Supabase/Postgres `snwkzvgompfgqoqbpihe` — "Axis / Pluppex")
**Metodologia:** leitura de código (read-only, nada foi alterado no código), consultas `SELECT` ao vivo no Supabase, simulação de sessões autenticadas via `set local role authenticated` + `request.jwt.claim.sub` para testar RLS na prática, e populamento de dados de teste no tenant "Nicolas" para exercitar os módulos com dados reais. Nenhuma senha, chave ou dado de produção real foi exposto ou alterado.

---

## Ambiente de teste usado

**Tenant:** "Nicolas" — `dc97bab8-ce68-4400-b534-6f2c9c4e6922`, status Active, plano `autopilot`.
Admin: `marketingnicollasrocha@gmail.com` (`ee184f8f-757a-4fdf-ae78-7f7da8f06d40`), `is_tenant_admin=true`, `is_master=false`.
Módulos ligados: `bi, rh, crm, dev, radar, solar, aurora, closer, varejo, clinica, catalogo, educacao, marketing, financeiro, engajamento, imobiliaria, produtividade, concessionaria` — praticamente toda a plataforma, o que o torna o melhor tenant existente hoje para testar todos os módulos de uma vez.

> Havia dois tenants chamados "Nicolas" no banco: **"Nicolas Rocha"** (`6efff13b-...`, status **Inactive**) e **"Nicolas"** (`dc97bab8-...`, status **Active**, quase todos os módulos ligados). Usei o segundo — se a intenção era o primeiro, avise que refaço o seed lá.

### Dados de teste inseridos (52 tabelas, todas com `tenant_id` correto)

- **Catálogo:** 4 produtos espelhando o catálogo real da Pluppex (Tráfego Pago Mensal, Licença S.P.Y Fundador, Criação de Landing Page, Método E+), com `tenant_id` preenchido corretamente (ver Achado M-5, que documenta o oposto acontecendo no catálogo real da Pluppex).
- **CRM:** 1 funil comercial (10 etapas, cópia da estrutura da Pluppex), 3 leads (um em cada estágio: Novo, Follow-Up, Ganho), 2 clientes (um deles criado **automaticamente por trigger** ao marcar um lead como "Ganho" — achado positivo, ver seção "O que está OK"), 1 proposta com 2 itens, 1 contrato.
- **RH:** 2 colaboradores, 2 cargos (`Closer`→módulo `crm`, `Financeiro`→módulo `financeiro`), 1 squad.
- **Financeiro:** 2 categorias, 1 conta bancária, 2 lançamentos (1 receita paga, 1 despesa a vencer).
- **Clínica:** 1 profissional, 2 serviços, 2 pacientes, 1 prontuário, 1 plano de tratamento, 2 itens de estoque, 1 pedido de exame, 1 agendamento (`appointments`).
- **Educação:** 1 turma, 2 alunos, 2 mensalidades, 1 certificado.
- **Imobiliário:** 1 corretor, 2 imóveis, 1 proprietário, 1 captação, 1 visita, 1 empreendimento, 1 comissão.
- **Automotivo/Concessionária:** 2 veículos, 1 avaliação.
- **Varejo:** 1 fornecedor, 1 venda com 2 itens, 1 movimentação de estoque, 1 pedido, 1 compra, 1 operação de caixa.
- **Solar:** 1 projeto, 1 vistoria, 1 instalação, 1 homologação, 1 manutenção, 1 análise de fatura.
- **Marketing:** 1 campanha, 1 conteúdo, 1 landing page, 1 automação.
- **Produtividade/Agenda:** 2 tarefas, 1 reunião.

Confirmei ao vivo, simulando a sessão do admin do Nicolas (`set local role authenticated` + `request.jwt.claim.sub`), que **o isolamento por tenant (RLS) está correto**: ele enxerga exatamente os próprios registros em todas as tabelas testadas (`products`, `leads`, `crm_funis`, `pacientes`, `solar_projetos`, `imobiliario_imoveis`, `vendas`, `colaboradores`, `finance_entries`, `turmas`) e nada de outros tenants (Pluppex tem 4.436+ leads, 3.949 lançamentos financeiros — nenhum vazou para a consulta do Nicolas).

---

## Resumo executivo

| Severidade | Qtd |
|---|---|
| 🔴 Crítico | 3 |
| 🟠 Alto | 8 |
| 🟡 Médio | 8 |
| 🟢 Baixo | 6 |

O achado mais importante da rodada: **o controle de acesso por cargo/módulo do S.P.Y. não depende de nenhuma falha de configuração — é contornável pela interface normal do produto, em poucos cliques, por qualquer usuário autenticado.** Isso é qualitativamente pior do que "RBAC só no frontend" (já documentado na auditoria anterior, `SECURITY_AUDIT.md`): aqui, a própria tela que define os cargos/permissões, e a tabela que liga/desliga módulos pagos do tenant, não têm nenhuma segunda camada de defesa.

---

## 🔴 CRÍTICO

### CR1 — Qualquer colaborador pode se autoconceder acesso a qualquer módulo (Financeiro, RH, BI...) só usando a tela normal de "Perfis & Permissões"

**Onde:** `src/pages/settings/sections/empresa/ConfigEmpresaPermissoes.tsx` → `DataContext.tsx:2224` (`cargoCrud`) → `update()` genérico (`DataContext.tsx:2080-2118`), um `supabase.from('cargos').update(...)` simples.

Nem a rota (`App.tsx`, só `<ProtectedRoute>` genérico), nem o `SettingsLayout.tsx` (só filtra o item "Módulos & SaaS"), nem o componente, nem a RLS de `cargos` (`has_tenant_access(tenant_id)` — só checa tenant, não cargo/admin) impedem isso.

**Exploração:** um SDR sem acesso a Financeiro abre Configurações → Perfis & Permissões → edita o próprio cargo → marca "Financeiro" → salva. Isso **anula** a trigger `log_module_permission_check` que bloqueia escrita em `leads`/`finance_entries`/`colaboradores`/`pacientes`/`turmas` fora do módulo do cargo: o usuário simplesmente libera o módulo negado para si mesmo.

**Correção:** gate de rota (`requireTenantAdmin`) em `/app/configuracoes/empresa/permissoes` e `/cargos`; e mudar a RLS de `cargos`/`squads` para exigir `is_tenant_admin` ou `is_master`, não só `has_tenant_access`.

### CR2 — Qualquer usuário autenticado do tenant pode ligar módulos pagos da própria empresa direto no banco (bypass de paywall)

**Onde:** `src/lib/supabase.ts:669-684` (`updateTenantModulesInDB`). A policy `tenant_update` em `tenants` (`is_own_tenant_or_super_admin`) autoriza qualquer usuário cujo `tenant_id` bata com o alvo — **não** checa `is_tenant_admin`.

**Exploração:** com o client Supabase já carregado na página (anon key pública), qualquer colaborador roda no console:
```js
supabase.from('tenants').update({ modules: { crm:true, financeiro:true, clinica:true, bi:true, ... } }).eq('id', '<próprio tenant_id>')
```
e libera todos os módulos da plataforma de graça, sem passar pelo `/app/admin` (master-only) nem por billing. (A tela viva que hoje faria isso via UI, `ConfigModulosDemos.tsx`, está importada mas nunca roteada — código morto, mas o vetor via chamada direta à tabela continua 100% aberto.)

**Correção:** restringir `tenant_update` para exigir `is_master`, ou mover `modules`/`plan` para uma tabela/policy separada que só o operador da plataforma possa escrever.

### CR3 — Prontuário médico (PHI) e histórico do paciente legíveis por qualquer colaborador do tenant, sem checagem de módulo em leitura

**Onde:** `src/pages/clinica/Prontuarios.tsx:104-152`; rota `/app/clinicas/prontuarios` (`App.tsx:419,436`) sem gate; `Sidebar.tsx:44-57` só esconde o link do menu, não bloqueia a URL.

Esta é a manifestação mais grave de um problema estrutural que confirmei ao vivo: a trigger `log_module_permission_check` (que de fato bloqueia escrita indevida por cargo) está ligada em **só 5 tabelas no sistema inteiro** — `leads`(crm), `finance_entries`(financeiro), `colaboradores`(rh), `pacientes`(clinica), `turmas`(educacao) — e **nunca em `SELECT`**, só em INSERT/UPDATE/DELETE. Tabelas irmãs do mesmo módulo não têm nenhuma trava: `prontuarios`, `clinica_servicos`, `clinica_planos_tratamento`, `clinica_profissionais`, `estoque_items`, `exames_pedidos` (clínica); `students`, `certificates`, `mensalidades` (educação); `cargos`, `squads` (RH). A RLS dessas tabelas é só `has_tenant_access(tenant_id)` — sem noção de cargo/módulo.

**Exploração:** um vendedor de imobiliário do tenant, cujo cargo não inclui "Clínica", digita a URL `/app/clinicas/prontuarios` e lê queixa, diagnóstico, prescrição e histórico de qualquer paciente do tenant. Achado equivalente e também explorável para dados financeiros de aluno: `/app/educacao/mensalidades` (`Mensalidades.tsx:31-52`) — qualquer um vê inadimplência de qualquer aluno.

**Correção:** (1) checagem de módulo do cargo em `ProtectedRoute` (ou wrapper específico) para `/app/clinicas/*` e `/app/educacao/*`; (2) estender a trigger de permissão para também validar em `SELECT` (ou usar uma view com `security_barrier` + checagem), pelo menos nas tabelas com dado sensível de paciente/aluno.

---

## 🟠 ALTO

### A1 — Bloqueio de período financeiro é só decoração no frontend, sem trigger no banco
`DataContext.tsx:2276-2299` (`checkFinanceEntryLock`). Não existe trigger/constraint em `finance_entries` que impeça UPDATE/DELETE de um lançamento "fechado". Combinado com CR1 (liberar módulo financeiro para si) e A2 abaixo, o fechamento de período é inteiramente cosmético.
**Correção:** mover a checagem para um trigger `BEFORE UPDATE OR DELETE` em `finance_entries`.

### A2 — Telas que configuram o próprio RBAC (Cargos, Permissões, Bloqueio de Período, Auditoria Financeira, Squads) não têm nenhum gate de papel
`ConfigEmpresaCargos.tsx`, `ConfigEmpresaPermissoes.tsx`, `SettingsFinanceiroGovernanca.tsx`, `SettingsProdutividade.tsx`, `ConfigEmpresaEquipe.tsx` — nenhuma checa `isMaster`/`isTenantAdmin`. `SettingsLayout.tsx` só filtra o item "Módulos & SaaS" do menu; o resto aparece para qualquer cargo. Pior que "só esconder botão" (já documentado como C3 na auditoria anterior): aqui é a própria configuração do controle de acesso que fica aberta — vira escalonamento de privilégio (ver CR1).
**Correção:** `requireTenantAdmin` como guarda de rota em todo `empresa/*` e `financeiro/{squads,bloqueio-periodo,auditoria}`.

### A3 — Painel `/app/admin`: "MRR Global" não é global, mostra só o tenant ativo do master
`AdminSaaS.tsx:79-95` → `DataContext.tsx:1038` (`fetchAllRowsForTenant`, só tenant ativo). A tabela de assinaturas por tenant logo abaixo já foi corrigida para agregar por `tenant_id`, mas os cards de topo ("MRR Ativo", ARPU, LTV) e o "MRR Global" da Visão Geral continuam usando a fonte antiga — correção parcial. Números incorretos no próprio painel do operador da plataforma.
**Correção:** usar a mesma agregação por `tenant_id` (ou `platform_metrics_overview()`) nos cards de topo.

### A4 — Módulo "Dev & Engenharia" tem RLS habilitada sem nenhuma policy — inacessível até para master, e é uma bomba-relógio
`useDevProjects.ts:44-57` nunca filtra por tenant nem preenche `tenant_id` nos inserts (linha 175 chega a mandar `tenant_id: null`). As 4 tabelas (`dev_projects`, `dev_sprint_tasks`, `dev_issues`, `dev_environments`) têm RLS ligada e **zero policies** — Postgres nega tudo por padrão, inclusive para `is_master`. Confirmei ao vivo: `dev_sprint_tasks` tem 80 linhas reais no banco, mas a sessão do Nicolas (e qualquer sessão de usuário) vê `count = 0`. Se algum dia alguém adicionar uma policy RLS ingênua sem antes corrigir o frontend, todos os tenants com o módulo `dev` habilitado passam a ver o mesmo pool global de projetos de todo mundo.
**Correção:** corrigir o frontend para sempre filtrar/preencher `tenant_id` **antes** de adicionar qualquer policy.

### A5 — Botão "Aceitar Proposta" na página pública não salva nada — aceite fantasma
`src/pages/public/PropostaPublica.tsx:122-132`. `handleAcceptProposal` só faz `setTimeout` + muda estado local; nunca chama `acceptPublicProposal()` (já existe em `src/lib/publicProposal.ts:75-93`, que chama a rota real `POST /api/public-proposal/:token/accept`). O cliente vê "Proposta Aceita com Sucesso!", mas no CRM o status nunca muda de "Enviada"; se a página recarregar, o aceite desaparece — não foi salvo em lugar nenhum.
**Correção:** trocar o corpo da função para de fato chamar `acceptPublicProposal(token, {...})`.

### A6 — Estoque e Exames da Clínica ignoram o tenant ativo — mistura de dados entre tenants para contas master/parceiro
`src/pages/clinica/hooks/useEstoque.ts:41-64` e `useExames.ts:35-57` fazem `select('*')` sem `.eq('tenant_id', ...)` — únicos 2 arquivos do módulo inteiro com esse padrão (todo o resto filtra corretamente). RLS ainda restringe por tenant para usuário comum, mas para uma conta master/parceira com acesso a múltiplos tenants (via `tenant_partners` — hoje a própria Pluppex tem esse acesso a Nicolas, To Na Pista e Casa São Paulo Sports), a lista vem com itens de estoque/exames de **todos os tenants acessíveis, misturados**. Pior: o INSERT também não envia `tenant_id`, caindo no `current_tenant_id()` do usuário logado — criar um item "no tenant que está sendo visualizado" na verdade cria no tenant do próprio usuário.
**Correção:** replicar o padrão do resto do módulo — `.eq('tenant_id', activeTenantId)` no select, `tenant_id: activeTenantId` explícito no insert.

### A7 — Movimentação de estoque do Varejo com o mesmo padrão do A6
`src/pages/varejo/Estoque.tsx:69-81` — mesma falta de `.eq("tenant_id", ...)` (variável `tenantId` já existe no componente e não é usada). Mesmo impacto: mistura de movimentações de estoque entre tenants para master/parceiro.

### A8 — `/app/imobiliario/comissoes` sem qualquer gate de papel
`App.tsx:335` → `ImobiliarioComissoes.tsx` — ver, criar, editar e excluir comissões/splits entre corretor e imobiliária, acessível por qualquer usuário autenticado do tenant, sem checagem de cargo nenhuma (nem client-side).

---

## 🟡 MÉDIO

### M1 — "E-EMPREENDA+" (produto específico da Pluppex) aparece como item nativo em 3 telas genéricas de Marketing, para todo tenant
`MarketingFormularios.tsx:14-49` injeta incondicionalmente um formulário "Oficial E-EMPREENDA+" (não pode ser excluído) na lista de qualquer tenant; `MarketingLandingPages.tsx:351-397` mostra um card fixo "E-EMPREENDA+ (Oficial)" sem condição de tenant; ambos levam a telas que, para qualquer tenant que não seja a Pluppex, mostram 0 dados (RLS bloqueia) ou falham silenciosamente ao salvar. Viola a diretriz já registrada de que o S.P.Y. deve ficar genérico (~80/20), sem customização visível para todo mundo em torno de um cliente específico.
**Correção:** condicionar a exibição a um registro real por tenant, não a um fallback incondicional no código genérico.

### M2 — Faturamento Clínico mistura receita de todos os módulos do tenant
`Faturamento.tsx:47,55` + `server.ts:1330-1339` somam `finance_entries` só por `type='Receber'`, sem filtrar categoria/origem. Num tenant multi-nicho como o Nicolas (todos os módulos ligados), a receita de imóvel/veículo/projeto solar entra na mesma soma do "faturamento clínico", distorcendo o Ticket Médio por Consulta.

### M3 — `varejo_pedidos.id` gerado por dois esquemas incompatíveis, sem UUID
`PedidosVarejo.tsx:96` (`PED-${pedidos.length+9822}`) e `Vendas.tsx:750` (`PED-${9820+random(500)}`) — faixas se sobrepõem, nenhum usa UUID (a auditoria anterior já recomendou isso — M6). Risco de colisão de PK com dois operadores simultâneos, falhando com erro genérico.

### M4 — Estorno de venda no PDV sem trava contra duplo clique
`Vendas.tsx:788-837` — `UPDATE` sem `.eq("status","paga")` de guarda e sem desabilitar o botão durante a chamada assíncrona. Dois cliques (ou duas abas) devolvem estoque em dobro para uma única venda estornada.

### M5 — Produtos com `tenant_id NULL` ficam invisíveis para qualquer usuário não-master (achado por mim, ao vivo)
No catálogo real da Pluppex existem 2 produtos (`Método E+`, `Site Institucional`) com `tenant_id = NULL` (usam só o campo legado `tenantName`). A RLS (`has_tenant_access`) só retorna `true` para `tenant_id NULL` quando o usuário é `is_master` — para qualquer colaborador comum da própria Pluppex (ex.: SDR, Closer, `is_master=false`), esses 2 produtos **nunca aparecem** no catálogo. No seed do Nicolas eu já usei `tenant_id` correto (não repeti o bug).
**Correção:** popular `tenant_id` nesses 2 registros (`UPDATE products SET tenant_id = '27ef95ee-...' WHERE tenant_id IS NULL`).

### M6 — Dropdown de "planos de licença" ao criar tenant novo está quebrado para qualquer um que não seja master da Pluppex (achado por mim, confirmado ao vivo)
`fetchSpyLicenseProducts()` (`src/lib/supabase.ts:428`, usada em `NovoTenantModal.tsx`) lê `products` filtrando `tenant_id = PLUPPEX_TENANT_ID` (hardcoded). Simulei a sessão do admin do Nicolas: a query retorna **vazia** (RLS bloqueia — não há relação de `tenant_partners` na direção necessária). Ou seja, o dropdown de planos no modal "Novo Tenant" só funciona para master da própria Pluppex; para qualquer outro admin que eventualmente acesse essa tela (lembrando que `/app/admin` hoje é `requireMaster`, então o impacto prático é baixo, mas o código está objetivamente quebrado para o caso geral).

### M7 — `GRANT`s de `anon` em `tenants` muito além do necessário (mitigado por RLS, mas frágil)
`anon` tem `INSERT`/`UPDATE` de nível de coluna em quase toda `tenants`, incluindo `modules`/`plan`/`webhook_url`. Neutralizado hoje porque não há policy de INSERT/UPDATE para `anon` — mas é o mesmo padrão "duas camadas dependendo de uma" que já causou o achado C4 da auditoria anterior.
**Correção:** `REVOKE INSERT, UPDATE, DELETE ... FROM anon` em `tenants`, como defesa em profundidade.

### M8 — Status de Compra pode virar "Recebido no Estoque" sem dar entrada real no estoque
`ComprasVarejo.tsx:150-317` — o `<select>` genérico de status permite pular direto para "Recebido", sem passar pela RPC `registrar_movimentacao_estoque`. Fica marcado como recebido, mas o saldo de estoque nunca é incrementado.

---

## 🟢 BAIXO

- **`get_public_imovel` não filtra corretor por `status='Ativo'`** (`20260906_public_imovel.sql:36-40`) — corretor desligado continua com telefone/e-mail expostos em anúncios antigos.
- **Vínculo imóvel↔corretor por nome livre (texto), não FK** — nomes duplicados/diferentes fazem a página pública não mostrar contato do corretor certo.
- **`imobiliario/Corretores.tsx`**: `vendasMes / meta` gera `NaN%` na barra de progresso se `meta = 0` (o formulário permite) — só visual, não trava a tela.
- **`ReuniaoRoom.tsx:247-257`**: associa o projeto de Dev criado pela Aurora à reunião só por `created_at > startedAt` + `limit(1)`, sem FK — condição de corrida rara pode baixar o PDF errado.
- **`ConfigModulosDemos.tsx`**: componente morto (importado, nunca roteado) que replica a lógica de escrita direta em `tenants.modules` do CR2 — sugiro remover.
- **`npm audit`**: 3 vulnerabilidades moderadas (DoS via `qs`, transitiva de `express`/`body-parser`), baixo risco prático — corrigir com `npm audit fix` quando for conveniente.

---

## ✅ O que está OK (verificado ao vivo, não só assumido)

- **Isolamento multi-tenant (RLS)** correto em todas as ~30 tabelas testadas ao vivo com a sessão simulada do Nicolas — nenhum dado de Pluppex/To Na Pista/G-Tech vazou.
- **`/app/admin` e `/app/parceiros`** já corrigidos desde a auditoria anterior: `ProtectedRoute requireMaster`/`requirePartner` (`App.tsx:522-523`) realmente bloqueia, não só esconde link (era o achado C1/C3 do `SECURITY_AUDIT.md`).
- **Sessão "demo" via `sessionStorage`** não é mais aceita sem sessão real do Supabase Auth (`AuthContext.tsx:145-157`) — corrigia o A7 antigo.
- **Bug "Total de Ganhos usava preço de catálogo"** (mencionado no próprio git log) confirmado corrigido em `usePipeline.ts:205-222`, `useDashboard.ts:162-177`, `PipelineKanbanBoard.tsx:84-96`.
- **Paginação de 1000 linhas do PostgREST** corrigida (`fetchAllRowsPaginated`, `server.ts:383-400`).
- **Rotas públicas** `/imovel/:id`, `/corretor/:slug`, `/catalogo/:tenantId`: todas usam RPC `SECURITY DEFINER` que nunca expõe custo/margem/proprietário/comissão, e testei com `set local role anon` que as tabelas reais estão fechadas para acesso direto.
- **Endpoint OCR de fatura solar** (`/api/ai/solar-analyze-fatura`): `requireUser`, allowlist de mimetype, limite de ~4MB, rate limit de 20 req/min, chave Gemini nunca exposta ao cliente.
- **Checkout do PDV**: RPC `finalizar_venda` (`SECURITY DEFINER`, `FOR UPDATE`) — atômico.
- **`resolveRequestedTenantId`** (`server.ts:353-371`): todo endpoint que aceita `?tenantId=` explícito revalida via `has_tenant_access` antes de usar — sem IDOR.
- **`view_token`** de propostas públicas: 192 bits, enumeração inviável.
- Nenhum crash/`NaN`/`.reduce` sem valor inicial encontrado nos dashboards revisados ao rodar com o dataset zerado que o Nicolas tinha antes do seed.
- Nenhum outro UUID/nome de tenant hardcoded além dos 2 já conhecidos (`src/lib/supabase.ts:410`, `src/pages/marketing/EEmpreendaEditor.tsx:14`).

---

## Status das correções (atualizado em 2026-09-21, mesma sessão)

Todos os achados abaixo foram corrigidos nesta sessão, exceto onde indicado. **As migrações SQL foram escritas em `supabase/migrations/` mas NÃO aplicadas ao banco** — o modo automático desta sessão bloqueia deploys em produção por classificador (`[Production Deploy]`), então elas precisam ser revisadas e aplicadas manualmente (`supabase db push`, ou colando o SQL no SQL Editor do Supabase, projeto `snwkzvgompfgqoqbpihe`). O `npx tsc --noEmit` passa limpo depois de todas as mudanças de código.

| Achado | Status | Onde |
|---|---|---|
| CR1 — auto-escalonamento via Cargos/Permissões | ✅ Corrigido (código + migração pendente de aplicar) | `ProtectedRoute.tsx` (`requireTenantAdmin`), `App.tsx` (rotas `empresa/permissoes`, `empresa/cargos`, `empresa/equipe`, `financeiro/squads`, `financeiro/bloqueio-periodo`, `financeiro/auditoria`), `migrations/20260921_cr1_*.sql` |
| CR2 — bypass de paywall via `tenants.modules` | ✅ Corrigido (migração pendente de aplicar) | `migrations/20260921_cr2_*.sql` (trigger bloqueia mudança de `modules`/`plan` por quem não é master) |
| CR3 — prontuário/mensalidade sem gate de módulo | ✅ Corrigido (código + migração pendente de aplicar) | `ProtectedRoute.tsx` (`requireModule`), rotas `clinicas/prontuarios` (+ alias legado) e `educacao/mensalidades`, `migrations/20260921_cr3_*.sql` (RLS por módulo em 12 tabelas + triggers de escrita amigáveis nas tabelas-irmãs) |
| A1 — bloqueio de período só no frontend | ✅ Corrigido (migração pendente de aplicar) | `migrations/20260921_a1_*.sql` |
| A2 — telas de RBAC sem gate | ✅ Corrigido | mesmas rotas do CR1 acima |
| A3 — MRR Global errado no `/app/admin` | ✅ Corrigido | `AdminSaaS.tsx` |
| A4 — módulo Dev sem tenant scoping / RLS quebrada | ✅ Corrigido (código + migração pendente de aplicar) | `src/pages/dev/hooks/{useDevProjects,useDevIssues,useAmbientes,useDevSprints}.ts`, `migrations/20260921_a4_*.sql` |
| A5 — aceite de proposta pública fantasma | ✅ Corrigido | `PropostaPublica.tsx` |
| A6 — Estoque/Exames da Clínica sem tenant | ✅ Corrigido | `src/pages/clinica/hooks/{useEstoque,useExames}.ts` |
| A7 — Movimentação de estoque do Varejo sem tenant | ✅ Corrigido | `src/pages/varejo/Estoque.tsx` |
| A8 — `/app/imobiliario/comissoes` sem gate | ✅ Corrigido | `App.tsx` |
| M1 — E-EMPREENDA+ aparecendo pra todo tenant | ✅ Corrigido | `MarketingFormularios.tsx`, `MarketingLandingPages.tsx`, `PLUPPEX_TENANT_ID` exportado de `lib/supabase.ts` |
| M2 — Faturamento Clínico mistura receita de todos os módulos | ⚠️ **Não corrigido de propósito** | Não existe hoje nenhuma coluna/tag de origem/módulo em `finance_entries` — nenhuma chamada em todo o módulo clínica sequer cria lançamento financeiro vinculado a atendimento. Um heurístico por texto de categoria seria frágil e poderia distorcer número financeiro real, o que é pior que deixar documentado. Precisa de uma decisão de produto (ex.: coluna `origem_modulo` em `finance_entries`, populada em todo ponto de criação de receita/despesa de cada vertical) antes de corrigir com segurança. |
| M3 — IDs de `varejo_pedidos` colidíveis | ✅ Corrigido | `PedidosVarejo.tsx`, `Vendas.tsx` (agora usa `crypto.randomUUID()`) |
| M4 — Estorno de venda sem trava de duplo clique | ✅ Corrigido | `Vendas.tsx` |
| M5 — Produtos com `tenant_id NULL` invisíveis | ✅ Corrigido (migração pendente de aplicar) | `migrations/20260921_fixes_m5_m7_*.sql` |
| M6 — dropdown de planos de licença quebrado pra não-master | ℹ️ Impacto real é baixo hoje (a única tela que chama `fetchSpyLicenseProducts()`, `NovoTenantModal.tsx`, já está atrás de `/app/admin` com `requireMaster` — todo usuário que chega lá já é master, e `is_master` sempre dá acesso independente do tenant). Não fiz mudança de código; deixo registrado como fragilidade (depende de coincidência entre duas checagens em vez de uma garantia direta), não como bug ativo. |
| M7 — `GRANT` de `anon` em `tenants` além do necessário | ✅ Corrigido (migração pendente de aplicar) | `migrations/20260921_fixes_m5_m7_*.sql` |
| M8 — Compra podia "receber" sem entrada real no estoque | ✅ Corrigido | `ComprasVarejo.tsx` (opção desabilitada no `<select>` genérico) |
| Baixo — `get_public_imovel` não filtrava corretor ativo | ✅ Corrigido (migração pendente de aplicar) | `migrations/20260921_fixes_m5_m7_*.sql` |
| Baixo — vínculo imóvel↔corretor por texto livre | ✅ Corrigido | `Imoveis.tsx` (agora sugere nomes reais via `datalist`, mantendo o campo flexível) |
| Baixo — `NaN%` na barra de progresso de corretores | ✅ Corrigido | `Corretores.tsx` |
| Baixo — heurística frágil de projeto Dev ↔ reunião | ⚠️ **Não corrigido** — exigiria adicionar uma coluna de vínculo real (`lead_id`/`reuniao_id`) em `dev_projects`, mudança de schema fora do escopo desta rodada dado o baixo risco prático (janela de corrida pequena, ação manual de baixar PDF). | `src/pages/reunioes/ReuniaoRoom.tsx:247-257` |
| ME1 — `ConfigModulosDemos.tsx` código morto | ✅ Removido | arquivo deletado, import removido de `App.tsx` |
| ME2 — `npm audit` (3 moderadas, `qs`) | ✅ Corrigido | `npm audit fix` (0 vulnerabilidades agora) |
| **Novo, a pedido do usuário:** Financeiro precisava permitir lançar Notas Fiscais | ✅ Implementado | `GenericFinanceiroList.tsx`: campo "Nº da Nota Fiscal" (`numero_documento`) no lançamento (criação e edição), exibido na lista; aba "Nota Fiscal / Anexos" (já existia como `FinanceiroAnexosTab.tsx`/`finance_attachments`, só não estava rotulada nem descoberta — permite anexar o PDF/XML da nota depois de salvar o lançamento) |

## Auditoria visual/UX (pensando como cliente, não como dev) — 2026-09-21

Rodada adicional a pedido do usuário: revisão do frontend do ponto de vista de um dono de pequena empresa usando o produto no dia a dia, não de um desenvolvedor lendo código.

### Corrigido nesta sessão
- **Seta vermelha falsa nos KPIs do Dashboard**: `trend`/`forecast` sem valor real chegavam como `"--"`, e a lógica `startsWith('+')` tratava isso como "queda" — todo cliente via uma seta vermelha ao lado do próprio indicador principal, mesmo com receita real positiva. Corrigido em `QuickStatsGrid.tsx` (sem trend real, mostra só um traço neutro).
- **Nome de pessoa real como fallback de perfil**: `Topbar.tsx` caía para `"Gustavo Portilho"`/`"S.P.Y. Corp"` se os dados do usuário/tenant não tivessem carregado ainda. Trocado por `"Usuário"`/`"Minha Empresa"`.
- **Selo "Sistema Operacional 100%" fixo e falso** na sidebar (nunca calculado de verdade): removido — melhor não mostrar nada do que fingir um status.
- **`alert()` nativo do navegador** no botão "Notifique-me do Lançamento" (`GenericPlaceholder.tsx`), que também não gravava a "inscrição" em lugar nenhum: botão removido.
- **Ícones inconsistentes no card de Lead do CRM** (glifos Unicode `▲ ⏳ ◈ ◆` misturados com `lucide-react`): trocados pelos ícones do mesmo sistema (`TrendingUp`, `Clock`, `UserCheck`, `Layers`).
- **"Supabase não configurado" vazando nome de fornecedor interno pro cliente** em mensagens de erro: substituído por "Não foi possível conectar ao servidor." em **28 ocorrências, 9 arquivos** (`src/lib/supabase.ts` e as páginas que usam esse texto de fallback).

### Sinalizado, não corrigido nesta sessão (exige decisão de produto ou verificação visual em navegador — não tenho como ver o resultado renderizado)
- **Marca "S.P.Y." aparecendo pro cliente final** (login, landing, títulos de página, rodapés — ~80 ocorrências) em vez de "Pluppex" ou da marca white-label de cada tenant: precisa de uma decisão explícita de qual nome vai pro cliente antes de trocar em massa.
- **Menu lateral carrega todo fechado** a cada login (nenhuma seção abre automaticamente, nem a do item atual) — fix é simples (abrir a seção da rota ativa), mas mexe em estado de navegação em todo o app; melhor validar visualmente antes de aplicar.
- **Tela de Login 100% dark/glassmorphism** enquanto o resto do app é claro por padrão — a pior hora possível pra uma quebra de identidade visual (primeira impressão), mas redesenho de tela visual sem conseguir ver o resultado renderizado é arriscado às cegas.
- **Card de Lead do Kanban sobrecarregado** (10+ elementos coloridos competindo por atenção): mover informação secundária pro modal de detalhes já existente é a correção certa, mas é cirurgia de layout que merece revisão visual, não só de código.
- **Estados vazios sem o componente `EmptyState`** fora de CRM/Varejo (Financeiro, Clínica, Imobiliário mostram só uma linha de texto cru): mecânico de aplicar, mas são ~6 arquivos e cada um precisa de um ícone/ação apropriados ao contexto — melhor numa rodada dedicada.
- **~77 lugares** ainda interpolam `error.message` bruto do Supabase direto em toasts (jargão de banco de dados pro cliente final) — corrigi só a instância mais grave (nome de fornecedor vazado); um mapeador central de erros comuns (RLS/unique/FK) pra mensagem amigável ainda precisa ser criado e aplicado nos ~77 pontos.
- Menu de Configurações com jargão técnico ("Webhooks Globais", "Conectores Externos (ERP/CRM)"), tipografia sem hierarquia real (`--font-mono` = Arial), filtros do Financeiro todos visíveis de uma vez — detalhes completos na seção de achados 🟡/🟢 abaixo.

### Achados completos do agente (texto original, para referência)

**🔴 Impacto alto:** seta de tendência falsa no dashboard (corrigido); menu lateral fechado por padrão; erros técnicos crus em toasts (parcialmente corrigido); card de lead sobrecarregado; nome hardcoded no topbar (corrigido); marca "S.P.Y." em telas de cliente; tema do Login destoante do resto do app; `EmptyState` não usado fora de CRM/Varejo.

**🟡 Médio:** selo de sistema "100%" falso (corrigido); `alert()` nativo (corrigido); jargão técnico no menu de Configurações; ícones Unicode misturados com lucide (corrigido); CSS com "compat shim" de +250 linhas para cores hardcoded (dívida técnica de migração de tema incompleta); sufixo " S.P.Y." redundante em títulos de página; tipografia sem fonte mono/display real; fonte reduzida a 87.5% + badges de 8-9px; Financeiro com 7 filtros sempre visíveis.

**🟢 Baixo:** `NaN%` na barra de progresso de corretores (já corrigido na rodada de segurança); painel de notificações do Topbar sem `EmptyState`; pill de marca mobile fixo em "S.P.Y." em vez da cor do tenant; "Júlia" citada sem contexto no menu; `ConfigModulosDemos.tsx` como peso morto de UI (já removido).

**O que já está bom:** `EmptyState` bem desenhado (só falta cobertura); `confirmDialog` centralizado evitando popups nativos espalhados; padrão de tabela responsiva (desktop + cards mobile) consistente; microcopy explicando por que um campo está travado; sistema de tokens de cor via CSS vars bem arquitetado; formulários de cadastro consistentes entre módulos verticais diferentes; Command Palette (Cmd+K) amenizando a navegação.

## Rodada de limpeza visual adicional — 2026-09-21 (mesmo dia)

A pedido do usuário ("deixe mais limpo as páginas, campos e cards"), com verificação visual real (login temporário via API admin do Supabase, sem tocar senha de ninguém; screenshots via Playwright; sessão e scripts descartados ao final):

- **Estados vazios padronizados** com o componente `EmptyState` (ícone + título + descrição + ação) em Financeiro (`GenericFinanceiroList.tsx`, desktop e mobile), Clínica (`Pacientes.tsx`, `Prontuarios.tsx`) e Imobiliário (`Imoveis.tsx`) — antes eram só uma linha de texto cru. Confirmado visualmente (busca sem resultado) em Imóveis e Financeiro.
- **Painel de notificações do Topbar** também padronizado com `EmptyState`.
- **Pill de marca mobile** no Topbar não usa mais "S.P.Y." fixo — mostra o nome real do tenant, mesmo fallback já usado no Sidebar.
- **Menu de Configurações**: 5 itens com jargão técnico reescritos liderando com o benefício ("Prazos de atendimento (SLA)", "Conectar outros sistemas (ERP/CRM)", etc.).
- **Filtros do Financeiro**: Conta Bancária/Centro de Custo/período agora ficam atrás de um botão "Mais filtros" — só Busca/Categoria/Status sempre visíveis. Confirmado visualmente.
- **Mapeador central de erros** (`src/lib/friendlyError.ts`) criado e aplicado em **89 ocorrências, 26 arquivos** — todo `toast.error` que antes interpolava `error.message` bruto do Supabase/Postgres agora mostra uma mensagem em português simples (permissão, duplicidade, campo obrigatório, conexão, sessão expirada), com fallback genérico pra qualquer erro não mapeado.
- **Card de lead do CRM**: uma tentativa de remover badges secundários (origem/reservas/squad/tags/produto) foi revertida a pedido do usuário — o card ficou como estava antes desta rodada (só com o fix de ícones lucide já aplicado ontem).

Confirmado ao vivo (Dashboard, CRM/Pipeline, Financeiro, Configurações, Clínica, Imobiliário): zero erros de console em todas as navegações, sidebar abrindo a seção certa automaticamente (fix de ontem seguindo correto).

Segue em aberto (mesmo motivo de ontem — decisão de produto ou redesenho visual maior): marca "S.P.Y." vs "Pluppex"/marca do tenant, tema do Login, e a densidade do card de lead do CRM (explicitamente mantida como está, a pedido do usuário).

## Modal de Detalhes do Lead — revisão adicional (mesmo dia)

Usuário perguntou especificamente sobre o modal de detalhes do lead (aberto ao clicar num card do Kanban). Abri de verdade (mesmo método de sessão temporária) e passei por todas as 8 abas.

### 🔴 Achado sério, corrigido: aba "Chat" simulava uma conversa real que nunca aconteceu
`MessagingSection.tsx` tinha uma conversa fake **hardcoded** no estado inicial (mensagens de "cliente" e "IA" com timestamp, como se já tivessem sido trocadas), e o botão de enviar só empilhava texto no estado local — nenhuma chamada real de WhatsApp/e-mail/Instagram acontecia. Pior: mostrava `toast.success("Mensagem disparada via WHATSAPP")` e, 1 segundo depois, injetava sozinha uma resposta fake de IA sugerindo agendar uma demo. Um vendedor podia genuinamente achar que contatou o lead e recebeu resposta, quando nada foi enviado — risco real de um follow-up nunca acontecer porque "already looked like it happened". Confirmei que não existe nenhuma integração real de chat conectada a nenhuma tela do app hoje (as tabelas `chat_messages`/`whatsapp_instances` existem no banco mas não são usadas em lugar nenhum do frontend). **Corrigido**: removida a conversa falsa e o "envio" fake; o botão agora copia a mensagem de verdade pra área de transferência, com um aviso claro de que o envio direto ainda não está conectado.

### 🟡 Achado corrigido: "Autor" da nota mostrava pedaço do e-mail em vez do nome
`NotasSection.tsx` buscava o nome de quem está anotando via `supabase.auth.getSession()` → `user_metadata.name/full_name` — campos que este app nunca preenche — caindo direto no fallback seguinte: o texto antes do "@" do e-mail (ex.: "Autor: marketingnicollasrocha" em vez de "Admin Nicolas"). O nome de verdade já está disponível via `useAuth().user.name` (mesma fonte usada em "Vendedor Responsável" na aba Informações, que sempre mostrou certo). **Corrigido** e confirmado visualmente.

### 🟢 Achado corrigido: tarefas mostrando "High"/"To Do" em inglês
Não era um bug do app — era um artefato dos meus próprios dados de teste (inseridos via SQL usando o valor padrão da coluna no banco, que é em inglês). O formulário real de "Nova Tarefa" sempre grava em português (`"A Fazer"`, `"Alta"`). Corrigi os 2 registros de teste que eu mesmo tinha inserido. Fica como nota: o *default* da coluna no banco (`'To Do'`/`'Medium'`) está dessincronizado do que a aplicação realmente escreve — baixo risco prático (só afetaria um insert que não especifique esses campos), não é algo que precisei mexer no schema pra resolver agora.

### Resto do modal: sem problemas encontrados
Abas Informações, Tarefas, Histórico, Produtos, Logs e Relatório IA renderizaram corretamente, com bons estados vazios já usando o padrão certo, zero erros de console. A aba "Relatório IA" é um gerador de script/sugestão (não afirma que algo já aconteceu, então não tem o mesmo problema de honestidade do Chat) — não mexi nela. A marca "S.P.Y." aparece de novo aqui dentro (ex.: "Recomendação S.P.Y. Copilot") — mesmo item já registrado como pendente de decisão de marca, não é novo.

## Recomendação de prioridade

1. **CR1 + CR2 + A2** (esta semana): sem essas três correções, o modelo de permissões e o modelo de monetização por módulo do S.P.Y. não existem de fato — qualquer cliente pode contornar os dois pela UI normal.
2. **CR3 + A6 + A7**: dado sensível (prontuário médico, mensalidade de aluno) legível sem controle nenhum — LGPD.
3. **A1, A3, A4, A5**: bugs de confiabilidade/funcionalidade com impacto direto em dinheiro (financeiro, MRR do painel, aceite de proposta) ou em risco futuro (módulo Dev).
4. Médios/Baixos: agendar como débito técnico normal.
