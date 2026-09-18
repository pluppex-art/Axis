-- Extends the real cargo-module enforcement (already live on leads/finance_entries/colaboradores,
-- via log_module_permission_check) to clinica and educacao -- both were "cargo_selectable" in
-- module_manifest but "db_enforced: false", a real gap: a restricted cargo on a clinica/educacao
-- tenant would show/hide the module in the UI but nothing blocked it at the DB level.
-- Table chosen per tenant matches the existing precedent (first table listed in
-- module_manifest.tables for that module, same as leads for crm / finance_entries for financeiro /
-- colaboradores for rh): pacientes for clinica, turmas for educacao.
--
-- Verified zero real impact at the time this was applied: the only tenant with populated
-- cargos.modulos restrictions (Pluppex) does not have clinica/educacao enabled as business
-- modules; the two tenants that do have them enabled (G-Tech Master, To Na Pista Boliche) have no
-- cargos rows at all, so log_module_permission_check's "cargo sem registro = sem restricao"
-- early-exit applies to everyone there today.
--
-- Verified functionally via transaction+ROLLBACK: a temp restricted cargo (modulos without
-- clinica/educacao) got a real "Acesso negado" exception on insert into pacientes/turmas; widening
-- the cargo to include clinica/educacao let the same inserts through. Nothing persisted.

create trigger trg_permission_log_clinica
  before insert or update or delete on public.pacientes
  for each row execute function public.log_module_permission_check('clinica');

create trigger trg_permission_log_educacao
  before insert or update or delete on public.turmas
  for each row execute function public.log_module_permission_check('educacao');

update public.module_manifest set db_enforced = true, updated_at = now()
where module_key in ('clinica', 'educacao');
