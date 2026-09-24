-- =============================================================
-- AXIS — Fix completo e definitivo
-- Execute TUDO no Supabase SQL Editor (Run)
-- =============================================================

-- 1. Adiciona coluna modules na tabela tenants (se não existir)
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS modules JSONB DEFAULT '{}'::jsonb;

-- 2. Desativa RLS nas tabelas de autenticação (app usa chave anon para tudo)
ALTER TABLE public.tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users   DISABLE ROW LEVEL SECURITY;

-- 3. Cria tabela app_settings se não existir
CREATE TABLE IF NOT EXISTS public.app_settings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key        TEXT NOT NULL UNIQUE,
  value      JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.app_settings DISABLE ROW LEVEL SECURITY;

-- 4. Cria/atualiza tenant G-Tech Master com todos os módulos
DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT id INTO v_tenant_id FROM public.tenants WHERE name = 'G-Tech Master' LIMIT 1;

  IF v_tenant_id IS NULL THEN
    INSERT INTO public.tenants (name, niche, plan, status, timezone, modules)
    VALUES (
      'G-Tech Master', 'Master', 'Enterprise', 'Active', 'America/Sao_Paulo',
      '{"crm":true,"sdr":true,"advDashboard":true,"financeiro":true,"marketing":true,
        "educacao":true,"clinica":true,"produtividade":true,"rh":true,"bi":true,
        "engajamento":true,"catalogo":true,"dev":true}'::jsonb
    )
    RETURNING id INTO v_tenant_id;
  ELSE
    UPDATE public.tenants SET
      modules = '{"crm":true,"sdr":true,"advDashboard":true,"financeiro":true,"marketing":true,
                  "educacao":true,"clinica":true,"produtividade":true,"rh":true,"bi":true,
                  "engajamento":true,"catalogo":true,"dev":true}'::jsonb,
      status = 'Active', plan = 'Enterprise'
    WHERE id = v_tenant_id;
  END IF;

  -- Cria/atualiza usuário master admin@gthec.com (senha: gerenciada no Supabase Auth — valor removido do repositório)
  IF EXISTS (SELECT 1 FROM public.users WHERE email = 'admin@gthec.com') THEN
    UPDATE public.users SET
      is_master = true, active = true, role = 'Super Admin',
      name = 'G-Tech Administrador',
      password_hash = 'REDACTED-use-Supabase-Auth'
    WHERE email = 'admin@gthec.com';
  ELSE
    INSERT INTO public.users (tenant_id, name, email, password_hash, role, is_master, active)
    VALUES (v_tenant_id, 'G-Tech Administrador', 'admin@gthec.com', 'REDACTED-use-Supabase-Auth', 'Super Admin', true, true);
  END IF;
END $$;

-- 5. Verifica resultado
SELECT 'tenants' as tabela, count(*) as registros FROM public.tenants
UNION ALL
SELECT 'users', count(*) FROM public.users;
