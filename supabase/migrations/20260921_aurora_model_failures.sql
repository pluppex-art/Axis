-- Real AI-model failures (e.g. Gemini 503 "high demand") after exhausting all configured
-- retry+fallback, logged separately from aurora_audit_log -- exists to distinguish "Aurora is
-- broken" from "the AI provider had a temporary outage", which matters especially in a
-- multi-tenant/multi-agent architecture where an external provider hiccup shouldn't look like
-- a bug specific to one tenant. Purely an operational log -- never read by n8n as logic.

create table if not exists public.aurora_model_failures (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id),
  agent_key text not null,
  primary_model text,
  fallback_model text,
  error_message text,
  retry_budget text,
  execution_id text,
  created_at timestamptz not null default now()
);

comment on table public.aurora_model_failures is
  'Falhas reais do modelo de IA (ex: Gemini 503 por alta demanda) depois de esgotar todo o retry+fallback configurado -- existe pra distinguir "Aurora quebrada" de "provedor de IA teve uma indisponibilidade temporaria", especialmente importante numa arquitetura multi-tenant/multi-agente onde um problema externo do provedor nao deveria parecer bug de um tenant especifico. Nunca lida pelo n8n como logica -- e so um log operacional.';

alter table public.aurora_model_failures enable row level security;

create policy "tenant reads own model failures"
  on public.aurora_model_failures for select
  using (has_tenant_access(tenant_id));

create index if not exists idx_aurora_model_failures_tenant_created
  on public.aurora_model_failures (tenant_id, created_at desc);
