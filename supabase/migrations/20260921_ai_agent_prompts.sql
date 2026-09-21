-- Prompts dos agentes de IA (Aurora core + sub-agentes acionados por ela: Radar,
-- Júlia/SDR, Closer AI) não existiam em lugar nenhum do banco/app — viviam só
-- dentro dos nós do n8n (workflow AURORA CORE), sem nenhuma visibilidade na
-- tela de Configurações > Inteligência Artificial (que só tem toggles). Esta
-- tabela traz o texto do prompt pro SPY como fonte editável — depois de editar
-- aqui, o node correspondente no n8n precisa ser atualizado pra ler daqui em
-- vez de ter o texto fixo (fora do escopo desta migration).
--
-- Global (não por tenant): os agentes são infraestrutura compartilhada do
-- G-TECH AI OS, não algo que cada tenant customiza — mesma lógica de
-- tool_registry. RLS restrita a master (is_super_admin()): qualquer tenant
-- admin pode ver os toggles em Configurações > IA, mas o texto do prompt em
-- si é sensível (rege o comportamento de todos os tenants) e não deve
-- vazar pra tenant nenhum.
create table public.ai_agent_prompts (
  agent_key text primary key,
  name text not null,
  description text,
  prompt text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id)
);

alter table public.ai_agent_prompts enable row level security;

create policy ai_agent_prompts_master_all on public.ai_agent_prompts
  for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

insert into public.ai_agent_prompts (agent_key, name, description) values
  ('aurora', 'Aurora (Core)', 'Prompt mestre da Aurora — orquestradora central do G-TECH AI OS, workflow "AURORA CORE" no n8n.'),
  ('radar', 'Radar (prospecção ativa)', 'Aurora pode buscar empresas reais (Google Maps) e propor cadastro como lead.'),
  ('sdr', 'Júlia / SDR', 'Aurora pode acionar a Júlia para abordar um lead pelo WhatsApp.'),
  ('closer', 'Closer AI', 'Aurora pode consultar técnicas de negociação/fechamento.');
