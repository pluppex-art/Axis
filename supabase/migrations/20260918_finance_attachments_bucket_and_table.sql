-- Bucket de anexos financeiros — mesmo padrão de "products"/"proposals":
-- público pra leitura por URL direta, mas escrita/edição/exclusão só do
-- próprio tenant (primeiro segmento do path = tenant_id).
insert into storage.buckets (id, name, public, file_size_limit)
values ('finance', 'finance', true, 26214400)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='finance_bucket_read') then
    create policy finance_bucket_read on storage.objects for select using (bucket_id = 'finance');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='finance_bucket_write') then
    create policy finance_bucket_write on storage.objects for insert with check (
      bucket_id = 'finance' and ((storage.foldername(name))[1] = (current_tenant_id())::text or is_super_admin())
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='finance_bucket_update') then
    create policy finance_bucket_update on storage.objects for update using (
      bucket_id = 'finance' and ((storage.foldername(name))[1] = (current_tenant_id())::text or is_super_admin())
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='finance_bucket_delete') then
    create policy finance_bucket_delete on storage.objects for delete using (
      bucket_id = 'finance' and ((storage.foldername(name))[1] = (current_tenant_id())::text or is_super_admin())
    );
  end if;
end $$;

-- Anexo (§3.9 / modelo 1.13): arquivo vinculado a um lançamento.
create table if not exists public.finance_attachments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default current_tenant_id() references public.tenants(id),
  transacao_id text not null references public.finance_entries(id) on delete cascade,
  nome_arquivo text not null,
  tamanho_bytes bigint not null default 0,
  storage_key text not null,
  url text not null,
  created_at timestamptz not null default now()
);

alter table public.finance_attachments enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='finance_attachments' and policyname='tenant_isolation') then
    create policy tenant_isolation on public.finance_attachments
      for all using (has_tenant_access(tenant_id)) with check (has_tenant_access(tenant_id));
  end if;
end $$;

create index if not exists idx_finance_attachments_transacao on public.finance_attachments (transacao_id);
create index if not exists idx_finance_attachments_tenant on public.finance_attachments (tenant_id);
