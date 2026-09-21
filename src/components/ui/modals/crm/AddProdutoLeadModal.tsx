import { useEffect, useMemo, useState } from "react";
import {
  Loader2, Zap, RefreshCw, Wrench, ChevronUp, ChevronDown,
  Receipt, Percent, DollarSign, Layers, TrendingUp, TrendingDown,
  CreditCard, Banknote, QrCode, FileText, Calendar, ArrowRightLeft,
} from "lucide-react";
import { Modal } from "../../modal";
import { Button } from "../../button";
import { useData } from "../../../../contexts/DataContext";
import { useLocalization } from "../../../../contexts/LocalizationContext";
import { cn } from "../../../../lib/utils";
import { toast } from "sonner";

const PAYMENT_OPTIONS = [
  { id: "Pix", label: "Pix", icon: QrCode },
  { id: "Cartão de Crédito", label: "Crédito", icon: CreditCard },
  { id: "Boleto Bancário", label: "Boleto", icon: FileText },
  { id: "Cartão de Débito", label: "Débito", icon: CreditCard },
  { id: "Dinheiro", label: "Dinheiro", icon: Banknote },
  { id: "Transferência / TED", label: "TED", icon: ArrowRightLeft },
  { id: "Link de Pagamento", label: "Link Pgto.", icon: Zap },
  { id: "A Prazo (Crediário)", label: "A Prazo", icon: Calendar },
] as const;

interface AddProdutoLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableProducts: any[];
  leadId?: string;
  leadName?: string;
  companyName?: string;
  seller?: string;
  /** Pré-seleciona o produto ao abrir (clique num item da lista na aba Produtos). */
  initialProductId?: string;
  /** Chamado depois que a venda é fechada com sucesso, pra quem chamou registrar no
   * histórico de alterações do lead (setAlterationLogs) sem esse modal precisar saber
   * desse detalhe. */
  onDone?: (summary: string) => void;
}

const labelClass = "text-[10px] font-bold uppercase text-[var(--color-text-muted)] mb-1 block";
const inputClass =
  "w-full bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] px-3 py-2 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-blue)] transition-all";

/**
 * Substitui o antigo "Mini PDV" embutido inline no Lead Detalhes — mesmos campos de lá
 * (recorrência/vigência, implantação, desconto, composição comercial, forma de pagamento,
 * parcelas, cadastro rápido de produto novo), só que dentro de um modal em vez de ocupar a
 * aba inteira. A aba Produtos (ProductsSection.tsx) agora só lista os produtos — quem quer
 * vender abre esse modal, que continua fechando a venda de verdade: cria a proposta com o
 * item, lança o valor a receber no financeiro, acumula no lead e marca como Fechado.
 */
export function AddProdutoLeadModal({
  isOpen,
  onClose,
  availableProducts,
  leadId,
  leadName,
  companyName,
  seller,
  initialProductId,
  onDone,
}: AddProdutoLeadModalProps) {
  const { createProposalWithItems, addFinanceEntry, updateLead, addNotification, leads } = useData();
  const { formatCurrency } = useLocalization();

  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [itemIsRecurring, setItemIsRecurring] = useState<boolean | null>(null);
  const [contractMonths, setContractMonths] = useState<number | null>(null);
  const [customMonthsDraft, setCustomMonthsDraft] = useState("");
  const [hasImplementation, setHasImplementation] = useState<boolean | null>(null);
  const [implementationFee, setImplementationFee] = useState<number | null>(null);
  const [discountValue, setDiscountValue] = useState(0);
  const [isFinancialBreakdownOpen, setIsFinancialBreakdownOpen] = useState(true);

  const [formaPagamento, setFormaPagamento] = useState<string>("Pix");
  const [parcelas, setParcelas] = useState(1);
  const [detalhesPagamento, setDetalhesPagamento] = useState("");
  const [dataPagamento, setDataPagamento] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setProductId(initialProductId || "");
    setQuantity(1);
    setItemIsRecurring(null);
    setContractMonths(null);
    setCustomMonthsDraft("");
    setHasImplementation(null);
    setImplementationFee(null);
    setDiscountValue(0);
    setFormaPagamento("Pix");
    setParcelas(1);
    setDetalhesPagamento("");
    setDataPagamento(new Date().toISOString().slice(0, 10));
    setSaving(false);
  }, [isOpen, initialProductId]);

  const product = availableProducts.find((p) => p.id === productId);

  const isRecurring = itemIsRecurring ?? !!(product?.recurrence || product?.typeAttributes?.isRecurring || product?.type === "Assinatura" || product?.category === "Software");
  const months = contractMonths ?? (product?.contractMonths || product?.typeAttributes?.contractMonths || (isRecurring ? 12 : 1));
  const implFee = implementationFee ?? (hasImplementation === false ? 0 : (product?.implementationFee || product?.typeAttributes?.implementationFee || (product?.category === "Implantação" ? Number(product?.price) || 0 : 0)));
  const showImplToggle = hasImplementation ?? implFee > 0;

  const unitPrice = Number(product?.price) || 0;
  const monthlyPrice = unitPrice * quantity;
  const contractTotal = isRecurring ? monthlyPrice * months + (showImplToggle ? implFee : 0) : monthlyPrice + (showImplToggle ? implFee : 0);
  const finalTotal = Math.max(0, contractTotal - (discountValue || 0));
  const totalCost = (Number(product?.cost) || 0) * quantity;
  const totalCommission = contractTotal * ((Number(product?.commission) || 0) / 100);
  const netProfit = finalTotal - totalCost - totalCommission;
  const marginPercent = finalTotal > 0 ? Math.round((netProfit / finalTotal) * 100) : 0;

  const totalMonthlyMRR = isRecurring ? monthlyPrice : 0;
  const totalOnetime = !isRecurring ? monthlyPrice : 0;
  const totalImplementation = showImplToggle ? implFee : 0;
  const firstPaymentTotal = Math.max(0, totalImplementation + totalMonthlyMRR + totalOnetime - (discountValue || 0));

  const valorParcela = useMemo(() => (parcelas > 1 ? finalTotal / parcelas : finalTotal), [finalTotal, parcelas]);

  const handleSubmit = async () => {
    if (!product) {
      toast.error("Selecione um produto.");
      return;
    }
    setSaving(true);
    try {
      const clientName = companyName || leadName || "Cliente";
      const items: any[] = [{
        productId: product.id,
        descricao: isRecurring ? `${product.name} (Assinatura Recorrente — ${months} meses)` : product.name,
        quantidade: isRecurring ? months * quantity : quantity,
        precoUnitario: unitPrice,
        billingType: isRecurring ? "recurring" : "one_time",
        contractMonths: isRecurring ? months : null,
      }];
      if (showImplToggle && implFee > 0) {
        items.push({
          productId: product.id,
          descricao: `Taxa de Implantação e Setup Inicial — ${product.name}`,
          quantidade: 1,
          precoUnitario: implFee,
          billingType: "one_time",
          contractMonths: null,
        });
      }

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
        itens: items,
      });

      const dueDate = dataPagamento || new Date().toISOString().slice(0, 10);
      const isInstantPayment = formaPagamento === "Dinheiro" || formaPagamento === "Pix" || formaPagamento === "Cartão de Débito";
      const formattedDate = new Date(dueDate + "T12:00:00").toLocaleDateString("pt-BR");
      const installmentInfo = parcelas > 1 ? ` (${parcelas}x de ${formatCurrency(valorParcela)})` : " (À Vista)";
      const paymentInfoStr = `Forma: ${formaPagamento}${installmentInfo} | Data: ${formattedDate}${detalhesPagamento ? ` - Obs: ${detalhesPagamento}` : ""}`;

      await addFinanceEntry({
        description: `Venda — ${clientName} | ${product.name} | ${paymentInfoStr}`,
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
          customFields: {
            tags: ["Venda", formaPagamento, `${parcelas}x`],
            formaPagamento,
            parcelas,
            valorParcela,
            dataPagamento: dueDate,
            detalhesPagamento,
          },
        });
      }

      addNotification({
        title: `🎉 Venda Concluída: ${clientName}`,
        description: `Venda de ${formatCurrency(finalTotal)} (${product.name}) processada via ${formaPagamento}${installmentInfo}.`,
        type: "success",
        link_url: "/app/crm/propostas",
      });

      toast.success("⚡ Venda concluída e automatizada!", {
        description: "Proposta criada, contas a receber provisionado e lead atualizado.",
      });
      onDone?.(`⚡ Produto "${product.name}" adicionado — venda de ${formatCurrency(finalTotal)} via ${formaPagamento}${installmentInfo} (Data: ${formattedDate}): proposta gerada, contas a receber lançado e lead atualizado.`);
      onClose();
    } catch (err: any) {
      toast.error("Erro ao processar a venda: " + err?.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Novo Produto" maxWidth="max-w-2xl">
      <div className="space-y-4 max-h-[75vh] overflow-y-auto scrollbar-thin pr-1">
        {/* ── PRODUTO ── */}
        <div>
          <label className={labelClass}>Produto *</label>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputClass}>
            <option value="">Selecione um produto...</option>
            {availableProducts.map((p) => (
              <option key={p.id} value={p.id}>{p.name} — {formatCurrency(Number(p.price) || 0)}</option>
            ))}
          </select>
        </div>

        {product && (
          <>
            {/* ── QUANTIDADE / RECORRÊNCIA / VIGÊNCIA / IMPLANTAÇÃO ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Quantidade</label>
                <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Tipo de cobrança</label>
                <button
                  type="button"
                  onClick={() => setItemIsRecurring(!isRecurring)}
                  className={cn(
                    "w-full h-[34px] px-3 rounded-[var(--radius-control)] border text-xs font-bold flex items-center gap-1.5 transition-colors",
                    isRecurring
                      ? "bg-[var(--color-primary-blue)]/15 border-[var(--color-primary-blue)]/40 text-[var(--color-primary-blue)]"
                      : "bg-[var(--color-surface-sunken)] border-[var(--color-border-default)] text-[var(--color-text-muted)]"
                  )}
                >
                  <RefreshCw className="w-3.5 h-3.5" /> {isRecurring ? "Recorrente" : "Pontual"}
                </button>
              </div>
            </div>

            {isRecurring && (
              <div className="flex items-center gap-1.5 flex-wrap p-2.5 rounded-lg bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)]">
                <span className="text-[10px] font-bold text-[var(--color-text-muted)] shrink-0">Vigência:</span>
                {[1, 3, 6, 12, 24].map((m) => (
                  <button key={m} type="button" onClick={() => { setContractMonths(m); setCustomMonthsDraft(""); }}
                    className={cn("px-2 py-0.5 rounded-md font-mono font-bold text-[10px]", months === m ? "bg-[var(--color-primary-blue)] text-white" : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-elevated)]")}>
                    {m}m
                  </button>
                ))}
                <input
                  type="number" min={1} placeholder="Outro"
                  value={customMonthsDraft || ([1, 3, 6, 12, 24].includes(months) ? "" : String(months))}
                  onChange={(e) => {
                    setCustomMonthsDraft(e.target.value);
                    const v = parseInt(e.target.value, 10);
                    if (v > 0) setContractMonths(v);
                  }}
                  className="w-14 bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] rounded px-1.5 py-0.5 text-[10px] text-center font-mono font-bold"
                />
              </div>
            )}

            <div className="flex items-center gap-2.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showImplToggle} onChange={(e) => setHasImplementation(e.target.checked)} className="w-3.5 h-3.5 accent-amber-500" />
                <span className="text-[11px] font-bold text-[var(--color-text-primary)] flex items-center gap-1"><Wrench className="w-3 h-3 text-amber-500" /> Taxa de Implantação/Setup</span>
              </label>
              {showImplToggle && (
                <input
                  type="number" min={0} step={50} value={implFee}
                  onChange={(e) => setImplementationFee(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-28 bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-lg px-2 py-1 text-xs font-mono font-bold text-amber-600"
                />
              )}
            </div>

            <div>
              <label className={labelClass}>Desconto (R$)</label>
              <input
                type="number" min={0} value={discountValue}
                onChange={(e) => setDiscountValue(Math.max(0, parseFloat(e.target.value) || 0))}
                className={inputClass}
              />
            </div>

            {/* ── COMPOSIÇÃO COMERCIAL & FINANCEIRA ── */}
            <div className="bg-[var(--color-surface-sunken)] p-3.5 rounded-xl border border-[var(--color-border-subtle)] space-y-3">
              <div className="flex items-center justify-between text-[10px] uppercase font-black text-[var(--color-text-muted)]">
                <span className="flex items-center gap-1.5"><Receipt className="w-3.5 h-3.5 text-[var(--color-primary-blue)]" /> Composição Comercial & Financeira</span>
                <div className="flex items-center gap-2.5">
                  <span className="flex items-center gap-1 text-emerald-600 font-mono font-bold"><Percent className="w-3 h-3" /> Margem: {marginPercent}%</span>
                  <button type="button" onClick={() => setIsFinancialBreakdownOpen((v) => !v)} className="text-[var(--color-text-primary)]">
                    {isFinancialBreakdownOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              {isFinancialBreakdownOpen && (
                <div className="space-y-2.5 animate-in fade-in">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                    <div className="bg-[var(--color-surface-elevated)] p-2.5 rounded-lg border border-[var(--color-border-subtle)] space-y-1">
                      <span className="text-[9px] text-[var(--color-primary-blue)] flex items-center gap-1 uppercase font-bold"><DollarSign className="w-2.5 h-2.5" /> 1º Vencimento</span>
                      <span className="text-[var(--color-text-primary)] font-black text-xs block">{formatCurrency(firstPaymentTotal)}</span>
                    </div>
                    <div className="bg-[var(--color-surface-elevated)] p-2.5 rounded-lg border border-[var(--color-border-subtle)] space-y-1">
                      <span className="text-[9px] text-[var(--color-text-muted)] flex items-center gap-1 uppercase font-bold"><RefreshCw className="w-2.5 h-2.5" /> Mensalidade</span>
                      <span className="text-[var(--color-text-primary)] font-bold text-xs block">{formatCurrency(totalMonthlyMRR)}</span>
                    </div>
                    <div className="bg-[var(--color-surface-elevated)] p-2.5 rounded-lg border border-[var(--color-border-subtle)] space-y-1">
                      <span className="text-[9px] text-[var(--color-text-muted)] flex items-center gap-1 uppercase font-bold"><Layers className="w-2.5 h-2.5" /> Implantação</span>
                      <span className="text-amber-600 font-bold text-xs block">{formatCurrency(totalImplementation)}</span>
                    </div>
                    <div className="bg-[var(--color-surface-elevated)] p-2.5 rounded-lg border border-emerald-500/20 space-y-1">
                      <span className="text-[9px] text-emerald-600 flex items-center gap-1 uppercase font-bold"><TrendingUp className="w-2.5 h-2.5" /> Total Contrato</span>
                      <span className="text-emerald-600 font-black text-xs block">{formatCurrency(finalTotal)}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs font-mono pt-2 border-t border-[var(--color-border-subtle)]">
                    <div className="bg-[var(--color-surface-elevated)] p-2 rounded-lg border border-[var(--color-border-subtle)] space-y-0.5">
                      <span className="text-[9px] text-[var(--color-text-faint)] flex items-center gap-1 uppercase"><TrendingDown className="w-2.5 h-2.5" /> Custos</span>
                      <span className="text-rose-500 font-bold text-[11px] block">{formatCurrency(totalCost)}</span>
                    </div>
                    <div className="bg-[var(--color-surface-elevated)] p-2 rounded-lg border border-[var(--color-border-subtle)] space-y-0.5">
                      <span className="text-[9px] text-[var(--color-text-faint)] flex items-center gap-1 uppercase"><Percent className="w-2.5 h-2.5" /> Comissão</span>
                      <span className="text-amber-600 font-bold text-[11px] block">{formatCurrency(totalCommission)}</span>
                    </div>
                    <div className="bg-[var(--color-surface-elevated)] p-2 rounded-lg border border-[var(--color-border-subtle)] space-y-0.5">
                      <span className="text-[9px] text-[var(--color-text-faint)] flex items-center gap-1 uppercase"><TrendingUp className="w-2.5 h-2.5" /> Lucro</span>
                      <span className="text-emerald-600 font-bold text-[11px] block">{formatCurrency(netProfit)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── FORMA DE PAGAMENTO & PARCELAS ── */}
            <div className="bg-[var(--color-surface-sunken)] p-3.5 rounded-xl border border-[var(--color-border-subtle)] space-y-3">
              <label className={labelClass}>Como foi o pagamento:</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PAYMENT_OPTIONS.map((method) => {
                  const isSelected = formaPagamento === method.id;
                  const Icon = method.icon;
                  return (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => {
                        setFormaPagamento(method.id);
                        if (method.id === "Pix" || method.id === "Dinheiro" || method.id === "Cartão de Débito") {
                          setDataPagamento(new Date().toISOString().slice(0, 10));
                        }
                      }}
                      className={cn(
                        "flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all",
                        isSelected
                          ? "bg-[var(--color-primary-blue)]/15 border-[var(--color-primary-blue)] text-[var(--color-text-primary)] font-bold"
                          : "bg-[var(--color-surface-elevated)] border-[var(--color-border-subtle)] text-[var(--color-text-muted)] hover:border-[var(--color-border-default)]"
                      )}
                    >
                      <Icon className={cn("w-4 h-4 shrink-0", isSelected ? "text-[var(--color-primary-blue)]" : "text-[var(--color-text-faint)]")} />
                      <span className="text-[11px] whitespace-nowrap">{method.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className={labelClass}>Vencimento</label>
                  <input type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} className={inputClass} />
                  <div className="flex items-center gap-1 mt-1">
                    {[["Hoje", 0], ["+7d", 7], ["+15d", 15], ["+30d", 30]].map(([label, days]) => (
                      <button key={label as string} type="button"
                        onClick={() => setDataPagamento(new Date(Date.now() + (days as number) * 86400000).toISOString().slice(0, 10))}
                        className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Parcelas</label>
                  <select value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))} className={inputClass}>
                    <option value={1}>1x à vista ({formatCurrency(finalTotal)})</option>
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24].map((n) => (
                      <option key={n} value={n}>{n}x de {formatCurrency(finalTotal / n)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Observação</label>
                  <input value={detalhesPagamento} onChange={(e) => setDetalhesPagamento(e.target.value)} placeholder="Ex: Cartão Visa final 4022" className={inputClass} />
                </div>
              </div>

              <div className="p-2 bg-[var(--color-surface-elevated)] rounded-lg border border-[var(--color-border-subtle)] flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-[var(--color-text-muted)]">
                  <strong className="text-[var(--color-text-primary)]">{formaPagamento}</strong>
                  {dataPagamento && <> • {new Date(dataPagamento + "T12:00:00").toLocaleDateString("pt-BR")}</>}
                </span>
                <span className="font-mono font-black text-emerald-600">
                  {parcelas > 1 ? `${parcelas}x de ${formatCurrency(valorParcela)}` : `${formatCurrency(finalTotal)} à vista`}
                </span>
              </div>
            </div>
          </>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border-subtle)] sticky bottom-0 bg-[var(--color-surface-elevated)]">
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
            {saving ? "Processando..." : "Concluir Venda & Automatizar Tudo"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
