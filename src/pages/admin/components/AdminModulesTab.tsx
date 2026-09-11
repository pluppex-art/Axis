import { useState } from "react";
import { RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { useModuleManifest } from "../../../hooks/useModuleManifest";
import { Button } from "../../../components/ui/button";

/**
 * Module Manifest: catalogo formal de todo modulo/nicho do Axis (generico ou vertical de negocio),
 * lido de `module_manifest`. Antes disso, essa informacao so existia espalhada em
 * ConfigModulosDemos.tsx (DEFAULT_MODULES), ModulesCombobox.tsx (ALL_MODULES), navData.ts e
 * App.tsx — sem um catalogo unico e consultavel. Ver memoria gtech_aurora_spi_evolution_audit.
 */
export function AdminModulesTab() {
  const { modules, loading, refresh } = useModuleManifest();
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--color-text-muted)]">
          {modules.length} módulos catalogados — clique em um para ver rotas, tabelas e permissões.
        </p>
        <Button variant="outline" size="sm" onClick={() => refresh()}>
          <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-[var(--color-text-muted)]">Carregando módulos...</div>
        ) : (
          <div className="divide-y divide-[var(--color-border-default)]">
            {modules.map((m) => (
              <div key={m.moduleKey}>
                <button
                  onClick={() => setExpanded(expanded === m.moduleKey ? null : m.moduleKey)}
                  className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border ${
                        m.category === "vertical"
                          ? "text-violet-400 bg-violet-500/10 border-violet-500/20"
                          : "text-blue-400 bg-blue-500/10 border-blue-500/20"
                      }`}
                    >
                      {m.category === "vertical" ? "Vertical" : "Genérico"}
                    </span>
                    <span className="text-sm font-bold text-[var(--color-text-primary)]">{m.displayName}</span>
                    <span className="text-[10px] font-mono text-[var(--color-text-faint)]">{m.moduleKey}</span>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] text-[var(--color-text-muted)]">
                    <span className="flex items-center gap-1">
                      {m.cargoSelectable ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-[var(--color-text-faint)]" />
                      )}
                      Seleciona por cargo
                    </span>
                    <span className="flex items-center gap-1">
                      {m.dbEnforced ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-amber-500" />
                      )}
                      Bloqueio real no banco
                    </span>
                  </div>
                </button>

                {expanded === m.moduleKey && (
                  <div className="px-5 pb-4 space-y-2 text-xs text-[var(--color-text-muted)] bg-white/[0.01]">
                    {m.pageFolder && (
                      <p><span className="text-[var(--color-text-faint)]">Pasta:</span> <code className="font-mono">{m.pageFolder}</code></p>
                    )}
                    {m.routes.length > 0 && (
                      <p><span className="text-[var(--color-text-faint)]">Rotas:</span> {m.routes.join(", ")}</p>
                    )}
                    {m.tables.length > 0 && (
                      <p><span className="text-[var(--color-text-faint)]">Tabelas:</span> {m.tables.join(", ")}</p>
                    )}
                    {m.backendRoutes.length > 0 && (
                      <p><span className="text-[var(--color-text-faint)]">Rotas de backend:</span> {m.backendRoutes.join(", ")}</p>
                    )}
                    {m.notes && (
                      <p className="italic text-[var(--color-text-faint)]">{m.notes}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
