-- Só existia índice simples em tenant_id (e um separado em filial_id) —
-- o novo preview cacheado (GET /api/operative/produtos-list) ordena por
-- created_at, mesmo padrão já aplicado às outras tabelas de alto volume.
CREATE INDEX IF NOT EXISTS idx_products_tenant_created ON public.products (tenant_id, created_at DESC);
