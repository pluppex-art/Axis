-- Soma do valor do parceiro apenas dos itens que têm exame correspondente (base para a margem
-- geral: (valor_correspondido - custo_total) / valor_correspondido).
alter table public.saude_comparacoes add column if not exists valor_correspondido numeric not null default 0;

create or replace function public.saude_comparacao_recalcular(p_comparacao_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  a int; r int; n int; vp numeric; vc numeric; ct numeric; dt numeric;
begin
  select
    count(*) filter (where status in ('automatico', 'confirmado')),
    count(*) filter (where status = 'revisao'),
    count(*) filter (where status in ('nao_identificado', 'rejeitado')),
    coalesce(sum(valor_parceiro * coalesce(quantidade, 1)), 0),
    coalesce(sum(valor_parceiro * coalesce(quantidade, 1)) filter (where exame_base_id is not null), 0),
    coalesce(sum(custo_base * coalesce(quantidade, 1)) filter (where exame_base_id is not null), 0),
    coalesce(sum(diferenca * coalesce(quantidade, 1)), 0)
  into a, r, n, vp, vc, ct, dt
  from public.saude_comparacao_itens
  where comparacao_id = p_comparacao_id;

  update public.saude_comparacoes set
    qtd_automatico = a,
    qtd_revisao = r,
    qtd_nao_identificado = n,
    valor_total_parceiro = vp,
    valor_correspondido = vc,
    custo_total = ct,
    diferenca_total = dt,
    total = a + r + n,
    status = case when status = 'erro' then status when r + n > 0 then 'aguardando_revisao' else 'concluido' end,
    concluida_em = case when r + n = 0 then coalesce(concluida_em, now()) else null end
  where id = p_comparacao_id;
end;
$$;
