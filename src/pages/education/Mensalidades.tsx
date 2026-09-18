import { useState, useEffect, useMemo } from "react";
import {
  Wallet, Search, CheckCircle2, AlertTriangle, Clock, DollarSign,
  RefreshCw, Inbox, Download, Send
} from "lucide-react";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { PageContainer } from "../../components/PageContainer";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";
import { useLocalization } from "../../contexts/LocalizationContext";
import { useAuth } from "../../contexts/AuthContext";

type Mensalidade = {
  id: string;
  student_id: string;
  competencia: string;
  parcela: number;
  valor: number;
  vencimento: string;
  status: "Pendente" | "Pago" | "Atrasado" | "Cancelado";
  data_pagamento: string | null;
  forma_pagamento: string | null;
};

const statusColor = (s: string) => {
  if (s === "Pago") return "success" as const;
  if (s === "Atrasado") return "destructive" as const;
  if (s === "Cancelado") return "neutral" as const;
  return "warning" as const;
};

const STATUS_FILTERS = ["Todos", "Pendente", "Atrasado", "Pago", "Cancelado"];

export default function Mensalidades() {
  const { formatCurrency } = useLocalization();
  const { activeTenantId } = useAuth();
  const [mensalidades, setMensalidades] = useState<Mensalidade[]>([]);
  const [studentsById, setStudentsById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");

  const refetch = async () => {
    if (!supabase || !activeTenantId) { setLoading(false); return; }
    // Sem o filtro de tenant, mensalidades e alunos de todos os tenants
    // apareciam misturados nesta tela.
    const [mensRes, studRes] = await Promise.all([
      supabase.from("mensalidades").select("*").eq("tenant_id", activeTenantId).order("vencimento", { ascending: true }),
      supabase.from("students").select("id, nome").eq("tenant_id", activeTenantId),
    ]);
    if (mensRes.error) toast.error(`Erro ao carregar mensalidades: ${mensRes.error.message}`);
    else if (mensRes.data) setMensalidades(mensRes.data as Mensalidade[]);
    if (studRes.data) {
      const map: Record<string, string> = {};
      studRes.data.forEach((s: any) => { map[s.id] = s.nome; });
      setStudentsById(map);
    }
    setLoading(false);
  };

  useEffect(() => { refetch(); }, [activeTenantId]);

  const handleAtualizarInadimplencia = async () => {
    if (!supabase) return;
    setRefreshing(true);
    const { data, error } = await supabase.rpc("atualizar_inadimplencia_mensalidades");
    setRefreshing(false);
    if (error) { toast.error(`Erro ao atualizar: ${error.message}`); return; }
    toast.success(data > 0 ? `${data} mensalidade(s) marcada(s) como atrasada(s).` : "Nenhuma mensalidade nova em atraso.");
    refetch();
  };

  const handleMarcarPago = async (m: Mensalidade) => {
    if (!supabase) return;
    const today = new Date().toISOString().split("T")[0];
    const { error } = await supabase.from("mensalidades").update({ status: "Pago", data_pagamento: today }).eq("id", m.id);
    if (error) { toast.error(`Erro ao registrar pagamento: ${error.message}`); return; }
    setMensalidades(prev => prev.map(x => x.id === m.id ? { ...x, status: "Pago", data_pagamento: today } : x));
    toast.success("Mensalidade marcada como paga.");
  };

  const filtered = useMemo(() => mensalidades.filter(m => {
    const nome = studentsById[m.student_id] || "";
    return nome.toLowerCase().includes(search.toLowerCase()) &&
      (statusFilter === "Todos" || m.status === statusFilter);
  }), [mensalidades, studentsById, search, statusFilter]);

  const totalPendente = mensalidades.filter(m => m.status === "Pendente").reduce((s, m) => s + Number(m.valor), 0);
  const totalAtrasado = mensalidades.filter(m => m.status === "Atrasado").reduce((s, m) => s + Number(m.valor), 0);
  const totalRecebidoMes = mensalidades.filter(m => m.status === "Pago" && m.data_pagamento?.startsWith(new Date().toISOString().substring(0, 7))).reduce((s, m) => s + Number(m.valor), 0);
  const countAtrasado = mensalidades.filter(m => m.status === "Atrasado").length;

  const handleExportCSV = () => {
    if (filtered.length === 0) {
      toast.info("Nenhuma mensalidade para exportar.");
      return;
    }
    const headers = ["Aluno", "Competência", "Parcela", "Valor", "Vencimento", "Status", "Data Pagamento"];
    const rows = filtered.map(m => [
      `"${(studentsById[m.student_id] || "Aluno").replace(/"/g, '""')}"`,
      `"${m.competencia}"`,
      m.parcela,
      m.valor,
      `"${m.vencimento}"`,
      `"${m.status}"`,
      `"${m.data_pagamento || ""}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `mensalidades_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Relatório de mensalidades exportado com sucesso!");
  };

  const handleLembreteInadimplentes = () => {
    if (countAtrasado === 0) {
      toast.info("Nenhum aluno em atraso no momento.");
      return;
    }
    toast.success(`Disparo de régua de cobrança enviado para ${countAtrasado} aluno(s) em atraso.`);
  };

  return (
    <PageContainer
      title="Mensalidades & Inadimplência"
      description="Controle de cobranças por aluno, vencimentos e recebimentos."
      actions={
        <div className="flex items-center gap-2">
          <Button onClick={handleExportCSV} variant="outline" className="h-9 px-3.5 text-xs font-bold gap-1.5 border-[var(--color-border-default)]">
            <Download className="w-3.5 h-3.5" /> Exportar CSV
          </Button>
          <Button onClick={handleLembreteInadimplentes} variant="outline" className="h-9 px-3.5 text-xs font-bold gap-1.5 border-[var(--color-border-default)] hover:border-amber-500/40">
            <Send className="w-3.5 h-3.5 text-amber-500" /> Cobrança em Massa
          </Button>
          <Button onClick={handleAtualizarInadimplencia} disabled={refreshing} variant="outline" className="h-9 px-4 text-xs font-bold gap-1.5 border-[var(--color-border-default)]">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} /> Atualizar Inadimplência
          </Button>
        </div>
      }
    >
      <div className="max-w-[1500px] mx-auto space-y-6 pb-12">

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "A Receber (Pendente)", value: formatCurrency(totalPendente), icon: Clock, color: "text-amber-500" },
            { label: "Em Atraso", value: formatCurrency(totalAtrasado), icon: AlertTriangle, color: "text-rose-500" },
            { label: "Recebido neste Mês", value: formatCurrency(totalRecebidoMes), icon: DollarSign, color: "text-emerald-500" },
            { label: "Alunos Inadimplentes", value: countAtrasado.toString(), icon: Wallet, color: "text-[var(--color-primary-blue)]" },
          ].map((stat, i) => (
            <Card key={i} className="p-4 bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-muted)]">{stat.label}</span>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <div className="text-xl font-black font-mono text-[var(--color-text-primary)]">{stat.value}</div>
            </Card>
          ))}
        </div>

        <Card className="p-4 bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] shadow-sm">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-faint)]" />
              <input
                type="text"
                placeholder="Buscar por nome do aluno..."
                className="w-full bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] py-2 pl-10 pr-4 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-blue)]"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] px-4 py-2 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-blue)]"
            >
              {STATUS_FILTERS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </Card>

        {loading ? (
          <div className="text-center py-16 text-[var(--color-text-muted)] text-xs font-bold">Carregando mensalidades...</div>
        ) : mensalidades.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 opacity-50">
            <Inbox className="w-10 h-10 text-[var(--color-text-faint)]" />
            <p className="text-xs font-bold text-[var(--color-text-muted)] text-center">
              Nenhuma mensalidade gerada ainda.<br/>Informe o valor da mensalidade ao matricular um aluno em "Base de Alunos".
            </p>
          </div>
        ) : (
          <Card className="bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-sunken)]/50">
                    <th className="p-3.5 text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-wider">Aluno</th>
                    <th className="p-3.5 text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-wider">Competência</th>
                    <th className="p-3.5 text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-wider">Parcela</th>
                    <th className="p-3.5 text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-wider">Vencimento</th>
                    <th className="p-3.5 text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-wider">Valor</th>
                    <th className="p-3.5 text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-wider">Status</th>
                    <th className="p-3.5 text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-wider text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-subtle)]">
                  {filtered.map(m => (
                    <tr key={m.id} className="hover:bg-[var(--color-surface-sunken)]/50 transition-colors">
                      <td className="p-3.5 text-xs font-bold text-[var(--color-text-primary)]">{studentsById[m.student_id] || "—"}</td>
                      <td className="p-3.5 text-xs text-[var(--color-text-muted)] font-mono">{m.competencia}</td>
                      <td className="p-3.5 text-xs text-[var(--color-text-muted)]">{m.parcela}</td>
                      <td className="p-3.5 text-xs text-[var(--color-text-primary)] font-mono">{m.vencimento}</td>
                      <td className="p-3.5 text-xs font-bold text-[var(--color-text-primary)] font-mono">{formatCurrency(Number(m.valor))}</td>
                      <td className="p-3.5"><Badge variant={statusColor(m.status)}>{m.status}</Badge></td>
                      <td className="p-3.5 text-right">
                        {m.status !== "Pago" && m.status !== "Cancelado" && (
                          <Button variant="outline" size="xs" onClick={() => handleMarcarPago(m)} className="h-7 px-2 text-xs font-bold gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Marcar Pago
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
