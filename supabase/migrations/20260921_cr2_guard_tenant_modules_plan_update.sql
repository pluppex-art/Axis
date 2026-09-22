-- CR2 (auditoria 2026-09-21, AUDITORIA_NICOLAS_2026-09-21.md): a policy
-- tenant_update de `tenants` (is_own_tenant_or_super_admin) autoriza qualquer
-- usuario do proprio tenant a dar UPDATE na linha inteira, incluindo `modules`
-- e `plan` -- ou seja, qualquer colaborador autenticado podia ligar modulos
-- pagos da propria empresa direto pela tabela, sem passar por /app/admin nem
-- por billing. Em vez de restringir tenant_update inteiro pra master (o que
-- quebraria edicao legitima de campos como branding/webhook_url por um
-- tenant-admin), um trigger bloqueia especificamente mudancas em
-- modules/plan/module_* pra quem nao e master.
--
-- Chamadas sem sessao de usuario resolvida (service role/job) nao sao
-- bloqueadas -- mesmo padrao de "sem barrar automacao interna" ja usado em
-- log_module_permission_check().

CREATE OR REPLACE FUNCTION public.guard_tenant_modules_plan_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_master boolean;
  v_user_found boolean;
BEGIN
  IF NEW.modules IS DISTINCT FROM OLD.modules
     OR NEW.plan IS DISTINCT FROM OLD.plan
     OR NEW.module_crm IS DISTINCT FROM OLD.module_crm
     OR NEW.module_finance IS DISTINCT FROM OLD.module_finance
     OR NEW.module_marketing IS DISTINCT FROM OLD.module_marketing
     OR NEW.module_tasks IS DISTINCT FROM OLD.module_tasks
     OR NEW.module_education IS DISTINCT FROM OLD.module_education
     OR NEW.module_adv_dashboard IS DISTINCT FROM OLD.module_adv_dashboard
     OR NEW.module_sdr_ia IS DISTINCT FROM OLD.module_sdr_ia
  THEN
    SELECT is_master INTO v_is_master FROM public.users WHERE id = v_user_id;
    v_user_found := FOUND;
    IF v_user_found AND NOT COALESCE(v_is_master, false) THEN
      RAISE EXCEPTION 'Acesso negado: apenas o operador da plataforma pode alterar os modulos/plano do tenant.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_tenant_modules_plan ON public.tenants;
CREATE TRIGGER trg_guard_tenant_modules_plan
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.guard_tenant_modules_plan_update();
