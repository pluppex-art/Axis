-- Vínculo da implementação com o AMBIENTE (tenant) que o cliente já tem no SPY,
-- pra puxar usuários/integrações/funil já configurados (só master vincula —
-- ver POST /api/implementations/:id/sync-tenant). `on delete set null`: apagar
-- o ambiente do cliente não pode apagar o histórico da implantação.
alter table public.implementations
  add column if not exists linked_tenant_id uuid references public.tenants(id) on delete set null,
  add column if not exists last_synced_at timestamptz;

-- Tempo real: o que o cliente preenche pelo link público e o que a Aurora grava
-- passam a aparecer na tela aberta da equipe sem recarregar.
do $$
begin
  alter publication supabase_realtime add table public.implementations;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
