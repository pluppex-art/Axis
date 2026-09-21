-- BUG real (achado em produção 2026-09-21): "Casa São Paulo Sports" e "To Na Pista
-- Boliche" nunca ganharam uma linha em tenant_ai_config (criados depois da migration
-- original de Fase 5.1, que só seedou os tenants que existiam na hora). Consequência
-- dupla: (1) a tela de Configurações > IA > Aurora fica presa em "Carregando
-- configuração..." pra sempre, porque a condição de loading é `loading || !config` e
-- `config` nunca deixa de ser null sem uma linha; (2) o toggle "Aurora ativada"/módulos
-- parecia funcionar mas na verdade fazia UPDATE de 0 linhas (não existe row pra
-- atualizar), então nada realmente salvava.
--
-- Corrige os dois lados: backfill dos tenants que já existem sem linha, e um trigger
-- que garante que TODO tenant novo (qualquer um, sem exceção — não é hardcoded pra
-- nenhum tenant específico) ganha sua linha automaticamente na criação, então esse
-- gap não pode se repetir.

insert into public.tenant_ai_config (tenant_id, aurora_enabled)
select t.id, true
from public.tenants t
left join public.tenant_ai_config tac on tac.tenant_id = t.id
where tac.tenant_id is null;

create or replace function public.provision_tenant_ai_config()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.tenant_ai_config (tenant_id, aurora_enabled)
  values (new.id, true)
  on conflict (tenant_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_provision_tenant_ai_config on public.tenants;
create trigger trg_provision_tenant_ai_config
  after insert on public.tenants
  for each row execute function public.provision_tenant_ai_config();
