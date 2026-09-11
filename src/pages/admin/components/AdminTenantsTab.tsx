import { useState, useEffect } from "react";
import { Search, Server, Plus, Settings, ShieldCheck, CheckCircle2, RefreshCw, Building2 } from "lucide-react";
import { fetchTenantsDetailed } from "../../../lib/supabase";

interface TenantItem {
  id: string;
  name: string;
  niche: string;
  primary_color?: string | null;
  status?: string;
  usersCount?: number;
}

const FALLBACK_TENANTS: TenantItem[] = [
  { id: "gtech-master", name: "G-Tech Master (S.P.Y.)", niche: "Tecnologia", status: "Active" },
  { id: "e-empreenda", name: "E-EMPREENDA+", niche: "Educação", status: "Active" },
  { id: "solar-axis", name: "Solar Axis Demo", niche: "Solar", status: "Active" },
  { id: "imob-prime", name: "Prime Imóveis", niche: "Imobiliária", status: "Active" },
];

interface AdminTenantsTabProps {
  onConfigureModules: (tenantName: string) => void;
  onOpenNewTenant: () => void;
}

export function AdminTenantsTab({ onConfigureModules, onOpenNewTenant }: AdminTenantsTabProps) {
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const loadTenants = async () => {
    setLoading(true);
    try {
      const data = await fetchTenantsDetailed();
      if (data && data.length > 0) {
        setTenants(data.map(d => ({ ...d, status: "Active" })));
      } else {
        setTenants(FALLBACK_TENANTS);
      }
    } catch {
      setTenants(FALLBACK_TENANTS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTenants();
  }, []);

  const filteredTenants = tenants.filter(t => {
    const q = search.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      (t.niche && t.niche.toLowerCase().includes(q)) ||
      t.id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por Nome, Nicho ou ID..."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder-slate-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={loadTenants}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl text-xs font-bold text-slate-200 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </button>
          <button
            onClick={onOpenNewTenant}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg"
          >
            <Plus className="w-3.5 h-3.5" /> Novo Tenant
          </button>
        </div>
      </div>

      {/* Tenants Grid */}
      {loading ? (
        <div className="bg-slate-900/50 rounded-2xl border border-slate-800 min-h-[300px] flex items-center justify-center">
          <RefreshCw className="w-6 h-6 text-slate-500 animate-spin" />
        </div>
      ) : filteredTenants.length === 0 ? (
        <div className="bg-slate-900/50 rounded-2xl border border-slate-800 min-h-[300px] flex flex-col items-center justify-center p-8 text-center gap-3">
          <Server className="w-10 h-10 text-slate-600" />
          <h4 className="text-sm font-black text-white uppercase tracking-wider">Nenhum Tenant Encontrado</h4>
          <p className="text-xs text-slate-400 max-w-sm">
            Nenhuma instância encontrada para a busca "{search}". Cadastre um novo tenant para começar.
          </p>
          <button
            onClick={onOpenNewTenant}
            className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all"
          >
            Criar Primeiro Tenant
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTenants.map(tenant => (
            <div
              key={tenant.id}
              className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 space-y-4 transition-all hover:shadow-xl group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-black text-white truncate group-hover:text-blue-400 transition-colors">
                      {tenant.name}
                    </h4>
                    <p className="text-[10px] text-slate-500 font-mono truncate mt-0.5">
                      ID: {tenant.id}
                    </p>
                  </div>
                </div>

                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
                  <CheckCircle2 className="w-2.5 h-2.5" /> Ativo
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-xs">
                <div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Nicho / Vertical</span>
                  <span className="font-bold text-slate-300">{tenant.niche || "Geral"}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Segurança & RLS</span>
                  <span className="font-bold text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Isolado
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onConfigureModules(tenant.name)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-black text-white uppercase tracking-wider transition-all shadow-sm"
                >
                  <Settings className="w-3.5 h-3.5 text-blue-400" /> Módulos & Recursos
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
