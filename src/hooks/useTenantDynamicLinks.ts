import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

export type DynamicLinkType = "payment" | "scheduling" | "checkout" | "contract";

export interface TenantDynamicLink {
  id: string;
  tenantId: string;
  linkType: DynamicLinkType;
  label: string;
  url: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Le/escreve `public.tenant_dynamic_links` direto (RLS via has_tenant_access, mesmo padrão de
 * `tenant_ai_config`) — não são segredos, são links públicos que o próprio tenant já possui em
 * outro lugar (pagamento, agendamento, checkout, contrato), centralizados aqui pra
 * Aurora/Júlia lerem ao vivo em vez de hardcoded no prompt. FASE 5.6 do mandato
 * "Aurora + S.P.Y. + Integração com Sistemas Externos" (2026-09-19).
 */
export function useTenantDynamicLinks() {
  const { activeTenantId } = useAuth();
  const [links, setLinks] = useState<TenantDynamicLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!supabase || !activeTenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("tenant_dynamic_links")
      .select("*")
      .eq("tenant_id", activeTenantId)
      .order("link_type", { ascending: true });

    if (error) {
      console.error("[Supabase] tenant_dynamic_links select error:", error.message);
      setLinks([]);
      setLoading(false);
      return;
    }

    setLinks(
      (data ?? []).map((row: any) => ({
        id: row.id,
        tenantId: row.tenant_id,
        linkType: row.link_type,
        label: row.label,
        url: row.url,
        active: row.active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }))
    );
    setLoading(false);
  }, [activeTenantId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (input: { link_type: DynamicLinkType; label: string; url: string }) => {
      if (!supabase || !activeTenantId) return { error: "Sem tenant ativo" };
      setSaving(true);
      const { error } = await supabase.from("tenant_dynamic_links").insert({
        tenant_id: activeTenantId,
        link_type: input.link_type,
        label: input.label,
        url: input.url,
      });
      setSaving(false);
      if (error) return { error: error.message };
      await refresh();
      return { error: null };
    },
    [activeTenantId, refresh]
  );

  const update = useCallback(
    async (id: string, patch: Partial<{ label: string; url: string; active: boolean }>) => {
      if (!supabase) return { error: "Sem conexão" };
      setSaving(true);
      const { error } = await supabase
        .from("tenant_dynamic_links")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id);
      setSaving(false);
      if (error) return { error: error.message };
      await refresh();
      return { error: null };
    },
    [refresh]
  );

  const remove = useCallback(
    async (id: string) => {
      if (!supabase) return { error: "Sem conexão" };
      setSaving(true);
      const { error } = await supabase.from("tenant_dynamic_links").delete().eq("id", id);
      setSaving(false);
      if (error) return { error: error.message };
      await refresh();
      return { error: null };
    },
    [refresh]
  );

  return { links, loading, saving, refresh, create, update, remove };
}
