-- Per-tenant custom prompt/context for Aurora, requested to support multiple real clients
-- (To Na Pista Boliche, Casa São Paulo Sports) with business-specific instructions without
-- cross-tenant leakage or risk of one tenant's prompt being used for another's request.
--
-- Safety model: this column is fetched fresh, per n8n execution, using that execution's own
-- deterministically-resolved tenant_id (same pattern already used for aurora_enabled/module
-- gates). n8n executions do not share mutable state with each other, so there is no code path
-- where tenant A's custom_prompt could be read into tenant B's conversation -- as long as no
-- shared cache/static-data is introduced downstream, which this implementation deliberately
-- avoids.

alter table public.tenant_ai_config
  add column if not exists custom_prompt text;

comment on column public.tenant_ai_config.custom_prompt is
  'Tenant-specific instructions/context appended to Aurora''s system prompt for this tenant only. Fetched fresh per n8n execution via the tenant''s own resolved tenant_id -- never cached or shared across executions.';
