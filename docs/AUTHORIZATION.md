# Autorização (papéis, RBAC)

**Princípio do projeto: nunca confiar no cliente.** Toda checagem de papel que aparece na UI (esconder um botão, desabilitar um menu) é conveniência de UX, não segurança — a autorização real de dado é a RLS no Postgres ([DATABASE_SECURITY.md](DATABASE_SECURITY.md)); a autorização real de ação de plataforma é o `requireMaster` no backend (abaixo). Se uma tela some pra um usuário mas a rota/policy por trás dela não checa nada, o controle é decorativo.

## Papéis existentes

Campos em `public.users`, refletidos em `AuthContext` (`src/contexts/AuthContext.tsx`):

| Campo | Escopo | O que libera |
|---|---|---|
| `is_master` (`user.isMaster`) | Global/plataforma | `/app/admin` (gestão de tenants — `requireMaster` no frontend via `ProtectedRoute` e no backend via middleware); vê todos os tenants por `is_super_admin()` na RLS; pode trocar credenciais de qualquer usuário (`POST /api/admin/tenant-user/:id/credentials`). |
| `isTenantAdmin` (`users.is_tenant_admin`, coluna real `bool`) | Um tenant | Admin daquele tenant especificamente — distinto de `isMaster`. Gate de criação de membros de RH (`RHColaboradores.tsx`), das telas de Configurações (equipe, cargos, permissões, squads, bloqueio de período, auditoria financeira, comissões) e de `requireTenantAdmin` no backend. |
| `role` (texto livre) | Um tenant | Papel funcional dentro do tenant (ex.: "Vendedor", "Gerente") — **hoje é texto livre, sem enum/constraint no banco** (ver `SECURITY_AUDIT.md`, M5, não corrigido ainda). Casa por nome com `cargos.nome`; os `cargos` definem quais módulos o usuário vê (`cargos.modulos`) — usado por `ProtectedRoute requireModule` e pelo menu. Não é a base de nenhuma policy RLS aplicada hoje (a CR3, que usaria isso, não está aplicada). |
| Parceiro (`partners`/`tenant_partners`) | Múltiplos tenants | Um parceiro enxerga os tenants mapeados a ele em `tenant_partners`, via `has_tenant_access()`. Só `is_super_admin()` cria/edita parceiros ou seus mapeamentos — um parceiro não se autoconcede acesso a tenants novos. |

## Onde cada papel é de fato aplicado

### No banco (real)
`has_tenant_access(tenant_id)` e as policies derivadas — ver a matriz completa em [DATABASE_SECURITY.md](DATABASE_SECURITY.md). Isso vale mesmo que alguém contorne inteiramente o frontend (chamando a API do Supabase direto).

### No backend `server.ts` (real, pra ações que passam por ele)
- `requireUser` — exige sessão válida, ponto.
- `requireMaster` (sempre depois de `requireUser`) — confirma `is_master=true` direto no banco antes de liberar as 3 rotas `/api/admin/*` (criar tenant, ver admin de um tenant, trocar credencial de outro usuário). Essas rotas usam `service_role` por baixo — é por isso que o gate no backend é obrigatório e não pode ser só de UI.
- `requireTenantAdmin` (depois de `requireUser`) — `is_master` ou `users.is_tenant_admin`; hoje só em `/api/integrations/external*` (conectores externos, que usam `service_role`).
- Todas as outras rotas `requireUser` (IA, settings genéricos, WhatsApp) **não têm checagem de papel adicional** — qualquer usuário autenticado do tenant pode chamá-las. Isso é aceitável hoje porque nenhuma delas expõe dado de outro tenant (usam `req.supabase`, escopado pela sessão) nem faz ação destrutiva de plataforma — mas é RBAC raso: um vendedor comum pode chamar `/api/ai/performance-audit` do tenant inteiro, por exemplo. Ver `SECURITY_AUDIT.md` (C3) — não é uma vulnerabilidade de vazamento entre tenants, é ausência de granularidade de papel dentro do próprio tenant.

### Permissão por módulo no banco: modo log (não bloqueia)
Os triggers `trg_permission_log_{crm,financeiro,rh,clinica,educacao}` chamam `log_module_permission_check`, que só grava em `permission_check_log` (`would_have_blocked`) — **nenhuma escrita/leitura é negada por cargo/módulo ainda** (verificado ao vivo em 2026-09-24). A migration `20260921_cr1_*` (escrita de `cargos`/`squads` só para admin/master, via `is_tenant_admin_or_master`) e a `20260921_cr2_*` (módulos/plano do tenant só pelo master) foram **aplicadas em 2026-09-24**; a `20260921_cr3_*` (leitura de clínica/educação via `user_has_module_access`) está no repo mas **não aplicada** no banco vivo.

### No frontend (só UX, não é segurança)
- `ProtectedRoute` (`src/components/ProtectedRoute.tsx`) — redireciona pra `/login` sem sessão e aceita quatro guardas opcionais (todas redirecionam pra `/app`):
  - `requireMaster` — só `user.isMaster` (ex.: `/app/admin`);
  - `requirePartner` — master ou usuário com `partnerId` (ex.: `/app/parceiros`);
  - `requireTenantAdmin` — master ou `isTenantAdmin` (telas de Configurações de empresa/financeiro e comissões do imobiliário);
  - `requireModule="<chave>"` — bloqueia se o módulo não está habilitado no tenant ativo (`allTenantModules`, com aliases como `solar`/`energia-solar`; não se aplica a master/parceiro) **e** se o cargo do usuário (`cargos.modulos`, casado por `user.role` = `cargos.nome`) tem lista restrita que não inclui o módulo. Aplicado nas rotas de marketing, financeiro, imobiliário, solar, automotivo, varejo, clínica e educação.
- Botões/menus escondidos por `user.isMaster`/`user.isTenantAdmin` em várias telas (ex.: botão "Novo Registro" em RH). Conveniência — a rota/policy por trás é que decide de verdade.

## Criação de usuários

- **Novo tenant + admin inicial**: `POST /api/admin/tenant` (`requireMaster`) — único caminho que cria um tenant do zero.
- **Novo membro de um tenant existente**: `NovoMembroModal.tsx` → `RHColaboradores.tsx`. `handleSaveMembro` **exige** `user?.isMaster || user?.isTenantAdmin` (early-return com toast de erro caso contrário) — corrigido nesta auditoria (A3): antes, qualquer usuário logado no tenant conseguia acionar o formulário e criar outro usuário com a senha padrão `"123456"`. Hoje: (1) o gate de papel é checado antes de salvar, e (2) a senha default deixou de ser uma string fixa — `generateTempPassword()` (`NovoMembroModal.tsx`) gera uma senha aleatória via `crypto.getRandomValues`, mostrada ao admin logo após a criação pra ele repassar ao novo usuário.
- **Auto-registro público**: não existe mais (ver [AUTHENTICATION.md](AUTHENTICATION.md#auto-registro-register)).

## Pendências conhecidas (não corrigidas nesta rodada)

- `role` como texto livre, sem enum (M5) — baixo risco, mas permite digitar qualquer string.
- RBAC dentro do tenant é raso nas rotas de IA (C3, acima) — qualquer usuário autenticado do tenant pode chamar qualquer rota `requireUser`. Corrigir exigiria decidir um modelo de permissão granular (ex.: `role IN (...)` por rota), o que é uma decisão de produto, não um fix mecânico — fora do escopo desta rodada.
- Gates baseados em nome de tenant (string) para visibilidade de itens de menu, em vez de papel/permissão real — sinalizado, não corrigido (é só item de menu, sem rota/dado atrás que não seja já protegido pela RLS). Confira o `Sidebar` atual antes de assumir que ainda existe.
- Enforcement por módulo no banco (modo log → bloqueio) e RBAC granular nas rotas de IA: planejados em [`projeto/06-PLANO-DE-IMPLEMENTACAO.md`](projeto/06-PLANO-DE-IMPLEMENTACAO.md), Fase 4.
