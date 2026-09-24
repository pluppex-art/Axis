-- O assistente MIA e o nicho Apple deixaram de existir no produto.
-- 1) Remove o funil "Funil SDR IA — MIA-6" (seed da migration 20260827_crm_funis_activate_and_backfill),
--    somente se estiver sem leads e sem etapas (verificado em 2026-09-24: 0 leads, 0 etapas).
-- 2) Cadastra "Automotivo" como nicho global (o módulo e as tabelas já existem, mas o nicho
--    não constava no catálogo `nichos`).
-- Idempotente: pode ser reaplicada sem efeito colateral.

delete from public.crm_funis f
where f.nome = 'Funil SDR IA — MIA-6'
  and not exists (select 1 from public.leads l where l."pipelineId" = f.id)
  and not exists (select 1 from public.crm_pipeline_stages s where s.funil_id = f.id);

insert into public.nichos (tenant_id, nome)
select null, 'Automotivo'
where not exists (
  select 1 from public.nichos where tenant_id is null and lower(nome) = 'automotivo'
);
