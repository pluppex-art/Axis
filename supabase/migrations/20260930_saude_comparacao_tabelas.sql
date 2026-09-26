-- Clínica & Saúde > Comparação de Tabelas.
-- Base mestre de exames por tenant, comparações (tabela de parceiro x base), itens com nível de
-- confiança e memória de equivalências confirmadas. TUDO isolado por tenant (RLS): nenhum
-- tenant enxerga base, histórico ou equivalências de outro.

create table if not exists public.saude_exames_base (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  codigo_interno text,
  codigo_externo text,
  nome text not null,
  nomes_alternativos text[] not null default '{}',
  descricao text,
  tipo text,
  categoria text,
  material text,
  unidade text,
  custo numeric check (custo is null or custo >= 0),
  valor numeric check (valor is null or valor >= 0),
  valor_referencia text,
  parceiro text,
  observacoes text,
  ativo boolean not null default true,
  origem text not null default 'manual' check (origem in ('manual', 'importacao', 'api')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists uq_saude_exames_base_codigo
  on public.saude_exames_base (tenant_id, codigo_interno) where codigo_interno is not null;
create index if not exists idx_saude_exames_base_tenant on public.saude_exames_base (tenant_id, ativo, nome);

create table if not exists public.saude_comparacoes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  parceiro text not null,
  arquivo_nome text,
  status text not null default 'aguardando'
    check (status in ('aguardando', 'importando', 'validando', 'normalizando', 'processando', 'aguardando_revisao', 'concluido', 'erro')),
  total integer not null default 0,
  qtd_automatico integer not null default 0,
  qtd_revisao integer not null default 0,
  qtd_nao_identificado integer not null default 0,
  valor_total_parceiro numeric not null default 0,
  custo_total numeric not null default 0,
  diferenca_total numeric not null default 0,
  config jsonb not null default '{}'::jsonb,
  versao_motor text,
  erro_mensagem text,
  created_by uuid,
  created_at timestamptz not null default now(),
  concluida_em timestamptz
);
create index if not exists idx_saude_comparacoes_tenant on public.saude_comparacoes (tenant_id, created_at desc);

create table if not exists public.saude_comparacao_itens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  comparacao_id uuid not null references public.saude_comparacoes(id) on delete cascade,
  linha integer not null,
  nome_parceiro text not null default '',
  codigo_parceiro text,
  quantidade numeric,
  valor_parceiro numeric,
  custo_parceiro numeric,
  extras jsonb not null default '{}'::jsonb,
  exame_base_id uuid references public.saude_exames_base(id) on delete set null,
  score integer not null default 0,
  status text not null default 'nao_identificado'
    check (status in ('automatico', 'revisao', 'nao_identificado', 'confirmado', 'rejeitado')),
  origem_decisao text check (origem_decisao in ('codigo', 'memoria', 'sinonimo', 'similaridade', 'aurora', 'manual')),
  motivo text,
  evidencias jsonb not null default '[]'::jsonb,
  candidatos jsonb not null default '[]'::jsonb,
  custo_base numeric,
  valor_base numeric,
  diferenca numeric,
  diferenca_pct numeric,
  margem numeric,
  revisado_por uuid,
  revisado_em timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_saude_comp_itens_comp on public.saude_comparacao_itens (comparacao_id, status, linha);
create index if not exists idx_saude_comp_itens_tenant on public.saude_comparacao_itens (tenant_id, comparacao_id);

-- Memória: equivalências confirmadas por uma pessoa (nome do parceiro normalizado → exame da base).
create table if not exists public.saude_equivalencias (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  parceiro text not null default '',
  exame_base_id uuid not null references public.saude_exames_base(id) on delete cascade,
  nome_parceiro text not null,
  nome_parceiro_norm text not null,
  codigo_parceiro text,
  origem text not null default 'manual' check (origem in ('manual', 'aurora', 'importacao')),
  confianca integer,
  observacao text,
  status text not null default 'ativa' check (status in ('ativa', 'revogada')),
  confirmado_por uuid,
  confirmado_em timestamptz not null default now(),
  historico jsonb not null default '[]'::jsonb
);
create unique index if not exists uq_saude_equivalencias
  on public.saude_equivalencias (tenant_id, parceiro, nome_parceiro_norm);
create index if not exists idx_saude_equivalencias_base on public.saude_equivalencias (exame_base_id);

create or replace function public.saude_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists trg_saude_exames_base_touch on public.saude_exames_base;
create trigger trg_saude_exames_base_touch before update on public.saude_exames_base
  for each row execute function public.saude_touch_updated_at();

alter table public.saude_exames_base enable row level security;
alter table public.saude_comparacoes enable row level security;
alter table public.saude_comparacao_itens enable row level security;
alter table public.saude_equivalencias enable row level security;
do $$
declare t text;
begin
  foreach t in array array['saude_exames_base', 'saude_comparacoes', 'saude_comparacao_itens', 'saude_equivalencias'] loop
    execute format('drop policy if exists "%s_tenant_isolation" on public.%I', t, t);
    execute format('create policy "%s_tenant_isolation" on public.%I for all using (has_tenant_access(tenant_id)) with check (has_tenant_access(tenant_id))', t, t);
  end loop;
end $$;
