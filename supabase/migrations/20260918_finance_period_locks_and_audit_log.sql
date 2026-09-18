-- Bloqueio de período (fechamento contábil): impede criar/editar/excluir
-- transações PAGAS dentro do intervalo — pendentes continuam editáveis.
create table if not exists public.finance_period_locks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default current_tenant_id() references public.tenants(id),
  data_inicial date not null,
  data_final date not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.users(id),
  constraint finance_period_locks_intervalo_valido check (data_final >= data_inicial)
);

alter table public.finance_period_locks enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='finance_period_locks' and policyname='tenant_isolation'
  ) then
    create policy tenant_isolation on public.finance_period_locks
      for all using (has_tenant_access(tenant_id)) with check (has_tenant_access(tenant_id));
  end if;
end $$;

create index if not exists idx_finance_period_locks_tenant on public.finance_period_locks (tenant_id);

-- Log de auditoria financeira: grava quem alterou o quê, com diff campo a
-- campo — cobre as entidades financeiras (finance_entries por enquanto;
-- as outras 4 da especificação original — parcelamento/contato/centro de
-- custo/tag — não têm equivalente próprio neste sistema ainda).
create table if not exists public.finance_audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default current_tenant_id() references public.tenants(id),
  usuario_id uuid references public.users(id),
  usuario_nome text,
  data_hora timestamptz not null default now(),
  tipo_item text not null default 'TRANSACAO' check (tipo_item in ('TRANSACAO','CONTA_BANCARIA','CATEGORIA','TRANSFERENCIA')),
  tipo_acao text not null check (tipo_acao in ('CRIACAO','ATUALIZACAO','EXCLUSAO')),
  descricao_alvo text not null,
  diff jsonb
);

alter table public.finance_audit_log enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='finance_audit_log' and policyname='tenant_isolation'
  ) then
    create policy tenant_isolation on public.finance_audit_log
      for all using (has_tenant_access(tenant_id)) with check (has_tenant_access(tenant_id));
  end if;
  -- Auditoria é histórico imutável: ninguém edita ou apaga um log já
  -- gravado (só insere e lê), nem alterando tenant_id pra "mover" o registro.
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='finance_audit_log' and policyname='no_update'
  ) then
    create policy no_update on public.finance_audit_log for update using (false);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='finance_audit_log' and policyname='no_delete'
  ) then
    create policy no_delete on public.finance_audit_log for delete using (false);
  end if;
end $$;

create index if not exists idx_finance_audit_log_tenant_data on public.finance_audit_log (tenant_id, data_hora desc);
