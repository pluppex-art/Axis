-- Implementações: acompanhamento da implantação de cada cliente que fechou
-- contrato (formulário completo de dados + integrações, progresso, relatório).
--
-- Uma implementação por cliente (unique tenant+cliente). As respostas do
-- formulário ficam em `data` (jsonb, chaveado pelo id do campo definido em
-- src/lib/implementationForm.ts) — a definição do formulário vive no código,
-- não no banco, então adicionar/remover campo não exige migração.
--
-- `share_token` já existe aqui pra a Etapa 2 (link público em que o próprio
-- cliente preenche os campos dele) não precisar de outra migração — mesmo
-- padrão de proposals.view_token (token aleatório, acesso via endpoint com
-- service role, nunca por RLS).
--
-- NÃO guardar senha/token de acesso em `data`: os campos de integração
-- registram só o STATUS e identificadores públicos (ID do pixel, número...).
create table if not exists public.implementations (
  id text primary key default gen_random_uuid()::text,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  cliente_id text not null references public.clientes(id) on delete cascade,
  lead_id text,
  contract_id text,
  status text not null default 'Em andamento'
    check (status in ('Em andamento', 'Aguardando cliente', 'Bloqueada', 'Concluída')),
  responsavel text,
  data jsonb not null default '{}'::jsonb,
  internal_notes text,
  share_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  go_live_date date,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, cliente_id)
);

create index if not exists idx_implementations_tenant_status on public.implementations(tenant_id, status);

create or replace function public.implementations_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_implementations_touch on public.implementations;
create trigger trg_implementations_touch
  before update on public.implementations
  for each row execute function public.implementations_touch();

alter table public.implementations enable row level security;

create policy "implementations_tenant_isolation" on public.implementations
  for all
  using (has_tenant_access(tenant_id))
  with check (has_tenant_access(tenant_id));

comment on table public.implementations is
  'Implantação por cliente fechado: formulário (data jsonb), status, responsável, progresso derivado no front, relatório e link público (share_token, Etapa 2).';
