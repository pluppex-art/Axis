-- Só existia índice simples em tenant_id — tanto a tela de Clientes
-- (order by created_at) quanto o novo preview cacheado (GET /api/crm/clientes-list)
-- se beneficiam de um índice composto igual já foi feito pras outras
-- tabelas de alto volume (ver 20260920_perf_indexes_high_volume_tables.sql).
CREATE INDEX IF NOT EXISTS idx_clientes_tenant_created ON public.clientes (tenant_id, created_at DESC);
