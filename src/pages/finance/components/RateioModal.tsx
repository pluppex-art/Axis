import { useEffect, useState } from "react";
import { Modal } from "../../../components/ui/modal";
import { Button } from "../../../components/ui/button";
import { Trash2, Plus } from "lucide-react";
import { useLocalization } from "../../../contexts/LocalizationContext";
import { cn } from "../../../lib/utils";

export interface RateioParentEntry {
  id: string;
  description: string;
  date: string;
  value: number;
  type: "Pagar" | "Receber";
  category_id?: string | null;
}

export interface RateioDivisao {
  key: string;
  date: string;
  description: string;
  valor: string;
  counterparty: string;
  categoryId: string;
  pago: boolean;
}

interface RateioModalProps {
  isOpen: boolean;
  onClose: () => void;
  parent: RateioParentEntry | null;
  categoriasDoTipo: { id: string; nome: string }[];
  onConfirm: (divisoes: RateioDivisao[]) => Promise<void>;
}

let seq = 0;
const newKey = () => `div_${Date.now()}_${seq++}`;

/**
 * "Detalhar valor" — divide um lançamento em N linhas (rateio). Cada
 * divisão herda data/descrição/categoria do pai (spec §3.7), e o botão de
 * confirmar só habilita quando a soma bate exatamente com o valor total —
 * comparando em centavos pra não cair em erro de ponto flutuante.
 */
export function RateioModal({ isOpen, onClose, parent, categoriasDoTipo, onConfirm }: RateioModalProps) {
  const { formatCurrency } = useLocalization();
  const [divisoes, setDivisoes] = useState<RateioDivisao[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) { setDivisoes([]); setSaving(false); }
  }, [isOpen, parent?.id]);

  if (!parent) return null;

  const totalCents = Math.round(parent.value * 100);
  const somaCents = divisoes.reduce((s, d) => s + Math.round((parseFloat(d.valor) || 0) * 100), 0);
  const restanteCents = totalCents - somaCents;
  const bate = divisoes.length >= 2 && restanteCents === 0 && divisoes.every(d => d.categoryId && parseFloat(d.valor) > 0);

  const addDivisoes = (n: number, valorSugerido?: number) => {
    const novas: RateioDivisao[] = Array.from({ length: n }, () => ({
      key: newKey(),
      date: parent.date,
      description: parent.description,
      valor: valorSugerido !== undefined ? valorSugerido.toFixed(2) : "",
      counterparty: "",
      categoryId: parent.category_id || "",
      pago: false,
    }));
    setDivisoes(prev => [...prev, ...novas]);
  };

  const updateDivisao = (key: string, patch: Partial<RateioDivisao>) => {
    setDivisoes(prev => prev.map(d => d.key === key ? { ...d, ...patch } : d));
  };

  const removeDivisao = (key: string) => setDivisoes(prev => prev.filter(d => d.key !== key));

  const handleCriarRestante = () => addDivisoes(1, restanteCents / 100);

  const handleConfirm = async () => {
    if (!bate) return;
    setSaving(true);
    try {
      await onConfirm(divisoes);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detalhar Valor" description="Divide este lançamento em várias linhas — cada uma com sua própria categoria, data ou contato." maxWidth="max-w-2xl">
      <div className="space-y-4">
        <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
          {divisoes.length === 0 ? (
            <p className="text-xs text-[var(--color-text-faint)] text-center py-6">Clique em "Adicionar divisão" para começar.</p>
          ) : divisoes.map((d, i) => (
            <div key={d.key} className="border border-[var(--color-border-subtle)] rounded-[var(--radius-control)] p-3 space-y-2 relative">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-[var(--color-text-faint)]">Divisão {i + 1}</span>
                <button type="button" onClick={() => removeDivisao(d.key)} className="text-[var(--color-text-faint)] hover:text-[var(--color-danger)]">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="text" placeholder="Descrição" value={d.description} onChange={(e) => updateDivisao(d.key, { description: e.target.value })} className="bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] px-2.5 py-1.5 text-xs focus:outline-none" />
                <input type="date" value={d.date} onChange={(e) => updateDivisao(d.key, { date: e.target.value })} className="bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] px-2.5 py-1.5 text-xs focus:outline-none" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <select value={d.categoryId} onChange={(e) => updateDivisao(d.key, { categoryId: e.target.value })} className="bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] px-2.5 py-1.5 text-xs focus:outline-none cursor-pointer">
                  <option value="">Categoria...</option>
                  {categoriasDoTipo.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
                <input type="text" placeholder="Contato" value={d.counterparty} onChange={(e) => updateDivisao(d.key, { counterparty: e.target.value })} className="bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] px-2.5 py-1.5 text-xs focus:outline-none" />
                <input type="number" step="0.01" placeholder="Valor" value={d.valor} onChange={(e) => updateDivisao(d.key, { valor: e.target.value })} className="bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] px-2.5 py-1.5 text-xs font-mono focus:outline-none" />
              </div>
              <label className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)] cursor-pointer">
                <input type="checkbox" checked={d.pago} onChange={(e) => updateDivisao(d.key, { pago: e.target.checked })} className="cursor-pointer" /> Já paga/recebida
              </label>
            </div>
          ))}
        </div>

        <Button type="button" variant="outline" onClick={() => addDivisoes(2)} className="h-8 px-3 text-xs font-medium gap-1.5 w-full">
          <Plus className="w-3.5 h-3.5" /> Adicionar divisão
        </Button>

        <div className="border-t border-[var(--color-border-subtle)] pt-3 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-[var(--color-text-muted)]">Valor total do item</span>
            <span className="font-mono font-semibold text-[var(--color-text-primary)]">{formatCurrency(parent.value)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-[var(--color-text-muted)]">Soma da divisão</span>
            <span className={cn("font-mono font-semibold", somaCents !== totalCents ? "text-[var(--color-danger)]" : "text-[var(--color-text-primary)]")}>{formatCurrency(somaCents / 100)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-[var(--color-text-muted)]">Valor restante</span>
            <span className="font-mono font-semibold text-[var(--color-text-primary)]">{formatCurrency(restanteCents / 100)}</span>
          </div>
          {restanteCents !== 0 && divisoes.length > 0 && (
            <button type="button" onClick={handleCriarRestante} className="text-[11px] text-[var(--color-primary-blue)] hover:underline">
              Criar entrada de {formatCurrency(restanteCents / 100)}
            </button>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border-subtle)]">
          <Button type="button" variant="outline" onClick={onClose} className="h-9 px-4 text-xs font-medium">Cancelar</Button>
          <Button type="button" disabled={!bate || saving} onClick={handleConfirm} className="h-9 px-5 text-xs font-medium">
            {saving ? "Salvando..." : "Confirmar Divisão"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
