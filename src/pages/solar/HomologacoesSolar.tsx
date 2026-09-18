import { useState, useEffect } from "react";
import { PageContainer } from "../../components/PageContainer";
import { Button } from "../../components/ui/button";
import {
  FileCheck, Clock, CheckCircle2, AlertTriangle, FileText,
  Building2, ExternalLink, Plus, Search, Trash2, X, Download
} from "lucide-react";
import { Card } from "../../components/ui/card";
import { Modal } from "../../components/ui/modal";
import { toast } from "sonner";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import { confirmDialog } from "../../components/ui/confirm-dialog";

interface HomologacaoItem {
  id: string;
  cliente: string;
  concessionaria: string;
  protocolo: string;
  etapa: "Solicitação de Acesso" | "Parecer Emitido" | "Vistoria da Distribuidora" | "Troca do Medidor" | "Homologado 100%";
  prazoConcessionaria: string;
  status: "Em Análise Técnica" | "Aprovado / Aguardando Troca de Medidor" | "Agendado com Concessionária" | "Concluído";
  data: string;
}

function rowToHomologacao(row: any): HomologacaoItem {
  return {
    id: row.id,
    cliente: row.cliente || "",
    concessionaria: row.concessionaria || "",
    protocolo: row.protocolo || "",
    etapa: row.etapa,
    prazoConcessionaria: row.prazo_concessionaria || "",
    status: row.status,
    data: row.data ? new Date(row.data + "T00:00:00").toLocaleDateString("pt-BR") : "",
  };
}

export default function HomologacoesSolar() {
  const { activeTenantId } = useAuth();

  const [protocolos, setProtocolos] = useState<HomologacaoItem[]>([]);

  useEffect(() => {
    if (!supabase || !activeTenantId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("solar_homologacoes")
        .select("*")
        .eq("tenant_id", activeTenantId)
        .order("created_at", { ascending: false });
      if (!cancelled && !error && data) {
        setProtocolos(data.map(rowToHomologacao));
      }
    })();
    return () => { cancelled = true; };
  }, [activeTenantId]);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [modalOpen, setModalOpen] = useState(false);

  // Form state
  const [cliente, setCliente] = useState("");
  const [concessionaria, setConcessionaria] = useState("CPFL Paulista");
  const [protocolo, setProtocolo] = useState("");
  const [etapa, setEtapa] = useState<HomologacaoItem["etapa"]>("Solicitação de Acesso");
  const [prazoConcessionaria, setPrazoConcessionaria] = useState("");
  const [status, setStatus] = useState<HomologacaoItem["status"]>("Em Análise Técnica");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliente.trim() || !protocolo.trim()) {
      toast.error("Preencha o cliente e o número do protocolo.");
      return;
    }
    if (!supabase || !activeTenantId) {
      toast.error("Sem conexão com o banco de dados.");
      return;
    }

    const { data, error } = await supabase
      .from("solar_homologacoes")
      .insert({
        tenant_id: activeTenantId,
        cliente: cliente.trim(),
        concessionaria,
        protocolo: protocolo.trim(),
        etapa,
        prazo_concessionaria: prazoConcessionaria || "Em análise regulatória",
        status,
        data: new Date().toISOString().split("T")[0],
      })
      .select()
      .maybeSingle();

    if (error || !data) {
      toast.error("Erro ao registrar protocolo de homologação.");
      return;
    }

    setProtocolos(prev => [rowToHomologacao(data), ...prev]);
    toast.success("Protocolo de homologação registrado com sucesso!");
    setModalOpen(false);

    setCliente("");
    setProtocolo("");
    setPrazoConcessionaria("");
  };

  const handleDelete = async (item: HomologacaoItem) => {
    if (!supabase) return;
    if (!(await confirmDialog({
      title: "Excluir protocolo",
      description: `Excluir o protocolo "${item.protocolo}" de "${item.cliente}"? Essa ação não pode ser desfeita.`,
    }))) return;
    const { error } = await supabase.from("solar_homologacoes").delete().eq("id", item.id);
    if (error) { toast.error("Erro ao remover protocolo."); return; }
    setProtocolos(prev => prev.filter(p => p.id !== item.id));
    toast.info("Protocolo removido.");
  };

  const handleUpdateStatus = async (id: string, newStatus: HomologacaoItem["status"]) => {
    if (!supabase) return;
    const { error } = await supabase.from("solar_homologacoes").update({ status: newStatus }).eq("id", id);
    if (error) { toast.error("Erro ao atualizar status."); return; }
    setProtocolos(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
    toast.success(`Status da homologação: ${newStatus}`);
  };

  const handleExportCSV = () => {
    if (protocolos.length === 0) {
      toast.error("Nenhum protocolo para exportar.");
      return;
    }
    const headers = ["ID", "Cliente", "Concessionaria", "Protocolo", "Etapa", "Prazo_Concessionaria", "Status", "Data_Entrada"];
    const rows = protocolos.map(p => [
      p.id,
      `"${p.cliente.replace(/"/g, '""')}"`,
      `"${p.concessionaria.replace(/"/g, '""')}"`,
      `"${p.protocolo.replace(/"/g, '""')}"`,
      `"${p.etapa.replace(/"/g, '""')}"`,
      `"${p.prazoConcessionaria.replace(/"/g, '""')}"`,
      p.status,
      p.data,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `homologacoes_solares_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Relatório de homologações exportado com sucesso!");
  };

  const filtered = protocolos.filter(p => {
    const matchSearch = (
      p.cliente.toLowerCase().includes(search.toLowerCase()) ||
      p.concessionaria.toLowerCase().includes(search.toLowerCase()) ||
      p.protocolo.toLowerCase().includes(search.toLowerCase())
    );
    const matchStatus = filterStatus === "Todos" || p.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <PageContainer
      title="Homologações & Parecer de Acesso"
      description="Tramitação regulatória junto às distribuidoras de energia conforme Resolução Normativa ANEEL."
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleExportCSV}
            className="h-9 px-3.5 text-xs font-semibold gap-1.5 border-[var(--color-border-subtle)] bg-[var(--color-surface-sunken)] hover:bg-[var(--color-surface-elevated)]"
          >
            <Download className="w-3.5 h-3.5 text-[var(--color-text-muted)]" /> Exportar CSV
          </Button>
          <Button onClick={() => setModalOpen(true)} className="h-9 px-4 text-xs font-bold gap-1.5 shadow-xs bg-amber-500 hover:bg-amber-600 text-white">
            <Plus className="w-3.5 h-3.5" /> Novo Protocolo
          </Button>
        </div>
      }
    >
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="p-4 bg-[var(--color-surface-elevated)]/40 border border-[var(--color-border-subtle)] shadow-xs">
          <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block mb-1">Processos em Tramitação</span>
          <div className="text-2xl font-black text-[var(--color-text-primary)]">{protocolos.length}</div>
        </Card>
        <Card className="p-4 bg-[var(--color-surface-elevated)]/40 border border-[var(--color-border-subtle)] shadow-xs">
          <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block mb-1">Pareceres Emitidos / Aprovados</span>
          <div className="text-2xl font-black text-emerald-500">
            {protocolos.filter(p => p.status.includes("Aprovado") || p.status === "Concluído").length}
          </div>
        </Card>
        <Card className="p-4 bg-[var(--color-surface-elevated)]/40 border border-[var(--color-border-subtle)] shadow-xs">
          <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block mb-1">Em Análise Técnica</span>
          <div className="text-2xl font-black text-blue-500">
            {protocolos.filter(p => p.status === "Em Análise Técnica").length}
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Buscar por cliente, concessionária ou protocolo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-[var(--color-surface)] border border-[var(--color-border-default)] rounded-xl text-[var(--color-text-primary)] focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {["Todos", "Em Análise Técnica", "Aprovado / Aguardando Troca de Medidor", "Agendado com Concessionária", "Concluído"].map(st => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-all shrink-0 ${
                filterStatus === st
                  ? "bg-amber-500 text-white"
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
        {filtered.map(p => (
          <div key={p.id} className="p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border-default)] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[var(--color-surface-sunken)] text-amber-500 border border-[var(--color-border-subtle)]">
                  {p.protocolo}
                </span>
                <h4 className="text-xs font-bold text-[var(--color-text-primary)]">{p.cliente}</h4>
                <span className="text-[10px] text-[var(--color-text-muted)]">• {p.concessionaria}</span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--color-text-muted)]">
                <span>Etapa: <strong className="text-[var(--color-text-primary)]">{p.etapa}</strong></span>
                <span>•</span>
                <span>Prazo Regulatório: <strong className="text-amber-500">{p.prazoConcessionaria}</strong></span>
                <span>•</span>
                <span>Entrada: {p.data}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <select
                value={p.status}
                onChange={e => handleUpdateStatus(p.id, e.target.value as any)}
                className="text-[10px] font-bold uppercase px-2.5 py-1.5 rounded-xl bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] focus:outline-none"
              >
                <option value="Em Análise Técnica">Em Análise Técnica</option>
                <option value="Aprovado / Aguardando Troca de Medidor">Aprovado / Aguardando Medidor</option>
                <option value="Agendado com Concessionária">Agendado Concessionária</option>
                <option value="Concluído">Concluído</option>
              </select>

              <Button size="sm" variant="ghost" onClick={() => handleDelete(p)} className="h-8 w-8 p-0 text-red-500 hover:bg-red-500/10 rounded-xl">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="p-8 text-center text-xs text-[var(--color-text-muted)] bg-[var(--color-surface)] border border-[var(--color-border-default)] rounded-2xl">
            Nenhum protocolo de homologação encontrado para este filtro.
          </div>
        )}
      </div>

      {/* Standardized Modal: Novo Protocolo */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        maxWidth="max-w-md"
        title={
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
              <FileCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--color-text-primary)]">Novo Protocolo de Homologação</h3>
              <p className="text-xs text-[var(--color-text-muted)]">Tramitação de parecer de acesso e conexão junto à concessionária</p>
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
              form="form-homologacao-solar"
              className="h-9 px-4 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white"
            >
              Registrar Protocolo
            </Button>
          </div>
        }
      >
        <form id="form-homologacao-solar" onSubmit={handleCreate} className="space-y-3.5 py-1">
          <div>
            <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1.5">Cliente / Unidade Consumidora</label>
            <input
              type="text"
              required
              placeholder="Nome do cliente ou UC"
              value={cliente}
              onChange={e => setCliente(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] rounded-xl text-[var(--color-text-primary)] focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1.5">Concessionária</label>
              <select
                value={concessionaria}
                onChange={e => setConcessionaria(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] rounded-xl text-[var(--color-text-primary)] focus:outline-none focus:border-amber-500"
              >
                <option value="CPFL Paulista">CPFL Paulista</option>
                <option value="CPFL Piratininga">CPFL Piratininga</option>
                <option value="Enel SP">Enel SP</option>
                <option value="Enel RJ">Enel RJ</option>
                <option value="CEMIG">CEMIG</option>
                <option value="Neoenergia Elektro">Neoenergia Elektro</option>
                <option value="Light">Light</option>
                <option value="Copel">Copel</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1.5">Nº Protocolo / OS</label>
              <input
                type="text"
                required
                placeholder="Ex: CPFL-2026-99012"
                value={protocolo}
                onChange={e => setProtocolo(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] rounded-xl text-[var(--color-text-primary)] focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1.5">Etapa Atual</label>
              <select
                value={etapa}
                onChange={e => setEtapa(e.target.value as any)}
                className="w-full px-3 py-2 text-xs bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] rounded-xl text-[var(--color-text-primary)] focus:outline-none focus:border-amber-500"
              >
                <option value="Solicitação de Acesso">Solicitação de Acesso</option>
                <option value="Parecer Emitido">Parecer Emitido</option>
                <option value="Vistoria da Distribuidora">Vistoria da Distribuidora</option>
                <option value="Troca do Medidor">Troca do Medidor</option>
                <option value="Homologado 100%">Homologado 100%</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1.5">Prazo Concessionária</label>
              <input
                type="text"
                placeholder="Ex: 15/09/2026"
                value={prazoConcessionaria}
                onChange={e => setPrazoConcessionaria(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] rounded-xl text-[var(--color-text-primary)] focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
}
