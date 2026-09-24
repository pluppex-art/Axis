# Deploy

Hospedagem: **Vercel**. `vercel.json` define o build e o roteamento.

## Como funciona

```
vercel.json:
  buildCommand: npm run build       → vite build (frontend → dist/) + esbuild server.ts → dist/server.cjs
  outputDirectory: dist
  rewrites:
    /api/(.*)  → /api/index          (server.ts inteiro roda como UMA função serverless)
    /(.*)      → /index.html         (SPA — todo o resto cai no React Router)
```

`api/index.ts` só importa e reexporta o app Express de `server.ts` — não há rotas Vercel-específicas separadas, todo o roteamento de API vive em `server.ts` (mais o router de `server/googleCalendar.ts`). Não há `functions`/`maxDuration` configurados: rotas longas (chat da Aurora, IA) dependem do limite de tempo do plano da Vercel. O bundle `dist/server.cjs` (`npm start`) serve para rodar fora da Vercel (ex.: VPS, ver [`vps-setup-guide.md`](../vps-setup-guide.md)). Isso significa: qualquer rota nova adicionada em `server.ts` já funciona em produção sem tocar em `vercel.json`.

## Headers de segurança

Aplicados a toda rota (`"source": "/(.*)"`), adicionados nesta auditoria (B1):

| Header | Valor | Por quê |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | Impede o navegador de tentar "adivinhar" o tipo de um arquivo servido, reduzindo risco de um upload malicioso ser executado como script. |
| `X-Frame-Options` | `DENY` | Impede que o site seja embutido num `<iframe>` de outro domínio (clickjacking). |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Evita vazar a URL completa (que pode conter dados sensíveis em query string) pra outros domínios via header `Referer`. |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` | Força HTTPS em requisições futuras ao domínio, mesmo que alguém tente acessar via `http://`. |

**Não incluído**: `Content-Security-Policy`, `Permissions-Policy` e `Cross-Origin-Opener-Policy` (ver [TRD §19.4](projeto/02-TRD.md)). Deliberadamente adiado — definir uma CSP corretamente exige primeiro inventariar todo recurso externo carregado pelo frontend (CDNs, fontes, os próprios `VITE_*` de IA chamados direto do navegador — ver [ENVIRONMENT.md](ENVIRONMENT.md)); uma CSP mal calibrada quebra a aplicação silenciosamente em vez de proteger. Fica como próximo passo recomendado, não como pendência esquecida.

## Variáveis de ambiente em produção

Configuradas no painel da Vercel (Project Settings → Environment Variables), nunca no `vercel.json` nem commitadas. Ver [ENVIRONMENT.md](ENVIRONMENT.md) pra lista completa e o que cada uma faz — atenção especial a `SUPABASE_SERVICE_ROLE_KEY` (nunca com prefixo `VITE_`), `SPY_CORS_ORIGIN` (nunca `"*"`), `SPY_API_KEYS`, `REDIS_URL` (endpoint externo com TLS), `WAHA_API_URL`/`WAHA_API_KEY` e as variáveis `GOOGLE_*`. Remova as variáveis legadas `AXIS_*` depois de migrar para as `SPY_*`.

Migrations em `supabase/migrations/` **não** são aplicadas pelo deploy da Vercel — são aplicadas manualmente no Supabase. Confira o que está aplicado no banco vivo antes de assumir (em 2026-09-24, as `20260921_cr3` e `m5_m7` estavam pendentes; `a1`, `a4`, `cr1` e `cr2` já aplicadas).

## CI (`.github/workflows/ci.yml`)

Roda em todo PR e push pra `main`: `npm ci` → type-check (`npm run lint` = `tsc --noEmit`) → `npm audit --audit-level=high` → `npm run build`. Isso não substitui o deploy da Vercel (que é acionado separadamente pela integração Git da própria Vercel) — é uma checagem independente que barra PR com erro de tipo, vulnerabilidade alta/crítica nova, ou build quebrado, antes de chegar em produção.

## Build local

```bash
npm run build   # dist/ (frontend) + dist/server.cjs (backend bundlado)
npm start       # roda o backend já buildado, útil pra testar o bundle antes de subir
```

`npm run dev` (via `tsx dev-server.ts`) roda frontend + backend em modo desenvolvimento, sem passar pelo bundle de produção — é o modo usado no dia a dia, não o que valida o artefato que a Vercel de fato serve.
