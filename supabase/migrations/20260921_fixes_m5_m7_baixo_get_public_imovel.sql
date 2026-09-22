-- Correções médias/baixas da auditoria 2026-09-21 (AUDITORIA_NICOLAS_2026-09-21.md)

-- M5: 2 produtos da Pluppex com tenant_id NULL ficavam invisíveis pra
-- qualquer usuário não-master (has_tenant_access(NULL) só é true se is_master).
-- Populamos o tenant_id certo usando a coluna legada "tenantName".
UPDATE public.products
SET tenant_id = '27ef95ee-84dd-499e-9f25-cd9baecb5fe4'
WHERE tenant_id IS NULL AND "tenantName" = 'PLUPPEX DIGITAL MACHINES LTDA';

UPDATE public.products
SET tenant_id = '23a2c336-71f1-456c-90e7-e10ff4502cb3'
WHERE tenant_id IS NULL AND "tenantName" = 'G-Tech Master';

-- M7: `anon` tinha INSERT/UPDATE/DELETE de nível de coluna em `tenants`
-- (herdado de um GRANT genérico antigo), neutralizado hoje só porque não há
-- policy de INSERT/UPDATE pra `anon` -- mesma configuração frágil "duas
-- camadas dependendo de uma" do achado C4 da auditoria anterior. Revoga o
-- que não é necessário; anon só precisa de SELECT (usado por
-- anon_read_active_tenants).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.tenants FROM anon;

-- Baixo: get_public_imovel casava o corretor só por tenant_id + nome, sem
-- checar se ele ainda está ativo -- um corretor desligado continuava com
-- telefone/e-mail pessoal expostos publicamente em qualquer anúncio antigo.
-- get_public_corretor_portfolio já filtrava por status='Ativo'; alinhamos.
create or replace function public.get_public_imovel(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_imovel record;
  v_corretor record;
begin
  if p_id is null then
    return null;
  end if;

  update public.imobiliario_imoveis
  set visitas = visitas + 1
  where id = p_id
  returning id, tenant_id, titulo, tipo, operacao, status, valor, bairro, cidade, area, quartos, banheiros, vagas, corretor, descricao
  into v_imovel;

  if v_imovel.id is null then
    return null;
  end if;

  select nome, telefone, email, creci, slug
  into v_corretor
  from public.imobiliario_corretores
  where tenant_id = v_imovel.tenant_id and nome = v_imovel.corretor and status = 'Ativo'
  limit 1;

  return jsonb_build_object(
    'id', v_imovel.id,
    'titulo', v_imovel.titulo,
    'tipo', v_imovel.tipo,
    'operacao', v_imovel.operacao,
    'status', v_imovel.status,
    'valor', v_imovel.valor,
    'bairro', v_imovel.bairro,
    'cidade', v_imovel.cidade,
    'area', v_imovel.area,
    'quartos', v_imovel.quartos,
    'banheiros', v_imovel.banheiros,
    'vagas', v_imovel.vagas,
    'descricao', v_imovel.descricao,
    'corretorNome', v_imovel.corretor,
    'corretorTelefone', v_corretor.telefone,
    'corretorEmail', v_corretor.email,
    'corretorCreci', v_corretor.creci,
    'corretorSlug', v_corretor.slug
  );
end;
$$;
