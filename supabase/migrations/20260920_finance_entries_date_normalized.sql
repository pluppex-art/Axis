-- `finance_entries.date` é texto livre em dois formatos diferentes, ambos em
-- uso simultâneo (ver src/pages/finance/lib/financeDates.ts, que já lida com
-- os dois): "DD/MM/AAAA" (formulário manual, GenericFinanceiroList.tsx) e
-- "AAAA-MM-DD" (fluxo de PDV via RPC finalizar_venda). Isso impede ordenar
-- ou filtrar por período no servidor (comparação de string não bate com
-- ordem cronológica em nenhum dos dois formatos misturados).
--
-- Coluna gerada automaticamente pelo Postgres — não precisa de nenhuma
-- mudança na aplicação (DataContext.tsx, GenericFinanceiroList.tsx) pra
-- escrever nela; é recalculada a cada INSERT/UPDATE a partir de `date`.
-- Usa make_date() + substring() em vez de to_date()/cast direto porque
-- GENERATED ALWAYS exige uma expressão IMMUTABLE, e to_date() é STABLE
-- (depende de configuração de locale/DateStyle da sessão) — Postgres rejeita
-- a coluna com "generation expression is not immutable" se usada.
-- Validado contra os 3934 registros existentes em produção antes de aplicar:
-- 0 valores não convertidos pela expressão abaixo (3911 ISO + 23 BR).
ALTER TABLE public.finance_entries
  ADD COLUMN IF NOT EXISTS date_normalized date GENERATED ALWAYS AS (
    CASE
      WHEN date ~ '^\d{4}-\d{2}-\d{2}' THEN make_date(
        substring(date from 1 for 4)::int,
        substring(date from 6 for 2)::int,
        substring(date from 9 for 2)::int
      )
      WHEN date ~ '^\d{2}/\d{2}/\d{4}$' THEN make_date(
        substring(date from 7 for 4)::int,
        substring(date from 4 for 2)::int,
        substring(date from 1 for 2)::int
      )
      ELSE NULL
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_finance_entries_tenant_date_normalized
  ON public.finance_entries (tenant_id, date_normalized DESC);
