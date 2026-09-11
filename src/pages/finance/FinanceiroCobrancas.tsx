import { useState, useMemo } from "react";
import { PageContainer } from "../../components/PageContainer";
import { Button } from "../../components/ui/button";
import {
  Receipt, Plus, QrCode, Copy, CheckCircle2, Clock,
  AlertTriangle, Search, ExternalLink, DollarSign, X, Trash2, Check, Download
} from "lucide-react";
import { Card } from "../../components/ui/card";
import { Modal } from "../../components/ui/modal";
import { toast } from "sonner";
import { useData } from "../../contexts/DataContext";
import { useAuth } from "../../contexts/AuthContext";
import { confirmDialog } from "../../components/ui/confirm-dialog";

export default function FinanceiroCobrancas() {
  const { financeEntries, addFinanceEntry, updateFinanceEntry, deleteFinanceEntry } = useData();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [showModal, setShowModal] = useState(false);
  const [novaCobranca, setNovaCobranca] = useState({
    cliente: "",
    valor: "",
    vencimento: new Date().toISOString().split("T")[0],
    metodo: "Pix",
    categoria: "Receita de Vendas",
  });

  const cobrancas = useMemo(() => {
    return financeEntries
      .filter(f => f.type === "Receber")
      .map(f => ({
        id: f.id,
        cliente: f.description,
        valor: f.value,
        vencimento: f.date,
        metodo: f.value > 2000 ? "Boleto" : "Pix",
        status: f.status === "Pago" ? "Liquidada" : "Pendente",
        categoria: f.category,
      }));
  }, [financeEntries]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return cobrancas.filter(c => {
      const matchQ = c.cliente.toLowerCase().includes(q) || c.metodo.toLowerCase().includes(q);
      const matchSt = statusFilter === "Todos" || c.status === statusFilter;
      return matchQ && matchSt;
    });
  }, [cobrancas, search, statusFilter]);

  const handleCopyPix = (cliente: string, valor: number) => {
    const pixPayload = `00020126580014br.gov.bcb.pix0136${Math.random().toString(36).substring(2, 15)}520400005303986540${valor.toFixed(2)}5802BR5913SPY GESTAO6009SAO PAULO62070503***6304${Math.floor(1000 + Math.random() * 9000)}`;
    navigator.clipboard.writeText(pixPayload);
    toast.success(`Chave Copia e Cola Pix gerada para ${cliente}!`);
  };

  const handleToggleStatus = (id: string, currentStatus: string) => {
    const nextStatus: "Pago" | "A Vencer" = currentStatus === "Liquidada" || currentStatus === "Pago" ? "A Vencer" : "Pago";
    updateFinanceEntry(id, { status: nextStatus });
    toast.success(nextStatus === "Pago" ? "Cobrança marcada como Liquidada!" : "Cobrança retornada para A Vencer.");
  };

  const handleDelete = async (id: string) => {
    const ok = await confirmDialog({
      title: "Cancelar Cobrança",
      message: "Deseja realmente excluir este título a receber?",
      confirmText: "Sim, Excluir",
      cancelText: "Voltar",
      variant: "danger",
    });
    if (!ok) return;

    deleteFinanceEntry(id);
    toast.success("Cobrança removida.");
  };

  const handleCreateCobranca = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaCobranca.cliente.trim()) {
      toast.error("Informe o cliente / sacado.");
      return;
    }
    const val = parseFloat(novaCobranca.valor.replace(/\./g, "").replace(",", ".")) || 0;
    if (val <= 0) {
      toast.error("Informe um valor positivo.");
      return;
    }

    addFinanceEntry({
      description: novaCobranca.cliente.trim(),
      value: val,
      type: "Receber",
      category: novaCobranca.categoria || "Serviços / Honorários",
      date: novaCobranca.vencimento,
      status: "A Vencer",
    });

    toast.success("Cobrança emitida e vinculada ao Contas a Receber!");
    setShowModal(false);
    setNovaCobranca({
      cliente: "",
      valor: "",
      vencimento: new Date().toISOString().split("T")[0],
      metodo: "Pix",
      categoria: "Receita de Vendas",
    });
  };

  const handleExportCSV = () => {
    if (filtered.length === 0) {
      toast.info("Nenhuma cobrança para exportar.");
      return;
    }
    const headers = ["Cliente / Sacado", "Valor (R$)", "Vencimento", "Método", "Status", "Categoria"];
    const rows = filtered.map(c => [
      `"${c.cliente.replace(/"/g, '""')}"`,
      c.valor,
      `"${c.vencimento}"`,
      `"${c.metodo}"`,
      `"${c.status}"`,
      `"${(c.categoria || "").replace(/"/g, '""')}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `cobrancas_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Cobranças exportadas com sucesso!");
  };

  return (
    <PageContainer
      title="Gestão de Cobranças & Faturamento"
      description="Emissão e acompanhamento de faturas, boletos bancários e cobranças via Pix com conciliação automática."
      actions={
        <div className="flex items-center gap-2">
          <Button
            onClick={handleExportCSV}
            variant="outline"
            className="h-9 px-3.5 text-xs font-bold gap-1.5 border-[var(--color-border-default)]"
          >
            <Download className="w-3.5 h-3.5" /> Exportar CSV
          </Button>
          <Button
            onClick={() => setShowModal(true)}
            className="h-9 px-4 text-xs font-bold gap-1.5 shadow-xs bg-[var(--color-primary-blue)] text-white hover:opacity-95"
          >
            <Plus className="w-3.5 h-3.5" /> Nova Cobrança
          </Button>
        </div>
      }
    >
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { icon: Receipt, label: "Total Emitido", val: cobrancas.length, color: "text-blue-500" },
          { icon: CheckCircle2, label: "Liquidadas", val: cobrancas.filter(c => c.status === "Liquidada").length, color: "text-emerald-500" },
          { icon: Clock, label: "Pendentes", val: cobrancas.filter(c => c.status === "Pendente").length, color: "text-amber-500" },
          { icon: QrCode, label: "Cobranças Pix", val: cobrancas.filter(c => c.metodo === "Pix").length, color: "text-indigo-500" },
        ].map((k, i) => (
          <Card key={i} className="p-4 bg-[var(--color-surface-elevated)]/40 border border-[var(--color-border-subtle)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{k.label}</span>
              <k.icon className={`w-4 h-4 ${k.color}`} />
            </div>
            <p className="text-xl font-black text-[var(--color-text-primary)]">{k.val}</p>
          </Card>
        ))}
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-5">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Buscar cobrança por cliente ou método..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-xl pl-10 pr-4 py-2 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary-blue)]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {["Todos", "Liquidada", "Pendente"].map(st => (
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
                <th className="px-5 py-3">Cliente / Sacado</th>
                <th className="px-4 py-3">Método</th>
                <th className="px-4 py-3">Vencimento</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-[var(--color-surface-sunken)]/40 transition-colors">
                  <td className="px-5 py-3.5 font-bold text-[var(--color-text-primary)]">{c.cliente}</td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] text-[var(--color-text-muted)]">
                      {c.metodo}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-[var(--color-text-muted)]">{c.vencimento}</td>
                  <td className="px-4 py-3.5">
                    <button
                      onClick={() => handleToggleStatus(c.id, c.status)}
                      className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border transition-all inline-flex items-center gap-1 ${
                        c.status === "Liquidada"
                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20"
                          : "bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20"
                      }`}
                      title="Clique para alternar o status"
                    >
                      {c.status === "Liquidada" ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {c.status}
                    </button>
                  </td>
                  <td className="px-4 py-3.5 text-right font-bold text-[var(--color-text-primary)] font-mono">
                    R$ {c.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-3.5 text-right flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => handleCopyPix(c.cliente, c.valor)}
                      className="px-2.5 py-1 rounded-lg bg-[var(--color-surface-sunken)] hover:bg-[var(--color-primary-blue)] hover:text-white border border-[var(--color-border-default)] text-[11px] font-bold transition-all inline-flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" /> Pix
                    </button>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="p-1 rounded-lg bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] text-[var(--color-text-muted)] hover:text-rose-500 hover:bg-rose-500/10 hover:border-rose-500/25 transition-colors"
                      title="Excluir Cobrança"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[var(--color-text-muted)]">
                    Nenhuma cobrança encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Nova Cobrança"
        description="Emita uma nova ordem de cobrança via Pix, Boleto ou Cartão com conciliação automática."
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateCobranca} className="space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase text-[var(--color-text-muted)] block mb-1">
              Cliente / Sacado *
            </label>
            <input
              value={novaCobranca.cliente}
              onChange={e => setNovaCobranca({ ...novaCobranca, cliente: e.target.value })}
              placeholder="Nome do cliente ou empresa"
              required
              className="w-full bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-xl px-3 py-2 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-blue)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase text-[var(--color-text-muted)] block mb-1">
                Valor (R$) *
              </label>
              <input
                value={novaCobranca.valor}
                onChange={e => setNovaCobranca({ ...novaCobranca, valor: e.target.value })}
                placeholder="1500.00"
                required
                className="w-full bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-xl px-3 py-2 text-xs text-[var(--color-text-primary)] font-mono focus:outline-none focus:border-[var(--color-primary-blue)]"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-[var(--color-text-muted)] block mb-1">
                Método
              </label>
              <select
                value={novaCobranca.metodo}
                onChange={e => setNovaCobranca({ ...novaCobranca, metodo: e.target.value })}
                className="w-full bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-xl px-3 py-2 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-blue)]"
              >
                <option value="Pix">Pix Dinâmico</option>
                <option value="Boleto">Boleto Bancário</option>
                <option value="Cartao">Cartão de Crédito</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase text-[var(--color-text-muted)] block mb-1">
                Vencimento
              </label>
              <input
                type="date"
                value={novaCobranca.vencimento}
                onChange={e => setNovaCobranca({ ...novaCobranca, vencimento: e.target.value })}
                className="w-full bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-xl px-3 py-2 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-blue)]"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-[var(--color-text-muted)] block mb-1">
                Categoria
              </label>
              <input
                value={novaCobranca.categoria}
                onChange={e => setNovaCobranca({ ...novaCobranca, categoria: e.target.value })}
                placeholder="Honorários, Produtos..."
                className="w-full bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-xl px-3 py-2 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-blue)]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border-subtle)]">
            <Button type="button" variant="ghost" onClick={() => setShowModal(false)} className="text-xs">
              Cancelar
            </Button>
            <Button type="submit" className="text-xs font-bold bg-[var(--color-primary-blue)] text-white">
              Emitir Cobrança
            </Button>
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
}
