import { useState, useEffect } from "react";
import { PageContainer } from "../../components/PageContainer";
import { Button } from "../../components/ui/button";
import {
  Stethoscope, Plus, Search, Calendar, Phone,
  Mail, Award, Clock, Trash2, X, Download
} from "lucide-react";
import { Card } from "../../components/ui/card";
import { Modal } from "../../components/ui/modal";
import { toast } from "sonner";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import { confirmDialog } from "../../components/ui/confirm-dialog";

interface ProfissionalItem {
  id: string;
  nome: string;
  crm: string;
  especialidade: string;
  telefone: string;
  email: string;
  atendimentosMes: number;
  status: "Ativo" | "Férias / Licença" | "Inativo";
}

function rowToProfissional(row: any): ProfissionalItem {
  return {
    id: row.id,
    nome: row.nome,
    crm: row.crm || "",
    especialidade: row.especialidade || "",
    telefone: row.telefone || "",
    email: row.email || "",
    atendimentosMes: row.atendimentos_mes ?? 0,
    status: row.status,
  };
}

export default function ProfissionaisClinica() {
  const { activeTenantId } = useAuth();

  const [profissionais, setProfissionais] = useState<ProfissionalItem[]>([]);

  useEffect(() => {
    if (!supabase || !activeTenantId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("clinica_profissionais")
        .select("*")
        .eq("tenant_id", activeTenantId)
        .order("created_at", { ascending: false });
      if (!cancelled && !error && data) {
        setProfissionais(data.map(rowToProfissional));
      }
    })();
    return () => { cancelled = true; };
  }, [activeTenantId]);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [modalOpen, setModalOpen] = useState(false);

  // Form state
  const [nome, setNome] = useState("");
  const [crm, setCrm] = useState("");
  const [especialidade, setEspecialidade] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<ProfissionalItem["status"]>("Ativo");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !crm.trim() || !especialidade.trim()) {
      toast.error("Preencha os campos obrigatórios (Nome, CRM/CRO e Especialidade).");
      return;
    }
    if (!supabase || !activeTenantId) {
      toast.error("Sem conexão com o banco de dados.");
      return;
    }

    const { data, error } = await supabase
      .from("clinica_profissionais")
      .insert({
        tenant_id: activeTenantId,
        nome: nome.trim(),
        crm: crm.trim(),
        especialidade: especialidade.trim(),
        telefone: telefone.trim(),
        email: email.trim(),
        atendimentos_mes: 0,
        status,
      })
      .select()
      .maybeSingle();

    if (error || !data) {
      toast.error("Erro ao cadastrar profissional.");
      return;
    }

    setProfissionais(prev => [rowToProfissional(data), ...prev]);
    toast.success("Profissional cadastrado com sucesso!");
    setModalOpen(false);

    setNome("");
    setCrm("");
    setEspecialidade("");
    setTelefone("");
    setEmail("");
  };

  const handleDelete = async (id: string) => {
    if (!supabase) return;
    const profissional = profissionais.find(d => d.id === id);
    if (!(await confirmDialog({
      title: "Excluir profissional",
      description: `Excluir "${profissional?.nome || "este profissional"}" do corpo clínico? Essa ação não pode ser desfeita.`,
    }))) return;
    const { error } = await supabase.from("clinica_profissionais").delete().eq("id", id);
    if (error) { toast.error("Erro ao remover profissional."); return; }
    setProfissionais(prev => prev.filter(d => d.id !== id));
    toast.info("Profissional removido.");
  };

  const handleUpdateStatus = async (id: string, newStatus: ProfissionalItem["status"]) => {
    if (!supabase) return;
    const { error } = await supabase.from("clinica_profissionais").update({ status: newStatus }).eq("id", id);
    if (error) { toast.error("Erro ao atualizar status."); return; }
    const nome = profissionais.find(p => p.id === id)?.nome;
    setProfissionais(prev => prev.map(d => d.id === id ? { ...d, status: newStatus } : d));
    toast.success(`Status de ${nome}: ${newStatus}`);
  };

  const handleExportCSV = () => {
    if (profissionais.length === 0) {
      toast.error("Nenhum profissional para exportar.");
      return;
    }
    const headers = ["ID", "Nome", "CRM_CRO", "Especialidade", "Telefone", "Email", "Atendimentos_Mes", "Status"];
    const rows = profissionais.map(p => [
      p.id,
      `"${p.nome.replace(/"/g, '""')}"`,
      `"${p.crm.replace(/"/g, '""')}"`,
      `"${p.especialidade.replace(/"/g, '""')}"`,
      p.telefone,
      p.email,
      p.atendimentosMes,
      p.status,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `profissionais_clinica_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Corpo clínico exportado com sucesso!");
  };

  const filtered = profissionais.filter(d => {
    const matchSearch = (
      d.nome.toLowerCase().includes(search.toLowerCase()) ||
      d.crm.toLowerCase().includes(search.toLowerCase()) ||
      d.especialidade.toLowerCase().includes(search.toLowerCase())
    );
    const matchStatus = filterStatus === "Todos" || d.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <PageContainer
      title="Corpo Clínico & Profissionais"
      description="Gerenciamento de médicos, dentistas, terapeutas, especialidades e escalas de atendimento."
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
            <Plus className="w-3.5 h-3.5" /> Novo Profissional
          </Button>
        </div>
      }
    >
      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="p-4 bg-[var(--color-surface-elevated)]/40 border border-[var(--color-border-subtle)] shadow-xs">
          <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block mb-1">Especialistas Cadastrados</span>
          <div className="text-2xl font-black text-[var(--color-text-primary)]">{profissionais.length}</div>
        </Card>
        <Card className="p-4 bg-[var(--color-surface-elevated)]/40 border border-[var(--color-border-subtle)] shadow-xs">
          <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block mb-1">Profissionais Ativos Hoje</span>
          <div className="text-2xl font-black text-emerald-500">
            {profissionais.filter(p => p.status === "Ativo").length}
          </div>
        </Card>
        <Card className="p-4 bg-[var(--color-surface-elevated)]/40 border border-[var(--color-border-subtle)] shadow-xs">
          <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block mb-1">Consultas este Mês</span>
          <div className="text-2xl font-black text-blue-500 font-mono">
            {profissionais.reduce((s, p) => s + p.atendimentosMes, 0)}
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Buscar por nome, CRM/CRO ou especialidade..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-[var(--color-surface)] border border-[var(--color-border-default)] rounded-xl text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-blue)]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {["Todos", "Ativo", "Férias / Licença", "Inativo"].map(st => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-all shrink-0 ${
                filterStatus === st
                  ? "bg-[var(--color-primary-blue)] text-white"
                  : "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.map(d => (
          <div key={d.id} className="p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border-default)] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0 border border-blue-500/20">
                <Stethoscope className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-xs font-bold text-[var(--color-text-primary)]">{d.nome}</h4>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[var(--color-surface-sunken)] text-[var(--color-primary-blue)] border border-[var(--color-border-subtle)]">
                    {d.crm}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--color-text-muted)]">
                  <span>Especialidade: <strong className="text-[var(--color-text-primary)]">{d.especialidade}</strong></span>
                  <span>•</span>
                  <span>{d.telefone}</span>
                  <span>•</span>
                  <span>Consultas no Mês: <strong className="text-emerald-500 font-bold">{d.atendimentosMes}</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <select
                value={d.status}
                onChange={e => handleUpdateStatus(d.id, e.target.value as any)}
                className="text-[10px] font-bold uppercase px-2.5 py-1.5 rounded-xl bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] focus:outline-none"
              >
                <option value="Ativo">Ativo</option>
                <option value="Férias / Licença">Férias / Licença</option>
                <option value="Inativo">Inativo</option>
              </select>

              <Button size="sm" variant="ghost" onClick={() => handleDelete(d.id)} className="h-8 w-8 p-0 text-red-500 hover:bg-red-500/10 rounded-xl">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="p-8 text-center text-xs text-[var(--color-text-muted)] bg-[var(--color-surface)] border border-[var(--color-border-default)] rounded-2xl">
            Nenhum profissional encontrado.
          </div>
        )}
      </div>

      {/* Standardized Modal: Novo Profissional */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        maxWidth="max-w-md"
        title={
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-blue)]/10 text-[var(--color-primary-blue)] flex items-center justify-center shrink-0">
              <Stethoscope className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--color-text-primary)]">Cadastrar Novo Profissional Clínico</h3>
              <p className="text-xs text-[var(--color-text-muted)]">Adicione médicos, cirurgiões ou especialistas à equipe</p>
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
              form="form-profissional"
              className="h-9 px-4 text-xs font-semibold bg-[var(--color-primary-blue)] hover:bg-[var(--color-primary-blue)]/90 text-white"
            >
              Salvar Profissional
            </Button>
          </div>
        }
      >
        <form id="form-profissional" onSubmit={handleCreate} className="space-y-3.5 py-1">
          <div>
            <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1.5">Nome Completo</label>
            <input
              type="text"
              required
              placeholder="Ex: Dra. Juliana Fernandes"
              value={nome}
              onChange={e => setNome(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] rounded-xl text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-blue)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1.5">Registro (CRM / CRO)</label>
              <input
                type="text"
                required
                placeholder="Ex: CRM/SP 199.300"
                value={crm}
                onChange={e => setCrm(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] rounded-xl text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-blue)]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1.5">Especialidade</label>
              <input
                type="text"
                required
                placeholder="Ex: Cardiologia"
                value={especialidade}
                onChange={e => setEspecialidade(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] rounded-xl text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-blue)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1.5">Telefone / WhatsApp</label>
              <input
                type="text"
                placeholder="(11) 90000-0000"
                value={telefone}
                onChange={e => setTelefone(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] rounded-xl text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-blue)]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1.5">E-mail Profissional</label>
              <input
                type="email"
                placeholder="medico@clinica.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] rounded-xl text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-blue)]"
              />
            </div>
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
}
