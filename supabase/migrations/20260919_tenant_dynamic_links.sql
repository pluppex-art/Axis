-- FASE 5.6 do mandato "Aurora + S.P.Y. + Integracao com Sistemas Externos" (2026-09-19).
-- "Links dinamicos" pedidos pelo mandato: pagamento, agendamento, proposta, checkout,
-- contrato -- NUNCA hardcoded no prompt da Julia/Aurora, sempre lidos ao vivo do SPY.
--
-- Decisao de escopo (pra nao repetir o anti-padrao ja corrigido uma vez neste projeto,
-- ConfigSistemaBackups.tsx fingindo function que nao existia): esta tabela NAO gera links
-- de pagamento/checkout novos -- SPY nao tem integracao de pagamento real hoje (confirmado
-- por auditoria: so ha chamada de teste de credencial Mercado Pago/Stripe/Asaas, nenhuma
-- geracao de cobranca/link). O que esta tabela faz de verdade: deixa o tenant CENTRALIZAR
-- links que ELE MESMO ja tem em outro lugar (o link de pagamento dele na Asaas, o Calendly
-- dele, etc) num unico lugar que a Aurora/Julia le ao vivo -- troca "hardcoded no prompt"
-- por "configurado uma vez no SPY", sem fingir gerar algo que nao gera.
--
-- Links dinamicos que JA SAO reais e nao precisam desta tabela: proposta (view_token, ver
-- migration 20260906_public_proposal_view_tracking.sql) -- ficou de fora do enum abaixo de
-- proposito, ja tem mecanismo proprio.
create table if not exists public.tenant_dynamic_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  link_type text not null check (link_type in ('payment','scheduling','checkout','contract')),
  label text not null,
  url text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id),
  unique (tenant_id, link_type, label)
);

comment on table public.tenant_dynamic_links is 'Links reais que o proprio tenant ja possui (pagamento/agendamento/checkout/contrato) centralizados pra Aurora/Julia lerem ao vivo em vez de hardcoded no prompt (Fase 5.6, mandato Aurora+SPY+Integracoes, 2026-09-19). NAO gera links novos -- so centraliza os que o tenant ja tem.';

alter table public.tenant_dynamic_links enable row level security;

drop policy if exists tenant_dynamic_links_select on public.tenant_dynamic_links;
create policy tenant_dynamic_links_select on public.tenant_dynamic_links
  for select using (public.has_tenant_access(tenant_id));

drop policy if exists tenant_dynamic_links_insert on public.tenant_dynamic_links;
create policy tenant_dynamic_links_insert on public.tenant_dynamic_links
  for insert with check (public.has_tenant_access(tenant_id));

drop policy if exists tenant_dynamic_links_update on public.tenant_dynamic_links;
create policy tenant_dynamic_links_update on public.tenant_dynamic_links
  for update using (public.has_tenant_access(tenant_id));

drop policy if exists tenant_dynamic_links_delete on public.tenant_dynamic_links;
create policy tenant_dynamic_links_delete on public.tenant_dynamic_links
  for delete using (public.has_tenant_access(tenant_id));

create index if not exists idx_tenant_dynamic_links_tenant on public.tenant_dynamic_links (tenant_id);
