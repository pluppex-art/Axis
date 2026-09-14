import { useEffect, useState } from "react";
import { Building2, Users, DollarSign, FileText, Handshake, Inbox } from "lucide-react";
import { PageContainer } from "../../components/PageContainer";
import { Card } from "../../components/ui/card";
import { useAuth } from "../../contexts/AuthContext";
import { useLocalization } from "../../contexts/LocalizationContext";
import { supabase } from "../../lib/supabase";

interface PlatformMetrics {
  total_tenants: number;
  total_leads: number;
  total_clientes: number;
  total_propostas: number;
  total_receita: number;
}

interface AttributedTenant {
  id: string;
  name: string;
  niche: string;
  status: string | null;
}

export default function PartnersOverview() {
  const { user } = useAuth();
  const { formatCurrency: currency } = useLocalization();
  const hasAccess = !!user?.isMaster || !!user?.partnerId;

  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [tenants, setTenants] = useState<AttributedTenant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase || !hasAccess) {
      setLoading(false);
      return;
    }

    let active = true;
    (async () => {
      // platform_metrics_overview() é SECURITY DEFINER e só devolve números
      // somados (nunca linha a linha) — tenant_partners é filtrado pela RLS
      // para só trazer os clientes atribuídos ao parceiro do usuário logado
      // (ou todos, se for super admin).
      const [{ data: metricsData, error: metricsError }, { data: tpData, error: tpError }] = await Promise.all([
        supabase.rpc("platform_metrics_overview"),
        supabase.from("tenant_partners").select("tenant_id, tenants (id, name, niche, status)"),
      ]);

      if (!active) return;

      if (metricsError) {
        console.error("[PartnersOverview] Erro ao carregar métricas agregadas:", metricsError.message);
      } else if (metricsData && metricsData[0]) {
        setMetrics(metricsData[0]);
      }

      if (tpError) {
        console.error("[PartnersOverview] Erro ao carregar tenants atribuídos:", tpError.message);
      } else if (tpData) {
        const list = tpData
          .map((row: any) => (Array.isArray(row.tenants) ? row.tenants[0] : row.tenants))
          .filter(Boolean);
        setTenants(list);
      }

      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [hasAccess]);

  if (!hasAccess) {
    return (
      <PageContainer
        title="Visão de Parceiros"
        description="Acesso restrito a organizações parceiras da plataforma S.P.Y.."
      >
        <Card className="p-10 flex flex-col items-center justify-center gap-4 opacity-60">
          <Handshake className="w-12 h-12 text-slate-500" />
          <span className="text-xs font-black uppercase tracking-widest text-slate-500">Acesso restrito</span>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Visão de Parceiros"
      description="Clientes atribuídos à sua organização (acesso operacional completo) e números agregados de toda a plataforma S.P.Y.."
    >
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-3">
            Plataforma S.P.Y. — agregado de todos os tenants
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="p-5 border-[#06B6D4]/20 bg-[var(--color-surface-elevated)]/80 backdrop-blur-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                <Building2 className="w-12 h-12 text-[#06B6D4]" />
              </div>
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest block mb-2">Tenants na Plataforma</span>
              <h3 className="text-3xl font-extrabold text-white">{loading ? "…" : metrics?.total_tenants ?? 0}</h3>
            </Card>

            <Card className="p-5 border-[#06B6D4]/20 bg-[var(--color-surface-elevated)]/80 backdrop-blur-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                <Users className="w-12 h-12 text-[#06B6D4]" />
              </div>
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest block mb-2">Leads Gerados</span>
              <h3 className="text-3xl font-extrabold text-white">{loading ? "…" : metrics?.total_leads ?? 0}</h3>
            </Card>

            <Card className="p-5 border-[#06B6D4]/20 bg-[var(--color-surface-elevated)]/80 backdrop-blur-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                <Building2 className="w-12 h-12 text-[#06B6D4]" />
              </div>
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest block mb-2">Clientes Cadastrados</span>
              <h3 className="text-3xl font-extrabold text-white">{loading ? "…" : metrics?.total_clientes ?? 0}</h3>
            </Card>

            <Card className="p-5 border-[#06B6D4]/20 bg-[var(--color-surface-elevated)]/80 backdrop-blur-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                <FileText className="w-12 h-12 text-[#06B6D4]" />
              </div>
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest block mb-2">Propostas Emitidas</span>
              <h3 className="text-3xl font-extrabold text-white">{loading ? "…" : metrics?.total_propostas ?? 0}</h3>
            </Card>

            <Card className="p-5 border-[#06B6D4]/20 bg-[var(--color-surface-elevated)]/80 backdrop-blur-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                <DollarSign className="w-12 h-12 text-[#06B6D4]" />
              </div>
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest block mb-2">Receita Total (a receber)</span>
              <h3 className="text-3xl font-extrabold text-white">{loading ? "…" : currency(metrics?.total_receita ?? 0)}</h3>
            </Card>
          </div>
        </div>

        <Card className="bg-[var(--color-surface-elevated)]/80 backdrop-blur-xl border border-white/10 overflow-hidden">
          <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[var(--color-surface)]/50">
            <h3 className="font-semibold flex items-center gap-2">
              <Handshake className="w-4 h-4 text-[#06B6D4]" /> Clientes atribuídos à sua organização
            </h3>
          </div>
          {tenants.length === 0 ? (
            <div className="p-10 flex flex-col items-center justify-center gap-4 opacity-40">
              <Inbox className="w-12 h-12 text-slate-500" />
              <span className="text-xs font-black uppercase tracking-widest text-slate-500">
                {loading ? "Carregando..." : "Nenhum tenant atribuído ainda"}
              </span>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {tenants.map((t) => (
                <div key={t.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white font-medium">{t.name}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest">{t.niche}</p>
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${
                      t.status === "Active" ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-500/10 text-slate-400"
                    }`}
                  >
                    {t.status ?? "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}
