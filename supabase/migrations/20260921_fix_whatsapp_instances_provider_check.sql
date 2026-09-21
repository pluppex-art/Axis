-- Constraint estava desatualizada de antes da troca de provider (Evolution
-- API -> WAHA, decisão explícita documentada em server/whatsappProvider.ts) —
-- só aceitava 'simulator'/'evolution', nunca 'waha'. Com WAHA_API_URL
-- configurada em produção (getActiveProviderName() = "waha"), TODA criação
-- de instância real falhava direto na constraint (achado testando a criação
-- de uma instância de teste durante o desenvolvimento desta migration).
ALTER TABLE public.whatsapp_instances DROP CONSTRAINT IF EXISTS whatsapp_instances_provider_check;
ALTER TABLE public.whatsapp_instances
  ADD CONSTRAINT whatsapp_instances_provider_check CHECK (provider = ANY (ARRAY['simulator'::text, 'waha'::text]));
