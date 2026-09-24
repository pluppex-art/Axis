# Desenvolvimento

## Rodando localmente

```bash
npm install
cp .env.example .env   # preencha com credenciais reais do seu Supabase de dev
npm run dev             # tsx dev-server.ts — sobe frontend (Vite) + backend juntos
```

Ver [ENVIRONMENT.md](ENVIRONMENT.md) pra o que cada variável faz. Sem `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` configuradas, o app cai num modo degradado (sem persistência real) — não é o modo recomendado pra desenvolver nada que toque dado.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Frontend (Vite em middleware mode) + backend (`server.ts` via `tsx`) em modo desenvolvimento, porta fixa 3002. `hmr: false` no `vite.config.ts` — sem hot reload de tela, recarregue a página |
| `npm run build` | Build de produção: `vite build` (frontend → `dist/`) + `esbuild` do backend (→ `dist/server.cjs`) |
| `npm start` | Roda o backend já buildado (`dist/server.cjs`) — útil pra testar o artefato de produção localmente |
| `npm run lint` | Type-check (`tsc --noEmit`) — não formata nem linta estilo, só tipos |
| `npm run clean` | Remove `dist/` |

Não há suíte de testes automatizados (unit/integration) configurada hoje — `npm run lint` + `npm run build` são os únicos checks locais/CI (há apenas SQL de teste manual em `supabase/tests/`). Ver [TROUBLESHOOTING.md](TROUBLESHOOTING.md) e [`SECURITY_AUDIT.md`](../SECURITY_AUDIT.md) pra testes de segurança feitos manualmente via SQL (`SET ROLE anon`) em vez de uma suíte automatizada.

## Estrutura de pastas

```
server.ts              # Backend Express (ver docs/API.md)
server/                # Módulos extraídos: googleCalendar.ts, redisClient.ts, whatsappProvider.ts (WAHA/simulador), ssrfGuard.ts
api/index.ts            # Reexporta o app de server.ts pra Vercel
dev-server.ts            # Orquestra frontend+backend em desenvolvimento

src/
  App.tsx                # Rotas (React Router), ProtectedRoute
  main.tsx                # Entry point
  contexts/
    AuthContext.tsx        # Sessão, tenant ativo (activeTenantId), papéis, switchTenant()
    DataContext.tsx         # Todas as entidades de negócio — fetch, CRUD (carimba tenant_id automaticamente), realtime
    DataContextTypes.ts      # Tipos do DataContext
  components/
    ui/                     # Componentes de UI genéricos (button, modal, etc.) — Radix + Tailwind
  pages/
    <modulo>/                # Uma pasta por módulo de negócio: crm, finance, hr, imobiliario,
                              # education, marketing, dev, clinica, reunioes, operative, admin,
                              # settings, auth, dashboard, partners, landing, lp, common,
                              # agenda, automotivo, solar, varejo, public
  lib/
    supabase.ts              # Client Supabase + funções de auth (login, reset de senha, fetch de tenants)
    apiClient.ts, saleCalculator.ts, publicProposal.ts, ...   # Ver docs/projeto/02-TRD.md §13.4
  hooks/                    # Hooks compartilhados
  types.ts                  # Tipos de domínio (Lead, Task, Tenant, etc.)

supabase/
  migrations/               # SQL versionado, aplicado manualmente/via mcp Supabase (apply_migration) — nem tudo do repo está aplicado no banco vivo, ver docs/DATABASE.md
  functions/                # Edge Functions (ex.: analyze-crm-call)
  tests/                    # SQL de teste manual

docs/                      # Esta documentação; docs/projeto/ = PRD, TRD, fluxos, UI/UX, esquema de backend, plano
```

`E-EMPREENDA+/` é um sub-projeto separado (landing page pública de captura de lead) que vive dentro deste repositório mas tem vida própria — não faz parte do build principal (`npm run build` não o inclui). Ver nota em [`SECURITY_AUDIT.md`](../SECURITY_AUDIT.md) (M3) — decisão de mantê-lo aqui ou extraí-lo pra outro repositório é do usuário, não foi alterado nesta auditoria.

## Convenções ao adicionar algo novo

- **Tabela nova**: sempre `tenant_id uuid references tenants(id)` + RLS habilitada + policy `tenant_isolation` com `has_tenant_access(tenant_id)`, a menos que haja uma razão documentada pra fugir do padrão (como `user_settings`, por dono direto). Ver [DATABASE_SECURITY.md](DATABASE_SECURITY.md) antes de aplicar a migração, e reconferir com `get_advisors`/`SET ROLE anon` depois.
- **Rota nova em `server.ts`**: decida explicitamente qual middleware ela precisa (`requireUser`, `requireApiKey`, `requireMaster`) — nunca deixar uma rota que grava dado sem nenhum dos três. Erros devolvidos ao cliente devem ser mensagens genéricas; o detalhe vai só pro `console.error`.
- **Botão/tela nova que devia ser restrita a um papel**: esconder no frontend é UX, não segurança — a checagem real precisa existir na RLS ou no backend também. Ver [AUTHORIZATION.md](AUTHORIZATION.md).
