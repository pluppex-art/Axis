# Arquitetura

## Visão geral

```
Frontend (React + Vite, SPA)
    │  chamadas diretas via @supabase/supabase-js (anon key + JWT do usuário)
    ▼
Supabase (Postgres + Auth + Storage)
    │  RLS aplica isolamento por tenant em toda query
    ▼
129 tabelas com RLS, quase todas (exceto tenants/tabelas de plataforma) com tenant_id + policy tenant_isolation

Frontend
    │  fetch para /api/* (Bearer JWT ou x-api-key)
    ▼
server.ts (Express, roda como função serverless na Vercel via api/index.ts)
    │  requireUser (JWT) ou requireApiKey (chave pública) definem o tenant
    ▼
Supabase (client escopado pela sessão do chamador — respeita RLS)
    │
    └─ ou supabaseService (service_role, bypassa RLS) — só nas rotas /api/admin/*,
       sempre atrás de requireMaster, e em /api/v1/leads, onde o tenant vem da
       chave de API (nunca do corpo da requisição)

Integrações externas: Gemini/Groq (IA), n8n (automação "Julia", Aurora chat), WAHA (WhatsApp), Google Calendar, Redis (cache opcional), conectores externos por tenant
```

## Por que duas formas de acessar dados

A maior parte do CRM (`src/contexts/DataContext.tsx`) fala **direto com o Supabase** pelo navegador — não existe uma API REST própria no meio. Isso funciona porque a RLS do Postgres é a autoridade real: mesmo que o frontend tente ler o `tenant_id` errado, a policy `has_tenant_access(tenant_id)` bloqueia no banco.

O backend Express (`server.ts`) existe só para o que **não pode** rodar no navegador com a chave anônima:
- chamadas a provedores de IA usando chaves que não devem ir pro bundle do cliente (algumas vão mesmo assim — ver [SECURITY_AUDIT.md](../SECURITY_AUDIT.md));
- operações que exigem `service_role` (criar tenant, trocar credencial de outro usuário — sempre atrás de `requireMaster`);
- a API pública `/api/v1/leads`, usada por integrações externas (formulário do E-EMPREENDA+) sem sessão de usuário.

Ver [docs/API.md](API.md) para o inventário completo de rotas e [docs/AUTHORIZATION.md](AUTHORIZATION.md) para como cada uma é protegida.

## Multi-tenancy

Cada linha de dado operacional (leads, clientes, contratos, financeiro, etc.) carrega um `tenant_id`. O isolamento tem duas camadas:

1. **RLS (autoridade real)** — a função `has_tenant_access(target_tenant_id)` retorna verdadeiro se `target_tenant_id` é o tenant do usuário logado, ou se ele é `is_master`, ou se é um parceiro (`tenant_partners`) mapeado pra aquele tenant. Quase toda tabela de negócio tem uma policy `tenant_isolation` usando essa função. Ver [DATABASE_SECURITY.md](DATABASE_SECURITY.md).
2. **Filtro explícito no frontend** (`src/contexts/DataContext.tsx`) — filtra por `tenant_id = activeTenantId` em cima do que a RLS já devolve. Existe porque contas parceiras/master enxergam múltiplos tenants via RLS ao mesmo tempo; sem esse filtro extra, a tela mostraria dados de todos os tenants acessíveis, não só o "ativo" no momento.

`activeTenantId` vem de `src/contexts/AuthContext.tsx` — normalmente igual ao `tenant_id` do usuário logado, e só diverge quando um usuário `isMaster` troca de "empresa visualizada" (`switchTenant()`).

## Frontend

- **Roteamento**: `src/App.tsx`, React Router. Toda rota autenticada fica sob `<ProtectedRoute>` (`src/components/ProtectedRoute.tsx`), que redireciona pra `/login` se não há sessão, e opcionalmente exige `requireMaster`, `requirePartner`, `requireTenantAdmin` ou `requireModule` (ver [AUTHORIZATION.md](AUTHORIZATION.md)).
- **Estado global**: dois contexts — `AuthContext` (sessão, tenant ativo, papéis) e `DataContext` (todas as entidades de negócio, com CRUD que já carimba `tenant_id` automaticamente).
- **UI**: componentes em `src/components/ui/`, páginas por módulo em `src/pages/<modulo>/`.

## Backend (`server.ts`)

Um único arquivo Express, buildado com esbuild pra `dist/server.cjs` e servido como função serverless na Vercel (`api/index.ts` só reexporta o app). Localmente roda via `tsx` (`npm run dev`).

Peças centrais:
- `requireUser` — valida um JWT real do Supabase Auth, anexa `req.user` e `req.supabase` (client escopado pela sessão do chamador).
- `requireApiKey` — valida `x-api-key` contra `SPY_API_KEYS`, resolve o tenant a partir da própria chave (nunca do corpo da requisição).
- `requireMaster` — usado depois de `requireUser`, confirma `users.is_master` no banco antes de liberar rotas administrativas.
- `requireTenantAdmin` — `is_master` ou `users.is_tenant_admin` (conectores externos).
- Rate limiting (`express-rate-limit`) nas rotas de IA, na API pública, no WhatsApp, no Google Calendar e na captura pública de lead.
- Cache Redis opcional (`server/redisClient.ts`, cache-aside por TTL, falha aberta) para resumos e listas.
- Módulos extraídos em `server/`: `googleCalendar.ts` (router OAuth/eventos/Meet), `whatsappProvider.ts` (WAHA real ou simulador), `redisClient.ts` e, quando presente, `ssrfGuard.ts` (validação de URLs de teste de integração).
- CORS restrito por allowlist (`SPY_CORS_ORIGIN`).

Visão técnica completa (fluxos, inventário de rotas, funções, riscos): [`docs/projeto/`](projeto/) — PRD, TRD, fluxos, UI/UX, esquema de backend e plano de implementação.

## Banco de dados

Supabase/Postgres. Ver [DATABASE.md](DATABASE.md) (schema/convenções) e [DATABASE_SECURITY.md](DATABASE_SECURITY.md) (RLS).

## Integrações externas

- **Gemini / Groq** — IA generativa (scoring de leads, copiloto de vendas, análise de chamadas). Chamadas tanto do backend (`server.ts`) quanto direto do frontend em alguns pontos (`VITE_GEMINI_API_KEY`/`VITE_GROQ_API_KEY` — ver nota de exposição em [SECURITY_AUDIT.md](../SECURITY_AUDIT.md)).
- **n8n** — automações externas: rodízio de leads ("Julia") e o chat da Aurora (`AURORA_WEBHOOK_URL`, só chamado server-side).
- **WAHA** — gateway de WhatsApp (`WAHA_API_URL`); mensagens persistidas em `chat_contacts`/`chat_messages`; webhook de entrada em `POST /api/whatsapp/webhook/:instanceId`.
- **Google Calendar** — OAuth server-side; tokens em `google_calendar_connections`.
- **Webhooks de saída** — triggers do banco + `pg_net` (`dispatch_webhook_event`), ver [WEBHOOKS.md](WEBHOOKS.md).
- **Supabase Storage** — quatro buckets públicos (`avatars`, `proposals`, `products`, `finance`), escrita restrita por pasta = tenant_id + RLS, com limite de tamanho/tipo configurado no bucket.
