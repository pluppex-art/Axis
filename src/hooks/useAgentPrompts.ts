import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

export interface AgentPrompt {
  agentKey: string;
  name: string;
  description: string | null;
  prompt: string;
  updatedAt: string | null;
  /** true quando o texto exibido já é a versão customizada deste tenant (não o padrão global). */
  isCustomized: boolean;
}

/**
 * Le/escreve `public.ai_agent_prompts` — texto dos prompts dos agentes do G-TECH AI OS
 * (Aurora core + sub-agentes Radar/Júlia-SDR/Closer AI), trazido pro SPY como fonte
 * editável (antes só existia dentro dos nós do n8n, sem nenhuma visibilidade no app).
 *
 * Padrão "default + override" (ver migration 20260921_ai_agent_prompts_per_tenant):
 * cada agente tem uma linha padrão global (tenant_id null, só master edita) e cada
 * tenant pode ter sua PRÓPRIA linha (tenant_id = o dele) que sobrepõe o padrão só
 * pra ele. Salvar aqui sempre grava na linha do tenant ATIVO (upsert por
 * tenant_id+agent_key) — nunca no padrão global nem na linha de outro tenant, então
 * um tenant customizando o prompt não quebra o comportamento dos outros.
 */
export function useAgentPrompts() {
  const { activeTenantId } = useAuth();
  const [prompts, setPrompts] = useState<AgentPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!supabase || !activeTenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("ai_agent_prompts")
      .select("agent_key, tenant_id, name, description, prompt, updated_at")
      .or(`tenant_id.is.null,tenant_id.eq.${activeTenantId}`)
      .order("agent_key", { ascending: true });

    if (error) {
      console.error("[Supabase] ai_agent_prompts select error:", error.message);
      setPrompts([]);
      setLoading(false);
      return;
    }

    // Uma linha padrão (tenant_id null) + possivelmente uma linha do tenant ativo por
    // agente — a do tenant, quando existe, sempre vence a exibição.
    const byAgent = new Map<string, any>();
    for (const row of data ?? []) {
      const existing = byAgent.get(row.agent_key);
      if (!existing || row.tenant_id === activeTenantId) byAgent.set(row.agent_key, row);
    }

    setPrompts(
      Array.from(byAgent.values()).map((row: any) => ({
        agentKey: row.agent_key,
        name: row.name,
        description: row.description,
        prompt: row.prompt ?? "",
        updatedAt: row.updated_at,
        isCustomized: row.tenant_id === activeTenantId,
      }))
    );
    setLoading(false);
  }, [activeTenantId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updatePrompt = useCallback(
    async (agentKey: string, prompt: string, name: string, description: string | null) => {
      if (!supabase || !activeTenantId) return { error: "Sem tenant ativo" };
      setSavingKey(agentKey);
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      const { error } = await supabase.from("ai_agent_prompts").upsert(
        {
          tenant_id: activeTenantId,
          agent_key: agentKey,
          name,
          description,
          prompt,
          updated_at: new Date().toISOString(),
          updated_by: authUser?.id ?? null,
        },
        { onConflict: "tenant_id,agent_key" }
      );
      setSavingKey(null);
      if (error) {
        console.error("[Supabase] ai_agent_prompts update error:", error.message);
        return { error: error.message };
      }
      await refresh();
      return { error: null };
    },
    [activeTenantId, refresh]
  );

  return { prompts, loading, savingKey, updatePrompt, refresh };
}
