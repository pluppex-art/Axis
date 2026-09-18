-- ==============================================================================
-- MIGRATION: 20260911_updates_crm_finance_marketing_saas.sql
-- Atualização completa para Módulos de Afiliados/Indicações, Automações,
-- Landing Pages, Produtos/Estoque e SaaS Multi-Tenant
-- ==============================================================================

-- 1. AFILIADOS & INDICAÇÕES
-- Criação da tabela de afiliados e expansão dos tipos de indicação
create table if not exists public.afiliados (
  id text primary key default (gen_random_uuid())::text,
  tenant_id uuid not null default current_tenant_id(),
  name text not null,
  email text,
  phone text,
  pix_key text,
  code text not null,
  commission_type text not null default 'percentual' check (commission_type in ('percentual', 'fixo')),
  commission_rate numeric not null default 10,
  status text not null default 'Ativo' check (status in ('Ativo', 'Inativo')),
  created_at timestamptz not null default now(),
  constraint afiliados_unique_tenant_code unique (tenant_id, code)
);

alter table public.afiliados enable row level security;

drop policy if exists tenant_isolation_afiliados on public.afiliados;
create policy tenant_isolation_afiliados on public.afiliados
  for all
  using (has_tenant_access(tenant_id))
  with check (has_tenant_access(tenant_id));

-- Atualizar indicacoes para aceitar afiliados externos
alter table public.indicacoes drop constraint if exists indicacoes_referrer_type_check;
alter table public.indicacoes drop constraint if exists indicacoes_referrer_matches_type;

alter table public.indicacoes
  add column if not exists affiliate_id text references public.afiliados(id) on delete set null,
  add column if not exists affiliate_code text;

-- 2. MARKETING AUTOMAÇÕES
-- Adiciona suporte multi-canal (WhatsApp, E-mail, Misto), ações e templates
alter table public.marketing_automations
  add column if not exists name text not null default 'Nova Automação',
  add column if not exists channel text not null default 'whatsapp',
  add column if not exists trigger text default 'lead_created',
  add column if not exists steps integer not null default 1,
  add column if not exists active_count integer not null default 0,
  add column if not exists conversion_rate numeric not null default 0,
  add column if not exists status text not null default 'Ativo',
  add column if not exists description text,
  add column if not exists actions jsonb not null default '[]',
  add column if not exists last_run timestamptz;

-- 3. MARKETING LANDING PAGES
-- Adiciona colunas para métricas reais, ranking e conexão com landing pages externas
alter table public.marketing_landing_pages
  add column if not exists title text not null default 'Nova Landing Page',
  add column if not exists url text,
  add column if not exists status text not null default 'Publicada',
  add column if not exists views integer not null default 0,
  add column if not exists clicks integer not null default 0,
  add column if not exists conversions integer not null default 0,
  add column if not exists revenue numeric not null default 0,
  add column if not exists is_external boolean not null default false,
  add column if not exists client_name text,
  add column if not exists script_id text;

-- 4. MARKETING FORMULÁRIOS
-- Adiciona suporte ao layout contínuo vs passo a passo (corridinha)
alter table public.marketing_forms
  add column if not exists layout_mode text not null default 'passo_a_passo' check (layout_mode in ('scroll', 'passo_a_passo', 'iframe'));

-- 5. PRODUTOS & ESTOQUE
-- Garante campos para controle de estoque, recorrência e taxa de implantação
alter table public.products
  add column if not exists stock integer not null default 0,
  add column if not exists stock_min integer not null default 0,
  add column if not exists stock_max integer,
  add column if not exists is_recurring boolean not null default false,
  add column if not exists recurring_period text,
  add column if not exists implementation_fee numeric default 0;

-- 6. PERMISSÕES & GRANTS
grant all on public.afiliados to anon, authenticated;
grant all on public.indicacoes to anon, authenticated;
grant all on public.marketing_automations to anon, authenticated;
grant all on public.marketing_landing_pages to anon, authenticated;
grant all on public.marketing_forms to anon, authenticated;
grant all on public.products to anon, authenticated;
