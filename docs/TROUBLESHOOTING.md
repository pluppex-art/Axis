# Troubleshooting

## "Troquei de empresa (tenant) e os dados continuam os mesmos"

Causa raiz mais comum, corrigida nesta auditoria: `DataContext.tsx` só substituía o state de `leads` quando a resposta tinha `length > 0` — trocar pra um tenant com zero leads deixava o state antigo visível. Corrigido para sempre substituir o state pela resposta da query, mesmo vazia. Se o sintoma voltar a aparecer em outra entidade (não `leads`), procure por esse mesmo padrão (`if (res.data.length > 0) setX(...)`) — é um bug fácil de reintroduzir copiando código de fetch entre entidades.

Outra causa possível: `app_settings` sendo lido sem filtro de tenant pra contas master/parceiro (que enxergam múltiplos tenants via RLS ao mesmo tempo) — também corrigido, ver [DATABASE.md](DATABASE.md) e [ARCHITECTURE.md](ARCHITECTURE.md#multi-tenancy).

## "Lead aparece na lista mas some no Kanban" (ou vice-versa)

Causado por `stageId` do lead não bater com nenhuma coluna atual do funil (drift depois de reordenar/editar o funil). `PipelineKanbanBoard.tsx` hoje tem um bucket de fallback (`unmatchedLeads`) que joga leads órfãos na primeira coluna em vez de escondê-los — se o sintoma reaparecer, o fix real é garantir que reordenar/editar um funil atualize o `stageId` dos leads existentes, não só cadastrar a coluna nova.

## "Erro 401 em toda chamada a /api/\*"

- Sessão expirada ou token não está sendo enviado — confira o header `Authorization: Bearer <jwt>`.
- Se for uma chamada a `/api/v1/leads`, o header certo é `x-api-key`, não `Authorization` — são autenticações diferentes (`requireApiKey` vs. `requireUser`). Ver [API.md](API.md).

## "Erro 503: Nenhuma API Key configurada" / "Banco de dados não configurado no servidor"

`SPY_API_KEYS` (ou o fallback legado `AXIS_API_KEYS`) ou as variáveis do Supabase (`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`) não estão setadas no ambiente que está rodando `server.ts`. Ver [ENVIRONMENT.md](ENVIRONMENT.md).

## "Um usuário master vê dado de um tenant que não devia"

Isso é esperado se o usuário for `is_master` (vê todos os tenants por design) ou um parceiro mapeado em `tenant_partners` pra aquele tenant especificamente. Se nenhum dos dois for o caso, é uma regressão de RLS — reconfira com `SET ROLE anon`/uma sessão de teste do usuário real e compare contra a matriz em [DATABASE_SECURITY.md](DATABASE_SECURITY.md), não só contra o arquivo de migração (já aconteceu neste projeto de uma policy existir na migração mas a tabela não ter `ENABLE ROW LEVEL SECURITY`, tornando a policy decorativa).

## "Build local funciona mas a Vercel falha"

`npm run build` localmente reproduz exatamente o `buildCommand` da Vercel (`vite build` + bundle do `server.ts` via esbuild) — se passar local e falhar lá, o motivo quase sempre é uma variável de ambiente que existe no seu `.env` local mas não foi configurada no painel da Vercel. Ver [DEPLOYMENT.md](DEPLOYMENT.md) e [ENVIRONMENT.md](ENVIRONMENT.md).

## "Nicho não aparece / dropdown de nicho vazio"

Nichos vêm de `public.nichos` (`tenant_id IS NULL` = global, ou `tenant_id` do tenant), carregados pelo `DataContext` com `.or('tenant_id.eq.<tenant>,tenant_id.is.null')`. Se a lista vier vazia, verifique no Console se há `[DataContext] ❌ Falha ao carregar módulo de nicho` (rede/RLS de leitura em `nichos`), se o tenant está carregado e se há nichos globais ativos no banco (seed `20260901_nichos_globais_seed.sql`). (O antigo `NICHES_FALLBACK`/`fetchGlobalNiches` não existe mais no código.) Ver [DATABASE.md](DATABASE.md#nichos).

## "row violates row-level security policy" / listas vazias sem erro

Quase sempre é a RLS funcionando: usuário sem `tenant_id` em `public.users`, `insert` sem `tenant_id`, sessão expirada ou policy específica da tabela. **Nunca desabilite a RLS** — siga o diagnóstico seguro (`SET LOCAL ROLE authenticated` + `request.jwt.claims`) em [`DEBUG_BANCO.md`](../DEBUG_BANCO.md).

## WhatsApp não recebe mensagens / "Simulador" aparece no lugar do WAHA

`GET /api/whatsapp/provider-status` mostra o provedor ativo: `simulator` significa que `WAHA_API_URL` não está definida no ambiente do backend. Com WAHA ativo, confira se o WAHA consegue alcançar `POST /api/whatsapp/webhook/:instanceId?secret=...` (`403` = segredo diferente do `whatsapp_instances.webhook_secret`). Ver [WEBHOOKS.md](WEBHOOKS.md).

## Dados de resumo/lista "atrasados" (Redis)

As rotas `-summary`/`-list` cacheiam por 20–60 s quando `REDIS_URL` existe (header `X-Cache: HIT|MISS`; `GET /api/health/redis` mostra a conexão). Sem Redis o servidor funciona normalmente, só sem cache.

## `npm audit` reportando vulnerabilidade nova

CI falha em `--audit-level=high`. Rode `npm audit fix` (sem `--force`) primeiro — resolve a maioria sem mudar major version. Se restar algo que só fecha com `--force` (bump major), **não force sem avaliar compatibilidade** — abra a mudança separadamente, teste, e só then suba a versão. Ver histórico desse trade-off em [`SECURITY_AUDIT.md`](../SECURITY_AUDIT.md).
