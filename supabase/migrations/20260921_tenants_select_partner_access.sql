-- BUG real (achado investigando por que Frederico Silva — usuário parceiro, is_master=false,
-- partner_id setado — não conseguia trocar de empresa cliente pelo seletor da sidebar):
-- a policy de SELECT em `tenants` (tenant_select) só checava `id = current_tenant_id() OR
-- is_super_admin()` — nunca considerava tenant_partners, diferente de has_tenant_access()
-- (já usada em praticamente toda outra tabela do sistema), que TEM essa checagem de parceiro.
-- Resultado: mesmo com o vínculo em tenant_partners existindo, um usuário parceiro nunca via
-- as linhas de `tenants` dos clientes vinculados — fetchTenantIdMap() (lib/supabase.ts)
-- retornava só a própria empresa dele, então o seletor não tinha pra onde trocar.
--
-- Troca a policy pra usar has_tenant_access(id), o padrão já estabelecido — sem isso, nenhum
-- parceiro real (não só o Frederico) conseguiria usar essa função, mesmo com os vínculos
-- certos em tenant_partners.
drop policy if exists tenant_select on public.tenants;
create policy tenant_select on public.tenants
  for select
  to authenticated
  using (public.has_tenant_access(id));

-- Provisionamento pedido explicitamente: parceiro da Pluppex (partner_id
-- 2fbe149c-96c5-4171-a27e-281b5f16a32d, ao qual Frederico Silva pertence) passa a
-- enxergar todos os tenants ativos, não só o próprio — só isso, não vira comportamento
-- automático pra parceiros futuros/novos tenants (sem trigger de auto-provisionamento).
insert into public.tenant_partners (tenant_id, partner_id)
select t.id, '2fbe149c-96c5-4171-a27e-281b5f16a32d'
from public.tenants t
where t.status = 'Active'
and not exists (
  select 1 from public.tenant_partners tp
  where tp.tenant_id = t.id and tp.partner_id = '2fbe149c-96c5-4171-a27e-281b5f16a32d'
);
