# 01 — PRD: S.P.Y. (Product Requirements Document)

> Versão 1.0 · 2026-09-24 · Baseado no estado real do código em `main` (commit `94bd56b`).
> Itens marcados **[Existe]** foram verificados no código; **[Parcial]** funciona mas com limitações conhecidas; **[Planejado]** ainda não existe.
>
> **Convenção dos catálogos (§10–§11):** **[Existe]** = rota registrada em `src/App.tsx` + página implementada em `src/pages/**` (a profundidade funcional de cada tela não foi auditada linha a linha); **[Parcial]** = existe, porém com limitação, número fixo ("hardcoded") ou dependência não implementada citada na própria linha; **[Planejado]** = não existe no código. Os §10–§19 foram adicionados em 2026-09-24 a partir da leitura de `src/App.tsx`, `src/lib/*`, `src/contexts/*`, `src/components/ProtectedRoute.tsx`, `src/components/layout/navData.ts`, `server.ts` e `supabase/migrations`.

## 1. Visão do produto

**S.P.Y.** é um CRM/ERP **multi-tenant** para pequenas e médias empresas brasileiras. Um único deploy atende várias empresas (tenants) isoladas entre si. O núcleo é o ciclo comercial — **lead → proposta → contrato → financeiro** — com módulos verticais opcionais por nicho (clínica, imobiliário, automotivo, energia solar, varejo, educação) e uma camada de IA (Aurora) para qualificação e apoio à venda.

**Proposta de valor:** o vendedor fecha a venda uma vez e o sistema propaga tudo sozinho — proposta com itens, contas a receber por ciclo/parcela, valor do lead, cliente na base, contrato e MRR — sem redigitação entre CRM e financeiro.

## 2. Princípio de produto: SPY é genérico

O SPY deve permanecer **padrão e reutilizável** (regra ~80/20): funcionalidades servem a qualquer tenant; nenhuma feature é construída em torno de um cliente específico. Diferenças entre empresas se resolvem por **configuração** (módulos por tenant, nichos, funis, campos customizados), nunca por código exclusivo.

## 3. Personas

| Persona | Papel no sistema | Necessidade principal |
|---|---|---|
| **Vendedor / Closer** | `role` "Vendedor", usuário do tenant | Mover leads no funil, montar proposta com vários produtos, fechar venda sem retrabalho |
| **SDR** | usuário do tenant | Qualificar leads (score IA), receber leads por rodízio, passar para o comercial |
| **Gestor comercial** | usuário do tenant | Ver pipeline, metas por squad, performance, previsibilidade de receita |
| **Financeiro** | usuário do tenant | Contas a receber/pagar, fluxo de caixa, DRE, inadimplência, MRR, conciliação |
| **Admin do tenant** | `isTenantAdmin` | Equipe, cargos, permissões, funis, integrações, bloqueio de período |
| **Master (plataforma)** | `is_master` | Criar/gerir tenants, módulos, planos, parceiros |
| **Parceiro** | `partners` / `tenant_partners` | Acompanhar vários tenants mapeados a ele |
| **Cliente final** | sem login | Ver e aceitar proposta por link público; preencher formulários públicos |

## 4. Problemas que resolve

1. Dados espalhados entre CRM, planilha financeira e contratos → **uma fonte de verdade por tenant**.
2. Venda recorrente lançada como venda única (R$ 997/mês × 12 virando "1× R$ 11.964") → **recorrência e parcelamento são conceitos separados** (`saleCalculator`).
3. Cliente duplicado ao ganhar lead → dedup por documento/e-mail e trava anti-corrida.
4. Cada empresa precisa de um conjunto diferente de módulos → **módulos habilitáveis por tenant**.

## 5. Escopo funcional (requisitos)

### 5.1 CRM comercial — **[Existe]**
- **RF-CRM-01** Pipeline Kanban/Lista com funis configuráveis (`crm_funis`, `crm_pipeline_stages`), pipelines SDR e Comercial, arrastar-e-soltar.
- **RF-CRM-02** Lead com score IA, temperatura (quente/morno/frio), origem, campos customizados, tags, atividades, follow-ups, reuniões e histórico.
- **RF-CRM-03** Rodízio de leads entre closers/SDRs (n8n "Julia" + `claim_next_form_sdr`).
- **RF-CRM-04** Base de Clientes: cadastro, **edição**, exclusão, contatos/decisores, detalhes com negócios de origem; bloqueio de duplicata por documento/e-mail.
- **RF-CRM-05** Importação de leads (CSV), API pública `POST /api/v1/leads`, formulários públicos por nicho (`/f/:niche`).
- **RF-CRM-06** Aurora (IA): copiloto do lead, auditoria de pipeline/performance, chat via n8n, análise de calls.

### 5.2 Produtos e proposta — **[Existe]**
- **RF-PRD-01** Catálogo de produtos (preço, custo, comissão, margem, estoque, anexos) com modelo comercial: **recorrente** (ciclo + duração), **implantação/setup** e **fidelidade** (prazo mínimo + multa % por cancelamento antecipado; só para recorrente).
- **RF-PRD-02** **Venda multi-produto (carrinho)** a partir do lead: N produtos, cada um com sua recorrência/parcelamento/desconto/implantação, fechados numa **única proposta** com N itens.
- **RF-PRD-03** Editor de contrato ("modo Word"): cláusulas com 1 clique, pré-visualização A4, PDF, link público com token (`/proposta/:token`) e aceite online.
- **RF-PRD-04** Item recorrente exibido como "1× valor do ciclo" (não como quantidade × preço acumulado); total do contrato no rodapé.
- **RF-PRD-05** Status da proposta: Aberta → Enviada → Aceita / Recusada (Expirada previsto no tipo).

### 5.3 Financeiro — **[Existe]**
- **RF-FIN-01** Lançamentos a receber/pagar, categorias (plano de contas), centros de custo, contas bancárias, transferências.
- **RF-FIN-02** Recorrência: **um lançamento por ciclo** (`recurring_group_id`); avulso: N parcelas (`installment_group_id`), última parcela absorve centavos.
- **RF-FIN-03** Visões: fluxo de caixa, DRE, MRR, projeção, inadimplência, orçamentos, conciliação, importação de extrato, relatórios.
- **RF-FIN-04** Bloqueio de período e trilha de auditoria (`finance_period_locks`, `finance_audit_log`); comissões por squad/meta.
- **RF-FIN-05** Aceite de proposta gera contrato (MRR = mensalidade real) e lançamento a receber; idempotente por `proposal_id`.

### 5.4 Módulos verticais (habilitáveis por tenant) — **[Existe]**
Clínica (agenda, pacientes, prontuários, exames, telemedicina), Imobiliário (imóveis, captações, corretores, visitas, comissões, portfólio público), Automotivo (veículos, avaliações, consignação, trocas, test-drive), Energia Solar (projetos, análise de fatura, vistorias, instalações, homologações), Varejo (PDV/vendas, estoque, compras, fornecedores), Educação (turmas, alunos, conteúdo, certificados, mensalidades).

### 5.5 Plataforma e administração — **[Existe]**
Multi-tenant com RLS; módulos/planos por tenant; painel Master (`/app/admin`); parceiros; configurações por área (empresa, CRM, financeiro, integrações, sistema); Dev (projetos, sprints, issues); agenda + Google Calendar; mensageria/WhatsApp; marketing (conteúdo, campanhas, landing pages, automações).

### 5.6 Lacunas conhecidas — **[Parcial] / [Planejado]**
- Cobrança recorrente **contínua** ("sem prazo") gera só um lote inicial de ciclos; ciclos futuros são manuais. **[Parcial]**
- Fidelidade é **armazenada** mas ainda não gera cobrança automática de multa no cancelamento. **[Planejado]**
- WhatsApp usa **simulador por padrão**; existe caminho real via WAHA com persistência em `chat_contacts`/`chat_messages`, dependente de configurar a instância (ver Fluxo §17). **[Parcial]**
- Aba Produtos do lead mostra só a proposta mais recente. **[Parcial]**
- RBAC dentro do tenant é raso (papel é texto livre). **[Planejado]**
- Webhooks de saída: há tela de configuração (`/app/configuracoes/integracoes/webhooks`) e despacho por trigger de banco (`dispatch_webhook_event`, via `pg_net`); faltam retentativas e painel de entregas. **[Parcial]**

## 6. Requisitos não funcionais

| Área | Requisito |
|---|---|
| Isolamento | Nenhum dado de um tenant visível a outro — garantido por RLS (`has_tenant_access`), não pela UI |
| Segurança | Nunca confiar no cliente; `service_role` só em rotas master e API por chave; CORS por allowlist; rate limiting |
| Precisão financeira | Valores em `numeric(15,2)`; sem perda de centavos em parcelamento; datas de ciclo com clamp de fim de mês |
| Idempotência | Contrato/lançamento por `proposal_id`; integrações por `externalId` |
| Desempenho | Listas paginadas; cache Redis opcional para listas pesadas; índices por `tenant_id` |
| Usabilidade | Interface em pt-BR, responsiva, tema claro/escuro |
| Manutenibilidade | Arquivos < ~500 linhas, componentes por blocos (ver `TODO.md`) |

## 7. Métricas de sucesso

- Tempo para fechar uma venda multi-produto (do lead à proposta + financeiro) < 2 min.
- 0 clientes duplicados criados por corrida/duplo clique.
- 0 divergência entre valor do lead, soma das propostas e lançamentos a receber.
- MRR do dashboard = soma das mensalidades reais dos contratos ativos.
- Adoção: % de leads ganhos que passam pelo fluxo de proposta do sistema.

## 8. Fora de escopo (por ora)

Emissão fiscal (NFS-e), gateway de pagamento integrado, app mobile nativo, cobrança automática de multa de fidelidade, BI externo.

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Chaves/segredos no histórico do Git e `VITE_*` de IA no bundle | Rotacionar; mover chamadas de IA para o backend (ver `SECURITY_AUDIT.md`) |
| Convenção `quantidade = ciclos × unidades` em itens recorrentes | Documentada; migrar para modelo explícito (ver TRD §9) |
| Estado em memória do backend (settings, WhatsApp) perde-se no cold start | Migrar para tabelas com RLS (ver Plano de Implementação) |
| Deriva entre `schema.sql` e o banco vivo | Tratar migrations como fonte de verdade; gerar tipos |

---

## 10. Catálogo de funcionalidades por módulo

Todas as rotas abaixo são prefixadas por `/app` (definidas em `src/App.tsx`). "Módulo" é a chave em `tenants.modules` que liga o item no menu (`src/components/layout/navData.ts`).

### 10.1 CRM comercial (módulo `crm`)

| ID | Funcionalidade | Tela / rota | Status |
|---|---|---|---|
| RF-CRM-10 | Pipeline em Kanban e Lista, com KPIs (Total, Alta Prior., Ganhos, Win Rate, Total de Ganhos) | `crm/pipeline` (`Pipeline.tsx`, `components/Pipeline/*`) | [Existe] |
| RF-CRM-11 | Cadastro/gestão de leads (aliases `leads`, `crm/leads`, `pipeline` redirecionam ao pipeline; `Leads.tsx` existe mas não tem rota própria) | `crm/pipeline` | [Existe] |
| RF-CRM-12 | Mover lead entre etapas (arrastar e soltar), recalcula score/temperatura após ~400 ms (`moveLead`, `updateLead`) | `crm/pipeline` | [Existe] |
| RF-CRM-13 | Filtro por nicho via query (`?nicho=imobiliario`) | `crm/pipeline` | [Existe] |
| RF-CRM-14 | Contatos comerciais (CRUD) | `crm/contatos` | [Existe] |
| RF-CRM-15 | Empresas / contas B2B (CRUD) | `crm/empresas` | [Existe] |
| RF-CRM-16 | Base de Clientes: cadastro, edição, exclusão, KPIs (Total, Ativos, Em Implantação, Inativos), bloqueio de duplicata por documento/e-mail (`Clientes.tsx` ~L106) | `crm/clientes` | [Existe] |
| RF-CRM-17 | Contatos/decisores do cliente e detalhes com negócios de origem | modais `ClienteContatosModal`, `ClienteDetalhesModal` | [Existe] |
| RF-CRM-18 | Cliente criado automaticamente ao ganhar lead (vincula por `documento` ou `email`, senão cria) | `DataContext.createClientFromWonLead` | [Existe] |
| RF-CRM-19 | Oportunidades: visão analítica de negociações, valores e projeções | `crm/oportunidades` | [Existe] |
| RF-CRM-20 | Propostas & Contratos: KPIs (Aguardando Aceite, Convertidas no Mês, Taxa de Conversão, Propostas Ativas), tabela, editor "Word", PDF | `crm/propostas` | [Existe] |
| RF-CRM-21 | Link público da proposta com token e aceite online | `/proposta/:token` (público) + `POST /api/public-proposal/:token/accept` | [Existe] |
| RF-CRM-22 | Expiração automática de proposta por `validade` | (o tipo prevê `Expirada` em `proposalPdf.ts`; nada a atribui) | [Planejado] |
| RF-CRM-23 | Contratos: lista, KPIs (MRR Total, Contratos Ativos, Inadimplência) | `crm/contratos`, `documentos`, `financeiro/faturas` (mesmo componente `Contracts`) | [Existe] |
| RF-CRM-24 | KPI "Retenção Estimada" em Contratos | `ContractsKPIs.tsx` — valor fixo `"96.8%"`, não calculado | [Parcial] |
| RF-CRM-25 | Atividades: linha do tempo de ligações/reuniões/interações | `crm/atividades` | [Existe] |
| RF-CRM-26 | Follow-ups: oportunidades paradas, agendar retomada | `crm/follow-ups` | [Existe] |
| RF-CRM-27 | Importação de leads em massa por CSV com mapeamento de colunas e detecção de duplicados | `crm/importacao` | [Existe] |
| RF-CRM-28 | Dashboard comercial (Leads Totais, Score IA Médio, Pipeline Total, Taxa de Conversão, Gatilhos de Automação Ativos; gráficos de score e volume; leads quentes) | `crm/dashboard` (`Dashboard.tsx`) | [Existe] |
| RF-CRM-29 | Agenda comercial (reuniões de fechamento, follow-ups, demonstrações) | `crm/agenda` | [Existe] |
| RF-CRM-30 | Captura por API pública `POST /api/v1/leads` (chave de API), `POST /api/public/lead-capture`, formulário público `/f/:niche` | `server.ts` L2072/L2319; `InteractiveForm` | [Existe] |
| RF-CRM-31 | Copiloto de lead e sugestão de tags por IA | `POST /api/ai/lead-copilot`, `/api/leads/suggest-tags` | [Existe] |
| RF-CRM-32 | Revenue Intelligence (simulação de receita) | `RevenueIntelligenceModal` | [Existe] |

### 10.2 Produtos (módulo `catalogo`)

| ID | Funcionalidade | Tela / rota | Status |
|---|---|---|---|
| RF-PRD-10 | CRUD de produtos/SKUs (preço, custo, margem, comissão, estoque, anexos) | `produtos` (`Produtos.tsx`, `produtos/ProdutoModal`) | [Existe] |
| RF-PRD-11 | Modelo comercial: recorrente (ciclo/duração), implantação/setup | `produtos/produto-modal`, `useProdutoForm.ts` | [Existe] |
| RF-PRD-12 | Fidelidade: `hasLoyalty` + `loyaltyMonths` (padrão 12) e multa % | `useProdutoForm.ts` L62–L200 | [Existe] (armazenamento) |
| RF-PRD-13 | Multa de fidelidade na renovação/cancelamento | — | [Planejado] |
| RF-PRD-14 | Venda multi-produto (carrinho) a partir do lead, uma proposta com N itens e cobranças por produto | `AddProdutoLeadModal.tsx` | [Existe] |
| RF-PRD-15 | Baixa de estoque quando a proposta é aceita | migration `20260906_baixa_estoque_venda_aceita.sql` | [Existe] |
| RF-PRD-16 | Catálogo público compartilhável | `/catalogo/:tenantId` (`CatalogoPublico.tsx`) | [Existe] |
| RF-PRD-17 | Produtos vinculados ao CRM (config) | `configuracoes/crm/produtos` | [Existe] |

### 10.3 Financeiro (módulo `financeiro`) — 30 telas em `financeiro/*`

Layout e menu em `FinanceiroLayout.tsx`; os aliases `index`, `dashboard`, `painel` e `visao-geral` abrem a mesma tela. A rota curinga `financeiro/*` cai em `GenericPlaceholder`.

| ID | Tela | Rota (`/app/financeiro/…`) | Status |
|---|---|---|---|
| RF-FIN-10 | Painel Financeiro (KPIs, gráfico 6 meses, alertas, agenda do mês, previsto × realizado) | `dashboard` · `painel` · `visao-geral` | [Existe] |
| RF-FIN-11 | Busca Financeira (histórico sem limite de período) | `busca` | [Existe] |
| RF-FIN-12 | Todas as Movimentações (extrato consolidado, só leitura) | `transacoes` | [Existe] |
| RF-FIN-13 | Contas a Receber | `receber` | [Existe] |
| RF-FIN-14 | Receitas (lançar/editar) | `receitas` | [Existe] |
| RF-FIN-15 | Contas a Pagar | `pagar` | [Existe] |
| RF-FIN-16 | Despesas (lançar/editar) | `despesas` | [Existe] |
| RF-FIN-17 | Contratos & Faturas | `faturas` (componente `Contracts`) | [Existe] |
| RF-FIN-18 | Gestão de Cobranças & Faturamento | `cobrancas` | [Existe] |
| RF-FIN-19 | Inadimplência (por cliente e faixa de atraso) | `inadimplencia` | [Existe] |
| RF-FIN-20 | Fluxo de Caixa (regime de caixa, só pagos) | `fluxo-caixa` | [Existe] |
| RF-FIN-21 | Projeção de Caixa (só "A Vencer") | `projecao` | [Existe] |
| RF-FIN-22 | Conciliação Bancária & OFX (extrato importado × lançamentos) | `conciliacao` | [Parcial] (casamento automático por valor+tipo; ver RN-FIN-09) |
| RF-FIN-23 | Contas Bancárias (saldo inicial, conta principal única) | `bancos` | [Existe] |
| RF-FIN-24 | Transferências entre Contas | `transferencias` | [Existe] |
| RF-FIN-25 | Centros de Custo & Squads | `centros-custo` | [Existe] |
| RF-FIN-26 | Plano de Contas (mesmo componente de Configurações) | `plano-contas` | [Existe] |
| RF-FIN-27 | Categorias (formulário genérico) | `categorias` (`SettingsGenericForm`) | [Parcial] |
| RF-FIN-28 | Orçamentos por mês | `orcamentos` | [Existe] |
| RF-FIN-29 | Contatos (clientes & fornecedores) | `contatos` | [Existe] |
| RF-FIN-30 | Central de Relatórios | `relatorios` | [Existe] |
| RF-FIN-31 | Extrato (saldo corrido da conta) | `relatorios/extrato` | [Existe] |
| RF-FIN-32 | Performance Mensal | `relatorios/performance-mensal` | [Existe] |
| RF-FIN-33 | Performance Anual (ano × ano anterior) | `relatorios/performance-anual` | [Existe] |
| RF-FIN-34 | Relatórios agrupados (por descrição, dia, tipo DRE, categoria, tags, centro de custo, contraparte) | `relatorios/:slug` (`FinanceiroRelatorioAgrupado`) | [Existe] |
| RF-FIN-35 | DRE Gerencial (competência, inclui pendentes) | `dre` | [Existe] |
| RF-FIN-36 | MRR & Receita Recorrente | `mrr` | [Existe] |
| RF-FIN-37 | Indicações & Parcerias | `indicacoes` | [Existe] |
| RF-FIN-38 | Importar Movimentações por CSV (cria conta/categoria/centro de custo ausentes) | `importar` | [Existe] |
| RF-FIN-39 | Bloqueio de período (transação **paga** em período bloqueado é imutável) | `configuracoes/financeiro/bloqueio-periodo` | [Existe] |
| RF-FIN-40 | Auditoria financeira (`finance_audit_log`) | `configuracoes/financeiro/auditoria` | [Existe] |
| RF-FIN-41 | Integrações bancárias (Open Finance) | `configuracoes/financeiro/integracoes` marcada `soon: true` | [Planejado] |
| RF-FIN-42 | Cobrança de multa de fidelidade / geração contínua de ciclos | — | [Planejado] (ver Plano, Fases 2–3) |
| RF-FIN-43 | Anexos em lançamentos (bucket `finance-attachments`) | `FinanceiroAnexosTab`, migration `20260918_finance_attachments_bucket_and_table.sql` | [Existe] |
| RF-FIN-44 | Rateio de lançamento | `components/RateioModal.tsx` | [Existe] |

### 10.4 Marketing (módulo `marketing`)

| ID | Funcionalidade | Rota | Status |
|---|---|---|---|
| RF-MKT-10 | Conteúdo (Kanban de posts/vídeos/criativos) | `marketing/conteudo` | [Existe] |
| RF-MKT-11 | Campanhas & tráfego (ROI, Meta Ads/Google Ads) | `marketing/campanhas` | [Existe] |
| RF-MKT-12 | Analytics de Marketing (CAC, LTV, ROI) | `marketing/analytics` | [Existe] |
| RF-MKT-13 | Social Media | `marketing/social` (a própria tela informa "recurso ainda não conectado") | [Parcial] |
| RF-MKT-14 | Landing pages (gestão e analytics) + editor E-Empreenda | `marketing/landing-pages`, `marketing/landing-pages/eempreenda` | [Existe] |
| RF-MKT-15 | Formulários públicos | `marketing/formularios` | [Existe] |
| RF-MKT-16 | Automações (fluxo de mensagens, esperas) | `automacoes` (`MarketingAutomacoes.tsx`) | [Existe] |
| RF-MKT-17 | Consultor de marketing por IA | `POST /api/ai/marketing-advisor` | [Existe] |

### 10.5 Mensageria (módulo `engajamento`)

| ID | Funcionalidade | Rota | Status |
|---|---|---|---|
| RF-MSG-10 | Central omnichannel (contatos, mensagens, copiloto de análise) | `mensageria`; API `/api/whatsapp/*` | [Parcial] (envio real depende de provedor; ver §5.6) |
| RF-MSG-11 | Instâncias WhatsApp (QR code, conectar, webhook de entrada) | `POST/PUT/DELETE /api/whatsapp/instances*`, `POST /api/whatsapp/webhook/:instanceId` | [Existe] (provedor a definir — Plano 5.3) |
| RF-MSG-12 | Modelos de mensagem e automações de engajamento | `configuracoes/engajamento/modelos`, `…/automacoes` | [Existe] |

### 10.6 Agenda e Reuniões (módulo `agenda`, ativo também com `crm`)

| ID | Funcionalidade | Rota | Status |
|---|---|---|---|
| RF-AGD-10 | Calendário geral | `agenda/calendario` | [Existe] |
| RF-AGD-11 | Eventos & compromissos (reuniões, visitas, vistorias, test-drives) | `agenda/eventos` | [Existe] |
| RF-AGD-12 | Disponibilidade & horários de atendimento | `agenda/disponibilidade` | [Existe] |
| RF-AGD-13 | Configurações da agenda (Google Calendar bidirecional, salas, alertas) | `agenda/configuracoes`; `/api/google-calendar` | [Existe] |
| RF-AGD-14 | Salas de reunião (lista e sala) e relatório de reunião por IA | `agenda/reunioes`, `agenda/reunioes/:id`, `reunioes`; `POST /api/ai/reuniao-relatorio` | [Existe] |

### 10.7 Tarefas, RH/Equipe, Indicadores

| ID | Funcionalidade | Rota | Status |
|---|---|---|---|
| RF-TAR-10 | Tarefas em Kanban e Lista, métricas de desempenho, carga de trabalho | `tarefas` (módulo `produtividade`) | [Existe] |
| RF-TAR-11 | Categorias de tarefas e "Funis & Kanbans" configuráveis | `configuracoes/produtividade/categorias`, `configuracoes/kanbans` | [Existe] |
| RF-RH-10 | Colaboradores & squads (cadastro, desligar colaborador, metas) | `equipe` (módulo `rh`, `RHColaboradores.tsx`) | [Existe] |
| RF-RH-11 | Comissões por squad/meta | `finance_commission_entries` (migration `20260827_finance_commission_entries_and_categories.sql`) | [Existe] |
| RF-IND-10 | BI & Analytics (CPM & Indicadores) | `indicadores` (módulo `bi`) | [Existe] |
| RF-IND-11 | Relatórios Executivos (pilares Comercial, Financeiro, Operacional) | `relatorios`; `GET /api/crm/relatorios-executivos-summary` | [Existe] |

### 10.8 Dashboard e Performance IA

| ID | Funcionalidade | Rota | Status |
|---|---|---|---|
| RF-DSH-10 | Dashboard geral com filtro de período, funil, pódio de vendedores, atividades recentes, alertas de meta (>= 90%) | `dashboard` (`useDashboard.ts`) | [Existe] |
| RF-DSH-11 | Cartões por nicho (Tecnologia, Solar, Clínica, Imobiliária) | `DashboardStatsByNiche.tsx` | [Parcial] (vários cartões exibem `--` fixo) |
| RF-DSH-12 | Abas Comercial, Estratégica, Customer Success, Marketing, BI | `dashboard/components/*View.tsx` | [Existe] |
| RF-DSH-13 | Performance IA ("Cérebro") — simulações e auditoria preditiva | `performance-ia`; `POST /api/ai/performance-audit`, `/api/ai/pipeline-audit` | [Existe] |
| RF-DSH-14 | Aurora (chat executivo, chat por tenant, auditoria de configurações) | `POST /api/ai/aurora-chat`, `/api/ai/aurora-tenant-chat`, `/api/ai/settings-audit` | [Existe] |

### 10.9 Configurações (`configuracoes/*`, `SettingsLayout.tsx`)

| ID | Página | Rota (`/app/configuracoes/…`) | Gate | Status |
|---|---|---|---|---|
| RF-CFG-10 | Meu Perfil & Conta | `usuario/perfil` | logado | [Existe] |
| RF-CFG-11 | Preferências do Sistema | `usuario/preferencias` | logado | [Existe] |
| RF-CFG-12 | Preferências de Notificação | `usuario/notificacoes` | logado | [Existe] |
| RF-CFG-13 | Dados da empresa | `empresa/dados` | logado | [Existe] |
| RF-CFG-14 | Módulos & SaaS (redireciona ao Admin, aba tenants) | `empresa/modulos` → `/app/admin?tab=tenants` | master (rota destino) | [Existe] |
| RF-CFG-15 | Filiais / Unidades | `empresa/filiais` | logado | [Existe] |
| RF-CFG-16 | Nichos | `empresa/nichos` | logado | [Existe] |
| RF-CFG-17 | Equipe & convites | `empresa/equipe` | `requireTenantAdmin` | [Existe] |
| RF-CFG-18 | Cargos | `empresa/cargos` | `requireTenantAdmin` | [Existe] |
| RF-CFG-19 | Perfis & permissões (módulos por cargo) | `empresa/permissoes` | `requireTenantAdmin` | [Existe] |
| RF-CFG-20 | Funis & etapas | `crm/funis` | logado | [Existe] |
| RF-CFG-21 | Origens de leads | `crm/origens` | logado | [Existe] |
| RF-CFG-22 | Produtos (CRM) | `crm/produtos` | logado | [Existe] |
| RF-CFG-23 | Campos personalizados | `crm/campos` | logado | [Existe] |
| RF-CFG-24 | Prazos de atendimento (SLA) | `crm/sla` | logado | [Existe] |
| RF-CFG-25 | Gatilhos IA | `crm/gatilhos-ia` | logado | [Existe] |
| RF-CFG-26 | Rodízio de Leads (closers e formulário SDR) | `crm/rodizio` | logado | [Existe] |
| RF-CFG-27 | Configuração de Dashboards | `crm/dashboards` (cai no curinga `SettingsGenericForm`) | logado | [Parcial] |
| RF-CFG-28 | Categorias financeiras | `financeiro/categorias` | logado | [Existe] |
| RF-CFG-29 | Gestão financeira de times (squads) | `financeiro/squads` | `requireTenantAdmin` | [Existe] |
| RF-CFG-30 | Bloqueio de período | `financeiro/bloqueio-periodo` | `requireTenantAdmin` | [Existe] |
| RF-CFG-31 | Auditoria financeira | `financeiro/auditoria` | `requireTenantAdmin` | [Existe] |
| RF-CFG-32 | Integrações bancárias | `financeiro/integracoes` (`soon`) | — | [Planejado] |
| RF-CFG-33 | Modelos de mensagem / Automações de engajamento | `engajamento/modelos`, `engajamento/automacoes` | logado | [Existe] |
| RF-CFG-34 | Central de Aplicativos & Ads | `integracoes/apps` | logado | [Existe] |
| RF-CFG-35 | Servidores SMTP (com teste `POST /api/integrations/smtp-test`) | `integracoes/smtp` | logado | [Existe] |
| RF-CFG-36 | Webhooks de saída e logs | `integracoes/webhooks` (`ConfigIntegracoesWebhooks.tsx`) | logado | [Parcial] (PRD §5.6: tabelas existem; uso limitado) |
| RF-CFG-37 | Webhooks de SDR (pré-vendas) | `integracoes/sdr-webhooks` | logado | [Existe] |
| RF-CFG-38 | Conectores externos ERP/CRM | `integracoes/conectores-externos`; API `/api/integrations/external*` | escrita: `requireTenantAdmin` no servidor | [Existe] |
| RF-CFG-39 | Links dinâmicos para Aurora/Júlia | `integracoes/links-dinamicos` | logado | [Existe] |
| RF-CFG-40 | Backups automáticos | `sistema/backups` | logado | [Existe] |
| RF-CFG-41 | Aurora (controle, consumo e agentes) — só se módulo `aurora` ligado | `sistema/aurora` (`ia/aurora` redireciona) | logado | [Existe] |
| RF-CFG-42 | Qualquer outra sub-rota | `*` → `SettingsGenericForm` | logado | [Parcial] |

### 10.10 Admin/Master, Parceiros e Dev

| ID | Funcionalidade | Rota | Status |
|---|---|---|---|
| RF-ADM-10 | Painel SaaS com 8 abas: Visão Geral, Tenants & Instâncias, Módulos & Presets, Módulos (Manifest), Ferramentas (Registry), Faturamento & Planos, Logs & Auditoria, Saúde & Diagnóstico (`AdminSaaS.tsx`) | `admin?tab=…` (`requireMaster`) | [Existe] |
| RF-ADM-11 | Criar tenant + usuário administrador (`NovoTenantModal` → `POST /api/admin/tenant`) | `admin` | [Existe] |
| RF-ADM-12 | Ligar/desligar módulos por tenant e aplicar presets | `AdminModulesTab.tsx` | [Existe] |
| RF-ADM-13 | Trocar de tenant visualizado (master: qualquer; parceiro: só os de `tenant_partners`) | `Sidebar.tsx` (`canSwitchTenant`) | [Existe] |
| RF-ADM-14 | Redefinir credenciais do admin do tenant | `POST /api/admin/tenant-user/:userId/credentials` (`requireMaster`) | [Existe] |
| RF-ADM-15 | Cobrança automática dos planos do SaaS (gateway) | — a tabela de assinaturas é derivada dos tenants; ver §15 | [Planejado] |
| RF-PAR-10 | Visão de Parceiros (métricas dos tenants mapeados, RPC `platform_metrics_overview`) | `parceiros` (`requirePartner`) | [Existe] |
| RF-DEV-10 | Painel Dev, Projetos (+ detalhes), Sprints, Issues & Bugs, Repositórios, Ambientes | `dev/painel`, `dev/projetos`, `dev/projetos/:projectId`, `dev/sprints`, `dev/issues`, `dev/repositorios`, `dev/ambientes` (módulo `dev`) | [Existe] |

### 10.11 Módulos verticais

Cada vertical é habilitado por sua chave em `tenants.modules`. Para Clínica e Educação os aliases `clinica`/`clinicas` apontam às mesmas telas.

| ID | Vertical (chave) | Telas [Existe] (rota sob `/app`) |
|---|---|---|
| RF-VRT-10 | Clínica (`clinica`) | Painel Geral `clinicas/dashboard`; Agenda Médica `clinicas/agenda`; Profissionais `clinicas/profissionais`; Serviços `clinicas/servicos`; Planos de Tratamento `clinicas/tratamentos`; Pacientes `clinicas/pacientes`; Prontuários EHR `clinicas/prontuarios` (com `requireModule="clinica"`); Faturamento `clinicas/faturamento`; Estoque de insumos `clinicas/estoque`; Telemedicina `clinicas/telemedicina`; Exames `clinicas/exames`; BI Clínico `clinicas/bi` (resumos em `/api/clinica/*-summary`) |
| RF-VRT-11 | Imobiliário (`imobiliaria`) | Painel `imobiliario/dashboard`; Imóveis; Proprietários; Captações; Empreendimentos; Corretores; Visitas; Comissões (`requireTenantAdmin`). Públicos: `/imovel/:id`, `/corretor/:slug`. Atalhos `imobiliario/pipeline` e `imobiliario/leads` levam ao pipeline com `?nicho=imobiliario` |
| RF-VRT-12 | Automotivo/Concessionária (`automotivo` ≡ `concessionaria`, ligados juntos em `AdminModulesTab`) | Painel; Veículos; Captações; Avaliações; Consignações; Trocas & Repasses; Test-drives; Vendedores (reutiliza `Corretores`); Visitas (reutiliza `Visitas`). Aliases em `concessionaria/*` |
| RF-VRT-13 | Energia Solar (`solar`) | Painel; Projetos; Análise de Fatura & kWp (`dimensionamentos`/`analise-fatura`, com IA `POST /api/ai/solar-analyze-fatura`); Vistorias; Instalações; Homologações; Manutenções. Aliases em `solar/*` e `energia-solar/*` |
| RF-VRT-14 | Varejo (`varejo`) | Painel; PDV/Vendas; Pedidos; Estoque; Compras; Fornecedores |
| RF-VRT-15 | Educação (`educacao`) | Painel; Turmas (+ detalhes); Alunos; Conteúdo; Certificados; Mensalidades (`requireModule="educacao"`; resumo em `/api/education/mensalidades-summary`) |
| RF-VRT-16 | Pedidos (`PedidosVarejo.tsx`) existe, mas não consta no menu de Varejo em `navData.ts` (só acessível pela URL) | `varejo/pedidos` | [Parcial] |

### 10.12 Páginas públicas e de entrada

| ID | Funcionalidade | Rota | Status |
|---|---|---|---|
| RF-PUB-10 | Landing institucional e LP de vendas (calculadora de ROI, planos, FAQ) | `/landing`, `/lp` | [Existe] |
| RF-PUB-11 | Login e redefinição de senha (cadastro público redireciona ao login) | `/login`, `/redefinir-senha`, `/register` | [Existe] |
| RF-PUB-12 | Proposta pública, catálogo, portfólio de corretor, imóvel, formulário por nicho | `/proposta/:token`, `/catalogo/:tenantId`, `/corretor/:slug`, `/imovel/:id`, `/f/:niche` | [Existe] |
| RF-PUB-13 | Onboarding wizard e paleta de comandos | `OnboardingWizard.tsx`, `CommandPalette.tsx` | [Existe] |

---

## 11. Histórias de usuário e critérios de aceite

Formato: **Como** \<persona\>, **quero** \<ação\>, **para** \<benefício\>. Critérios em Dado/Quando/Então. Cada história cita a regra (RN, §12) e o código de referência. Histórias sobre comportamento ainda não implementado estão marcadas **[Planejado]**.

### 11.1 Leads e funil

**US-01 — Criar lead.** Como **SDR**, quero cadastrar um lead (nome, empresa, telefone, e-mail, origem), para iniciar a qualificação. *(`NewLeadModal`, RN-LEAD-01, RN-LEAD-05)*
- Dado que estou no pipeline, quando salvo o lead com nome preenchido, então ele aparece na lista/Kanban e no contador "Total".
- Dado que o tenant tem rodízio ativo em modo `round-robin` e eu não informei vendedor, quando o lead é gravado, então `seller` é preenchido com um closer elegível (RN-LEAD-05).
- Dado que informo vendedor manualmente, quando salvo, então o rodízio não altera `seller`.
- Dado que o lead foi criado, então score IA e temperatura são calculados em ~400 ms (RN-LEAD-01).

**US-02 — Mover lead no funil.** Como **Vendedor**, quero arrastar o card entre etapas, para refletir o avanço da negociação. *(`moveLead`, `PipelineKanbanBoard.handleDrop`)*
- Dado um lead na etapa A, quando o solto na etapa B, então `stageId` muda e persiste após recarregar a página.
- Dado que a etapa de destino é de ganho, então `status` vira `Fechado`; se for de perda, `Perdido`; nas demais, `Em Aberto` (o Kanban só grava esses três valores).
- Dado que movi o lead, então o score é recalculado sem reverter o `stageId` recém-gravado.

**US-03 — Importar leads por CSV.** Como **Gestor comercial**, quero importar uma planilha, para popular o funil sem digitação. *(`Importacao.tsx`)*
- Dado um CSV válido, quando mapeio as colunas e confirmo, então os leads são criados no funil selecionado.
- Dado registros repetidos, então a tela sinaliza os duplicados detectados (conforme a descrição da própria tela).

**US-04 — Receber lead por API.** Como **Admin do tenant**, quero que um site/sistema externo envie leads, para automatizar a captura. *(`POST /api/v1/leads`, `requireApiKey`, RN-GER-02)*
- Dado chave de API válida e `name` mais (`email` ou `phone`), quando envio, então o lead é criado (201).
- Dado um novo envio com o mesmo telefone (ou, na falta, o mesmo e-mail) no mesmo tenant, então o lead existente é atualizado e a resposta traz `deduped: true` (200), sem criar outro.
- Dado ausência de `name`, ou de `email` e `phone`, então a resposta é 400 e nada é gravado.

**US-05 — Rodízio entre closers.** Como **Gestor comercial**, quero distribuir leads novos entre closers ativos, para equilibrar a carga. *(RN-LEAD-05)*
- Dado 3 closers ativos com `rotation_active=true`, quando entram 3 leads sem vendedor, então cada closer recebe 1 (ordem alfabética, ponteiro `current_index`).
- Dado um closer com `rotation_blocked=true`, então ele nunca é sorteado.
- Dado `blockOnMultipleClients=true` e limite 2, quando um closer já tem 2 leads em aberto, então é excluído do sorteio.

### 11.2 Venda, proposta e contrato

**US-06 — Fechar venda recorrente de um produto.** Como **Vendedor**, quero vender R$ 997/mês por 12 meses, para gerar as cobranças mensais. *(`AddProdutoLeadModal`, `calculateSale`, RN-VEN-01..03)*
- Dado preço 997, vigência 12 meses e frequência mensal, quando confirmo, então são criados 12 lançamentos "A Receber" de R$ 997 ligados por `recurring_group_id` — nunca 1 de R$ 11.964.
- Dado forma de pagamento Pix, Dinheiro ou Cartão de Débito, então só a 1ª cobrança nasce "Pago"; as demais "A Vencer".
- Dado que a proposta foi criada, então nasce "Enviada" com validade de hoje + 15 dias.

**US-07 — Fechar venda única parcelada.** Como **Vendedor**, quero vender R$ 100,00 em 3x, para o cliente pagar em parcelas. *(RN-VEN-04, RN-VEN-05)*
- Dado total 100,00 e 3 parcelas, quando confirmo, então as parcelas são 33,33 + 33,33 + 33,34, com `installment_group_id`, `installment_number`, `installment_total` e vencimentos mensais.
- Dado 1 parcela, então não há `installment_group_id`.

**US-08 — Aplicar desconto.** Como **Vendedor**, quero dar desconto por tipo, para negociar. *(RN-VEN-06)*
- Dado item recorrente 1.000 × 12 com desconto `first_charge` de 200, então a 1ª cobrança é 800 e as demais 1.000.
- Dado desconto `recurring` de 100, então todas as cobranças são 900.
- Dado desconto `total` de 1.200 em 12 ciclos, então cada cobrança é 900.
- Dado desconto `percentage` de 10%, então cada cobrança é 900; percentual acima de 100 é limitado a 100 e o valor nunca fica negativo.

**US-09 — Implantação/setup.** Como **Vendedor**, quero cobrar uma taxa de implantação, para cobrir o onboarding. *(RN-VEN-07, RN-MRR-01)*
- Dado setup de 500 e mensalidade de 997, então a 1ª cobrança é 1.497 e a descrição indica "(inclui implantação)"; as seguintes são 997.
- Dado que a proposta é aceita, então o MRR do contrato não inclui os 500.

**US-10 — Venda multi-produto.** Como **Vendedor**, quero adicionar N produtos ao carrinho e fechar tudo numa proposta, para não criar propostas separadas. *(RF-PRD-14)*
- Dado 2 itens no carrinho, quando confirmo, então existe 1 proposta com 2 itens e `valor` = soma dos `totalProjectedAmount` dos itens.
- Dado os 2 itens, então cada um gera seu próprio grupo de cobranças (nunca ciclos de produtos diferentes no mesmo grupo).
- Dado que vendo 1 produto só, então não preciso clicar em "Adicionar" antes de confirmar.

**US-11 — Valor do lead = soma das propostas.** Como **Gestor comercial**, quero que o valor do lead reflita todas as suas propostas, para prever receita. *(RN-LEAD-02)*
- Dado um lead com propostas de 1.000 e 2.500, então `lead.value` = 3.500.
- Dado que excluo a de 2.500, então `lead.value` volta a 1.000.
- Dado que a reconciliação rode várias vezes, então o valor não muda (idempotente).

**US-12 — Editar contrato "modo Word".** Como **Vendedor**, quero montar o contrato com cláusulas de 1 clique e pré-visualizar em A4, para enviar ao cliente. *(`PropostaEditorWordModal`)*
- Dado item recorrente de 12 meses, então a tabela mostra "1× valor do ciclo" e o total do contrato no rodapé.
- Dado que gero o PDF, então o conteúdo coincide com a pré-visualização.

**US-13 — Cliente aceita a proposta.** Como **Cliente final**, quero abrir o link e aceitar, para formalizar a compra. *(`/proposta/:token`, `POST /api/public-proposal/:token/accept`, RN-VEN-08)*
- Dado token válido (16+ caracteres), quando aceito, então `proposals.status` = "Aceita".
- Dado token inexistente, então 404; token com menos de 16 caracteres, 400.
- Dado proposta "Aceita", quando um usuário do tenant carrega o app, então é criado 1 contrato "Ativo" (`proposal_id`) e o lançamento de contrato; se houver itens de implantação, um lançamento à parte.
- Dado que a reconciliação rode de novo, então nenhum contrato/lançamento é duplicado (RN-GER-01).
- **Observação:** o aceite público só altera o status; contrato e lançamentos são gerados pelo cliente web na próxima reconciliação (ver Q-03, §19).

**US-14 — Lead ganho vira cliente sem duplicar.** Como **Vendedor**, quero que ao ganhar um lead o cliente entre na base sem duplicar. *(RN-CLI-01)*
- Dado lead sem `clientId` cujo CNPJ já existe em `clientes`, quando vira "Fechado", então é vinculado ao existente (nenhum novo).
- Dado lead sem CNPJ e e-mail já existente, então o vínculo é por e-mail.
- Dado nenhum documento/e-mail existente, então nasce 1 cliente "Ativo" com cidade/UF nulas (sem dado inventado).
- Dado dois disparos simultâneos (duplo clique ou reconciliação), então só 1 cliente é criado.
- Dado `clientId` do lead apontando a cliente já excluído, então o lead é tratado como não vinculado e revinculado.

**US-15 — Editar cliente.** Como **Vendedor**, quero corrigir dados de um cliente, para manter a base limpa. *(`Clientes.tsx` ~L106–L131)*
- Dado um cliente existente, quando altero o nome e salvo, então a lista atualiza sem recarregar.
- Dado que altero documento/e-mail para o de outro cliente, então o sistema bloqueia: "Já existe um cliente cadastrado com esse documento/e-mail".
- Dado erro do banco, então a lista local não exibe a alteração como salva.

**US-16 — Cadastrar produto com fidelidade.** Como **Gestor**, quero definir prazo mínimo de permanência, para proteger a receita recorrente. *(`useProdutoForm.ts`)*
- Dado produto recorrente, quando ativo "Fidelidade" com 12 meses, então `hasLoyalty=true` e `loyaltyMonths=12`.
- Dado campo vazio/inválido, então o padrão é 12.
- **[Planejado]** Dado contrato com fidelidade, quando cancelado antes do prazo, então gerar lançamento de multa (Plano 2.4–2.5).

### 11.3 Financeiro

**US-17 — Lançar despesa.** Como **Financeiro**, quero registrar uma despesa com categoria, centro de custo e conta, para refletir no DRE e no caixa. *(`FinanceiroDespesas`, `NovaOperacaoModal`, RN-FIN-06)*
- Dado despesa com valor, data, categoria e status "Pago" em período **não** bloqueado, quando salvo, então ela entra no Fluxo de Caixa e no DRE.
- Dado data em período bloqueado e status "Pago", então o sistema recusa: "Este período está bloqueado para fechamento".
- Dado status "A Vencer", então o lançamento é aceito mesmo em período bloqueado (só transação paga é imutável).

**US-18 — Despesa recorrente/parcelada.** Como **Financeiro**, quero repetir a despesa por N ciclos ou dividir em parcelas, para não digitar várias vezes. *(RN-VEN-03..05; `splitInstallments`, `addPeriodo`)*
- Dado ciclo mensal a partir de 31/01, então os vencimentos caem em 28 (ou 29)/02, 31/03, 30/04… (RN-VEN-03).
- Dado 100,00 em 3x, então 33,33/33,33/33,34.

**US-19 — Conciliar extrato.** Como **Financeiro**, quero importar extrato e conciliar com lançamentos, para garantir que banco e sistema batem. *(`FinanceiroConciliacao`, RN-FIN-09)*
- Dado crédito de R$ 997,00 no extrato e um lançamento "Receber" de 997,00 ainda não usado, quando clico em "Conciliar Automaticamente", então o item fica `conciliado=true` com `match_sugerido` = descrição do lançamento.
- Dado dois lançamentos de mesmo valor e um só item no extrato, então cada lançamento é usado no máximo uma vez por rodada.
- Dado item sem correspondência, então continua pendente e posso conciliá-lo manualmente.
- **Limitação:** não altera o status do lançamento; casa só por valor (tolerância 0,01) e sentido. O botão se chama "(IA)", mas a regra é determinística.

**US-20 — Bloquear período.** Como **Admin do tenant**, quero fechar um mês, para impedir edição de transações pagas. *(RF-FIN-39)*
- Dado período bloqueado, quando tento criar/editar transação paga nele, então a operação é recusada.
- Dado que removo o bloqueio, então as transações pagas voltam a ser editáveis.
- Dado usuário sem `isTenantAdmin` (nem master), então a rota de bloqueio redireciona a `/app`.

**US-21 — Ver inadimplência.** Como **Financeiro**, quero listar cobranças vencidas por cliente e faixa de atraso, para priorizar a cobrança. *(`FinanceiroInadimplencia`)*
- Dado lançamentos "Receber" com status "Atrasado", então eles somam no KPI "Vencido (Inadimplência)" e aparecem agrupados por cliente.

**US-22 — Importar movimentações.** Como **Financeiro**, quero importar CSV, para migrar dados de planilha. *(`FinanceiroImportarMovimentacoes`)*
- Dado CSV com categoria/conta/centro de custo inexistentes, quando importo, então eles são criados automaticamente e os lançamentos ligados a eles.

### 11.4 Plataforma

**US-23 — Criar tenant.** Como **Master**, quero provisionar uma empresa com administrador, para começar a atendê-la. *(`NovoTenantModal`, `POST /api/admin/tenant`)*
- Dado nome, nicho, e-mail e senha (mín. 6 caracteres) iguais à confirmação, quando salvo, então são criados o tenant (`status` "Active", plano informado ou `start`, fuso `America/Sao_Paulo`, cor `#2563EB` se inválida) e o usuário administrador.
- Dado e-mail já existente em `users`, então 409 "Este e-mail já está cadastrado no sistema".
- Dado que troco o nicho no formulário, então os módulos sugeridos mudam conforme `DEFAULT_MODULES_BY_NICHE`.
- Dado usuário não master, então a API recusa (`requireMaster`).

**US-24 — Ligar módulo.** Como **Master**, quero ligar/desligar módulos de um tenant, para adequar a oferta ao plano. *(`AdminModulesTab.handleToggleModule`)*
- Dado o tenant X e o módulo `solar` desligado, quando ligo, então `tenants.modules.solar=true` é gravado e, se X for o tenant ativo, a barra lateral mostra "Energia Solar" imediatamente.
- Dado que ligo `automotivo`, então `concessionaria` liga junto (e vice-versa).
- Dado um preset (ex.: "Clínica"), então o conjunto de módulos do preset substitui o atual.

**US-25 — Restringir módulos por cargo.** Como **Admin do tenant**, quero limitar os módulos de um cargo, para separar áreas. *(`ConfigEmpresaCargos`, `Sidebar.canAccessModule`)*
- Dado cargo com `modulos=[crm, financeiro]`, quando um usuário desse cargo entra, então o menu só mostra CRM e Financeiro (UX).
- Dado o mesmo usuário abrindo `/app/clinicas/prontuarios` por URL, então é redirecionado a `/app` (uma das duas rotas com `requireModule`).
- Dado cargo sem módulos definidos, então nenhuma restrição por cargo é aplicada.
- **Limitação:** o cargo é casado com `user.role` por nome; não há RBAC granular (ver §13).

**US-26 — Parceiro acompanha tenants.** Como **Parceiro**, quero ver as métricas dos tenants vinculados, para gerir a carteira. *(`/app/parceiros`)*
- Dado usuário com `partnerId`, então acessa `/app/parceiros` e o seletor de tenant lista só os de `tenant_partners` (RLS).
- Dado usuário comum, então `/app/parceiros` redireciona a `/app`.

**US-27 — Isolamento entre tenants.** Como **Admin do tenant**, quero ter certeza de que outros tenants não veem meus dados. *(RLS, `has_tenant_access`)*
- Dado usuário do tenant A, quando consulta qualquer tabela com `tenant_id`, então só recebe linhas do tenant A, mesmo chamando o Supabase diretamente.
- Dado proposta de outro tenant no estado local (troca de tenant do master), então `syncAcceptedProposal` a ignora (`prop.tenant_id !== tenantId`).

**US-28 — Cancelar contrato e medir churn.** Como **Financeiro**, quero cancelar um contrato e ver MRR/churn atualizados. *(RN-MRR-02, `updateContract`)*
- Dado contrato "Ativo", quando marco "Cancelado", então `cancelledAt` é carimbado uma só vez e o MRR ativo deixa de contá-lo.
- Dado nenhum contrato, então o churn mostra "Sem dados" (não "0,0%") no dashboard.

**US-29 — Ver dashboard por período.** Como **Gestor comercial**, quero filtrar o dashboard por datas, para comparar períodos. *(`useDashboard.ts`, RN-MRR-01)*
- Dado um intervalo, então leads, conversão, funil e ranking usam só leads com `date` no intervalo.
- Dado o mesmo intervalo, então "MRR Ativo" não muda (é saldo atual).

**US-30 — Configurar funil.** Como **Admin do tenant**, quero criar funis e etapas, para adequar o processo comercial. *(`configuracoes/crm/funis`, `crm_funis`, `crm_pipeline_stages`)*
- Dado um novo funil com etapas, quando salvo, então ele aparece como opção no Pipeline.
- Dado que excluo uma etapa, então a tela pede confirmação antes de remover.

---

## 12. Regras de negócio

Fontes: `src/lib/saleCalculator.ts`, `src/lib/leadScore.ts`, `src/lib/revenueMetrics.ts`, `src/contexts/DataContext.tsx`, `supabase/migrations/20260905_lead_round_robin_closers.sql`, `server.ts`.

### 12.1 Venda: recorrência, parcelamento, desconto, datas

| ID | Regra | Fonte |
|---|---|---|
| RN-VEN-01 | **Recorrência nunca multiplica o preço numa cobrança única.** "R$ 997/mês por 12 meses" = 12 cobranças de R$ 997. `totalProjectedAmount` é só projeção/relatório, nunca o valor de um lançamento. | `saleCalculator.ts` (cabeçalho) |
| RN-VEN-02 | **Base do item** = `max(0, preço unitário) × max(1, quantidade)`. Recorrência e parcelamento são conceitos distintos: `billingType` = `recurring` (um lançamento por ciclo, `recurring_group_id`) ou `one_time` (N parcelas, `installment_group_id`). | `calculateSale` |
| RN-VEN-03 | **Nº de ciclos recorrentes** = `max(1, round(vigênciaMeses ÷ mesesPorCiclo))`. Meses por ciclo: mensal 1, bimestral 2, trimestral 3, semestral 6, anual 12, personalizado `max(1, customCycleMonths)`; padrão 1. Vigência `null` ("sem prazo") gera um lote inicial de **12** ciclos (`OPEN_ENDED_BATCH_CYCLES`); os seguintes são manuais e o lançamento leva nota explicando isso. | `cycleMonthsFor`, `calculateSale` |
| RN-VEN-04 | **Vencimentos** avançam por `addPeriodo`: semanal +7 dias, quinzenal +15 dias, demais por meses. Parcelas de venda única são sempre mensais a partir do 1º vencimento. | `addPeriodo`, `calculateSale` |
| RN-VEN-05 | **Clamp de fim de mês:** somar meses trunca o dia ao último dia do mês de destino (31/01 + 1 mês = 28/02, ou 29 em bissexto), nunca "estoura" para março (`addMonthsClamped`). | `saleCalculator.ts` |
| RN-VEN-05a | **Arredondamento de centavos:** o total é convertido a centavos (`round(total × 100)`); cada parcela recebe `floor(centavos ÷ N)` e a **última** absorve o resto (100,00 em 3x = 33,33 + 33,33 + 33,34). Nunca se perde 1 centavo. | `splitInstallments` |
| RN-VEN-06 | **Tipos de desconto** (`DiscountType`): `none`; `first_charge` (R$ abatido só da 1ª cobrança, piso 0); `recurring` (R$ abatido de **cada** ciclo); `total` (R$ dividido igualmente pelos ciclos); `percentage` (% sobre a base, limitado a 0–100). Venda única: `percentage` reduz o total; qualquer outro tipo abate R$ do total; resultado nunca negativo. Valores negativos são tratados como 0. | `calculateSale` |
| RN-VEN-07 | **Implantação/setup** é cobrada uma vez e somada **só na 1ª cobrança** (recorrente) ou ao total antes de dividir (venda única). Nunca entra em `recurringChargeAmount` nem no MRR. Fórmulas: `firstChargeAmount = max(0, ciclo − descontoDa1ª) + setup`; `total projetado = 1ª + recorrente × (ciclos − 1)`. | `calculateSale` |
| RN-VEN-08 | **Aceite de proposta gera:** (a) 1 contrato "Ativo" com `proposalId`, `mrr` = mensalidade real, `totalValue` = recorrente + avulso; (b) 1 lançamento "Receber" "Contrato / Recorrente" (status "A Vencer") com o total recorrente; (c) se houver itens `one_time`, 1 lançamento "Implantação / Setup" à parte. Data de término = assinatura + meses do contrato. | `syncAcceptedProposal` |
| RN-VEN-09 | **Desconto no aceite:** como `proposal_items` guarda só o preço de catálogo, o desconto fechado é redistribuído proporcionalmente: `razão = min(1, prop.valor ÷ (recorrente + avulso))`, aplicada a ambos os totais. | `syncAcceptedProposal` |
| RN-VEN-10 | **Meses do contrato** = maior `contract_months` entre os itens da proposta (prazo realmente negociado); na falta, maior `contractMonths` do produto do catálogo. **MRR do contrato** = total recorrente final ÷ meses do contrato (sem meses, o total recorrente). | `syncAcceptedProposal` |
| RN-VEN-11 | **Convenção legada:** em item recorrente, `quantidade` = ciclos × unidades (ver TRD §9 e Plano, Fase 2). O editor compensa isso na exibição ("1× valor do ciclo"). | `syncAcceptedProposal`, PRD §5.2 |
| RN-VEN-12 | **Status de proposta:** `Aberta → Enviada → Aceita / Recusada`; o tipo prevê `Expirada`, mas nenhum código a atribui (**[Planejado]**). A venda pelo modal cria a proposta como "Enviada" com validade de +15 dias; o aceite público muda para "Aceita". | `proposalPdf.ts`, `AddProdutoLeadModal`, `server.ts` |
| RN-VEN-13 | **Forma de pagamento imediata** (Dinheiro, Pix, Cartão de Débito): só a 1ª cobrança nasce "Pago"; as demais "A Vencer". | `AddProdutoLeadModal` |
| RN-VEN-14 | **Estoque:** proposta aceita baixa estoque dos itens (trigger em migration). | `20260906_baixa_estoque_venda_aceita.sql` |

### 12.2 Lead: valor, score, temperatura, rodízio

| ID | Regra | Fonte |
|---|---|---|
| RN-LEAD-01 | **Score IA (0–100)** = `round(scoreEtapa × 0,55 + (50 + deltaNotas) × 0,45 + deltaPrioridade)`. Base da etapa (por nome/status normalizado, sem acento): ganho/fechado 96; perdido/desistência 12; negociação/proposta/contrato/fechamento 80; reunião/apresentação/demo 65; diagnóstico/qualificação/contato/em andamento 48; novo/prospecção/entrada 30; padrão 35 (ou, com lista de etapas, `30 + progresso × 55`). | `leadScore.ts` |
| RN-LEAD-01a | **Notas:** volume ≥ 6 notas +10, ≥ 3 +6, ≥ 1 +3; palavras de compra forte +20; sentimento favorável +10; categoria decisor/interesse +8; objeção severa/concorrência −22; adiamento −10; categoria objeção −10. **Prioridade:** Alta +5, Baixa −5. | `leadScore.ts` |
| RN-LEAD-01b | **Limites do score:** ganho/fechado 90–100; perdido 5–25; demais 10–95. | `leadScore.ts` |
| RN-LEAD-01c | **Temperatura:** score ≥ 70 = Quente; ≥ 40 = Morno; senão Frio. **Probabilidade:** ≥ 80 → 85%; ≥ 70 → 70%; ≥ 40 → 45%; senão 20%. | `leadScore.ts` |
| RN-LEAD-01d | O recálculo ocorre ~400 ms após mudança de status/etapa, usando o lead já mesclado (para não reverter o `stageId`). Também existe `POST /api/leads/calculate-score` no servidor. | `DataContext.updateLead`, `server.ts` |
| RN-LEAD-02 | **Valor do lead = soma de `valor` de todas as suas propostas**, recalculada do zero a cada criação/exclusão/atualização/aceite (idempotente). `productIds` do lead acumula sem duplicar. | `sumProposalsValueForLead` |
| RN-LEAD-03 | **Status do Kanban:** `Fechado` (etapa de ganho), `Perdido` (etapa de perda), `Em Aberto`. "Leads ativos" = todos exceto `Perdido` (inclui `Fechado`); "pipeline em aberto" = exclui `Fechado` e `Perdido`. | `PipelineKanbanBoard`, `revenueMetrics.ts` |
| RN-LEAD-04 | **Dedup na captura por API:** por `tenant_id` + telefone (só dígitos) e, na falta, e-mail (minúsculo). Se existe, atualiza e devolve `deduped: true`; chamada sem reserva nunca regride etapa/valor de lead que já tem histórico. | `server.ts` `POST /api/v1/leads` |
| RN-LEAD-05 | **Rodízio (trigger `assign_lead_round_robin`)**: só em criação e só se `seller` vier vazio. Modo em `app_settings.rodizio_global_config`: `manual` (não atribui), `priority` (menos leads ativos primeiro, desempate por nome), `round-robin` (padrão; ponteiro atômico `current_index`, ordem alfabética, `offset = (índice−1) mod elegíveis`). **Elegível:** colaborador Ativo, cargo contendo "closer", `rotation_active` (padrão true), não `rotation_blocked`, tipo/origem aceito (lista vazia aceita todos), e — se `blockOnMultipleClients` — com menos leads em aberto que `multiClientThreshold` (padrão 2). Sem elegíveis, o lead fica sem vendedor. | migration `20260905_lead_round_robin_closers.sql` |

### 12.3 Cliente

| ID | Regra | Fonte |
|---|---|---|
| RN-CLI-01 | **Lead ganho → cliente sem duplicar:** procura em `clientes` por `documento` (CNPJ do lead) e, se não há documento, por `email`; existindo, só vincula (`clientId`, `clientName`); senão cria "Ativo" sem cidade/UF/telefone/e-mail inventados. Um `clientId` órfão (cliente apagado) conta como não vinculado. | `createClientFromWonLead` |
| RN-CLI-02 | **Trava anti-corrida:** o id do lead é marcado em `reconciledWonLeadIdsRef` **antes** do primeiro `await`, e a reconciliação em lote é sequencial — impede dois inserts concorrentes do mesmo cliente. | `DataContext.tsx` |
| RN-CLI-03 | **Cadastro/edição manual:** bloqueia se já existe outro cliente com o mesmo documento (quando informado) ou e-mail. Índice único no banco é **[Planejado]** (Plano 1.1). | `Clientes.tsx` |

### 12.4 MRR, contratos e churn

| ID | Regra | Fonte |
|---|---|---|
| RN-MRR-01 | **MRR** = soma de `mrr` dos contratos que não estão `Cancelado` nem `Perdido`; exclui implantação/setup. É **saldo atual**, não recortado por período. Fonte única: `getMRR`. | `revenueMetrics.ts` |
| RN-MRR-02 | `cancelledAt` é carimbado automaticamente na 1ª vez que o contrato vira "Cancelado". | `DataContext.updateContract` |
| RN-MRR-03 | **Churn (%)** sem período = cancelados ÷ todos os contratos; com período = cancelados com `cancelledAt` no período ÷ contratos sem `cancelledAt` ou cancelados no período (fallback: total). Uma casa decimal. Em nicho "Clínica" com consultas, o dashboard troca para "pacientes sem visita há 90 dias ÷ pacientes". | `getChurnRate`, `useDashboard.ts` |
| RN-MRR-04 | **Projeção de MRR:** `MRR atual × (1 − churnMensal)^n` com churn dos últimos 3 meses; sem pelo menos 2 meses de histórico de contratos, retorna `insufficientData` em vez de estimar. Horizontes padrão 0, 1, 3, 6, 12 meses. | `getRevenueProjection` |
| RN-MRR-05 | **Clientes ativos** = nomes únicos com ao menos 1 contrato ativo. **Conversão** = leads `Fechado` ÷ total (1 casa). **Pipeline em aberto** = soma de valor dos leads nem `Fechado` nem `Perdido`. | `revenueMetrics.ts` |

### 12.5 Financeiro

| ID | Regra | Fonte |
|---|---|---|
| RN-FIN-01 | Status de lançamento: `A Vencer`, `Atrasado`, `Pago` (mais `Cancelado` em cobranças). Tipos: `Receber` e `Pagar`. | `DataContext.tsx`, `FinanceiroVisaoGeral` |
| RN-FIN-02 | **Regime:** Fluxo de Caixa usa só `Pago` (caixa); Projeção usa só `A Vencer` (previsto); DRE é por competência e inclui pendentes. Realizado e projetado nunca se misturam. | descrições das telas |
| RN-FIN-03 | **Saldo da conta** = saldo inicial (com sinal) + lançamentos da conta + transferências recebidas − enviadas (só pagas). Há no máximo 1 conta `is_principal` por tenant (índice único parcial; `setContaPrincipal` desmarca a anterior antes). | `financeEngine.saldoDaConta`, `DataContext` |
| RN-FIN-04 | **Categoria vinculada:** lançamentos automáticos gravam `category_id` resolvendo/criando categoria por nome+tipo ("Contrato / Recorrente", "Implantação / Setup", "Vendas / Serviços"), pois o DRE lê o id. Conta bancária e centro de custo não são adivinhados. | `resolveFinanceCategoryId` |
| RN-FIN-05 | **Excluir proposta** limpa também o que dela depende: contrato auto-gerado, lançamentos com `proposal_id` e o valor do lead (recalculado). | `deleteProposal` |
| RN-FIN-06 | **Bloqueio de período:** transação `Pago` com data dentro de um bloqueio é imutável; pendente no mesmo intervalo é livre. | `checkFinanceEntryLock` |
| RN-FIN-07 | **Liquidez** = receita paga ÷ despesa paga × 100 (100% se não há despesa e há receita). **Burn rate** = despesa − receita, só quando a despesa é maior. | `FinanceiroVisaoGeral` |
| RN-FIN-08 | Receita avulsa do período = lançamentos pagos na categoria "Implantação / Setup". | `FinanceiroVisaoGeral` |
| RN-FIN-09 | **Conciliação automática:** para cada item não conciliado do extrato, pega o 1º lançamento ainda não usado com `|valor − item| < 0,01` e sentido igual (crédito ↔ Receber, débito ↔ Pagar); grava `conciliado` e `match_sugerido`. Não usa data, descrição nem muda o status do lançamento. | `FinanceiroConciliacao.handleConciliarAuto` |

### 12.6 Gerais

| ID | Regra | Fonte |
|---|---|---|
| RN-GER-01 | **Idempotência do aceite:** contrato/lançamentos por `proposal_id` (índice único no banco para contrato); contratos legados sem `proposal_id` casam por cliente+plano normalizados uma única vez e recebem o vínculo. Cada proposta é reconciliada no máximo 1× por sessão para evitar rajadas de PATCH. | `syncAcceptedProposal` |
| RN-GER-02 | **Idempotência de integrações:** `POST /api/v1/leads` por telefone/e-mail (RN-LEAD-04); `POST /api/v1/finance-entries` exige `externalId` e deriva o id do lançamento dele; API por chave `x-api-key` com log de uso. | `server.ts` |
| RN-GER-03 | **Isolamento:** toda tabela de negócio tem `tenant_id` e RLS; o cliente web nunca processa registro de outro tenant. | migrations `rls_tenant_isolation_phase1`, `syncAcceptedProposal` |
| RN-GER-04 | **Valores monetários** são lidos por `parseCurrencyBR` (aceita number ou string BR) e gravados em `numeric(15,2)`. | `utils.ts` |
| RN-GER-05 | **Não inventar dados:** métricas sem base retornam "Sem dados"/`--`/`insufficientData` em vez de zero ou valor estimado. | `DashboardStatsByNiche`, `getRevenueProjection` |

---

## 13. Matriz de permissões

Verificado em `src/components/ProtectedRoute.tsx`, `src/App.tsx`, `src/components/layout/Sidebar.tsx`, `navData.ts` e `server.ts`.

**Flags de usuário** (`AuthContext`): `isMaster` (plataforma), `isTenantAdmin` (admin do próprio tenant, `users.is_tenant_admin`), `partnerId` (organização parceira, `users.partner_id`), `role` (texto livre, casado com `cargos.nome`).

### 13.1 Rotas — o que o **código bloqueia**

Legenda: **Sim** = acessa; **Não** = redirecionado a `/app`; **—** = não se aplica.

| Área / rota | Mecanismo | Master | Admin do tenant | Parceiro | Usuário comum |
|---|---|---|---|---|---|
| Qualquer `/app/*` (exige sessão) | `ProtectedRoute` (sem flag) | Sim | Sim | Sim | Sim (sem sessão: `/login`) |
| `/app/admin` (Painel SaaS) | `requireMaster` | Sim | Não | Não | Não |
| `/app/parceiros` | `requirePartner` (master **ou** `partnerId`) | Sim | Não* | Sim | Não |
| `configuracoes/empresa/equipe`, `…/cargos`, `…/permissoes` | `requireTenantAdmin` | Sim | Sim | Não* | Não |
| `configuracoes/financeiro/squads`, `…/bloqueio-periodo`, `…/auditoria` | `requireTenantAdmin` | Sim | Sim | Não* | Não |
| `imobiliario/comissoes` | `requireTenantAdmin` | Sim | Sim | Não* | Não |
| `clinica(s)/prontuarios` | `requireModule="clinica"` | Sim (ignora) | Restrito só se o **cargo** tiver módulos e não incluir `clinica` | idem | idem |
| `educacao/mensalidades` | `requireModule="educacao"` | Sim (ignora) | idem | idem | idem |
| `empresa/modulos` | redireciona a `/app/admin?tab=tenants` | Sim | Não | Não | Não |

\* Só passa se o usuário também tiver a flag exigida (ex.: um parceiro que seja admin do tenant).

### 13.2 API (`server.ts`) — o que o **servidor** aplica

| Rota | Guarda | Observação |
|---|---|---|
| `/api/admin/tenant`, `/api/admin/tenant-admin-user/:id`, `/api/admin/tenant-user/:id/credentials` | `requireUser` + `requireMaster` | usa `service_role` |
| `/api/integrations/external*` (criar/editar/excluir/testar) | `requireUser` + `requireTenantAdmin` | — |
| `/api/admin/permission-check-log` | `requireUser` | qualquer usuário autenticado |
| Demais `/api/*` (dashboard, finance, crm, ai, whatsapp, settings…) | `requireUser` | sem checagem de cargo |
| `/api/v1/*` | `requireApiKey` (`x-api-key`) | integrações externas |
| `/api/public-proposal/:token`, `/api/public/lead-capture`, `/api/auth/tenant-theme` | públicas | token / sem sessão |

### 13.3 Só UX (não é barreira de segurança)

| Comportamento | Onde | Por que é só UX |
|---|---|---|
| Ocultar seções do menu por módulo do tenant e por módulos do cargo | `Sidebar.tsx` (`canAccessModule`), `MobileNav.tsx` | Digitar a URL abre a tela; só `prontuarios` e `mensalidades` têm `requireModule` na rota |
| `requireModule` só olha o **cargo** | `ProtectedRoute.tsx` | Não checa se o módulo está ligado no tenant; tenant com `solar` desligado ainda abre `/app/energia-solar/*` por URL (a RLS protege só o isolamento entre tenants, não a oferta comercial) |
| Ocultar "Painel SaaS & Infra" e "Portal de Parceiros" | `navData.ts` (`reqCondition`) | A rota tem guarda própria (`requireMaster`/`requirePartner`), então aqui é conveniência |
| Simulação de perfil ("Simulação ativada para o perfil") | `AdminModulesTab.handleSwitchRole` | Troca `role` apenas na sessão local |
| Seletor de tenant / filial | `Sidebar.tsx` | O que o usuário efetivamente enxerga é decidido pela RLS (`has_tenant_access`, `tenant_partners`) |
| Cargo sem `modulos` = sem restrição | `Sidebar.tsx`, `ProtectedRoute.tsx` | Cargo é texto livre comparado a `user.role`; não há tabela de papéis/permissões (Plano 4.3) |

### 13.4 Onde a permissão é realmente garantida

- **RLS no banco:** isolamento por `tenant_id`; escrita em cargos/permissões/bloqueio de período/squads exige `is_tenant_admin` ou `is_master` (migrations `20260921_cr1_*`, citadas em `ProtectedRoute.tsx`); parceiros via `tenant_partners`.
- **[Planejado]** RBAC granular por permissão (ler/criar/editar/excluir por módulo) — hoje inexistente.

---

## 14. Glossário de domínio

| Termo | Definição no S.P.Y. |
|---|---|
| **Tenant** | Empresa cliente do SaaS; unidade de isolamento de dados (`tenants`, `tenant_id`). |
| **Nicho** | Segmento do tenant (Tecnologia, Solar, Imobiliária, Educação, Clínica, Agronegócio, Varejo, Concessionária, Parceira Geral) — sugere módulos e define cartões do dashboard. |
| **Módulo** | Conjunto de telas habilitável por tenant (`tenants.modules`); ver §15. |
| **Vertical** | Módulo específico de um nicho (Clínica, Imobiliário, Automotivo, Solar, Varejo, Educação). |
| **Master** | Usuário da plataforma (`is_master`) que gerencia tenants, módulos e parceiros. |
| **Parceiro** | Organização (`partners`) que acompanha vários tenants via `tenant_partners`. |
| **Lead** | Contato/oportunidade em qualificação ou negociação, com etapa, valor, score e vendedor. |
| **Funil / Pipeline** | Sequência configurável de etapas por onde o lead avança (`crm_funis`, `crm_pipeline_stages`); há funis SDR e Comercial. |
| **Etapa** | Coluna do funil; pode ser de ganho ou perda. |
| **SDR** | Pré-vendas: qualifica leads e passa ao comercial. |
| **Closer** | Vendedor que fecha; é quem entra no rodízio (cargo contém "closer"). |
| **Rodízio** | Distribuição automática de leads novos entre closers elegíveis (RN-LEAD-05). |
| **Squad** | Time de vendas/operação com meta e comissão (`squads`, centros de custo & squads). |
| **Decisor** | Contato com poder de compra; registrado em contatos do cliente e usado no score. |
| **Score IA / Temperatura** | Nota 0–100 e classe Quente/Morno/Frio (RN-LEAD-01). |
| **Proposta** | Documento comercial com itens, valor e validade; estados na RN-VEN-12. |
| **Contrato** | Registro ativo gerado ao aceitar proposta; guarda `mrr`, `totalValue`, datas. |
| **MRR** | Receita mensal recorrente dos contratos ativos (RN-MRR-01). |
| **Ciclo** | Período de cobrança de uma assinatura (mensal, trimestral etc.). |
| **Vigência / Duração** | Meses totais do contrato recorrente; "sem prazo" = contínua. |
| **Recorrência × parcelamento** | Recorrente = uma cobrança por ciclo, indefinida ou por vigência; parcelamento = um valor único dividido em N parcelas. |
| **Implantação (setup)** | Taxa única de onboarding, somada à 1ª cobrança e fora do MRR. |
| **Fidelidade** | Prazo mínimo de permanência do produto recorrente, com multa % por cancelamento antecipado (armazenada; cobrança automática **[Planejado]**). |
| **LTV** | Valor do cliente ao longo do tempo; no painel financeiro o "LTV Projetado (12m)" é `MRR × 12` (aproximação). |
| **CAC / CPL** | Custo de aquisição / custo por lead; o CPL do painel = gasto pago em categorias de marketing ÷ nº de leads. |
| **Churn** | Perda de contratos (ou pacientes, na Clínica); RN-MRR-03. |
| **Inadimplência** | Contas a receber "Atrasado". |
| **DRE** | Demonstração de resultados por competência, por categoria/tipo. |
| **Centro de custo** | Dimensão de análise dos lançamentos (também usada para squads). |
| **Conciliação** | Casar o extrato bancário importado com os lançamentos (RN-FIN-09). |
| **Bloqueio de período** | Fechamento que congela transações pagas (RN-FIN-06). |
| **Aurora** | Assistente de IA do S.P.Y. (chat, auditorias, copiloto). **Júlia**: agente de atendimento/rodízio via n8n. |
| **Manifest / Registry** | Catálogos de módulos (`module_manifest`) e de workflows n8n (`tool_registry`) exibidos no Painel SaaS. |

---

## 15. Planos e módulos do SaaS

### 15.1 Módulos habilitáveis por tenant (16 chaves)

Fonte: `MODULE_DEFINITIONS`/`DEFAULT_MODULES` em `src/pages/admin/components/AdminModulesTab.tsx`, `MODULES` em `NovoTenantModal.tsx`; persistidos em `tenants.modules` (jsonb) via `updateTenantModules` (`AuthContext`).

| Chave | Módulo | Categoria (UI) | Padrão ao abrir `AdminModulesTab` |
|---|---|---|---|
| `crm` | CRM & Funil de Vendas | Comercial | ligado |
| `aurora` | Aurora Diretoria IA | Inteligência | ligado |
| `produtividade` | Tarefas & Produtividade | Operações | ligado |
| `financeiro` | Cofre & Financeiro | Finanças | ligado |
| `catalogo` | Catálogo de Produtos & SKUs | Vendas | ligado |
| `marketing` | Marketing & Campanhas | Marketing | ligado |
| `engajamento` | Engajamento & WhatsApp (mensageria, automações) | Comunicação | ligado |
| `educacao` | Educação & Acadêmico | Vertical | ligado |
| `clinica` | Clínica Médica & Saúde | Vertical | ligado |
| `rh` | RH & Colaboradores | Gestão | ligado |
| `bi` | BI & Inteligência de Dados | Inteligência | ligado |
| `dev` | Engenharia & Sprints | Engenharia | ligado |
| `imobiliaria` | Imobiliária | Vertical | desligado |
| `concessionaria` | Concessionária & Automotivo (`automotivo` é alias; ligados juntos) | Vertical | desligado |
| `varejo` | Varejo & Ponto de Venda | Vertical | desligado |
| `solar` | Energia Solar | Vertical | desligado |

Chaves auxiliares usadas no menu: `agenda` (ativa também quando `crm` está ligado) e `documentos` (idem). A criação de tenant pela API usa, sem `modules` no payload, o conjunto `{crm, financeiro, produtividade: true; sdr, advDashboard, marketing, educacao, clinica, rh, bi, engajamento: false}` (`server.ts` `POST /api/admin/tenant`).

### 15.2 Módulos sugeridos por nicho na criação do tenant (`DEFAULT_MODULES_BY_NICHE`)

| Nicho | Módulos ligados |
|---|---|
| Tecnologia | crm, aurora, produtividade, financeiro, bi, dev |
| Solar | crm, aurora, produtividade, financeiro, solar, engajamento |
| Imobiliária | crm, aurora, produtividade, financeiro, imobiliaria, engajamento |
| Educação | crm, aurora, produtividade, financeiro, educacao, rh |
| Clínica | crm, aurora, produtividade, financeiro, clinica, rh |
| Agronegócio | crm, aurora, produtividade, financeiro, catalogo, bi |
| Varejo | crm, aurora, produtividade, financeiro, varejo, catalogo |
| Concessionária | crm, aurora, produtividade, financeiro, concessionaria, catalogo |
| Parceira Geral | crm, aurora, produtividade, financeiro |

### 15.3 Presets do master

- **`AdminModulesTab`:** Ecossistema Global (`ALL_ACTIVE`), Agência SDR & Closers, Escola & Acadêmico, Clínica & Saúde, Imobiliária, Concessionária, Varejo & Lojas, Energia Solar — cada um grava o conjunto de módulos inteiro do tenant selecionado.
- **`ModuleConfigModal`:** presets rápidos "Geral Full", "SDR & Closers", "Imobiliária", "Energia Solar", "Clínica Saúde".

### 15.3a Como o master gerencia

`/app/admin` (`requireMaster`) com 8 abas (`AdminSaaS.tsx`):

| Aba | Conteúdo verificado | Status |
|---|---|---|
| Visão Geral | Total de tenants, MRR global (soma de lançamentos "Receber" pagos de **todos** os tenants, agrupada por mês), ARR projetado, usuários cadastrados, alertas | [Existe] |
| Tenants & Instâncias | Lista/edição de tenants, criação (`NovoTenantModal`), credenciais do admin, troca de tenant | [Existe] |
| Módulos & Presets | Toggle por módulo e presets (§15.1–15.3); grava em `tenants.modules` e atualiza o menu se for o tenant ativo | [Existe] |
| Módulos (Manifest) | Catálogo `module_manifest`: genérico × vertical, "seleciona por cargo", "bloqueio real no banco", rotas, tabelas e rotas de backend | [Existe] (leitura) |
| Ferramentas (Registry) | Catálogo `tool_registry` de workflows n8n por categoria, ativo/inativo, nº de nós | [Existe] (leitura) |
| Faturamento & Planos | Tabela de assinaturas por tenant e cartão "Estrutura de Planos" | [Parcial] — ver 15.4 |
| Logs & Auditoria | Logs do sistema | [Existe] |
| Saúde & Diagnóstico | Testa `tenants`, `users` e sessão Auth no Supabase | [Existe] |

Extras: modal de alertas de sistema; badge "SLA 99.98% Operacional" **fixo** no cabeçalho, sem medição — **[Parcial]**.

### 15.4 Planos: o que existe hoje (e as inconsistências)

Há **três** descrições de plano no código, sem fonte única:

| Onde | Planos | Preços |
|---|---|---|
| Landing pública `src/pages/lp/Planos.tsx` | START, AUTOPILOT, AUTONOMOUS | mensal R$ 997 / 1.997 / 3.997; implantação R$ 2.997 / 4.997 / 9.997 |
| Cartão no Painel SaaS `AdminBillingTab.tsx` | Starter, Professional, Enterprise | R$ 497 / 997 / 2.497 por mês (texto fixo) |
| Cadastro de tenant (`NovoTenantModal`) | lista vem dos **produtos** do tenant-plataforma cujo nome contém "S.P.Y" (`fetchSpyLicenseProducts`; o "tier" é o trecho após `\|`); valor gravado em `tenants.plan` (texto; padrão `start`) | preço do produto |

- A tabela de assinaturas do Painel (`AdminBillingTab`) é **derivada**: um registro por tenant, com plano "Enterprise" para o tenant-plataforma e "Professional" para os demais, ciclo "Mensal", status "Pago" e forma "Faturamento Direto" **fixos**; o valor é a **média** dos lançamentos "Receber" pagos do tenant, ou R$ 997 se não houver histórico. Não há tabela de assinaturas, cobrança automática nem limites por plano — **[Parcial]**/**[Planejado]**.
- Os planos **não limitam** módulos: quem liga/desliga é o master manualmente (`tenants.modules`). Vincular plano → conjunto de módulos e limites (usuários, leads) é **[Planejado]** (ver Q-05).

---

## 16. Indicadores (KPIs) exibidos hoje

Regra transversal: as fórmulas de MRR, conversão, churn e pipeline vêm de `src/lib/revenueMetrics.ts`. Várias telas tentam antes um resumo no servidor (`/api/*-summary`, com cache Redis opcional) e caem no cálculo local com a mesma fórmula.

### 16.1 Dashboard geral (`/app/dashboard`, `useDashboard.ts`, `DashboardStatsByNiche.tsx`)

| KPI | Fórmula | Origem | Notas |
|---|---|---|---|
| Receita (MRR) | `getMRR(contracts)` — soma de `mrr` de contratos não Cancelados/Perdidos | `contracts`; ou `/api/dashboard/summary` sem filtro de data | Saldo atual; ignora o filtro de período |
| Leads Ativos | leads do período com `status ≠ Perdido` (inclui Fechado) | `leads` (filtro por `date`) | — |
| Conversão | `Fechado ÷ total de leads` do período, 1 casa | `leads` | — |
| Churn | contratos cancelados no período ÷ contratos existentes no intervalo; "Sem dados" se não há contratos. Nicho "Clínica" com consultas: pacientes sem visita há 90 dias ÷ pacientes | `contracts`, `appointments` | RN-MRR-03 |
| Fluxo de Performance | por mês (padrão 7) ou dia: leads criados, fechados e MRR assinado no período (contratos não cancelados por data) | `leads`, `contracts` | Métrica de fluxo |
| Funil | nº de leads por etapa do funil comercial ativo (`stageId`); a etapa final inclui `Fechado` | `crm_funis`, `leads` | — |
| Pódio (top 3 vendedores) | por `seller`: nº de fechados, soma do valor (`lead.value`; senão preço dos produtos vinculados; senão valor da proposta mais recente), taxa = fechados ÷ leads do vendedor | `leads`, `products`, `proposals` | — |
| Alertas de meta | squads com `faturamentoAlcancado ÷ meta ≥ 0,9` | `squads` | — |
| Cartões de nicho | Tecnologia, Solar, Clínica e Imobiliária têm rótulos próprios (ex.: "Faturamento Clínico", "Taxa Churn Pacientes", "VGV Estimado"); vários valores são `--` fixos | `DashboardStatsByNiche.tsx` | **[Parcial]** |

### 16.2 CRM

| Tela | KPI | Fórmula / origem |
|---|---|---|
| Dashboard de Performance (`crm/dashboard`) | Leads Totais | contagem de `leads` (ou `/api/crm/dashboard-performance-summary`) |
| | Score IA Médio | média de `scoreIA` |
| | Pipeline Total | soma de `l.value` **removendo tudo que não é dígito** (`replace(/[^\d]/g,"")`) — diverge de `parseCurrencyBR`; valores com centavos ou formato BR podem sair errados no cálculo local |
| | Taxa de Conversão | `Fechado ÷ total` |
| | Gatilhos de Automação Ativos | `leadScoreTriggers.length` |
| Pipeline | Total, Alta Prior., Ganhos, Win Rate, Total de Ganhos | contagens/soma sobre a lista filtrada |
| Leads (`LeadsKPIs`) | Total, Alta Prior., Ganhos | idem |
| Clientes | Total, Ativos, Em Implantação, Inativos | contagem por `status` de `clientes` |
| Propostas | Aguardando Aceite (R$), Convertidas no Mês (R$), Taxa de Conversão, Propostas Ativas | `proposals` (`usePropostasList`, servidor `/api/crm/…`) |
| Contratos | MRR Total, Contratos Ativos, Inadimplência | `contracts` |
| Contratos | **Retenção Estimada** | texto fixo `96.8%` — **não calculado** ([Parcial]) |

### 16.3 Financeiro (`FinanceiroVisaoGeral.tsx`, `/api/finance/visao-geral-summary`)

Cartões do topo comparam sempre **mês atual × mês anterior**, independentemente do seletor de ciclo (Mês, Trimestre, Ano, Tudo) que afeta o restante do painel.

| KPI | Fórmula | Origem |
|---|---|---|
| Saldo em Contas | soma dos saldos das contas ativas (`saldoDaConta`, RN-FIN-03) | `finance_bank_accounts`, lançamentos, transferências |
| Receitas do Mês | Σ `Receber` com status `Pago` no mês corrente (delta vs. mês anterior) | `finance_entries` |
| Despesas do Mês | Σ `Pagar` `Pago` no mês | idem |
| Resultado do Mês | receitas − despesas do mês | idem |
| MRR Ativo | `getMRR(contracts)`; **sem delta** (não há histórico de MRR) | `contracts` |
| Contas a Receber | Σ `Receber` em `A Vencer` ou `Atrasado` (+ contagem) | idem |
| Contas a Pagar | Σ `Pagar` em `A Vencer` ou `Atrasado` | idem |
| Vencido (Inadimplência) | Σ `Receber` `Atrasado` | idem |
| Fluxo Projetado (30d) | Σ `Receber` `A Vencer` nos próximos 30 dias − Σ `Pagar` `A Vencer` no mesmo prazo | idem |
| Liquidez / Burn Rate | RN-FIN-07 | idem |
| Receita avulsa | pagos na categoria "Implantação / Setup" | idem |
| Clientes ativos / Churn | `getActiveCustomers`, `getChurnRate` | `contracts` |
| Projeção de receita | `getRevenueProjection` (RN-MRR-04) | `contracts` |
| CPL | gasto pago em categorias cujo nome contém "marketing" ou "anúncio" ÷ nº de leads | `finance_entries`, `leads` |
| LTV Projetado (12m) | `MRR × 12` (aproximação; não usa churn nem margem) | `contracts` |
| "Margem Ebitda" | `(receita − despesa) ÷ receita × 100` do ciclo — é margem de resultado, não EBITDA de fato | `finance_entries` |

### 16.4 Outras telas com KPIs

| Tela | KPIs | Fonte |
|---|---|---|
| Painel SaaS — Visão Geral | Nº de tenants, MRR Global (Σ Receber pagos de todos os tenants, por mês), ARR Projetado, usuários cadastrados | `finance_entries` (todos os tenants, master), `tenants`, `users` |
| Painel SaaS — Faturamento | Valor por assinatura = média dos pagos do tenant (ou R$ 997) | `AdminBillingTab.tsx` |
| Inadimplência, DRE, Fluxo, Performance Mensal/Anual, Marketing, BI, Clínica, Educação | resumos por `/api/finance/*-summary`, `/api/marketing/*-summary`, `/api/dashboard/bi-summary`, `/api/clinica/*-summary`, `/api/education/mensalidades-summary` | `server.ts` |
| Marketing Analytics | CAC, LTV, ROI por canal | `MarketingAnalytics.tsx` / `/api/marketing/analytics-summary` |
| Relatórios Executivos | pilares Comercial, Financeiro, Operacional | `/api/crm/relatorios-executivos-summary` |

Os KPIs específicos de cada vertical (Clínica, Imobiliário, etc.) existem em seus painéis, mas suas fórmulas não foram auditadas neste documento.

---

## 17. Roadmap por releases

Coerente com `docs/projeto/06-PLANO-DE-IMPLEMENTACAO.md` (fases 1–6, esforço em dias de 1 dev; datas ilustrativas a partir de 2026-09-28). Cada release só fecha com a Definição de Pronto (Plano §4).

### R0 — Entregue (base)

Edição de cliente e bloqueio de duplicata (`94bd56b`), item recorrente como "1× ciclo", fidelidade no produto, venda multi-produto, correção da corrida de clientes duplicados (`9f27b05`), recorrência separada de parcelamento (`a4d3849`).

### R1 — Confiabilidade e segurança (P0) · ~10–14 dias

| Item | Fase do Plano | Critério de saída |
|---|---|---|
| Índices únicos em `clientes` + deduplicação prévia | 1.1 | Inserção duplicada falha no banco; app mostra mensagem clara (fecha RN-CLI-03) |
| Testes unitários de `saleCalculator` | 1.2 | Casos de RN-VEN-01..07 cobertos no CI |
| RPC transacional `close_sale` (atrás de flag) | 1.3 | Fechar venda é tudo-ou-nada (US-06..10) |
| Tipos gerados + job anti-deriva de `schema.sql` | 1.4 | CI falha se divergir |
| Teste de regressão de `syncAcceptedProposal` | 1.5 | Idempotência, desconto proporcional e MRR (US-13) |
| Rotacionar chaves vazadas; IA para `/api/ai/*` | 4.1, 4.2 | Sem `VITE_*` de IA no bundle |

### R2 — Modelo de receita e RBAC (P1) · ~21–29 dias

| Item | Fase | Critério de saída |
|---|---|---|
| `proposal_items.cycles`; `quantidade` real; remover compensação de exibição | 2.1–2.3 | MRR e totais idênticos em amostra real |
| Fidelidade → contrato; multa no cancelamento | 2.4–2.5 | US-16 [Planejado] passa a valer |
| Ciclos automáticos para "sem prazo" (job mensal) | 3.1 | Próximo ciclo nasce sozinho, idempotente |
| Aba Produtos do lead com todo o histórico; editar itens de proposta; status `Expirada` automático | 3.2–3.4 | Fecha RF-CRM-22 |
| Papéis e permissões (`roles`/`permissions`) e RBAC nas rotas `requireUser` sensíveis | 4.3–4.4 | Substitui o cargo em texto livre (§13.3) |

### R3 — Plataforma e qualidade (P2/P3) · ~15–20 dias

| Item | Fase | Critério de saída |
|---|---|---|
| `tenant_settings` (sem estado em memória) e chat persistido | 5.1–5.2 | Sem perda no cold start |
| WhatsApp real com webhook assinado; webhooks por tenant | 5.3–5.4 | Mensageria sai de [Parcial] |
| CSP, remover gate por nome de tenant | 4.5–4.6 | — |
| Refactor por blocos (< ~500 linhas), tokens de tema, acessibilidade, unificar `NovoClienteModal`, consolidar funis | 6.1–6.5 | — |

### Itens sugeridos pela leitura deste PRD (fora do Plano vigente — decidir antes de escalar)

- Unificar as três descrições de planos e ligar plano → módulos/limites (§15.4).
- Substituir valores fixos por cálculo real: "Retenção Estimada", "SLA 99.98%", cartões `--` por nicho (§16).
- Corrigir soma de "Pipeline Total" no dashboard de performance CRM para usar `parseCurrencyBR` (§16.2).
- Fazer `requireModule` também checar o módulo do tenant (§13.3).

---

## 18. Premissas, dependências e restrições

**Premissas**
1. Cada empresa é um tenant único; usuários pertencem a um tenant (exceto master e parceiros).
2. O banco (Supabase/Postgres) é a fonte de verdade; as migrations valem mais do que `schema.sql`.
3. O cliente web executa parte da lógica de negócio (reconciliação de propostas, criação de clientes); por isso ela precisa ser idempotente (RN-GER-01/02).
4. Valores em BRL; datas exibidas em pt-BR; fuso padrão `America/Sao_Paulo`.
5. Todo tenant consome o mesmo código; diferenças por configuração (princípio §2).

**Dependências**
- Supabase (Auth, Postgres/RLS, Storage) e `SUPABASE_SERVICE_ROLE_KEY` no servidor para rotas master/API por chave.
- Backend Node/Express (`server.ts`, também empacotado em `api/`), Redis opcional para cache de resumos.
- n8n (agentes Aurora/Júlia, rodízio de formulários — `claim_next_form_sdr`), provedores de IA (hoje parte chamada do cliente, ver riscos §9).
- Google Calendar (OAuth), provedor de WhatsApp (a definir), SMTP por tenant.
- Sequência do Plano: testes (1.2, 1.5) antes de mexer no cálculo (Fase 2); índices únicos exigem deduplicar antes.

**Restrições**
- Sem emissão fiscal, gateway de pagamento integrado, app nativo ou multa automática de fidelidade (§8).
- Nenhuma feature específica de tenant (memória do projeto e §2).
- Migração de banco: uma por PR, com `tenant_id` + RLS e `get_advisors` sem alerta novo.
- Estado em memória do backend (settings, WhatsApp) não é confiável em cold start até a Fase 5.

---

## 19. Questões em aberto

| ID | Questão | Dono | Origem |
|---|---|---|---|
| Q-01 | Modelo de permissão dentro do tenant: papéis fixos × configuráveis? | Produto | Plano §6.1 |
| Q-02 | Multa de fidelidade: sobre mensalidades restantes, valor fixo ou pro-rata? | Produto | Plano §6.2 |
| Q-03 | O aceite público só grava "Aceita"; contrato e lançamentos dependem de um usuário do tenant abrir o app (reconciliação no cliente). Mover para o servidor/RPC (`close_sale` ou trigger)? | Produto/Eng. | `server.ts` L2557 × `DataContext` L2800 |
| Q-04 | Verificar duplicidade de "A Receber": a venda pelo modal já cria N lançamentos por ciclo com `proposal_id`, e o aceite cria adicionalmente um lançamento "Contrato / Recorrente" pelo total recorrente — confirmar em dados reais se ambos coexistem e definir o comportamento correto. | Eng. | `AddProdutoLeadModal` × `syncAcceptedProposal` |
| Q-05 | Definir plano canônico (START/AUTOPILOT/AUTONOMOUS × Starter/Professional/Enterprise), preços e se o plano limita módulos/usuários. | Produto | §15.4 |
| Q-06 | Provedor de WhatsApp e política de mensagens. | Produto | Plano §6.3 |
| Q-07 | Emissão fiscal (NFS-e) entra no roadmap? | Produto | Plano §6.4 |
| Q-08 | Proposta editável após "Enviada": versionar ou sobrescrever? | Produto | Plano §6.5 |
| Q-09 | Conciliação: incluir data/descrição no casamento e baixar o lançamento como "Pago"? Renomear o botão "(IA)"? | Produto/Financeiro | RN-FIN-09 |
| Q-10 | Data de término do contrato em `syncAcceptedProposal` usa soma direta de meses (sem o clamp de fim de mês de RN-VEN-05); padronizar com `addMonthsClamped`? | Eng. | `DataContext.tsx` |
| Q-11 | `Pedidos` de Varejo tem rota mas não tem item de menu; manter, incluir ou remover? | Produto | `navData.ts` × `App.tsx` |
| Q-12 | `requireModule` deve bloquear módulo desligado no tenant (hoje só o cargo)? | Eng./Segurança | §13.3 |
