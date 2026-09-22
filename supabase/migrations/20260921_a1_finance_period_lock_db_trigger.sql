-- A1 (auditoria 2026-09-21, AUDITORIA_NICOLAS_2026-09-21.md): o bloqueio de
-- período financeiro (spec §9.1: transação "Paga" dentro de um período
-- fechado é imutável) só era checado no frontend (checkFinanceEntryLock,
-- DataContext.tsx) -- qualquer chamada direta à tabela `finance_entries`
-- (DevTools, ou simplesmente um bug futuro no wrapper JS) contornava o
-- fechamento de período por completo. Move a mesma regra pro banco.
--
-- Usa `date_normalized` (coluna gerada, ver 20260920_finance_entries_date_normalized.sql)
-- em vez de tentar parsear o texto livre de `date` de novo aqui.
-- Só bloqueia UPDATE/DELETE de um lançamento que já estava "Pago" antes da
-- operação (mesma regra do frontend) -- lançamento pendente continua livre.
-- Chamadas sem sessão de usuário resolvida (service role/job, ex.: rotinas de
-- retratação de receita) não são bloqueadas -- mesmo padrão já usado em
-- log_module_permission_check() e no trigger do CR2.

CREATE OR REPLACE FUNCTION public.guard_finance_period_lock()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_found boolean;
  v_locked boolean;
BEGIN
  IF OLD.status IS DISTINCT FROM 'Pago' OR OLD.date_normalized IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  PERFORM 1 FROM public.users WHERE id = v_user_id;
  v_user_found := FOUND;
  IF NOT v_user_found THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.finance_period_locks l
    WHERE l.tenant_id = OLD.tenant_id
      AND OLD.date_normalized BETWEEN l.data_inicial AND l.data_final
  ) INTO v_locked;

  IF v_locked THEN
    RAISE EXCEPTION 'Este período está bloqueado para fechamento — não é possível alterar/excluir uma transação paga nessa data.'
      USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_finance_period_lock ON public.finance_entries;
CREATE TRIGGER trg_guard_finance_period_lock
  BEFORE UPDATE OR DELETE ON public.finance_entries
  FOR EACH ROW EXECUTE FUNCTION public.guard_finance_period_lock();
