import { CheckCircle2, Circle } from "lucide-react";
import { Card } from "../ui/card";
import { cn } from "../../lib/utils";
import { ImplementationProgressBar } from "./ImplementationProgressBar";
import {
  IMPLEMENTATION_SECTIONS, IMPLEMENTATION_STATUS_TONE, computeProgress, isFieldDone, isFieldFilled, pendingFields,
  type ImplData, type ImplField, type ImplementationStatus,
} from "../../lib/implementationForm";

export interface ImplementationReportProps {
  clienteNome: string;
  status: ImplementationStatus;
  responsavel?: string | null;
  goLiveDate?: string | null;
  startedAt?: string | null;
  data: ImplData;
  internalNotes?: string | null;
  /** `client` esconde campos e notas internas — mesma visão que o link público vai mostrar. */
  audience: "team" | "client";
}

const fmtDate = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? iso + "T12:00:00" : iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
};

function displayValue(field: ImplField, data: ImplData): string {
  const v = data?.[field.id];
  if (!isFieldFilled(field, data)) return "Não informado";
  if (field.type === "boolean") return v ? "Sim" : "Não";
  if (field.type === "date") return fmtDate(String(v));
  return String(v);
}

const visibleFields = (fields: ImplField[], audience: "team" | "client") =>
  fields.filter((f) => audience === "team" || f.audience === "client");

/** Resumo em texto puro (pra colar no WhatsApp/e-mail dos sócios ou do cliente). */
export function buildReportText(p: ImplementationReportProps): string {
  const { overall, sections } = computeProgress(p.data, p.audience === "client" ? "client" : undefined);
  const lines: string[] = [];
  lines.push(`IMPLEMENTAÇÃO — ${p.clienteNome}`);
  lines.push(`Status: ${p.status} · Progresso: ${overall.percent}% (${overall.done}/${overall.total})`);
  if (p.responsavel) lines.push(`Responsável: ${p.responsavel}`);
  if (p.goLiveDate) lines.push(`Go-live previsto: ${fmtDate(p.goLiveDate)}`);
  const pend = pendingFields(p.data, p.audience === "client" ? "client" : undefined);
  lines.push("");
  lines.push(pend.length === 0 ? "Nada pendente." : `PENDENTE (${pend.length}):`);
  for (const { section, field } of pend) lines.push(`- [${section.title}] ${field.group ? field.group + " — " : ""}${field.label}`);
  lines.push("");
  for (const s of IMPLEMENTATION_SECTIONS) {
    const fields = visibleFields(s.fields, p.audience);
    if (fields.length === 0) continue;
    lines.push(`## ${s.title} (${sections[s.id].percent}%)`);
    for (const f of fields) lines.push(`${f.label}: ${displayValue(f, p.data)}`);
    lines.push("");
  }
  return lines.join("\n").trim();
}

export function ImplementationReportView(p: ImplementationReportProps) {
  const { overall, sections } = computeProgress(p.data, p.audience === "client" ? "client" : undefined);
  const pend = pendingFields(p.data, p.audience === "client" ? "client" : undefined);

  return (
    <div className="space-y-5">
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-black text-[var(--color-text-primary)]">{p.clienteNome}</h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Início {fmtDate(p.startedAt)} · Go-live previsto {fmtDate(p.goLiveDate)}
              {p.responsavel ? ` · Responsável: ${p.responsavel}` : ""}
            </p>
          </div>
          <span className={cn("inline-flex px-3 py-1 rounded-lg text-xs font-bold border", IMPLEMENTATION_STATUS_TONE[p.status])}>{p.status}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-3xl font-black tabular-nums text-[var(--color-text-primary)]">{overall.percent}%</span>
          <div className="flex-1">
            <ImplementationProgressBar percent={overall.percent} className="h-2.5" />
            <p className="text-[11px] text-[var(--color-text-faint)] mt-1">{overall.done} de {overall.total} itens acompanhados concluídos</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mt-5">
          {IMPLEMENTATION_SECTIONS.filter((s) => visibleFields(s.fields, p.audience).some((f) => f.track)).map((s) => (
            <div key={s.id} className="border border-[var(--color-border-subtle)] rounded-[var(--radius-control)] p-2.5">
              <p className="text-[10px] text-[var(--color-text-faint)] truncate">{s.title}</p>
              <p className="text-sm font-bold tabular-nums text-[var(--color-text-primary)]">{sections[s.id].percent}%</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
          {pend.length === 0 ? "Nada pendente" : `O que falta (${pend.length})`}
        </h3>
        {pend.length === 0 ? (
          <p className="text-xs text-[var(--color-text-muted)]">Todos os itens acompanhados estão concluídos.</p>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5">
            {pend.map(({ section, field }) => (
              <li key={field.id} className="flex items-start gap-2 text-xs text-[var(--color-text-muted)]">
                <Circle className="w-3 h-3 mt-0.5 shrink-0 text-amber-500" />
                <span><span className="text-[var(--color-text-faint)]">{section.title} ›</span> {field.group ? `${field.group} — ` : ""}{field.label}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {IMPLEMENTATION_SECTIONS.map((s) => {
        const fields = visibleFields(s.fields, p.audience);
        if (fields.length === 0) return null;
        let lastGroup: string | undefined;
        return (
          <Card key={s.id} className="p-6 break-inside-avoid">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{s.title}</h3>
              {sections[s.id].total > 0 && <span className="text-[11px] font-semibold tabular-nums text-[var(--color-text-muted)]">{sections[s.id].percent}%</span>}
            </div>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
              {fields.map((f) => {
                const showGroup = !!f.group && f.group !== lastGroup;
                lastGroup = f.group;
                const done = f.track ? isFieldDone(f, p.data) : null;
                return (
                  <div key={f.id} className={cn(f.type === "textarea" && "md:col-span-2")}>
                    {showGroup && <p className="md:col-span-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2 mt-2">{f.group}</p>}
                    <dt className="text-[11px] text-[var(--color-text-faint)] flex items-center gap-1.5">
                      {done === true && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                      {f.label}
                    </dt>
                    <dd className={cn("text-xs whitespace-pre-wrap", isFieldFilled(f, p.data) ? "text-[var(--color-text-primary)] font-medium" : "text-[var(--color-text-faint)] italic")}>
                      {displayValue(f, p.data)}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </Card>
        );
      })}

      {p.audience === "team" && p.internalNotes && (
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">Notas internas</h3>
          <p className="text-xs text-[var(--color-text-muted)] whitespace-pre-wrap">{p.internalNotes}</p>
        </Card>
      )}
    </div>
  );
}
