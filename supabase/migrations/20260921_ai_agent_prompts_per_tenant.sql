-- Abrir edição de ai_agent_prompts pra qualquer tenant admin (não só master,
-- migration anterior 20260921_ai_agent_prompts_open_to_tenant_admins) criava um
-- risco real: a tabela era GLOBAL (uma linha por agente, sem tenant_id) — um
-- admin do tenant A editando o prompt da Júlia mudaria o texto pra TODOS os
-- tenants ao mesmo tempo. Corrige com o padrão "default + override": as 4
-- linhas existentes (tenant_id NULL) viram o modelo padrão, editável só por
-- master; cada tenant que salva um prompt ganha sua PRÓPRIA linha
-- (tenant_id = a dele), sem tocar no default nem nas linhas de outros
-- tenants — editar não quebra ninguém.
alter table public.ai_agent_prompts add column tenant_id uuid references public.tenants(id);

-- PK antiga era só agent_key (uma linha global por agente) — vira parte de uma
-- unique key composta com tenant_id, permitindo N overrides (um por tenant)
-- por agente, mais o default global (tenant_id null).
alter table public.ai_agent_prompts drop constraint ai_agent_prompts_pkey;
alter table public.ai_agent_prompts add column id uuid not null default gen_random_uuid() primary key;
alter table public.ai_agent_prompts add constraint ai_agent_prompts_tenant_agent_key
  unique nulls not distinct (tenant_id, agent_key);

drop policy if exists ai_agent_prompts_admin_all on public.ai_agent_prompts;

-- Leitura: todo mundo enxerga os defaults globais (pra saber a partir de que
-- texto está customizando) + o próprio override do tenant, se existir.
create policy ai_agent_prompts_select on public.ai_agent_prompts
  for select
  using (tenant_id is null or public.has_tenant_access(tenant_id));

-- Escrita: master mexe em qualquer linha (inclusive o default global,
-- tenant_id null). Tenant admin só mexe em override do PRÓPRIO tenant —
-- nunca no default nem na linha de outro tenant.
create policy ai_agent_prompts_insert on public.ai_agent_prompts
  for insert
  with check (
    public.is_super_admin()
    or (
      tenant_id is not null
      and public.has_tenant_access(tenant_id)
      and coalesce((select is_tenant_admin from public.users where id = auth.uid()), false)
    )
  );

create policy ai_agent_prompts_update on public.ai_agent_prompts
  for update
  using (
    public.is_super_admin()
    or (
      tenant_id is not null
      and public.has_tenant_access(tenant_id)
      and coalesce((select is_tenant_admin from public.users where id = auth.uid()), false)
    )
  )
  with check (
    public.is_super_admin()
    or (
      tenant_id is not null
      and public.has_tenant_access(tenant_id)
      and coalesce((select is_tenant_admin from public.users where id = auth.uid()), false)
    )
  );

create policy ai_agent_prompts_delete on public.ai_agent_prompts
  for delete
  using (
    public.is_super_admin()
    or (
      tenant_id is not null
      and public.has_tenant_access(tenant_id)
      and coalesce((select is_tenant_admin from public.users where id = auth.uid()), false)
    )
  );
