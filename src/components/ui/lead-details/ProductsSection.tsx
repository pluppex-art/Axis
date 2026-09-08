import { useState, useMemo } from "react";
import { Card } from "../card";
import { Button } from "../button";
import { EmptyState } from "../empty-state";
import { Badge } from "../badge";
import {
  FileText,
  Package,
  Plus,
  Trash2,
  ShoppingCart,
  Search,
  Check,
  TrendingUp,
  DollarSign,
  Layers,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Zap,
  Edit3,
  Loader2,
  RefreshCw,
  Wrench,
  CreditCard,
  Banknote,
  QrCode,
  Calendar,
  ArrowRightLeft,
} from "lucide-react";
import { toast } from "sonner";
import { useData } from "../../../contexts/DataContext";
import { handleDownloadPdf } from "../../../pages/crm/utils/proposalPdf";
import {
  PropostaEditorWordModal,
  PropostaEditorData,
} from "../modals/crm/PropostaEditorWordModal";
import { cn } from "../../../lib/utils";

interface ProductsSectionProps {
  estimatedSum: number;
  availableProducts: any[];
  linkedProductIds: string[];
  productQuantities?: Record<string, number>;
  updateProductQuantity?: (prodId: string, qty: number) => void;
  handleCreateAndLinkProduct?: (data: {
    name: string;
    price: number;
    cost?: number;
    commission?: number;
    category?: string;
    type?: string;
    sku?: string;
    recurrence?: boolean;
    contractMonths?: number;
    hasImplementation?: boolean;
    implementationFee?: number;
  }) => Promise<string>;
  toggleProductLink: (id: string) => void;
  seller: string;
  setAlterationLogs: any;
  leadName?: string;
  companyName?: string;
  leadId?: string;
}

export function ProductsSection({
  estimatedSum,
  availableProducts = [],
  linkedProductIds = [],
  productQuantities = {},
  updateProductQuantity,
  handleCreateAndLinkProduct,
  toggleProductLink,
  seller,
  setAlterationLogs,
  leadName,
  companyName,
  leadId,
}: ProductsSectionProps) {
  const {
    createProposalWithItems,
    addFinanceEntry,
    updateLead,
    addNotification,
    turmas,
    updateTurma,
  } = useData();

  // Mini PDV State
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [showAddForm, setShowAddForm] = useState(false);
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [isAutomating, setIsAutomating] = useState(false);

  // Per-Item Recurrence & Implementation Configuration in PDV
  const [itemRecurrences, setItemRecurrences] = useState<Record<string, boolean>>({});
  const [itemMonths, setItemMonths] = useState<Record<string, number>>({});
  const [itemImplFees, setItemImplFees] = useState<Record<string, number>>({});
  // Rascunho do input "Outro" de vigência — separado de itemMonths porque o
  // valor exibido não pode ser derivado direto de contractMonths: como "1" é
  // um dos presets, digitar "15" dígito a dígito faria o campo esvaziar após
  // o primeiro caractere (contractMonths viraria 1, que já tem botão próprio).
  const [customMonthsDraft, setCustomMonthsDraft] = useState<Record<string, string>>({});

  // Payment & Installment State (Mini PDV)
  const [formaPagamento, setFormaPagamento] = useState<
    "Pix" | "Cartão de Crédito" | "Boleto Bancário" | "Cartão de Débito" | "Dinheiro" | "Transferência / TED" | "Link de Pagamento" | "A Prazo (Crediário)"
  >("Pix");
  const [parcelas, setParcelas] = useState<number>(1);
  const [detalhesPagamento, setDetalhesPagamento] = useState<string>("");
  const [dataPagamento, setDataPagamento] = useState<string>(() => new Date().toISOString().slice(0, 10));

  // Word Editor Modal State
  const [isWordModalOpen, setIsWordModalOpen] = useState(false);
  const [currentProposalData, setCurrentProposalData] = useState<PropostaEditorData | null>(null);

  // New Product Form State
  const [newProdName, setNewProdName] = useState("");
  const [newProdPrice, setNewProdPrice] = useState("");
  const [newProdCost, setNewProdCost] = useState("");
  const [newProdCommission, setNewProdCommission] = useState("5");
  const [newProdCategory, setNewProdCategory] = useState("Software");
  const [newProdType, setNewProdType] = useState("Digital");
  const [newProdIsRecurring, setNewProdIsRecurring] = useState(false);
  const [newProdMonths, setNewProdMonths] = useState("12");
  const [newProdHasImpl, setNewProdHasImpl] = useState(false);
  const [newProdImplFee, setNewProdImplFee] = useState("0");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories = ["Todas", "Software", "Serviços", "Implantação", "Mentoria", "Curso/Turma", "Assinatura", "Físico"];

  // Linked items with quantity, recurrence and implementation fee
  const linkedItems = useMemo(() => {
    return linkedProductIds
      .map((id) => {
        const prod = availableProducts.find((p) => p.id === id);
        if (!prod) return null;
        const qty = productQuantities[id] || 1;

        const isRecurring =
          itemRecurrences[id] ??
          !!(
            prod.recurrence ||
            prod.typeAttributes?.isRecurring ||
            prod.type === "Assinatura" ||
            prod.category === "Software"
          );

        const contractMonths =
          itemMonths[id] ??
          (prod.contractMonths ||
            prod.typeAttributes?.contractMonths ||
            (isRecurring ? 12 : 1));

        const implFee =
          itemImplFees[id] ??
          (prod.implementationFee ||
            prod.typeAttributes?.implementationFee ||
            (prod.category === "Implantação" ? prod.price : 0));

        const monthlyPrice = prod.price * qty;
        const contractTotal = isRecurring
          ? monthlyPrice * contractMonths + implFee
          : monthlyPrice + implFee;

        const totalCost = (prod.cost || 0) * qty;
        const totalCommission = contractTotal * ((prod.commission || 0) / 100);

        return {
          ...prod,
          quantity: qty,
          isRecurring,
          contractMonths,
          implFee,
          monthlyPrice,
          subtotal: contractTotal,
          totalCost,
          totalCommission,
        };
      })
      .filter(Boolean) as Array<any>;
  }, [linkedProductIds, availableProducts, productQuantities, itemRecurrences, itemMonths, itemImplFees]);

  // PDV Metric Totals
  const totalMonthlyMRR = linkedItems
    .filter((item) => item.isRecurring)
    .reduce((acc, item) => acc + item.monthlyPrice, 0);

  const totalImplementation = linkedItems.reduce(
    (acc, item) => acc + item.implFee,
    0
  );

  const totalOnetime = linkedItems
    .filter((item) => !item.isRecurring)
    .reduce((acc, item) => acc + item.monthlyPrice, 0);

  // Entrada imediata (1º pagamento): Implantação + 1ª mensalidade + itens únicos
  const firstPaymentTotal = Math.max(
    0,
    totalImplementation + totalMonthlyMRR + totalOnetime - (discountValue || 0)
  );

  // Valor Total do Contrato (LTV / TCV)
  const subtotalRaw = linkedItems.reduce((acc, item) => acc + item.subtotal, 0);
  const totalCost = linkedItems.reduce((acc, item) => acc + item.totalCost, 0);
  const totalCommission = linkedItems.reduce((acc, item) => acc + item.totalCommission, 0);
  const finalTotal = Math.max(0, subtotalRaw - (discountValue || 0));
  const netProfit = finalTotal - totalCost - totalCommission;
  const marginPercent = finalTotal > 0 ? Math.round((netProfit / finalTotal) * 100) : 0;

  // Valor por Parcela
  const valorParcela = useMemo(() => {
    if (parcelas <= 1) return finalTotal;
    return finalTotal / parcelas;
  }, [finalTotal, parcelas]);

  const PAYMENT_OPTIONS = [
    { id: "Pix", label: "Pix", icon: QrCode },
    { id: "Cartão de Crédito", label: "Cartão Crédito", icon: CreditCard },
    { id: "Boleto Bancário", label: "Boleto", icon: FileText },
    { id: "Cartão de Débito", label: "Cartão Débito", icon: CreditCard },
    { id: "Dinheiro", label: "Dinheiro", icon: Banknote },
    { id: "Transferência / TED", label: "TED / Transferência", icon: ArrowRightLeft },
    { id: "Link de Pagamento", label: "Link de Pagamento", icon: Zap },
    { id: "A Prazo (Crediário)", label: "A Prazo / Crediário", icon: Calendar },
  ] as const;

  // Filter available products
  const filteredCatalog = useMemo(() => {
    return availableProducts.filter((p) => {
      const matchName = (p.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.category || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = selectedCategory === "Todas" || p.category === selectedCategory;
      return matchName && matchCat;
    });
  }, [availableProducts, searchTerm, selectedCategory]);

  const handleQuickAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim() || !newProdPrice) {
      toast.error("Informe o Nome e Preço de Venda do produto.");
      return;
    }

    const priceNum = parseFloat(newProdPrice.replace(",", ".")) || 0;
    const costNum = parseFloat(newProdCost.replace(",", ".")) || 0;
    const commNum = parseFloat(newProdCommission.replace(",", ".")) || 0;

    if (priceNum <= 0) {
      toast.error("O preço deve ser maior que zero.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (handleCreateAndLinkProduct) {
        await handleCreateAndLinkProduct({
          name: newProdName.trim(),
          price: priceNum,
          cost: costNum,
          commission: commNum,
          category: newProdCategory,
          type: newProdType,
          recurrence: newProdIsRecurring,
          contractMonths: newProdIsRecurring ? (parseInt(newProdMonths) || 12) : 1,
          hasImplementation: newProdHasImpl,
          implementationFee: newProdHasImpl ? (parseFloat(newProdImplFee.replace(",", ".")) || 0) : 0,
        });
      } else {
        toast.info("Produto adicionado localmente.");
      }

      // Reset form
      setNewProdName("");
      setNewProdPrice("");
      setNewProdCost("");
      setNewProdCommission("5");
      setNewProdIsRecurring(false);
      setNewProdMonths("12");
      setNewProdHasImpl(false);
      setNewProdImplFee("0");
      setShowAddForm(false);
    } catch (err: any) {
      toast.error("Erro ao cadastrar produto: " + err?.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQtyChange = (prodId: string, currentQty: number, delta: number) => {
    const next = Math.max(1, currentQty + delta);
    if (updateProductQuantity) {
      updateProductQuantity(prodId, next);
    }
  };

  const getDetailedProposalItems = () => {
    const items: Array<{
      productId?: string;
      product_name: string;
      descricao: string;
      quantidade: number;
      preco_unitario: number;
      precoUnitario: number;
    }> = [];

    linkedItems.forEach((p) => {
      if (p.isRecurring) {
        items.push({
          productId: p.id,
          product_name: `${p.name} (Assinatura Recorrente — ${p.contractMonths} meses)`,
          descricao: `${p.name} (Assinatura Recorrente — ${p.contractMonths} meses)`,
          quantidade: p.contractMonths * p.quantity,
          preco_unitario: p.price,
          precoUnitario: p.price,
        });
      } else {
        items.push({
          productId: p.id,
          product_name: p.name,
          descricao: p.name,
          quantidade: p.quantity,
          preco_unitario: p.price,
          precoUnitario: p.price,
        });
      }

      if (p.implFee > 0) {
        items.push({
          productId: p.id,
          product_name: `Taxa de Implantação e Setup Inicial — ${p.name}`,
          descricao: `Taxa de Implantação e Setup Inicial — ${p.name}`,
          quantidade: 1,
          preco_unitario: p.implFee,
          precoUnitario: p.implFee,
        });
      }
    });

    return items;
  };

  const handleProcessFullOrder = async () => {
    if (linkedItems.length === 0) {
      toast.error("Adicione produtos ao pedido antes de processar a venda.");
      return;
    }

    setIsAutomating(true);
    try {
      const clientName = companyName || leadName || "Cliente";
      const propTitle = `Proposta Comercial — ${clientName}`;
      const detailedItems = getDetailedProposalItems();

      // 1. Criar proposta com itens no Supabase
      const proposalId = await createProposalWithItems({
        titulo: propTitle,
        cliente: clientName,
        valor: finalTotal,
        validade: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        status: "Enviada",
        vendedor: seller || "Consultor S.P.Y.",
        leadId: leadId || null,
        tipo: "itens",
        itens: detailedItems.map((p) => ({
          productId: p.productId,
          descricao: p.descricao,
          quantidade: p.quantidade,
          precoUnitario: p.precoUnitario,
        })),
      });

      // 2. Criar lançamento financeiro no Contas a Receber com forma de pagamento, parcelamento e data
      const dueDate = dataPagamento || new Date().toISOString().slice(0, 10);
      const isInstantPayment = formaPagamento === "Dinheiro" || formaPagamento === "Pix" || formaPagamento === "Cartão de Débito";
      const formattedDate = new Date(dueDate + "T12:00:00").toLocaleDateString("pt-BR");
      const installmentInfo = parcelas > 1
        ? ` (${parcelas}x de R$ ${valorParcela.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
        : " (À Vista)";
      const paymentInfoStr = `Forma: ${formaPagamento}${installmentInfo} | Data: ${formattedDate}${detalhesPagamento ? ` - Obs: ${detalhesPagamento}` : ""}`;

      await addFinanceEntry({
        description: `Venda PDV — ${clientName} | ${paymentInfoStr} (${linkedItems.length} soluções: 1º Vencimento R$ ${firstPaymentTotal.toLocaleString("pt-BR")} | Total R$ ${finalTotal.toLocaleString("pt-BR")})`,
        category: "Vendas / Serviços",
        value: finalTotal,
        type: "Receber",
        status: isInstantPayment ? "Pago" : "A Vencer",
        date: dueDate,
      });

      // 3. Atualizar Lead no banco (valor, produtos, status fechado, score 100 e dados do pagamento)
      if (leadId && updateLead) {
        await updateLead(leadId, {
          value: finalTotal,
          productIds: linkedProductIds,
          status: "Fechado",
          scoreIA: 100,
          temperature: "quente",
          customFields: {
            tags: ["Venda PDV", formaPagamento, `${parcelas}x`],
            formaPagamento,
            parcelas,
            valorParcela,
            dataPagamento: dueDate,
            detalhesPagamento,
            quantities: productQuantities,
          },
        });
      }

      // 4. Matrícula automática em Turmas (se houver cursos/mentorias)
      const EDUCATION_CATEGORIES = ["curso", "turma", "mentoria", "formação", "treinamento"];
      const eduProducts = linkedItems.filter((p) =>
        EDUCATION_CATEGORIES.some((c) => (p.category || "").toLowerCase().includes(c))
      );
      if (eduProducts.length > 0 && turmas && updateTurma && leadId) {
        for (const prod of eduProducts) {
          const turma = (turmas as any[]).find(
            (t) => t.productId === prod.id || t.curso === prod.name
          );
          if (turma) {
            const currentStudents = Array.isArray(turma.students) ? turma.students : [];
            const already = currentStudents.some(
              (s) => (typeof s === "string" ? s : s.leadId || s.id) === leadId
            );
            if (!already) {
              await updateTurma(turma.id, {
                students: [
                  ...currentStudents,
                  { leadId, name: clientName, enrolledAt: new Date().toISOString() },
                ],
              });
            }
          }
        }
      }

      // 5. Histórico e Notificações
      setAlterationLogs((prev: any[]) => [
        {
          id: Date.now().toString(),
          author: seller || "Mini PDV",
          desc: `⚡ Pedido de R$ ${finalTotal.toLocaleString("pt-BR")} concluído via ${formaPagamento}${installmentInfo} (Data: ${formattedDate}): Proposta gerada, Contas a Receber lançado e Lead atualizado.`,
          time: "Agora",
        },
        ...prev,
      ]);

      addNotification({
        title: `🎉 Venda Concluída no PDV: ${clientName}`,
        desc: `Venda de R$ ${finalTotal.toLocaleString("pt-BR")} processada via ${formaPagamento}${installmentInfo} para ${formattedDate}. Proposta vinculada e receita provisionada no financeiro.`,
        type: "success",
        category: "CRM & Vendas",
        link: "/app/crm/propostas",
      });

      const generatedProposal: PropostaEditorData = {
        id: proposalId,
        cliente: clientName,
        titulo: propTitle,
        valor: finalTotal,
        vendedor: seller || "Consultor S.P.Y.",
        status: "Enviada",
        validade: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        itens: detailedItems.map((p) => ({
          product_name: p.product_name,
          quantidade: p.quantidade,
          preco_unitario: p.preco_unitario,
        })),
      };
      setCurrentProposalData(generatedProposal);

      toast.success("⚡ Venda concluída e 100% automatizada!", {
        description: "Proposta criada, contas a receber provisionado e lead atualizado.",
        action: {
          label: "Abrir Proposta (Word)",
          onClick: () => setIsWordModalOpen(true),
        },
      });
    } catch (err: any) {
      toast.error("Erro na automação do pedido: " + err?.message);
    } finally {
      setIsAutomating(false);
    }
  };

  const handleOpenWordEditor = () => {
    const clientName = companyName || leadName || "Cliente";
    const propTitle = `Proposta Comercial — ${clientName}`;
    const detailedItems = getDetailedProposalItems();

    setCurrentProposalData({
      id: currentProposalData?.id || undefined,
      cliente: clientName,
      titulo: currentProposalData?.titulo || propTitle,
      valor: finalTotal,
      vendedor: seller || "Consultor S.P.Y.",
      status: currentProposalData?.status || "Enviada",
      validade:
        currentProposalData?.validade ||
        new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      itens: detailedItems.map((p) => ({
        product_name: p.product_name,
        quantidade: p.quantidade,
        preco_unitario: p.preco_unitario,
      })),
      conteudo_texto: currentProposalData?.conteudo_texto || null,
    });
    setIsWordModalOpen(true);
  };

  const handleGeneratePdf = () => {
    if (linkedItems.length === 0) {
      toast.info("Adicione itens ao orçamento antes de exportar.");
      return;
    }

    const detailedItems = getDetailedProposalItems();

    handleDownloadPdf(
      {
        id: `prop-${Date.now()}`,
        cliente: companyName || leadName || "Cliente",
        titulo: `Orçamento Comercial — ${companyName || leadName || "Lead"}`,
        valor: finalTotal,
        vendedor: seller || "Consultor",
        status: "Enviada",
      },
      detailedItems.map((p) => ({
        product_name: p.product_name,
        quantidade: p.quantidade,
        preco_unitario: p.preco_unitario,
      }))
    );

    setAlterationLogs((prev: any[]) => [
      {
        id: Date.now().toString(),
        author: seller || "Sistema",
        desc: `PDF do Orçamento gerado no valor de R$ ${finalTotal.toLocaleString("pt-BR")}`,
        time: "Agora",
      },
      ...prev,
    ]);
    toast.success("PDF da proposta gerado com sucesso!");
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* ── HEADER DO MINI PDV ── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <ShoppingCart className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-white">
              Mini PDV & Orçamento
            </h4>
            <p className="text-[10px] text-slate-400">
              Composição de itens e proposta comercial
            </p>
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          variant={showAddForm ? "secondary" : "default"}
          onClick={() => setShowAddForm((v) => !v)}
          className="text-[11px] font-bold h-7.5 gap-1.5 cursor-pointer"
        >
          {showAddForm ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" /> Fechar Cadastro
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5" /> + Novo Produto
            </>
          )}
        </Button>
      </div>

      {/* ── FORMULÁRIO DE CADASTRO RÁPIDO DE PRODUTO NO BANCO ── */}
      {showAddForm && (
        <Card className="p-4 bg-[var(--color-surface-elevated)] border border-blue-500/30 shadow-lg space-y-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <h5 className="text-xs font-black uppercase text-white tracking-wide">
                Cadastrar Novo Produto / Serviço no Banco
              </h5>
            </div>
            <span className="text-[10px] text-slate-400">Salva no Supabase e vincula ao lead</span>
          </div>

          <form onSubmit={handleQuickAddProduct} className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                Nome do Produto ou Serviço *
              </label>
              <input
                type="text"
                value={newProdName}
                onChange={(e) => setNewProdName(e.target.value)}
                placeholder="Ex: Consultoria de Vendas Premium"
                className="w-full bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Preço Venda (R$) *
                </label>
                <input
                  type="text"
                  value={newProdPrice}
                  onChange={(e) => setNewProdPrice(e.target.value)}
                  placeholder="0,00"
                  className="w-full bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-lg px-3 py-1.5 text-xs text-emerald-400 font-mono font-bold focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Custo (R$)
                </label>
                <input
                  type="text"
                  value={newProdCost}
                  onChange={(e) => setNewProdCost(e.target.value)}
                  placeholder="0,00"
                  className="w-full bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-lg px-3 py-1.5 text-xs text-rose-400 font-mono font-bold focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Comissão (%)
                </label>
                <input
                  type="text"
                  value={newProdCommission}
                  onChange={(e) => setNewProdCommission(e.target.value)}
                  placeholder="5"
                  className="w-full bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-lg px-3 py-1.5 text-xs text-amber-400 font-mono font-bold focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Categoria
                </label>
                <select
                  value={newProdCategory}
                  onChange={(e) => setNewProdCategory(e.target.value)}
                  className="w-full bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                >
                  <option value="Serviços">Serviços</option>
                  <option value="Software">Software</option>
                  <option value="Mentoria">Mentoria</option>
                  <option value="Curso/Turma">Curso/Turma</option>
                  <option value="Assinatura">Assinatura</option>
                  <option value="Físico">Físico</option>
                </select>
              </div>
            </div>

            {/* Recorrência e Implantação / Setup */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-2.5 rounded-lg bg-[var(--color-surface-sunken)] border border-white/5">
              {/* Recorrência */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newProdIsRecurring}
                    onChange={(e) => setNewProdIsRecurring(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0 bg-slate-900"
                  />
                  <span className="text-[11px] font-bold text-white flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 text-blue-400" /> Cobrança Recorrente (Mensalidade)
                  </span>
                </label>
                {newProdIsRecurring && (
                  <div className="pl-5 space-y-1 animate-in fade-in">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Duração do Contrato:</span>
                    <div className="flex items-center gap-1">
                      {["1", "3", "6", "12", "24"].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setNewProdMonths(m)}
                          className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer",
                            newProdMonths === m
                              ? "bg-blue-600 text-white shadow-sm"
                              : "bg-white/5 text-slate-400 hover:text-white"
                          )}
                        >
                          {m}m
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Implantação / Setup */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newProdHasImpl}
                    onChange={(e) => setNewProdHasImpl(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-700 text-amber-500 focus:ring-0 focus:ring-offset-0 bg-slate-900"
                  />
                  <span className="text-[11px] font-bold text-white flex items-center gap-1">
                    <Wrench className="w-3 h-3 text-amber-400" /> Taxa de Implantação / Setup
                  </span>
                </label>
                {newProdHasImpl && (
                  <div className="pl-5 space-y-1 animate-in fade-in">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Valor da Implantação (R$):</span>
                    <input
                      type="text"
                      value={newProdImplFee}
                      onChange={(e) => setNewProdImplFee(e.target.value)}
                      placeholder="0,00"
                      className="w-full bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] rounded px-2 py-1 text-xs text-amber-300 font-mono font-bold focus:outline-none focus:border-amber-500"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAddForm(false)}
                className="text-xs h-8"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="default"
                size="sm"
                disabled={isSubmitting}
                className="text-xs h-8 font-bold gap-1.5 bg-blue-600 hover:bg-blue-500"
              >
                <Plus className="w-3.5 h-3.5" />
                {isSubmitting ? "Cadastrando..." : "Cadastrar e Adicionar"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* ── ITENS DO PEDIDO / CHECKOUT (MINI PDV) ── */}
      <Card className="p-4 bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Itens da Proposta Comercial ({linkedItems.length})
            </span>
          </div>
          <Badge variant="success" className="font-mono text-xs font-bold px-2 py-0.5">
            Total: R$ {finalTotal.toLocaleString("pt-BR")}
          </Badge>
        </div>

        {linkedItems.length > 0 ? (
          <div className="space-y-2.5 max-h-[300px] overflow-y-auto scrollbar-thin pr-1">
            {linkedItems.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] hover:border-white/10 transition-all space-y-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white truncate">{item.name}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400 font-semibold uppercase">
                        {item.category}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      Preço Unitário: R$ {item.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  {/* Quantidade PDV */}
                  <div className="flex items-center gap-1.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] rounded-lg p-1">
                    <button
                      type="button"
                      onClick={() => handleQtyChange(item.id, item.quantity, -1)}
                      className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 text-xs font-bold transition-colors cursor-pointer"
                      title="Diminuir quantidade"
                    >
                      -
                    </button>
                    <span className="text-xs font-mono font-black text-white px-1.5 tabular-nums min-w-[20px] text-center">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleQtyChange(item.id, item.quantity, 1)}
                      className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 text-xs font-bold transition-colors cursor-pointer"
                      title="Aumentar quantidade"
                    >
                      +
                    </button>
                  </div>

                  {/* Subtotal do Item */}
                  <div className="text-right min-w-[90px]">
                    <div className="text-xs font-mono font-black text-emerald-400">
                      R$ {item.subtotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-[9px] text-slate-500 font-mono">
                      {item.isRecurring ? `${item.contractMonths}x R$ ${item.monthlyPrice.toLocaleString("pt-BR")}` : "Valor Pontual"}
                    </div>
                  </div>

                  {/* Remover Item */}
                  <button
                    type="button"
                    onClick={() => toggleProductLink(item.id)}
                    className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer ml-1"
                    title="Remover item da proposta"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Controles de Recorrência, Vigência e Implantação do Item */}
                <div className="pt-2 border-t border-white/[0.05] flex flex-wrap items-center justify-between gap-2 text-[10px]">
                  {/* Recorrente vs Pontual + Meses */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        setItemRecurrences((prev) => ({
                          ...prev,
                          [item.id]: !item.isRecurring,
                        }));
                      }}
                      className={cn(
                        "px-2 py-0.5 rounded-md font-bold uppercase transition-colors cursor-pointer flex items-center gap-1 text-[9px]",
                        item.isRecurring
                          ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                          : "bg-white/5 text-slate-400 border border-white/10 hover:text-white"
                      )}
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      {item.isRecurring ? "Recorrente" : "Pontual"}
                    </button>

                    {item.isRecurring && (
                      <div className="flex items-center gap-1 bg-[var(--color-surface-elevated)] px-2 py-0.5 rounded-md border border-white/5">
                        <span className="text-slate-400 text-[9px] font-bold">Vigência:</span>
                        {[1, 3, 6, 12, 24].map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => {
                              setItemMonths((prev) => ({
                                ...prev,
                                [item.id]: m,
                              }));
                              setCustomMonthsDraft((prev) => {
                                const next = { ...prev };
                                delete next[item.id];
                                return next;
                              });
                            }}
                            className={cn(
                              "px-1.5 py-0.2 rounded font-mono font-bold text-[9px] transition-colors cursor-pointer",
                              item.contractMonths === m
                                ? "bg-blue-600 text-white"
                                : "text-slate-400 hover:text-white"
                            )}
                          >
                            {m}m
                          </button>
                        ))}
                        <div className="flex items-center gap-0.5 pl-1 ml-0.5 border-l border-white/10">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            placeholder="Outro"
                            value={
                              customMonthsDraft[item.id] ??
                              ([1, 3, 6, 12, 24].includes(item.contractMonths) ? "" : item.contractMonths || "")
                            }
                            onChange={(e) => {
                              const raw = e.target.value;
                              setCustomMonthsDraft((prev) => ({ ...prev, [item.id]: raw }));
                              const val = parseInt(raw, 10);
                              if (!val || val < 1) return;
                              setItemMonths((prev) => ({
                                ...prev,
                                [item.id]: val,
                              }));
                            }}
                            onBlur={() => {
                              setCustomMonthsDraft((prev) => {
                                const next = { ...prev };
                                delete next[item.id];
                                return next;
                              });
                            }}
                            className="w-11 bg-transparent text-[9px] font-mono font-bold text-white placeholder:text-slate-500 focus:outline-none"
                            title="Digitar vigência personalizada (em meses)"
                          />
                          <span className="text-slate-500 text-[9px] font-mono">m</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Taxa de Implantação / Setup */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 text-[9px] font-bold flex items-center gap-1">
                      <Wrench className="w-2.5 h-2.5 text-amber-400" /> Setup:
                    </span>
                    <div className="relative">
                      <span className="absolute left-1.5 top-0.5 text-[9px] text-slate-500 font-mono">R$</span>
                      <input
                        type="number"
                        min="0"
                        step="50"
                        value={item.implFee || 0}
                        onChange={(e) => {
                          const val = Math.max(0, parseFloat(e.target.value) || 0);
                          setItemImplFees((prev) => ({
                            ...prev,
                            [item.id]: val,
                          }));
                        }}
                        className="w-20 bg-[var(--color-surface-elevated)] border border-white/10 rounded pl-5 pr-1 py-0.5 text-[10px] text-amber-300 font-mono font-bold focus:outline-none focus:border-amber-500"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center flex flex-col items-center gap-2 border border-dashed border-[var(--color-border-subtle)] rounded-xl">
            <Package className="w-6 h-6 text-slate-500" />
            <p className="text-xs text-slate-400 font-medium">
              Nenhum produto selecionado para esta proposta.
            </p>
            <p className="text-[10px] text-slate-500">
              Escolha produtos no catálogo abaixo ou cadastre um novo.
            </p>
          </div>
        )}

        {/* ── DETALHAMENTO FINANCEIRO DO PDV ── */}
        <div className="bg-[var(--color-surface-sunken)] p-3 rounded-xl border border-[var(--color-border-subtle)] space-y-2.5">
          <div className="flex items-center justify-between text-[10px] uppercase font-black text-slate-400 border-b border-white/5 pb-1.5">
            <span>Composição Comercial & Financeira</span>
            <span className="text-emerald-400 font-mono font-bold">Margem Líquida: {marginPercent}%</span>
          </div>

          {/* Linha 1: Métricas de Venda & Contrato */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
            <div className="bg-[var(--color-surface-elevated)] p-2 rounded-lg border border-blue-500/20">
              <span className="text-[9px] text-blue-400 block uppercase font-bold">1º Vencimento (Entrada)</span>
              <span className="text-white font-black text-xs">R$ {firstPaymentTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="bg-[var(--color-surface-elevated)] p-2 rounded-lg border border-white/[0.04]">
              <span className="text-[9px] text-slate-400 block uppercase font-bold">Mensalidade (MRR)</span>
              <span className="text-blue-300 font-bold text-xs">R$ {totalMonthlyMRR.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="bg-[var(--color-surface-elevated)] p-2 rounded-lg border border-white/[0.04]">
              <span className="text-[9px] text-slate-400 block uppercase font-bold">Implantação / Setup</span>
              <span className="text-amber-300 font-bold text-xs">R$ {totalImplementation.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="bg-[var(--color-surface-elevated)] p-2 rounded-lg border border-emerald-500/20">
              <span className="text-[9px] text-emerald-400 block uppercase font-bold">Total Contrato (LTV)</span>
              <span className="text-emerald-400 font-black text-xs">R$ {finalTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Linha 2: Custos, Comissão e Lucro */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono pt-1 border-t border-white/5">
            <div className="bg-[var(--color-surface-elevated)] p-1.5 rounded-lg border border-white/[0.04]">
              <span className="text-[9px] text-slate-500 block uppercase">Custos Totais</span>
              <span className="text-rose-400 font-bold text-[11px]">R$ {totalCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="bg-[var(--color-surface-elevated)] p-1.5 rounded-lg border border-white/[0.04]">
              <span className="text-[9px] text-slate-500 block uppercase">Comissão Vendas</span>
              <span className="text-amber-400 font-bold text-[11px]">R$ {totalCommission.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="bg-[var(--color-surface-elevated)] p-1.5 rounded-lg border border-white/[0.04] col-span-2 sm:col-span-1">
              <span className="text-[9px] text-slate-500 block uppercase">Lucro Líquido</span>
              <span className="text-emerald-400 font-bold text-[11px]">R$ {netProfit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* ── FORMA DE PAGAMENTO & PARCELAS DO MINI PDV ── */}
        <div className="bg-[var(--color-surface-sunken)] p-3.5 rounded-xl border border-[var(--color-border-subtle)] space-y-3">
          <div className="flex items-center justify-between text-[10px] uppercase font-black text-slate-400 border-b border-white/5 pb-1.5">
            <span className="flex items-center gap-1.5 text-blue-400">
              <CreditCard className="w-3.5 h-3.5" /> Condição de Pagamento & Parcelas (PDV)
            </span>
            <span className="text-[var(--color-text-muted)] font-mono">
              {parcelas > 1 ? `${parcelas}x de R$ ${valorParcela.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "À Vista"}
            </span>
          </div>

          {/* Seletor de Formas de Pagamento */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Como foi o Pagamento:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {PAYMENT_OPTIONS.map((method) => {
                const isSelected = formaPagamento === method.id;
                const Icon = method.icon;
                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => {
                      setFormaPagamento(method.id as any);
                      if (method.id === "Pix" || method.id === "Dinheiro" || method.id === "Cartão de Débito") {
                        setDataPagamento(new Date().toISOString().slice(0, 10));
                      }
                    }}
                    className={cn(
                      "flex items-center gap-1.5 p-2 rounded-lg border text-left transition-all cursor-pointer",
                      isSelected
                        ? "bg-blue-600/20 border-blue-500 text-white font-bold shadow-sm shadow-blue-500/20 ring-1 ring-blue-500/40"
                        : "bg-[var(--color-surface-elevated)] border-white/[0.06] text-slate-400 hover:text-slate-200 hover:border-white/20"
                    )}
                  >
                    <Icon className={cn("w-3.5 h-3.5 shrink-0", isSelected ? "text-blue-400" : "text-slate-500")} />
                    <span className="text-[11px] truncate">{method.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Seletor de Data, Parcelas e Observações */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 border-t border-white/5">
            {/* 1. Data do Pagamento / Vencimento */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-blue-400" />
                  Data Pagamento / Vencimento:
                </label>
                <span className="text-[10px] font-mono text-slate-400">
                  {dataPagamento ? new Date(dataPagamento + "T12:00:00").toLocaleDateString("pt-BR") : "Não definida"}
                </span>
              </div>
              <div className="space-y-1.5">
                <input
                  type="date"
                  value={dataPagamento}
                  onChange={(e) => setDataPagamento(e.target.value)}
                  className="w-full bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none cursor-pointer [color-scheme:dark]"
                />
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setDataPagamento(new Date().toISOString().slice(0, 10))}
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[9px] font-semibold transition-colors cursor-pointer",
                      dataPagamento === new Date().toISOString().slice(0, 10)
                        ? "bg-blue-600 text-white"
                        : "bg-white/5 text-slate-400 hover:text-white"
                    )}
                  >
                    Hoje
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date(Date.now() + 7 * 86400000);
                      setDataPagamento(d.toISOString().slice(0, 10));
                    }}
                    className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-white/5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    +7d
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date(Date.now() + 15 * 86400000);
                      setDataPagamento(d.toISOString().slice(0, 10));
                    }}
                    className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-white/5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    +15d
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date(Date.now() + 30 * 86400000);
                      setDataPagamento(d.toISOString().slice(0, 10));
                    }}
                    className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-white/5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    +30d
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Quantidade de Parcelas */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Quantidade de Parcelas:
                </label>
                <span className="text-xs font-mono font-black text-emerald-400">
                  {parcelas}x {parcelas === 1 ? "(À Vista)" : ""}
                </span>
              </div>
              <select
                value={parcelas}
                onChange={(e) => setParcelas(Number(e.target.value))}
                className="w-full bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none cursor-pointer"
              >
                <option value={1}>1x à vista (R$ {finalTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })})</option>
                {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24].map((num) => (
                  <option key={num} value={num}>
                    {num}x de R$ {(finalTotal / num).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Detalhes / Observação do Pagamento */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Detalhes / Observação:
              </label>
              <input
                type="text"
                value={detalhesPagamento}
                onChange={(e) => setDetalhesPagamento(e.target.value)}
                placeholder="Ex: Cartão Visa final 4022 / Pix confirmado"
                className="w-full bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Resumo da Condição */}
          <div className="p-2 bg-[var(--color-surface-elevated)] rounded-lg border border-white/[0.05] flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] text-slate-300">
                Resumo da Condição: <strong className="text-white">{formaPagamento}</strong>
                {dataPagamento && (
                  <span className="text-slate-400 ml-1">
                    • Data: <strong className="text-blue-300">{new Date(dataPagamento + "T12:00:00").toLocaleDateString("pt-BR")}</strong>
                  </span>
                )}
              </span>
            </div>
            <span className="text-xs font-mono font-black text-emerald-400">
              {parcelas > 1 ? `${parcelas}x de R$ ${valorParcela.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `R$ ${finalTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} à vista`}
            </span>
          </div>
        </div>

        {/* ── BOTÕES DE AÇÃO DO MINI PDV & AUTOMAÇÃO ── */}
        <div className="space-y-2 pt-1">
          {/* Botão Principal: Processar e Automatizar Tudo */}
          <Button
            type="button"
            disabled={linkedItems.length === 0 || isAutomating}
            onClick={handleProcessFullOrder}
            className="w-full text-xs font-black uppercase tracking-wider gap-2 h-10 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {isAutomating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Automatizando Sistema...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                ⚡ Concluir Venda & Automatizar Tudo (PDV)
              </>
            )}
          </Button>

          {/* Ações Secundárias: Modo Word e PDF */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={linkedItems.length === 0}
              onClick={handleOpenWordEditor}
              className="text-xs font-bold gap-2 h-8.5 border-indigo-500/30 hover:bg-indigo-500/10 text-indigo-300 cursor-pointer disabled:opacity-40"
            >
              <Edit3 className="w-3.5 h-3.5 text-indigo-400" /> Visualizar / Editar (Modo Word)
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={linkedItems.length === 0}
              onClick={handleGeneratePdf}
              className="text-xs font-bold gap-2 h-8.5 border-blue-500/30 hover:bg-blue-500/10 text-blue-300 cursor-pointer disabled:opacity-40"
            >
              <FileText className="w-3.5 h-3.5 text-blue-400" /> Baixar PDF da Proposta
            </Button>
          </div>
        </div>
      </Card>

      {/* ── CATÁLOGO DE PRODUTOS DISPONÍVEIS ── */}
      <Card className="p-4 bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            Catálogo de Produtos ({filteredCatalog.length})
          </span>
        </div>

        {/* Busca e Filtros */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome de produto..."
              className="w-full bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "px-2.5 py-1 rounded-lg border text-[10px] font-bold whitespace-nowrap transition-all cursor-pointer",
                  selectedCategory === cat
                    ? "bg-blue-500/20 border-blue-500 text-blue-300"
                    : "bg-[var(--color-surface-sunken)] border-[var(--color-border-subtle)] text-slate-400 hover:text-white"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Grid de Produtos Disponíveis */}
        {filteredCatalog.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[280px] overflow-y-auto scrollbar-thin pr-1">
            {filteredCatalog.map((prod) => {
              const isLinked = linkedProductIds.includes(prod.id);
              return (
                <div
                  key={prod.id}
                  onClick={() => toggleProductLink(prod.id)}
                  className={cn(
                    "p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-2 group",
                    isLinked
                      ? "bg-blue-500/10 border-blue-500/40 text-white shadow-sm"
                      : "bg-[var(--color-surface-sunken)] border-[var(--color-border-subtle)] text-slate-300 hover:border-white/20 hover:text-white"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold leading-snug truncate">{prod.name}</p>
                    <span className="text-[9px] text-slate-500 uppercase font-semibold">
                      {prod.category} {prod.recurrence && "• Recorrente"}
                    </span>
                  </div>

                  <div className="text-right flex items-center gap-2">
                    <span className="text-xs font-mono font-black text-emerald-400 whitespace-nowrap">
                      R$ {prod.price.toLocaleString("pt-BR")}
                    </span>
                    <div
                      className={cn(
                        "w-5 h-5 rounded flex items-center justify-center transition-all",
                        isLinked
                          ? "bg-blue-500 text-white"
                          : "bg-white/5 text-slate-500 group-hover:bg-white/10 group-hover:text-white"
                      )}
                    >
                      {isLinked ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={Package}
            title="Nenhum produto no catálogo"
            description="Utilize o botão acima '+ Novo Produto' para cadastrar no banco."
            className="py-6"
          />
        )}
      </Card>

      {/* ── MODAL EDITOR DE PROPOSTA MODO WORD ── */}
      <PropostaEditorWordModal
        isOpen={isWordModalOpen}
        onClose={() => setIsWordModalOpen(false)}
        proposalData={currentProposalData}
        onSaveProposal={(updated) => {
          setCurrentProposalData(updated);
        }}
      />
    </div>
  );
}

