-- P0 fundação financeira: liga finance_entries.category (texto livre) a
-- finance_categories de verdade (category_id), e adiciona as dimensões que
-- faltam (centro de custo, tags, data de competência separada da data de
-- pagamento, conta bancária) — nenhuma delas quebra o que já existe, todas
-- nullable/com default seguro.
alter table public.finance_entries
  add column if not exists category_id text references public.finance_categories(id),
  add column if not exists centro_custo_id uuid references public.finance_centros_custo(id),
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists competencia_date date,
  add column if not exists conta_bancaria_id uuid references public.finance_bank_accounts(id);

create index if not exists idx_finance_entries_category_id on public.finance_entries (category_id);
create index if not exists idx_finance_entries_centro_custo_id on public.finance_entries (centro_custo_id);

-- Backfill 1: cria em finance_categories qualquer categoria (tenant_id +
-- nome de texto) usada em finance_entries que ainda não existe lá — hoje a
-- tela de Categorias e o campo de categoria da transação são desconectados.
-- Subtipo é um melhor-esforço a partir do nome real em uso; o usuário
-- reclassifica pela tela de Categorias quando quiser refinar.
insert into public.finance_categories (id, tenant_id, nome, tipo, subtipo, created_at)
select
  gen_random_uuid()::text,
  d.tenant_id,
  d.category,
  case d.type when 'Receber' then 'Receita' else 'Despesa' end,
  case
    when d.type = 'Pagar' then
      case lower(trim(d.category))
        when 'salario' then 'PESSOAS'
        when 'salário' then 'PESSOAS'
        when 'pro-labore' then 'PESSOAS'
        when 'pró-labore' then 'PESSOAS'
        when 'comissão de vendas' then 'PESSOAS'
        when 'comissao de vendas' then 'PESSOAS'
        when 'aluguel' then 'DESPESA_FIXA'
        when 'condominio' then 'DESPESA_FIXA'
        when 'condomínio' then 'DESPESA_FIXA'
        when 'energia' then 'DESPESA_FIXA'
        when 'assinaturas/software' then 'DESPESA_FIXA'
        else 'DESPESA_VARIAVEL'
      end
    else null
  end,
  now()
from (
  select distinct tenant_id, category, type
  from public.finance_entries
  where category is not null and tenant_id is not null
) d
where not exists (
  select 1 from public.finance_categories fc
  where fc.tenant_id = d.tenant_id and fc.nome = d.category
);

-- Backfill 2: liga cada lançamento existente à categoria correspondente por
-- nome (mesmo tenant) — só preenche onde ainda está null, nunca sobrescreve.
update public.finance_entries fe
set category_id = fc.id
from public.finance_categories fc
where fc.tenant_id = fe.tenant_id
  and fc.nome = fe.category
  and fe.category_id is null;
