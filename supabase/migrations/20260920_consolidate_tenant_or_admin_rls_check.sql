-- has_tenant_access() já foi otimizado antes nesta sessão (3 subqueries -> 1).
-- Este migration resolve o mesmo problema pras políticas que ainda chamam
-- current_tenant_id() E is_super_admin() separadamente na mesma condição —
-- cada uma faz sua própria SELECT em public.users, então uma política tipo
-- "tenant_id = current_tenant_id() OR is_super_admin()" dispara 2 subqueries
-- por linha escaneada. is_own_tenant_or_super_admin() faz a MESMA checagem
-- (nada de acesso de parceiro — isso é escopo do has_tenant_access, não
-- deste) numa única SELECT.
--
-- Validado com SET ROLE (usuário real, tenant 65469cc6-5cc6-4115-a48b-782e7250a10c)
-- comparando o resultado antes/depois: idêntico (own_tenant=true, other_tenant=false).
CREATE OR REPLACE FUNCTION public.is_own_tenant_or_super_admin(target_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT target_tenant_id = u.tenant_id OR COALESCE(u.is_master, false)
  FROM public.users u
  WHERE u.id = auth.uid();
$function$;

ALTER POLICY tenant_isolation ON public.cliente_contatos
  USING (public.is_own_tenant_or_super_admin(tenant_id))
  WITH CHECK (public.is_own_tenant_or_super_admin(tenant_id));

ALTER POLICY tenant_isolation ON public.education_content
  USING (public.is_own_tenant_or_super_admin(tenant_id))
  WITH CHECK (public.is_own_tenant_or_super_admin(tenant_id));

ALTER POLICY tenant_isolation ON public.empresa_filiais
  USING (public.is_own_tenant_or_super_admin(tenant_id))
  WITH CHECK (public.is_own_tenant_or_super_admin(tenant_id));

ALTER POLICY tenant_isolation ON public.finance_categories
  USING (public.is_own_tenant_or_super_admin(tenant_id))
  WITH CHECK (public.is_own_tenant_or_super_admin(tenant_id));

ALTER POLICY tenant_isolation ON public.finance_commission_entries
  USING (public.is_own_tenant_or_super_admin(tenant_id))
  WITH CHECK (public.is_own_tenant_or_super_admin(tenant_id));

ALTER POLICY tenant_isolation ON public.imobiliario_corretores
  USING (public.is_own_tenant_or_super_admin(tenant_id))
  WITH CHECK (public.is_own_tenant_or_super_admin(tenant_id));

ALTER POLICY tenant_isolation ON public.imobiliario_imoveis
  USING (public.is_own_tenant_or_super_admin(tenant_id))
  WITH CHECK (public.is_own_tenant_or_super_admin(tenant_id));

ALTER POLICY tenant_isolation ON public.imobiliario_leads
  USING (public.is_own_tenant_or_super_admin(tenant_id))
  WITH CHECK (public.is_own_tenant_or_super_admin(tenant_id));

ALTER POLICY tenant_isolation ON public.imobiliario_veiculos
  USING (public.is_own_tenant_or_super_admin(tenant_id))
  WITH CHECK (public.is_own_tenant_or_super_admin(tenant_id));

ALTER POLICY tenant_isolation ON public.imobiliario_visitas
  USING (public.is_own_tenant_or_super_admin(tenant_id))
  WITH CHECK (public.is_own_tenant_or_super_admin(tenant_id));

ALTER POLICY tenant_isolation ON public.scheduled_exports
  USING (public.is_own_tenant_or_super_admin(tenant_id))
  WITH CHECK (public.is_own_tenant_or_super_admin(tenant_id));

ALTER POLICY tenant_isolation ON public.solar_analises
  USING (public.is_own_tenant_or_super_admin(tenant_id))
  WITH CHECK (public.is_own_tenant_or_super_admin(tenant_id));

ALTER POLICY tenant_isolation ON public.veiculo_financiamentos
  USING (public.is_own_tenant_or_super_admin(tenant_id))
  WITH CHECK (public.is_own_tenant_or_super_admin(tenant_id));

ALTER POLICY tenant_update ON public.tenants
  USING (public.is_own_tenant_or_super_admin(id))
  WITH CHECK (public.is_own_tenant_or_super_admin(id));
