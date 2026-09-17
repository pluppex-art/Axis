import { useEffect, useState } from "react";
import { Plus, FileText, FileSignature } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Modal } from "../../components/ui/modal";
import { Input } from "../../components/ui/input";
import { FormField } from "../../components/ui/form-field";
import { PageContainer } from "../../components/PageContainer";
import { toast } from "sonner";
import { useData } from "../../contexts/DataContext";
import { useAuth } from "../../contexts/AuthContext";
import { useLocalization } from "../../contexts/LocalizationContext";
import { CriarPropostaModal } from "../../components/ui/modals/crm/CriarPropostaModal";
import { NovaPropostaRapidaModal } from "../../components/ui/modals/crm/NovaPropostaRapidaModal";
import { PropostasKPIs } from "./components/Propostas/PropostasKPIs";
import { PropostasTable } from "./components/Propostas/PropostasTable";
import { ContractsKPIs } from "./components/Contracts/ContractsKPIs";
import { ContractsTable } from "./components/Contracts/ContractsTable";
import { handleDownloadPdf } from "./utils/proposalPdf";
import { cn } from "../../lib/utils";
import { getMRR } from "../../lib/revenueMetrics";
import type { Contract } from "../../types";

export default function Propostas() {
  const {
    proposals: propostas,
    proposalItems,
    updateProposal,
    deleteProposal,
    createProposalWithItems,
    contracts,
    addContract,
    updateContract,
    deleteContract,
    addFinanceEntry,
    updateLead,
    leads,
    products,
    appSettings,
  } = useData();
  const { user, activeTenantName } = useAuth();
  const { formatCurrency } = useLocalization();

  const [activeTab, setActiveTab] = useState<"propostas" | "contratos">("propostas");
  const [search, setSearch] = useState("");
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [editClient, setEditClient] = useState("");
  const [editPlan, setEditPlan] = useState("");
  const [editMrr, setEditMrr] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [contractSearch, setContractSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPropostaModalOpen, setIsPropostaModalOpen] = useState(false);

  const handleCreatePropostaNew = async (data: any) => {
    await createProposalWithItems({
      titulo: data.titulo,
      cliente: data.cliente,
      valor: parseFloat(data.valor) || 0,
      validade: data.dataValidade || null,
      status: "Enviada",
      vendedor: user?.name || "Sistema S.P.Y.",
      itens: data.itens?.filter((i: any) => i.descricao?.trim()) || [],
      tipo: data.tipo,
      conteudoTexto: data.conteudoTexto,
      linkPdf: data.linkPdf,
    });
    toast.success("✨ Proposta criada com sucesso! Pronta para envio.");
    setIsPropostaModalOpen(false);
  };

  // Sincroniza o valor de volta no lead vinculado e garante contrato + fatura
  // a receber para uma proposta aceita. Extraído do handleUpdateStatus pra
  // também poder rodar como reconciliação (abaixo) em propostas que já
  // estavam "Aceita" antes dessa sincronização existir, e que por isso
  // ficaram para sempre sem contrato/fatura correspondente.
  const syncAcceptedProposal = (prop: any, { silent = false }: { silent?: boolean } = {}) => {
    const linkedItems = (proposalItems || []).filter((pi: any) => pi.proposal_id === prop.id);

    // Idempotência real: vínculo estável por proposal_id (trava também no
    // banco via índice único) em vez de comparar client/plan por texto — uma
    // proposta ou contrato renomeado depois não quebra mais a checagem e
    // recria um duplicado. Contratos antigos sem proposal_id (criados antes
    // dessa coluna existir) ainda caem no fallback por nome, uma única vez.
    const norm = (s: any) => String(s || "").trim().toLowerCase();
    const jaExiste = (contracts || []).some((c: any) =>
      c.proposalId === prop.id ||
      (!c.proposalId && norm(c.client) === norm(prop.cliente) && norm(c.plan) === norm(prop.titulo))
    );

    // Soma com o valor já existente no lead (de uma proposta anterior já
    // realizada/aceita) em vez de sobrescrever — mas só na primeira vez que
    // esta proposta específica é processada (`!jaExiste`), senão a
    // reconciliação (que roda de novo a cada mudança de propostas/contracts)
    // somaria o mesmo valor repetidas vezes.
    if (!jaExiste && prop.lead_id && updateLead) {
      const productIds = linkedItems.map((pi: any) => pi.product_id).filter(Boolean);
      const lead = (leads || []).find((l: any) => l.id === prop.lead_id);
      const newValue = (lead ? Number(lead.value) || 0 : 0) + (prop.valor || 0);
      const newProductIds = [...new Set([...(lead?.productIds || []), ...productIds])];
      updateLead(prop.lead_id, {
        value: newValue,
        ...(newProductIds.length > 0 ? { productIds: newProductIds } : {}),
      });
    }

    if (jaExiste) return false;

    // MRR real = só os itens recorrentes da proposta; implantação/setup entra
    // à parte, não conta como receita recorrente mensal (Fase 2). Sem itens
    // detalhados (proposta sem produtos, ex.: texto/arquivo), cai tudo como
    // recorrente — mesmo comportamento de antes.
    const recurringTotal = linkedItems.length > 0
      ? linkedItems.filter((pi: any) => pi.billing_type !== 'one_time').reduce((s: number, pi: any) => s + (Number(pi.preco_unitario) || 0) * (Number(pi.quantidade) || 1), 0)
      : (prop.valor || 0);
    const oneTimeTotal = linkedItems.filter((pi: any) => pi.billing_type === 'one_time').reduce((s: number, pi: any) => s + (Number(pi.preco_unitario) || 0) * (Number(pi.quantidade) || 1), 0);

    // `prop.titulo` é só o título genérico da proposta ("Proposta Comercial —
    // Cliente X"), não o plano/produto vendido — usar isso como "Plano" do
    // contrato escondia o produto real do catálogo. O plano do contrato passa
    // a ser os produtos de fato vinculados na proposta (proposal_items.product_name),
    // caindo no título só quando a proposta não tem itens estruturados (texto/arquivo).
    const planLabel = linkedItems.length > 0
      ? [...new Set(linkedItems.map((pi: any) => pi.product_name).filter(Boolean))].join(" + ")
      : (prop.titulo || "Proposta Comercial");

    // Data de término = assinatura + duração do contrato (em meses). Prioriza
    // o prazo REALMENTE fechado nesta venda (proposal_items.contract_months —
    // pode ter sido negociado diferente do padrão do catálogo, ex.: licença de
    // 12 meses fechada por 4 meses com pagamento adiantado); só cai pro padrão
    // do produto do catálogo em propostas antigas, criadas antes desse campo
    // existir. Sem duração em nenhum dos dois lugares, não inventa prazo
    // nenhum — fica sem data de término (contrato de renovação contínua).
    const linkedProducts = linkedItems
      .map((pi: any) => (products as any[] || []).find((p: any) => p.id === pi.product_id))
      .filter(Boolean);
    const contractMonths =
      linkedItems
        .map((pi: any) => Number(pi.contract_months) || 0)
        .filter((m: number) => m > 0)
        .sort((a: number, b: number) => b - a)[0]
      ?? linkedProducts
        .map((p: any) => Number(p.contractMonths) || 0)
        .filter((m: number) => m > 0)
        .sort((a: number, b: number) => b - a)[0];
    const signedDate = new Date();
    const endDate = contractMonths
      ? new Date(signedDate.getFullYear(), signedDate.getMonth() + contractMonths, signedDate.getDate()).toLocaleDateString("pt-BR")
      : null;

    addContract({
      client: prop.cliente || "Cliente",
      plan: planLabel || prop.titulo || "Proposta Comercial",
      mrr: formatCurrency(recurringTotal),
      totalValue: recurringTotal + oneTimeTotal,
      status: "Ativo",
      date: signedDate.toLocaleDateString("pt-BR"),
      endDate,
      progress: 100,
      proposalId: prop.id,
    }, { silent });

    addFinanceEntry({
      description: `Contrato: ${prop.titulo} (${prop.cliente})`,
      category: "Contrato / Recorrente",
      value: recurringTotal,
      type: "Receber",
      date: new Date().toISOString().slice(0, 10),
      status: "A Vencer",
    }, { silent });

    // Implantação/setup é receita única — lançamento à parte, não recorrente,
    // pra não poluir relatórios de MRR/receita recorrente com valor avulso.
    if (oneTimeTotal > 0) {
      addFinanceEntry({
        description: `Implantação/Setup: ${prop.titulo} (${prop.cliente})`,
        category: "Implantação / Setup",
        value: oneTimeTotal,
        type: "Receber",
        date: new Date().toISOString().slice(0, 10),
        status: "A Vencer",
      }, { silent });
    }

    if (!silent) toast.success("🎉 Proposta Aceita! Contrato ativado e fatura a receber gerada no financeiro!");
    return true;
  };

  const handleUpdateStatus = (id: string, newStatus: any) => {
    updateProposal(id, { status: newStatus });

    if (newStatus === "Aceita") {
      const prop = (propostas || []).find((p: any) => p.id === id);
      if (prop && syncAcceptedProposal(prop)) return;
    }
    toast.success(`Proposta atualizada para: ${newStatus}`);
  };

  // Reconciliação: propostas que já estavam "Aceita" antes de existir a
  // sincronização acima (ex.: aceitas numa versão anterior do sistema) ficam
  // presas para sempre sem contrato — isso roda uma vez que os dados
  // carregam e fecha essa lacuna sem exigir reabrir/re-aceitar a proposta.
  useEffect(() => {
    if (!propostas || propostas.length === 0 || !contracts) return;
    (propostas as any[])
      .filter((p) => p.status === "Aceita")
      .forEach((p) => syncAcceptedProposal(p, { silent: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propostas, contracts]);

  const totalMRR = getMRR(contracts || []);

  const handleEditContract = (contract: Contract) => {
    setEditingContract(contract);
    setEditClient(contract.client);
    setEditPlan(contract.plan);
    setEditMrr(String(typeof contract.mrr === "number" ? contract.mrr : contract.mrr).replace(/[^\d,.-]/g, ""));
    setEditDate(contract.date || "");
    setEditEndDate(contract.endDate || "");
  };

  const handleSaveEditContract = () => {
    if (!editingContract) return;
    const cleanValue = parseFloat(editMrr.replace(/[^0-9,.]/g, "").replace(",", "."));
    const formattedValue = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(isNaN(cleanValue) ? 0 : cleanValue);
    updateContract(editingContract.id, { client: editClient, plan: editPlan, mrr: formattedValue, date: editDate, endDate: editEndDate || null });
    toast.success("Contrato atualizado com sucesso!");
    setEditingContract(null);
  };

  // Mesmo gerador/branding (logo do tenant) já usado no PDF de Propostas —
  // reaproveita o layout em vez de duplicar a lógica de PDF do zero.
  const handleContractPdf = (contract: Contract) => {
    const empresaDados = appSettings?.empresa_dados || {};
    const mrrNumber = typeof contract.mrr === "number"
      ? contract.mrr
      : parseFloat(String(contract.mrr).replace(/[^\d,.-]/g, "").replace(",", ".")) || 0;
    handleDownloadPdf(
      {
        id: contract.id,
        cliente: contract.client,
        titulo: contract.plan,
        valor: mrrNumber,
        created_at: undefined,
        validade: undefined,
        status: contract.status === "Ativo" ? "Aceita" : "Enviada",
        vendedor: activeTenantName || "S.P.Y.",
      } as any,
      [],
      { logoUrl: empresaDados?.logoUrl, tenantName: activeTenantName }
    );
  };

  return (
    <PageContainer
      title="Propostas & Contratos"
      description="Ciclo comercial completo: elaboração de orçamentos, aprovação com conversão em contrato e faturamento integrado."
      actions={
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="lg"
            className="font-bold uppercase tracking-widest text-[10px] bg-[var(--color-surface-elevated)] border-[var(--color-border-default)]"
            onClick={() => toast.info("Apenas modelos premium de engenharia e tecnologia estão ativos no plano.")}
          >
            Modelos
          </Button>
          <Button
            size="lg"
            onClick={() => setIsPropostaModalOpen(true)}
            className="font-black uppercase tracking-widest text-[10px] bg-[#2563EB] hover:bg-blue-600 !text-white"
          >
            <Plus className="w-4 h-4 mr-2" /> Nova Proposta
          </Button>
        </div>
      }
    >
      {/* Abas de Navegação Unificada */}
      <div className="flex gap-2 border-b border-[var(--color-border-subtle)] pb-2 mb-6">
        <button
          type="button"
          onClick={() => setActiveTab("propostas")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
            activeTab === "propostas"
              ? "bg-[#2563EB] text-white shadow-md shadow-blue-500/20"
              : "bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] text-slate-400 hover:text-white"
          )}
        >
          <FileText className="w-3.5 h-3.5" />
          Propostas Comerciais ({propostas.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("contratos")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
            activeTab === "contratos"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
              : "bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] text-slate-400 hover:text-white"
          )}
        >
          <FileSignature className="w-3.5 h-3.5" />
          Contratos & Faturas ({contracts.length})
        </button>
      </div>

      {activeTab === "propostas" ? (
        <div className="space-y-6">
          <PropostasKPIs propostas={propostas as any} />

          <PropostasTable
            propostas={propostas as any}
            proposalItems={proposalItems as any}
            search={search}
            onSearchChange={setSearch}
            onUpdateStatus={handleUpdateStatus}
            onDelete={(id) => { deleteProposal(id); toast.success("Proposta de venda excluída."); }}
            updateProposal={updateProposal}
          />
        </div>
      ) : (
        <div className="space-y-6">
          <ContractsKPIs
            totalMRR={totalMRR}
            ativos={contracts.filter((c: any) => c.status === "Ativo").length}
            inadimplentes={contracts.filter((c: any) => c.status === "Inadimplente").length}
          />

          <ContractsTable
            contracts={contracts as any}
            searchQuery={contractSearch}
            onSearchChange={setContractSearch}
            onDelete={(id) => { deleteContract(id); toast.success("Contrato removido."); }}
            onEdit={handleEditContract}
            onDownloadPdf={handleContractPdf}
          />
        </div>
      )}

      <NovaPropostaRapidaModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={async ({ cliente, titulo, valor, vencimento, vendedor }) => {
          const today = new Date();
          const valDate = vencimento || new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
          await createProposalWithItems({
            titulo, cliente,
            valor: parseFloat(valor.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0,
            validade: valDate,
            status: "Aberta",
            vendedor,
          });
          toast.success("Proposta comercial criada com sucesso!");
          setIsModalOpen(false);
        }}
      />

      <CriarPropostaModal
        isOpen={isPropostaModalOpen}
        onClose={() => setIsPropostaModalOpen(false)}
        onSave={handleCreatePropostaNew}
        title="Criar Proposta S.P.Y."
        submitText="Gerar Proposta"
      />

      <Modal
        isOpen={!!editingContract}
        onClose={() => setEditingContract(null)}
        title="Editar Contrato"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditingContract(null)}>Cancelar</Button>
            <Button onClick={handleSaveEditContract}>Salvar Alterações</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <FormField label="Cliente">
            <Input value={editClient} onChange={(e) => setEditClient(e.target.value)} />
          </FormField>
          <FormField label="Plano Acordado">
            <Input value={editPlan} onChange={(e) => setEditPlan(e.target.value)} />
          </FormField>
          <FormField label="Valor (MRR)">
            <Input value={editMrr} onChange={(e) => setEditMrr(e.target.value)} placeholder="Ex: 1500,00" />
          </FormField>
          <FormField label="Data de Assinatura">
            <Input
              type="date"
              value={/^\d{2}\/\d{2}\/\d{4}$/.test(editDate) ? editDate.split("/").reverse().join("-") : editDate}
              onChange={(e) => setEditDate(e.target.value.split("-").reverse().join("/"))}
            />
          </FormField>
          <FormField label="Data de Término (opcional)">
            <Input
              type="date"
              value={/^\d{2}\/\d{2}\/\d{4}$/.test(editEndDate) ? editEndDate.split("/").reverse().join("-") : editEndDate}
              onChange={(e) => setEditEndDate(e.target.value ? e.target.value.split("-").reverse().join("/") : "")}
            />
          </FormField>
        </div>
      </Modal>
    </PageContainer>
  );
}
