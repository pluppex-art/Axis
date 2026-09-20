import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "../../components/ui/button";
import { NewLeadModal } from "../../components/ui/modals/crm/NewLeadModal";
import { LeadDetailsModal } from "../../components/ui/LeadDetailsModal";
import { useData } from "../../contexts/DataContext";
import { PageContainer } from "../../components/PageContainer";
import { LeadsKpis } from "./components/Leads/LeadsKPIs";
import { LeadsFiltersBar } from "./components/Leads/LeadsFiltersBar";
import { LeadsTable } from "./components/Leads/LeadsTable";
import { LeadsPagination } from "./components/Leads/LeadsPagination";
import { useLeadsList } from "./useLeadsList";

export default function Leads() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const { updateLead } = useData();
  // Busca/pagina direto no Supabase (50 por vez) em vez de depender do array
  // `leads` inteiro do DataContext + slice no cliente — a base já passou de
  // 3 mil leads migrados, e paginar só a renderização ainda exigia buscar a
  // tabela inteira do tenant a cada carga. KPIs vêm de count:'exact', nunca
  // do tamanho da página atual.
  const {
    leads: filteredLeads, stats, sellers,
    page, setPage, totalPages, pageSize, total, loading,
    searchQuery, setSearchQuery, temperatureFilter, setTemperatureFilter, sortOrder, setSortOrder,
    refetch,
  } = useLeadsList();

  // A mutação em si passa pelo DataContext (persiste no Supabase); refetch()
  // só re-sincroniza a página atual desta tela, que busca fora do contexto.
  const handleUpdateLead = (leadId: string, payload: any) => {
    updateLead(leadId, payload);
    setTimeout(refetch, 300);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    refetch();
  };

  return (
    <PageContainer
      title="Gestão de Leads S.P.Y."
      description="Centralize, qualifique e converta oportunidades em clientes de forma inteligente."
      actions={
        <Button onClick={() => setIsModalOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Novo Lead
        </Button>
      }
    >
      <LeadsKpis stats={stats} />

      <LeadsFiltersBar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        temperatureFilter={temperatureFilter}
        setTemperatureFilter={setTemperatureFilter}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
      />

      <LeadsTable
        leads={filteredLeads}
        sellers={sellers}
        onUpdateLead={handleUpdateLead}
        onSelectLead={setSelectedLead}
      />

      <LeadsPagination
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        loading={loading}
        onPageChange={setPage}
      />

      <NewLeadModal isOpen={isModalOpen} onClose={handleCloseModal} />
      <LeadDetailsModal isOpen={!!selectedLead} onClose={() => setSelectedLead(null)} lead={selectedLead} />
    </PageContainer>
  );
}
