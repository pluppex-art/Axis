import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export type PlanTier = "start" | "autopilot" | "autonomous";

export interface ToolRegistryEntry {
  workflowId: string;
  name: string;
  category: string;
  moduleKey: string | null;
  description: string | null;
  active: boolean;
  nodeCount: number | null;
  minPlanTier: PlanTier | null;
}

/**
 * Le `public.tool_registry` — catalogo formal de todo workflow n8n do G-TECH AI OS (sub-agente,
 * tool ou automacao standalone), metadado de plataforma. Substitui a falta de um "Tool Registry"
 * central apontada na auditoria do prompt mestre — ver memoria gtech_aurora_spi_evolution_audit.
 */
export function useToolRegistry() {
  const [tools, setTools] = useState<ToolRegistryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("tool_registry")
      .select("workflow_id, name, category, module_key, description, active, node_count, min_plan_tier")
      .order("category", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error("[Supabase] tool_registry select error:", error.message);
      setTools([]);
      setLoading(false);
      return;
    }

    setTools(
      (data ?? []).map((row: any) => ({
        workflowId: row.workflow_id,
        name: row.name,
        category: row.category,
        moduleKey: row.module_key,
        description: row.description,
        active: row.active,
        nodeCount: row.node_count,
        minPlanTier: row.min_plan_tier,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { tools, loading, refresh };
}
