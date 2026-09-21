import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

export interface TenantAiConfig {
  tenantId: string;
  auroraEnabled: boolean;
  allowedReadModules: string[];
  allowedWriteModules: string[];
  allowedExecuteModules: string[];
  customPrompt: string;
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
 *
 * BUG real corrigido (2026-09-21): tenant sem linha em tenant_ai_config (criado depois da
 * migration original de seed) deixava `config` preso em `null` pra sempre — a tela de
 * Configurações > IA fica em "Carregando configuração..." com `loading || !config`, e
 * `loading` vira false mas `config` nunca. Agora um trigger em `tenants` (ver migration
 * 20260921_tenant_ai_config_autoprovision) garante que todo tenant novo já nasce com a
 * linha, mas o front continua defensivo aqui: `refresh()` sempre resolve pra um config
 * default (nunca fica preso em null) e `update()` faz upsert (nunca um UPDATE de 0 linhas
 * silencioso caso a linha ainda não exista por algum motivo).
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
      .select("tenant_id, aurora_enabled, allowed_read_modules, allowed_write_modules, allowed_execute_modules, custom_prompt, updated_at")
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
            customPrompt: data.custom_prompt ?? "",
            updatedAt: data.updated_at,
          }
        : {
            // Sem linha ainda (não deveria mais acontecer com o trigger, mas o front não
            // pode depender só disso) — resolve pra defaults em vez de deixar `config`
            // null pra sempre, o que travava a tela em "Carregando configuração...".
            tenantId: activeTenantId,
            auroraEnabled: true,
            allowedReadModules: [],
            allowedWriteModules: [],
            allowedExecuteModules: [],
            customPrompt: "",
            updatedAt: null,
          }
    );
    setLoading(false);
  }, [activeTenantId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const update = useCallback(
    async (patch: Partial<Pick<TenantAiConfig, "auroraEnabled" | "allowedExecuteModules" | "customPrompt">>) => {
      if (!supabase || !activeTenantId) return { error: "Sem tenant ativo" };
      setSaving(true);
      const payload: Record<string, unknown> = { tenant_id: activeTenantId, updated_at: new Date().toISOString() };
      if (patch.auroraEnabled !== undefined) payload.aurora_enabled = patch.auroraEnabled;
      if (patch.allowedExecuteModules !== undefined) payload.allowed_execute_modules = patch.allowedExecuteModules;
      if (patch.customPrompt !== undefined) payload.custom_prompt = patch.customPrompt;

      // upsert, não update: se a linha ainda não existir por algum motivo, um simples
      // update() afeta 0 linhas silenciosamente e o toggle parece funcionar sem salvar nada.
      const { error } = await supabase.from("tenant_ai_config").upsert(payload, { onConflict: "tenant_id" });
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
