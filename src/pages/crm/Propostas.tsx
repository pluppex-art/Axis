import { useState, useMemo } from "react";
import { DateRangeFilter } from "../../components/ui/DateRangeFilter";
import { Plus, FileText, FileSignature } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Modal } from "../../components/ui/modal";
import { Input } from "../../components/ui/input";
import { FormField } from "../../components/ui/form-field";
import { PageContainer } from "../../components/PageContainer";
import { toast } from "sonner";
import { useData } from "../../contexts/DataContext";
import { useAuth } from "../../contexts/AuthContext";
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
    syncAcceptedProposal,
    contracts,
    updateContract,
    deleteContract,
    appSettings,
  } = useData();
  const { user, activeTenantName } = useAuth();

  const [activeTab, setActiveTab] = useState<"propostas" | "contratos">("propostas");
  const [search, setSearch] = useState("");
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [editClient, setEditClient] = useState("");
  const [editPlan, setEditPlan] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editMrr, setEditMrr] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [contractSearch, setContractSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPropostaModalOpen, setIsPropostaModalOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);

  // Contracts guarda a data como "dd/mm/aaaa" (rowToContract) — converte pra
  // ISO só pra comparar com o filtro, sem mudar o formato de exibição.
  const toIsoBR = (br?: string | null) => {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br || "");
    return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
  };
  const inRange = (iso: string | null, from: string | null, to: string | null) => {
    if (!iso) return !from && !to;
    if (from && iso < from) return false;
    if (to && iso > to) return false;
    return true;
  };

  const filteredPropostas = useMemo(() => {
    if (!dateFrom && !dateTo) return propostas;
    return (propostas as any[]).filter((p) => inRange((p.created_at || "").slice(0, 10) || null, dateFrom, dateTo));
  }, [propostas, dateFrom, dateTo]);

  const filteredContracts = useMemo(() => {
    if (!dateFrom && !dateTo) return contracts;
    return (contracts as any[]).filter((c) => inRange(toIsoBR(c.date), dateFrom, dateTo));
  }, [contracts, dateFrom, dateTo]);

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

  // Sincronização de contrato/fatura + reconciliação de propostas "Aceita" sem
  // contrato correspondente (ou com contrato desatualizado) agora é global —
  // vive em DataContext.tsx e roda assim que os dados do tenant carregam, não
  // só enquanto esta página está aberta (ver comentário lá pra detalhes).
  const handleUpdateStatus = (id: string, newStatus: any) => {
    updateProposal(id, { status: newStatus });

    if (newStatus === "Aceita") {
      const prop = (propostas || []).find((p: any) => p.id === id);
      if (prop && syncAcceptedProposal(prop)) return;
    }
    toast.success(`Proposta atualizada para: ${newStatus}`);
  };

  const totalMRR = getMRR(filteredContracts || []);

  const handleEditContract = (contract: Contract) => {
    setEditingContract(contract);
    setEditClient(contract.client);
    setEditPlan(contract.plan);
    setEditDescription(contract.description || "");
    setEditMrr(String(typeof contract.mrr === "number" ? contract.mrr : contract.mrr).replace(/[^\d,.-]/g, ""));
    setEditDate(contract.date || "");
    setEditEndDate(contract.endDate || "");
  };

  const handleSaveEditContract = () => {
    if (!editingContract) return;
    const cleanValue = parseFloat(editMrr.replace(/[^0-9,.]/g, "").replace(",", "."));
    const formattedValue = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(isNaN(cleanValue) ? 0 : cleanValue);
    updateContract(editingContract.id, { client: editClient, plan: editPlan, description: editDescription || null, mrr: formattedValue, date: editDate, endDate: editEndDate || null });
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
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border-subtle)] pb-2 mb-6">
        <div className="flex gap-2">
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
        <DateRangeFilter dateFrom={dateFrom} setDateFrom={setDateFrom} dateTo={dateTo} setDateTo={setDateTo} />
      </div>

      {activeTab === "propostas" ? (
        <div className="space-y-6">
          <PropostasKPIs propostas={filteredPropostas as any} allPropostas={propostas as any} />

          <PropostasTable
            propostas={filteredPropostas as any}
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
            ativos={filteredContracts.filter((c: any) => c.status === "Ativo").length}
            inadimplentes={filteredContracts.filter((c: any) => c.status === "Inadimplente").length}
          />

          <ContractsTable
            contracts={filteredContracts as any}
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
          <FormField label="Descrição (opcional)">
            <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Ex: Proposta Comercial — Nome do Cliente" />
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
