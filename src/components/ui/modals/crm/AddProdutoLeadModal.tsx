import { useEffect, useState } from "react";
import { Package, Loader2, Zap } from "lucide-react";
import { Modal } from "../../modal";
import { Button } from "../../button";
import { useData } from "../../../../contexts/DataContext";
import { useLocalization } from "../../../../contexts/LocalizationContext";
import { toast } from "sonner";

const PAYMENT_OPTIONS = [
  "Pix", "Cartão de Crédito", "Boleto Bancário", "Cartão de Débito",
  "Dinheiro", "Transferência / TED", "Link de Pagamento", "A Prazo (Crediário)",
] as const;

interface AddProdutoLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableProducts: any[];
  leadId?: string;
  leadName?: string;
  companyName?: string;
  seller?: string;
  /** Chamado depois que a venda é fechada com sucesso, pra quem chamou registrar no
   * histórico de alterações do lead (setAlterationLogs) sem esse modal precisar saber
   * desse detalhe. */
  onDone?: (summary: string) => void;
}

const labelClass = "text-xs font-bold text-[var(--color-text-muted)] mb-1 block";
const inputClass =
  "w-full bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] px-3 py-2 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-blue)] transition-all";

/**
 * Substitui o antigo "Mini PDV" embutido no Lead Detalhes — que expunha composição
 * comercial/margem, recorrência/implantação por item e catálogo inteiro dentro da tela do
 * lead, informação demais pra quem só quer registrar um produto vendido. Aqui é só: produto,
 * quantidade, forma de pagamento — mas fecha a venda de verdade (mesma automação de antes):
 * cria a proposta com o item, lança o valor a receber no financeiro, acumula no lead e marca
 * como Fechado. Recorrência/prazo de contrato vêm do próprio cadastro do produto (sem
 * controle nessa tela) — quem precisar negociar um prazo diferente do padrão do catálogo
 * ainda tem a tela de Propostas pra isso.
 */
export function AddProdutoLeadModal({
  isOpen,
  onClose,
  availableProducts,
  leadId,
  leadName,
  companyName,
  seller,
  onDone,
}: AddProdutoLeadModalProps) {
  const { createProposalWithItems, addFinanceEntry, updateLead, addNotification, leads } = useData();
  const { formatCurrency } = useLocalization();

  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [formaPagamento, setFormaPagamento] = useState<(typeof PAYMENT_OPTIONS)[number]>("Pix");
  const [parcelas, setParcelas] = useState(1);
  const [dataPagamento, setDataPagamento] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setProductId("");
    setQuantity(1);
    setFormaPagamento("Pix");
    setParcelas(1);
    setDataPagamento(new Date().toISOString().slice(0, 10));
    setSaving(false);
  }, [isOpen]);

  const product = availableProducts.find((p) => p.id === productId);
  const isRecurring = !!(product?.recurrence || product?.typeAttributes?.isRecurring || product?.type === "Assinatura" || product?.category === "Software");
  const contractMonths = product ? (product.contractMonths || product.typeAttributes?.contractMonths || (isRecurring ? 12 : 1)) : 1;
  const unitPrice = Number(product?.price) || 0;
  const finalTotal = isRecurring ? unitPrice * quantity * contractMonths : unitPrice * quantity;
  const valorParcela = parcelas > 1 ? finalTotal / parcelas : finalTotal;

  const handleSubmit = async () => {
    if (!product) {
      toast.error("Selecione um produto.");
      return;
    }
    setSaving(true);
    try {
      const clientName = companyName || leadName || "Cliente";
      await createProposalWithItems({
        titulo: `Proposta Comercial — ${clientName}`,
        cliente: clientName,
        valor: finalTotal,
        validade: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        status: "Enviada",
        vendedor: seller || "Consultor S.P.Y.",
        leadId: leadId || null,
        tipo: "itens",
        conteudoTexto: null,
        itens: [{
          productId: product.id,
          descricao: isRecurring ? `${product.name} (Assinatura Recorrente — ${contractMonths} meses)` : product.name,
          quantidade: isRecurring ? contractMonths * quantity : quantity,
          precoUnitario: unitPrice,
          billingType: isRecurring ? "recurring" : "one_time",
          contractMonths: isRecurring ? contractMonths : null,
        }],
      });

      const dueDate = dataPagamento || new Date().toISOString().slice(0, 10);
      const isInstantPayment = formaPagamento === "Dinheiro" || formaPagamento === "Pix" || formaPagamento === "Cartão de Débito";
      const formattedDate = new Date(dueDate + "T12:00:00").toLocaleDateString("pt-BR");
      const installmentInfo = parcelas > 1 ? ` (${parcelas}x de ${formatCurrency(valorParcela)})` : " (À Vista)";

      await addFinanceEntry({
        description: `Venda — ${clientName} | ${product.name} | Forma: ${formaPagamento}${installmentInfo} | Data: ${formattedDate}`,
        category: "Vendas / Serviços",
        value: finalTotal,
        type: "Receber",
        status: isInstantPayment ? "Pago" : "A Vencer",
        date: dueDate,
      });

      // Soma com o valor já existente no lead (uma venda anterior pra esse mesmo cliente)
      // em vez de sobrescrever — mesma regra do Mini PDV que isso substitui.
      if (leadId) {
        const currentLead = (leads || []).find((l: any) => l.id === leadId);
        const accumulatedValue = (currentLead ? Number(currentLead.value) || 0 : 0) + finalTotal;
        const accumulatedProductIds = [...new Set([...(currentLead?.productIds || []), product.id])];
        await updateLead(leadId, {
          value: accumulatedValue,
          productIds: accumulatedProductIds,
          status: "Fechado",
          scoreIA: 100,
          temperature: "quente",
        });
      }

      addNotification({
        title: `🎉 Venda Concluída: ${clientName}`,
        description: `Venda de ${formatCurrency(finalTotal)} (${product.name}) processada via ${formaPagamento}${installmentInfo}.`,
        type: "success",
        link_url: "/app/crm/propostas",
      });

      toast.success("Produto adicionado e venda fechada com sucesso!");
      onDone?.(`⚡ Produto "${product.name}" adicionado — venda de ${formatCurrency(finalTotal)} via ${formaPagamento}${installmentInfo} (Data: ${formattedDate}): proposta gerada, contas a receber lançado e lead atualizado.`);
      onClose();
    } catch (err: any) {
      toast.error("Erro ao processar a venda: " + err?.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Novo Produto" maxWidth="max-w-lg">
      <div className="space-y-4">
        <div>
          <label className={labelClass}>Produto *</label>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputClass}>
            <option value="">Selecione um produto...</option>
            {availableProducts.map((p) => (
              <option key={p.id} value={p.id}>{p.name} — {formatCurrency(Number(p.price) || 0)}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Quantidade</label>
            <input
              type="number" min={1} value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Vencimento</label>
            <input
              type="date" value={dataPagamento}
              onChange={(e) => setDataPagamento(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Forma de pagamento</label>
            <select value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value as any)} className={inputClass}>
              {PAYMENT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Parcelas</label>
            <select value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))} className={inputClass}>
              <option value={1}>1x à vista</option>
              {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                <option key={n} value={n}>{n}x</option>
              ))}
            </select>
          </div>
        </div>

        {product && (
          <div className="p-3 rounded-lg bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] flex items-center justify-between text-xs">
            <span className="text-[var(--color-text-muted)] flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" />
              {isRecurring ? `Recorrente • ${contractMonths} meses` : "Pagamento único"}
            </span>
            <span className="font-mono font-black text-emerald-500">
              {parcelas > 1 ? `${parcelas}x de ${formatCurrency(valorParcela)}` : formatCurrency(finalTotal)}
            </span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border-subtle)]">
          <Button type="button" variant="outline" onClick={onClose} className="h-9 px-4 text-xs font-bold">
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!product || saving}
            className="h-9 px-5 text-xs font-bold gap-1.5"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            {saving ? "Processando..." : "Adicionar & Fechar Venda"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
