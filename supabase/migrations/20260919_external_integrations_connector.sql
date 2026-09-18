-- FASE 5.4 do mandato "Aurora + S.P.Y. + Integracao com Sistemas Externos" (2026-09-19).
-- Conector generico pra sistema externo de cliente (ERP/CRM proprio, outro SaaS) -- decisao
-- de escopo ja confirmada por Gustavo: V1 e so API/Webhook, nunca conexao SQL direta a banco
-- de terceiro. Diferente de tenant_integrations (tabela interna, so service_role, usada por
-- n8n/Julia) -- esta e tenant-facing: o proprio admin do tenant cadastra a conexao numa tela
-- de Configuracoes.
--
-- Segredo (secret_value) nunca deve ser legivel de volta pelo cliente depois de salvo --
-- a tabela base fica com RLS habilitada e ZERO policy (deny total pra anon/authenticated,
-- so service_role, que ignora RLS, le/escreve). Uma VIEW separada (_safe) expoe todos os
-- campos MENOS o segredo (so um boolean has_secret) e roda como definer (ignora o deny da
-- tabela base) mas filtra tenant_id via has_tenant_access() dentro da propria view -- padrao
-- explicito pra mascarar coluna quando RLS por linha nao basta.
create table if not exists public.external_integrations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  base_url text not null,
  auth_type text not null default 'none' check (auth_type in ('none','api_key','bearer','basic')),
  auth_header_name text,
  secret_value text,
  sync_events text[] not null default '{}',
  active boolean not null default true,
  last_sync_status text,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id)
);

comment on table public.external_integrations is 'Conector generico API/Webhook pra sistema externo do cliente (Fase 5.4, mandato Aurora+SPY+Integracoes, 2026-09-19). secret_value NUNCA e exposto via a view _safe -- so service_role le/escreve a tabela base diretamente.';

alter table public.external_integrations enable row level security;
-- Sem CREATE POLICY de proposito: deny total pra anon/authenticated. Escrita e leitura de
-- secret_value so acontecem via rotas do backend Express usando supabaseService.

create index if not exists idx_external_integrations_tenant on public.external_integrations (tenant_id);

create or replace view public.external_integrations_safe as
select
  id, tenant_id, name, base_url, auth_type, auth_header_name,
  (secret_value is not null and secret_value <> '') as has_secret,
  sync_events, active, last_sync_status, last_sync_at, created_at, updated_at
from public.external_integrations
where public.has_tenant_access(tenant_id);

grant select on public.external_integrations_safe to authenticated;

comment on view public.external_integrations_safe is 'Leitura tenant-facing de external_integrations sem o segredo (roda como definer pra contornar o deny da tabela base, mas filtra por has_tenant_access(tenant_id) explicitamente dentro da propria view).';

-- Log de tentativas de sync outbound (paralelo ao webhook_logs da Fase 5.2, tabela separada
-- pra nao misturar concorrentemente com o dispatcher de webhooks globais).
create table if not exists public.external_integration_logs (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid references public.external_integrations(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  event text not null,
  endpoint_url text,
  status_code int,
  request_id bigint,
  ok boolean,
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.external_integration_logs enable row level security;

drop policy if exists external_integration_logs_select on public.external_integration_logs;
create policy external_integration_logs_select on public.external_integration_logs
  for select using (public.has_tenant_access(tenant_id));

create index if not exists idx_external_integration_logs_tenant_created
  on public.external_integration_logs (tenant_id, created_at desc);

-- Dispatcher outbound: mesma logica de pg_net do dispatch_webhook_event (Fase 5.2), mas lendo
-- external_integrations (tabela real, nao app_settings JSON) e montando o header de auth
-- certo por auth_type. Triggers PARALELAS as ja existentes (webhook_lead_created etc, Fase
-- 5.2) -- nao editei as triggers da Fase 5.2 de proposito, pra zero risco de regressao no que
-- ja esta validado e ao vivo; esta funcao/triggers sao aditivas.
--
-- Nomes de evento IDENTICOS aos usados pelos webhooks globais (Novo Lead Criado, Negócio
-- Ganho, Negócio Perdido, Nova Tarefa SDR) -- dois sistemas diferentes, mesmo vocabulario de
-- evento, pro tenant nao se confundir configurando as duas telas.
create or replace function public.dispatch_external_integration_event(p_tenant_id uuid, p_event text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_integration record;
  v_headers jsonb;
  v_request_id bigint;
begin
  for v_integration in
    select * from public.external_integrations
    where tenant_id = p_tenant_id and active = true and p_event = any(sync_events)
  loop
    v_headers := '{"Content-Type": "application/json"}'::jsonb;

    if v_integration.auth_type = 'bearer' and v_integration.secret_value is not null then
      v_headers := v_headers || jsonb_build_object('Authorization', 'Bearer ' || v_integration.secret_value);
    elsif v_integration.auth_type = 'api_key' and v_integration.secret_value is not null then
      v_headers := v_headers || jsonb_build_object(coalesce(v_integration.auth_header_name, 'X-API-Key'), v_integration.secret_value);
    elsif v_integration.auth_type = 'basic' and v_integration.secret_value is not null then
      v_headers := v_headers || jsonb_build_object('Authorization', 'Basic ' || encode(v_integration.secret_value::bytea, 'base64'));
    end if;

    select net.http_post(
      url := v_integration.base_url,
      body := p_payload,
      headers := v_headers
    ) into v_request_id;

    insert into public.external_integration_logs (integration_id, tenant_id, event, endpoint_url, request_id)
    values (v_integration.id, p_tenant_id, p_event, v_integration.base_url, v_request_id);

    update public.external_integrations
      set last_sync_status = 'sent', last_sync_at = now()
      where id = v_integration.id;
  end loop;
exception when others then
  -- Nunca deixa uma falha aqui quebrar a transacao real (insert/update de lead/task) que
  -- disparou o evento -- mesma garantia de isolamento que dispatch_webhook_event ja tem
  -- implicitamente (chamada assincrona via pg_net).
  insert into public.external_integration_logs (integration_id, tenant_id, event, ok, error_message)
  values (null, p_tenant_id, p_event, false, sqlerrm);
end;
$$;

comment on function public.dispatch_external_integration_event is 'Dispara push autenticado pras conexoes externas ativas do tenant que escutam este evento (Fase 5.4). Paralelo ao dispatch_webhook_event (Fase 5.2), nao o substitui.';

create or replace function public.trg_dispatch_external_lead_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.dispatch_external_integration_event(
    new.tenant_id,
    'Novo Lead Criado',
    jsonb_build_object('id', new.id, 'name', new.name, 'email', new.email, 'phone', new.phone, 'status', new.status, 'source', new.source)
  );
  return new;
end;
$$;

drop trigger if exists trg_external_lead_created on public.leads;
create trigger trg_external_lead_created
  after insert on public.leads
  for each row execute function public.trg_dispatch_external_lead_created();

-- Mesma logica ja validada na Fase 5.2 (trg_dispatch_lead_status_changed): distingue
-- ganho/perdido via loss_reason + status 'Fechado', NAO por um valor literal 'Ganho'/
-- 'Perdido' que a coluna status nunca assume de verdade.
create or replace function public.trg_dispatch_external_lead_status_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event text;
begin
  if new.status is distinct from old.status or new.loss_reason is distinct from old.loss_reason then
    if new.loss_reason is not null and old.loss_reason is null then
      v_event := 'Negócio Perdido';
    elsif new.status = 'Fechado' and new.loss_reason is null and old.status is distinct from 'Fechado' then
      v_event := 'Negócio Ganho';
    end if;

    if v_event is not null then
      perform public.dispatch_external_integration_event(
        new.tenant_id,
        v_event,
        jsonb_build_object('id', new.id, 'name', new.name, 'email', new.email, 'phone', new.phone, 'status', new.status, 'value', new.value, 'loss_reason', new.loss_reason)
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_external_lead_status_changed on public.leads;
create trigger trg_external_lead_status_changed
  after update on public.leads
  for each row execute function public.trg_dispatch_external_lead_status_changed();

create or replace function public.trg_dispatch_external_task_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.dispatch_external_integration_event(
    new.tenant_id,
    'Nova Tarefa SDR',
    jsonb_build_object('id', new.id, 'title', new.title)
  );
  return new;
end;
$$;

drop trigger if exists trg_external_task_created on public.tasks;
create trigger trg_external_task_created
  after insert on public.tasks
  for each row execute function public.trg_dispatch_external_task_created();
