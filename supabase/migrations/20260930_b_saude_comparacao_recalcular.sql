-- Recalcula os contadores/totais de uma comparação a partir dos itens (SECURITY INVOKER: a RLS
-- do usuário que chamou continua valendo — só enxerga/atualiza o que é do próprio tenant).
create or replace function public.saude_comparacao_recalcular(p_comparacao_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  a int; r int; n int; vp numeric; ct numeric; dt numeric;
begin
  select
    count(*) filter (where status in ('automatico', 'confirmado')),
    count(*) filter (where status = 'revisao'),
    count(*) filter (where status in ('nao_identificado', 'rejeitado')),
    coalesce(sum(valor_parceiro * coalesce(quantidade, 1)), 0),
    coalesce(sum(custo_base * coalesce(quantidade, 1)) filter (where exame_base_id is not null), 0),
    coalesce(sum(diferenca * coalesce(quantidade, 1)), 0)
  into a, r, n, vp, ct, dt
  from public.saude_comparacao_itens
  where comparacao_id = p_comparacao_id;

  update public.saude_comparacoes set
    qtd_automatico = a,
    qtd_revisao = r,
    qtd_nao_identificado = n,
    valor_total_parceiro = vp,
    custo_total = ct,
    diferenca_total = dt,
    total = a + r + n,
    status = case when status = 'erro' then status when r + n > 0 then 'aguardando_revisao' else 'concluido' end,
    concluida_em = case when r + n = 0 then coalesce(concluida_em, now()) else null end
  where id = p_comparacao_id;
end;
$$;
