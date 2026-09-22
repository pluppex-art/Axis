-- CR1 (auditoria 2026-09-21, AUDITORIA_NICOLAS_2026-09-21.md): qualquer usuário
-- autenticado do tenant conseguia editar cargos/squads (incluindo o próprio
-- cargo) via tela normal de Configurações > Perfis & Permissões, porque a RLS
-- só checava tenant, não papel. Isso permitia auto-escalonamento de privilégio
-- (liberar módulo negado pro próprio cargo, o que por sua vez anula a trigger
-- log_module_permission_check). Leitura continua liberada pra qualquer membro
-- do tenant (necessário pro frontend decidir o que mostrar no menu); escrita
-- passa a exigir is_tenant_admin ou is_master.

CREATE OR REPLACE FUNCTION public.is_tenant_admin_or_master()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COALESCE(u.is_master, false) OR COALESCE(u.is_tenant_admin, false)
  FROM public.users u WHERE u.id = auth.uid();
$$;

DROP POLICY IF EXISTS tenant_isolation ON public.cargos;
CREATE POLICY cargos_select ON public.cargos FOR SELECT
  USING (has_tenant_access(tenant_id));
CREATE POLICY cargos_insert ON public.cargos FOR INSERT
  WITH CHECK (has_tenant_access(tenant_id) AND is_tenant_admin_or_master());
CREATE POLICY cargos_update ON public.cargos FOR UPDATE
  USING (has_tenant_access(tenant_id) AND is_tenant_admin_or_master())
  WITH CHECK (has_tenant_access(tenant_id) AND is_tenant_admin_or_master());
CREATE POLICY cargos_delete ON public.cargos FOR DELETE
  USING (has_tenant_access(tenant_id) AND is_tenant_admin_or_master());

DROP POLICY IF EXISTS tenant_isolation ON public.squads;
CREATE POLICY squads_select ON public.squads FOR SELECT
  USING (has_tenant_access(tenant_id));
CREATE POLICY squads_insert ON public.squads FOR INSERT
  WITH CHECK (has_tenant_access(tenant_id) AND is_tenant_admin_or_master());
CREATE POLICY squads_update ON public.squads FOR UPDATE
  USING (has_tenant_access(tenant_id) AND is_tenant_admin_or_master())
  WITH CHECK (has_tenant_access(tenant_id) AND is_tenant_admin_or_master());
CREATE POLICY squads_delete ON public.squads FOR DELETE
  USING (has_tenant_access(tenant_id) AND is_tenant_admin_or_master());
