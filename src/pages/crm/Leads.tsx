import { useState, useMemo, useEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "../../components/ui/button";
import { NewLeadModal } from "../../components/ui/modals/crm/NewLeadModal";
import { LeadDetailsModal } from "../../components/ui/LeadDetailsModal";
import { useData } from "../../contexts/DataContext";
import { PageContainer } from "../../components/PageContainer";
import { LeadsKpis } from "./components/Leads/LeadsKPIs";
import { LeadsFiltersBar } from "./components/Leads/LeadsFiltersBar";
import { LeadsTable } from "./components/Leads/LeadsTable";

const TEMP_ORDER: Record<string, number> = { quente: 3, morno: 2, frio: 1 };

// Renderizar milhares de linhas de uma vez (a base já passou de 3 mil leads
// migrados) deixava a página muito pesada pra montar/trocar de tela. A lista
// inteira ainda é usada pros KPIs/contadores — só o que é desenhado na
// tabela/cards é limitado, com um botão pra carregar mais.
const PAGE_SIZE = 50;

export default function Leads() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [temperatureFilter, setTemperatureFilter] = useState("Todas");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const { leads, updateLead } = useData();

  const sellers = useMemo(
    () => [...new Set((leads as any[]).map((l: any) => l.seller).filter(Boolean))] as string[],
    [leads]
  );

  const filteredLeads = useMemo(() =>
    (leads as any[])
      .filter(l =>
        l.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.email?.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .filter(l => temperatureFilter === "Todas" || l.temperature === temperatureFilter)
      .sort((a, b) => {
        const va = TEMP_ORDER[a.temperature || ""] || 0;
        const vb = TEMP_ORDER[b.temperature || ""] || 0;
        return sortOrder === "desc" ? vb - va : va - vb;
      }),
  [leads, searchQuery, temperatureFilter, sortOrder]);

  // Volta pra primeira página sempre que os filtros mudam — sem isso, trocar
  // de filtro com a página 4 aberta podia render uma fatia vazia/estranha.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, temperatureFilter, sortOrder]);

  const pagedLeads = useMemo(
    () => filteredLeads.slice(0, visibleCount),
    [filteredLeads, visibleCount]
  );

  const stats = useMemo(() => ({
    total:  (leads as any[]).length,
    hot:    (leads as any[]).filter(l => l.priority === "Alta").length,
    closed: (leads as any[]).filter(l => l.status === "Fechado").length,
  }), [leads]);

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
        leads={pagedLeads}
        sellers={sellers}
        onUpdateLead={updateLead}
        onSelectLead={setSelectedLead}
      />

      {visibleCount < filteredLeads.length && (
        <div className="flex justify-center py-4">
          <Button
            variant="outline"
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          >
            Carregar mais ({filteredLeads.length - visibleCount} restantes)
          </Button>
        </div>
      )}

      <NewLeadModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      <LeadDetailsModal isOpen={!!selectedLead} onClose={() => setSelectedLead(null)} lead={selectedLead} />
    </PageContainer>
  );
}
