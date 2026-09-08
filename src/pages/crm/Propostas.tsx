import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "../../components/ui/button";
import { PageContainer } from "../../components/PageContainer";
import { toast } from "sonner";
import { useData } from "../../contexts/DataContext";
import { useAuth } from "../../contexts/AuthContext";
import { CriarPropostaModal } from "../../components/ui/modals/crm/CriarPropostaModal";
import { NovaPropostaRapidaModal } from "../../components/ui/modals/crm/NovaPropostaRapidaModal";

import { PropostasKPIs } from "./components/Propostas/PropostasKPIs";
import { PropostasTable } from "./components/Propostas/PropostasTable";

export default function Propostas() {
  const { proposals: propostas, proposalItems, updateProposal, deleteProposal, createProposalWithItems } = useData();
  const { user } = useAuth();

  const [search, setSearch] = useState("");
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
    toast.success(`Proposta atualizada para: ${newStatus}`);
  };

  return (
    <PageContainer
      title="Propostas S.P.Y."
      description="Gestão de orçamentos, contratos e follow-up de vendas de alta conversão."
      actions={
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="lg"
            className="font-bold uppercase tracking-widest text-[10px]"
            onClick={() => toast.info("Apenas modelos premium de engenharia e tecnologia estão ativos no plano.")}
          >
            Modelos
          </Button>
          <Button
            size="lg"
            onClick={() => setIsPropostaModalOpen(true)}
            className="font-black uppercase tracking-widest text-[10px]"
          >
            <Plus className="w-4 h-4 mr-2" /> Nova Proposta
          </Button>
        </div>
      }
    >
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
