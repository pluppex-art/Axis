-- Varejo > Notas de Entrada: nota fiscal de compra estruturada (cabeçalho +
-- itens) que dá entrada no estoque. Antes só existiam as Ordens de Compra
-- (`compras`), que são texto livre — sem itens, sem chave/número da nota e com
-- recebimento de UM produto por vez.
--
-- Fluxo (status): Rascunho → Pronta para envio → Enviada → Validada → No estoque
-- (+ Erro / Cancelada). Nesta etapa o envio/validação por API externa ainda
-- não está ligado (colunas enviada_em/validada_em/envio_resposta já existem
-- pra não exigir outra migração); a entrada no estoque é feita pela função
-- lancar_nota_entrada_estoque abaixo, que a integração vai chamar depois.

create table if not exists public.notas_entrada (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  status text not null default 'Rascunho'
    check (status in ('Rascunho', 'Pronta para envio', 'Enviada', 'Validada', 'No estoque', 'Erro', 'Cancelada')),
  origem text not null default 'manual' check (origem in ('xml', 'manual', 'ia')),
  numero text,
  serie text,
  chave_acesso text check (chave_acesso is null or chave_acesso ~ '^[0-9]{44}$'),
  data_emissao date,
  data_entrada date,
  natureza_operacao text,
  fornecedor_nome text,
  fornecedor_cnpj text,
  valor_produtos numeric not null default 0,
  valor_frete numeric not null default 0,
  valor_desconto numeric not null default 0,
  valor_outras numeric not null default 0,
  valor_total numeric not null default 0,
  xml_original text,
  observacoes text,
  erro_mensagem text,
  enviada_em timestamptz,
  validada_em timestamptz,
  envio_resposta jsonb,
  stock_posted_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Mesma nota (chave de acesso) não entra duas vezes — a não ser que a anterior tenha sido cancelada.
create unique index if not exists uq_notas_entrada_chave
  on public.notas_entrada (tenant_id, chave_acesso)
  where chave_acesso is not null and status <> 'Cancelada';
create index if not exists idx_notas_entrada_tenant_status on public.notas_entrada (tenant_id, status, created_at desc);

create table if not exists public.nota_entrada_itens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  nota_id uuid not null references public.notas_entrada(id) on delete cascade,
  numero_item integer not null,
  codigo text,
  ean text,
  descricao text not null,
  ncm text,
  cfop text,
  unidade text,
  quantidade numeric not null check (quantidade > 0),
  valor_unitario numeric not null default 0,
  valor_total numeric not null default 0,
  -- Produto do catálogo que recebe a entrada; nulo = ainda não vinculado.
  product_id uuid references public.products(id) on delete set null,
  -- Quantas UNIDADES de estoque entram (a nota pode vir em caixa/pacote: 2 CX c/12 = 24).
  qtd_estoque numeric,
  estoque_lancado boolean not null default false,
  created_at timestamptz not null default now(),
  unique (nota_id, numero_item)
);
create index if not exists idx_nota_entrada_itens_nota on public.nota_entrada_itens (nota_id);
create index if not exists idx_nota_entrada_itens_product on public.nota_entrada_itens (product_id);

alter table public.estoque_movimentacoes add column if not exists referencia_nota_id uuid;

create or replace function public.notas_entrada_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists trg_notas_entrada_touch on public.notas_entrada;
create trigger trg_notas_entrada_touch before update on public.notas_entrada
  for each row execute function public.notas_entrada_touch();

alter table public.notas_entrada enable row level security;
alter table public.nota_entrada_itens enable row level security;
create policy "notas_entrada_tenant_isolation" on public.notas_entrada
  for all using (has_tenant_access(tenant_id)) with check (has_tenant_access(tenant_id));
create policy "nota_entrada_itens_tenant_isolation" on public.nota_entrada_itens
  for all using (has_tenant_access(tenant_id)) with check (has_tenant_access(tenant_id));

-- Dá entrada no estoque de TODOS os itens da nota, de uma vez ou nada (uma
-- função = uma transação: qualquer exceção desfaz tudo). Valida antes de mexer:
-- todo item ligado a um produto DESTE ambiente e com quantidade inteira > 0.
-- Idempotente por nota: nota que já está "No estoque" é recusada, então
-- reenvio/duplo clique nunca duplica o estoque.
create or replace function public.lancar_nota_entrada_estoque(p_nota_id uuid, p_atualizar_custo boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_nota record;
  v_item record;
  v_prod record;
  v_qtd integer;
  v_itens integer := 0;
  v_unidades integer := 0;
begin
  select * into v_nota from notas_entrada where id = p_nota_id for update;
  if v_nota.id is null then raise exception 'Nota não encontrada.'; end if;
  if not has_tenant_access(v_nota.tenant_id) then raise exception 'Sem permissão para esta nota.'; end if;
  if v_nota.status = 'Cancelada' then raise exception 'Nota cancelada não pode dar entrada no estoque.'; end if;
  if v_nota.status = 'No estoque' then raise exception 'Esta nota já deu entrada no estoque.'; end if;

  if not exists (select 1 from nota_entrada_itens where nota_id = p_nota_id) then
    raise exception 'A nota não tem itens.';
  end if;

  for v_item in select * from nota_entrada_itens where nota_id = p_nota_id order by numero_item loop
    if v_item.product_id is null then
      raise exception 'O item % (%) ainda não está ligado a um produto.', v_item.numero_item, v_item.descricao;
    end if;
    if coalesce(v_item.qtd_estoque, 0) <= 0 or v_item.qtd_estoque <> trunc(v_item.qtd_estoque) then
      raise exception 'O item % (%) precisa de uma quantidade de entrada inteira e maior que zero.', v_item.numero_item, v_item.descricao;
    end if;
  end loop;

  for v_item in select * from nota_entrada_itens where nota_id = p_nota_id order by numero_item loop
    select * into v_prod from products where id = v_item.product_id and tenant_id = v_nota.tenant_id for update;
    if v_prod.id is null then
      raise exception 'O produto do item % não existe neste ambiente.', v_item.numero_item;
    end if;
    v_qtd := v_item.qtd_estoque::integer;

    update products
       set "currentStock" = coalesce("currentStock", 0) + v_qtd,
           cost = case when p_atualizar_custo and v_item.valor_total > 0 then round(v_item.valor_total / v_qtd, 2) else cost end
     where id = v_item.product_id;

    insert into estoque_movimentacoes (tenant_id, product_id, tipo, quantidade, motivo, created_by, referencia_nota_id)
    values (v_nota.tenant_id, v_item.product_id, 'entrada', v_qtd,
            'NF ' || coalesce(v_nota.numero, 's/n') || coalesce(' — ' || v_nota.fornecedor_nome, ''), auth.uid(), p_nota_id);

    update nota_entrada_itens set estoque_lancado = true where id = v_item.id;
    v_itens := v_itens + 1;
    v_unidades := v_unidades + v_qtd;
  end loop;

  update notas_entrada
     set status = 'No estoque', stock_posted_at = now(), erro_mensagem = null,
         data_entrada = coalesce(data_entrada, current_date)
   where id = p_nota_id;

  return jsonb_build_object('success', true, 'itens', v_itens, 'unidades', v_unidades);
end;
$fn$;

comment on table public.notas_entrada is 'Nota fiscal de entrada (compra) do varejo: cabeçalho, status do fluxo (Rascunho → No estoque) e espaço pra resposta da API externa que valida/vende a nota.';
