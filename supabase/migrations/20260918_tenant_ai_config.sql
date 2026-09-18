-- Fase 5.1 do mandato "Aurora + S.P.Y. + Integracao com Sistemas Externos" (2026-09-18).
-- Config de IA/Aurora por tenant: ativar/desativar Aurora e armazenar permissoes de
-- modulo (leitura/escrita/execucao). Arrays vazios = tudo liberado (default, para nao
-- quebrar comportamento ja existente). Nesta fase, so aurora_enabled e allowed_execute_modules
-- sao de fato enforcados (ver Helper - Checar Config Aurora Tenant e Helper - Checar Modulo
-- Habilitado no n8n); allowed_read_modules/allowed_write_modules ficam armazenados para uma
-- fase futura de enforcement granular por ferramenta.

create table if not exists public.tenant_ai_config (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  aurora_enabled boolean not null default true,
  allowed_read_modules text[] not null default '{}',
  allowed_write_modules text[] not null default '{}',
  allowed_execute_modules text[] not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id) on delete set null
);

comment on table public.tenant_ai_config is 'Config de IA/Aurora por tenant (Fase 5.1 do mandato Aurora+SPY+Integracoes, 2026-09-18). Arrays vazios = tudo liberado (default, para nao quebrar comportamento existente). allowed_*_modules armazenados mas so allowed_execute_modules e enforcado nesta fase (via Helper - Checar Modulo Habilitado), leitura/escrita granular por ferramenta fica para fase futura.';

alter table public.tenant_ai_config enable row level security;

drop policy if exists tenant_ai_config_select on public.tenant_ai_config;
create policy tenant_ai_config_select on public.tenant_ai_config
  for select using (public.has_tenant_access(tenant_id));

drop policy if exists tenant_ai_config_update on public.tenant_ai_config;
create policy tenant_ai_config_update on public.tenant_ai_config
  for update using (public.has_tenant_access(tenant_id))
  with check (public.has_tenant_access(tenant_id));

-- Backfill: uma linha por tenant existente, com defaults seguros (Aurora ativada, tudo liberado).
insert into public.tenant_ai_config (tenant_id)
select id from public.tenants
on conflict (tenant_id) do nothing;
