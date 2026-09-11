import { useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { useToolRegistry } from "../../../hooks/useToolRegistry";
import { Button } from "../../../components/ui/button";

/**
 * Tool Registry: catalogo formal de todo workflow n8n do G-TECH AI OS (sub-agente, tool ou
 * automacao standalone), lido de `tool_registry`. Antes disso nao existia nenhum registro central
 * — so 88 workflows dispersos no n8n. Ver memoria gtech_aurora_spi_evolution_audit.
 */
export function AdminToolsTab() {
  const { tools, loading, refresh } = useToolRegistry();
  const [filter, setFilter] = useState("");

  const categories = useMemo(() => {
    const byCategory = new Map<string, typeof tools>();
    for (const t of tools) {
      if (filter && !t.name.toLowerCase().includes(filter.toLowerCase()) && !(t.moduleKey ?? "").includes(filter.toLowerCase())) continue;
      const list = byCategory.get(t.category) ?? [];
      list.push(t);
      byCategory.set(t.category, list);
    }
    return Array.from(byCategory.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [tools, filter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-[var(--color-text-faint)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            placeholder="Filtrar por nome ou módulo..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] pl-8 pr-3 py-2 rounded-lg text-xs outline-none focus:border-blue-500"
          />
        </div>
        <p className="text-xs text-[var(--color-text-muted)] shrink-0">{tools.length} ferramentas catalogadas</p>
        <Button variant="outline" size="sm" onClick={() => refresh()}>
          <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      {loading ? (
        <div className="p-10 text-center text-sm text-[var(--color-text-muted)] bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] rounded-xl">
          Carregando ferramentas...
        </div>
      ) : (
        <div className="space-y-4">
          {categories.map(([category, items]) => (
            <div key={category} className="bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[var(--color-border-default)] bg-white/[0.01]">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                  {category} <span className="text-[var(--color-text-faint)]">({items.length})</span>
                </h3>
              </div>
              <div className="divide-y divide-[var(--color-border-default)]">
                {items.map((t) => (
                  <div key={t.workflowId} className="px-5 py-3 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${t.active ? "bg-emerald-500" : "bg-[var(--color-text-faint)]"}`} />
                        <span className="text-xs font-bold text-[var(--color-text-primary)] truncate">{t.name}</span>
                        {t.moduleKey && (
                          <span className="text-[9px] font-mono text-[var(--color-text-faint)] bg-white/5 px-1.5 py-0.5 rounded">
                            {t.moduleKey}
                          </span>
                        )}
                      </div>
                      {t.description && (
                        <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{t.description}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-[var(--color-text-faint)] shrink-0 font-mono">{t.nodeCount ?? "—"} nós</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
