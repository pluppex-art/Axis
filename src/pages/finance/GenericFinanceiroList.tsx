import { Card } from "../../components/ui/card";
import {
  Download, Calendar, CheckCircle2,
  Clock, AlertTriangle, Plus, Trash2, X, DollarSign, Pencil, Lock
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Modal } from "../../components/ui/modal";
import React, { useMemo, useState } from "react";
import { useData } from "../../contexts/DataContext";
import { toast } from "sonner";
import { confirmDialog } from "../../components/ui/confirm-dialog";
import { downloadCsv } from "../../lib/csvExport";

interface GenericProps {
  title: string;
  desc: string;
  type: 'Pagar' | 'Receber';
}

export default function GenericFinanceiroList({ title, desc, type }: GenericProps) {
  const { financeEntries, addFinanceEntry, deleteFinanceEntry, updateFinanceEntry } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New entry form
  const [newDesc, setNewDesc] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newDate, setNewDate] = useState("");

  // Edit entry form
  const [editingItem, setEditingItem] = useState<(typeof financeEntries)[number] | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editValue, setEditValue] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editStatus, setEditStatus] = useState<"Pago" | "A Vencer" | "Atrasado">("A Vencer");

  const data = useMemo(() => {
    return financeEntries.filter(f => f.type === type);
  }, [financeEntries, type]);

  const totalValue = useMemo(() => {
    return data.reduce((acc, item) => acc + item.value, 0);
  }, [data]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDesc || !newValue) return;

    addFinanceEntry({
      description: newDesc,
      category: newCategory || "Geral",
      value: parseFloat(newValue),
      status: "A Vencer",
      type: type,
      date: newDate ? new Date(newDate).toLocaleDateString("pt-BR") : new Date().toLocaleDateString("pt-BR")
    });

    setIsModalOpen(false);
    setNewDesc("");
    setNewCategory("");
    setNewValue("");
    setNewDate("");
  };

  const handleExport = () => {
    downloadCsv(
      `${type === 'Pagar' ? 'contas_a_pagar' : 'contas_a_receber'}_${Date.now()}.csv`,
      ["Descrição", "Categoria", "Vencimento", "Status", "Valor"],
      data.map(item => [item.description, item.category, item.date, item.status, item.value])
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
    setEditCategory(item.category);
    setEditValue(String(item.value));
    setEditDate(item.date);
    setEditStatus((item.status as "Pago" | "A Vencer" | "Atrasado") || "A Vencer");
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
      category: editCategory || "Geral",
      value: parseFloat(editValue),
      date: editDate,
      status: editStatus,
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
                <th className="px-6 py-3.5">Descrição</th>
                <th className="px-6 py-3.5">Categoria</th>
                <th className="px-6 py-3.5">Vencimento</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Valor</th>
                <th className="px-6 py-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[var(--color-text-muted)]">
                    Nenhum lançamento encontrado para este período.
                  </td>
                </tr>
              ) : (
                data.map((item) => (
                  <tr key={item.id} className="hover:bg-[var(--color-surface-sunken)]/50 transition-colors group">
                    <td className="px-6 py-4 font-bold text-[var(--color-text-primary)]">{item.description}</td>
                    <td className="px-6 py-4 text-[var(--color-text-muted)]">{item.category}</td>
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
                      {type === 'Pagar' ? '-' : '+'} {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.value)}
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
                <td colSpan={4} className="px-6 py-4 text-[var(--color-text-muted)] text-right uppercase tracking-wider text-[10px]">Total:</td>
                <td className={`px-6 py-4 font-mono font-bold text-sm text-right ${type === 'Pagar' ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValue)}
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
                  <p className="font-bold text-[var(--color-text-primary)] text-xs mb-1 pr-12">{item.description}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[var(--color-text-muted)] font-semibold uppercase">{item.category}</span>
                    <span className="text-[10px] text-[var(--color-text-faint)] font-mono">{item.date}</span>
                  </div>
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
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.value)}
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
        onClose={() => setIsModalOpen(false)}
        title={type === 'Pagar' ? 'Novo Gasto / Despesa' : 'Novo Recebimento / Receita'}
        description="Registre um lançamento financeiro no sistema com classificação de categoria e vencimento."
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-[var(--color-text-muted)] mb-1 block">Descrição do Lançamento *</label>
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
            <label className="text-xs font-bold text-[var(--color-text-muted)] mb-1 block">Categoria Financeira</label>
            <input
              type="text"
              placeholder="Ex: Infraestrutura, Operacional, Marketing..."
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="w-full bg-[var(--color-surface-sunken)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-blue)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-[var(--color-text-muted)] mb-1 block">Valor (R$) *</label>
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
              <label className="text-xs font-bold text-[var(--color-text-muted)] mb-1 block">Data de Vencimento</label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full bg-[var(--color-surface-sunken)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-blue)]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-[var(--color-border-subtle)]">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
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
          <div>
            <label className="text-xs font-bold text-[var(--color-text-muted)] mb-1 block">Descrição do Lançamento *</label>
            <input
              type="text"
              required
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              className="w-full bg-[var(--color-surface-sunken)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-blue)]"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[var(--color-text-muted)] mb-1 block">Categoria Financeira</label>
            <input
              type="text"
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value)}
              className="w-full bg-[var(--color-surface-sunken)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-blue)]"
            />
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
