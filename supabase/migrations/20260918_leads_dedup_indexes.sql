-- Índices de apoio ao dedup por tenant em POST /api/v1/leads (server.ts): antes de
-- inserir um lead novo, a rota agora procura um existente do mesmo tenant por
-- telefone (ou e-mail) e atualiza em vez de duplicar. Sem estes índices, cada
-- chamada faz um scan sequencial em public.leads.
-- Aplicado diretamente em produção via MCP em 2026-09-18; este arquivo só
-- documenta a migração no histórico do repositório.
CREATE INDEX IF NOT EXISTS idx_leads_tenant_phone ON public.leads(tenant_id, phone) WHERE phone <> '';
CREATE INDEX IF NOT EXISTS idx_leads_tenant_email ON public.leads(tenant_id, email) WHERE email <> '';
