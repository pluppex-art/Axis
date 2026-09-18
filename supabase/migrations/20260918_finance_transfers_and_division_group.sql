-- Transferência é uma entidade SEPARADA de finance_entries — nunca é
-- receita nem despesa, nunca entra no DRE. Debita a conta de origem e
-- credita a conta de destino quando marcada como paga.
create table if not exists public.finance_transfers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default current_tenant_id() references public.tenants(id),
  valor numeric(15,2) not null check (valor > 0),
  pago boolean not null default false,
  descricao text,
  data_pagamento date not null default current_date,
  conta_origem_id uuid not null references public.finance_bank_accounts(id),
  conta_destino_id uuid not null references public.finance_bank_accounts(id),
  created_at timestamptz not null default now(),
  constraint finance_transfers_contas_diferentes check (conta_origem_id <> conta_destino_id)
);

alter table public.finance_transfers enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='finance_transfers' and policyname='tenant_isolation'
  ) then
    create policy tenant_isolation on public.finance_transfers
      for all using (has_tenant_access(tenant_id)) with check (has_tenant_access(tenant_id));
  end if;
end $$;

create index if not exists idx_finance_transfers_tenant on public.finance_transfers (tenant_id);
create index if not exists idx_finance_transfers_origem on public.finance_transfers (conta_origem_id);
create index if not exists idx_finance_transfers_destino on public.finance_transfers (conta_destino_id);

-- Rateio ("Detalhar valor"): divide um lançamento em N linhas que
-- compartilham este id de grupo — cada divisão é um finance_entries normal
-- (mesma convenção já usada por installment_group_id), só pra permitir
-- mostrar o badge de agrupamento na listagem depois.
alter table public.finance_entries
  add column if not exists division_group_id text;

create index if not exists idx_finance_entries_division_group on public.finance_entries (division_group_id);
