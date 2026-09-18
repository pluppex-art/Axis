import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

export interface TenantAiConfig {
  tenantId: string;
  auroraEnabled: boolean;
  allowedReadModules: string[];
  allowedWriteModules: string[];
  allowedExecuteModules: string[];
  updatedAt: string | null;
}

/**
 * Le/escreve `public.tenant_ai_config` — config de IA/Aurora por tenant (Fase 5.1 do mandato
 * "Aurora + S.P.Y. + Integracao com Sistemas Externos", 2026-09-18). RLS-escopado via
 * has_tenant_access(tenant_id), mesmo padrao dos outros hooks de config por tenant.
 *
 * Nesta fase, so `auroraEnabled` e `allowedExecuteModules` sao de fato enforcados do lado do n8n
 * (ver Helper - Checar Config Aurora Tenant + extensao do Helper - Checar Modulo Habilitado) —
 * allowedReadModules/allowedWriteModules ficam armazenados para uma fase futura de enforcement
 * granular por ferramenta. Isso e mostrado explicitamente na tela, nao escondido.
 */
export function useTenantAiConfig() {
  const { activeTenantId } = useAuth();
  const [config, setConfig] = useState<TenantAiConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!supabase || !activeTenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("tenant_ai_config")
      .select("tenant_id, aurora_enabled, allowed_read_modules, allowed_write_modules, allowed_execute_modules, updated_at")
      .eq("tenant_id", activeTenantId)
      .maybeSingle();

    if (error) {
      console.error("[Supabase] tenant_ai_config select error:", error.message);
      setConfig(null);
      setLoading(false);
      return;
    }

    setConfig(
      data
        ? {
            tenantId: data.tenant_id,
            auroraEnabled: data.aurora_enabled,
            allowedReadModules: data.allowed_read_modules ?? [],
            allowedWriteModules: data.allowed_write_modules ?? [],
            allowedExecuteModules: data.allowed_execute_modules ?? [],
            updatedAt: data.updated_at,
          }
        : null
    );
    setLoading(false);
  }, [activeTenantId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const update = useCallback(
    async (patch: Partial<Pick<TenantAiConfig, "auroraEnabled" | "allowedExecuteModules">>) => {
      if (!supabase || !activeTenantId) return { error: "Sem tenant ativo" };
      setSaving(true);
      const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (patch.auroraEnabled !== undefined) payload.aurora_enabled = patch.auroraEnabled;
      if (patch.allowedExecuteModules !== undefined) payload.allowed_execute_modules = patch.allowedExecuteModules;

      const { error } = await supabase.from("tenant_ai_config").update(payload).eq("tenant_id", activeTenantId);
      setSaving(false);
      if (error) {
        console.error("[Supabase] tenant_ai_config update error:", error.message);
        return { error: error.message };
      }
      await refresh();
      return { error: null };
    },
    [activeTenantId, refresh]
  );

  return { config, loading, saving, refresh, update };
}
