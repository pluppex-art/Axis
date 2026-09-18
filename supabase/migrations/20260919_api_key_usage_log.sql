-- Auditoria de uso da API pública /api/v1/leads (chave x-api-key).
-- Não existia nenhum registro de qual chave foi usada, quando, de onde, com que
-- resultado — achado na auditoria da FASE 5.3 (API pública v2, endurecimento).
-- Só service_role grava (INSERT vem do backend Express via supabaseService);
-- sem policy de SELECT pra authenticated/anon ainda (visibilidade fica interna/
-- platform-admin por enquanto — não faz parte do escopo desta fase criar tela
-- de self-service pro tenant ver isso).
create table if not exists public.api_key_usage_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id),
  api_key_prefix text not null, -- só os 8 primeiros chars da chave, nunca a chave inteira
  method text not null,
  path text not null,
  status_code int not null,
  ip text,
  created_at timestamptz not null default now()
);

alter table public.api_key_usage_log enable row level security;

create index if not exists idx_api_key_usage_log_tenant_created
  on public.api_key_usage_log (tenant_id, created_at desc);
