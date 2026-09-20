-- Só existia índice simples em tenant_id e em vencimento separadamente —
-- a tela de Mensalidades pagina com .eq(tenant_id).order(vencimento), que
-- se beneficia de um índice composto igual já foi feito pras outras
-- tabelas de alto volume (ver 20260920_perf_indexes_high_volume_tables.sql).
CREATE INDEX IF NOT EXISTS idx_mensalidades_tenant_vencimento ON public.mensalidades (tenant_id, vencimento);
