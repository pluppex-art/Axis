import { useState, useMemo, useEffect } from "react";
import { PageContainer } from "../../components/PageContainer";
import { Button } from "../../components/ui/button";
import {
  DollarSign, CheckCircle2, Clock, Users, ArrowUpRight,
  TrendingUp, Download, Building2, Plus, Search, Trash2, X, AlertCircle
} from "lucide-react";
import { Card } from "../../components/ui/card";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { confirmDialog } from "../../components/ui/confirm-dialog";
import { Modal } from "../../components/ui/modal";
import { supabase } from "../../lib/supabase";

type Comissao = {
  id: string;
  imovel: string;
  corretor: string;
  valorVenda: number;
  comissaoTotal: number;
  comissaoCorretor: number;
  comissaoImobiliaria: number;
  status: "A Receber" | "Em Tramitação" | "Liquidada";
  previsao: string;
  observacoes?: string;
  created_at?: string;
};

function rowToComissao(row: any): Comissao {
  return {
    id: row.id,
    imovel: row.imovel,
    corretor: row.corretor || "",
    valorVenda: Number(row.valor_venda) || 0,
    comissaoTotal: Number(row.comissao_total) || 0,
    comissaoCorretor: Number(row.comissao_corretor) || 0,
    comissaoImobiliaria: Number(row.comissao_imobiliaria) || 0,
    status: row.status,
    previsao: row.previsao || "",
    observacoes: row.observacoes || "",
    created_at: row.created_at,
  };
}

export default function ImobiliarioComissoes() {
  const { user, activeTenantId } = useAuth();

  const [comissoes, setComissoes] = useState<Comissao[]>([]);

  useEffect(() => {
    if (!supabase || !activeTenantId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("imobiliario_comissoes")
        .select("*")
        .eq("tenant_id", activeTenantId)
        .order("created_at", { ascending: false });
      if (!cancelled && !error && data) {
        setComissoes(data.map(rowToComissao));
      }
    })();
    return () => { cancelled = true; };
  }, [activeTenantId]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [imovel, setImovel] = useState("");
  const [corretor, setCorretor] = useState(user?.name || "");
  const [valorVenda, setValorVenda] = useState("");
  const [percentualTotal, setPercentualTotal] = useState("6");
  const [splitCorretor, setSplitCorretor] = useState("50");
  const [status, setStatus] = useState<Comissao["status"]>("A Receber");
  const [previsao, setPrevisao] = useState("");
  const [observacoes, setObservacoes] = useState("");

  // Calculations for new entry
  const numValorVenda = parseFloat(valorVenda.replace(/\D/g, "")) || 0;
  const numPercTotal = parseFloat(percentualTotal) || 0;
  const numSplitCorretor = parseFloat(splitCorretor) || 0;
  const calcComissaoTotal = (numValorVenda * numPercTotal) / 100;
  const calcComissaoCorretor = (calcComissaoTotal * numSplitCorretor) / 100;
  const calcComissaoImobiliaria = calcComissaoTotal - calcComissaoCorretor;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imovel.trim()) {
      toast.error("Informe o imóvel negociado.");
      return;
    }
    if (numValorVenda <= 0) {
      toast.error("Informe um valor de venda válido.");
      return;
    }
    if (!supabase || !activeTenantId) {
      toast.error("Sem conexão com o banco de dados.");
      return;
    }

    const { data, error } = await supabase
      .from("imobiliario_comissoes")
      .insert({
        tenant_id: activeTenantId,
        imovel: imovel.trim(),
        corretor: corretor.trim() || "Corretor Interno",
        valor_venda: numValorVenda,
        comissao_total: calcComissaoTotal,
        comissao_corretor: calcComissaoCorretor,
        comissao_imobiliaria: calcComissaoImobiliaria,
        status,
        previsao: previsao || new Date().toLocaleDateString("pt-BR"),
        observacoes: observacoes.trim(),
      })
      .select()
      .maybeSingle();

    if (error || !data) {
      toast.error("Erro ao registrar comissão.");
      return;
    }

    setComissoes(prev => [rowToComissao(data), ...prev]);
    setShowModal(false);
    toast.success("Comissão registrada com sucesso!");

    // Reset
    setImovel("");
    setValorVenda("");
    setObservacoes("");
  };

  const handleUpdateStatus = async (id: string, newStatus: Comissao["status"]) => {
    if (!supabase) return;
    const { error } = await supabase.from("imobiliario_comissoes").update({ status: newStatus }).eq("id", id);
    if (error) { toast.error("Erro ao atualizar status."); return; }
    setComissoes(prev =>
      prev.map(c => (c.id === id ? { ...c, status: newStatus } : c))
    );
    toast.success(`Status atualizado para "${newStatus}"`);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirmDialog({
      title: "Excluir Registro de Comissão",
      description: "Deseja realmente remover este registro de honorários? Esta ação não pode ser desfeita.",
      confirmText: "Sim, Excluir",
      cancelText: "Cancelar",
    });
    if (!ok) return;

    if (!supabase) return;
    const { error } = await supabase.from("imobiliario_comissoes").delete().eq("id", id);
    if (error) { toast.error("Erro ao remover comissão."); return; }

    setComissoes(prev => prev.filter(c => c.id !== id));
    toast.success("Registro de comissão removido.");
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return comissoes.filter(c => {
      const matchSearch =
        c.imovel.toLowerCase().includes(q) ||
        c.corretor.toLowerCase().includes(q) ||
        (c.observacoes && c.observacoes.toLowerCase().includes(q));
      const matchStatus = statusFilter === "Todos" || c.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [comissoes, search, statusFilter]);

  const totalAReceber = comissoes
    .filter(c => c.status !== "Liquidada")
    .reduce((s, c) => s + c.comissaoTotal, 0);

  const totalRepasses = comissoes
    .filter(c => c.status !== "Liquidada")
    .reduce((s, c) => s + c.comissaoCorretor, 0);

  const totalLiquidado = comissoes
    .filter(c => c.status === "Liquidada")
    .reduce((s, c) => s + c.comissaoTotal, 0);

  return (
    <PageContainer
      title="Comissões Imobiliárias & Honorários"
      description="Cálculo de comissões, split entre imobiliária e corretores parceiros, integrado ao fluxo de caixa."
      actions={
        <div className="flex items-center gap-2">
          <Link
            to="/app/financeiro/receber"
            className="h-9 px-3.5 text-xs font-bold gap-1.5 inline-flex items-center rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] hover:border-[var(--color-primary-blue)] text-[var(--color-text-primary)] transition-all"
          >
            <DollarSign className="w-3.5 h-3.5 text-emerald-500" /> Ver no Financeiro
          </Link>
          <Button
            onClick={() => setShowModal(true)}
            className="h-9 px-4 text-xs font-bold gap-1.5 shadow-xs bg-[var(--color-primary-blue)] text-white hover:opacity-95"
          >
            <Plus className="w-3.5 h-3.5" /> Nova Comissão / Split
          </Button>
        </div>
      }
    >
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="p-4 bg-[var(--color-surface-elevated)]/40 border border-emerald-500/25 shadow-xs">
          <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block mb-1">
            Comissões a Receber (VGV)
          </span>
          <div className="text-2xl font-black text-emerald-500">
            R$ {totalAReceber.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-[var(--color-text-muted)] mt-1 block">
            Aguardando compensação ou escritura
          </span>
        </Card>

        <Card className="p-4 bg-[var(--color-surface-elevated)]/40 border border-[var(--color-border-subtle)]">
          <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block mb-1">
            Repasses Previstos a Corretores
          </span>
          <div className="text-2xl font-black text-[var(--color-text-primary)]">
            R$ {totalRepasses.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-[var(--color-text-muted)] mt-1 block">
            Split automático de honorários
          </span>
        </Card>

        <Card className="p-4 bg-[var(--color-surface-elevated)]/40 border border-blue-500/25 shadow-xs">
          <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block mb-1">
            Honorários Liquidados
          </span>
          <div className="text-2xl font-black text-[var(--color-primary-blue)]">
            R$ {totalLiquidado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-[var(--color-text-muted)] mt-1 block">
            Totalmente recebidos e distribuídos
          </span>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-5">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Buscar por imóvel, corretor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-xl pl-10 pr-4 py-2 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary-blue)]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {["Todos", "A Receber", "Em Tramitação", "Liquidada"].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                statusFilter === st
                  ? "bg-[var(--color-primary-blue)] text-white border-[var(--color-primary-blue)]"
                  : "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-elevated)]"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border-default)] rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-sunken)]/60 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                <th className="px-5 py-3">Imóvel Negociado</th>
                <th className="px-4 py-3">Corretor</th>
                <th className="px-4 py-3">Valor da Venda</th>
                <th className="px-4 py-3">Comissão Total</th>
                <th className="px-4 py-3">Repasse Corretor</th>
                <th className="px-4 py-3">Líquido Imobiliária</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Previsão</th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-[var(--color-surface-sunken)]/40 transition-colors">
                  <td className="px-5 py-3.5">
                    <span className="font-bold text-[var(--color-text-primary)] block">{c.imovel}</span>
                    {c.observacoes && (
                      <span className="text-[10px] text-[var(--color-text-muted)] line-clamp-1 mt-0.5">
                        {c.observacoes}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-[var(--color-text-muted)] font-medium">{c.corretor}</td>
                  <td className="px-4 py-3.5 font-mono text-[var(--color-text-primary)]">
                    R$ {c.valorVenda.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3.5 font-bold text-emerald-500 font-mono">
                    R$ {c.comissaoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3.5 font-bold text-blue-500 font-mono">
                    R$ {c.comissaoCorretor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3.5 font-mono text-[var(--color-text-primary)]">
                    R$ {c.comissaoImobiliaria.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3.5">
                    <select
                      value={c.status}
                      onChange={e => handleUpdateStatus(c.id, e.target.value as Comissao["status"])}
                      className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full border cursor-pointer focus:outline-none ${
                        c.status === "Liquidada"
                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                          : c.status === "Em Tramitação"
                          ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                          : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                      }`}
                    >
                      <option value="A Receber">A Receber</option>
                      <option value="Em Tramitação">Em Tramitação</option>
                      <option value="Liquidada">Liquidada</option>
                    </select>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-[var(--color-text-muted)]">{c.previsao}</td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="p-1.5 rounded-lg bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] text-[var(--color-text-muted)] hover:text-rose-500 hover:bg-rose-500/10 hover:border-rose-500/25 transition-colors"
                      title="Excluir comissão"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[var(--color-text-muted)]">
                    Nenhuma comissão encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Standardized Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        maxWidth="max-w-lg"
        title={
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--color-text-primary)]">Nova Comissão / Split de Honorários</h3>
              <p className="text-xs text-[var(--color-text-muted)]">Calcule comissões de venda e divisão entre corretores e imobiliária</p>
            </div>
          </div>
        }
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowModal(false)}
              className="h-9 px-4 text-xs font-semibold"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="form-comissao"
              className="h-9 px-4 text-xs font-semibold bg-[var(--color-primary-blue)] hover:bg-[var(--color-primary-blue)]/90 text-white"
            >
              Registrar Comissão
            </Button>
          </div>
        }
      >
        <form id="form-comissao" onSubmit={handleCreate} className="space-y-3.5 py-1">
          <div>
            <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1.5">
              Imóvel Negociado *
            </label>
            <input
              value={imovel}
              onChange={e => setImovel(e.target.value)}
              placeholder="Ex: Apartamento 82 - Reserva Vila Nova"
              required
              className="w-full bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] rounded-xl px-3 py-2 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-blue)]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1.5">
                Corretor Responsável
              </label>
              <input
                value={corretor}
                onChange={e => setCorretor(e.target.value)}
                placeholder="Nome do corretor"
                className="w-full bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] rounded-xl px-3 py-2 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-blue)]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1.5">
                Valor de Venda (R$) *
              </label>
              <input
                value={valorVenda}
                onChange={e => setValorVenda(e.target.value)}
                placeholder="Ex: 850000"
                type="number"
                required
                className="w-full bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] rounded-xl px-3 py-2 text-xs font-mono text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-blue)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1.5">
                Comissão Total (%)
              </label>
              <input
                value={percentualTotal}
                onChange={e => setPercentualTotal(e.target.value)}
                placeholder="6"
                type="number"
                step="0.1"
                className="w-full bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] rounded-xl px-3 py-2 text-xs font-mono text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-blue)]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1.5">
                Repasse Corretor (%)
              </label>
              <input
                value={splitCorretor}
                onChange={e => setSplitCorretor(e.target.value)}
                placeholder="50"
                type="number"
                step="0.5"
                className="w-full bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] rounded-xl px-3 py-2 text-xs font-mono text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-blue)]"
              />
            </div>
          </div>

          {/* Live Preview of Calculations */}
          {numValorVenda > 0 && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Comissão Bruta ({numPercTotal}%):</span>
                <strong className="text-emerald-500 font-mono">
                  R$ {calcComissaoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Repasse Corretor ({numSplitCorretor}%):</span>
                <strong className="text-blue-500 font-mono">
                  R$ {calcComissaoCorretor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </strong>
              </div>
              <div className="flex justify-between border-t border-emerald-500/20 pt-1">
                <span className="text-[var(--color-text-muted)]">Líquido Imobiliária:</span>
                <strong className="text-[var(--color-text-primary)] font-mono">
                  R$ {calcComissaoImobiliaria.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </strong>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1.5">
                Status Inicial
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as Comissao["status"])}
                className="w-full bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] rounded-xl px-3 py-2 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-blue)]"
              >
                <option value="A Receber">A Receber</option>
                <option value="Em Tramitação">Em Tramitação</option>
                <option value="Liquidada">Liquidada</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1.5">
                Previsão de Liquidação
              </label>
              <input
                type="date"
                value={previsao}
                onChange={e => setPrevisao(e.target.value)}
                className="w-full bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] rounded-xl px-3 py-2 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-blue)]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1.5">
              Observações / Cartório
            </label>
            <textarea
              rows={2}
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              placeholder="Informações adicionais, número de matrícula, etc."
              className="w-full bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] rounded-xl px-3 py-2 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-blue)] resize-none"
            />
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
}
