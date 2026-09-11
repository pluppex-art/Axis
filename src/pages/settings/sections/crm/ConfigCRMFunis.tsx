import React, { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Card } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { Plus, Bot, ChevronRight, ChevronDown, ToggleLeft, ToggleRight, Pencil, Trash2, Columns3, Users } from "lucide-react";
import { useData } from "../../../../contexts/DataContext";
import { supabase } from "../../../../lib/supabase";
import { toast } from "sonner";
import { Funil, FUNIS_DEFAULT, ETAPA_CORES, initStageConfigs } from "./funisTypes";
import { EtapaCard } from "./EtapaCard";
import { FunilModal } from "./FunilModal";
import { confirmDialog } from "../../../../components/ui/confirm-dialog";

export function ConfigCRMFunis() {
  const { funis: dbFunis, addFunil, updateFunil, deleteFunil } = useData();
  const [availableClients, setAvailableClients] = useState<string[]>([]);

  useEffect(() => {
    if (!supabase) return;
    supabase.from("clientes").select("name").order("name", { ascending: true }).then(({ data }) => {
      if (data) setAvailableClients(data.map((c: any) => c.name).filter(Boolean));
    });
  }, []);

  // Tenant sem nenhum funil salvo ainda: mostra os padrões só na tela (não
  // grava nada sozinho — vira registro real assim que o usuário salvar algo).
  const funis: Funil[] = dbFunis.length > 0 ? dbFunis : FUNIS_DEFAULT;
  const [editingFunil, setEditingFunil] = useState<Funil | null | "new">(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleSave = async (f: Funil) => {
    const existing = funis.find(x => x.id === f.id);
    const mergedConfigs = initStageConfigs(f.etapas, existing?.etapasConfig);
    const funilWithConfigs = { ...f, etapasConfig: mergedConfigs };
    if (existing) await updateFunil(f.id, funilWithConfigs);
    else await addFunil(funilWithConfigs);
    toast.success(existing ? `Funil "${f.nome}" atualizado!` : `Funil "${f.nome}" criado!`);
    setEditingFunil(null);
  };

  const handleDelete = async (id: string) => {
    const funil = funis.find(x => x.id === id);
    if (!(await confirmDialog({
      title: "Excluir funil",
      description: `Excluir o funil "${funil?.nome || "selecionado"}"? Essa ação também remove as etapas configuradas e não pode ser desfeita.`,
    }))) return;
    await deleteFunil(id);
    if (expandedId === id) setExpandedId(null);
    toast.success("Funil removido.");
  };

  const handleToggle = async (id: string) => {
    const f = funis.find(x => x.id === id);
    if (f) await updateFunil(id, { ativo: !f.ativo });
  };

  const handleStageUpdate = (funilId: string, idx: number, patch: Partial<{ nome: string; cor: string; iniciarMinimizado: boolean }>) => {
    const f = funis.find(x => x.id === funilId);
    if (!f) return;
    const configs = initStageConfigs(f.etapas, f.etapasConfig);
    updateFunil(funilId, { etapasConfig: configs.map((c, i) => i === idx ? { ...c, ...patch } : c) });
  };

  const handleStageRename = (funilId: string, idx: number, newNome: string) => {
    const f = funis.find(x => x.id === funilId);
    if (!f) return;
    const configs = initStageConfigs(f.etapas, f.etapasConfig);
    const oldNome = configs[idx].nome;
    updateFunil(funilId, {
      etapas: f.etapas.map((e, i) => i === idx ? newNome : e),
      etapasConfig: configs.map((c, i) => i === idx ? { ...c, nome: newNome } : c),
      sdrEtapaEntrada: f.sdrEtapaEntrada === oldNome ? newNome : f.sdrEtapaEntrada,
      sdrEtapaHandoff: f.sdrEtapaHandoff === oldNome ? newNome : f.sdrEtapaHandoff,
    });
  };

  const handleStageDelete = async (funilId: string, idx: number) => {
    const f = funis.find(x => x.id === funilId);
    if (!f) return;
    const configs = initStageConfigs(f.etapas, f.etapasConfig);
    const stageName = configs[idx]?.nome || f.etapas[idx];
    if (!(await confirmDialog({
      title: "Excluir etapa",
      description: `Excluir a etapa "${stageName}"? Essa ação não pode ser desfeita.`,
    }))) return;
    updateFunil(funilId, { etapas: f.etapas.filter((_, i) => i !== idx), etapasConfig: configs.filter((_, i) => i !== idx) });
  };

  const handleStageAdd = (funilId: string) => {
    const f = funis.find(x => x.id === funilId);
    if (!f) return;
    const configs = initStageConfigs(f.etapas, f.etapasConfig);
    const newNome = `Nova Etapa ${configs.length + 1}`;
    const newCor = ["blue", "orange", "cyan", "emerald", "purple", "rose", "amber", "indigo", "pink", "slate"][configs.length % 10];
    updateFunil(funilId, { etapas: [...f.etapas, newNome], etapasConfig: [...configs, { nome: newNome, cor: newCor, iniciarMinimizado: false }] });
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const funilId = result.source.droppableId;
    const f = funis.find(x => x.id === funilId);
    if (!f) return;
    const configs = initStageConfigs(f.etapas, f.etapasConfig);
    const newEtapas = [...f.etapas];
    const newConfigs = [...configs];
    const [etapa] = newEtapas.splice(result.source.index, 1);
    const [config] = newConfigs.splice(result.source.index, 1);
    newEtapas.splice(result.destination!.index, 0, etapa);
    newConfigs.splice(result.destination!.index, 0, config);
    updateFunil(funilId, { etapas: newEtapas, etapasConfig: newConfigs });
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Funis & Etapas</h1>
          <p className="text-sm text-slate-400">Configure os pipelines de vendas e o comportamento do SDR IA.</p>
        </div>
        <Button onClick={() => setEditingFunil("new")} className="bg-[#2563EB] hover:bg-blue-600 font-bold px-6 shadow-lg shadow-blue-500/20">
          <Plus className="w-4 h-4 mr-2" /> Novo Funil
        </Button>
      </div>

      <div className="space-y-3">
        {funis.map(f => {
          const isExpanded = expandedId === f.id;
          const stages = initStageConfigs(f.etapas, f.etapasConfig);

          return (
            <Card key={f.id} className="bg-[var(--color-surface-elevated)]/80 backdrop-blur-xl border border-white/10 hover:border-white/15 transition-all">
              <div className="p-5 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${f.tipo === "sdr_ia" ? "bg-blue-500/10 border border-blue-500/20" : "bg-slate-500/10 border border-slate-500/20"}`}>
                  {f.tipo === "sdr_ia" ? <Bot className="w-5 h-5 text-blue-400" /> : <Columns3 className="w-5 h-5 text-slate-400" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-white text-sm uppercase tracking-tight">{f.nome}</span>
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${f.tipo === "sdr_ia" ? "bg-blue-500/10 border-blue-500/20 text-blue-400" : "bg-slate-500/10 border-slate-500/20 text-slate-400"}`}>
                      {f.tipo === "sdr_ia" ? "SDR IA" : "Comercial"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-2 flex-wrap">
                    {stages.slice(0, 5).map((s, i) => {
                      const cor = ETAPA_CORES[s.cor] ?? ETAPA_CORES.slate;
                      return (
                        <React.Fragment key={i}>
                          <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded border bg-white/5 border-white/5 text-slate-500">
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: cor.dot }} />
                            {s.nome}
                          </span>
                          {i < Math.min(stages.length, 5) - 1 && <ChevronRight className="w-2.5 h-2.5 text-slate-700 shrink-0" />}
                        </React.Fragment>
                      );
                    })}
                    {stages.length > 5 && <span className="text-[9px] text-slate-600 font-bold">+{stages.length - 5}</span>}
                  </div>
                  {availableClients.length > 0 && (
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      <Users className="w-2.5 h-2.5 text-slate-600 shrink-0" />
                      {f.clientIds && f.clientIds.length > 0 ? (
                        <>
                          {f.clientIds.slice(0, 3).map((t: string) => (
                            <span key={t} className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">{t}</span>
                          ))}
                          {f.clientIds.length > 3 && <span className="text-[8px] text-slate-600 font-bold">+{f.clientIds.length - 3}</span>}
                        </>
                      ) : (
                        <span className="text-[8px] font-bold text-slate-600">Global — todos os clientes</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => handleToggle(f.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all ${f.ativo ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-white/5 border-white/10 text-slate-500"}`}>
                    {f.ativo ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                    {f.ativo ? "Ativo" : "Inativo"}
                  </button>
                  <button onClick={() => setEditingFunil(f)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-all">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(f.id)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-slate-600 hover:text-rose-400 hover:border-rose-500/30 transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setExpandedId(isExpanded ? null : f.id)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all ${isExpanded ? "bg-blue-500/10 border-blue-500/20 text-blue-400" : "bg-white/5 border-white/10 text-slate-400 hover:text-white hover:border-white/20"}`}>
                    <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} />
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-white/5 overflow-x-auto">
                  <DragDropContext onDragEnd={onDragEnd}>
                    <Droppable droppableId={f.id} direction="horizontal">
                      {(provided) => (
                        <div ref={provided.innerRef} {...provided.droppableProps} className="flex gap-3 p-4 min-w-max">
                          {stages.map((stage, idx) => {
                            const corInfo = ETAPA_CORES[stage.cor] ?? ETAPA_CORES.slate;
                            return (
                              <Draggable key={`${f.id}-${idx}`} draggableId={`${f.id}-${idx}`} index={idx}>
                                {(drag, snapshot) => (
                                  <div ref={drag.innerRef} {...drag.draggableProps} className={snapshot.isDragging ? "opacity-80 rotate-1 scale-105" : ""}>
                                    <EtapaCard
                                      stage={stage} idx={idx} corInfo={corInfo}
                                      dragHandleProps={drag.dragHandleProps}
                                      onRename={(nome) => handleStageRename(f.id, idx, nome)}
                                      onDelete={() => handleStageDelete(f.id, idx)}
                                      onUpdate={(patch) => handleStageUpdate(f.id, idx, patch)}
                                      onColorChange={(cor) => handleStageUpdate(f.id, idx, { cor })}
                                    />
                                  </div>
                                )}
                              </Draggable>
                            );
                          })}
                          {provided.placeholder}
                          <button onClick={() => handleStageAdd(f.id)}
                            className="flex-shrink-0 w-[200px] rounded-2xl border border-dashed border-white/10 bg-transparent flex flex-col items-center justify-center min-h-[220px] gap-2 text-slate-600 hover:text-slate-400 hover:border-white/20 transition-all">
                            <Plus className="w-6 h-6" />
                            <span className="text-[9px] font-black uppercase tracking-widest">Adicionar Etapa</span>
                          </button>
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                </div>
              )}
            </Card>
          );
        })}

        {funis.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 bg-white/[0.02] border border-dashed border-white/10 rounded-2xl">
            <Columns3 className="w-8 h-8 text-slate-600" />
            <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest text-center">Nenhum funil cadastrado.<br />Clique em "Novo Funil" para começar.</p>
          </div>
        )}
      </div>

      {editingFunil !== null && (
        <FunilModal
          funil={editingFunil === "new" ? null : editingFunil}
          onClose={() => setEditingFunil(null)}
          onSave={handleSave}
          availableClients={availableClients}
        />
      )}
    </div>
  );
}
