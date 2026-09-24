# 04 — UI/UX Design

> Versão 2.0 · 2026-09-24 · Tudo aqui foi verificado no código: `src/index.css`, `src/App.tsx`, `src/components/**`, `src/pages/**`, `src/contexts/**`, `src/lib/**`. Onde algo **não** foi confirmado, o texto diz "não verificado". Contagens (ex.: "236 arquivos") são de `grep` em `src/` na data acima e servem de ordem de grandeza.

## Índice

1. Princípios
2. Design tokens completos (`src/index.css`)
3. Tema claro/escuro e cor de marca
4. Navegação real (Layout, Sidebar, Topbar, MobileNav, atalhos)
5. Inventário de telas (rotas → arquivo)
6. Catálogo de componentes (`src/components/ui`)
7. Padrões de tela
8. Wireframes ASCII das telas-chave
9. Estados de UI (vazio, carregando, erro, sem permissão, módulo desabilitado, offline)
10. Formulários, validação, tabelas, toast e confirmação
11. Ícones, animações e responsividade
12. Acessibilidade — estado atual e problemas encontrados
13. Guia de conteúdo (microcopy pt-BR)
14. Débito de UI consolidado
15. Checklist de revisão de UI para PRs

---

## 1. Princípios

1. **Densidade útil.** CRM/ERP é ferramenta de trabalho diário: informação compacta, poucos cliques, sem decoração.
2. **Um fluxo, uma tela.** Fechar venda, editar produto e editar cliente acontecem em modais/drawers focados, sem sair do contexto.
3. **Estado sempre visível.** Status em badges de cor semântica; valores monetários em `font-mono font-bold` e alinhados à direita (nota: a família mono é a mesma sans, ver §2.3).
4. **O sistema explica, não esconde.** Opção indisponível aparece **desabilitada com motivo** (ex.: Fidelidade sem recorrência) em vez de sumir. Exceção real: itens de menu de módulos desabilitados **somem** (ver §4.3).
5. **Português do Brasil**, moeda `R$`, datas `dd/mm/aaaa`, sem inventar dado (localização ausente = "Não informado"; ver `Clientes.tsx`, que não usa mais "São Paulo" como padrão).
6. **Ação destrutiva pede confirmação** via `confirmDialog` (71 chamadas), com texto do que será perdido. Exceções conhecidas: `useProdutoForm.ts` ainda usa `confirm()` nativo (§14).

---

## 2. Design tokens completos (`src/index.css`)

O arquivo começa com `@import "tailwindcss";` (Tailwind 4, sem `tailwind.config`) e declara tokens em `@theme`, `:root` e `html.dark`.

### 2.1 Cores (`@theme`)

| Token | Claro (padrão) | Escuro (`html.dark`) | Uso |
|---|---|---|---|
| `--color-primary-blue` | `#2563EB` | = | Ação primária, seleção, links. **Sobrescrito em runtime pela cor do tenant** (§3.2) |
| `--color-tech-cyan` | `#06B6D4` | = | Destaque secundário |
| `--color-accent` | `var(--color-tech-cyan)` | = | Nome formal do destaque secundário |
| `--color-success` | `#10B981` | = | Pago, ativo, margem positiva |
| `--color-warning` | `#F59E0B` | = | Em implantação, atenção, fidelidade |
| `--color-danger` | `#F43F5E` | = | Excluir, atrasado, erro |
| `--color-destructive` | `var(--color-danger)` | = | Alias (o `Badge` usa a variante `destructive`) |
| `--color-info` | `#3B82F6` | = | Informativo |
| `--color-surface` | `#F8FAFC` | `#0B1120` | Fundo de página |
| `--color-surface-elevated` | `#FFFFFF` | `#1E293B` | Cards, painéis, modais, toasts |
| `--color-surface-sunken` | `#F1F5F9` | `#111827` | Inputs, cabeçalhos de tabela, áreas recuadas |
| `--color-border-default` | `#E2E8F0` | `rgba(255,255,255,.10)` | Bordas |
| `--color-border-subtle` | `#F1F5F9` | `rgba(255,255,255,.05)` | Divisores |
| `--color-text-primary` | `#0F172A` | `#F8FAFC` | Texto principal |
| `--color-text-muted` | `#64748B` | `#94A3B8` | Texto secundário |
| `--color-text-faint` | `#94A3B8` | `#64748B` | Texto terciário/placeholder |

Aliases legados (ainda usados em vários arquivos): `--color-dark-bg` → `--color-surface`; `--color-premium-black` → `--color-surface-elevated`; `--color-white-text` → `--color-text-primary`.

Como `success/warning/danger/info/accent` estão em `@theme`, o Tailwind gera utilitários (`bg-success/10`, `text-danger`, `border-accent/25`) — é o que `Button`, `Badge` e `Alert` usam. **Não há override escuro** para esses semânticos: o mesmo hex vale nos dois temas.

Comentário no CSS: "Regra 60-30-10" (60% fundo, 30% superfícies/bordas, 10% destaque).

### 2.2 Forma e elevação (`:root` / `html.dark`)

| Token | Valor | Uso |
|---|---|---|
| `--radius-control` | `0.625rem` | Inputs, botões, badges |
| `--radius-panel` | `1rem` | Cards, toasts |
| `--radius-panel-lg` | `1.5rem` | Modais, bottom-sheet mobile |
| `--shadow-control` | claro `0 1px 2px 0 rgba(2,6,23,.06)` · escuro `... rgba(0,0,0,.3)` | Botões, aba ativa |
| `--shadow-panel` | claro `0 8px 24px -6px rgba(2,6,23,.10)` · escuro `... rgba(0,0,0,.45)` | Cards, toasts, dropdown mobile |

Os tokens de raio/sombra **não** substituem a escala nativa do Tailwind (`rounded-xl` etc.); só primitivos migrados usam `rounded-[var(--radius-control)]`. O resto da base usa `rounded-lg/xl/2xl/3xl` direto (ex.: coluna do Kanban `rounded-3xl`).

### 2.3 Tipografia

`--font-sans`, `--font-display` e `--font-mono` apontam **todos** para `Arial, "Helvetica Neue", Helvetica, ui-sans-serif, system-ui, sans-serif`. Logo `font-mono` e `font-display` não mudam a fonte, só o peso/estilo aplicado. Hierarquia por peso e caixa:

- Rótulo: `text-[10px] uppercase font-black tracking-widest` (ou `tracking-wider`).
- Corpo: `text-xs` a `text-sm` (`Input`/`Select`/`Button default` usam `text-sm`; `Button sm` usa `text-xs`).
- Título de página: `text-2xl md:text-3xl font-black tracking-tight` (`PageContainer`).
- Título de modal: `text-base font-black tracking-tight` (`Modal`).
- Micro-texto: `text-[9px]`/`text-[8px]` (496 ocorrências de `text-[8px]`/`text-[9px]` — ver §12).

**Escala de `rem`** (`@layer base`): `html { font-size: 87.5% }` (1rem = 14px); `@media (min-width:1536px)` → `93.75%`; `@media (min-width:1920px)` → `100%`. Ou seja, todo `rem`/`text-sm` do Tailwind é ~12,5% menor que o padrão nos monitores comuns.

### 2.4 Base (`@layer base`)

- `html, body`: `bg-[var(--color-surface)]`, `text-[var(--color-text-primary)]`, `antialiased`, `scroll-smooth`, `font-family: var(--font-sans)`.
- Scrollbar WebKit fina: 5px, trilho transparente, polegar `rgba(156,163,175,.2)` (hover `.4`); no claro forçada para `rgba(15,23,42,.1/.2)`.
- Utilitário `scrollbar-thin` / `scrollbar-none` é usado nas classes (ex.: `Sidebar`, `Topbar`), mas **não** está definido em `index.css` — não verificado se vem de plugin; tratar como possível no-op.

### 2.5 Utilitários customizados (`@layer utilities` e classes globais)

| Classe | O que faz |
|---|---|
| `.bg-grid-white` | Fundo em grade SVG branca (landing) |
| `.text-glow` | `text-shadow` azul |
| `.glass-card` | `bg-[var(--color-premium-black)]/30`, borda `slate-700/40`, `backdrop-blur-3xl` |
| `.noise-overlay` | Ruído SVG com máscara radial, `fixed inset-0 opacity-[.03] z-[100]` |
| `.animate-gradient-x` | Gradiente animado 15s (`@keyframes gradient-x`) |
| `.animate-in` + `.fade-in`/`.fade-in-0`, `.zoom-in`/`.zoom-in-95`, `.slide-in-from-top`/`-top-2`/`-top-4`, `.slide-in-from-bottom`/`-bottom-2`, `.slide-in-from-left-10`, `.slide-in-from-right-10` | Substituto próprio do `tailwindcss-animate` (o plugin **não** está instalado, comentário no CSS). Usa `@keyframes axis-enter` com as variáveis `--axis-enter-opacity/-x/-y/-scale`. Duração padrão 150ms, easing `cubic-bezier(.16,1,.3,1)` |
| `.duration-150/200/300/350/400/500/700/1000` | Definem `animation-duration` (convivem com o `duration-*` nativo do Tailwind, que define `transition-duration`) |
| `.logo-container`, `.logo-image-container`, `.sidebar-logo-header` | Tratamento da logo (blend `screen` no escuro; `multiply` + inversão no claro; pulso no hover) |
| `.btn-primary`, `.btn-outline`, `.btn-ghost`, `.btn-success`, `.btn-danger` | Botões "legados" por classe. O componente `Button` é o caminho preferido |
| `.etapa-card-placeholder`, `.etapa-toggle-off` | Cartão/toggle de etapa nas configurações de funil (variantes claro/escuro) |
| `.selecao-ativa` | Item selecionado com borda esquerda azul e brilho (`#3b82f6`); força `color:#fff !important` — **quebra no tema claro** |
| `.animate-slide-in-robot`, `.animate-float-smooth`, `.animate-neon-pulse`, `.animate-wave-arm`, `.animate-eye-blink`, `.animate-particle-float`, `.animate-energy-trail`, `.interactive-robot` | Biblioteca do robô animado (landing/Aurora) |

### 2.6 Keyframes definidos

`gradient-x`, `axis-enter`, `logo-pulse`, `slow-pan`, `orbit`, `workflow-pulse` (ponto percorrendo conectores do diagrama de automação na landing), `slideInRobot`, `floatSmooth`, `neonPulse`, `waveArm`, `eyeBlink`, `particleFloat`, `energyTrail`.

### 2.7 "Light mode compat shim"

Bloco grande (~350 linhas) marcado no CSS como "transitional bridge". Toda regra começa com `html:not(.dark)` e **reescreve com `!important`** classes que foram escritas pensando em fundo escuro: `bg-[#0B1120]`, `bg-[#111827]`, `bg-[#1E293B]`, `bg-slate-800/900/950`, `border-white/*`, `text-slate-200..500`, `text-white`, `text-slate-100`, além de famílias de cor (`text-emerald-*`, `text-blue-*`, `text-cyan-*`, `text-amber-*`, `text-rose-*`/`red-*`, `purple`, `indigo`, `violet`, `orange`, `sky`, `pink`, `yellow`, `green`) e suas versões `bg-*/10` e `hover:`. Também força `input/select/textarea` a fundo branco e borda `#CBD5E1`, e mantém texto branco em botões de fundo sólido (`bg-[#2563EB]`, `bg-blue-600`, `bg-emerald-600` etc.).

Consequências práticas para quem escreve UI:
- Usar `text-white` num fundo que **não** seja sólido de marca no tema claro vira texto quase preto (`#0F172A`). Por isso os botões usam `!text-white`.
- Qualquer `input/select/textarea` no tema claro ignora seu fundo/borda (fica branco). Estilos customizados de campo só valem no escuro.
- Preferir os tokens (`var(--color-*)`) evita depender do shim; o objetivo declarado é podá-lo quando os arquivos forem migrados.

---

## 3. Tema claro/escuro e cor de marca

### 3.1 Como o tema é aplicado (verificado)

- **Mecanismo: classe `dark` em `<html>`** (`html.dark { ... }` em `index.css`). **Não existe** `data-theme` nem `@media (prefers-color-scheme)` no CSS — a afirmação da versão 1.0 deste documento estava incorreta.
- `DataContext.tsx`: estado `theme: 'dark' | 'light'`, **inicia em `'light'`**; lê `user.preferences.theme` (só aceita `'dark'`/`'light'`); `toggleTheme()` alterna e grava com `updatePreferences({ theme })`; um `useEffect` adiciona/remove `dark` em `document.documentElement`.
- **Botão de tema** no `Topbar` (ícone `Sun` quando escuro / `Moon` quando claro, `title="Alternar Tema (Light/Dark)"`).
- **Preferências → Sistema** (`pages/settings/sections/usuario/ConfigPreferenciasSistema.tsx`): oferece `light | dark | system`. `applyTheme("system")` lê `window.matchMedia("(prefers-color-scheme: dark)")` **uma única vez** (não escuta mudanças) e, ao persistir, `updatePreferences` grava `"dark"` no lugar de `"system"` (`theme: updated.theme === "system" ? "dark" : updated.theme`). O padrão local de `prefs.theme` é `"dark"`, enquanto o `DataContext` começa em `"light"`.
- Toasts (`sonner`) recebem `theme={theme}`.
- `PropostaPublica.tsx` alterna a classe `dark` localmente (`isDarkMode`) e restaura o estado anterior ao sair.
- `index.html`: `<meta name="theme-color" content="#0B1120">` fixo (não muda com o tema) e `<html lang="pt-BR" translate="no">`. `LocalizationContext` atualiza `document.documentElement.lang` conforme o idioma (`pt-BR`, `en-US`, `es-ES`; `t()` devolve o texto original em pt-BR e usa `lib/i18n/translations.ts` nos demais).

### 3.2 Cor de marca por tenant

- `lib/theme.ts`: `BRAND_COLORS` = Verde `#4ADE80`, Azul `#2563EB`, Roxo `#7C3AED`, Laranja `#F97316`; `DEFAULT_BRAND_COLOR` = **o primeiro (verde `#4ADE80`)**.
- `applyThemeColor(hex)` faz `document.documentElement.style.setProperty("--color-primary-blue", hex)` (e `--primary`) e troca o favicon por um SVG com a cor. É chamado em `main.tsx` (padrão), no login (`useLoginTheme`, resolve o tenant pelo e-mail/query) e no `DataContext` (`tenants.primary_color` do tenant ativo).
- Portanto **a cor primária de todo o app muda por tenant** (botão primário, item ativo do menu, links) — não só documentos, como a v1.0 dizia. O azul `#2563EB` em `@theme` é apenas o valor de fallback do CSS.
- Quem pode trocar: `ConfigPreferenciasSistema` (`canEditBrandColor`, `handlePickBrandColor`, toast "Cor do tema atualizada.").
- Consequência de design: nunca hardcodar `#2563EB`/`bg-blue-600` para "ação primária" (68 usos de `bg-[#2563EB]` ainda existem, principalmente em `ProdutoModal` e afins) — eles ignoram a marca do tenant.

---

## 4. Navegação real

### 4.1 Estrutura de layout (`components/Layout.tsx`)

```
<div h-screen overflow-hidden flex>
  Sidebar                      (fixa; drawer abaixo de lg)
  <main flex-col>
    Topbar                     (h-16)
    <div scroll  p-4 md:p-8 pb-24 sm:pb-8>
      ErrorBoundary(resetKey = pathname)
        <Outlet/>              (cada tela usa PageContainer, ou SectionSidebar em Financeiro/Configurações)
  MobileNav                    (barra inferior, só < sm)
  AuroraWidget                 (só se isModuleEnabled("aurora"))
  OnboardingWizard
  Toaster (sonner, top-right, richColors, closeButton, tokens do tema)
```

- Em `/mensageria` e `/messaging` o contêiner usa `overflow-hidden p-1 pb-20 sm:p-2 sm:pb-2.5` (tela cheia sem padding).
- `Layout` redireciona para `/login` se não há `user` — o `useEffect` está **duplicado** (duas cópias idênticas); e `Layout` guarda `isSDRWebhookOpen` mas **nunca renderiza** `SDRWebhookModal` (ver §14).
- `App.tsx` monta `ConfirmDialogHost` só em rotas `/app*` e `/login*`; o `Toaster` do `/login` é montado em `App` (`bottom-right`), o das rotas `/app` é o do `Layout` (`top-right`).
- `PageContainer` (`components/PageContainer.tsx`): props `title`, `description` (ou `subtitle`), `actions`, `breadcrumb?: {label, path?}[]`. Sempre renderiza breadcrumb "Início › {título}" (ou o `breadcrumb` passado), `h1` com bolinha `animate-pulse` (decorativa, `hidden md:inline-block`) e ações em `flex-wrap`.

### 4.2 Menu principal (`components/layout/navData.ts` + `Sidebar.tsx`)

Sidebar: `lg:w-68` (expandida) / `lg:w-20` (recolhida); abaixo de `lg` vira drawer (`w-64`, `translate-x`) com backdrop `bg-black/60 backdrop-blur-sm`. Seções são **acordeões** (`ChevronDown`), começam fechadas exceto a da rota atual; navegar só **adiciona** a seção ativa aberta. Recolhida, todas as seções ficam abertas e os itens só mostram ícone (`title` = nome). Os textos passam por `t()`.

| Seção | `reqModule` (seção) | Itens (rótulo → rota) `reqModule` do item |
|---|---|---|
| Visão Geral | — | Dashboard Geral → `/app/dashboard` |
| CRM & Vendas | `crm` | Leads & Pipeline → `/app/crm/pipeline` · Propostas Comerciais → `/app/crm/propostas` · Base de Clientes → `/app/crm/clientes` |
| Agenda & Reuniões | — | Calendário Geral → `/app/agenda/calendario` (`agenda`) · Salas de Reunião → `/app/agenda/reunioes` (`agenda`) · Tarefas & Projetos → `/app/tarefas` (`produtividade`) |
| Gestão Financeira | `financeiro` | Financeiro → `/app/financeiro/dashboard` |
| Comunicação & Mkt | — | Mensageria Omnichannel → `/app/mensageria` (`engajamento`) · Automações → `/app/automacoes` (`engajamento`) · Campanhas de Mkt · Landing Pages · Formulários · Conteúdo & Social · Analytics de Mkt (`marketing`) |
| Operações & Catálogo | — | Catálogo de Produtos → `/app/produtos` (`catalogo`) |
| Inteligência & BI | `bi` | Performance SDR / IA → `/app/performance-ia` · CPM & Indicadores → `/app/indicadores` · Relatórios Executivos → `/app/relatorios` |
| Imobiliário | `imobiliaria` | Painel Imobiliário · Catálogo de Imóveis · Proprietários · Captações · Empreendimentos · Corretores · Visitas Agendadas |
| Energia Solar | `solar` | Painel Fotovoltaico · Projetos Solares · Vistorias Técnicas · Análise de Fatura & kWp · Instalações & Obras · Homologações · Manutenções & Pós-Venda |
| Automotivo | `automotivo` | Painel Concessionária · Estoque de Veículos · Captações · Avaliações de Usados · Consignações · Trocas & Repasses · Vendedores · Test-Drives Agendados |
| Varejo | `varejo` | Painel de Varejo · Frente de Caixa (PDV) · Controle de Estoque · Fornecedores · Pedidos de Compra |
| Clínica & Saúde | `clinica` | Painel Geral · Agenda Médica · Pacientes · Prontuários EHR · Telemedicina · Faturamento Clínico · Estoque de Insumos · Exames & Labs · BI Clínico |
| Educação & Cursos | `educacao` | Painel Educação · Turmas Ativas · Base de Alunos · Banco de Conteúdo · Certificados · Mensalidades |
| Dev & Engenharia | `dev` | Painel Dev · Projetos · Sprints · Issues & Bugs · Repositórios · Ambientes |
| Equipe & RH | `rh` | Colaboradores & RH → `/app/equipe` |
| Configurações | — | Configurações Gerais → `/app/configuracoes` · Central de Integrações → `/app/configuracoes/integracoes/apps` · **Webhooks SDR** (ação `sdr-webhooks`, abre `SDRWebhookModal`; `reqModule: crm`) |
| Administração Master | — | Painel SaaS & Infra → `/app/admin` (`reqCondition: master-only`) · Portal de Parceiros → `/app/parceiros` (`master-or-partner`) |

### 4.3 Regras de visibilidade (Sidebar e MobileNav usam o mesmo código, duplicado)

1. **Módulo do tenant**: `isModuleEnabled(mod)` (`AuthContext`) consulta os módulos do tenant **ativo** (`activeTenantName || user.tenantName`), inclusive para master. Sem tenant conhecido, o padrão é `{ crm: true, sdr: false, advDashboard: false }`.
2. **Aliases** em `checkModule`: `automotivo` ≡ `concessionaria`; `agenda` também vale se `crm` estiver ativo; `documentos` idem.
3. **Cargo**: se o cargo do usuário (`cargos.find(nome === user.role)`) tem `modulos` não vazio, o módulo também precisa estar nessa lista (`canAccessModule`). **Master ignora o cargo**, mas não ignora o módulo do tenant.
4. **`isMaster`**: `reqCondition: "master-only"`. **Parceiro**: `"master-or-partner"` = `isMaster || partnerId`.
5. Item sem `reqModule`/`reqCondition` aparece sempre (Dashboard Geral, seção Configurações, seção BI depende só da seção).
6. Seção sem nenhum item visível é omitida.
7. `isTenantAdmin` **não** afeta o menu principal. Ele afeta: seletor de filial (`isMaster || isTenantAdmin`), e rotas (ver §9.4). No menu de Configurações os itens Equipe, Cargos e Perfis & permissões aparecem para todos, mas a rota redireciona não-admins para `/app` (`ProtectedRoute requireTenantAdmin`).
8. Item ativo: `pathname === path` ou `startsWith(path)` (exceto `/app/dashboard` e `/app`). Efeito colateral: em `/app/configuracoes/integracoes/apps` **dois itens** ficam ativos ("Configurações Gerais" e "Central de Integrações"). Em `/app/financeiro/receber` nenhum item do menu principal fica ativo (só o `startsWith("/app/financeiro/dashboard")` casa com o dashboard).

### 4.4 Seletores de tenant e filial (topo da Sidebar, só expandida)

- **Tenant** (`Building2` + `<select>` nativo, `title="Trocar de cliente"`): visível se `(isMaster || partnerId) && tenantOptions.length > 1`. Caso contrário mostra só o nome (`activeTenantName || user.tenantName || "S.P.Y. Gestão Corporativa"`). Para parceiro, a lista já vem restrita por RLS (`tenant_partners`).
- **Filial** (`MapPin` + `<select>`, `title="Trocar de filial"`): `(isMaster || isTenantAdmin) && empresaFiliais.length > 0`; primeira opção "Todas as filiais". A filial ativa filtra listas no `DataContext` (`filterByFilial` mantém linhas sem `filial_id`).

### 4.5 Topbar (`components/layout/Topbar.tsx`)

| Elemento | Comportamento |
|---|---|
| Menu (hambúrguer) | `< 1024px` abre/fecha o drawer; `>= 1024px` recolhe/expande a Sidebar (checa `window.innerWidth` no clique) |
| Pílula de marca | Só `< sm`: logo + nome do tenant |
| `CommandPalette` | `hidden md:block` (botão invisível no mobile; o atalho continua ativo) |
| Tema | Alterna claro/escuro (§3) |
| Notificações | Sino com contador (`rose`), painel 440px (`fixed` full-width no mobile). Abas **Todas / Não lidas**, "Ler todas", clicar marca como lida e navega para `link_url` (ou `/app/tarefas` se o título contém "tarefa"). Ícone/cor por `type`: `success`, `warning`, `error`, padrão `info`. Horário via `formatNotificationTime` ("hh:mm", "Ontem", "dd mmm"). Vazio: `EmptyState` "Nenhuma notificação". Fecha com `Esc`, clique/touch fora. Permissão de notificação do navegador é pedida ao entrar em `/app*` (`requestNotificationPermission`) |
| Menu do usuário | Avatar (iniciais ou imagem) → "Meu Perfil", "Preferências", "Sair da Conta". Nome do usuário + nome fantasia (`appSettings.empresa_dados.nomeFantasia`) ao lado, `hidden sm:block` |

### 4.6 CommandPalette (`components/CommandPalette.tsx`)

- Atalho **Ctrl/Cmd + K** alterna; **Esc** fecha. Modal via portal (`z-[100]`) com `motion`.
- Busca (case-insensitive, máx. 5 por grupo) sobre dados já em memória do `DataContext`: **Leads/Pipeline** (nome, empresa), **Clientes** (nome), **Propostas** (cliente, título), **Contratos** (client, plan), **Produtos** (nome) + **Navegação** (9 atalhos fixos: Dashboard Principal, Pipeline de Vendas, Base de Clientes, Propostas, Contratos, Produtos, Automações de Marketing, Gestão de Turmas, Configurações do Sistema).
- Selecionar um resultado navega só para a **lista** do módulo (`/app/crm/pipeline`, `/app/crm/clientes`...), não abre o registro.
- Sem resultado: `Nada encontrado para "{busca}"`. Rodapé mostra `ESC` e `v2.5.0-stable` (texto fixo no código).
- Não há navegação por setas/Enter (itens são `button` na ordem do DOM, acessíveis por Tab).

### 4.7 MobileNav (`components/layout/MobileNav.tsx`, `sm:hidden`)

Barra inferior fixa (`h-16`) com 3 atalhos — **Painel** (`/app/dashboard`), **Leads** (`/app/pipeline`), **Clientes** (`/app/clientes`) — e **Mais**, que abre um bottom-sheet "Navegação Completa" (`max-h-[80vh]`) com as mesmas seções/regras da Sidebar em grade de 2 colunas e um `SDRWebhookModal` próprio. Os dois atalhos usam as rotas-alias (`/app/pipeline`, `/app/clientes`) que redirecionam; como o estado ativo usa `pathname.startsWith(tab.path)`, **depois do redirect o atalho nunca aparece ativo** (§14).

### 4.8 Sub-navegação (`components/layout/SectionSidebar.tsx`)

Shell reutilizado por **Financeiro** (`FinanceiroLayout`) e **Configurações** (`SettingsLayout`): props `heading`, `subheading?`, `groups: {title, icon?, items: {title, path, icon?, soon?}[]}[]`, `children`. Desktop: painel lateral de 256px recolhível (botão `PanelLeftClose`/`PanelLeftOpen`); mobile: cabeçalho `sticky` com dropdown. Grupos abrem/fecham individualmente (começam abertos). Item `soon` vira texto cinza com selo "Em breve" e não navega (ex.: "Integrações bancárias"). Item ativo: `pathname === path || startsWith(path + "/")`.

Grupos do Financeiro: Visão Geral (Painel Financeiro, Busca Financeira) · Movimentações (Todas, Contas a Receber, Receitas, Contas a Pagar, Despesas, Contratos & Faturas) · Cobrança (Cobranças, Inadimplência) · Caixa e Bancos (Fluxo de Caixa, Conciliação Bancária, Contas Bancárias, Transferências) · Gestão (Centros de Custo, Plano de Contas, Orçamentos, Contatos) · Análises & Relatórios (Central de Relatórios, DRE Gerencial, MRR, Projeção de Caixa, Indicações & Parcerias) · Importação (Importar Movimentações). Um **FAB "+" (Nova Operação)** fica fixo no canto inferior direito, exceto em rotas que têm botão próprio (`PAGINAS_COM_BOTAO_PROPRIO`).

Grupos de Configurações: Preferências & Usuário · Empresa · CRM · Produtividade · Financeiro · Engajamento · Integrações · Sistema (ver rotas em §5.9). Itens condicionais: "Módulos & SaaS (Admin)" só para master; "Aurora (Controle, Consumo & Agentes)" só se o módulo `aurora` estiver ativo.

### 4.9 Atalhos de teclado (todos os encontrados)

| Atalho | Onde | Efeito |
|---|---|---|
| Ctrl/Cmd + K | `CommandPalette` (global em `/app`) | Abre/fecha a busca |
| Esc | `Modal`, `CommandPalette`, painéis do `Topbar` | Fecha |

Não há outros atalhos globais (não verificado em telas específicas como Messaging/Reuniões).

---

## 5. Inventário de telas

Legenda: **Ações/modais** só lista o que foi confirmado por import/JSX. `—` = não verificado nesta rodada. Todas as rotas `/app/*` ficam dentro de `<ProtectedRoute><Layout/></ProtectedRoute>`.

### 5.1 Rotas públicas (fora do Layout)

| Rota | Arquivo | Propósito | Notas |
|---|---|---|---|
| `/` | — | Redireciona para `/app` | `Navigate replace` |
| `/landing` | `pages/landing/LandingPage.tsx` | Página de marketing | — |
| `/lp` | `pages/lp/SPYLandingPage.tsx` | Landing S.P.Y. (lazy, chunk próprio) | Fallback `Suspense` = `div min-h-screen bg-white` |
| `/login` | `pages/auth/Login.tsx` (+ `components/LoginForm.tsx`, `hooks/useLoginTheme.ts`) | Autenticação; aplica a cor do tenant pelo e-mail | Erros inline: "Preencha e-mail e senha." / "Falha no login" |
| `/redefinir-senha` | `pages/auth/ResetPassword.tsx` | Nova senha (mín. 6 caracteres, confirmação) | "As senhas não coincidem." |
| `/register` | — | Redireciona para `/login` | Auto-cadastro desativado |
| `/proposta/:token` | `pages/public/PropostaPublica.tsx` | Proposta pública com tracking | Carregando / "Proposta não encontrada" |
| `/f/:niche` | `pages/common/InteractiveForm.tsx` | Formulário público de captação por nicho | Tela de erro de envio; máscara de telefone |
| `/imovel/:id` | `pages/imobiliario/ImovelPublico.tsx` | Anúncio público de imóvel | "Imóvel não encontrado" |
| `/corretor/:slug` | `pages/imobiliario/PortfolioCorretor.tsx` | Portfólio público do corretor | "Corretor não encontrado" |
| `/catalogo/:tenantId` | `pages/public/CatalogoPublico.tsx` | Catálogo público (Varejo) | "Catálogo não encontrado" |

**Não há rota coringa (`*`) no nível raiz nem dentro de `/app`** (exceto `financeiro/*` e `configuracoes/*`): uma URL inexistente renderiza a página em branco/`Outlet` vazio.

### 5.2 Aliases e redirects

| De | Para |
|---|---|
| `/app` (index) | `/app/dashboard` |
| `/app/leads`, `/app/pipeline`, `/app/crm/leads`, `/app/imobiliario/pipeline`*, `/app/imobiliario/leads`* | `/app/crm/pipeline` (*com `?nicho=imobiliario`) |
| `/app/clientes` · `/app/propostas` | `/app/crm/clientes` · `/app/crm/propostas` |
| `/app/documentos` | Renderiza `Contracts` (mesma tela de `/app/crm/contratos` e `/app/financeiro/faturas`) |
| `/app/crm` (index) | `pipeline` |
| `/app/agenda` (index) · `/app/reunioes` (lista) | `calendario` · `ReunioesList` (também em `/app/agenda/reunioes`) |
| `/app/marketing` (index) | `conteudo` |
| `/app/solar/*` (legado) | Mesmas telas de `/app/energia-solar/*` (index redireciona) |
| `/app/concessionaria/*` (legado) | Mesmas telas de `/app/automotivo/*` |
| `/app/clinica/*` (legado) | Mesmas telas de `/app/clinicas/*` |
| `/app/imobiliario/veiculos` | `/app/automotivo/veiculos` |
| `<nicho>/painel` e `<nicho>/dashboard` | Mesma tela (painel do nicho) |
| `/app/financeiro` (index), `/dashboard`, `/painel`, `/visao-geral` | `FinanceiroVisaoGeral` |
| `/app/configuracoes` (index) | `usuario/perfil` |
| `/app/configuracoes/empresa/modulos` | `/app/admin?tab=tenants` |
| `/app/configuracoes/ia/aurora` | `/app/configuracoes/sistema/aurora` |

Páginas existentes **sem rota** (órfãs, verificado por `grep` de import): `pages/crm/Leads.tsx` (tela paginada server-side com `useLeadsList`), `pages/operative/Equipe.tsx` (usa `NovoMembroModal`/`EditarMembroModal`). `pages/marketing/Automations.tsx` é importada em `App.tsx` mas não tem `<Route>`.

### 5.3 CRM e Vendas

| Rota | Arquivo | Propósito | Ações/modais |
|---|---|---|---|
| `/app/dashboard` | `pages/dashboard/Dashboard.tsx` | "Inteligência S.P.Y." — abas Estratégico · Comercial · Marketing · Retenção · BI (`DashboardActionsTabs`, `DashboardTabContent`) | Troca de aba |
| `/app/performance-ia` | `pages/dashboard/PerformanceIA.tsx` | "Cérebro Performance IA" | — |
| `/app/crm/pipeline` | `pages/crm/Pipeline.tsx` | Leads & Pipeline: Kanban ou Lista, KPIs, filtros, analytics | `NewLeadModal`, `LeadDetailsModal` (drawer), `AgendarReuniaoModal`, `WebhookModal` (local); arrastar card; menu ⋮ do card; parâmetros `?nicho=`/`?filtro=` (busca) e `?leadId=`/`?lead=` (abre o lead) |
| `/app/crm/clientes` | `pages/crm/Clientes.tsx` | Base de Clientes S.P.Y. | `NovoClienteModal`, `ClienteContatosModal`, `ClienteDetalhesModal`, `LeadDetailsModal`; excluir com `confirmDialog` |
| `/app/crm/contatos` | `pages/crm/Contatos.tsx` | Contatos Comerciais | Link WhatsApp |
| `/app/crm/empresas` | `pages/crm/Empresas.tsx` | Empresas & Contas B2B | Excluir empresa |
| `/app/crm/oportunidades` | `pages/crm/Oportunidades.tsx` | Oportunidades Comerciais | `NewLeadModal` |
| `/app/crm/propostas` | `pages/crm/Propostas.tsx` | Propostas & Contratos | `CriarPropostaModal`, `NovaPropostaRapidaModal`; `PropostasTable`/`PropostasKPIs` |
| `/app/crm/contratos` (= `/app/documentos`, `/app/financeiro/faturas`) | `pages/crm/Contracts.tsx` | Contratos (form com react-hook-form + zod) | `ConfirmModal` ("Confirmar Exclusão de Contrato") |
| `/app/crm/atividades` | `pages/crm/Atividades.tsx` | Atividades Comerciais | Lista paginada (`Pagination`) |
| `/app/crm/follow-ups` | `pages/crm/FollowUps.tsx` | Central de Follow-ups | Link WhatsApp; `Pagination` |
| `/app/crm/importacao` | `pages/crm/Importacao.tsx` | Importação de Leads em Massa | — |
| `/app/crm/dashboard` | `pages/crm/Dashboard.tsx` | Dashboard de Performance comercial | — |
| `/app/crm/agenda` (= `/app/agenda/calendario` via `Calendario.tsx`) | `pages/crm/AgendaCRM.tsx` | Agenda Comercial CRM (sincroniza Google Calendar) | `NovaReuniaoModal`, `ConfirmModal` |
| `/app/mensageria` | `pages/crm/Messaging.tsx` | Mensageria omnichannel (lista de conversas + chat) | Estado `isOffline` no chat |
| `/app/relatorios` | `pages/crm/RelatoriosExecutivos.tsx` | Relatórios Executivos | — |
| `/app/indicadores` | `pages/operative/Indicadores.tsx` | "BI & Analytics S.P.Y." | — |

### 5.4 Agenda, Operações, Marketing, Equipe

| Rota | Arquivo | Propósito | Ações/modais |
|---|---|---|---|
| `/app/agenda/eventos` | `pages/agenda/Eventos.tsx` | Eventos & Compromissos | `NovaReuniaoModal` |
| `/app/agenda/disponibilidade` | `pages/agenda/Disponibilidade.tsx` | Horários de atendimento | — |
| `/app/agenda/configuracoes` | `pages/agenda/AgendaConfiguracoes.tsx` | Configurações da Agenda | — |
| `/app/agenda/reunioes`, `/app/reunioes` | `pages/reunioes/index.tsx` | Lista de Reuniões (copiar link) | `NovaReuniaoModal`, `ConfirmModal`, `Pagination` |
| `/app/agenda/reunioes/:id`, `/app/reunioes/:id` | `pages/reunioes/ReuniaoRoom.tsx` | Sala de reunião (Jitsi, `components/ui/JitsiEmbed.tsx`) | — |
| `/app/tarefas` | `pages/operative/Tarefas.tsx` | Tarefas S.P.Y. | `NovaTarefaModal`, `NovaPautaModal`, `ConfirmModal`, `Pagination` |
| `/app/produtos` | `pages/operative/Produtos.tsx` | Produtos & SKUs (grid/tabela, filtros, ações em massa, export CSV) | `ProdutoModal` (local, com abas), `CriarPropostaModal` ("Vender: {produto}"), `Pagination` |
| `/app/equipe` | `pages/hr/RHColaboradores.tsx` | Equipe & Squads | `NovoMembroModal`, `EditarColabModal` |
| `/app/automacoes` | `pages/marketing/MarketingAutomacoes.tsx` | Central de Automações S.P.Y. (testar disparo) | — |
| `/app/marketing/conteudo` | `pages/marketing/MarketingConteudo.tsx` | Gestão de Conteúdo (Kanban) | — |
| `/app/marketing/campanhas` | `pages/marketing/MarketingCampanhas.tsx` | Campanhas & Tráfego (Meta/Google Ads) | — |
| `/app/marketing/analytics` | `pages/marketing/MarketingAnalytics.tsx` | CAC, LTV, ROI | — |
| `/app/marketing/social` | `pages/marketing/MarketingSocial.tsx` | Social Media & Comunidade | — (sem item no menu) |
| `/app/marketing/landing-pages` | `pages/marketing/MarketingLandingPages.tsx` | Gestão & Analytics de Landing Pages | — |
| `/app/marketing/landing-pages/eempreenda` | `pages/marketing/EEmpreendaEditor.tsx` | Editor de conteúdo da landing E-EMPREENDA+ | Salva no Supabase |
| `/app/marketing/formularios` | `pages/marketing/MarketingFormularios.tsx` | Formulários de captação ligados ao CRM | — |

### 5.5 Financeiro (`FinanceiroLayout`, com `SectionSidebar` e FAB)

| Rota (`/app/financeiro/...`) | Arquivo (`pages/finance/`) | Propósito |
|---|---|---|
| `dashboard`, `painel`, `visao-geral`, (index) | `FinanceiroVisaoGeral.tsx` | Painel Financeiro: KPIs, alertas, previsto x realizado, fluxo, agenda do mês, projeção |
| `receber`, `pagar`, `receitas`, `despesas` | `FinanceiroReceber/Pagar/Receitas/Despesas.tsx` → `GenericFinanceiroList.tsx` (`type="Receber"`/`"Pagar"`) | Listas de lançamentos. *Receber/Pagar* = todos os títulos; *Receitas/Despesas* = só os já realizados |
| `transacoes` | `FinanceiroTransacoes.tsx` | Todas as Movimentações (`Pagination`) |
| `cobrancas` | `FinanceiroCobrancas.tsx` | Gestão de Cobranças & Faturamento |
| `inadimplencia` | `FinanceiroInadimplencia.tsx` | Inadimplência |
| `fluxo-caixa` | `FinanceiroFluxoCaixa.tsx` | Fluxo de Caixa |
| `conciliacao` | `FinanceiroConciliacao.tsx` | Conciliação Bancária & OFX |
| `bancos` | `FinanceiroContasBancarias.tsx` | Contas Bancárias |
| `transferencias` | `FinanceiroTransferencias.tsx` | Transferências entre Contas |
| `centros-custo` | `FinanceiroCentrosCusto.tsx` | Centros de Custo & Squads |
| `plano-contas` | `ConfigFinanceiroCategorias` (de `settings/SettingsPages`) | Plano de Contas (mesmo componente de Configurações) |
| `orcamentos` | `FinanceiroOrcamentos.tsx` | Orçamentos (clique na célula define o orçamento do mês) |
| `contatos` | `FinanceiroContatos.tsx` | Clientes & Fornecedores |
| `dre` · `mrr` · `projecao` | `FinanceiroDRE/MRR/Projecao.tsx` | DRE Gerencial · MRR · Fluxo de Caixa Projetado |
| `relatorios` · `relatorios/extrato` · `relatorios/performance-mensal` · `relatorios/performance-anual` · `relatorios/:slug` | `FinanceiroRelatorios/Extrato/PerformanceMensal/PerformanceAnual/RelatorioAgrupado.tsx` | Central de Relatórios e relatórios específicos (`:slug` inexistente = "Relatório não encontrado") |
| `busca` | `FinanceiroBuscaGlobal.tsx` | Busca Financeira |
| `importar` | `FinanceiroImportarMovimentacoes.tsx` | Importar Movimentações |
| `indicacoes` | `Indicacoes.tsx` | Indicações & Parcerias |
| `faturas` | `pages/crm/Contracts.tsx` | Contratos & Faturas |
| `categorias` | `pages/settings/SettingsGenericForm.tsx` | Formulário genérico (ver §9.5) |
| `*` | `pages/common/GenericPlaceholder.tsx` | "Módulo Temporariamente Indisponível" |

Ações verificadas em `GenericFinanceiroList`: criar lançamento (`Modal` com categoria "+ Criar nova categoria...", recorrência semanal/quinzenal/..., parcelas, anexos), `RateioModal` (dividir lançamento), editar, excluir com `confirmDialog`, confirmação ao mudar status, filtros (busca, categoria, status Pago/A Vencer/Pendente/Atrasado, conta, centro de custo), `Pagination`. Layout: `FinanceiroFilterProvider` compartilha filtros; `NovaOperacaoModal` do FAB.

### 5.6 Verticais de nicho

Cada painel fica em `<nicho>/dashboard` ou `<nicho>/painel`. Propósitos abaixo são os títulos das páginas.

| Nicho (rota-base) | Rotas → arquivo | Modais verificados |
|---|---|---|
| Imobiliário (`/app/imobiliario`) | `imoveis` → `Imoveis.tsx` (Imóveis) · `proprietarios` → `Proprietarios.tsx` · `captacoes` → `Captacoes.tsx` · `empreendimentos` → `Empreendimentos.tsx` · `corretores` → `Corretores.tsx` · `visitas` → `Visitas.tsx` · `comissoes` → `ImobiliarioComissoes.tsx` (**exige `requireTenantAdmin`**; sem item de menu) · painel → `PainelGeral.tsx` | — |
| Energia Solar (`/app/energia-solar`, legado `/app/solar`) | `projetos` → `ProjetosSolar.tsx` · `vistorias` → `VistoriasSolar.tsx` · `dimensionamentos`/`analise-fatura` → `AnaliseFatura.tsx` · `instalacoes` → `InstalacoesSolar.tsx` · `homologacoes` → `HomologacoesSolar.tsx` · `manutencoes` → `ManutencoesSolar.tsx` · painel → `PainelSolar.tsx` | — |
| Automotivo (`/app/automotivo`, legado `/app/concessionaria`) | `veiculos` → `imobiliario/Veiculos.tsx` · `captacoes` → `imobiliario/Captacoes.tsx` · `avaliacoes` → `AvaliacoesVeiculos.tsx` · `consignacoes` → `ConsignacoesVeiculos.tsx` · `trocas` → `TrocasVeiculos.tsx` · `test-drives` → `TestDrives.tsx` · `corretores`/`visitas` → páginas do Imobiliário reutilizadas · painel → `PainelAutomotivo.tsx` | — |
| Varejo (`/app/varejo`) | `vendas` → `Vendas.tsx` (Frente de Caixa/PDV, ~2.500 linhas) · `pedidos` → `PedidosVarejo.tsx` (sem item de menu) · `estoque` → `Estoque.tsx` · `compras` → `ComprasVarejo.tsx` · `fornecedores` → `FornecedoresVarejo.tsx` · painel → `PainelVarejo.tsx` | — |
| Clínicas (`/app/clinicas`, legado `/app/clinica`) | `agenda` → `AgendaMedica.tsx` · `profissionais` → `ProfissionaisClinica.tsx` (sem item de menu) · `servicos` → `ServicosClinica.tsx` (sem item) · `tratamentos` → `PlanosTratamento.tsx` (sem item) · `pacientes` → `Pacientes.tsx` · `prontuarios` → `Prontuarios.tsx` (**`requireModule="clinica"`**) · `faturamento` → `Faturamento.tsx` · `estoque` → `Estoque.tsx` · `telemedicina` → `Telemedicina.tsx` · `exames` → `Exames.tsx` · `bi` → `Estatisticas.tsx` · painel → `PainelGeral.tsx` | — |
| Educação (`/app/educacao`) | `turmas` → `Turmas.tsx` (+ `EducationTurmaDetalhes.tsx` inline) · `alunos` → `Alunos.tsx` · `conteudo` → `Conteudo.tsx` · `certificados` → `Certificados.tsx` · `mensalidades` → `Mensalidades.tsx` (**`requireModule="educacao"`**, `Pagination`) · painel → `PainelGeral.tsx` | `NovaTurmaModal`, `NovaMatriculaModal`, `AlunoGradesModal` (Master IA), `NovoConteudoModal` |
| Dev (`/app/dev`) | `painel` → `PainelDev.tsx` · `projetos` → `Projetos.tsx` · `projetos/:projectId` → `ProjetoDetalhesDev.tsx` · `sprints` → `Sprints.tsx` (Sprint Atual) · `issues` → `Issues.tsx` · `repositorios` → `Repositorios.tsx` · `ambientes` → `Ambientes.tsx` | Modais de projeto, issue, repositório, GitHub, tarefa de sprint (`NovoProjetoDevModal`, `NovaIssueDevModal`, `NovoRepositorioDevModal`, `ConectarGitHubModal`, `NovaTarefaSprintModal`, `EditarProjetoDevModal`, `ApagarProjetoDevModal`) |

### 5.7 Administração e parceiros

| Rota | Arquivo | Guarda | Propósito |
|---|---|---|---|
| `/app/admin` | `pages/admin/AdminSaaS.tsx` | `requireMaster` | Gestão de Infraestrutura & SaaS (aba `?tab=`; tenants/módulos) |
| `/app/parceiros` | `pages/partners/PartnersOverview.tsx` | `requirePartner` | Visão de Parceiros |

### 5.8 Configurações — rotas (`/app/configuracoes/...`, `SettingsLayout`)

| Grupo | Rotas → componente |
|---|---|
| Usuário | `usuario/perfil` → `ConfigPerfilUsuario` · `usuario/preferencias` → `ConfigPreferenciasSistema` (tema, idioma, moeda, visualização inicial do CRM, cor da marca) · `usuario/notificacoes` → `ConfigNotificacoesPreferencias` |
| Empresa | `empresa/dados` → `ConfigEmpresaDados` (Razão Social, Nome Fantasia*, CNPJ com consulta, IE, e-mail, telefone, site, endereço, logo até 2MB) · `empresa/filiais` → `ConfigEmpresaFiliais` (`NovaFilialModal`) · `empresa/nichos` → `ConfigNichos` · `empresa/equipe`, `empresa/permissoes`, `empresa/cargos` → **`requireTenantAdmin`** |
| CRM | `crm/funis` · `crm/origens` (`NovaOrigemCRMModal`) · `crm/produtos` · `crm/campos` (`NovoCampoCRMModal`) · `crm/sla` · `crm/gatilhos-ia` · `crm/rodizio` |
| Produtividade | `produtividade/categorias` (`NovaCategoriaTarefaModal`, `NovoPlanoContasModal`) · `kanbans` |
| Financeiro | `financeiro/categorias` · `financeiro/squads`, `financeiro/bloqueio-periodo`, `financeiro/auditoria` → **`requireTenantAdmin`** |
| Engajamento | `engajamento/modelos` (`NovoModeloModal`) · `engajamento/automacoes` |
| Integrações | `integracoes/apps` (`NovaIntegracaoModal`) · `integracoes/smtp` · `integracoes/webhooks` · `integracoes/sdr-webhooks` · `integracoes/conectores-externos` · `integracoes/links-dinamicos` |
| Sistema | `sistema/backups` · `sistema/aurora` (só se módulo `aurora`) |
| Coringa | `*` → `SettingsGenericForm` — **atenção**: itens do menu como `crm/dashboards` (Configuração de Dashboards) e `financeiro/integracoes` (Em breve) não têm rota própria |

---

## 6. Catálogo de componentes (`src/components/ui`)

Uso = nº aproximado de arquivos que importam (`grep`). Ordem por relevância.

### 6.1 Primitivos

| Componente | Arquivo | Props principais | Variantes / comportamento | Uso real |
|---|---|---|---|---|
| **Button** (236) | `button.tsx` | Todas de `<button>` + `variant`, `size`, `loading`, `asChild` (Radix `Slot`) | `variant`: `default` (azul da marca, sombra, glow no escuro), `outline`, `ghost` (fundo sunken sempre visível), `success`, `danger`, `secondary` (accent), `subtle`. `size`: `default` h-10 `text-sm`, `sm` h-9 `text-xs`, `lg` h-11 `text-base`, `icon` h-10 w-10, `xs` h-8 `text-[10px]`. `loading` desabilita, mostra spinner e `aria-busy` | `PipelineTopActions.tsx` (`outline`, `subtle`, `default`), `LeadDetailsModal.Footer.tsx` (`danger`, `outline`), `AddProdutoLeadModal.tsx` (`outline`, `default` com `h-9 text-xs`). Foco: `focus-visible:ring-2` |
| **Modal** (86) | `modal.tsx` | `isOpen`, `onClose`, `title` (string ou nó), `description`, `children`, `footer`, `maxWidth` (padrão `max-w-md`), `className`, `position` (`"center"` \| `"right"`), `noPadding` | Portal em `document.body` (`z-[100]`), fecha com **Esc** e clique no backdrop; trava scroll do `body`; `role="dialog" aria-modal`; `aria-labelledby` só quando `title` é string; botão fechar com `aria-label="Fechar"`. `position="right"` = drawer (`rounded-l`, `slide-in-from-right-10`, `h-full`). Centro: `max-h-[90vh]`, `zoom-in-95`. Conteúdo `p-6 overflow-y-auto`; `noPadding` = filhos gerenciam a rolagem (`flex flex-col`). Rodapé `footer` com fundo sunken. **Sem focus trap** | Drawer: `LeadDetailsModal.tsx` (`position="right" noPadding maxWidth="max-w-[546px]"`). Formulário: `AddProdutoLeadModal.tsx` (`max-w-2xl`). Editor: `PropostaEditorWordModal.tsx` (`noPadding`, `max-w-[1360px] w-[96vw]` ou tela cheia) |
| **Card** (213) | `card.tsx` | `div` + `className` | Só existe `Card` (sem `CardHeader/Content`). `rounded-[var(--radius-panel)]`, borda default, `shadow-[var(--shadow-panel)]` | `ClientesList.tsx` (`overflow-hidden`), `PipelineKPIs.tsx` (`p-4`) |
| **Badge** (46) | `badge.tsx` | `variant`, `dot`, `dotPulse` | `default`, `secondary`, `outline`, `destructive`, `success`, `warning`, `info`, `purple`, `cyan`, `neutral`. Pílula `text-xs font-semibold`. `purple`/`cyan` usam cores fixas `*-400` (contraste baixo no claro sem o shim) | `ClientesList.tsx` (`statusBadgeVariant`: Ativo→success, Em Implantação→warning, outro→secondary) |
| **Table** (5) | `table.tsx` | Exporta `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell` | `Table` embrulha em `div overflow-x-auto` com borda; `TableHead` `h-11 uppercase text-xs`; linhas com hover; sem ordenação embutida. Ainda há 45 `<table` cruas no código | `ClientesList.tsx` |
| **Tabs** (1) | `tabs.tsx` | Radix `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | Pílula sunken, ativo elevated | Só `ConfigIntegracoesApps.tsx`. Demais abas são **custom** (`LeadDetailsModal`, `ProdutoModal`, `DashboardActionsTabs`, `Topbar`) |
| **Select** (0) | `select.tsx` | Radix `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`, `SelectGroup`, `SelectValue` | h-10, `z-[110]` no conteúdo | **Não importado em nenhum lugar.** O app usa `<select>` nativo (260 ocorrências) com classes locais (`selectClass`) |
| **Input** (33) | `input.tsx` | `<input>` + `className` | h-10, foco por ring | `ClientesList.tsx` (busca) |
| **Switch** (5) | `switch.tsx` | `checked`, `onCheckedChange`, `onChange`, `size` (`sm`\|`default`\|`lg`), `label`, `description`, `id`, `disabled` | É `input[type=checkbox]` `sr-only peer` + trilho estilizado (não é Radix, não tem `role="switch"`); `label`/`description` clicáveis; foco visível via `peer-focus-visible` | `ConfigIntegracoesSDR.tsx`, `SettingsSistemaAuroraAgentes.tsx`, `ConfigIntegracoesApps.tsx` |
| **FormField** (17) | `form-field.tsx` | `label`, `htmlFor`, `required` (asterisco `danger`), `hint`, `error` (substitui o hint) | Wrapper de rótulo + mensagem; não substitui Input/Select. Doc no código: usar com react-hook-form (`error={errors.campo?.message}`) | `new-lead/BasicInfoBlock.tsx`, `pages/crm/Contracts.tsx` (RHF + zod), `ConfigConectoresExternos.tsx` |
| **EmptyState** (25) | `empty-state.tsx` | `icon` (Lucide), `title`, `description`, `action`, `className` | Bloco tracejado centralizado; passa `title`/`description` por `t()` | `ClientesList.tsx` ("Nenhum cliente encontrado"), `Topbar.tsx` (notificações), `PipelineEmptySelection.tsx` |
| **Pagination** (14) | `Pagination.tsx` | `page` (**0-indexado**), `totalPages`, `total`, `pageSize`, `loading`, `onPageChange`, `itemLabel` | Rodapé "1–50 de N {item}s" + anterior/próxima + "Página X de Y"; não renderiza se `total === 0`. Serve para paginação de servidor **ou** de cliente (fatiar array) | `ClientesList.tsx` (`PAGE_SIZE = 50`, fatia em memória), `Produtos.tsx` (`PAGE_SIZE = 60`), `GenericFinanceiroList.tsx`, `pages/crm/Leads.tsx` (servidor, órfã) |
| **confirmDialog / ConfirmDialogHost** (68) | `confirm-dialog.tsx` | `confirmDialog({ title?, description? (ou message), confirmText? (ou confirmLabel), cancelText?, variant? })` → `Promise<boolean>` | `ConfirmDialogHost` (montado em `App` para `/app*`) mostra `modals/shared/ConfirmModal`. Padrões: título "Confirmar exclusão", texto "Essa ação não pode ser desfeita.", botão "Excluir permanentemente". `variant` é aceito mas **não usado**. Sem host montado cai em `window.confirm` | `Clientes.tsx#handleDeleteCliente`; `GenericFinanceiroList.tsx` (passa `confirmText: "Confirmar"` ao mudar status) |
| **Skeleton** (0) | `skeleton.tsx` | `className` | `animate-pulse` sunken | **Não usado.** Skeleton de chat é markup próprio em `messaging/ChatListSidebar.tsx` |
| **Spinner** (0) | `spinner.tsx` | `size` (`sm`\|`default`\|`lg`), `label` | `role="status"`, `aria-label` padrão "Carregando" | **Não usado.** `Loader2` do lucide é usado direto em 29 arquivos |
| **Alert** (2) | `alert.tsx` | `variant` (`default`\|`success`\|`warning`\|`danger`\|`info`), `title` | `role="alert"`, ícone por variante | `ConfigIntegracoesSMTP.tsx`, `ConfigIntegracoesApps.tsx` |
| **DropdownMenu** (1) | `dropdown-menu.tsx` | Radix: `DropdownMenu`, `Trigger`, `Content`, `Item`, `CheckboxItem`, `RadioItem`, `Label`, `Separator`, `Group`, `Sub*`, `RadioGroup` | Wrapper Radix estilizado | Só `FinanceiroVisaoGeral.tsx` (seletor de ciclo). Menus ⋮ e de usuário são `div` custom |
| **DateRangeFilter** (4) | `DateRangeFilter.tsx` | `dateFrom`, `setDateFrom`, `dateTo`, `setDateTo` (+ altura opcional) | Popover de período com `CalendarRange`/`Check`/`X` | `PipelineFilterBar` |

### 6.2 Componentes de contexto/plataforma

| Componente | Arquivo | Nota |
|---|---|---|
| `Logo` | `ui/Logo.tsx` | `variant` `"icon"`/`"full"`, `size`, `color` (cor do tenant) |
| `PageContainer` | `components/PageContainer.tsx` | ver §4.1 |
| `ErrorBoundary` | `components/ErrorBoundary.tsx` | `resetKey` (o `Layout` passa `pathname`); UI "Não foi possível carregar esta página" + "Tentar novamente" |
| `ProtectedRoute` | `components/ProtectedRoute.tsx` | ver §9.4 |
| `OnboardingWizard` | `components/OnboardingWizard.tsx` | Montado no `Layout` |
| `AuroraWidget`, `AuroraCore*`, `AuroraTokenMeter`, `AuroraJitsiVoice`, `LeadCopilot`, `JitsiEmbed` | `ui/` | IA/voz/reunião. `LeadCopilot` = painel "IA Copilot" do cabeçalho do lead |

### 6.3 Modais por domínio (`src/components/ui/modals/**`)

Todos usam `Modal` **exceto** `NovaPropostaRapidaModal`, `AlunoGradesModal`, `NovaMatriculaModal`, `NovoConteudoModal`, `EditarColabModal`, `NovaTurmaModal` (overlays próprios; `ProdutoModal` também é próprio). Padrão de título dos demais: `title={<div>caixa-ícone + h3</div>}` (ícone em quadrado `w-9/w-10 rounded-xl/2xl bg-<cor>/10 border`).

| Modal | Largura | Finalidade | Onde é usado |
|---|---|---|---|
| `crm/NewLeadModal` | `max-w-3xl` | Novo lead (blocos ClientSelector → BasicInfo → Company → Qualification) | `Pipeline`, `Oportunidades` |
| `crm/AddProdutoLeadModal` | `max-w-2xl` | "Adicionar Produtos": carrinho, recorrência/parcelamento, implantação, desconto, pagamento, **Concluir Venda** (cria proposta, financeiro e atualiza o lead) | `lead-details/ProductsSection.tsx` |
| `crm/PropostaEditorWordModal` | `max-w-[1360px] w-[96vw]` (ou tela cheia) | Editor A4 de proposta/contrato | `lead-details/ProductsSection.tsx` |
| `crm/CriarPropostaModal` | `max-w-3xl` | Criar proposta com itens (também "Vender: produto") | `Propostas`, `Produtos` |
| `crm/NovaPropostaRapidaModal` | (próprio) | "Nova Proposta Comercial" rápida | `Propostas` |
| `crm/AgendarReuniaoModal` | `max-w-lg` | Agendar reunião com o lead (cria sala/convite; ao arrastar para etapa de reunião) | `Pipeline`, hero do lead |
| `crm/NovoClienteModal` | `max-w-2xl` | Novo/Editar Cliente (CPF/CNPJ com máscara e consulta BrasilAPI, telefone, IBGE) | `Clientes` |
| `crm/ClienteContatosModal` | `max-w-2xl` | Contatos e decisores do cliente (`cliente_contatos`) | `Clientes` |
| `crm/ClienteDetalhesModal` | `max-w-2xl` | Detalhe do cliente sem lead vinculado | `Clientes` |
| `crm/NovaOrigemCRMModal` · `NovoCampoCRMModal` | `max-w-md` · `max-w-2xl` | Origem de lead · Campo personalizado | `ConfigCRMOrigens` · `ConfigCRMCampos`/`ConfigCRMProdutos` |
| `crm/NovoFunilModal` | `max-w-2xl` | Funil + etapas | **sem uso** (Configurações usa `sections/crm/FunilModal.tsx`) |
| `crm/SDRWebhookModal` | — | "Webhooks SDR", botão "Testar POST" | Só `MobileNav` (§14) |
| `education/*` | — | Nova Turma, Nova Matrícula, Conteúdo (publicar/editar), Grades do aluno ("Master IA — Análise de Desempenho") | `Turmas`, `Alunos`, `Conteudo` |
| `hr/NovoMembroModal` · `EditarMembroModal` · `EditarColabModal` | `max-w-lg` · `max-w-2xl` · — | Membros/colaboradores | `RHColaboradores`, `Equipe` (órfã) |
| `marketing/NovaAutomacaoModal` · `NovaRegraIAAutomacaoModal` · `NovoModeloModal` | `xl` · `2xl` · `2xl` | Automação · Regra de IA · Modelo de mensagem | `Automations` (órfã) · **sem uso** · `SettingsEngajamento` |
| `productivity/NovaTarefaModal` · `NovaPautaModal` · `NovaCategoriaTarefaModal` | `max-w-2xl` | Tarefa (com Google Calendar) · Pauta · Categoria | `Tarefas` · `Tarefas` · `SettingsProdutividade` |
| `reunioes/NovaReuniaoModal` | `max-w-md` | "Nova Reunião" (sala S.P.Y. ou convite Google Calendar) | `Reunioes`, `Eventos`, `AgendaCRM` |
| `settings/NovaFilialModal` · `NovaIntegracaoModal` · `NovoPerfilPermissaoModal` · `NovoPlanoContasModal` | `2xl` · `2xl` · `2xl` · `md` | Filial (CNPJ+IBGE) · Integração · Perfil de permissão · Conta do plano de contas | `ConfigEmpresaFiliais` · `ConfigIntegracoesApps` · **sem uso** · `SettingsProdutividade` |
| `shared/ConfirmModal` | `max-w-md` | Confirmação destrutiva (`title`, `message`, `confirmText`, `cancelText`) | `confirmDialog` + 7 arquivos |

Larguras de modal em `ui/modals`: `max-w-2xl` (16), `lg` (6), `md` (5), `3xl` (2), `xl`/`sm`/`4xl`/`[1360px]` (1 cada).

### 6.4 Blocos de `lead-details/` (drawer do lead) e `new-lead/`

`LeadDetailsModal.tsx` (drawer 546px à direita) compõe:

| Arquivo | Papel |
|---|---|
| `LeadDetailsModalHero.tsx` | Cabeçalho: avatar/iniciais, nome, valor, prioridade, SLA, seletor de etapa (`moveToStage`), botões "Reunião" e "IA Copilot", fechar |
| `LeadDetailsModal.constants.ts` | Abas (`Informações/INFO`, `Notas`, `Tarefas`, `Histórico/HIST.`, `Produtos/PROD.`, `Logs`) e cores por temperatura (Quente `Flame` rose, Morno `Sun` amber, Frio `Sun` blue) |
| `ProfileSection.tsx` + `ProfileHeroCard.tsx` + `ProfileDataForm.tsx` | Aba Informações: contadores (Interações, Sem Contato), "Dados do Lead" com "Editar Campos"/"Concluir Edição", CNPJ (botão de consulta), tags ("Adicionar nova tag...", "Nenhuma tag vinculada"), link WhatsApp |
| `ReservasSection.tsx` | Aba **Reservas**, inserida depois de Informações **somente** se o lead tem histórico de reservas |
| `NotasSection`, `TarefasSection`, `TimelineSection`, `LogsSection` | Abas Notas, Tarefas, Histórico, Logs |
| `ProductsSection.tsx` | Aba Produtos: lista e abre `AddProdutoLeadModal` / `PropostaEditorWordModal` |
| `LeadDetailsModal.Footer.tsx` | Rodapé: **Excluir** (danger, abre confirmação) à esquerda; **Fechar** e **Editar Lead** / **Salvar Alterações** à direita |
| `useLeadDetails.ts`, `LeadDetailsModal.helpers.ts` | Estado e utilitários |
| `ChatSection`, `MessagingSection`, `SdrReportSection` | Existem no diretório, mas as abas "Chat" e "Relatório IA" foram **removidas** (comentário em `constants`) — código remanescente |

`new-lead/`: `ClientSelectorBlock` (escolher cliente existente) → `BasicInfoBlock` (Nome do Contato, Valor Estimado/Negócio, Cargo/Sufixo, E-mail Comercial, Celular/WhatsApp, Origem de Aquisição, Responsável Comercial) → `CompanyBlock` (Documento CNPJ, Razão Social/Nome Fantasia, Website) → `QualificationBlock` (Porte, Cargo do Decisor, Interesse Principal, Perfil LinkedIn, Distribuição de Tenant (Master)).

---

## 7. Padrões de tela

### 7.1 Lista + filtros + ações (Clientes, Propostas, Produtos)
Barra de busca + filtros → tabela (`hidden sm:block`) / lista em cards (`sm:hidden`) → paginação. Coluna **Ações** à direita: **Editar (lápis, `title="Editar Cliente"`)** · Contatos e Decisores · **Remover Cliente** (lixeira, vermelho no hover). Em `Clientes`, clicar na **linha** abre `openClienteOrLead`: se existe lead vinculado abre o **`LeadDetailsModal`** (drawer completo, editável por dentro); se não, o `ClienteDetalhesModal`. O lápis faz o mesmo quando há lead; sem lead abre `NovoClienteModal` em modo edição. (A v1.0 dizia "somente leitura"; não é o caso quando há lead.)

### 7.2 Modal de venda com carrinho ("Adicionar Produtos")
Ordem vertical em `AddProdutoLeadModal`: **Carrinho** ("Itens desta Proposta (n)", total em verde, remover por item) → **Produto \*** + **Quantidade** → **Tipo de cobrança** (Única/Recorrente) → **Configuração da Recorrência** (Frequência: mensal/trimestral/semestral/anual/personalizado; Vigência: 1/3/6/12/24) **ou Parcelamento** → **Implantação & Desconto** (taxa de implantação/setup; tipo de desconto: recorrente = Sem desconto/Só na 1ª cobrança/Em todo ciclo/Total do contrato/Percentual) → **Composição Comercial & Financeira** (Custos, Comissão, Lucro; recolhível) → **Pagamento** (Pix, Crédito, Boleto, Débito, Dinheiro, TED, Link Pgto.; vencimento/1º vencimento; cronograma) → **Resumo da Venda/Assinatura** → **Observação**. Rodapé fixo (sticky dentro do corpo rolável): **Cancelar · Adicionar Produto** (só com produto escolhido) **· Concluir Venda & Automatizar Tudo** (mostra "Processando..." e ícone giratório). Após "Adicionar Produto" o formulário do produto zera; pagamento/parcelas/vencimento permanecem. Sucesso: toast `"{produto}" adicionado à proposta.`; ao concluir: "Venda concluída e automatizada!".

### 7.3 Formulário em abas (Produto)
`ProdutoModal` (`pages/operative/produtos/`) é um overlay próprio (`Card max-w-2xl max-h-[92vh]`), com abas **Cadastro · Comercial & Margem · Estoque & Logística · Mídia & Anexos** (ids `info`, `comercial`, `estoque`, `arquivos`). O rodapé é um **stepper** (barrinhas) + **Voltar / Avançar** e, na última aba, **Salvar Produto ERP** (verde). Título: "Cadastrar Novo Item ERP" / "Editar Produto / Serviço". Tipos de item: Serviço, Assinatura, Digital, Físico, Imóvel, Curso/Turma. Blocos coloridos por conceito: violeta = recorrência, fúcsia = implantação, **âmbar = fidelidade** (Contrato com Fidelidade). Campos condicionais aparecem com animação curta. Fidelidade sempre visível; **desabilitada com explicação** quando o produto não é recorrente. A troca de aba anima com `motion` (`opacity/x`, 150ms).

### 7.4 Editor de proposta/contrato (A4) — `PropostaEditorWordModal`
Mesa cinza com **folha branca sempre clara** (independe do tema). Barra superior: identidade (logo do tenant ou inicial na cor da marca), **Edição / Visualização A4**, zoom **80–130%** (passos de 10), **Expandir em Tela Cheia / Restaurar Janela**, **Copiar Link**, **Ver como Cliente**, **Baixar PDF**, **Salvar Proposta** (cor da marca; "Salvando..."). Faixa **"Inserir Cláusulas com 1 Clique"** (toast "Cláusula inserida no documento!"). Campos inline com placeholder (Nome do Cliente / Razão Social, Título da Proposta, Nome do Consultor, decisor, cargo). Tabela **Item / Solução · Qtd · … · Subtotal**; recorrente mostra `valor/ciclo`; rodapé **Investimento Total da Proposta**; seção "Diretrizes, Cláusulas e Termos Contratuais"; assinaturas CONTRATANTE / CONTRATADA. Copiar link/ver como cliente exigem a proposta salva ("Salve a proposta para ativar a visualização pública com token seguro.").

### 7.4b Contratos (lista) — `pages/crm/Contracts.tsx`
KPIs (`ContractsKPIs`) + `ContractsTable`; criação em `Modal` com react-hook-form + zod (`contractSchema`: Cliente, Plano Acordado, Descrição (opcional), Valor (MRR), datas). É o **único** formulário do app com RHF/zod.

### 7.5 Kanban de pipeline
Detalhes em §8.1. Alternância Kanban/Lista persistida em `user.preferences.pipelineView` (fallback: `systemPreferences.defaultCrmView`).

### 7.6 Sub-navegação lateral (Financeiro, Configurações)
`SectionSidebar` (§4.8) + `Outlet`. Configurações são páginas de formulário com `max-w-4xl`, cabeçalho `h1 text-2xl` **próprio** (não usam `PageContainer`), botão "Salvar Alterações" no topo e no rodapé.

---

## 8. Wireframes ASCII (baseados no JSX real)

### 8.1 Leads & Pipeline (Kanban) — `pages/crm/Pipeline.tsx`

```
Início > Leads & Pipeline
Leads & Pipeline •                     [Agenda Comercial] [Lista|Kanban] [Performance] [+ Novo Lead]
Gerencie oportunidades em visão de lista ou kanban interativo.

+-------+-------------+---------+----------+-----------------+        PipelineKPIs
| Total | Alta Prior. | Ganhos  | Win Rate | Total de Ganhos |        (2 col no mobile, 5 no md)
+-------+-------------+---------+----------+-----------------+
[ PipelineAnalytics (visível ao clicar "Performance") ............ exportar PDF ]
[Funil: Comercial|SDR v][Funil v][Buscar negócios...][Empresas v][Clientes v][Vendedores v][Período]

 (sem funil: card amarelo "Nenhum funil configurado"  [Configurar ->])
+-- Etapa A  R$ 12.000  (3) --+ +-- Etapa B  R$ 0  (0) --+  +--+ coluna minimizada (56px,
| +------------------------+  | |                         |  |• | título vertical + contagem)
| | Nome / Empresa      (:)|  | |  + Novo Lead            |  |A |
| | [Etapa] [Origem] [2 res]  | +-------------------------+  |3 |
| | Score ==========  72%  |  |                              +--+
| | [Cliente][Squad][tag][Produto]
| | (temperatura) ...       |  |     cartões: 280px, arrastáveis (HTML5 drag & drop)
| +------------------------+  |     "Carregar mais (n)" a cada 40 cartões
|  + Novo Lead (tracejado)    |
+-----------------------------+
 (:) menu do card: Agendar Atividade · Visualizar Proposta · Histórico & Detalhes
     + (funil SDR) Transferir p/ Comercial · Exportar resumo IA · Webhook
 Arrastar para etapa de reunião abre "Agendar Reunião".
```

### 8.2 Detalhes do Lead (drawer à direita, 546px) — `LeadDetailsModal.tsx`

```
                         +------------------------------------------------+
                         | HERO  (JD) Empresa / Nome        R$ 5.000   [X] |
                         |       Prioridade . SLA . [Etapa v]              |
                         |       [Reunião] [IA Copilot]                    |
                         +------------------------------------------------+
                         | INFO | (RESERVAS)* | NOTAS | TAREFAS | HIST. | PROD. | LOGS |   (* só se houver reservas)
                         +------------------------------------------------+
                         |  Aba INFORMAÇÕES                                |
                         |   [Interações n] [Sem Contato n] ...            |
                         |   DADOS DO LEAD               [Editar Campos]   |
                         |   Empresa | Contato | Cargo | E-mail | Fone     |
                         |   CNPJ [00.000.000/0000-00] [consultar]         |
                         |   Origem | Responsável | Prioridade (Alta/Média/Baixa) |
                         |   Tags: [x][x]  [Adicionar nova tag...]         |
                         +------------------------------------------------+
                         | [Excluir]              [Fechar] [Editar Lead]   |
                         +------------------------------------------------+
   (em edição o botão vira "Salvar Alterações"; Excluir abre ConfirmModal)
```

### 8.3 Modal "Adicionar Produtos" (carrinho) — `AddProdutoLeadModal.tsx`

```
+-------------------- Adicionar Produtos ------------------------[X]-+
| +- Itens desta Proposta (2) ----------------------- R$ 3.400,00 -+ |
| | Plano Pro     R$ 297/mensal . 12 ciclos . total R$ 3.564  [lixo] |
| | Setup         R$ 500 em 2x                                [lixo] |
| +----------------------------------------------------------------+ |
| Produto *  [Selecione um produto...      v]   Quantidade [ 1 ]     |
| Tipo de cobrança  (Cobrança única) (Recorrente)                    |
| CONFIGURAÇÃO DA RECORRÊNCIA  Frequência[mensal v] Vigência[1|3|6|12|24]
|   Valor por ciclo R$ ...      Próxima cobrança dd/mm/aaaa          |
|   (ou PARCELAMENTO se cobrança única)                              |
| IMPLANTAÇÃO & DESCONTO  [ ] Taxa de Implantação/Setup             |
|   Tipo de desconto [Sem desconto|Só na 1ª cobrança|Em todo ciclo|...]|
| COMPOSIÇÃO COMERCIAL & FINANCEIRA (recolhível)  Custos|Comissão|Lucro|
| PAGAMENTO  [Pix][Crédito][Boleto][Débito][Dinheiro][TED][Link Pgto.]|
|   1º Vencimento [dd/mm/aaaa]   Cronograma de cobrança ...          |
| RESUMO DA ASSINATURA / VENDA ...                                   |
| Observação [Ex: Cartão Visa final 4022                       ]     |
| ------------------------------------------------ (sticky) ------- |
|            [Cancelar] [+ Adicionar Produto] [Concluir Venda & Automatizar Tudo]
+--------------------------------------------------------------------+
```

### 8.4 Editor de proposta/contrato A4 — `PropostaEditorWordModal.tsx`

```
+--------------------------------------------------------------------------------+
| [logo] Empresa / Título                                            [X Fechar]  |
| [Edição|Visualização A4]  [-] 100% [+]  [tela cheia]  [Copiar Link] [Ver como Cliente] [Baixar PDF] [Salvar Proposta]
| Inserir Cláusulas com 1 Clique:  [Cláusula] [Cláusula] [Cláusula] ...          |
+--------------------------------------------------------------------------------+
|                  (mesa cinza)                                                  |
|            +--------------------------------+                                  |
|            |  Título da Proposta            |   folha A4 branca (sempre clara) |
|            |  Cliente / Decisor / Cargo     |   escala = zoom (80-130%)        |
|            |  Item / Solução | Qtd | Subtotal                                  |
|            |  ...                           |                                  |
|            |  Investimento Total da Proposta: R$ ...                           |
|            |  Diretrizes, Cláusulas e Termos Contratuais                       |
|            |  CONTRATANTE ______   EMPRESA (CONTRATADA) ______                 |
|            +--------------------------------+                                  |
+--------------------------------------------------------------------------------+
```

### 8.5 Base de Clientes — `pages/crm/Clientes.tsx`

```
Início > Base de Clientes S.P.Y.
Base de Clientes S.P.Y. •                                        [+ Novo Cliente]
+--------+--------+--------------+----------+   ClientesKPIs: Total · Ativos · Em Implantação · Inativos
+------------------------------------------------------------------------------+
| [Buscar cliente...........] [Todos os setores v] [Todos as situações v]      |
| EMPRESA      | DOCUMENTO (+decisor) | SETOR | CONTATO | LOCALIZAÇÃO | STATUS | AÇÕES
| Acme Ltda    | 00.000.000/0001-00   | Tecn. | ...     | Palmas/TO   | (Ativo)| [lápis][contatos][lixo]
|  clique na linha -> Lead do cliente (drawer) ou detalhes simples             |
| 1–50 de 132 clientes                          [<]  Página 1 de 3  [>]        |
+------------------------------------------------------------------------------+
< sm: a mesma lista vira cards (divide-y), com decisor e ações.
```

### 8.6 Produto — `ProdutoModal` (abas)

```
+----------------------------------------------------------------[X]-+
| [pacote] CADASTRAR NOVO ITEM ERP                                     |
| Mapeamento fiscal, controle de estoque, vigência recorrente...      |
| [CADASTRO] [COMERCIAL & MARGEM] [ESTOQUE & LOGÍSTICA] [MÍDIA & ANEXOS]|
|----------------------------------------------------------------------|
| CADASTRO: Cliente (opcional) | Nome * | SKU * | Categoria | Tipo de Item |
|   (campos por tipo: Duração, Modalidade, Ciclo de cobrança, Dias de trial, Tipo de entrega)
| COMERCIAL: Preço | Custo | Comissão | [ ] Simular imposto              |
|   [Cobrança Recorrente] ciclo/contrato | [Taxa de Implantação / Setup]  |
|   [Contrato com Fidelidade] meses + multa  (desabilitado se não recorrente)
| ESTOQUE: mín | máx | atual | fornecedor | dimensões | peso | material   |
| ARQUIVOS: anexos                                                     |
|----------------------------------------------------------------------|
| ▬ ▪ ▪ ▪ (stepper)                         [Voltar] [Avançar]  → [Salvar Produto ERP]
+----------------------------------------------------------------------+
Listagem (Produtos.tsx): KPIs · filtros (busca, categorias, tipos, status, ordenação, grid/tabela) · ações em massa · 60 por página.
```

### 8.7 Financeiro — Painel (Visão Geral) — `FinanceiroLayout` + `FinanceiroVisaoGeral`

```
+------------+-------------------------------------------------------------------+
| Financeiro | Painel Financeiro                [Mês Atual v] [imprimir] [Exportar]|
| Gestão ... | Saúde financeira, fluxo de caixa, MRR e inadimplência...           |
|            | KPIs: Saldo em Contas | Receitas do Mês | Despesas do Mês | Resultado |
| v Visão G. |       MRR Ativo | Contas a Receber | Contas a Pagar | Vencido | Fluxo 30d
|   Painel   | FinanceiroAlertas                                                 |
|   Busca    | [Previsto x Realizado]        [Comparativo do mês]   (lg:2 colunas)|
| v Moviment.| Despesas por categoria                                            |
|   ...      | Fluxo de caixa (gráfico) + liquidez + burn rate                   |
| v Cobrança | [Agenda do mês (2/3)]                     [Anexos resumo (1/3)]   |
| v Caixa... | Projeção de receita (MRR, churn) · Painéis inferiores             |
| ...        |                                                          ( + ) FAB |
+------------+-------------------------------------------------------------------+
Ciclo: Mês Atual | Trimestre Atual | Ano Atual | Tudo (DropdownMenu). Sidebar 256px, recolhível; < lg vira dropdown.
```

### 8.8 Configurações — `SettingsLayout` + `ConfigEmpresaDados`

```
+---------------------+---------------------------------------------------------+
| Configurações       | Dados da Empresa                     [Salvar Alterações]|
| Gerenciamento Geral |                                                         |
| v Preferências...   | Logo da Empresa [imagem] [Enviar] [Remover]  (máx. 2MB) |
|   Meu Perfil        | Razão Social *      | Nome Fantasia *                    |
|   Preferências      | CNPJ [00.000.000/0001-00] (consulta Receita) | IE       |
|   Notificações      | E-mail | Telefone | Site                                 |
| v Empresa           | Endereço: Logradouro, Número - Bairro, Cidade - UF, CEP  |
|   Dados da empresa  |                                     [Salvar Alterações] |
|   Filiais | Nichos ...                                                          |
| v CRM | Produtiv. | Financeiro | Engajamento | Integrações | Sistema         |
+---------------------+---------------------------------------------------------+
```

---

## 9. Estados de UI por tela-chave

### 9.1 Vazio

| Tela | Estado vazio |
|---|---|
| Pipeline | Sem funis: card de aviso "Nenhum funil configurado" + link **Configurar** (`/app/configuracoes/crm/funis`). Funil sem seleção: `EmptyState` "Selecione um funil". Coluna sem cartões: só o botão tracejado "+ Novo Lead" |
| Clientes | Tabela: "Nenhum cliente encontrado — Ajuste os filtros ou cadastre um novo cliente". Mobile: "Nenhum cliente cadastrado" |
| Produtos | Card próprio: "Nenhum SKU encontrado" + botão "Adicionar Primeiro Produto" (estilo `bg-white/5`) |
| Notificações | `EmptyState` "Nenhuma notificação — Você será avisado aqui quando algo precisar da sua atenção." |
| Lead (tags) | "Nenhuma tag vinculada" |
| Command Palette | `Nada encontrado para "{busca}"` |
| Financeiro (listas) | `EmptyState` em `GenericFinanceiroList`; relatório inexistente: "Relatório não encontrado" |

### 9.2 Carregando

- **Não há skeleton nem `Spinner` em uso** (componentes existem, 0 imports). O padrão real é: dados vindos do `DataContext` aparecem quando chegam; botões usam `Loader2 animate-spin` + texto ("Salvando...", "Processando...", "Cadastrando...", "Criando..."); `Button loading` mostra spinner interno.
- Páginas públicas: texto centralizado "Carregando catálogo...", "Carregando imóvel...", "Carregando portfólio...", "Carregando proposta comercial autenticada...".
- `ProtectedRoute` retorna `null` enquanto `authLoading` (tela em branco até a sessão resolver).
- `Clientes`: mostra primeiro uma prévia do endpoint `/api/crm/clientes-list` (cache Redis) e substitui pelo resultado do Supabase.
- `/lp`: fallback `Suspense` branco.

### 9.3 Erro

- **`ErrorBoundary`** (por rota, reseta ao mudar `pathname`): "Não foi possível carregar esta página" + botão "Tentar novamente".
- **Erros de operação**: `toast.error` com `friendlyError(error)` (`lib/friendlyError.ts` traduz RLS → "Você não tem permissão para fazer essa ação.", duplicidade → "Já existe um registro com esses dados.", FK, NOT NULL, tamanho, rede → "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.", sessão → "Sua sessão expirou. Atualize a página e faça login novamente.", fallback genérico). Ex.: `Erro ao carregar clientes: ...`.
- **Formulários**: erro inline (Login: "Preencha e-mail e senha."; ResetPassword: "A senha precisa ter pelo menos 6 caracteres." / "As senhas não coincidem."; `FormField error`); validação em modais via `toast.error` (ex.: "Nome da empresa é obrigatório.", "Preencha descrição, valor e categoria antes de salvar.").
- **Formulário público** (`InteractiveForm`): tela de erro com a mensagem retornada.
- **Item público não encontrado**: "Proposta/Imóvel/Corretor/Catálogo não encontrado". A proposta explica: "O link acessado pode ter expirado, estar incorreto ou a proposta foi reemitida com novos termos."

### 9.4 Sem permissão e módulo desabilitado (`ProtectedRoute`)

| Guarda | Regra | Resultado sem permissão |
|---|---|---|
| (padrão) | Precisa de `user` | `Navigate` para `/login` com `state.from` |
| `requireMaster` | `user.isMaster` | Redireciona para `/app` (`/app/admin`) |
| `requirePartner` | `isMaster` ou `partnerId` | Redireciona para `/app` (`/app/parceiros`) |
| `requireTenantAdmin` | `isMaster` ou `isTenantAdmin` | Redireciona para `/app` (Comissões Imobiliárias; Config. Equipe, Permissões, Cargos; Financeiro Squads, Bloqueio de período, Auditoria) |
| `requireModule="x"` | Master passa; senão, se o cargo tem `modulos` e não inclui `x` | Redireciona para `/app` (só Prontuários e Mensalidades) |

Pontos importantes:
- **Nunca há mensagem de "sem permissão"**: o redirect é silencioso e o usuário cai no dashboard.
- **`requireModule` valida o cargo, não o módulo do tenant.** Rotas de módulos desabilitados (ex.: `/app/clinicas/pacientes` num tenant sem `clinica`) **não são bloqueadas**: o módulo só some do menu. A RLS protege os dados, mas a tela abre.
- Aviso de módulo desabilitado **não existe**. O mais próximo é o `GenericPlaceholder` ("Módulo Temporariamente Indisponível — Esta área está sendo reestruturada...") usado pelo coringa de `/app/financeiro/*`, e o `SettingsGenericForm` (coringa de `/app/configuracoes/*`).

### 9.5 Formulário genérico de configuração (`SettingsGenericForm`)
Usado como coringa de Configurações e em `/app/financeiro/categorias`. Mostra um formulário de exemplo e o botão **"Salvar Alterações" apenas dispara `toast.success('Alterações salvas com sucesso!')` sem persistir nada** — comportamento enganoso (§14).

### 9.6 Offline
- Não há banner global de offline nem service worker/PWA (não encontrado em `package.json`, `vite.config.ts`, `main.tsx`).
- `lib/supabase.ts` evita conectar quando `navigator.onLine` é falso. `friendlyError` mapeia "failed to fetch/network/timeout".
- `Messaging` (`isOffline` em `ActiveChatArea`) tem tratamento próprio no chat. `LocalizationContext` mantém a última cotação de câmbio quando a API está fora ("usando o último valor conhecido"). IBGE: falha silenciosa (listas vazias, campo continua digitável).

---

## 10. Formulários, validação, tabelas, toast e confirmação

### 10.1 Formulários
- **react-hook-form + zod (`@hookform/resolvers/zod`) só em `pages/crm/Contracts.tsx`** (`contractSchema`: `z.string().min(1, "O cliente é obrigatório")`, `valor` com `refine`, datas `regex(/^\d{4}-\d{2}-\d{2}$/, "Insira uma data válida")`), usando `FormField error={errors.x?.message}`.
- **Todo o resto** usa `useState` controlado + validação manual + `toast.error` (ex.: `Clientes.handleSaveCliente`, `NovoClienteModal`, `GenericFinanceiroList`). Adotar RHF+zod em formulário novo é a direção do `FormField` (comentário no arquivo), mas não é o padrão vigente.
- `FormField` é usado em 17 arquivos; os rótulos "crus" `<label>` são 744 contra 38 `htmlFor` (§12).
- Campo obrigatório: asterisco no rótulo (`Produto *`, `Razão Social *`), texto de ajuda pequeno abaixo (`hint`), placeholder com exemplo ("Ex: Servidor AWS, Licença de Software, Fatura...") ou "Não informado".
- Campos condicionais (recorrência, fidelidade, implantação) usam `animate-in fade-in slide-in-from-top` (§11).

### 10.2 Máscaras e validações
| Recurso | Onde | Observação |
|---|---|---|
| `formatCNPJ`, `formatPhone` (`(00) 00000-0000`), `validatePhone` (10–11 dígitos), `validateCNPJ` (com dígitos verificadores), `parseCurrencyBR`, `formatCurrencyBR`, `formatPercentage` | `lib/utils.ts` | Usados por `NewLeadModal` e outros |
| `formatPhone` e `formatDocumento` (CPF `000.000.000-00` até 11 dígitos, CNPJ depois) | Cópia local em `NovoClienteModal.tsx` | **Duplicado**; `NovaFilialModal.tsx` também tem `onlyDigits`/`formatCnpj` locais |
| Consulta de CNPJ (BrasilAPI `brasilapi.com.br/api/cnpj/v1/{14 dígitos}`): preenche nome, e-mail, telefone, cidade, UF e mostra situação (ativo/inativo/inválido/consultando) | `NovoClienteModal`, `NewLeadModal`, `ProfileSection`/`ProfileDataForm`, `NovaFilialModal`, `ConfigEmpresaDados` | Toast "Dados sincronizados com a Receita Federal!" em `ConfigEmpresaDados` |
| **IBGE localidades** (`lib/ibgeLocalidades.ts`: `fetchEstados`, `fetchMunicipios(uf)`, hook `useIbgeLocalidades(uf)`; cache em memória; falha silenciosa) | `NovoClienteModal`, `NovaFilialModal`, `Empresas`, `Imoveis`, `Empreendimentos`, `ProjetosSolar`, `FinanceiroContatos` | Cidade/UF não têm mais valor padrão fixo |
| Telefone no formulário público | `InteractiveForm.tsx` (remove não-dígitos) | — |
| Anti-duplicidade de cliente por documento ou e-mail | `Clientes.handleSaveCliente` | Toast: "Já existe um cliente cadastrado com esse documento/e-mail: {nome}." |

Não foram encontradas máscaras de CEP nem de valor monetário como componente reutilizável (moeda é tratada com `parseCurrencyBR`/`formatCurrency` do `LocalizationContext`, que suporta BRL, USD, EUR).

### 10.3 Tabelas
- **Ordenação**: não é embutida em `TableHead`. Onde existe, é por `<select>` (`name-asc` = "Ordem Alfabética A-Z", `name-desc`, `price-desc`, `price-asc`, `margin-desc` em `Produtos`) ou por botão de temperatura em `PipelineListaView`/`Leads`.
- **Filtros**: barra acima (busca `Input` com ícone + `<select>` nativos com opção-rótulo "Todos os setores", "Todos as situações"...). Todo filtro reseta a página (`useEffect(() => setPage(0), [filtros])`).
- **Paginação**: `Pagination` (0-indexada) em 14 arquivos. **Cliente** (fatia em memória): `Clientes` (50), `Produtos` (60). **Servidor**: `useLeadsList` (50 por página, busca com debounce 300ms, contadores `count: exact`; hoje só na `Leads.tsx` órfã). Kanban: "Carregar mais (n)" por coluna a cada 40 cards.
- **Seleção em massa** (`Produtos`): checkbox por linha/cartão, `handleSelectAll`, ações "ativar/desativar/excluir".
- **Exportação**: `downloadCsv` (`lib/csvExport.ts`) — "Exportar Planilha" em Produtos, "Exportar" no Painel Financeiro.
- **Responsivo**: tabela `hidden sm:block` + lista de cards `sm:hidden` (verificado em `ClientesList`; nem toda tela faz isso).
- Ações por linha: ícones com `title` (`Editar lançamento`, `Excluir lançamento`); `stopPropagation` quando a linha é clicável.

### 10.4 Toast (`sonner`) e confirmação
- Contagem: `toast.success` 470 · `toast.error` 475 · `toast.info` 88 · `toast.warning` 17 · `toast.loading/promise` 3, em 166 arquivos.
- Configuração: `Layout` (`top-right`, `richColors`, `closeButton`, tokens de tema); `/login` (`bottom-right`).
- Convenções: sucesso descreve o efeito ("Proposta criada com N itens, financeiro lançado e lead atualizado" — padrão de descrição); erro com `friendlyError`; `info` para orientar ("Salve a proposta para ativar a visualização pública com token seguro."); `warning` para limites ("Capacidade próxima ao limite! (n leads)").
- Alguns toasts têm emoji ("Venda concluída e automatizada!" com raio, "Proposta salva com sucesso!" com check); o restante não. Definir regra (§13).
- **Confirmação**: `confirmDialog` para exclusões e mudanças sensíveis; `ConfirmModal` direto em 7 arquivos (Contracts, AgendaCRM, Tarefas, Reuniões, lead). Texto padrão: "Excluir *X*? Essa ação não pode ser desfeita." Exceção: `useProdutoForm.ts` usa `confirm()` do navegador ("Deseja realmente excluir este item do catálogo?").
- `ConfirmModal` mostra por padrão o botão **"Excluir permanentemente"**; para confirmações que não são exclusão, **sempre** passar `confirmText`.

---

## 11. Ícones, animações e responsividade

### 11.1 Ícones (`lucide-react ^0.546`, 402 arquivos)
- Tamanhos: `w-3.5 h-3.5` em botões pequenos, `w-4 h-4` em menu/lista, `w-5 h-5` em cabeçalhos e nav mobile, `w-8 h-8`/`w-16` em estados vazios/confirmação.
- Modais: ícone dentro de caixa arredondada `bg-<cor>/10 border border-<cor>/20`.
- Cor: ícones de menu `text-[var(--color-text-faint)]` (ativo `!text-white`); ícones de ação colorem por semântica (`text-amber-500` implantação, `text-emerald-*` carrinho).
- Repetições ambíguas em `navData.ts`: `Sun` (Painel Fotovoltaico **e** Análise de Fatura), `Users` (Proprietários, Corretores, Vendedores, Base de Clientes, Base de Alunos, Colaboradores), `Building2` (Painel Imobiliário, Empreendimentos, Painel Concessionária), `ClipboardList` (Captações, Vistorias, Pedidos de Compra), `Wrench` (Instalações e Manutenções), `LayoutDashboard` (painéis e "Projetos Solares"). Em `LeadDetailsModal.constants.ts`, Morno e Frio usam ambos `Sun`.
- Ícone-only exige `title` (494 `title=`) e, idealmente, `aria-label` (só 11 ocorrências).

### 11.2 Animação
- `motion` (`motion/react`) em 37 arquivos: `CommandPalette` (fade + scale/translate), `ProdutoModal` (transição de aba), Aurora, landing.
- `animate-in` (88 usos) via CSS próprio (§2.5): `Modal` (`fade-in`, `zoom-in-95 slide-in-from-bottom-2`, drawer `slide-in-from-right-10`, backdrop `fade-in duration-200`), menu do usuário (`fade-in slide-in-from-top-2`), bottom-sheet do `MobileNav`, campos condicionais.
- Micro-interações: `active:scale-[0.98]` em botões, `transition-all duration-300` na Sidebar e colunas do Kanban (`scale-[1.01]` ao arrastar por cima), barra de score `transition-all duration-700`.
- `animate-pulse` decorativo no título de página; `animate-spin` em `Loader2`.
- **Redução de movimento**: só 2 ocorrências de `prefers-reduced-motion`/`motion-reduce` no código; a maioria das animações não respeita.

### 11.3 Responsividade real
- Breakpoints do Tailwind usados (ocorrências aproximadas): `sm:` 951 · `md:` 235 · `lg:` 337 · `xl:` 17. Não há `container queries` nem breakpoints custom.
- `lg` (1024px) é o corte de **navegação**: Sidebar fixa vs drawer; `SectionSidebar` painel vs dropdown; `Topbar` decide recolher vs abrir drawer por `window.innerWidth < 1024`.
- `sm` (640px) é o corte de **conteúdo**: `MobileNav` (`sm:hidden`), tabela vs cards, `pb-24 sm:pb-8` no contêiner (espaço da barra inferior), FAB financeiro `bottom-20 sm:bottom-6`.
- `md`: `CommandPalette` visível, KPIs do Pipeline em 5 colunas (`grid-cols-2 md:grid-cols-5`), padding `md:p-8`.
- Modal: `w-[95vw] sm:w-full`; larguras de §6.3; `max-h-[90vh]`; editor `w-[96vw]`. Painel de notificações `fixed left-4 right-4` no mobile.
- Kanban: colunas de largura fixa (`280px`/`56px`) com rolagem horizontal do contêiner.
- Gutter de página: `p-4` no mobile, `md:p-8`.

---

## 12. Acessibilidade — estado atual e problemas encontrados

### 12.1 Panorama
| Item | Estado | Meta |
|---|---|---|
| Idioma | `<html lang="pt-BR">` (ajustado por `LocalizationContext`); `translate="no"` impede tradução do navegador | Manter |
| Contraste | Tokens de texto/superfície atendem AA no claro; `text-faint` sobre `surface` no escuro (`#64748B` sobre `#0B1120`) e micro-texto de 8–9px não foram auditados | Auditar |
| Foco visível | `focus-visible:ring` em `Button`, `Select`, `Tabs`, `Switch`; **627 `outline-none` contra 28 `focus-visible`** | Padronizar em botões/`select` nativos |
| Botões só-ícone | 494 `title=`; só 11 `aria-label` (8 arquivos) | Adicionar `aria-label` |
| `role=` | 10 ocorrências em todo o app (Modal, Alert, Spinner...) | — |
| Teclado | Modal fecha com Esc; **sem focus trap**; `CommandPalette` sem setas/Enter | Focus trap; navegação por setas |
| Tema escuro | Suportado por classe `dark` | Cobrir 100% dos modais |

### 12.2 Problemas concretos (arquivo → problema)
1. `components/layout/Topbar.tsx` — o avatar que abre o menu do usuário é um `<div onClick>` (não focável nem operável por teclado).
2. `components/layout/Sidebar.tsx` — item de ação "Webhooks SDR" é `<div onClick>` envolvendo `<button>`; cada `Link` envolve um `<button>` (interativo dentro de interativo; leitores anunciam dois controles).
3. `components/layout/MobileNav.tsx` — botão "Mais" e atalhos sem `aria-current`; bottom-sheet sem `role="dialog"`/foco preso.
4. `pages/crm/components/Pipeline/LeadCard.tsx` e `PipelineKanbanBoard.tsx` — mover lead só por **arrastar e soltar HTML5**, sem alternativa por teclado (a etapa pode ser trocada no drawer do lead, o que mitiga). Menu ⋮ do card é `div` custom sem `role="menu"`, com overlay `fixed inset-0`.
5. `components/ui/modal.tsx` — `aria-labelledby` só quando `title` é string (todos os modais com `title={<div>…}` ficam sem nome acessível); sem focus trap nem retorno de foco.
6. `components/ui/switch.tsx` — checkbox `sr-only` sem `role="switch"`; `checked` é opcional e a aparência depende dele (uso não controlado exibe estado errado).
7. Rótulos: 744 `<label>` para 38 `htmlFor` (ex.: `pages/settings/ConfigEmpresaDados.tsx`, `ProdutoTabInfo.tsx`, `AddProdutoLeadModal.tsx` usam `<label>`/`<span>` sem associação ao input).
8. `pages/finance/FinanceiroLayout.tsx` — FAB "+" só tem `title="Nova Operação"`, sem `aria-label`.
9. `pages/operative/produtos/ProdutoModal.tsx` — overlay próprio: sem `role="dialog"`, sem Esc, sem trava de scroll (diferente de `Modal`).
10. `components/ui/button.tsx` — no estado `loading`, o filho vira `<span class="!text-white">`: em `outline`/`ghost` o texto fica branco sobre fundo claro.
11. Micro-texto: 496 usos de `text-[8px]`/`text-[9px]` (ex.: `LeadCard`, `PipelineKPIs` `text-[9px]`, badges `text-[8px]`) — abaixo do mínimo recomendado, agravado pela escala de 14px por `rem` (§2.3).
12. Cores como único indicador: badges de status e temperatura do lead (`Flame`/`Sun`) dependem de cor; o texto/`title` ajuda, mas Morno e Frio usam o mesmo ícone.
13. `components/CommandPalette.tsx` — abre por atalho mas o gatilho fica `hidden md:block` (sem busca na UI mobile); campo sem `aria-label` (só `placeholder`); sem `role="dialog"`.
14. `pages/common/GenericPlaceholder.tsx`, `Login`, páginas públicas — cores fixas (`text-slate-400`, `text-white`) dependentes do shim de tema.
15. Tabelas: `TableHead` sem `scope="col"`; ordenação por clique não anunciada (`aria-sort` ausente); 45 `<table` cruas sem `caption`.
16. Notificações: itens são `div onClick`; o painel fecha por Esc mas não devolve foco ao sino.

---

## 13. Guia de conteúdo (microcopy pt-BR)

### 13.1 Tom
Direto, profissional, segunda pessoa quando fala com o usuário ("Você será avisado aqui quando algo precisar da sua atenção."). Frases curtas; verbo no infinitivo nos botões; explica o efeito colateral em vez de só confirmar. Sem gíria. Rótulos de campo em caixa alta pequena (CSS `uppercase`), mas o texto no código está em caixa normal.

### 13.2 Termos padronizados (como aparecem nas telas)
| Conceito | Usar | Evitar / variações encontradas |
|---|---|---|
| Cadastro de contas | **Base de Clientes** (menu e título "Base de Clientes S.P.Y.") | "Carteira" só como descrição |
| Funil | **Leads & Pipeline**; itens **Lead**, **Etapa**, **Funil** | "Negócio" (placeholder "Buscar negócios..."), "Oportunidade" (rota própria) — convivem |
| Fechar venda | **Concluir Venda** / botão "Concluir Venda & Automatizar Tudo" | — |
| Adicionar item | **Adicionar Produto(s)** (modal "Adicionar Produtos") | "Cadastrar Produto" (catálogo), "Novo Item ERP" |
| Documento comercial | **Proposta** (`Propostas Comerciais`); **Contrato** | "Documentos" (rota `/app/documentos`) |
| Financeiro | **Contas a Receber / Contas a Pagar**, **Receitas / Despesas** (já realizadas), **Movimentações** | "Transações" (rota `transacoes`) |
| Cobrança recorrente | **Recorrente** / **MRR**; **Cobrança única** | "Assinatura" no resumo |
| Vencimento | **1º Vencimento** (recorrente) / **Vencimento** | — |
| Multa | **Fidelidade**, "Contrato com Fidelidade" | — |
| Estados de cliente | **Ativo**, **Em Implantação**, **Inativo** | — |
| Estados financeiros | **Pago**, **A Vencer**, **Pendente**, **Atrasado**, **Vencido** (Inadimplência) | "Atrasado" vs "Vencido" convivem |
| Temperatura | **Quente / Morno / Frio** (dados em minúsculas no card, capitalizados no drawer) | — |
| Prioridade | **Alta / Média / Baixa** | "Alta Prior." nos KPIs |
| Ausência de dado | **Não informado**; "—" em campos numéricos; "Sem nome cadastrado" | Nunca preencher com dado inventado |
| IA | **Aurora** (assistente), **IA Copilot** (painel do lead), **SDR / IA** | — |
| Navegação | "Início" (breadcrumb), "Painel" (mobile), "Dashboard Geral" (menu) | Três nomes para a home |

Inconsistência gramatical real: filtro **"Todos as situações"** (deveria ser "Todas as situações") em `ClientesList.tsx` (e usado como valor de comparação no código).

### 13.3 Padrões de mensagem
- **Sucesso**: "{Objeto} {particípio} com sucesso!" ("Cliente cadastrado com sucesso!", "Cliente atualizado com sucesso!", "Cliente removido com sucesso!"); quando há automação, descrever o efeito.
- **Erro**: "Erro ao {verbo no infinitivo} {objeto}: {friendlyError}". Nunca `error.message` cru.
- **Validação**: nomear o campo ("O Nome Fantasia é obrigatório.", "A logo deve ter no máximo 2MB.").
- **Exclusão**: título "Excluir cliente"; texto "Excluir {nome} da base de clientes? Essa ação não pode ser desfeita."; botão **Excluir permanentemente** (padrão do `ConfirmModal`) e **Cancelar**.
- **Estado de carregamento em botão**: gerúndio ("Salvando...", "Processando...", "Cadastrando...").
- **Vazio**: título afirmativo ("Nenhum cliente encontrado") + orientação ("Ajuste os filtros ou cadastre um novo cliente").
- **Placeholders** com "Ex:" e exemplo real.
- **Emoji**: apenas em dois toasts; padronizar por **não usar**.
- **Datas** `dd/mm/aaaa`, horas `hh:mm`, "Ontem" para o dia anterior; moeda `R$` via `formatCurrency` (segue a moeda escolhida em Preferências).

---

## 14. Débito de UI consolidado

Corrigidos/atualizados em relação à v1.0 e novos achados:

**Bugs de UI/comportamento**
- `Layout.tsx` guarda `isSDRWebhookOpen` e o repassa à `Sidebar`, mas **nunca renderiza `SDRWebhookModal`**. No desktop, o item "Webhooks SDR" do menu não abre nada; só o `MobileNav` (com estado próprio) abre o modal. O `useEffect` de redirect para `/login` também está duplicado.
- `MobileNav.tsx`: os atalhos "Leads" e "Clientes" apontam para as rotas-alias `/app/pipeline` e `/app/clientes`; depois do redirect (`/app/crm/...`) `startsWith` falha e o item nunca fica ativo.
- `Sidebar.tsx`: "Configurações Gerais" (`/app/configuracoes`) fica ativo em qualquer subpágina, junto com "Central de Integrações".
- `FinanceiroLayout.tsx`: `tipoPadrao = pathname.includes("recebimento") ? "Receber" : "Pagar"` — nenhuma rota contém "recebimento" (a rota é `receber`), então o FAB **sempre** abre "Pagar".
- `LeadCard.tsx`: itens do menu ⋮ "Agendar Atividade" e "Visualizar Proposta" apenas fecham o menu (sem ação).
- `SettingsGenericForm.tsx`: "Salvar Alterações" mostra toast de sucesso sem salvar; alcançável por `crm/dashboards` e `financeiro/categorias`.
- `SettingsLayout.tsx` lista "Configuração de Dashboards" (`crm/dashboards`) sem rota própria.
- Ausência de rota `*` global/`/app/*` (URL inexistente = tela vazia).
- `ConfigPreferenciasSistema.tsx`: opção "Sistema" não é reativa e é gravada como `dark`; padrão local `dark` vs padrão do `DataContext` `light`.
- Rotas de módulos desabilitados continuam abrindo por URL (só o menu esconde; `requireModule` só olha o cargo).
- Órfãos: `pages/crm/Leads.tsx`, `pages/operative/Equipe.tsx`, `marketing/Automations.tsx` (importada sem rota), modais `NovoFunilModal`, `NovaRegraIAAutomacaoModal`, `NovoPerfilPermissaoModal`, abas removidas do lead (`ChatSection`, `MessagingSection`, `SdrReportSection`).
- `useProdutoForm.ts`: `confirm()` nativo em duas exclusões.
- `ConfirmModal`: `variant` de `confirmDialog` ignorado; botão padrão "Excluir permanentemente" mesmo em confirmações que não excluem.

**Consistência visual**
- `ProdutoModal` (+ abas), `NovoClienteModal`, `SettingsGenericForm`, `GenericPlaceholder` e várias telas usam cores fixas escuras (`text-white`, `border-white/10`, `bg-[#2563EB]` 68×, `text-slate-*` 2.014×, `text-white` 1.200×) em vez de tokens — dependem do "light mode shim" (§2.7) e **ignoram a cor da marca do tenant** (§3.2).
- `Select`, `Skeleton`, `Spinner` existem e não são usados; há 260 `<select>` nativos, 45 `<table>` cruas e `Loader2` direto em 29 arquivos.
- Máscaras duplicadas (`lib/utils.ts` × `NovoClienteModal` × `NovaFilialModal`).
- Dois "Novo Cliente": `pages/common/NovoClienteModal.tsx` e `components/ui/modals/crm/NovoClienteModal.tsx` (o segundo é o usado em `Clientes`).
- Fonte mono mapeada para a mesma sans; valores monetários dependem de `font-mono` sem diferença real.
- Padronizar altura/raio de botões de ação em tabelas (`p-2` vs `p-1`) e tamanho de `Button` (muitos usam `h-9 text-xs` via `className` sobre `size="default"` h-10).
- `Sidebar`/`MobileNav` duplicam a lógica de visibilidade (extrair para um hook/`navData`).
- `scrollbar-thin`/`scrollbar-none` sem definição em `index.css`.

---

## 15. Checklist de revisão de UI para PRs

**Tokens e tema**
- [ ] Usa `var(--color-*)`, `--radius-*`, `--shadow-*` (nada de `#2563EB`/`bg-blue-600` para ação primária; ela é a cor do tenant).
- [ ] Testado nos temas claro e escuro (tela e modais); sem depender do "light mode shim".
- [ ] Sem `text-white`/`text-slate-*` soltos em fundo variável.

**Componentes**
- [ ] Reutiliza `Button`, `Modal`, `Card`, `Badge`, `EmptyState`, `Pagination`, `FormField`, `confirmDialog` antes de criar markup próprio.
- [ ] Modais novos usam `Modal` (largura `max-w-2xl` para formulário; `position="right"` para detalhes) e passam `title` string (ou `aria-label`).
- [ ] Cores de status seguem a tabela de badges da seção 7/§4.

**Estados**
- [ ] Vazio (com orientação e ação), carregando (botão com `loading`/"...ando"), erro (`friendlyError`), sucesso (toast descrevendo o efeito).
- [ ] Rota nova: definida guarda (`requireTenantAdmin`/`requireModule`/`requireMaster`) quando sensível; item de menu com `reqModule`; sem alias sem redirect; considera `*` (404).
- [ ] Ação destrutiva com `confirmDialog` (com `confirmText` adequado se não for exclusão).

**Formulários**
- [ ] Rótulo associado (`htmlFor`/`FormField`), obrigatório com `*`, erro perto do campo, placeholder com exemplo.
- [ ] Máscaras/validações reaproveitadas de `lib/utils.ts` (não copiar); cidade/UF via `useIbgeLocalidades`; sem valor padrão que vire dado real.
- [ ] Formulário novo com múltiplas regras: preferir react-hook-form + zod (como `Contracts.tsx`).

**Tabelas e listas**
- [ ] Filtros resetam a página; `Pagination` acima de ~50 itens; cards no mobile (`sm:hidden`); ações com `title` e `stopPropagation` na linha clicável.
- [ ] Ordenação/`aria-sort` quando houver ordenação clicável.

**Conteúdo**
- [ ] pt-BR, termos do §13.2 (ex.: "Base de Clientes", "Concluir Venda"), sem emoji, moeda/data no padrão, "Não informado" no lugar de dado inventado.
- [ ] Sem `error.message` cru em toast.

**Acessibilidade e responsividade**
- [ ] Botões só-ícone com `aria-label`; elementos clicáveis são `button`/`a` (não `div onClick`); foco visível (evitar `outline-none` sem substituto).
- [ ] Texto ≥ 10px; contraste AA; informação não depende só de cor.
- [ ] Funciona em 375px (sem rolagem horizontal de página), `sm`/`lg` cobertos; respeita `prefers-reduced-motion` em animações novas.
- [ ] Navegável por teclado (Tab, Esc fecha modal; sem armadilha de foco).
