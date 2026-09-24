# Limpar cache do navegador (localStorage / sessionStorage)

O S.P.Y. guarda pouquíssimo estado no navegador — a fonte de verdade é o Supabase. Ainda assim, se a tela mostrar dado velho depois de trocar de empresa, mudar permissões ou fazer deploy, limpe o cache local.

## O que existe no navegador hoje

| Onde | Chave | O que guarda |
|---|---|---|
| `sessionStorage` | `spy_user_session` | Cache de conveniência do usuário logado (some ao fechar a aba). A sessão real é o JWT do Supabase Auth. |
| `sessionStorage` | `spy_cache:<tenantId>:<tabela>` | Cache de tabelas de catálogo/configuração por tenant (`DataContext`) |
| `sessionStorage` | `spy_financeiro_filtro_periodo` | Filtro de período do Financeiro |
| `sessionStorage` | `axis_supabase_connection_status` | Resultado do teste de conectividade com o Supabase |
| `sessionStorage` | `axis_searchQuery`, `axis_activeTab` | Busca global e aba ativa |
| `localStorage` | `spy_exchange_rates_v1` | Cache de taxas de câmbio (localização/moeda) |
| `localStorage` | `axis_google_token:<chave>` | Token do Google no navegador (reidratação em reload) |
| `localStorage` | `sb-<project-ref>-auth-token` | Sessão do `supabase-js` (JWT/refresh token) — **remover = deslogar** |

As chaves antigas `axis_tenant_modules` e `axis_session` **não são mais usadas** (módulos e sessão vêm do Supabase). Preferências de usuário ficam em `public.users.preferences`, não no navegador.

## Opção 1: pelo DevTools

1. Abra o app (localhost ou o domínio em produção) e aperte **F12**
2. Aba **Application** (Chrome) / **Storage** (Firefox)
3. Em **Session Storage** e **Local Storage**, apague as chaves acima (ou use "Clear site data")
4. Recarregue com **F5**

## Opção 2: pelo Console

```javascript
// Limpa só o cache do S.P.Y. (mantém a sessão do Supabase)
Object.keys(sessionStorage)
  .filter((k) => k.startsWith('spy_') || k.startsWith('axis_'))
  .forEach((k) => sessionStorage.removeItem(k));
localStorage.removeItem('spy_exchange_rates_v1');
window.location.reload();
```

Para limpar **tudo**, inclusive a sessão (vai pedir login de novo): `localStorage.clear(); sessionStorage.clear(); location.reload();`

## Opção 3: forçar rebuild no Vercel

Se você quer que todos os usuários recebam o bundle novo:

1. Abra https://vercel.com, projeto do S.P.Y.
2. **Deployments** → último deploy → **Redeploy** (desmarque "Use existing Build Cache" se quiser build limpo)

Isso não limpa o `sessionStorage`/`localStorage` de ninguém; o cache `spy_cache:*` expira ao fechar a aba.

## Cache do servidor (Redis)

As rotas de resumo/lista (`/api/dashboard/*`, `/api/finance/*-summary`, `/api/crm/*-list` etc.) usam cache Redis por TTL (20–60 s, sem invalidação ativa) quando `REDIS_URL` está configurada. Dado "atrasado" nessas telas normalmente some em até 1 minuto; a resposta traz o header `X-Cache: HIT|MISS`. Ver [docs/projeto/02-TRD.md](docs/projeto/02-TRD.md) §14.

## Verificar se funcionou

Abra o **Console** (F12), recarregue e procure `[Supabase] ✅ Configurado e pronto para uso` e `[DataContext] ✅ Dados carregados do Supabase.` (ver [DEBUG_BANCO.md](DEBUG_BANCO.md)). O seletor de empresas só mostra tenants que existem em `public.tenants` e que o usuário pode acessar via RLS.
