-- Substitui o "simulador de WhatsApp" nunca terminado (contatos/mensagens
-- em memória no processo Node, perdidos a cada redeploy/reciclagem de
-- instância serverless — chat_contacts/chat_messages nunca existiram de
-- verdade) por tabelas reais, persistentes, isoladas por tenant.

CREATE TABLE IF NOT EXISTS public.chat_contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  whatsapp_instance_id uuid references public.whatsapp_instances(id) on delete cascade,
  name text not null default 'Contato',
  phone text not null,
  avatar text,
  channel text not null default 'WhatsApp',
  last_message text,
  last_message_at timestamptz,
  unread_count integer not null default 0,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (whatsapp_instance_id, phone)
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  contact_id uuid not null references public.chat_contacts(id) on delete cascade,
  whatsapp_instance_id uuid references public.whatsapp_instances(id) on delete cascade,
  text text not null,
  -- 'contact' = veio do cliente via WhatsApp; 'human' = enviado por um
  -- atendente pelo CRM; 'ai' = resposta automática da Aurora.
  sender text not null check (sender in ('contact', 'human', 'ai')),
  status text,
  wa_message_id text,
  created_at timestamptz not null default now()
);

-- Webhook do WAHA pode reentregar o mesmo evento — dedup por id da mensagem
-- na origem (só quando presente; mensagens sem id de origem não colidem).
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_messages_wa_message_id
  ON public.chat_messages (wa_message_id) WHERE wa_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chat_contacts_tenant_created ON public.chat_contacts (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_tenant_created ON public.chat_messages (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_contact_created ON public.chat_messages (contact_id, created_at DESC);

ALTER TABLE public.chat_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Mesmo padrão já usado em whatsapp_instances (e na maioria das tabelas do
-- projeto) — has_tenant_access() já otimizado antes nesta sessão.
CREATE POLICY tenant_isolation ON public.chat_contacts
  FOR ALL TO authenticated
  USING (public.has_tenant_access(tenant_id))
  WITH CHECK (public.has_tenant_access(tenant_id));

CREATE POLICY tenant_isolation ON public.chat_messages
  FOR ALL TO authenticated
  USING (public.has_tenant_access(tenant_id))
  WITH CHECK (public.has_tenant_access(tenant_id));

-- Token de verificação do webhook — gerado na criação da instância, embutido
-- na URL de webhook que o servidor registra no WAHA (ver server.ts). Sem
-- isso, o endpoint de webhook seria um POST público que qualquer um poderia
-- chamar pra injetar mensagem falsa em qualquer tenant.
ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS webhook_secret text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex');
