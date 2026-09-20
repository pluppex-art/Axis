-- Incidente em produção (2026-09-20): timeouts (Postgres 57014, "statement
-- timeout") em várias tabelas grandes (leads, finance_entries, reunioes)
-- durante a carga inicial paginada de tenants com alguns milhares de linhas.
--
-- Causa raiz (confirmada via EXPLAIN ANALYZE com RLS ativa, SET ROLE
-- authenticated): has_tenant_access(tenant_id) — a policy tenant_isolation
-- usada em praticamente toda tabela do banco — fazia 3 buscas SEPARADAS em
-- public.users por linha avaliada (via current_tenant_id(), is_super_admin(),
-- current_partner_id(), cada uma com seu próprio "SELECT ... FROM users
-- WHERE id = auth.uid()"). Numa tabela de ~4000 linhas isso significa
-- ~12.000 subqueries extras por página — 804ms medidos numa única página
-- (contra 9ms na mesma query sem RLS), suficiente pra estourar os 8s de
-- statement_timeout sob carga concorrente (carga inicial dispara ~10
-- requisições em paralelo).
--
-- Fix: mesma lógica de acesso, mas com UMA busca em users em vez de três.
-- current_tenant_id()/is_super_admin()/current_partner_id() NÃO foram
-- alteradas — outras policies as chamam direto (ex.: storage buckets,
-- partners_select) e continuam funcionando exatamente como antes.
--
-- Validado antes e depois de aplicar (SET ROLE authenticated + SET
-- request.jwt.claims, comparando contagens entre 3 tenants reais com um
-- usuário comum e um usuário master): nenhuma mudança de resultado de
-- acesso, só de velocidade. Medido depois: leads 804ms→198ms, reunioes
-- (~4600 linhas) 213ms (antes: timeout).
CREATE OR REPLACE FUNCTION public.has_tenant_access(target_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    target_tenant_id = u.tenant_id
    OR COALESCE(u.is_master, false)
    OR EXISTS (
      SELECT 1 FROM public.tenant_partners tp
      WHERE tp.tenant_id = target_tenant_id
        AND tp.partner_id = u.partner_id
    )
  FROM public.users u
  WHERE u.id = auth.uid();
$function$;
