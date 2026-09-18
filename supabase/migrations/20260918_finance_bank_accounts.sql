-- P0 fundação financeira: contas bancárias reais (ContaBancaria da
-- especificação) — hoje não existe nenhum conceito de saldo de conta.
create table if not exists public.finance_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default current_tenant_id() references public.tenants(id),
  nome text not null,
  tipo text not null default 'CONTA_CORRENTE' check (tipo in (
    'CONTA_CORRENTE','CONTA_POUPANCA','CARTEIRA','COFRE','INVESTIMENTO',
    'CARTAO_CREDITO','CARTAO_DEBITO','OUTRO'
  )),
  saldo_inicial numeric(15,2) not null default 0,
  sinal_saldo_inicial text not null default 'POSITIVO' check (sinal_saldo_inicial in ('POSITIVO','NEGATIVO','ZERADO')),
  is_principal boolean not null default false,
  arquivada boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.finance_bank_accounts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='finance_bank_accounts' and policyname='tenant_isolation'
  ) then
    create policy tenant_isolation on public.finance_bank_accounts
      for all using (has_tenant_access(tenant_id)) with check (has_tenant_access(tenant_id));
  end if;
end $$;

-- no máximo 1 conta principal por tenant
create unique index if not exists finance_bank_accounts_one_principal
  on public.finance_bank_accounts (tenant_id)
  where is_principal;

create index if not exists idx_finance_bank_accounts_tenant on public.finance_bank_accounts (tenant_id);
