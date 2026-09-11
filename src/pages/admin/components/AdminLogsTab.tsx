import { Button } from "../../../components/ui/button";
import { Download, RefreshCw } from "lucide-react";
import { useAuroraAuditLog } from "../../../hooks/useAuroraAuditLog";

function toCsv(rows: ReturnType<typeof useAuroraAuditLog>["entries"]): string {
  const header = "created_at,actor,action,details";
  const lines = rows.map((r) =>
    [r.createdAt, r.actor, r.action, JSON.stringify(r.details ?? {})]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  return [header, ...lines].join("\n");
}

/**
 * Le eventos reais de `aurora_audit_log` (antes era so um placeholder "Nenhum evento registrado.",
 * sem nenhuma leitura de banco). Ver useAuroraAuditLog e memoria gtech_aurora_spi_evolution_audit.
 */
export function AdminLogsTab() {
  const { entries, loading, refresh } = useAuroraAuditLog({ limit: 200 });

  const handleExport = () => {
    const csv = toCsv(entries);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aurora-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant="outline" disabled={entries.length === 0} onClick={handleExport}>
          <Download className="w-4 h-4 mr-2" /> Exportar CSV
        </Button>
        <Button variant="outline" onClick={() => refresh()}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>
      <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] rounded-xl font-mono text-xs p-4 sm:p-6 overflow-hidden relative min-h-[400px]">
        <div className="absolute top-0 left-0 w-full h-8 bg-[var(--color-surface-sunken)] border-b border-[var(--color-border-default)] flex items-center px-4">
          <span className="text-xs text-[var(--color-text-muted)] font-sans">systemd-journal</span>
        </div>
        <div className="mt-8 overflow-y-auto max-h-[350px] space-y-1.5">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-[var(--color-text-muted)] text-sm">
              Carregando eventos...
            </div>
          ) : entries.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-[var(--color-text-muted)] text-sm">
              Nenhum evento registrado.
            </div>
          ) : (
            entries.map((e) => (
              <div key={e.id} className="flex items-start gap-3 py-1 border-b border-white/5 last:border-0">
                <span className="text-[var(--color-text-muted)] shrink-0">
                  {new Date(e.createdAt).toLocaleString("pt-BR")}
                </span>
                <span className="text-emerald-500 shrink-0">[{e.actor}]</span>
                <span className="text-[var(--color-text-primary)]">{e.action}</span>
                {e.details && (
                  <span className="text-[var(--color-text-muted)] truncate">
                    {JSON.stringify(e.details)}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
