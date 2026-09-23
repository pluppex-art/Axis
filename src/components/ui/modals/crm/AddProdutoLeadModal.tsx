import { useEffect, useMemo, useState } from "react";
import {
  Loader2, Zap, Wrench, ChevronUp, ChevronDown,
  Receipt, Percent, DollarSign, Layers, TrendingUp, TrendingDown,
  CreditCard, Banknote, QrCode, FileText, Calendar, ArrowRightLeft,
  Repeat, CalendarClock, Info,
} from "lucide-react";
import { Modal } from "../../modal";
import { Button } from "../../button";
import { useData } from "../../../../contexts/DataContext";
import { useLocalization } from "../../../../contexts/LocalizationContext";
import { cn } from "../../../../lib/utils";
import { toast } from "sonner";
import {
  calculateSale, FREQUENCY_LABELS,
  type Frequencia, type BillingType, type DiscountType,
} from "../../../../lib/saleCalculator";

const PAYMENT_OPTIONS = [
  { id: "Pix", label: "Pix", icon: QrCode },
  { id: "Cartão de Crédito", label: "Crédito", icon: CreditCard },
  { id: "Boleto Bancário", label: "Boleto", icon: FileText },
  { id: "Cartão de Débito", label: "Débito", icon: CreditCard },
  { id: "Dinheiro", label: "Dinheiro", icon: Banknote },
  { id: "Transferência / TED", label: "TED", icon: ArrowRightLeft },
  { id: "Link de Pagamento", label: "Link Pgto.", icon: Zap },
] as const;

const RECURRING_FREQUENCIES: Frequencia[] = ["mensal", "trimestral", "semestral", "anual", "personalizado"];
const DURATION_PRESETS = [1, 3, 6, 12, 24];

const DISCOUNT_OPTIONS_RECURRING: { id: DiscountType; label: string }[] = [
  { id: "none", label: "Sem desconto" },
  { id: "first_charge", label: "Só na 1ª cobrança" },
  { id: "recurring", label: "Em todo ciclo" },
  { id: "total", label: "Total do contrato" },
  { id: "percentage", label: "Percentual (%)" },
];
const DISCOUNT_OPTIONS_ONE_TIME: { id: DiscountType; label: string }[] = [
  { id: "none", label: "Sem desconto" },
  { id: "total", label: "Valor fixo (R$)" },
  { id: "percentage", label: "Percentual (%)" },
];

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
const sectionClass = "bg-[var(--color-surface-sunken)] p-3.5 rounded-xl border border-[var(--color-border-subtle)] space-y-3";
const sectionTitleClass = "text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-1.5";

/**
 * Substitui o antigo "Mini PDV" embutido inline no Lead Detalhes — mesmos campos de lá
 * (recorrência/vigência, implantação, desconto, composição comercial, forma de pagamento,
 * parcelas, cadastro rápido de produto novo), só que dentro de um modal em vez de ocupar a
 * aba inteira. A aba Produtos (ProductsSection.tsx) agora só lista os produtos — quem quer
 * vender abre esse modal, que continua fechando a venda de verdade: cria a proposta com o
 * item, lança o(s) valor(es) a receber no financeiro, acumula no lead e marca como Fechado.
 *
 * Auditoria 2026-09-23 (bug real em produção): recorrência estava sendo tratada como
 * parcelamento — "R$997/mês por 12 meses" virava "1x à vista de R$11.964". Recorrência e
 * parcelamento agora são conceitos SEPARADOS (ver src/lib/saleCalculator.ts): recorrente
 * gera N lançamentos financeiros de R$997 cada (um por ciclo, ligados por
 * recurring_group_id), nunca 1 lançamento do total do contrato.
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
  const [billingTypeOverride, setBillingTypeOverride] = useState<BillingType | null>(null);

  const [frequency, setFrequency] = useState<Frequencia>("mensal");
  const [customCycleMonthsInput, setCustomCycleMonthsInput] = useState("1");

  const [durationOverride, setDurationOverride] = useState<number | null>(null);
  const [isOpenEndedDuration, setIsOpenEndedDuration] = useState(false);
  const [customDurationDraft, setCustomDurationDraft] = useState("");

  const [hasImplementation, setHasImplementation] = useState<boolean | null>(null);
  // Guardam o texto BRUTO digitado (não um número já re-parseado a cada tecla) — campo
  // type="number" controlado por um valor numérico que o onChange reformata a cada tecla
  // tem um bug clássico do React/browser: se o número resultante de um passo intermediário
  // (ex.: "0", depois "06") não muda o bastante entre renders, alguns browsers não
  // re-normalizam o texto exibido, e o campo fica preso mostrando "0600" mesmo o valor
  // numérico real já sendo 600 por baixo. Guardando a string crua, o texto exibido é sempre
  // exatamente o que foi digitado — nunca diverge do estado.
  const [implementationFeeInput, setImplementationFeeInput] = useState<string | null>(null);

  const [discountType, setDiscountType] = useState<DiscountType>("none");
  const [discountInput, setDiscountInput] = useState("0");

  const [isFinancialBreakdownOpen, setIsFinancialBreakdownOpen] = useState(false);
  const [showFullSchedule, setShowFullSchedule] = useState(false);

  const [formaPagamento, setFormaPagamento] = useState<string>("Pix");
  const [installments, setInstallments] = useState(1);
  const [detalhesPagamento, setDetalhesPagamento] = useState("");
  const [firstDueDateInput, setFirstDueDateInput] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setProductId(initialProductId || "");
    setQuantity(1);
    setBillingTypeOverride(null);
    setFrequency("mensal");
    setCustomCycleMonthsInput("1");
    setDurationOverride(null);
    setIsOpenEndedDuration(false);
    setCustomDurationDraft("");
    setHasImplementation(null);
    setImplementationFeeInput(null);
    setDiscountType("none");
    setDiscountInput("0");
    setIsFinancialBreakdownOpen(false);
    setShowFullSchedule(false);
    setFormaPagamento("Pix");
    setInstallments(1);
    setDetalhesPagamento("");
    setFirstDueDateInput(new Date().toISOString().slice(0, 10));
    setSaving(false);
  }, [isOpen, initialProductId]);

  const product = availableProducts.find((p) => p.id === productId);

  const isRecurring = billingTypeOverride
    ? billingTypeOverride === "recurring"
    : !!(product?.recurrence || product?.typeAttributes?.isRecurring || product?.type === "Assinatura" || product?.category === "Software");

  const durationMonths = isOpenEndedDuration
    ? null
    : (durationOverride ?? (product?.contractMonths || product?.typeAttributes?.contractMonths || 12));

  const customCycleMonths = Math.max(1, parseInt(customCycleMonthsInput, 10) || 1);

  const implementationFeeOverride = implementationFeeInput !== null ? Math.max(0, parseFloat(implementationFeeInput) || 0) : null;
  const implFee = implementationFeeOverride ?? (hasImplementation === false ? 0 : (product?.implementationFee || product?.typeAttributes?.implementationFee || (product?.category === "Implantação" ? Number(product?.price) || 0 : 0)));
  const showImplToggle = hasImplementation ?? implFee > 0;

  const discountValue = Math.max(0, parseFloat(discountInput) || 0);
  const unitPrice = Number(product?.price) || 0;

  // Estabiliza a referência do Date (senão `new Date(...)` inline recriaria um objeto novo
  // a cada render e invalidaria o useMemo de `sale` abaixo mesmo sem a data ter mudado).
  const firstDueDate = useMemo(() => new Date(firstDueDateInput + "T12:00:00"), [firstDueDateInput]);

  const sale = useMemo(() => calculateSale({
    unitPrice,
    quantity,
    billingType: isRecurring ? "recurring" : "one_time",
    frequency,
    customCycleMonths,
    durationMonths,
    setupFee: showImplToggle ? implFee : 0,
    discountType,
    discountValue,
    installments,
    firstDueDate,
  }), [unitPrice, quantity, isRecurring, frequency, customCycleMonths, durationMonths, showImplToggle, implFee, discountType, discountValue, installments, firstDueDate]);

  // Composição Comercial (visão do vendedor: custo/comissão/margem) — sempre em cima do
  // valor TOTAL projetado da venda, nunca de um valor de ciclo isolado.
  const totalCost = (Number(product?.cost) || 0) * quantity * (isRecurring ? sale.numberOfCycles : 1);
  const totalCommission = sale.totalProjectedAmount * ((Number(product?.commission) || 0) / 100);
  const netProfit = sale.totalProjectedAmount - totalCost - totalCommission;
  const marginPercent = sale.totalProjectedAmount > 0 ? Math.round((netProfit / sale.totalProjectedAmount) * 100) : 0;

  const discountOptions = isRecurring ? DISCOUNT_OPTIONS_RECURRING : DISCOUNT_OPTIONS_ONE_TIME;
  const freqLabel = FREQUENCY_LABELS[frequency];

  // Alternar Cobrança Única ↔ Recorrente troca o conjunto de opções de desconto (ex.: "Em
  // todo ciclo" só existe pra recorrente) — sem isso o <select> ficaria apontando pra um
  // value que sumiu da lista, mostrando em branco até o usuário mexer de novo.
  useEffect(() => {
    if (!discountOptions.some((o) => o.id === discountType)) setDiscountType("none");
  }, [isRecurring]); // eslint-disable-line react-hooks/exhaustive-deps

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
        descricao: isRecurring
          ? `${product.name} (Assinatura ${freqLabel} — ${sale.numberOfCycles} ciclo${sale.numberOfCycles > 1 ? "s" : ""}${sale.isOpenEnded ? ", contínua" : ""})`
          : product.name,
        quantidade: isRecurring ? sale.numberOfCycles * quantity : quantity,
        precoUnitario: unitPrice,
        billingType: isRecurring ? "recurring" : "one_time",
        contractMonths: isRecurring ? (sale.isOpenEnded ? null : durationMonths) : null,
        frequency: isRecurring ? frequency : null,
      }];
      if (showImplToggle && implFee > 0) {
        items.push({
          productId: product.id,
          descricao: `Taxa de Implantação e Setup Inicial — ${product.name}`,
          quantidade: 1,
          precoUnitario: implFee,
          billingType: "one_time",
          contractMonths: null,
          frequency: null,
        });
      }

      await createProposalWithItems({
        titulo: `Proposta Comercial — ${clientName}`,
        cliente: clientName,
        valor: sale.totalProjectedAmount,
        validade: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        status: "Enviada",
        vendedor: seller || "Consultor S.P.Y.",
        leadId: leadId || null,
        tipo: "itens",
        conteudoTexto: null,
        itens: items,
      });

      const isInstantPayment = formaPagamento === "Dinheiro" || formaPagamento === "Pix" || formaPagamento === "Cartão de Débito";
      const groupId = crypto.randomUUID();

      // Recorrente: um lançamento POR CICLO, cada um com o valor do ciclo (nunca o total
      // do contrato numa cobrança só) — ligados por recurring_group_id, mesma convenção já
      // usada em NovaOperacaoModal.tsx/GenericFinanceiroList.tsx.
      if (isRecurring) {
        for (let i = 0; i < sale.paymentSchedule.length; i++) {
          const cycle = sale.paymentSchedule[i];
          const isFirst = i === 0;
          await addFinanceEntry({
            description: `Assinatura — ${clientName} | ${product.name} | Ciclo ${cycle.cycleNumber}/${sale.numberOfCycles}${isFirst && sale.setupAmount > 0 ? " (inclui implantação)" : ""}`,
            category: "Vendas / Serviços",
            value: cycle.amount,
            type: "Receber",
            status: isFirst && isInstantPayment ? "Pago" : "A Vencer",
            date: cycle.dueDate.toISOString().slice(0, 10),
            is_recurring: true,
            recurring_frequency: frequency,
            recurring_group_id: groupId,
            payment_method: formaPagamento,
            notes: sale.isOpenEnded
              ? "Recorrência contínua (sem prazo definido) — lote inicial de ciclos gerado agora; os próximos ciclos precisam ser gerados manualmente ou por uma automação futura."
              : (detalhesPagamento || null),
          } as any, { silent: !isFirst });
        }
      } else {
        // Cobrança única (com ou sem parcelamento): divide o MESMO total em N parcelas —
        // nunca multiplica o valor pelas parcelas. installment_group_id só quando há mais
        // de 1 parcela de verdade.
        for (let i = 0; i < sale.paymentSchedule.length; i++) {
          const cycle = sale.paymentSchedule[i];
          const isFirst = i === 0;
          await addFinanceEntry({
            description: `Venda — ${clientName} | ${product.name}${sale.numberOfCycles > 1 ? ` (parcela ${cycle.cycleNumber}/${sale.numberOfCycles})` : ""}`,
            category: "Vendas / Serviços",
            value: cycle.amount,
            type: "Receber",
            status: isFirst && isInstantPayment ? "Pago" : "A Vencer",
            date: cycle.dueDate.toISOString().slice(0, 10),
            ...(sale.numberOfCycles > 1 ? { installment_group_id: groupId, installment_number: cycle.cycleNumber, installment_total: sale.numberOfCycles } : {}),
            payment_method: formaPagamento,
            notes: detalhesPagamento || null,
          } as any, { silent: !isFirst });
        }
      }

      // Soma com o valor já existente no lead (uma venda anterior pra esse mesmo cliente)
      // em vez de sobrescrever — mesma regra do Mini PDV que isso substitui. Acumula o
      // TOTAL PROJETADO (métrica de "valor do negócio"), nunca o valor de uma cobrança
      // isolada.
      if (leadId) {
        const currentLead = (leads || []).find((l: any) => l.id === leadId);
        const accumulatedValue = (currentLead ? Number(currentLead.value) || 0 : 0) + sale.totalProjectedAmount;
        const accumulatedProductIds = [...new Set([...(currentLead?.productIds || []), product.id])];
        await updateLead(leadId, {
          value: accumulatedValue,
          productIds: accumulatedProductIds,
          status: "Fechado",
          scoreIA: 100,
          temperature: "quente",
          customFields: {
            tags: ["Venda", formaPagamento, isRecurring ? `${sale.numberOfCycles}x ${freqLabel}` : (sale.numberOfCycles > 1 ? `${sale.numberOfCycles}x` : "1x")],
            billingType: isRecurring ? "recurring" : "one_time",
            frequency: isRecurring ? frequency : null,
            numberOfCycles: sale.numberOfCycles,
            cycleAmount: sale.cycleAmount,
            setupAmount: sale.setupAmount,
            firstChargeAmount: sale.firstChargeAmount,
            totalProjectedAmount: sale.totalProjectedAmount,
            formaPagamento,
            installments: isRecurring ? null : sale.numberOfCycles,
            dataPagamento: firstDueDateInput,
            detalhesPagamento,
          },
        });
      }

      const resumoMsg = isRecurring
        ? `${formatCurrency(sale.cycleAmount)}/${freqLabel.toLowerCase()} — 1ª cobrança ${formatCurrency(sale.firstChargeAmount)}, ${sale.numberOfCycles} ciclos, total previsto ${formatCurrency(sale.totalProjectedAmount)}`
        : `${formatCurrency(sale.firstChargeAmount)}${sale.numberOfCycles > 1 ? ` (1ª de ${sale.numberOfCycles}x)` : ""} via ${formaPagamento}`;

      addNotification({
        title: `🎉 Venda Concluída: ${clientName}`,
        description: `${product.name} — ${resumoMsg}`,
        type: "success",
        link_url: "/app/crm/propostas",
      });

      toast.success("⚡ Venda concluída e automatizada!", {
        description: isRecurring
          ? `Proposta criada, ${sale.numberOfCycles} cobrança(s) recorrente(s) lançada(s) no financeiro e lead atualizado.`
          : "Proposta criada, contas a receber provisionado e lead atualizado.",
      });
      onDone?.(`⚡ Produto "${product.name}" adicionado — ${resumoMsg}: proposta gerada, financeiro lançado e lead atualizado.`);
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
        {/* ── 1. PRODUTO ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className={labelClass}>Produto *</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputClass}>
              <option value="">Selecione um produto...</option>
              {availableProducts.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {formatCurrency(Number(p.price) || 0)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Quantidade</label>
            <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))} className={inputClass} />
          </div>
        </div>

        {product && (
          <>
            {/* ── 2. COBRANÇA ── */}
            <div>
              <label className={labelClass}>Tipo de cobrança</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBillingTypeOverride("one_time")}
                  className={cn(
                    "h-9 px-3 rounded-[var(--radius-control)] border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors",
                    !isRecurring
                      ? "bg-[var(--color-primary-blue)]/15 border-[var(--color-primary-blue)]/40 text-[var(--color-primary-blue)]"
                      : "bg-[var(--color-surface-elevated)] border-[var(--color-border-default)] text-[var(--color-text-muted)]"
                  )}
                >
                  <DollarSign className="w-3.5 h-3.5" /> Cobrança Única
                </button>
                <button
                  type="button"
                  onClick={() => setBillingTypeOverride("recurring")}
                  className={cn(
                    "h-9 px-3 rounded-[var(--radius-control)] border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors",
                    isRecurring
                      ? "bg-[var(--color-primary-blue)]/15 border-[var(--color-primary-blue)]/40 text-[var(--color-primary-blue)]"
                      : "bg-[var(--color-surface-elevated)] border-[var(--color-border-default)] text-[var(--color-text-muted)]"
                  )}
                >
                  <Repeat className="w-3.5 h-3.5" /> Recorrente
                </button>
              </div>
            </div>

            {/* ── 3. CONFIGURAÇÃO DA RECORRÊNCIA (ou parcelamento, se pontual) ── */}
            {isRecurring ? (
              <div className={sectionClass}>
                <span className={sectionTitleClass}><Repeat className="w-3.5 h-3.5 text-[var(--color-primary-blue)]" /> Configuração da Recorrência</span>

                <div>
                  <span className="text-[10px] font-bold text-[var(--color-text-muted)] block mb-1">Frequência</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {RECURRING_FREQUENCIES.map((f) => (
                      <button key={f} type="button" onClick={() => setFrequency(f)}
                        className={cn("px-2.5 py-1 rounded-md font-bold text-[10px]", frequency === f ? "bg-[var(--color-primary-blue)] text-white" : "bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] hover:bg-[var(--color-border-default)]")}>
                        {FREQUENCY_LABELS[f]}
                      </button>
                    ))}
                    {frequency === "personalizado" && (
                      <span className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
                        a cada
                        <input
                          type="number" min={1}
                          value={customCycleMonthsInput}
                          onChange={(e) => setCustomCycleMonthsInput(e.target.value)}
                          className="w-12 bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] rounded px-1.5 py-0.5 text-[10px] text-center font-mono font-bold"
                        />
                        mês(es)
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-[var(--color-text-muted)] block mb-1">Vigência</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {DURATION_PRESETS.map((m) => (
                      <button key={m} type="button" onClick={() => { setDurationOverride(m); setIsOpenEndedDuration(false); setCustomDurationDraft(""); }}
                        className={cn("px-2 py-0.5 rounded-md font-mono font-bold text-[10px]", !isOpenEndedDuration && durationMonths === m ? "bg-[var(--color-primary-blue)] text-white" : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-elevated)]")}>
                        {m}m
                      </button>
                    ))}
                    <input
                      type="number" min={1} placeholder="Outro"
                      value={customDurationDraft || (!isOpenEndedDuration && DURATION_PRESETS.includes(durationMonths as number) ? "" : (isOpenEndedDuration ? "" : String(durationMonths)))}
                      onChange={(e) => {
                        setCustomDurationDraft(e.target.value);
                        const v = parseInt(e.target.value, 10);
                        if (v > 0) { setDurationOverride(v); setIsOpenEndedDuration(false); }
                      }}
                      className="w-14 bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] rounded px-1.5 py-0.5 text-[10px] text-center font-mono font-bold"
                    />
                    <button type="button" onClick={() => setIsOpenEndedDuration(true)}
                      className={cn("px-2 py-0.5 rounded-md font-bold text-[10px]", isOpenEndedDuration ? "bg-[var(--color-primary-blue)] text-white" : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-elevated)]")}>
                      Sem prazo
                    </button>
                  </div>
                  {isOpenEndedDuration && (
                    <p className="text-[10px] text-amber-600 mt-1.5 flex items-start gap-1">
                      <Info className="w-3 h-3 shrink-0 mt-0.5" />
                      Recorrência contínua: gera um lote inicial de {sale.numberOfCycles} ciclos agora; ciclos futuros precisam ser gerados manualmente (ainda não existe cobrança recorrente automática neste sistema).
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <div className="bg-[var(--color-surface-elevated)] p-2.5 rounded-lg border border-[var(--color-border-subtle)]">
                    <span className="text-[9px] font-bold uppercase text-[var(--color-text-faint)] block">Valor por ciclo</span>
                    <span className="text-sm font-black text-[var(--color-text-primary)] font-mono">{formatCurrency(sale.cycleAmount)}</span>
                    <span className="text-[9px] text-[var(--color-text-faint)] block">/ {freqLabel.toLowerCase()}</span>
                  </div>
                  <div className="bg-[var(--color-surface-elevated)] p-2.5 rounded-lg border border-[var(--color-border-subtle)]">
                    <span className="text-[9px] font-bold uppercase text-[var(--color-text-faint)] block flex items-center gap-1"><CalendarClock className="w-2.5 h-2.5" /> Próxima cobrança</span>
                    <span className="text-sm font-black text-[var(--color-text-primary)] font-mono">
                      {sale.nextDueDate ? sale.nextDueDate.toLocaleDateString("pt-BR") : "—"}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className={sectionClass}>
                <span className={sectionTitleClass}><Layers className="w-3.5 h-3.5 text-[var(--color-primary-blue)]" /> Parcelamento</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[1, 2, 3, 4, 5, 6, 10, 12].map((n) => (
                    <button key={n} type="button" onClick={() => setInstallments(n)}
                      className={cn("px-2.5 py-1 rounded-md font-bold text-[10px]", installments === n ? "bg-[var(--color-primary-blue)] text-white" : "bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] hover:bg-[var(--color-border-default)]")}>
                      {n === 1 ? "1x à vista" : `${n}x`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── 4. IMPLANTAÇÃO E DESCONTO ── */}
            <div className={sectionClass}>
              <span className={sectionTitleClass}><Wrench className="w-3.5 h-3.5 text-amber-500" /> Implantação & Desconto</span>

              <div className="flex items-center gap-2.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showImplToggle} onChange={(e) => setHasImplementation(e.target.checked)} className="w-3.5 h-3.5 accent-amber-500" />
                  <span className="text-[11px] font-bold text-[var(--color-text-primary)]">Taxa de Implantação/Setup</span>
                </label>
                {showImplToggle && (
                  <>
                    <input
                      type="number" min={0} step={50} value={implementationFeeInput ?? String(implFee)}
                      onChange={(e) => setImplementationFeeInput(e.target.value)}
                      className="w-28 bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] rounded-lg px-2 py-1 text-xs font-mono font-bold text-amber-600"
                    />
                    <span className="text-[9px] text-[var(--color-text-faint)] font-bold uppercase">Somente na 1ª cobrança</span>
                  </>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <span className="text-[10px] font-bold text-[var(--color-text-muted)] block mb-1">Tipo de desconto</span>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as DiscountType)}
                    className="w-full bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] px-3 py-2 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-blue)]"
                  >
                    {discountOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </div>
                {discountType !== "none" && (
                  <div>
                    <span className="text-[10px] font-bold text-[var(--color-text-muted)] block mb-1">
                      {discountType === "percentage" ? "Percentual (%)" : "Valor (R$)"}
                    </span>
                    <input
                      type="number" min={0} value={discountInput}
                      onChange={(e) => setDiscountInput(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                )}
              </div>
              {discountType !== "none" && (
                <p className="text-[10px] text-[var(--color-text-faint)]">
                  {discountType === "first_charge" && "Reduz só a 1ª cobrança — as próximas saem pelo valor cheio do ciclo."}
                  {discountType === "recurring" && "Reduz TODAS as cobranças, inclusive a 1ª — mesmo desconto em cada ciclo."}
                  {discountType === "total" && isRecurring && "Valor total a descontar do contrato, dividido igualmente entre todos os ciclos."}
                  {discountType === "total" && !isRecurring && "Reduz o valor total da venda antes de dividir nas parcelas."}
                  {discountType === "percentage" && (isRecurring ? "Percentual aplicado sobre o valor de cada ciclo." : "Percentual aplicado sobre o valor total da venda.")}
                </p>
              )}
            </div>

            {/* ── COMPOSIÇÃO COMERCIAL & FINANCEIRA (visão do vendedor — custo/comissão/margem) ── */}
            <div className={sectionClass}>
              <div className="flex items-center justify-between">
                <span className={sectionTitleClass}><Receipt className="w-3.5 h-3.5 text-[var(--color-primary-blue)]" /> Composição Comercial & Financeira</span>
                <div className="flex items-center gap-2.5">
                  <span className="flex items-center gap-1 text-emerald-600 font-mono font-bold text-[10px]"><Percent className="w-3 h-3" /> Margem: {marginPercent}%</span>
                  <button type="button" onClick={() => setIsFinancialBreakdownOpen((v) => !v)} className="text-[var(--color-text-primary)]">
                    {isFinancialBreakdownOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              {isFinancialBreakdownOpen && (
                <div className="grid grid-cols-3 gap-2 text-xs font-mono pt-1 animate-in fade-in">
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
              )}
            </div>

            {/* ── 5. PAGAMENTO ── */}
            <div className={sectionClass}>
              <span className={sectionTitleClass}><CreditCard className="w-3.5 h-3.5 text-[var(--color-primary-blue)]" /> Pagamento</span>
              <div>
                <span className="text-[10px] font-bold text-[var(--color-text-muted)] block mb-1">Forma de pagamento</span>
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
                            setFirstDueDateInput(new Date().toISOString().slice(0, 10));
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
              </div>

              <div>
                <label className={labelClass}>{isRecurring ? "1º Vencimento" : "Vencimento"}</label>
                <input type="date" value={firstDueDateInput} onChange={(e) => setFirstDueDateInput(e.target.value)} className={inputClass} />
                <div className="flex items-center gap-1 mt-1">
                  {[["Hoje", 0], ["+7d", 7], ["+15d", 15], ["+30d", 30]].map(([label, days]) => (
                    <button key={label as string} type="button"
                      onClick={() => setFirstDueDateInput(new Date(Date.now() + (days as number) * 86400000).toISOString().slice(0, 10))}
                      className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Prévia do cronograma de cobranças ── */}
              <div className="space-y-1.5 pt-1 border-t border-[var(--color-border-subtle)]">
                <span className="text-[10px] font-bold text-[var(--color-text-muted)] flex items-center gap-1"><Calendar className="w-3 h-3" /> Cronograma de cobranças</span>
                {(showFullSchedule ? sale.paymentSchedule : sale.paymentSchedule.slice(0, 3)).map((cycle) => (
                  <div key={cycle.cycleNumber} className="flex items-center justify-between text-[11px] bg-[var(--color-surface-elevated)] px-2.5 py-1.5 rounded-lg border border-[var(--color-border-subtle)]">
                    <span className="text-[var(--color-text-muted)] font-bold">{cycle.cycleNumber}ª cobrança — {cycle.dueDate.toLocaleDateString("pt-BR")}</span>
                    <span className="font-mono font-black text-[var(--color-text-primary)]">{formatCurrency(cycle.amount)}</span>
                  </div>
                ))}
                {sale.paymentSchedule.length > 3 && (
                  <button type="button" onClick={() => setShowFullSchedule((v) => !v)} className="text-[10px] font-bold text-[var(--color-primary-blue)] hover:underline">
                    {showFullSchedule ? "Ocultar cronograma" : `Ver cronograma completo (${sale.paymentSchedule.length})`}
                  </button>
                )}
              </div>
            </div>

            {/* ── 6. RESUMO FINANCEIRO (contextual) ── */}
            <div className="bg-[var(--color-primary-blue)]/5 border border-[var(--color-primary-blue)]/20 rounded-xl p-3.5 space-y-2.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-primary-blue)] flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5" /> {isRecurring ? "Resumo da Assinatura" : "Resumo da Venda"}
              </span>
              {isRecurring ? (
                <>
                  <div className="flex items-baseline justify-between">
                    <span className="text-lg font-black text-[var(--color-text-primary)] font-mono">{formatCurrency(sale.cycleAmount)}</span>
                    <span className="text-[10px] font-bold text-[var(--color-text-muted)]">/ {freqLabel.toLowerCase()} · {sale.numberOfCycles} ciclo{sale.numberOfCycles > 1 ? "s" : ""}{sale.isOpenEnded ? " (contínua)" : ""}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs font-mono pt-2 border-t border-[var(--color-primary-blue)]/10">
                    <div>
                      <span className="text-[9px] text-[var(--color-text-faint)] uppercase font-bold block">1ª cobrança</span>
                      <span className="font-black text-[var(--color-text-primary)]">{formatCurrency(sale.firstChargeAmount)}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-[var(--color-text-faint)] uppercase font-bold block">Total previsto{sale.isOpenEnded ? " (12 ciclos)" : ""}</span>
                      <span className="font-black text-emerald-600">{formatCurrency(sale.totalProjectedAmount)}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-[var(--color-text-faint)] uppercase font-bold block">Próximo vencimento</span>
                      <span className="font-black text-[var(--color-text-primary)]">{sale.nextDueDate ? sale.nextDueDate.toLocaleDateString("pt-BR") : "—"}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[var(--color-text-muted)]">
                    {sale.numberOfCycles > 1 ? `${sale.numberOfCycles}x de` : "À vista"}
                  </span>
                  <span className="text-lg font-black text-emerald-600 font-mono">
                    {sale.numberOfCycles > 1 ? formatCurrency(sale.recurringChargeAmount) : formatCurrency(sale.firstChargeAmount)}
                  </span>
                </div>
              )}
            </div>

            {/* ── 7. OBSERVAÇÃO ── */}
            <div>
              <label className={labelClass}>Observação</label>
              <input value={detalhesPagamento} onChange={(e) => setDetalhesPagamento(e.target.value)} placeholder="Ex: Cartão Visa final 4022" className={inputClass} />
            </div>
          </>
        )}

        {/* ── 8. AÇÕES ── */}
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
