import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export interface AgentPrompt {
  agentKey: string;
  name: string;
  description: string | null;
  prompt: string;
  updatedAt: string | null;
}

/**
 * Le/escreve `public.ai_agent_prompts` — texto dos prompts dos agentes do G-TECH AI OS
 * (Aurora core + sub-agentes Radar/Júlia-SDR/Closer AI), trazido pro SPY como fonte
 * editável (antes só existia dentro dos nós do n8n, sem nenhuma visibilidade no app).
 * RLS restringe leitura/escrita a master — não é config por tenant, é infraestrutura
 * compartilhada de plataforma, mesma lógica de tool_registry.
 */
export function useAgentPrompts() {
  const [prompts, setPrompts] = useState<AgentPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("ai_agent_prompts")
      .select("agent_key, name, description, prompt, updated_at")
      .order("agent_key", { ascending: true });

    if (error) {
      console.error("[Supabase] ai_agent_prompts select error:", error.message);
      setPrompts([]);
      setLoading(false);
      return;
    }

    setPrompts(
      (data ?? []).map((row: any) => ({
        agentKey: row.agent_key,
        name: row.name,
        description: row.description,
        prompt: row.prompt ?? "",
        updatedAt: row.updated_at,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updatePrompt = useCallback(
    async (agentKey: string, prompt: string) => {
      if (!supabase) return { error: "Supabase indisponível" };
      setSavingKey(agentKey);
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("ai_agent_prompts")
        .update({ prompt, updated_at: new Date().toISOString(), updated_by: authUser?.id ?? null })
        .eq("agent_key", agentKey);
      setSavingKey(null);
      if (error) {
        console.error("[Supabase] ai_agent_prompts update error:", error.message);
        return { error: error.message };
      }
      await refresh();
      return { error: null };
    },
    [refresh]
  );

  return { prompts, loading, savingKey, updatePrompt, refresh };
}
