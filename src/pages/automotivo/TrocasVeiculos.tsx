import { useState, useEffect } from "react";
import { PageContainer } from "../../components/PageContainer";
import { Button } from "../../components/ui/button";
import {
  TrendingUp, Plus, Search, Car, ArrowRightLeft,
  DollarSign, CheckCircle2, Trash2, X
} from "lucide-react";
import { Card } from "../../components/ui/card";
import { Modal } from "../../components/ui/modal";
import { toast } from "sonner";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import { confirmDialog } from "../../components/ui/confirm-dialog";

// Status alinhado ao CHECK constraint real de veiculo_financiamentos —
// não existe um "Contrato Assinado" separado no banco; usamos os mesmos
// 4 valores já usados pelo simulador de financiamento em
// src/pages/imobiliario/components/VeiculoFinanciamentoModal.tsx.
interface TrocaItem {
  id: string;
  cliente: string;
  telefone: string;
  veiculoEntrada: string;
  valorEntrada: number;
  veiculoSaida: string;
  valorSaida: number;
  diferenca: number;
  formaPagamento: string;
  status: "Em Análise" | "Aprovado" | "Recusado" | "Documentação Pendente";
  data: string;
}

type VeiculoOption = { id: string; label: string; valor: number };

function rowToTroca(r: any): TrocaItem {
  const valorVeiculo = Number(r.valor_veiculo) || 0;
  const valorTroca = Number(r.veiculo_troca_valor) || 0;
  return {
    id: r.id,
    cliente: r.cliente,
    telefone: r.telefone || "",
    veiculoEntrada: r.veiculo_troca_descricao || "",
    valorEntrada: valorTroca,
    veiculoSaida: r.imobiliario_veiculos ? `${r.imobiliario_veiculos.marca} ${r.imobiliario_veiculos.modelo}` : "Veículo",
    valorSaida: valorVeiculo,
    diferenca: Number(r.valor_financiado) || 0,
    formaPagamento: r.observacoes?.replace(/^Forma de pagamento:\s*/, "") || r.banco_financeira || "",
    status: r.status,
    data: r.created_at ? new Date(r.created_at).toLocaleDateString("pt-BR") : "",
  };
}

export default function TrocasVeiculos() {
  const { activeTenantId } = useAuth();

  const [trocas, setTrocas] = useState<TrocaItem[]>([]);
  const [veiculosOptions, setVeiculosOptions] = useState<VeiculoOption[]>([]);

  const refetch = () => {
    if (!supabase || !activeTenantId) return;
    supabase
      .from("veiculo_financiamentos")
      .select("*, imobiliario_veiculos(marca,modelo)")
      .eq("tenant_id", activeTenantId)
      .not("veiculo_troca_descricao", "is", null)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error(`Erro ao carregar trocas: ${error.message}`);
        else if (data) setTrocas(data.map(rowToTroca));
      });
  };

  useEffect(() => {
    refetch();
    if (!supabase || !activeTenantId) return;
    supabase
      .from("imobiliario_veiculos")
      .select("id,marca,modelo,valor")
      .eq("tenant_id", activeTenantId)
      .then(({ data }) => {
        if (data) setVeiculosOptions(data.map((v: any) => ({ id: v.id, label: `${v.marca} ${v.modelo}`, valor: Number(v.valor) || 0 })));
      });
  }, [activeTenantId]);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [modalOpen, setModalOpen] = useState(false);

  // Form state
  const [cliente, setCliente] = useState("");
  const [telefone, setTelefone] = useState("");
  const [veiculoEntrada, setVeiculoEntrada] = useState("");
  const [valorEntrada, setValorEntrada] = useState("");
  const [veiculoSaidaId, setVeiculoSaidaId] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("Financiamento Bancário");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliente.trim() || !veiculoEntrada.trim() || !veiculoSaidaId) {
      toast.error("Preencha o cliente, o veículo de entrada e selecione o veículo de saída.");
      return;
    }
    if (!supabase || !activeTenantId) {
      toast.error("Supabase não configurado.");
      return;
    }

    const cleanMoney = (val: string) => {
      const s = val.trim().replace("R$", "").trim();
      if (s.includes(",") && s.includes(".")) {
        return parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
      }
      if (s.includes(",")) return parseFloat(s.replace(",", ".")) || 0;
      return parseFloat(s.replace(/[^\d.]/g, "")) || 0;
    };
    const vEntrada = cleanMoney(valorEntrada);
    const veiculoSaida = veiculosOptions.find(v => v.id === veiculoSaidaId);
    const vSaida = veiculoSaida?.valor || 0;
    const diff = Math.max(0, vSaida - vEntrada);

    const { data: row, error } = await supabase
      .from("veiculo_financiamentos")
      .insert({
        veiculo_id: veiculoSaidaId,
        cliente: cliente.trim(),
        telefone: telefone.trim() || null,
        valor_veiculo: vSaida,
        valor_entrada: 0,
        valor_financiado: diff,
        parcelas: 1,
        veiculo_troca_descricao: veiculoEntrada.trim(),
        veiculo_troca_valor: vEntrada,
        observacoes: `Forma de pagamento: ${formaPagamento}`,
        status: "Em Análise",
      })
      .select("*, imobiliario_veiculos(marca,modelo)")
      .maybeSingle();

    if (error) {
      toast.error(`Erro ao cadastrar troca: ${error.message}`);
      return;
    }

    if (row) setTrocas(prev => [rowToTroca(row), ...prev]);
    toast.success("Negociação de troca cadastrada com sucesso!");
    setModalOpen(false);

    setCliente("");
    setTelefone("");
    setVeiculoEntrada("");
    setValorEntrada("");
    setVeiculoSaidaId("");
  };

  const handleDelete = async (id: string) => {
    if (!supabase) return;
    const troca = trocas.find(t => t.id === id);
    if (!(await confirmDialog({
      title: "Excluir troca",
      description: `Excluir a negociação de troca de "${troca?.cliente || "este cliente"}"? Essa ação não pode ser desfeita.`,
    }))) return;
    const { error } = await supabase.from("veiculo_financiamentos").delete().eq("id", id);
    if (error) { toast.error(`Erro ao remover troca: ${error.message}`); return; }
    setTrocas(prev => prev.filter(t => t.id !== id));
    toast.info("Troca removida.");
  };

  const handleUpdateStatus = async (id: string, newStatus: TrocaItem["status"]) => {
    if (!supabase) return;
    const { error } = await supabase.from("veiculo_financiamentos").update({ status: newStatus }).eq("id", id);
    if (error) { toast.error(`Erro ao atualizar status: ${error.message}`); return; }
    setTrocas(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
    toast.success(`Status da troca: ${newStatus}`);
  };

  const filtered = trocas.filter(t => {
    const matchSearch = (
      t.cliente.toLowerCase().includes(search.toLowerCase()) ||
      t.veiculoEntrada.toLowerCase().includes(search.toLowerCase()) ||
      t.veiculoSaida.toLowerCase().includes(search.toLowerCase())
    );
    const matchStatus = filterStatus === "Todos" || t.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <PageContainer
      title="Negociações com Troca / Veículo na Entrada"
      description="Gerenciamento de negócios comerciais envolvendo veículo seminovo como parte do pagamento."
      actions={
        <Button onClick={() => setModalOpen(true)} className="h-9 px-4 text-xs font-bold gap-1.5 shadow-xs">
          <Plus className="w-3.5 h-3.5" /> Nova Negociação de Troca
        </Button>
      }
    >
      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="p-4 bg-[var(--color-surface-elevated)]/40 border border-[var(--color-border-subtle)]">
          <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block mb-1">Total de Trocas em Andamento</span>
          <div className="text-2xl font-black text-[var(--color-text-primary)]">{trocas.length}</div>
        </Card>
        <Card className="p-4 bg-[var(--color-surface-elevated)]/40 border border-[var(--color-border-subtle)]">
          <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block mb-1">Diferença Financeira em Aberto</span>
          <div className="text-2xl font-black text-emerald-500">
            R$ {(trocas.reduce((s, t) => s + t.diferenca, 0) / 1000).toFixed(0)}k
          </div>
        </Card>
        <Card className="p-4 bg-[var(--color-surface-elevated)]/40 border border-[var(--color-border-subtle)]">
          <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block mb-1">Captações via Troca</span>
          <div className="text-2xl font-black text-blue-500">{trocas.length} veículos</div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Buscar por cliente ou veículo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-[var(--color-surface)] border border-[var(--color-border-default)] rounded-xl text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-blue)]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {["Todos", "Em Análise", "Aprovado", "Recusado", "Documentação Pendente"].map(st => (
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
        {filtered.map(t => (
          <div key={t.id} className="p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border-default)] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-xs font-bold text-[var(--color-text-primary)]">Cliente: {t.cliente}</h4>
                {t.telefone && <span className="text-[10px] text-[var(--color-text-muted)]">({t.telefone})</span>}
                <span className="text-[10px] text-[var(--color-text-muted)]">• {t.data}</span>
              </div>
              <div className="space-y-1 text-xs text-[var(--color-text-muted)]">
                <p>🚗 <strong>Entrada:</strong> {t.veiculoEntrada} (Avaliado em <strong className="text-[var(--color-text-primary)]">R$ {t.valorEntrada.toLocaleString("pt-BR")}</strong>)</p>
                <p>🚙 <strong>Desejado:</strong> {t.veiculoSaida} (Valor de Loja: <strong className="text-[var(--color-text-primary)]">R$ {t.valorSaida.toLocaleString("pt-BR")}</strong>)</p>
                <p>💵 <strong>Diferença a Cobrir:</strong> <span className="text-emerald-500 font-bold">R$ {t.diferenca.toLocaleString("pt-BR")}</span> ({t.formaPagamento})</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <select
                value={t.status}
                onChange={e => handleUpdateStatus(t.id, e.target.value as any)}
                className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-xl bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] focus:outline-none"
              >
                <option value="Em Análise">Em Análise</option>
                <option value="Aprovado">Aprovado</option>
                <option value="Recusado">Recusado</option>
                <option value="Documentação Pendente">Documentação Pendente</option>
              </select>

              <Button size="sm" variant="ghost" onClick={() => handleDelete(t.id)} className="h-8 w-8 p-0 text-red-500 hover:bg-red-500/10 rounded-xl">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="p-8 text-center text-xs text-[var(--color-text-muted)] bg-[var(--color-surface)] border border-[var(--color-border-default)] rounded-2xl">
            Nenhuma troca encontrada para este filtro.
          </div>
        )}
      </div>

      {/* Modal de Nova Troca */}
      {/* Standardized Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        maxWidth="max-w-md"
        title={
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-blue)]/10 text-[var(--color-primary-blue)] flex items-center justify-center shrink-0">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--color-text-primary)]">Nova Negociação com Troca</h3>
              <p className="text-xs text-[var(--color-text-muted)]">Configure a entrada, veículo de saída e a diferença de valor</p>
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
              form="form-troca"
              className="h-9 px-4 text-xs font-semibold bg-[var(--color-primary-blue)] hover:bg-[var(--color-primary-blue)]/90 text-white"
            >
              Registrar Troca
            </Button>
          </div>
        }
      >
        <form id="form-troca" onSubmit={handleCreate} className="space-y-3.5 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1.5">Cliente</label>
              <input
                type="text"
                required
                placeholder="Nome do cliente"
                value={cliente}
                onChange={e => setCliente(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] rounded-xl text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-blue)]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1.5">Telefone</label>
              <input
                type="text"
                placeholder="(11) 90000-0000"
                value={telefone}
                onChange={e => setTelefone(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] rounded-xl text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-blue)]"
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Veículo de Entrada (Cliente)</span>
            <input
              type="text"
              required
              placeholder="Modelo: ex. HB20 1.6 2019"
              value={veiculoEntrada}
              onChange={e => setVeiculoEntrada(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-[var(--color-surface)] border border-[var(--color-border-subtle)] rounded-xl text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-blue)]"
            />
            <input
              type="text"
              placeholder="Valor de avaliação (R$): ex. 45.000"
              value={valorEntrada}
              onChange={e => setValorEntrada(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-[var(--color-surface)] border border-[var(--color-border-subtle)] rounded-xl text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-blue)]"
            />
          </div>

          <div className="p-3 rounded-xl bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Veículo Pretendido (Loja)</span>
            <select
              required
              value={veiculoSaidaId}
              onChange={e => setVeiculoSaidaId(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-[var(--color-surface)] border border-[var(--color-border-subtle)] rounded-xl text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-blue)]"
            >
              <option value="">Selecione um veículo do estoque...</option>
              {veiculosOptions.map(v => (
                <option key={v.id} value={v.id}>{v.label} — R$ {v.valor.toLocaleString("pt-BR")}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--color-text-primary)] block mb-1.5">Forma de Pagamento da Diferença</label>
            <select
              value={formaPagamento}
              onChange={e => setFormaPagamento(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] rounded-xl text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-blue)]"
            >
              <option value="Financiamento Bancário">Financiamento Bancário</option>
              <option value="À Vista via Pix">À Vista via Pix</option>
              <option value="Cartão de Crédito">Cartão de Crédito</option>
              <option value="Consórcio Contemplado">Consórcio Contemplado</option>
            </select>
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
}
