import { useState, useMemo, useEffect } from "react";
import {
  TerminalSquare, Download, Pause, Play,
  Search, Copy, RefreshCw
} from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Modal } from "../../../components/ui/modal";
import { toast } from "sonner";
import { useAuroraAuditLog, type AuroraAuditLogEntry } from "../../../hooks/useAuroraAuditLog";

type Level = "INFO" | "SUCCESS" | "WARN" | "ERROR" | "SECURITY";

function levelFor(action: string): Level {
  const a = action.toLowerCase();
  if (a.includes("error") || a.includes("fail") || a.includes("erro")) return "ERROR";
  if (a.includes("denied") || a.includes("blocked") || a.includes("bloque")) return "SECURITY";
  if (a.includes("created") || a.includes("moved") || a.includes("updated") || a.includes("sync")) return "SUCCESS";
  return "INFO";
}

function levelStyle(level: Level) {
  switch (level) {
    case "SUCCESS":
      return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    case "WARN":
      return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    case "ERROR":
      return "text-rose-400 bg-rose-500/10 border-rose-500/20";
    case "SECURITY":
      return "text-purple-400 bg-purple-500/10 border-purple-500/20";
    default:
      return "text-cyan-400 bg-cyan-500/10 border-cyan-500/20";
  }
}

function toCsv(rows: AuroraAuditLogEntry[]): string {
  const header = "created_at,actor,action,details";
  const lines = rows.map((r) =>
    [r.createdAt, r.actor, r.action, JSON.stringify(r.details ?? {})]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  return [header, ...lines].join("\n");
}

/**
 * Le eventos reais de `aurora_audit_log` escopados ao tenant ativo (useAuroraAuditLog). Nao existem
 * "service"/"ip"/"latencyMs"/"traceId" reais nessa tabela — esses campos vinham de uma versao
 * anterior alimentada por dados fake em memoria (useState<SystemLogEntry[]>([]) nunca populado),
 * a mesma classe de fachada ja corrigida uma vez neste projeto. "Nivel" aqui e so uma classificacao
 * visual derivada do texto real da acao, nao um campo inventado.
 */
export function AdminLogsTab() {
  const { entries, loading, refresh } = useAuroraAuditLog({ limit: 200 });
  const [isLive, setIsLive] = useState(true);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<"ALL" | Level>("ALL");
  const [inspecting, setInspecting] = useState<AuroraAuditLogEntry | null>(null);

  useEffect(() => {
    if (!isLive) return;
    const id = setInterval(() => refresh(), 15000);
    return () => clearInterval(id);
  }, [isLive, refresh]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return entries.filter((e) => {
      const level = levelFor(e.action);
      const matchSearch =
        !q ||
        e.action.toLowerCase().includes(q) ||
        e.actor.toLowerCase().includes(q) ||
        JSON.stringify(e.details ?? {}).toLowerCase().includes(q);
      const matchLevel = levelFilter === "ALL" || level === levelFilter;
      return matchSearch && matchLevel;
    });
  }, [entries, search, levelFilter]);

  const handleCopy = (e: AuroraAuditLogEntry) => {
    navigator.clipboard.writeText(
      `[${e.createdAt}] [${e.actor}] ${e.action} ${JSON.stringify(e.details ?? {})}`
    );
    toast.success("Log copiado para a área de transferência!");
  };

  const handleExport = () => {
    if (entries.length === 0) return;
    const blob = new Blob([toCsv(entries)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aurora-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Logs exportados com sucesso!");
  };

  return (
    <div className="space-y-4">
      {/* Control Toolbar */}
      <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] p-4 rounded-2xl space-y-3 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar por ação, autor ou detalhes..."
              className="w-full bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-xl pl-9 pr-4 py-2 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-faint)] focus:outline-none focus:border-[var(--color-primary-blue)] font-mono"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setIsLive(!isLive);
                toast.info(isLive ? "Atualização automática pausada." : "Atualização automática retomada.");
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                isLive
                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/25"
                  : "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] border-[var(--color-border-default)]"
              }`}
            >
              {isLive ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-mono">LIVE</span>
                  <Pause className="w-3 h-3 ml-1" />
                </>
              ) : (
                <>
                  <Play className="w-3 h-3" />
                  <span>Retomar</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => refresh()}
              title="Atualizar agora"
              className="p-2 bg-[var(--color-surface-sunken)] hover:bg-[var(--color-surface)] border border-[var(--color-border-default)] rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>

            <button
              type="button"
              onClick={handleExport}
              disabled={entries.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-surface-sunken)] hover:bg-[var(--color-surface)] border border-[var(--color-border-default)] rounded-xl text-xs font-bold text-[var(--color-text-primary)] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5 text-[var(--color-primary-blue)]" /> Exportar CSV
            </button>
          </div>
        </div>

        {/* Level Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none pt-2 border-t border-[var(--color-border-subtle)] text-xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-muted)] mr-2 shrink-0">
            Nível:
          </span>
          {(["ALL", "INFO", "SUCCESS", "WARN", "ERROR", "SECURITY"] as const).map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setLevelFilter(lvl)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                levelFilter === lvl
                  ? "bg-[var(--color-primary-blue)] text-white shadow-xs"
                  : "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] border border-[var(--color-border-default)]"
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Terminal Display Container */}
      <div className="bg-[#090d16] border border-slate-800 rounded-2xl font-mono text-xs overflow-hidden shadow-2xl relative">
        <div className="bg-[#0f172a] border-b border-slate-800 px-4 py-2.5 flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
            </div>
            <span className="text-[11px] text-slate-400 font-sans font-bold ml-2 flex items-center gap-1.5">
              <TerminalSquare className="w-3.5 h-3.5 text-cyan-400" /> aurora-audit-log
            </span>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-slate-400">
            <span className="hidden sm:inline">{filtered.length} evento(s)</span>
          </div>
        </div>

        <div className="p-3 sm:p-4 max-h-[480px] overflow-y-auto divide-y divide-slate-900 space-y-1">
          {loading ? (
            <div className="py-20 text-center text-slate-500 text-sm">Carregando eventos...</div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center justify-center gap-3 text-slate-500">
              <TerminalSquare className="w-10 h-10 text-slate-700" />
              <p className="text-sm font-sans font-medium">
                {entries.length === 0
                  ? "Nenhum evento registrado ainda."
                  : "Nenhum evento corresponde aos filtros aplicados."}
              </p>
              {entries.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setLevelFilter("ALL");
                  }}
                  className="text-xs font-sans text-cyan-400 hover:underline"
                >
                  Redefinir filtros
                </button>
              )}
            </div>
          ) : (
            filtered.map((e) => {
              const level = levelFor(e.action);
              return (
                <div
                  key={e.id}
                  onClick={() => setInspecting(e)}
                  className="py-2 px-2.5 rounded-lg hover:bg-slate-800/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer group"
                >
                  <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-wrap sm:flex-nowrap">
                    <span className="text-slate-500 text-[11px] shrink-0">
                      {new Date(e.createdAt).toLocaleString("pt-BR")}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border shrink-0 ${levelStyle(level)}`}>
                      {level}
                    </span>
                    <span className="text-indigo-400 text-[10px] shrink-0">[{e.actor}]</span>
                    <span className="text-slate-200 text-xs truncate group-hover:text-cyan-300 transition-colors">
                      {e.action}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-[10px] text-slate-500 pl-6 sm:pl-0">
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        handleCopy(e);
                      }}
                      title="Copiar log"
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-white"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Log Inspector Modal */}
      {inspecting && (
        <Modal
          isOpen={true}
          onClose={() => setInspecting(null)}
          title={
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <TerminalSquare className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-[var(--color-text-primary)]">Inspetor de Evento</h3>
                <p className="text-[10px] font-mono text-[var(--color-text-muted)] mt-0.5">
                  {new Date(inspecting.createdAt).toLocaleString("pt-BR")} • {inspecting.actor}
                </p>
              </div>
            </div>
          }
          footer={
            <div className="flex items-center justify-between w-full">
              <Button type="button" variant="outline" size="sm" onClick={() => handleCopy(inspecting)}>
                <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar Dados
              </Button>
              <Button type="button" onClick={() => setInspecting(null)} className="px-6 font-bold">
                Fechar
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="p-3.5 bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Ação</span>
                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${levelStyle(levelFor(inspecting.action))}`}>
                  {levelFor(inspecting.action)}
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-primary)] font-mono leading-relaxed">{inspecting.action}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-xl">
                <span className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider block">Autor</span>
                <span className="font-bold text-[var(--color-text-primary)] block mt-0.5">{inspecting.actor}</span>
              </div>
              <div className="p-3 bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-xl">
                <span className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider block">Data/Hora</span>
                <span className="font-bold text-[var(--color-text-primary)] font-mono block mt-0.5">
                  {new Date(inspecting.createdAt).toLocaleString("pt-BR")}
                </span>
              </div>
            </div>

            {inspecting.details && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Payload JSON</span>
                <pre className="p-3.5 bg-[#090d16] text-cyan-300 rounded-xl text-xs overflow-x-auto border border-slate-800 font-mono">
                  {JSON.stringify(inspecting.details, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
