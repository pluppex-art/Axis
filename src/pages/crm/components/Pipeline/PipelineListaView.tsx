import { useState, useEffect } from "react";
import { Card } from "../../../../components/ui/card";
import { Pagination } from "../../../../components/ui/Pagination";
import { Search, Filter, Mail, Phone, Calendar, MoreHorizontal } from "lucide-react";

const PAGE_SIZE = 50;

interface PipelineListaViewProps {
  listaLeads: any[];
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  sellerFilter: string;
  setSellerFilter: (v: string) => void;
  sellers: string[];
  temperatureFilter: string;
  setTemperatureFilter: (v: string) => void;
  sortOrder: "desc" | "asc";
  setSortOrder: (fn: (o: "desc" | "asc") => "desc" | "asc") => void;
  setSelectedLead: (lead: any) => void;
  updateLead: (id: string, updates: any) => void;
}

export function PipelineListaView({
  listaLeads, searchQuery, setSearchQuery, sellerFilter, setSellerFilter, sellers,
  temperatureFilter, setTemperatureFilter, sortOrder, setSortOrder,
  setSelectedLead, updateLead,
}: PipelineListaViewProps) {
  // A visão de lista renderizava TODOS os leads filtrados como <tr>/<Card>
  // de uma vez — com milhares de leads (Pipeline sem cap, ao contrário do
  // Kanban), isso trava o navegador (DOM gigante), independente de quão
  // rápido os dados chegam. Pagina só a renderização aqui — os dados já
  // estão todos em memória, não é uma nova busca.
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [searchQuery, temperatureFilter, sortOrder, sellerFilter]);
  const totalPages = Math.max(1, Math.ceil(listaLeads.length / PAGE_SIZE));
  const pageLeads = listaLeads.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 shrink-0">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input type="text" placeholder="Buscar por nome, empresa ou e-mail..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-[var(--color-surface-elevated)]/50 border border-white/5 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#2563EB] w-full" />
        </div>
        <div className="flex items-center gap-2 bg-[var(--color-surface-elevated)] border border-white/10 rounded-xl px-3 h-10">
          <span className="text-[9px] uppercase font-bold text-slate-500">Temp:</span>
          <select value={temperatureFilter} onChange={(e) => setTemperatureFilter(e.target.value)}
            className="bg-transparent border-none text-xs text-white focus:outline-none cursor-pointer font-bold">
            <option value="Todas">Todas</option>
            <option value="quente">🔥 Quente</option>
            <option value="morno">☀️ Morno</option>
            <option value="frio">❄️ Frio</option>
          </select>
        </div>
        <div className="flex items-center gap-2 bg-[var(--color-surface-elevated)] border border-white/10 rounded-xl px-3 h-10">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <select value={sellerFilter} onChange={(e) => setSellerFilter(e.target.value)}
            className="bg-transparent border-none text-xs text-white focus:outline-none cursor-pointer font-bold">
            {sellers.map(s => <option key={s} value={s} className="bg-[var(--color-surface-elevated)]">{s === "Todos" ? "Todos os vendedores" : s}</option>)}
          </select>
        </div>
        <button onClick={() => setSortOrder(o => o === "desc" ? "asc" : "desc")}
          className="flex items-center gap-1.5 bg-[var(--color-surface-elevated)] border border-white/10 rounded-xl px-3 h-10 text-[10px] font-bold text-slate-400 hover:text-white transition-colors cursor-pointer">
          Temp {sortOrder === "desc" ? "▼" : "▲"}
        </button>
      </div>

      {/* Desktop table */}
      <Card className="bg-[var(--color-surface-elevated)]/80 backdrop-blur-xl border border-white/10 overflow-hidden hidden sm:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] uppercase font-bold tracking-wider text-slate-500 bg-[var(--color-surface)]/50 border-b border-white/10">
              <tr>
                <th className="px-6 py-4">Nome & Empresa</th>
                <th className="px-6 py-4">Contato</th>
                <th className="px-6 py-4">Status / Prioridade</th>
                <th className="px-6 py-4">Valor</th>
                <th className="px-6 py-4">Responsável</th>
                <th className="px-6 py-4">Última Interação</th>
                <th className="px-6 py-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {pageLeads.map((lead: any) => (
                <tr key={lead.id} onClick={() => setSelectedLead(lead)}
                  className="hover:bg-white/[0.02] transition-colors cursor-pointer group">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-white group-hover:text-[#06B6D4] transition-colors">{lead.name}</div>
                    <div className="text-slate-400 text-xs">{lead.company}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-slate-300 text-xs"><Mail className="w-3 h-3 text-slate-500 shrink-0" /> {lead.email}</div>
                    <div className="flex items-center gap-2 text-slate-300 mt-1 text-xs"><Phone className="w-3 h-3 text-slate-500 shrink-0" /> {lead.phone}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1.5">
                      <span className={`w-fit px-2.5 py-0.5 text-[9px] font-bold rounded-full border ${
                        lead.status === "Novo" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                        lead.status === "Qualificado" ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" :
                        lead.status === "Em Negociação" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
                        lead.status === "Fechado" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                        "bg-red-500/10 text-red-400 border-red-500/20"
                      }`}>{lead.status}</span>
                      <span className={`w-fit px-2 py-0.5 text-[8px] font-bold rounded uppercase ${
                        lead.priority === "Alta" ? "bg-red-500/20 text-red-500" :
                        lead.priority === "Média" ? "bg-yellow-500/20 text-yellow-500" : "bg-blue-500/20 text-blue-500"
                      }`}>{lead.priority}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-emerald-400/80">{lead.value}</td>
                  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                    <select value={lead.seller || ""} onChange={(e) => updateLead(lead.id, { seller: e.target.value })}
                      className="bg-[var(--color-surface)]/80 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-[#2563EB] cursor-pointer hover:bg-white/5">
                      <option value="">Sem Vendedor</option>
                      {sellers.filter((s: string) => s !== "Todos").map((s: string) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-xs">
                    <div className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {lead.date}</div>
                    <div className="text-[10px] mt-1 italic">{lead.title}</div>
                    {lead.timeIdle !== undefined && (
                      <div className="mt-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold inline-block ${lead.timeIdle > 7 ? "bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse" : "bg-slate-800 text-slate-400"}`}>
                          ⏳ {lead.timeIdle}d sem contato
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 bg-white/[0.03] text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {listaLeads.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-500 text-sm">Nenhum lead encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mobile cards */}
      <div className="space-y-3 sm:hidden">
        {pageLeads.map((lead: any) => (
          <Card key={lead.id} onClick={() => setSelectedLead(lead)}
            className="p-4 bg-[var(--color-surface-elevated)]/80 border-white/5 active:border-white/20 transition-all flex flex-col gap-3 cursor-pointer">
            <div className="flex justify-between items-start">
              <div className="min-w-0">
                <h4 className="font-bold text-white text-sm truncate">{lead.name}</h4>
                <p className="text-xs text-slate-400 truncate">{lead.company}</p>
              </div>
              <span className={`px-2 py-0.5 text-[8px] font-bold rounded uppercase shrink-0 ml-2 ${
                lead.priority === "Alta" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                lead.priority === "Média" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                "bg-blue-500/10 text-blue-400 border border-blue-500/20"
              }`}>{lead.priority}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs border-y border-white/5 py-2 px-1">
              <div>
                <span className="text-[8px] text-slate-500 uppercase font-bold block mb-0.5">Valor</span>
                <span className="font-mono text-emerald-400 text-xs">{lead.value}</span>
              </div>
              <div>
                <span className="text-[8px] text-slate-500 uppercase font-bold block mb-0.5">Status</span>
                <span className={`w-fit px-2 py-0.5 text-[8px] font-black rounded-full border block ${
                  lead.status === "Novo" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                  lead.status === "Fechado" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                  "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                }`}>{lead.status}</span>
              </div>
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-500">
              <span className="truncate">{lead.email}</span>
              <span className="shrink-0 font-medium ml-2">{lead.phone}</span>
            </div>
          </Card>
        ))}
        {listaLeads.length === 0 && (
          <div className="p-8 border border-dashed border-white/10 rounded-xl text-center text-slate-500">Nenhum lead encontrado</div>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} total={listaLeads.length} pageSize={PAGE_SIZE} onPageChange={setPage} itemLabel="lead" />
    </>
  );
}
