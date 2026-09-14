import React, { useState, useMemo } from "react";
import {
  TerminalSquare, Download, Trash2, Pause, Play,
  Search, Filter, ShieldAlert, CheckCircle2, AlertTriangle,
  Info, XCircle, Copy, Eye, Clock, Server, RefreshCw
} from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Modal } from "../../../components/ui/modal";
import { toast } from "sonner";

export interface SystemLogEntry {
  id: string;
  timestamp: string;
  level: "INFO" | "SUCCESS" | "WARN" | "ERROR" | "SECURITY";
  service: "Database (RLS)" | "Auth & Sessions" | "Edge Webhooks" | "Billing SaaS" | "Modulos";
  tenant: string;
  message: string;
  traceId: string;
  latencyMs?: number;
  ip?: string;
  details?: Record<string, any>;
}

export function AdminLogsTab() {
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);
  const [isLive, setIsLive] = useState(true);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("ALL");
  const [serviceFilter, setServiceFilter] = useState<string>("ALL");
  const [inspectingLog, setInspectingLog] = useState<SystemLogEntry | null>(null);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const q = search.toLowerCase();
      const matchSearch =
        log.message.toLowerCase().includes(q) ||
        log.tenant.toLowerCase().includes(q) ||
        log.service.toLowerCase().includes(q) ||
        log.traceId.toLowerCase().includes(q) ||
        (log.ip && log.ip.includes(q));

      const matchLevel = levelFilter === "ALL" || log.level === levelFilter;
      const matchService = serviceFilter === "ALL" || log.service === serviceFilter;

      return matchSearch && matchLevel && matchService;
    });
  }, [logs, search, levelFilter, serviceFilter]);

  const handleClearLogs = () => {
    setLogs([]);
    toast.info("Console de logs limpo.");
  };

  const handleCopyLog = (log: SystemLogEntry) => {
    const text = `[${log.timestamp}] [${log.level}] [${log.service}] [${log.tenant}] ${log.message} (Trace: ${log.traceId})`;
    navigator.clipboard.writeText(text);
    toast.success("Log copiado para a área de transferência!");
  };

  const handleExportCSV = () => {
    try {
      const headers = ["Timestamp", "Level", "Service", "Tenant", "Message", "TraceId", "LatencyMs", "IP"];
      const rows = filteredLogs.map(l => [
        `"${l.timestamp}"`,
        l.level,
        `"${l.service}"`,
        `"${l.tenant}"`,
        `"${l.message.replace(/"/g, '""')}"`,
        l.traceId,
        l.latencyMs || 0,
        l.ip || ""
      ]);

      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `axis_system_logs_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Logs do sistema exportados com sucesso!");
    } catch {
      toast.error("Erro ao exportar logs.");
    }
  };

  const getLevelStyle = (level: SystemLogEntry["level"]) => {
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
  };

  return (
    <div className="space-y-4">
      {/* Control Toolbar */}
      <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] p-4 rounded-2xl space-y-3 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filtrar por mensagem, IP, Trace ID ou Tenant..."
              className="w-full bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-xl pl-9 pr-4 py-2 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-faint)] focus:outline-none focus:border-[var(--color-primary-blue)] font-mono"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Live Stream Button */}
            <button
              type="button"
              onClick={() => {
                setIsLive(!isLive);
                toast.info(isLive ? "Stream em tempo real pausado." : "Stream em tempo real retomado.");
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

            {/* Clear Console */}
            <button
              type="button"
              onClick={handleClearLogs}
              title="Limpar console visual"
              className="p-2 bg-[var(--color-surface-sunken)] hover:bg-[var(--color-surface)] border border-[var(--color-border-default)] rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-all cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Export CSV */}
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-surface-sunken)] hover:bg-[var(--color-surface)] border border-[var(--color-border-default)] rounded-xl text-xs font-bold text-[var(--color-text-primary)] transition-all cursor-pointer"
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
          {["ALL", "INFO", "SUCCESS", "WARN", "ERROR", "SECURITY"].map(lvl => (
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

          <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-muted)] mx-2 shrink-0">
            Serviço:
          </span>
          {["ALL", "Database (RLS)", "Auth & Sessions", "Edge Webhooks", "Billing SaaS", "Modulos"].map(srv => (
            <button
              key={srv}
              type="button"
              onClick={() => setServiceFilter(srv)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                serviceFilter === srv
                  ? "bg-[var(--color-primary-blue)] text-white shadow-xs"
                  : "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] border border-[var(--color-border-default)]"
              }`}
            >
              {srv}
            </button>
          ))}
        </div>
      </div>

      {/* Terminal Display Container */}
      <div className="bg-[#090d16] border border-slate-800 rounded-2xl font-mono text-xs overflow-hidden shadow-2xl relative">
        {/* Terminal Header Bar */}
        <div className="bg-[#0f172a] border-b border-slate-800 px-4 py-2.5 flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
            </div>
            <span className="text-[11px] text-slate-400 font-sans font-bold ml-2 flex items-center gap-1.5">
              <TerminalSquare className="w-3.5 h-3.5 text-cyan-400" /> axis-cloud-kernel@prod-cluster-01
            </span>
          </div>

          <div className="flex items-center gap-3 text-[10px] text-slate-400">
            <span className="hidden sm:inline">Stream Ativo: 8 eventos recentes</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> 0 erros críticos
            </span>
          </div>
        </div>

        {/* Logs Content List */}
        <div className="p-3 sm:p-4 max-h-[480px] overflow-y-auto divide-y divide-slate-900 space-y-1">
          {filteredLogs.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center justify-center gap-3 text-slate-500">
              <TerminalSquare className="w-10 h-10 text-slate-700" />
              <p className="text-sm font-sans font-medium">Nenhum evento corresponde aos filtros aplicados.</p>
              <button
                type="button"
                onClick={() => { setSearch(""); setLevelFilter("ALL"); setServiceFilter("ALL"); }}
                className="text-xs font-sans text-cyan-400 hover:underline"
              >
                Redefinir filtros
              </button>
            </div>
          ) : (
            filteredLogs.map(log => {
              const badgeStyle = getLevelStyle(log.level);
              return (
                <div
                  key={log.id}
                  onClick={() => setInspectingLog(log)}
                  className="py-2 px-2.5 rounded-lg hover:bg-slate-800/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer group"
                >
                  <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-wrap sm:flex-nowrap">
                    {/* Timestamp */}
                    <span className="text-slate-500 text-[11px] shrink-0">
                      {log.timestamp.slice(11)}
                    </span>

                    {/* Level */}
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border shrink-0 ${badgeStyle}`}>
                      {log.level}
                    </span>

                    {/* Service */}
                    <span className="text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded text-[10px] shrink-0 border border-slate-700/50">
                      {log.service}
                    </span>

                    {/* Tenant Tag */}
                    <span className="text-indigo-400 text-[10px] shrink-0">
                      [{log.tenant}]
                    </span>

                    {/* Message */}
                    <span className="text-slate-200 text-xs truncate group-hover:text-cyan-300 transition-colors">
                      {log.message}
                    </span>
                  </div>

                  {/* Metadata & Actions */}
                  <div className="flex items-center gap-3 shrink-0 text-[10px] text-slate-500 pl-6 sm:pl-0">
                    {log.latencyMs && (
                      <span className="text-cyan-400/80 font-mono">
                        {log.latencyMs}ms
                      </span>
                    )}
                    <span className="text-slate-600 font-mono">
                      {log.traceId}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyLog(log);
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
      {inspectingLog && (
        <Modal
          isOpen={true}
          onClose={() => setInspectingLog(null)}
          title={
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <TerminalSquare className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-[var(--color-text-primary)]">
                  Inspetor de Evento: {inspectingLog.traceId}
                </h3>
                <p className="text-[10px] font-mono text-[var(--color-text-muted)] mt-0.5">
                  {inspectingLog.timestamp} • {inspectingLog.service} • {inspectingLog.tenant}
                </p>
              </div>
            </div>
          }
          footer={
            <div className="flex items-center justify-between w-full">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleCopyLog(inspectingLog)}
              >
                <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar Dados
              </Button>
              <Button
                type="button"
                onClick={() => setInspectingLog(null)}
                className="px-6 font-bold"
              >
                Fechar
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="p-3.5 bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Mensagem</span>
                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${getLevelStyle(inspectingLog.level)}`}>
                  {inspectingLog.level}
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-primary)] font-mono leading-relaxed">
                {inspectingLog.message}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-3 bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-xl">
                <span className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider block">Serviço</span>
                <span className="font-bold text-[var(--color-text-primary)] block mt-0.5">{inspectingLog.service}</span>
              </div>
              <div className="p-3 bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-xl">
                <span className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider block">Tenant ID</span>
                <span className="font-bold text-[var(--color-text-primary)] block mt-0.5">{inspectingLog.tenant}</span>
              </div>
              <div className="p-3 bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-xl">
                <span className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider block">Latência</span>
                <span className="font-bold text-cyan-500 font-mono block mt-0.5">{inspectingLog.latencyMs || 0} ms</span>
              </div>
              <div className="p-3 bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-xl">
                <span className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider block">Endereço IP</span>
                <span className="font-bold text-[var(--color-text-primary)] font-mono block mt-0.5">{inspectingLog.ip || "Localhost"}</span>
              </div>
            </div>

            {inspectingLog.details && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                  Payload JSON / Metadados de Execução
                </span>
                <pre className="p-3.5 bg-[#090d16] text-cyan-300 rounded-xl text-xs overflow-x-auto border border-slate-800 font-mono">
                  {JSON.stringify(inspectingLog.details, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
