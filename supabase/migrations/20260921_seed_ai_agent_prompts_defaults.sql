-- Seeds the default (tenant_id null) row for every agent_key that has a real n8n workflow
-- wired to read ai_agent_prompts, but didn't have a default row yet. Without this row the
-- "Ver prompt" panel in Configurações > Agentes vinculados à Aurora never loads for these
-- agents (useAgentPrompts only surfaces agent_keys that have at least one matching row) --
-- it just shows "Carregando prompt..." forever, even though the n8n side is already live.
--
-- prompt is intentionally empty, matching the existing convention for aurora/radar/sdr/closer:
-- this table only ever holds an ADDITIVE per-tenant instructions block, never a mirror/copy of
-- the agent's real base prompt (which stays in the n8n node's systemMessage).

insert into public.ai_agent_prompts (agent_key, tenant_id, name, description, prompt)
values
  ('diretoria', null, 'Diretoria', 'CEO AI — arbitragem estratégica entre diretores.', ''),
  ('agente_comercial', null, 'Agente Comercial', 'CCO AI — comercial.', ''),
  ('financeiro', null, 'Financeiro', 'CFO AI.', ''),
  ('marketing', null, 'Marketing', 'CMO AI.', ''),
  ('organizacao', null, 'Organização', 'COO AI — operações e processos.', ''),
  ('pesquisa', null, 'Pesquisa', 'Research Intelligence — roteador de pesquisa comercial/tecnológica.', ''),
  ('agente_secreto', null, 'Agente Secreto', 'CRM Customer Intelligence — monitoramento de oportunidades no pipeline.', ''),
  ('atendimento', null, 'Atendimento', 'Gerência Customer Success.', ''),
  ('briefing_diario', null, 'Briefing Diário', 'Autonomous Daily Briefing — resumo executivo diário por WhatsApp.', '')
on conflict (tenant_id, agent_key) do nothing;
