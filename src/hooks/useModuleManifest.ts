import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export interface ModuleManifestEntry {
  moduleKey: string;
  displayName: string;
  category: "generic" | "vertical";
  pageFolder: string | null;
  routes: string[];
  tables: string[];
  cargoSelectable: boolean;
  dbEnforced: boolean;
  backendRoutes: string[];
  notes: string | null;
}

/**
 * Le `public.module_manifest` — catalogo formal de todo modulo/nicho do Axis, metadado de
 * plataforma (mesmo pra todo tenant, sem tenant_id). Substitui a falta de um "Module Manifest"
 * central apontada na auditoria do prompt mestre — ver memoria gtech_aurora_spi_evolution_audit.
 */
export function useModuleManifest() {
  const [modules, setModules] = useState<ModuleManifestEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("module_manifest")
      .select("module_key, display_name, category, page_folder, routes, tables, cargo_selectable, db_enforced, backend_routes, notes")
      .order("category", { ascending: true })
      .order("display_name", { ascending: true });

    if (error) {
      console.error("[Supabase] module_manifest select error:", error.message);
      setModules([]);
      setLoading(false);
      return;
    }

    setModules(
      (data ?? []).map((row: any) => ({
        moduleKey: row.module_key,
        displayName: row.display_name,
        category: row.category,
        pageFolder: row.page_folder,
        routes: row.routes ?? [],
        tables: row.tables ?? [],
        cargoSelectable: row.cargo_selectable,
        dbEnforced: row.db_enforced,
        backendRoutes: row.backend_routes ?? [],
        notes: row.notes,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { modules, loading, refresh };
}
