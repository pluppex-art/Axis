-- CR3 (auditoria 2026-09-21, AUDITORIA_NICOLAS_2026-09-21.md): a trigger
-- log_module_permission_check so bloqueia escrita (INSERT/UPDATE/DELETE) e so
-- existe em UMA tabela por modulo (leads, finance_entries, colaboradores,
-- pacientes, turmas). As tabelas irmas do mesmo modulo nao tinham NENHUMA
-- checagem de cargo -- nem em escrita, nem em leitura -- entao qualquer
-- colaborador do tenant lia prontuario medico (PHI) e mensalidade de aluno
-- mesmo sem o modulo liberado no cargo.
--
-- Escopo desta migracao: so os verticais clinica e educacao (o achado
-- concreto da auditoria). NAO estendemos pra crm/financeiro/rh aqui de
-- proposito: cargos reais ja em uso na producao (ex.: CLOSER/SDR da Pluppex)
-- nao tem "financeiro" no array modulos, e CRIADOR DE CONTEUDO/VIDEOMAKER nao
-- tem "crm" -- aplicar a mesma trava nessas tabelas sem antes confirmar que
-- nenhum fluxo real desses usuarios depende de leitura incidental quebraria
-- producao. Ver nota no final desta auditoria.

CREATE OR REPLACE FUNCTION public.user_has_module_access(p_module text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (
      SELECT
        COALESCE(u.is_master, false)
        OR (c.modulos IS NULL OR array_length(c.modulos, 1) IS NULL)
        OR (p_module = ANY(c.modulos))
      FROM public.users u
      LEFT JOIN public.cargos c ON c.nome = u.role AND c.tenant_id = u.tenant_id
      WHERE u.id = auth.uid()
    ),
    true
  );
$$;

-- Clínica
DROP POLICY IF EXISTS tenant_isolation ON public.pacientes;
CREATE POLICY tenant_isolation ON public.pacientes FOR ALL
  USING (has_tenant_access(tenant_id) AND user_has_module_access('clinica'))
  WITH CHECK (has_tenant_access(tenant_id) AND user_has_module_access('clinica'));

DROP POLICY IF EXISTS tenant_isolation ON public.prontuarios;
CREATE POLICY tenant_isolation ON public.prontuarios FOR ALL
  USING (has_tenant_access(tenant_id) AND user_has_module_access('clinica'))
  WITH CHECK (has_tenant_access(tenant_id) AND user_has_module_access('clinica'));

DROP POLICY IF EXISTS tenant_isolation ON public.clinica_servicos;
CREATE POLICY tenant_isolation ON public.clinica_servicos FOR ALL
  USING (has_tenant_access(tenant_id) AND user_has_module_access('clinica'))
  WITH CHECK (has_tenant_access(tenant_id) AND user_has_module_access('clinica'));

DROP POLICY IF EXISTS tenant_isolation ON public.clinica_planos_tratamento;
CREATE POLICY tenant_isolation ON public.clinica_planos_tratamento FOR ALL
  USING (has_tenant_access(tenant_id) AND user_has_module_access('clinica'))
  WITH CHECK (has_tenant_access(tenant_id) AND user_has_module_access('clinica'));

DROP POLICY IF EXISTS tenant_isolation ON public.clinica_profissionais;
CREATE POLICY tenant_isolation ON public.clinica_profissionais FOR ALL
  USING (has_tenant_access(tenant_id) AND user_has_module_access('clinica'))
  WITH CHECK (has_tenant_access(tenant_id) AND user_has_module_access('clinica'));

DROP POLICY IF EXISTS tenant_isolation ON public.estoque_items;
CREATE POLICY tenant_isolation ON public.estoque_items FOR ALL
  USING (has_tenant_access(tenant_id) AND user_has_module_access('clinica'))
  WITH CHECK (has_tenant_access(tenant_id) AND user_has_module_access('clinica'));

DROP POLICY IF EXISTS tenant_isolation ON public.exames_pedidos;
CREATE POLICY tenant_isolation ON public.exames_pedidos FOR ALL
  USING (has_tenant_access(tenant_id) AND user_has_module_access('clinica'))
  WITH CHECK (has_tenant_access(tenant_id) AND user_has_module_access('clinica'));

-- Educação
DROP POLICY IF EXISTS tenant_isolation ON public.turmas;
CREATE POLICY tenant_isolation ON public.turmas FOR ALL
  USING (has_tenant_access(tenant_id) AND user_has_module_access('educacao'))
  WITH CHECK (has_tenant_access(tenant_id) AND user_has_module_access('educacao'));

DROP POLICY IF EXISTS tenant_isolation ON public.students;
CREATE POLICY tenant_isolation ON public.students FOR ALL
  USING (has_tenant_access(tenant_id) AND user_has_module_access('educacao'))
  WITH CHECK (has_tenant_access(tenant_id) AND user_has_module_access('educacao'));

DROP POLICY IF EXISTS tenant_isolation ON public.certificates;
CREATE POLICY tenant_isolation ON public.certificates FOR ALL
  USING (has_tenant_access(tenant_id) AND user_has_module_access('educacao'))
  WITH CHECK (has_tenant_access(tenant_id) AND user_has_module_access('educacao'));

DROP POLICY IF EXISTS tenant_isolation ON public.mensalidades;
CREATE POLICY tenant_isolation ON public.mensalidades FOR ALL
  USING (has_tenant_access(tenant_id) AND user_has_module_access('educacao'))
  WITH CHECK (has_tenant_access(tenant_id) AND user_has_module_access('educacao'));

DROP POLICY IF EXISTS tenant_isolation ON public.education_content;
CREATE POLICY tenant_isolation ON public.education_content FOR ALL
  USING (is_own_tenant_or_super_admin(tenant_id) AND user_has_module_access('educacao'))
  WITH CHECK (is_own_tenant_or_super_admin(tenant_id) AND user_has_module_access('educacao'));

-- Triggers de escrita "amigáveis" (mensagem clara em vez do erro genérico de
-- RLS) nas tabelas-irmãs que ainda não tinham nenhuma, reaproveitando a mesma
-- função já usada em leads/finance_entries/colaboradores/pacientes/turmas.
CREATE TRIGGER trg_permission_log_clinica
  BEFORE INSERT OR UPDATE OR DELETE ON public.prontuarios
  FOR EACH ROW EXECUTE FUNCTION log_module_permission_check('clinica');
CREATE TRIGGER trg_permission_log_clinica
  BEFORE INSERT OR UPDATE OR DELETE ON public.clinica_servicos
  FOR EACH ROW EXECUTE FUNCTION log_module_permission_check('clinica');
CREATE TRIGGER trg_permission_log_clinica
  BEFORE INSERT OR UPDATE OR DELETE ON public.clinica_planos_tratamento
  FOR EACH ROW EXECUTE FUNCTION log_module_permission_check('clinica');
CREATE TRIGGER trg_permission_log_clinica
  BEFORE INSERT OR UPDATE OR DELETE ON public.clinica_profissionais
  FOR EACH ROW EXECUTE FUNCTION log_module_permission_check('clinica');
CREATE TRIGGER trg_permission_log_clinica
  BEFORE INSERT OR UPDATE OR DELETE ON public.estoque_items
  FOR EACH ROW EXECUTE FUNCTION log_module_permission_check('clinica');
CREATE TRIGGER trg_permission_log_clinica
  BEFORE INSERT OR UPDATE OR DELETE ON public.exames_pedidos
  FOR EACH ROW EXECUTE FUNCTION log_module_permission_check('clinica');

CREATE TRIGGER trg_permission_log_educacao
  BEFORE INSERT OR UPDATE OR DELETE ON public.students
  FOR EACH ROW EXECUTE FUNCTION log_module_permission_check('educacao');
CREATE TRIGGER trg_permission_log_educacao
  BEFORE INSERT OR UPDATE OR DELETE ON public.certificates
  FOR EACH ROW EXECUTE FUNCTION log_module_permission_check('educacao');
CREATE TRIGGER trg_permission_log_educacao
  BEFORE INSERT OR UPDATE OR DELETE ON public.mensalidades
  FOR EACH ROW EXECUTE FUNCTION log_module_permission_check('educacao');
