# Segurança

Este documento resume as práticas e a postura de segurança do projeto. Para o levantamento detalhado achado-por-achado desta auditoria (2026-09), ver [`SECURITY_AUDIT.md`](../SECURITY_AUDIT.md) (histórico completo + status de cada correção) e [`FINAL_SECURITY_REPORT.md`](../FINAL_SECURITY_REPORT.md) (resumo executivo). Para reportar uma vulnerabilidade nova, ver "Divulgação" no fim deste arquivo.

## Princípio central: nunca confiar no cliente

Toda decisão de segurança deste projeto parte de uma regra: **o navegador é hostil por padrão**. Qualquer checagem que só existe no frontend (esconder um botão, desabilitar um campo, validar um formato) é conveniência de UX — não é controle de acesso. Os controles reais são:

1. **RLS no Postgres** (Supabase) — autoridade real sobre quem lê/escreve qual linha. Ver [DATABASE_SECURITY.md](DATABASE_SECURITY.md).
2. **Middlewares do backend** (`requireUser`/`requireApiKey`/`requireMaster` em `server.ts`) — autoridade real sobre quais ações de plataforma (criar tenant, trocar credencial de outro usuário) são permitidas. Ver [AUTHORIZATION.md](AUTHORIZATION.md).

Se uma mudança nova adicionar uma tela ou botão sensível, a pergunta a fazer não é "o botão está escondido pra quem não devia ver", é "o que impede alguém de chamar a rota/policy por trás diretamente, sem passar pelo botão".

## Isolamento multi-tenant

Cada tenant (empresa) só acessa seus próprios dados, com duas exceções deliberadas: contas `is_master` (plataforma) e parceiros mapeados via `tenant_partners`. Ver [DATABASE_SECURITY.md](DATABASE_SECURITY.md#partners-e-tenant_partners) pra como esse acesso cruzado é modelado e quem pode concedê-lo (só master).

## Segredos

- Chave `anon` do Supabase e `VITE_*` são **públicas por design** — a chave `service_role` é a única que precisa de sigilo real no lado Supabase, e só é usada no backend, atrás de `requireMaster` (exceto em `/api/v1/leads`, onde o tenant vem da API key, nunca do corpo da requisição). Ver [ENVIRONMENT.md](ENVIRONMENT.md).
- Nenhum arquivo `.pem`/`.key`/certificado foi encontrado commitado no repositório.
- Chaves reais foram encontradas no histórico do git (`AXIS_API_KEY_MAIN`/`AXIS_API_KEY_FORM` — hoje `SPY_API_KEYS` — e a chave do Gemini) e continuam sendo os valores em uso — 🚨 rotação é ação manual pendente, ver [ENVIRONMENT.md](ENVIRONMENT.md#achado-desta-auditoria-chaves-reais-no-histórico-do-git).
- Uma conta master com credenciais hardcoded no bundle do cliente foi encontrada e removida do código — 🚨 a senha dessa conta ainda precisa ser trocada manualmente no Supabase Auth, ver [AUTHENTICATION.md](AUTHENTICATION.md#conta-master-hardcoded-removida).

## Rate limiting

`express-rate-limit` em três grupos de rotas: API pública (`/api/v1/leads`, 60/min), rotas de IA (`/api/leads/*`, `/api/ai/*`, 20/min), simulador de WhatsApp (`/api/whatsapp/*`, 60/min) — por IP. Protege contra força-bruta de `x-api-key` e abuso volumétrico das chamadas de IA (que têm custo real por chamada).

## CORS

Allowlist explícita via `SPY_CORS_ORIGIN` (`server.ts`) — origem só é liberada se está na lista; sem a variável, nenhuma origem passa. Substituiu um wildcard `"*"` usado como default anterior.

## Tratamento de erro

Respostas de erro ao cliente usam mensagens genéricas em português; o detalhe real (`error.message`, stack) vai só para `console.error` do servidor, nunca no corpo da resposta HTTP. Isso vale pras rotas administrativas e pra API pública — evita vazar detalhe de schema/implementação pra quem está sondando a API de fora.

## Dependências

`npm audit` monitorado em CI (`--audit-level=high`, falha o build em achado alto/crítico). Duas dependências não usadas (`firebase`, `uuid`) foram removidas nesta auditoria. Três vulnerabilidades moderadas remanescentes (cadeia `express`→`body-parser`→`qs`) exigem um upgrade major do `express` — deliberadamente não forçado sem testar compatibilidade primeiro; ver [`SECURITY_AUDIT.md`](../SECURITY_AUDIT.md).

## O que já estava correto antes desta auditoria

- `service_role` nunca aparece em código de `src/` (só em `server.ts`).
- Rotas administrativas já eram gated por `requireMaster` no servidor, não só na UI.
- Nenhum stack trace era devolvido ao cliente nas rotas verificadas.
- Escrita em Storage já era corretamente restrita por pasta = tenant.

## Divulgação de vulnerabilidades

Projeto interno — reporte diretamente à equipe responsável (não há programa público de bug bounty nem canal externo configurado).
