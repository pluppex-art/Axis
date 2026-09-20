-- Índices compostos (tenant_id, created_at DESC) para as tabelas de maior
-- volume/crescimento por tenant, que hoje só têm índice simples em tenant_id
-- (ou nenhum índice) e por isso não suportam "N linhas mais recentes por
-- tenant" com eficiência (ORDER BY created_at DESC LIMIT N cai em sequential
-- scan). Ver docs/DATABASE.md e a auditoria de performance de 2026-09-20.
--
-- Puramente aditivo: nenhum índice existente é removido ou alterado.
-- `leads`, `finance_entries` e `appointments` não tinham nenhum índice em
-- tenant_id até agora; `lead_activities`, `notifications`, `tasks` e
-- `proposals` mantêm o índice simples criado em
-- 20260803_tenant_id_indexes_phase5.sql, que continua útil pra filtros de
-- igualdade que não precisam de ordenação.

CREATE INDEX IF NOT EXISTS idx_leads_tenant_created
  ON public.leads (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_finance_entries_tenant_created
  ON public.finance_entries (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_appointments_tenant_created
  ON public.appointments (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_activities_tenant_created
  ON public.lead_activities (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_tenant_created
  ON public.notifications (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tasks_tenant_created
  ON public.tasks (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_proposals_tenant_created
  ON public.proposals (tenant_id, created_at DESC);
