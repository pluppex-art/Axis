-- A4 (auditoria 2026-09-21, AUDITORIA_NICOLAS_2026-09-21.md): dev_projects,
-- dev_sprint_tasks, dev_issues, dev_environments tinham RLS habilitada e ZERO
-- policies -- Postgres nega tudo por padrão nesse caso (inclusive pra
-- is_master), então o módulo "Dev & Engenharia" nunca funcionou de verdade
-- em produção. A causa raiz (frontend sem tenant scoping em
-- src/pages/dev/hooks/*.ts) já foi corrigida antes desta migração -- só
-- agora é seguro adicionar a policy padrão, senão qualquer tenant com o
-- módulo `dev` habilitado passaria a enxergar o pool inteiro de projetos de
-- todo mundo.
--
-- dev_repositories NÃO está nesta lista porque já tinha a policy correta
-- (único dos 5 hooks do módulo que já filtrava/gravava tenant_id certo).
--
-- As 80 linhas legadas de dev_sprint_tasks com tenant_id NULL (inseridas via
-- service_role antes de existir isolamento no módulo) ficam invisíveis pra
-- qualquer usuário comum sob esta policy (mesmo comportamento já existente
-- pra qualquer linha órfã no sistema, ver achado M5) -- decisão deliberada,
-- não um bug novo: não há como inferir de forma segura a qual tenant essas
-- linhas pertenciam.

CREATE POLICY tenant_isolation ON public.dev_projects FOR ALL
  USING (has_tenant_access(tenant_id))
  WITH CHECK (has_tenant_access(tenant_id));

CREATE POLICY tenant_isolation ON public.dev_sprint_tasks FOR ALL
  USING (has_tenant_access(tenant_id))
  WITH CHECK (has_tenant_access(tenant_id));

CREATE POLICY tenant_isolation ON public.dev_issues FOR ALL
  USING (has_tenant_access(tenant_id))
  WITH CHECK (has_tenant_access(tenant_id));

CREATE POLICY tenant_isolation ON public.dev_environments FOR ALL
  USING (has_tenant_access(tenant_id))
  WITH CHECK (has_tenant_access(tenant_id));
