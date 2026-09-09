import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

export interface AuroraTokenUsage {
  tokensUsed: number;
  tokensLimit: number | null;
  percentUsed: number | null;
  planName: string | null;
  limitReached: boolean;
}

/**
 * Lê o uso de tokens da Aurora do mês corrente para o tenant ATIVO (não necessariamente o do
 * próprio usuário — um master que trocou de empresa pelo seletor da sidebar vê o uso do tenant
 * pra onde trocou, igual ao resto do app), direto do Supabase (RLS via has_tenant_access, mesma
 * policy usada em todo o resto do sistema). Espelha o cálculo que o gate de bloqueio em AURORA
 * CORE (n8n) já faz — `tenant_token_limits.monthly_limit` vs a view agregada
 * `tenant_token_usage_current_month` — só que pro lado visual.
 *
 * `tokensLimit: null` significa tenant sem limite configurado ainda (ilimitado, não bloqueado).
 */
export function useAuroraTokenUsage(pollMs = 60000) {
  const { activeTenantId } = useAuth();
  const [usage, setUsage] = useState<AuroraTokenUsage | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!supabase || !activeTenantId) {
      setLoading(false);
      return;
    }

    const [{ data: limitRow }, { data: usageRow }] = await Promise.all([
      supabase
        .from("tenant_token_limits")
        .select("monthly_limit, plan_name")
        .eq("tenant_id", activeTenantId)
        .maybeSingle(),
      supabase
        .from("tenant_token_usage_current_month")
        .select("tokens_used")
        .eq("tenant_id", activeTenantId)
        .maybeSingle(),
    ]);

    const tokensUsed = Number(usageRow?.tokens_used ?? 0);
    const tokensLimit = limitRow?.monthly_limit != null ? Number(limitRow.monthly_limit) : null;

    setUsage({
      tokensUsed,
      tokensLimit,
      percentUsed: tokensLimit ? Math.min(100, Math.round((tokensUsed / tokensLimit) * 1000) / 10) : null,
      planName: limitRow?.plan_name ?? null,
      limitReached: tokensLimit !== null && tokensUsed >= tokensLimit,
    });
    setLoading(false);
  }, [activeTenantId]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, pollMs);
    return () => clearInterval(id);
  }, [refresh, pollMs]);

  return { usage, loading, refresh };
}
