import { Card } from "../../components/ui/card";
import {
  Download, Calendar, CheckCircle2,
  Clock, AlertTriangle, Plus, Trash2, DollarSign, Pencil, Lock, Repeat, Layers, User
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Modal } from "../../components/ui/modal";
import { Switch } from "../../components/ui/switch";
import React, { useMemo, useState } from "react";
import { useData } from "../../contexts/DataContext";
import { toast } from "sonner";
import { confirmDialog } from "../../components/ui/confirm-dialog";
import { downloadCsv } from "../../lib/csvExport";
import { useLocalization } from "../../contexts/LocalizationContext";

type Frequencia = "semanal" | "mensal" | "anual";
type RepeatMode = "none" | "recorrente" | "parcelado";

const PAYMENT_METHODS = ["Pix", "Boleto", "Cartão de Crédito", "Cartão de Débito", "Transferência/TED", "Dinheiro", "Cheque", "Outro"];

function addPeriodo(date: Date, freq: Frequencia, n: number): Date {
  const d = new Date(date);
  if (freq === "semanal") d.setDate(d.getDate() + 7 * n);
  else if (freq === "anual") d.setFullYear(d.getFullYear() + n);
  else d.setMonth(d.getMonth() + n);
  return d;
}

// Divide o valor total em N parcelas sem perder centavos por arredondamento —
// a última parcela absorve a diferença (padrão usado por qualquer emissor de
// carnê/boleto: 100,00 em 3x vira 33,33 + 33,33 + 33,34, nunca 33,33 x 3 =
// 99,99 sumindo 1 centavo do total).
function splitInstallments(total: number, count: number): number[] {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / count);
  const remainder = cents - base * count;
  return Array.from({ length: count }, (_, i) => (i < count - 1 ? base : base + remainder) / 100);
}

interface GenericProps {
  title: string;
  desc: string;
  type: 'Pagar' | 'Receber';
}

export default function GenericFinanceiroList({ title, desc, type }: GenericProps) {
  const { financeEntries, addFinanceEntry, deleteFinanceEntry, updateFinanceEntry } = useData();
  const { formatCurrency } = useLocalization();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New entry form
  const [newDesc, setNewDesc] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newCounterparty, setNewCounterparty] = useState("");
  const [newPaymentMethod, setNewPaymentMethod] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newRepeatMode, setNewRepeatMode] = useState<RepeatMode>("none");
  const [newFrequency, setNewFrequency] = useState<Frequencia>("mensal");
  const [newOcorrencias, setNewOcorrencias] = useState("12");
  const [newParcelas, setNewParcelas] = useState("2");

  // Edit entry form
  const [editingItem, setEditingItem] = useState<(typeof financeEntries)[number] | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editCounterparty, setEditCounterparty] = useState("");
  const [editPaymentMethod, setEditPaymentMethod] = useState("");
  const [editValue, setEditValue] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editStatus, setEditStatus] = useState<"Pago" | "A Vencer" | "Atrasado">("A Vencer");
  const [editIsRecurring, setEditIsRecurring] = useState(false);
  const [editFrequency, setEditFrequency] = useState<Frequencia>("mensal");

  const data = useMemo(() => {
    return financeEntries.filter(f => f.type === type);
  }, [financeEntries, type]);

  const totalValue = useMemo(() => {
    return data.reduce((acc, item) => acc + item.value, 0);
  }, [data]);

  const resetAddForm = () => {
    setNewDesc("");
    setNewNotes("");
    setNewCategory("");
    setNewCounterparty("");
    setNewPaymentMethod("");
    setNewValue("");
    setNewDate("");
    setNewRepeatMode("none");
    setNewFrequency("mensal");
    setNewOcorrencias("12");
    setNewParcelas("2");
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDesc || !newValue) return;

    const baseDate = newDate ? new Date(newDate + "T12:00:00") : new Date();
    const totalValor = parseFloat(newValue) || 0;
    const baseFields = {
      description: newDesc,
      notes: newNotes || null,
      category: newCategory || "Geral",
      counterparty: newCounterparty || null,
      payment_method: newPaymentMethod || null,
      status: "A Vencer" as const,
      type: type,
    };

    if (newRepeatMode === "recorrente") {
      // Recorrência gera N lançamentos já na criação (um por período), com o
      // MESMO valor em cada um — assim aparecem de verdade no fluxo de caixa
      // e nas contas a pagar/receber de cada mês, sem precisar cadastrar de
      // novo toda vez. Todas compartilham `recurring_group_id`.
      const ocorrencias = Math.max(1, parseInt(newOcorrencias, 10) || 1);
      const groupId = crypto.randomUUID();
      for (let i = 0; i < ocorrencias; i++) {
        const dataOcorrencia = i === 0 ? baseDate : addPeriodo(baseDate, newFrequency, i);
        addFinanceEntry({
          ...baseFields,
          value: totalValor,
          date: dataOcorrencia.toLocaleDateString("pt-BR"),
          is_recurring: true,
          recurring_frequency: newFrequency,
          recurring_group_id: groupId,
        }, { silent: i > 0 });
      }
      if (ocorrencias > 1) toast.success(`${ocorrencias} lançamentos recorrentes gerados.`);
    } else if (newRepeatMode === "parcelado") {
      // Parcelamento divide o VALOR TOTAL em N partes (diferente de
      // recorrente, que repete o mesmo valor) — cada parcela vence um
      // período depois da anterior.
      const numParcelas = Math.max(2, parseInt(newParcelas, 10) || 2);
      const valores = splitInstallments(totalValor, numParcelas);
      const groupId = crypto.randomUUID();
      valores.forEach((valorParcela, i) => {
        const dataParcela = i === 0 ? baseDate : addPeriodo(baseDate, newFrequency, i);
        addFinanceEntry({
          ...baseFields,
          value: valorParcela,
          date: dataParcela.toLocaleDateString("pt-BR"),
          installment_group_id: groupId,
          installment_number: i + 1,
          installment_total: numParcelas,
        }, { silent: i > 0 });
      });
      toast.success(`${numParcelas} parcelas geradas (${formatCurrency(valores[0])} cada, ajustado na última).`);
    } else {
      addFinanceEntry({
        ...baseFields,
        value: totalValor,
        date: baseDate.toLocaleDateString("pt-BR"),
      });
    }

    setIsModalOpen(false);
    resetAddForm();
  };

  const handleExport = () => {
    downloadCsv(
      `${type === 'Pagar' ? 'contas_a_pagar' : 'contas_a_receber'}_${Date.now()}.csv`,
      ["Nome", "Categoria", "Cliente/Fornecedor", "Forma de Pagamento", "Vencimento", "Status", "Valor"],
      data.map(item => [item.description, item.category, item.counterparty || "", item.payment_method || "", item.date, item.status, item.value])
    );
  };

  const handleDelete = async (item: (typeof data)[number]) => {
    if (!(await confirmDialog({
      title: "Excluir lançamento",
      description: `Excluir "${item.description}"? Essa ação não pode ser desfeita.`,
    }))) return;
    deleteFinanceEntry(item.id);
    toast.success("Lançamento excluído.");
  };

  const openEdit = (item: (typeof data)[number]) => {
    setEditingItem(item);
    setEditDesc(item.description);
    setEditNotes(item.notes || "");
    setEditCategory(item.category);
    setEditCounterparty(item.counterparty || "");
    setEditPaymentMethod(item.payment_method || "");
    setEditValue(String(item.value));
    setEditDate(item.date);
    setEditStatus((item.status as "Pago" | "A Vencer" | "Atrasado") || "A Vencer");
    setEditIsRecurring(!!item.is_recurring);
    setEditFrequency((item.recurring_frequency as Frequencia) || "mensal");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editDesc || !editValue) return;

    const statusChanged = editStatus !== editingItem.status;
    if (statusChanged && !(await confirmDialog({
      title: "Alterar status do lançamento",
      description: `Confirmar alteração de status de "${editingItem.description}" para "${editStatus}"?`,
      confirmText: "Confirmar",
    }))) {
      return;
    }

    updateFinanceEntry(editingItem.id, {
      description: editDesc,
      notes: editNotes || null,
      category: editCategory || "Geral",
      counterparty: editCounterparty || null,
      payment_method: editPaymentMethod || null,
      value: parseFloat(editValue),
      date: editDate,
      status: editStatus,
      is_recurring: editIsRecurring,
      recurring_frequency: editIsRecurring ? editFrequency : null,
    });
    toast.success("Lançamento atualizado.");
    setEditingItem(null);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Pago': return <CheckCircle2 className="w-3 h-3 mr-1" />;
      case 'A Vencer': return <Clock className="w-3 h-3 mr-1" />;
      default: return <AlertTriangle className="w-3 h-3 mr-1" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pago': return "bg-emerald-500/10 text-emerald-500 border-emerald-500/30";
      case 'A Vencer': return "bg-blue-500/10 text-blue-500 border-blue-500/30";
      case 'Atrasado': return "bg-rose-500/10 text-rose-500 border-rose-500/30";
      default: return "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] border-[var(--color-border-subtle)]";
    }
  };

  const RepeatBadge = ({ item }: { item: (typeof data)[number] }) => {
    if (item.is_recurring) {
      return (
        <span title={`Recorrente (${item.recurring_frequency})`} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[8px] font-bold uppercase rounded-md bg-violet-500/10 text-violet-500 border border-violet-500/25">
          <Repeat className="w-2.5 h-2.5" /> {item.recurring_frequency}
        </span>
      );
    }
    if (item.installment_total && item.installment_total > 1) {
      return (
        <span title={`Parcela ${item.installment_number} de ${item.installment_total}`} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[8px] font-bold uppercase rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25">
          <Layers className="w-2.5 h-2.5" /> {item.installment_number}/{item.installment_total}
        </span>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">{title}</h1>
          <p className="text-sm text-[var(--color-text-muted)]">{desc}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setIsModalOpen(true)}
            className="h-9 px-4 text-xs font-bold gap-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" /> Novo Lançamento
          </Button>
          <Button
            variant="outline"
            onClick={handleExport}
            className="h-9 px-4 text-xs font-bold gap-1.5 border-[var(--color-border-default)]"
          >
            <Download className="w-3.5 h-3.5" /> Exportar
          </Button>
        </div>
      </div>

      <Card className="bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] overflow-hidden shadow-sm">
        <div className="p-4 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-sunken)] flex items-center justify-between">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
            Fluxo de Caixa / {type === 'Pagar' ? 'Contas a Pagar' : 'Contas a Receber'}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[var(--color-primary-blue)] font-semibold">
            <Calendar className="w-3.5 h-3.5" /> Ciclo Atual
          </div>
        </div>

        <div className="overflow-x-auto">
          {/* Desktop Table */}
          <table className="w-full text-xs text-left hidden md:table">
            <thead className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-muted)] bg-[var(--color-surface-sunken)] border-b border-[var(--color-border-subtle)]">
              <tr>
                <th className="px-6 py-3.5">Nome</th>
                <th className="px-6 py-3.5">Categoria</th>
                <th className="px-6 py-3.5">Cliente/Fornecedor</th>
                <th className="px-6 py-3.5">Pagamento</th>
                <th className="px-6 py-3.5">Vencimento</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Valor</th>
                <th className="px-6 py-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-[var(--color-text-muted)]">
                    Nenhum lançamento encontrado para este período.
                  </td>
                </tr>
              ) : (
                data.map((item) => (
                  <tr key={item.id} className="hover:bg-[var(--color-surface-sunken)]/50 transition-colors group">
                    <td className="px-6 py-4 font-bold text-[var(--color-text-primary)]">
                      <span className="inline-flex items-center gap-1.5">
                        {item.description}
                        <RepeatBadge item={item} />
                      </span>
                      {item.notes && (
                        <p className="text-[10px] font-normal text-[var(--color-text-faint)] mt-0.5 max-w-[220px] truncate" title={item.notes}>{item.notes}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-[var(--color-text-muted)]">{item.category}</td>
                    <td className="px-6 py-4 text-[var(--color-text-muted)]">{item.counterparty || "—"}</td>
                    <td className="px-6 py-4 text-[var(--color-text-muted)]">{item.payment_method || "—"}</td>
                    <td className="px-6 py-4 text-[var(--color-text-muted)] font-mono">{item.date}</td>
                    <td className="px-6 py-4">
                      <span
                        title="Status travado — use o lápis para editar"
                        className={`inline-flex items-center px-2.5 py-1 text-[10px] font-bold rounded-lg border cursor-default ${getStatusColor(item.status)}`}
                      >
                        {getStatusIcon(item.status)}
                        {item.status}
                        <Lock className="w-2.5 h-2.5 ml-1.5 opacity-60" />
                      </span>
                    </td>
                    <td className={`px-6 py-4 text-right font-mono font-bold ${type === 'Pagar' ? 'text-rose-500' : 'text-emerald-500'}`}>
                      {type === 'Pagar' ? '-' : '+'} {formatCurrency(item.value)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          className="p-1.5 bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] text-[var(--color-text-faint)] hover:text-[var(--color-primary-blue)] hover:bg-[var(--color-primary-blue)]/10 rounded-lg transition-colors cursor-pointer"
                          title="Editar lançamento"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          className="p-1.5 bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] text-[var(--color-text-faint)] hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                          title="Excluir lançamento"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="bg-[var(--color-surface-sunken)] border-t border-[var(--color-border-subtle)] font-bold">
              <tr>
                <td colSpan={6} className="px-6 py-4 text-[var(--color-text-muted)] text-right uppercase tracking-wider text-[10px]">Total:</td>
                <td className={`px-6 py-4 font-mono font-bold text-sm text-right ${type === 'Pagar' ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {formatCurrency(totalValue)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>

          {/* Mobile Cards */}
          <div className="md:hidden p-4 space-y-3">
            {data.map((item) => (
              <div key={item.id} className="bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] p-4 rounded-xl flex flex-col gap-3 relative">
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    className="rounded-lg bg-[var(--color-surface)] border border-[var(--color-border-subtle)] text-[var(--color-text-faint)] hover:text-[var(--color-primary-blue)] hover:bg-[var(--color-primary-blue)]/10 hover:border-[var(--color-primary-blue)]/25 p-1 transition-colors"
                    title="Editar lançamento"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    className="rounded-lg bg-[var(--color-surface)] border border-[var(--color-border-subtle)] text-[var(--color-text-faint)] hover:text-rose-500 hover:bg-rose-500/10 hover:border-rose-500/25 p-1 transition-colors"
                    title="Excluir lançamento"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div>
                  <p className="font-bold text-[var(--color-text-primary)] text-xs mb-1 pr-12 flex items-center gap-1.5 flex-wrap">
                    {item.description}
                    <RepeatBadge item={item} />
                  </p>
                  {item.notes && <p className="text-[10px] text-[var(--color-text-faint)] mb-1">{item.notes}</p>}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-[var(--color-text-muted)] font-semibold uppercase">{item.category}</span>
                    <span className="text-[10px] text-[var(--color-text-faint)] font-mono">{item.date}</span>
                    {item.payment_method && <span className="text-[10px] text-[var(--color-text-faint)]">· {item.payment_method}</span>}
                  </div>
                  {item.counterparty && (
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 flex items-center gap-1"><User className="w-2.5 h-2.5" /> {item.counterparty}</p>
                  )}
                </div>
                <div className="flex items-center justify-between border-t border-[var(--color-border-subtle)] pt-2.5">
                  <span
                    title="Status travado — use o lápis para editar"
                    className={`inline-flex items-center px-2 py-0.5 text-[9px] font-bold rounded-md border cursor-default ${getStatusColor(item.status)}`}
                  >
                    {getStatusIcon(item.status)}
                    {item.status}
                    <Lock className="w-2.5 h-2.5 ml-1 opacity-60" />
                  </span>
                  <p className={`font-mono font-bold text-xs ${type === 'Pagar' ? 'text-rose-500' : 'text-emerald-500'}`}>
                    {formatCurrency(item.value)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Creation Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); resetAddForm(); }}
        title={type === 'Pagar' ? 'Novo Gasto / Despesa' : 'Novo Recebimento / Receita'}
        description="Registre um lançamento financeiro no sistema com classificação de categoria e vencimento."
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-[var(--color-text-muted)] mb-1 block">Nome do Lançamento *</label>
            <input
              type="text"
              required
              placeholder="Ex: Servidor AWS, Licença de Software, Fatura..."
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="w-full bg-[var(--color-surface-sunken)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-blue)]"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[var(--color-text-muted)] mb-1 block">Descrição / Observações</label>
            <textarea
              rows={2}
              placeholder="Detalhes adicionais deste lançamento (opcional)"
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              className="w-full bg-[var(--color-surface-sunken)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-blue)] resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-[var(--color-text-muted)] mb-1 block">Categoria Financeira</label>
              <input
                type="text"
                placeholder="Ex: Infraestrutura, Marketing..."
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full bg-[var(--color-surface-sunken)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-blue)]"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[var(--color-text-muted)] mb-1 block">{type === 'Pagar' ? 'Fornecedor' : 'Cliente'}</label>
              <input
                type="text"
                placeholder={type === 'Pagar' ? 'Ex: AWS, Fornecedor X' : 'Ex: Nome do cliente'}
                value={newCounterparty}
                onChange={(e) => setNewCounterparty(e.target.value)}
                className="w-full bg-[var(--color-surface-sunken)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-blue)]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-[var(--color-text-muted)] mb-1 block">Forma de {type === 'Pagar' ? 'Pagamento' : 'Recebimento'}</label>
            <select
              value={newPaymentMethod}
              onChange={(e) => setNewPaymentMethod(e.target.value)}
              className="w-full bg-[var(--color-surface-sunken)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-blue)] cursor-pointer"
            >
              <option value="">Não informado</option>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-[var(--color-text-muted)] mb-1 block">
                {newRepeatMode === "parcelado" ? "Valor Total (R$) *" : "Valor (R$) *"}
              </label>
              <input
                type="number"
                required
                step="0.01"
                placeholder="0,00"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className="w-full bg-[var(--color-surface-sunken)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-blue)] font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[var(--color-text-muted)] mb-1 block">
                {newRepeatMode === "none" ? "Data de Vencimento" : "1º Vencimento"}
              </label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full bg-[var(--color-surface-sunken)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-blue)]"
              />
            </div>
          </div>

          <div className="bg-[var(--color-surface-sunken)]/60 border border-[var(--color-border-subtle)] rounded-[var(--radius-control)] p-3.5 space-y-3">
            <label className="text-xs font-bold text-[var(--color-text-muted)] block">Tipo de lançamento</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setNewRepeatMode("none")}
                className={`flex flex-col items-center gap-1 py-2.5 rounded-[var(--radius-control)] border text-[10px] font-bold uppercase transition-colors cursor-pointer ${newRepeatMode === "none" ? "bg-[var(--color-primary-blue)]/10 border-[var(--color-primary-blue)]/40 text-[var(--color-primary-blue)]" : "bg-[var(--color-surface)] border-[var(--color-border-subtle)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"}`}
              >
                <DollarSign className="w-3.5 h-3.5" /> Único
              </button>
              <button
                type="button"
                onClick={() => setNewRepeatMode("recorrente")}
                className={`flex flex-col items-center gap-1 py-2.5 rounded-[var(--radius-control)] border text-[10px] font-bold uppercase transition-colors cursor-pointer ${newRepeatMode === "recorrente" ? "bg-violet-500/10 border-violet-500/40 text-violet-500" : "bg-[var(--color-surface)] border-[var(--color-border-subtle)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"}`}
              >
                <Repeat className="w-3.5 h-3.5" /> Recorrente
              </button>
              <button
                type="button"
                onClick={() => setNewRepeatMode("parcelado")}
                className={`flex flex-col items-center gap-1 py-2.5 rounded-[var(--radius-control)] border text-[10px] font-bold uppercase transition-colors cursor-pointer ${newRepeatMode === "parcelado" ? "bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400" : "bg-[var(--color-surface)] border-[var(--color-border-subtle)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"}`}
              >
                <Layers className="w-3.5 h-3.5" /> Parcelado
              </button>
            </div>

            {newRepeatMode === "recorrente" && (
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="text-xs font-bold text-[var(--color-text-muted)] mb-1 block">Frequência</label>
                  <select
                    value={newFrequency}
                    onChange={(e) => setNewFrequency(e.target.value as Frequencia)}
                    className="w-full bg-[var(--color-surface)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-blue)] cursor-pointer"
                  >
                    <option value="semanal">Semanal</option>
                    <option value="mensal">Mensal</option>
                    <option value="anual">Anual</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-[var(--color-text-muted)] mb-1 block">Repetir por quantas vezes</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={newOcorrencias}
                    onChange={(e) => setNewOcorrencias(e.target.value)}
                    className="w-full bg-[var(--color-surface)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-blue)] font-mono"
                  />
                </div>
              </div>
            )}

            {newRepeatMode === "parcelado" && (
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="text-xs font-bold text-[var(--color-text-muted)] mb-1 block">Número de Parcelas</label>
                  <input
                    type="number"
                    min={2}
                    max={60}
                    value={newParcelas}
                    onChange={(e) => setNewParcelas(e.target.value)}
                    className="w-full bg-[var(--color-surface)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-blue)] font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[var(--color-text-muted)] mb-1 block">Intervalo entre parcelas</label>
                  <select
                    value={newFrequency}
                    onChange={(e) => setNewFrequency(e.target.value as Frequencia)}
                    className="w-full bg-[var(--color-surface)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-blue)] cursor-pointer"
                  >
                    <option value="semanal">Semanal</option>
                    <option value="mensal">Mensal</option>
                    <option value="anual">Anual</option>
                  </select>
                </div>
                {newValue && (
                  <p className="col-span-2 text-[10px] text-[var(--color-text-muted)]">
                    {Math.max(2, parseInt(newParcelas, 10) || 2)}x de{" "}
                    <span className="font-mono font-bold text-[var(--color-text-primary)]">
                      {formatCurrency(splitInstallments(parseFloat(newValue) || 0, Math.max(2, parseInt(newParcelas, 10) || 2))[0])}
                    </span>
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-[var(--color-border-subtle)]">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setIsModalOpen(false); resetAddForm(); }}
              className="h-9 px-4 text-xs font-bold border-[var(--color-border-default)]"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="h-9 px-5 text-xs font-bold shadow-xs"
            >
              Confirmar Lançamento
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editingItem}
        onClose={() => setEditingItem(null)}
        title="Editar Lançamento"
        description="Atualize os dados e o status deste lançamento financeiro."
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          {editingItem?.recurring_group_id && (
            <div className="inline-flex items-center gap-1 px-2 py-1 text-[9px] font-bold uppercase rounded-md bg-violet-500/10 text-violet-500 border border-violet-500/25">
              <Repeat className="w-2.5 h-2.5" /> Faz parte de uma recorrência {editingItem.recurring_frequency} — editar aqui só afeta esta ocorrência.
            </div>
          )}
          {editingItem?.installment_group_id && (
            <div className="inline-flex items-center gap-1 px-2 py-1 text-[9px] font-bold uppercase rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25">
              <Layers className="w-2.5 h-2.5" /> Parcela {editingItem.installment_number} de {editingItem.installment_total} — editar aqui só afeta esta parcela.
            </div>
          )}
          <div>
            <label className="text-xs font-bold text-[var(--color-text-muted)] mb-1 block">Nome do Lançamento *</label>
            <input
              type="text"
              required
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              className="w-full bg-[var(--color-surface-sunken)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-blue)]"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[var(--color-text-muted)] mb-1 block">Descrição / Observações</label>
            <textarea
              rows={2}
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              className="w-full bg-[var(--color-surface-sunken)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-blue)] resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-[var(--color-text-muted)] mb-1 block">Categoria Financeira</label>
              <input
                type="text"
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="w-full bg-[var(--color-surface-sunken)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-blue)]"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[var(--color-text-muted)] mb-1 block">{type === 'Pagar' ? 'Fornecedor' : 'Cliente'}</label>
              <input
                type="text"
                value={editCounterparty}
                onChange={(e) => setEditCounterparty(e.target.value)}
                className="w-full bg-[var(--color-surface-sunken)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-blue)]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-[var(--color-text-muted)] mb-1 block">Forma de {type === 'Pagar' ? 'Pagamento' : 'Recebimento'}</label>
            <select
              value={editPaymentMethod}
              onChange={(e) => setEditPaymentMethod(e.target.value)}
              className="w-full bg-[var(--color-surface-sunken)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-blue)] cursor-pointer"
            >
              <option value="">Não informado</option>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-[var(--color-text-muted)] mb-1 block">Valor (R$) *</label>
              <input
                type="number"
                required
                step="0.01"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full bg-[var(--color-surface-sunken)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-blue)] font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[var(--color-text-muted)] mb-1 block">Data de Vencimento</label>
              <input
                type="text"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                placeholder="dd/mm/aaaa"
                className="w-full bg-[var(--color-surface-sunken)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-blue)]"
              />
            </div>
          </div>

          <div className="bg-[var(--color-surface-sunken)]/60 border border-[var(--color-border-subtle)] rounded-[var(--radius-control)] p-3.5 space-y-3">
            <Switch
              checked={editIsRecurring}
              onCheckedChange={setEditIsRecurring}
              label="Lançamento recorrente?"
              description={
                editingItem?.recurring_group_id
                  ? "Esta ocorrência já pertence a uma recorrência gerada na criação."
                  : "Marca este lançamento como recorrente (não gera novas ocorrências, só identifica este)."
              }
            />
            {editIsRecurring && (
              <div>
                <label className="text-xs font-bold text-[var(--color-text-muted)] mb-1 block">Frequência</label>
                <select
                  value={editFrequency}
                  onChange={(e) => setEditFrequency(e.target.value as Frequencia)}
                  className="w-full bg-[var(--color-surface)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-blue)] cursor-pointer"
                >
                  <option value="semanal">Semanal</option>
                  <option value="mensal">Mensal</option>
                  <option value="anual">Anual</option>
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-bold text-[var(--color-text-muted)] mb-1 flex items-center gap-1.5">
              Status
              <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-faint)]">
                <Lock className="w-2.5 h-2.5" /> só muda por aqui
              </span>
            </label>
            <select
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value as "Pago" | "A Vencer" | "Atrasado")}
              className="w-full bg-[var(--color-surface-sunken)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-blue)] cursor-pointer"
            >
              <option value="A Vencer">A Vencer</option>
              <option value="Pago">Pago</option>
              <option value="Atrasado">Atrasado</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-[var(--color-border-subtle)]">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingItem(null)}
              className="h-9 px-4 text-xs font-bold border-[var(--color-border-default)]"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="h-9 px-5 text-xs font-bold shadow-xs"
            >
              Salvar Alterações
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
