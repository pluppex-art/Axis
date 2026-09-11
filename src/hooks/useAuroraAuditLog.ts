import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

export interface AuroraAuditLogEntry {
  id: string;
  actor: string;
  action: string;
  details: Record<string, any> | null;
  createdAt: string;
}

/**
 * Le eventos reais de `aurora_audit_log` (tabela ja usada pelo backend, ex: server/googleCalendar.ts)
 * escopados ao tenant ATIVO via RLS (`has_tenant_access(tenant_id)`, mesma policy do resto do app).
 * Substitui as telas de "Logs de Auditoria" que antes eram fachada (uma so em memoria de sessao,
 * outra placeholder fixo) por uma leitura de verdade. Ver memoria gtech_aurora_spi_evolution_audit.
 *
 * `actionPrefix` filtra client-side por prefixo de `action` (ex: "squad_member_moved") quando a tela
 * so quer um subconjunto de eventos; sem isso, traz os ultimos eventos do tenant de qualquer tipo.
 */
export function useAuroraAuditLog(options?: { actionPrefix?: string; limit?: number }) {
  const { activeTenantId } = useAuth();
  const limit = options?.limit ?? 100;
  const actionPrefix = options?.actionPrefix;

  const [entries, setEntries] = useState<AuroraAuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!supabase || !activeTenantId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    let query = supabase
      .from("aurora_audit_log")
      .select("id, actor, action, details, created_at")
      .eq("tenant_id", activeTenantId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (actionPrefix) {
      query = query.like("action", `${actionPrefix}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[Supabase] aurora_audit_log select error:", error.message);
      setEntries([]);
      setLoading(false);
      return;
    }

    setEntries(
      (data ?? []).map((row: any) => ({
        id: row.id,
        actor: row.actor,
        action: row.action,
        details: row.details,
        createdAt: row.created_at,
      }))
    );
    setLoading(false);
  }, [activeTenantId, actionPrefix, limit]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logEvent = useCallback(
    async (action: string, details?: Record<string, any>, actor?: string) => {
      if (!supabase || !activeTenantId) return;
      const { error } = await supabase.from("aurora_audit_log").insert({
        tenant_id: activeTenantId,
        actor: actor ?? "equipe",
        action,
        details: details ?? null,
      });
      if (error) {
        console.error("[Supabase] aurora_audit_log insert error:", error.message);
        return;
      }
      await refresh();
    },
    [activeTenantId, refresh]
  );

  return { entries, loading, refresh, logEvent };
}
