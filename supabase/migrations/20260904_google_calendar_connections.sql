-- Per-colaborador Google Calendar OAuth connections, used by the Aurora n8n
-- workflows to book meetings on the correct person's real calendar instead of
-- a single hardcoded account. One row per (tenant_id, colaborador_id).
create table if not exists public.google_calendar_connections (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants(id) on delete cascade,
  colaborador_id           text not null references public.colaboradores(id) on delete cascade,
  google_email             text,
  refresh_token            text not null,
  access_token             text,
  access_token_expires_at  timestamptz,
  scope                    text,
  status                   text not null default 'active' check (status in ('active','disconnected','error')),
  last_error               text,
  connected_at             timestamptz not null default now(),
  disconnected_at          timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint google_calendar_connections_tenant_colaborador_unique unique (tenant_id, colaborador_id)
);

create index if not exists idx_google_calendar_connections_lookup
  on public.google_calendar_connections (tenant_id, colaborador_id) where status = 'active';

create or replace trigger update_google_calendar_connections_modtime
before update on public.google_calendar_connections
for each row execute function update_modified_column();

alter table public.google_calendar_connections enable row level security;

-- Deliberately stricter than the blanket tenant_isolation policy used on most
-- tables: refresh_token is a bearer credential for someone's real personal
-- Google account, so a colaborador may only see their own row (or a super
-- admin, any row). n8n's service-role-equivalent credential bypasses RLS
-- entirely, as with every other table in this schema.
create policy tenant_isolation on public.google_calendar_connections
for all to authenticated
using (
  (tenant_id = public.current_tenant_id()
    and colaborador_id = (select id from public.colaboradores where user_id = auth.uid() limit 1))
  or public.is_super_admin()
)
with check (
  (tenant_id = public.current_tenant_id()
    and colaborador_id = (select id from public.colaboradores where user_id = auth.uid() limit 1))
  or public.is_super_admin()
);
