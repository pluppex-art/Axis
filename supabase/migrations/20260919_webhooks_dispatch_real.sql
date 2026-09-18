-- Fase 5.2 do mandato "Aurora + S.P.Y. + Integracao com Sistemas Externos" (2026-09-19).
-- Disparo automatico de webhooks em eventos reais do CRM. Antes desta migration, a tela
-- Configuracoes > Integracoes > Webhooks Globais deixava cadastrar uma URL e so disparava
-- de verdade via o botao manual "Disparar Teste" -- nenhum evento real do sistema (lead
-- criado, negocio ganho/perdido, tarefa criada) acionava nada automaticamente. Isso corrige
-- essa lacuna via triggers + pg_net (assincrono, nao bloqueia a transacao que originou o
-- evento).
--
-- Decisao de escopo: os webhooks continuam configurados em app_settings (key
-- 'globalWebhooks', mesma tabela/chave que a tela ja le/escreve via DataContext.syncSetting)
-- em vez de migrar para uma tabela `webhooks` dedicada -- evita reescrever a tela e o contexto
-- que ja funcionam, e o dispatcher so precisa ler esse JSON por tenant.
--
-- Cobertura: 3 dos 5 eventos ja listados no dropdown da tela ("Novo Lead Criado",
-- "Negocio Ganho", "Negocio Perdido", "Nova Tarefa SDR") via triggers em leads/tasks.
-- "Reuniao Agendada" fica de fora desta fase -- reunioes sao criadas no Google Calendar
-- (nao existe uma tabela local `meetings`/`reunioes` no Axis), entao esse evento precisaria
-- de disparo no proprio fluxo de criacao (n8n/Tool - Axis Criar Reuniao), nao de um trigger
-- de banco. Fica registrado como pendencia, nao implementado silenciosamente como se
-- funcionasse.

create extension if not exists pg_net;

-- webhook_logs ja existia como snapshot morto de schema.sql (webhook_id, tenant_id,
-- status_code, payload text, response text), sem nenhum codigo/migration real usando.
-- Reaproveitada aqui com as colunas que o dispatcher real precisa.
create table if not exists public.webhook_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.webhook_logs
  add column if not exists event text,
  add column if not exists endpoint_url text,
  add column if not exists request_id bigint;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'webhook_logs' and column_name = 'payload' and data_type <> 'jsonb'
  ) then
    alter table public.webhook_logs
      alter column payload type jsonb using (case when payload is null then null else payload::jsonb end);
  elsif not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'webhook_logs' and column_name = 'payload'
  ) then
    alter table public.webhook_logs add column payload jsonb not null default '{}'::jsonb;
  end if;
end $$;

comment on table public.webhook_logs is 'Log de disparos automaticos de webhook (Fase 5.2 do mandato Aurora+SPY+Integracoes, 2026-09-18/19). request_id referencia net._http_response para quem quiser conferir o resultado real da chamada assincrona.';

alter table public.webhook_logs enable row level security;

drop policy if exists webhook_logs_select on public.webhook_logs;
create policy webhook_logs_select on public.webhook_logs
  for select using (public.has_tenant_access(tenant_id));

create index if not exists webhook_logs_tenant_idx on public.webhook_logs (tenant_id, created_at desc);

-- Dispatcher generico: le app_settings.globalWebhooks do tenant, dispara os que casam com o evento.
create or replace function public.dispatch_webhook_event(p_tenant_id uuid, p_event text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings jsonb;
  v_hook jsonb;
  v_request_id bigint;
begin
  select value into v_settings
  from public.app_settings
  where tenant_id = p_tenant_id and key = 'globalWebhooks';

  if v_settings is null then
    return;
  end if;

  for v_hook in select * from jsonb_array_elements(v_settings)
  loop
    if (v_hook->>'event') = p_event and coalesce((v_hook->>'active')::boolean, false) = true then
      select net.http_post(
        url := v_hook->>'endpoint',
        body := p_payload,
        headers := '{"Content-Type": "application/json"}'::jsonb
      ) into v_request_id;

      insert into public.webhook_logs (tenant_id, event, endpoint_url, payload, request_id)
      values (p_tenant_id, p_event, v_hook->>'endpoint', p_payload, v_request_id);
    end if;
  end loop;
end;
$$;

comment on function public.dispatch_webhook_event is 'Dispara webhooks reais cadastrados em app_settings.globalWebhooks via pg_net (assincrono). Fase 5.2 do mandato Aurora+SPY+Integracoes, 2026-09-18/19.';

-- lead.created -> "Novo Lead Criado"
create or replace function public.trg_dispatch_lead_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.dispatch_webhook_event(
    NEW.tenant_id,
    'Novo Lead Criado',
    jsonb_build_object(
      'event', 'lead.created',
      'lead_id', NEW.id,
      'name', NEW.name,
      'company', NEW.company,
      'status', NEW.status,
      'value', NEW.value,
      'created_at', NEW.created_at
    )
  );
  return NEW;
end;
$$;

drop trigger if exists webhook_lead_created on public.leads;
create trigger webhook_lead_created
  after insert on public.leads
  for each row
  execute function public.trg_dispatch_lead_created();

-- lead ganho/perdido -> "Negócio Ganho" / "Negócio Perdido"
create or replace function public.trg_dispatch_lead_status_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event text;
begin
  if NEW.status is distinct from OLD.status or NEW.loss_reason is distinct from OLD.loss_reason then
    if NEW.loss_reason is not null and OLD.loss_reason is null then
      v_event := 'Negócio Perdido';
    elsif NEW.status = 'Fechado' and NEW.loss_reason is null and OLD.status is distinct from 'Fechado' then
      v_event := 'Negócio Ganho';
    end if;

    if v_event is not null then
      perform public.dispatch_webhook_event(
        NEW.tenant_id,
        v_event,
        jsonb_build_object(
          'event', case when v_event = 'Negócio Ganho' then 'sale.created' else 'lead.lost' end,
          'lead_id', NEW.id,
          'name', NEW.name,
          'company', NEW.company,
          'status', NEW.status,
          'value', NEW.value,
          'loss_reason', NEW.loss_reason,
          'updated_at', NEW.updated_at
        )
      );
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists webhook_lead_status_changed on public.leads;
create trigger webhook_lead_status_changed
  after update on public.leads
  for each row
  execute function public.trg_dispatch_lead_status_changed();

-- task.created -> "Nova Tarefa SDR"
create or replace function public.trg_dispatch_task_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.dispatch_webhook_event(
    NEW.tenant_id,
    'Nova Tarefa SDR',
    jsonb_build_object(
      'event', 'task.created',
      'task_id', NEW.id,
      'title', NEW.title,
      'lead_id', NEW.lead_id,
      'due_date', NEW.due_date,
      'created_at', NEW.created_at
    )
  );
  return NEW;
end;
$$;

drop trigger if exists webhook_task_created on public.tasks;
create trigger webhook_task_created
  after insert on public.tasks
  for each row
  execute function public.trg_dispatch_task_created();
