-- Operações > Ordens de Serviço: documento de serviço no estilo pedido de compra de empresa
-- grande (cabeçalho + itens de serviço/material + condições + aprovação), pra quem trabalha só
-- com serviço usar o sistema. Numeração sequencial POR TENANT (OS-0001, OS-0002…).
--
-- Fluxo (status): Rascunho → Aberta → Em execução → Concluída → Faturada (+ Cancelada).
-- "Faturada" = já foi gerada a cobrança a receber no Financeiro (financeiro_entry_id).

create table if not exists public.ordens_servico (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  numero integer not null,
  status text not null default 'Rascunho'
    check (status in ('Rascunho', 'Aberta', 'Em execução', 'Concluída', 'Faturada', 'Cancelada')),
  prioridade text not null default 'Normal' check (prioridade in ('Baixa', 'Normal', 'Alta', 'Urgente')),
  titulo text not null default '',
  descricao text,
  -- Cliente (texto livre: serve pra quem não usa o cadastro de clientes do CRM)
  cliente_nome text,
  cliente_documento text,
  cliente_telefone text,
  cliente_email text,
  cliente_endereco text,
  local_execucao text,
  responsavel text,
  data_abertura date not null default current_date,
  data_prevista date,
  data_conclusao date,
  forma_pagamento text,
  condicoes_pagamento text,
  garantia text,
  valor_desconto numeric not null default 0 check (valor_desconto >= 0),
  valor_total numeric not null default 0,
  observacoes text,
  finance_entry_id text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_ordens_servico_numero on public.ordens_servico (tenant_id, numero);
create index if not exists idx_ordens_servico_tenant_status on public.ordens_servico (tenant_id, status, created_at desc);

create table if not exists public.ordem_servico_itens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  ordem_id uuid not null references public.ordens_servico(id) on delete cascade,
  posicao integer not null default 1,
  tipo text not null default 'Serviço' check (tipo in ('Serviço', 'Material')),
  descricao text not null,
  unidade text,
  quantidade numeric not null default 1 check (quantidade > 0),
  valor_unitario numeric not null default 0 check (valor_unitario >= 0),
  valor_total numeric not null default 0,
  product_id uuid references public.products(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_ordem_servico_itens_ordem on public.ordem_servico_itens (ordem_id);

-- Número sequencial por tenant; o lock evita dois inserts simultâneos pegarem o mesmo número.
create or replace function public.ordens_servico_before_insert()
returns trigger language plpgsql as $$
begin
  if new.numero is null or new.numero <= 0 then
    perform pg_advisory_xact_lock(hashtext('ordens_servico:' || new.tenant_id::text));
    select coalesce(max(numero), 0) + 1 into new.numero from public.ordens_servico where tenant_id = new.tenant_id;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_ordens_servico_numero on public.ordens_servico;
create trigger trg_ordens_servico_numero before insert on public.ordens_servico
  for each row execute function public.ordens_servico_before_insert();

create or replace function public.ordens_servico_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists trg_ordens_servico_touch on public.ordens_servico;
create trigger trg_ordens_servico_touch before update on public.ordens_servico
  for each row execute function public.ordens_servico_touch();

alter table public.ordens_servico enable row level security;
alter table public.ordem_servico_itens enable row level security;
drop policy if exists "ordens_servico_tenant_isolation" on public.ordens_servico;
create policy "ordens_servico_tenant_isolation" on public.ordens_servico
  for all using (has_tenant_access(tenant_id)) with check (has_tenant_access(tenant_id));
drop policy if exists "ordem_servico_itens_tenant_isolation" on public.ordem_servico_itens;
create policy "ordem_servico_itens_tenant_isolation" on public.ordem_servico_itens
  for all using (has_tenant_access(tenant_id)) with check (has_tenant_access(tenant_id));
