-- Só existiam idx_reunioes_tenant_id (simples) e o índice único de
-- googleEventId — o novo preview cacheado (GET /api/crm/reunioes-list)
-- ordena por createdAt, mesmo padrão já aplicado às outras tabelas de
-- alto volume.
CREATE INDEX IF NOT EXISTS idx_reunioes_tenant_created ON public.reunioes (tenant_id, "createdAt" DESC);
