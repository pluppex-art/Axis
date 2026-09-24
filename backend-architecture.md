# Arquitetura Backend — DOCUMENTO DESCONTINUADO

> **Este documento foi descontinuado em 2026-09-24.** Ele descrevia um modelo antigo (tabelas `companies`, `roles`, `invoices` etc.) que **não existe** no banco de produção e não corresponde ao código atual. O SQL e os diagramas antigos foram removidos de propósito, para que ninguém os aplique por engano.

Use no lugar:

- [`docs/projeto/05-ESQUEMA-BACKEND.md`](docs/projeto/05-ESQUEMA-BACKEND.md) — esquema real do banco (129 tabelas, RLS, funções, triggers, storage), verificado contra o banco vivo.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — visão geral da arquitetura (frontend, `server.ts`, Supabase, multi-tenancy).
- [`docs/projeto/02-TRD.md`](docs/projeto/02-TRD.md) — detalhes técnicos do backend e inventário de rotas.
