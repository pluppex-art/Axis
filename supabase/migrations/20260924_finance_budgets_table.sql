-- Nova feature "Orçamentos" (Financeiro > Gestão) — pedido do usuário, "EM
-- BREVE" no sidebar até então, sem nenhum conceito de orçamento-por-categoria
-- existente na base (só coisas adjacentes sem relação: squads.meta/
-- orcamento_mensal e finance_centros_custo.orcamento, nenhuma delas com
-- recorte por mês nem ligada a finance_categories).
create table if not exists public.finance_budgets (
  id text primary key default gen_random_uuid()::text,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  category_id text not null references public.finance_categories(id) on delete cascade,
  mes text not null, -- 'YYYY-MM'
  valor_orcado numeric not null default 0,
  filial_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, category_id, mes)
);

create index if not exists idx_finance_budgets_tenant_mes on public.finance_budgets(tenant_id, mes);

alter table public.finance_budgets enable row level security;

create policy "finance_budgets_tenant_isolation" on public.finance_budgets
  for all
  using (has_tenant_access(tenant_id))
  with check (has_tenant_access(tenant_id));

comment on table public.finance_budgets is
  'Orçamento planejado por categoria financeira e mês (YYYY-MM) — comparado contra o realizado (soma de finance_entries pago no mesmo mês/categoria) na tela Financeiro > Orçamentos. Um valor por categoria+mês (unique), upsert ao editar.';
