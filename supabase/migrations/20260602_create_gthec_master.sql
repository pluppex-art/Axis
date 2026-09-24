-- =============================================================
-- Migration: Criar usuário master G-Tech (gthec)
-- Executar no Supabase SQL Editor: https://supabase.com/dashboard
-- Projeto: xmpkurzczeanlkdxeizd
-- =============================================================

DO $$
DECLARE
  v_tenant_id UUID;
  v_user_exists BOOLEAN;
BEGIN

  -- 1. Cria o tenant G-Tech Master se não existir (sem ON CONFLICT)
  SELECT id INTO v_tenant_id FROM tenants WHERE name = 'G-Tech Master' LIMIT 1;

  IF v_tenant_id IS NULL THEN
    INSERT INTO tenants (name, niche, plan, status, timezone, modules)
    VALUES (
      'G-Tech Master',
      'Master',
      'Enterprise',
      'Active',
      'America/Sao_Paulo',
      '{"crm": true, "sdr": true, "advDashboard": true, "financeiro": true, "marketing": true, "educacao": true, "clinica": true, "produtividade": true, "rh": true, "bi": true, "engajamento": true}'::jsonb
    )
    RETURNING id INTO v_tenant_id;
    RAISE NOTICE 'Tenant G-Tech Master criado: %', v_tenant_id;
  ELSE
    UPDATE tenants SET
      niche   = 'Master',
      plan    = 'Enterprise',
      status  = 'Active',
      modules = '{"crm": true, "sdr": true, "advDashboard": true, "financeiro": true, "marketing": true, "educacao": true, "clinica": true, "produtividade": true, "rh": true, "bi": true, "engajamento": true}'::jsonb
    WHERE id = v_tenant_id;
    RAISE NOTICE 'Tenant G-Tech Master já existe, módulos atualizados: %', v_tenant_id;
  END IF;

  -- 2. Cria o usuário master admin@gthec.com se não existir
  --    Senha: gerenciada no Supabase Auth (valor removido do repositório; `password_hash` é legado e não é usado para login)
  SELECT EXISTS(SELECT 1 FROM users WHERE email = 'admin@gthec.com') INTO v_user_exists;

  IF NOT v_user_exists THEN
    INSERT INTO users (tenant_id, name, email, password_hash, role, is_master, active)
    VALUES (
      v_tenant_id,
      'G-Tech Administrador',
      'admin@gthec.com',
      'REDACTED-use-Supabase-Auth',
      'Super Admin',
      true,
      true
    );
    RAISE NOTICE 'Usuário master admin@gthec.com criado';
  ELSE
    UPDATE users SET
      is_master     = true,
      active        = true,
      role          = 'Super Admin',
      name          = 'G-Tech Administrador',
      password_hash = 'REDACTED-use-Supabase-Auth'
    WHERE email = 'admin@gthec.com';
    RAISE NOTICE 'Usuário master admin@gthec.com já existe, permissões atualizadas';
  END IF;

END $$;
