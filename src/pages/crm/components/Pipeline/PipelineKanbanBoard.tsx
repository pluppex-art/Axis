import React from "react";
import { ChevronRight, Plus } from "lucide-react";
import { LeadCard } from "./LeadCard";
import { Task } from "../../../../types";
import { useData } from "../../../../contexts/DataContext";

import { parseCurrencyBR } from "../../../../lib/utils";
import { calculateLeadScore, normalizeText } from "../../../../lib/leadScore";

interface PipelineKanbanBoardProps {
  activePipelineStages: any[];
  filteredItemsList: any[];
  tasks: Task[];
  showAnalytics?: boolean;
  draggedLeadId: string | null;
  setDraggedLeadId: (id: string | null) => void;
  draggedOverStageId: string | null;
  setDraggedOverStageId: (id: string | null) => void;
  currentPipeline: any;
  minimizedColumns: Set<string>;
  toggleColumn: (stageId: string) => void;
  updateLead: (id: string, updates: any) => void;
  tempDropdownId: string | null;
  setTempDropdownId: (id: string | null) => void;
  openDropdownId: string | null;
  setOpenDropdownId: (id: string | null) => void;
  setSelectedLead: (lead: any) => void;
  setIsModalOpen: (open: boolean) => void;
  handleTransferToComercial: (e: any, lead: any) => void;
  handleExportIAResume: (e: any, lead: any) => void;
  setWebhookModalLead: (lead: any) => void;
  triggerCelebration?: () => void;
  onReuniaoStageDrop?: (leadId: string, stage: any) => void;
}

export function PipelineKanbanBoard({
  activePipelineStages,
  filteredItemsList,
  tasks,
  draggedLeadId,
  setDraggedLeadId,
  draggedOverStageId,
  setDraggedOverStageId,
  currentPipeline,
  minimizedColumns,
  toggleColumn,
  updateLead,
  tempDropdownId,
  setTempDropdownId,
  openDropdownId,
  setOpenDropdownId,
  setSelectedLead,
  setIsModalOpen,
  handleTransferToComercial,
  handleExportIAResume,
  setWebhookModalLead,
  triggerCelebration,
  onReuniaoStageDrop,
}: PipelineKanbanBoardProps) {
  const { products } = useData();

  // Mesma regra do LeadCard: quando o lead tem produtos vinculados, o valor
  // exibido vem da soma dos preços dos produtos, não do campo value/valor —
  // ignorar isso aqui fazia o total da coluna mostrar R$ 0 com leads que já
  // exibiam valor (via produto) nos cards.
  const getLeadValue = (l: any) => {
    const linkedProducts = (products as any[]).filter((p) => (l.productIds || []).includes(p.id));
    if (linkedProducts.length > 0) {
      return linkedProducts.reduce((s, p) => s + (Number(p.price) || 0), 0);
    }
    const raw = l.value ?? l.valor;
    return parseCurrencyBR(raw);
  };

  const handleDrop = (stage: any, e: React.DragEvent) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData("text/plain") || draggedLeadId;
    if (leadId) {
      const targetLead = filteredItemsList.find((l: any) => l.id === leadId);
      const isWon = stage.name?.toLowerCase().includes("ganho") || stage.name?.toLowerCase().includes("fechado");
      const isLost = stage.name?.toLowerCase().includes("perdid");
      const newStatus = isWon ? "Fechado" : isLost ? "Perdido" : "Em Aberto";

      // Recalcular Score IA do Lead considerando a nova etapa e as notas existentes do cliente
      const scoreCalculation = calculateLeadScore(
        targetLead ? { ...targetLead, stageId: stage.id, status: newStatus } : { stageId: stage.id, status: newStatus },
        stage,
        activePipelineStages
      );

      updateLead(leadId, {
        stageId: stage.id,
        status: newStatus,
        scoreIA: scoreCalculation.score,
        score_ia: scoreCalculation.score,
        temperature: scoreCalculation.rawTemperature,
        probability: scoreCalculation.probability,
      });

      if (isWon) {
        triggerCelebration?.();
      }

      // Abre o modal de nova reunião para todas as etapas que tenham a palavra "reunião" (ou "reuniao").
      // Expressamente NÃO abre para "diagnostico" (a menos que contenha a palavra reunião).
      const stageNameNorm = normalizeText(stage.name || "");
      const isReuniaoStage = stageNameNorm.includes("reuniao") || (stage.id && String(stage.id).toLowerCase().includes("reuniao"));

      if (isReuniaoStage && onReuniaoStageDrop) {
        onReuniaoStageDrop(leadId, stage);
      }
    }
    setDraggedOverStageId(null);
    setDraggedLeadId(null);
  };

  const matchesStage = (l: any, stage: any) =>
    String(l.stageId) === String(stage.id) ||
    String(l.stage) === String(stage.id) ||
    l.status === stage.id ||
    l.status === stage.name;

  // Leads cujo stageId não bate com NENHUMA coluna atual — acontece quando uma
  // etapa é reordenada/excluída em Configurações > CRM > Funis (os ids das etapas
  // são calculados pela posição no array, então leads que já estavam numa etapa
  // seguinte ficam com um stageId "órfão"), ou quando o lead pertence a outro funil
  // do mesmo tipo. Sem isso, esses leads desapareciam do Kanban mas continuavam
  // aparecendo no modo Lista (que não valida stageId), sumindo silenciosamente.
  const unmatchedLeads = filteredItemsList.filter(
    (l: any) => !activePipelineStages.some((stage) => matchesStage(l, stage))
  );

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 h-[calc(100vh-250px)] min-h-[500px] scrollbar-none select-none items-stretch">
      {activePipelineStages.map((stage, stageIdx) => {
        const isMinimized = minimizedColumns.has(stage.id);
        const stageLeads = filteredItemsList.filter((l: any) => matchesStage(l, stage));
        if (stageIdx === 0) stageLeads.push(...unmatchedLeads);

        return (
          <div
            key={stage.id}
            onDragOver={(e) => {
              e.preventDefault();
              setDraggedOverStageId(stage.id);
            }}
            onDragLeave={() => setDraggedOverStageId(null)}
            onDrop={(e) => handleDrop(stage, e)}
            className={`shrink-0 flex flex-col bg-[var(--color-surface)]/40 border rounded-3xl transition-all duration-300 h-full ${
              isMinimized ? "w-[56px] p-2" : "w-[280px] p-3"
            } ${draggedOverStageId === stage.id ? "border-[var(--color-primary-blue)]/50 bg-[var(--color-primary-blue)]/10 scale-[1.01]" : "border-[var(--color-border-subtle)] hover:border-[var(--color-border-default)] hover:bg-[var(--color-surface-elevated)]/60"}`}
          >
            {isMinimized ? (
              <button
                type="button"
                onClick={() => toggleColumn(stage.id)}
                className="flex flex-col items-center gap-3 py-2 w-full cursor-pointer"
                title={`${stage.name} (${stageLeads.length})`}
              >
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                <span
                  className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider"
                  style={{ writingMode: "vertical-rl", textOrientation: "mixed", transform: "rotate(180deg)" }}
                >
                  {stage.name}
                </span>
                <span className="text-[10px] font-bold text-[var(--color-text-muted)] bg-[var(--color-surface-sunken)] px-1.5 py-0.5 rounded-full">{stageLeads.length}</span>
                <ChevronRight className="w-3 h-3 text-[var(--color-text-faint)] mt-auto" />
              </button>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
                  <button type="button" onClick={() => toggleColumn(stage.id)} className="flex items-center gap-2 cursor-pointer group min-w-0">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                    <h3 className="text-xs font-bold text-[var(--color-text-primary)] uppercase tracking-wider group-hover:text-[var(--color-primary-blue)] transition-colors truncate">{stage.name}</h3>
                  </button>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-mono font-bold text-[var(--color-text-muted)]">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(
                        stageLeads.reduce((sum: number, item: any) => sum + getLeadValue(item), 0)
                      )}
                    </span>
                    <span className="text-[10px] font-bold text-[var(--color-text-primary)] bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] px-2 py-0.5 rounded-full shrink-0">{stageLeads.length}</span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 min-h-0 pb-3 scrollbar-none">
                  {stageLeads.map((item: any) => (
                    <div key={item.id}>
                      <LeadCard
                        item={item} tasks={tasks} stageName={stage.name} draggedLeadId={draggedLeadId} setDraggedLeadId={setDraggedLeadId}
                        updateLead={updateLead} tempDropdownId={tempDropdownId} setTempDropdownId={setTempDropdownId}
                        openDropdownId={openDropdownId} setOpenDropdownId={setOpenDropdownId}
                        setSelectedLead={setSelectedLead} handleTransferToComercial={handleTransferToComercial}
                        handleExportIAResume={handleExportIAResume} setWebhookModalLead={setWebhookModalLead}
                        currentPipeline={currentPipeline}
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className="w-full py-2 border border-dashed border-[var(--color-border-default)] rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-default)]/80 hover:bg-[var(--color-surface-sunken)] transition-all flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer bg-transparent"
                  >
                    <Plus className="w-3.5 h-3.5" /> Novo Lead
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
