import { useState, useEffect } from "react";
import { PageContainer } from "../../components/PageContainer";
import { Button } from "../../components/ui/button";
import {
  Activity, Plus, Search, DollarSign, Clock,
  CheckCircle2, ShieldAlert, Trash2, X, Download
} from "lucide-react";
import { Card } from "../../components/ui/card";
import { Modal } from "../../components/ui/modal";
import { toast } from "sonner";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import { confirmDialog } from "../../components/ui/confirm-dialog";

interface ServicoClinicoItem {
  id: string;
  nome: string;
  especialidade: string;
  duracao: string;
  valorParticular: number;
  convenios: string;
}

function rowToServico(row: any): ServicoClinicoItem {
  return {
    id: row.id,
    nome: row.nome,
    especialidade: row.especialidade || "",
    duracao: row.duracao || "",
    valorParticular: Number(row.valor_particular) || 0,
    convenios: row.convenios || "",
  };
}

export default function ServicosClinica() {
  const { activeTenantId } = useAuth();

  const [servicos, setServicos] = useState<ServicoClinicoItem[]>([]);

  useEffect(() => {
    if (!supabase || !activeTenantId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("clinica_servicos")
        .select("*")
        .eq("tenant_id", activeTenantId)
        .order("created_at", { ascending: false });
      if (!cancelled && !error && data) {
        setServicos(data.map(rowToServico));
      }
    })();
    return () => { cancelled = true; };
  }, [activeTenantId]);

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  // Form state
  const [nome, setNome] = useState("");
  const [especialidade, setEspecialidade] = useState("");
  const [duracao, setDuracao] = useState("30 min");
  const [valorParticular, setValorParticular] = useState("");
  const [convenios, setConvenios] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !valorParticular) {
      toast.error("Informe o nome e o valor do procedimento.");
      return;
    }
    if (!supabase || !activeTenantId) {
      toast.error("Sem conexão com o banco de dados.");
      return;
    }

    const val = parseFloat(valorParticular.replace(/[^\d.]/g, "").replace(",", ".")) || 0;

    const { data, error } = await supabase
      .from("clinica_servicos")
      .insert({
        tenant_id: activeTenantId,
        nome: nome.trim(),
        especialidade: especialidade.trim() || "Clínica Geral",
        duracao: duracao.trim() || "30 min",
        valor_particular: val,
        convenios: convenios.trim() || "Particular",
      })
      .select()
      .maybeSingle();

    if (error || !data) {
      toast.error("Erro ao cadastrar procedimento.");
      return;
    }

    setServicos(prev => [rowToServico(data), ...prev]);
    toast.success("Procedimento cadastrado com sucesso!");
    setModalOpen(false);

    setNome("");
    setEspecialidade("");
    setDuracao("30 min");
    setValorParticular("");
    setConvenios("");
  };

  const handleDelete = async (id: string) => {
    if (!supabase) return;
    const servico = servicos.find(s => s.id === id);
    if (!(await confirmDialog({
      title: "Excluir procedimento",
      description: `Excluir o procedimento "${servico?.nome || "selecionado"}"? Essa ação não pode ser desfeita.`,
    }))) return;
    const { error } = await supabase.from("clinica_servicos").delete().eq("id", id);
    if (error) { toast.error("Erro ao remover procedimento."); return; }
    setServicos(prev => prev.filter(s => s.id !== id));
    toast.info("Procedimento removido da tabela.");
  };

  const handleExportCSV = () => {
    if (servicos.length === 0) {
      toast.error("Nenhum procedimento para exportar.");
      return;
    }
    const headers = ["ID", "Nome_Procedimento", "Especialidade", "Duracao", "Valor_Particular_BRL", "Convenios_Aceitos"];
    const rows = servicos.map(s => [
      s.id,
      `"${s.nome.replace(/"/g, '""')}"`,
      `"${s.especialidade.replace(/"/g, '""')}"`,
      `"${s.duracao.replace(/"/g, '""')}"`,
      s.valorParticular.toFixed(2),
      `"${s.convenios.replace(/"/g, '""')}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `tabela_procedimentos_clinicos_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Tabela de procedimentos exportada com sucesso!");
  };

  const filtered = servicos.filter(s => (
    s.nome.toLowerCase().includes(search.toLowerCase()) ||
    s.especialidade.toLowerCase().includes(search.toLowerCase()) ||
    s.convenios.toLowerCase().includes(search.toLowerCase())
  ));

  return (
    <PageContainer
      title="Tabela de Procedimentos & Exames"
      description="Catálogo de consultas, terapias, exames de diagnóstico e valores particulares e convênios."
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleExportCSV}
            className="h-9 px-3.5 text-xs font-semibold gap-1.5 border-[var(--color-border-subtle)] bg-[var(--color-surface-sunken)] hover:bg-[var(--color-surface-elevated)]"
          >
            <Download className="w-3.5 h-3.5 text-[var(--color-text-muted)]" /> Exportar CSV
          </Button>
          <Button onClick={() => setModalOpen(true)} className="h-9 px-4 text-xs font-bold gap-1.5 shadow-xs bg-[var(--color-primary-blue)] hover:bg-[var(--color-primary-blue)]/90 text-white">
            <Plus className="w-3.5 h-3.5" /> Novo Procedimento
          </Button>
        </div>
      }
    >
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="p-4 bg-[var(--color-surface-elevated)]/40 border border-[var(--color-border-subtle)] shadow-xs">
          <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block mb-1">Procedimentos Ativos</span>
          <div className="text-2xl font-black text-[var(--color-text-primary)]">{servicos.length}</div>
        </Card>
        <Card className="p-4 bg-[var(--color-surface-elevated)]/40 border border-[var(--color-border-subtle)] shadow-xs">
          <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block mb-1">Ticket Médio de Procedimentos</span>
          <div className="text-2xl font-black text-emerald-500 font-mono">
            R$ {(servicos.length > 0 ? servicos.reduce((s, x) => s + x.valorParticular, 0) / servicos.length : 0).toFixed(2)}
          </div>
        </Card>
        <Card className="p-4 bg-[var(--color-surface-elevated)]/40 border border-[var(--color-border-subtle)] shadow-xs">
          <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block mb-1">Convênios Credenciados</span>
          <div className="text-2xl font-black text-blue-500">
            {new Set(servicos.flatMap(s => s.convenios.split(",").map(c => c.trim()).filter(Boolean))).size} operadoras
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Buscar por procedimento ou especialidade..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-[var(--color-surface)] border border-[var(--color-border-default)] rounded-xl text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-blue)]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border-default)] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--color-surface-sunken)] border-b border-[var(--color-border-subtle)] text-[var(--color-text-muted)] font-semibold">
              <tr>
                <th className="px-4 py-3">Procedimento / Consulta</th>
                <th className="px-4 py-3">Especialidade</th>
                <th className="px-4 py-3">Tempo Estimado</th>
                <th className="px-4 py-3">Convênios Aceitos</th>
                <th className="px-4 py-3 text-right">Valor Particular</th>
                <th className="px-4 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-[var(--color-surface-sunken)]/40 transition-colors">
                  <td className="px-4 py-3.5 font-bold text-[var(--color-text-primary)]">{s.nome}</td>
                  <td className="px-4 py-3.5 text-[var(--color-text-muted)]">{s.especialidade}</td>
                  <td className="px-4 py-3.5 font-mono text-[var(--color-text-muted)]">{s.duracao}</td>
                  <td className="px-4 py-3.5 text-xs text-[var(--color-text-muted)]">{s.convenios}</td>
                  <td className="px-4 py-3.5 text-right font-bold text-emerald-500 font-mono">
                    R$ {s.valorParticular.toFixed(2)}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(s.id)} className="h-7 w-7 p-0 text-red-500 hover:bg-red-500/10 rounded-lg">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="p-8 text-center text-xs text-[var(--color-text-muted)]">
              Nenhum procedimento encontrado.
            </div>
          )}
        </div>
      </div>

      {/* Standardized Modal: Novo Procedimento */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        maxWidth="max-w-md"
        title={
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-blue)]/10 text-[var(--color-primary-blue)] flex items-center justify-center shrink-0">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--color-text-primary)]">Novo Procedimento / Exame</h3>
              <p className="text-xs text-[var(--color-text-muted)]">Defina a precificação particular e convênios atendidos</p>
            </div>
          </div>
        }
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(false)}
              className="h-9 px-4 text-xs font-semibold"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="form-servico-clinico"
              className="h-9 px-4 text-xs font-semibold bg-[var(--color-primary-blue)] hover:bg-[var(--color-primary-blue)]/90 text-white"
            >
              Adicionar Procedimento
            </Button>
          </div>
        }
      >
        <form id="form-servico-clinico" onSubmit={handleCreate} className="space-y-3.5 py-1">
          <div>
            <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1.5">Nome do Procedimento</label>
            <input
              type="text"
              required
              placeholder="Ex: Consulta Cardiológica + Teste Ergométrico"
              value={nome}
              onChange={e => setNome(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] rounded-xl text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-blue)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1.5">Especialidade</label>
              <input
                type="text"
                placeholder="Ex: Cardiologia"
                value={especialidade}
                onChange={e => setEspecialidade(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] rounded-xl text-[var(--color-text-primary)] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1.5">Duração Média</label>
              <input
                type="text"
                placeholder="Ex: 40 min"
                value={duracao}
                onChange={e => setDuracao(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] rounded-xl text-[var(--color-text-primary)] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1.5">Valor Particular (R$)</label>
              <input
                type="text"
                required
                placeholder="Ex: 350.00"
                value={valorParticular}
                onChange={e => setValorParticular(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] rounded-xl text-[var(--color-text-primary)] focus:outline-none font-mono font-bold"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1.5">Convênios Aceitos</label>
              <input
                type="text"
                placeholder="Ex: Unimed, Amil, Bradesco"
                value={convenios}
                onChange={e => setConvenios(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] rounded-xl text-[var(--color-text-primary)] focus:outline-none"
              />
            </div>
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
}
