import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FileText, Trash2, ClipboardList, ArrowLeft, Check, Loader2, PartyPopper } from "lucide-react";
import { toast } from "sonner";
import { PageContainer } from "../../components/PageContainer";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { EmptyState } from "../../components/ui/empty-state";
import { confirmDialog } from "../../components/ui/confirm-dialog";
import { ImplementationProgressBar } from "../../components/implementacao/ImplementationProgressBar";
import { ImplementationSectionForm } from "../../components/implementacao/ImplementationFormFields";
import { useData } from "../../contexts/DataContext";
import { cn } from "../../lib/utils";
import {
  IMPLEMENTATION_SECTIONS, IMPLEMENTATION_STATUSES, IMPLEMENTATION_STATUS_TONE, computeProgress,
  type ImplData, type ImplementationStatus,
} from "../../lib/implementationForm";

const inputCls =
  "w-full bg-[var(--color-surface-sunken)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-blue)]";

export default function ImplementacaoDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { implementations, clienteBase, updateImplementation, deleteImplementation, updateClienteBase } = useData();

  const impl = (implementations as any[]).find((i) => i.id === id);
  const cliente = impl ? (clienteBase as any[]).find((c) => c.id === impl.cliente_id) : null;

  const [data, setData] = useState<ImplData>({});
  const [notes, setNotes] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [activeSection, setActiveSection] = useState(IMPLEMENTATION_SECTIONS[0].id);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<ImplData | null>(null);
  const initializedFor = useRef<string | null>(null);

  // Inicializa o estado local UMA vez por implementação — depois disso o estado
  // local é a fonte da tela (o refetch em tempo real não sobrescreve o que a
  // pessoa está digitando).
  useEffect(() => {
    if (impl && initializedFor.current !== impl.id) {
      initializedFor.current = impl.id;
      setData(impl.data || {});
      setNotes(impl.internal_notes || "");
      setResponsavel(impl.responsavel || "");
    }
  }, [impl]);

  const flush = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (!pending.current || !impl) return;
    const toSave = pending.current;
    pending.current = null;
    setSaveState("saving");
    await updateImplementation(impl.id, { data: toSave });
    setSaveState("saved");
  }, [impl?.id, updateImplementation]);

  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => { flushRef.current(); }, []);

  const handleFieldChange = (fieldId: string, value: any) => {
    const next = { ...data, [fieldId]: value };
    if (value === undefined) delete next[fieldId];
    setData(next);
    pending.current = next;
    setSaveState("idle");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => flushRef.current(), 700);
  };

  if (!impl) {
    return (
      <PageContainer title="Implementação" breadcrumb={[{ label: "CRM & Vendas" }, { label: "Implementações", path: "/app/crm/implementacoes" }, { label: "Detalhe" }]}>
        <EmptyState
          icon={ClipboardList}
          title="Implementação não encontrada"
          description="Ela pode ainda estar carregando ou ter sido removida."
          action={<Link to="/app/crm/implementacoes"><Button variant="outline" className="h-9 px-4 text-xs gap-1.5"><ArrowLeft className="w-3.5 h-3.5" /> Voltar</Button></Link>}
        />
      </PageContainer>
    );
  }

  const { overall, sections } = computeProgress(data);
  const section = IMPLEMENTATION_SECTIONS.find((s) => s.id === activeSection) || IMPLEMENTATION_SECTIONS[0];
  const status = impl.status as ImplementationStatus;

  const changeStatus = async (next: ImplementationStatus) => {
    const patch: Record<string, any> = { status: next };
    if (next === "Concluída") {
      patch.completed_at = new Date().toISOString();
      if (cliente?.status === "Em Implantação") await updateClienteBase(cliente.id, { status: "Ativo" });
    } else if (status === "Concluída") {
      patch.completed_at = null;
      if (cliente?.status === "Ativo") await updateClienteBase(cliente.id, { status: "Em Implantação" });
    }
    await updateImplementation(impl.id, patch);
  };

  const handleDelete = async () => {
    if (!(await confirmDialog({ title: "Excluir implementação", description: `Excluir a implementação de "${cliente?.name || "este cliente"}"? Todas as respostas do formulário serão perdidas.` }))) return;
    await flush();
    if (cliente?.status === "Em Implantação") await updateClienteBase(cliente.id, { status: "Ativo" });
    await deleteImplementation(impl.id);
    toast.success("Implementação excluída.");
    navigate("/app/crm/implementacoes");
  };

  return (
    <PageContainer
      title={cliente?.name || "Implementação"}
      description="Preencha o formulário conforme a implantação avança — salva automaticamente."
      breadcrumb={[{ label: "CRM & Vendas" }, { label: "Implementações", path: "/app/crm/implementacoes" }, { label: cliente?.name || "Detalhe" }]}
      actions={
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-[var(--color-text-faint)] flex items-center gap-1 w-20 justify-end">
            {saveState === "saving" && <><Loader2 className="w-3 h-3 animate-spin" /> Salvando…</>}
            {saveState === "saved" && <><Check className="w-3 h-3 text-emerald-500" /> Salvo</>}
          </span>
          <select
            value={status}
            onChange={(e) => changeStatus(e.target.value as ImplementationStatus)}
            className={cn("h-9 px-3 rounded-[var(--radius-control)] text-xs font-bold border cursor-pointer bg-transparent", IMPLEMENTATION_STATUS_TONE[status])}
          >
            {IMPLEMENTATION_STATUSES.map((s) => <option key={s} value={s} className="text-[var(--color-text-primary)] bg-[var(--color-surface-elevated)]">{s}</option>)}
          </select>
          <Link to={`/app/crm/implementacoes/${impl.id}/relatorio`}>
            <Button variant="outline" className="h-9 px-4 text-xs font-medium gap-1.5"><FileText className="w-3.5 h-3.5" /> Relatório</Button>
          </Link>
        </div>
      }
    >
      <div className="space-y-4 max-w-[1700px] mx-auto pb-12">
        <Card className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_220px_180px] gap-4 items-end">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Progresso geral</span>
                <span className="text-sm font-black tabular-nums text-[var(--color-text-primary)]">{overall.percent}% <span className="text-[11px] font-medium text-[var(--color-text-faint)]">({overall.done}/{overall.total})</span></span>
              </div>
              <ImplementationProgressBar percent={overall.percent} className="h-2.5" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-1 block">Responsável</label>
              <input
                type="text" value={responsavel} placeholder="Quem implanta"
                onChange={(e) => setResponsavel(e.target.value)}
                onBlur={() => { if (responsavel !== (impl.responsavel || "")) updateImplementation(impl.id, { responsavel: responsavel || null }); }}
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-1 block">Go-live previsto</label>
              <input
                type="date" value={impl.go_live_date || ""}
                onChange={(e) => updateImplementation(impl.id, { go_live_date: e.target.value || null })}
                className={inputCls}
              />
            </div>
          </div>
          {overall.percent === 100 && status !== "Concluída" && (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-[var(--radius-control)] bg-emerald-500/10 border border-emerald-500/25 px-4 py-2.5">
              <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2"><PartyPopper className="w-4 h-4" /> Todos os itens acompanhados estão prontos.</span>
              <Button size="sm" onClick={() => changeStatus("Concluída")} className="h-8 px-3 text-xs font-medium">Marcar como concluída</Button>
            </div>
          )}
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4">
          <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
            {IMPLEMENTATION_SECTIONS.map((s) => {
              const p = sections[s.id];
              const active = s.id === section.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveSection(s.id)}
                  className={cn(
                    "text-left px-3 py-2.5 rounded-[var(--radius-control)] border transition-colors cursor-pointer shrink-0 lg:shrink",
                    active ? "bg-[var(--color-primary-blue)]/10 border-[var(--color-primary-blue)]/40" : "border-transparent hover:bg-[var(--color-surface-sunken)]"
                  )}
                >
                  <span className={cn("text-xs font-semibold block", active ? "text-[var(--color-primary-blue)]" : "text-[var(--color-text-primary)]")}>{s.title}</span>
                  {p.total > 0 && (
                    <span className="flex items-center gap-2 mt-1.5">
                      <ImplementationProgressBar percent={p.percent} className="h-1" />
                      <span className="text-[10px] tabular-nums text-[var(--color-text-faint)]">{p.percent}%</span>
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="space-y-4">
            <Card className="p-6">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{section.title}</h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-1 mb-5">{section.description}</p>
              <ImplementationSectionForm section={section} data={data} onChange={handleFieldChange} audience="team" />
            </Card>

            <Card className="p-6">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">Notas internas</h3>
              <p className="text-[11px] text-[var(--color-text-faint)] mb-3">Só a equipe vê. Nunca aparece no relatório enviado ao cliente.</p>
              <textarea
                rows={4} value={notes} onChange={(e) => setNotes(e.target.value)}
                onBlur={() => { if (notes !== (impl.internal_notes || "")) updateImplementation(impl.id, { internal_notes: notes || null }); }}
                className={cn(inputCls, "resize-y")}
              />
            </Card>

            <div className="flex justify-end">
              <button type="button" onClick={handleDelete} className="text-[11px] text-[var(--color-text-faint)] hover:text-[var(--color-danger)] inline-flex items-center gap-1 cursor-pointer">
                <Trash2 className="w-3 h-3" /> Excluir implementação
              </button>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
