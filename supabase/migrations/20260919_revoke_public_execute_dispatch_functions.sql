-- FASE 5.7 security fix: SECURITY DEFINER dispatch/trigger functions were
-- reachable by anon/authenticated via PostgREST RPC (Postgres grants EXECUTE
-- to PUBLIC on every new function unless explicitly revoked). These functions
-- take a raw tenant_id and perform a real outbound HTTP call using that
-- tenant's stored secret, so an unauthenticated caller with only the public
-- anon key could trigger arbitrary outbound calls for any tenant_id.
--
-- RLS does not cover this: RLS protects tables, not SECURITY DEFINER
-- functions invoked directly via /rest/v1/rpc/<fn>. Revoking EXECUTE from
-- anon/authenticated does not break the real dispatch path, since the
-- triggers that call these functions still run as their owner regardless of
-- the invoking role.

revoke execute on function public.dispatch_webhook_event(uuid, text, jsonb) from anon, authenticated;
revoke execute on function public.dispatch_external_integration_event(uuid, text, jsonb) from anon, authenticated;

revoke execute on function public.trg_dispatch_lead_created() from anon, authenticated;
revoke execute on function public.trg_dispatch_lead_status_changed() from anon, authenticated;
revoke execute on function public.trg_dispatch_task_created() from anon, authenticated;

revoke execute on function public.trg_dispatch_external_lead_created() from anon, authenticated;
revoke execute on function public.trg_dispatch_external_lead_status_changed() from anon, authenticated;
revoke execute on function public.trg_dispatch_external_task_created() from anon, authenticated;
