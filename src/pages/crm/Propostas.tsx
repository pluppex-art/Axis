import { useState } from "react";
import { Plus, FileText, FileSignature } from "lucide-react";
import { Button } from "../../components/ui/button";
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
import { cn } from "../../lib/utils";

const toNumberMRR = (mrr: string | number): number => {
  if (typeof mrr === "number") return mrr;
  const cleaned = String(mrr || "").replace("R$ ", "").replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

export default function Propostas() {
  const {
    proposals: propostas,
    proposalItems,
    updateProposal,
    deleteProposal,
    createProposalWithItems,
    contracts,
    addContract,
    deleteContract,
    addFinanceEntry,
  } = useData();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<"propostas" | "contratos">("propostas");
  const [search, setSearch] = useState("");
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

  const handleUpdateStatus = (id: string, newStatus: any) => {
    updateProposal(id, { status: newStatus });

    if (newStatus === "Aceita") {
      const prop = (propostas || []).find((p: any) => p.id === id);
      if (prop) {
        const valorFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(prop.valor || 0);

        const jaExiste = (contracts || []).some((c: any) => c.client === prop.cliente && c.plan === prop.titulo);
        if (!jaExiste) {
          addContract({
            client: prop.cliente || "Cliente",
            plan: prop.titulo || "Proposta Comercial",
            mrr: valorFmt,
            status: "Ativo",
            date: new Date().toLocaleDateString("pt-BR"),
            progress: 100,
          });

          addFinanceEntry({
            description: `Contrato: ${prop.titulo} (${prop.cliente})`,
            category: "Contrato / Vendas",
            value: prop.valor || 0,
            type: "Receber",
            date: new Date().toISOString().slice(0, 10),
            status: "A Vencer",
          });

          toast.success("🎉 Proposta Aceita! Contrato ativado e fatura a receber gerada no financeiro!");
          return;
        }
      }
    }
    toast.success(`Proposta atualizada para: ${newStatus}`);
  };

  const totalMRR = (contracts || []).reduce((acc: number, curr: any) => acc + toNumberMRR(curr.mrr), 0);

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
    </PageContainer>
  );
}
