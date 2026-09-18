-- P0 fundação financeira: subtipo estruturado de categoria (define em qual
-- linha do DRE a categoria é somada — RECEBIMENTO não usa subtipo).
alter table public.finance_categories
  add column if not exists subtipo text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'finance_categories_subtipo_check'
  ) then
    alter table public.finance_categories
      add constraint finance_categories_subtipo_check
      check (subtipo is null or subtipo in ('DESPESA_FIXA','DESPESA_VARIAVEL','PESSOAS','IMPOSTOS'));
  end if;
end $$;
