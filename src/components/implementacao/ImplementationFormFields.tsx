import { Fragment } from "react";
import { cn } from "../../lib/utils";
import type { ImplData, ImplField, ImplSection } from "../../lib/implementationForm";

const inputCls =
  "w-full bg-[var(--color-surface-sunken)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-blue)]";

function FieldControl({ field, value, onChange }: { field: ImplField; value: any; onChange: (v: any) => void }) {
  if (field.type === "textarea") {
    return <textarea rows={3} value={value ?? ""} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} className={cn(inputCls, "resize-y")} />;
  }
  if (field.type === "select") {
    return (
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={cn(inputCls, "cursor-pointer")}>
        <option value="">Selecione…</option>
        {field.options?.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (field.type === "boolean") {
    // Clicar de novo na opção marcada limpa a resposta (nem sim nem não = ainda não respondido).
    const opt = (label: string, val: boolean, activeCls: string) => (
      <button
        type="button"
        onClick={() => onChange(value === val ? undefined : val)}
        className={cn(
          "px-4 py-1.5 text-xs font-semibold rounded-[var(--radius-control)] border transition-colors cursor-pointer",
          value === val ? activeCls : "bg-[var(--color-surface-sunken)] border-[var(--color-border-default)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
        )}
      >
        {label}
      </button>
    );
    return (
      <div className="flex items-center gap-2">
        {opt("Sim", true, "bg-emerald-500 border-emerald-500 !text-white")}
        {opt("Não", false, "bg-slate-500 border-slate-500 !text-white")}
      </div>
    );
  }
  return (
    <input
      type={field.type === "date" ? "date" : "text"}
      value={value ?? ""}
      placeholder={field.placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={inputCls}
    />
  );
}

/**
 * Renderiza os campos de uma seção. `audience="client"` esconde os campos
 * internos (status de integração, checklist de go-live) — é o mesmo componente
 * que a página pública do cliente vai usar.
 */
export function ImplementationSectionForm({
  section, data, onChange, audience,
}: {
  section: ImplSection;
  data: ImplData;
  onChange: (fieldId: string, value: any) => void;
  audience: "team" | "client";
}) {
  const fields = section.fields.filter((f) => audience === "team" || f.audience === "client");
  let lastGroup: string | undefined;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {fields.map((f) => {
        const showGroup = !!f.group && f.group !== lastGroup;
        lastGroup = f.group;
        const wide = f.type === "textarea";
        return (
          <Fragment key={f.id}>
            {showGroup && (
              <h4 className="md:col-span-2 text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] pt-3 mt-1 border-t border-[var(--color-border-subtle)] first:border-0 first:pt-0 first:mt-0">
                {f.group}
              </h4>
            )}
            <div className={wide ? "md:col-span-2" : ""}>
              <label className="text-xs font-bold text-[var(--color-text-muted)] mb-1 flex items-center gap-2">
                {f.label}
                {f.track && <span className="text-[9px] font-semibold uppercase text-[var(--color-primary-blue)]">acompanhado</span>}
                {audience === "team" && f.audience === "internal" && (
                  <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] text-[var(--color-text-faint)]">interno</span>
                )}
              </label>
              <FieldControl field={f} value={data?.[f.id]} onChange={(v) => onChange(f.id, v)} />
              {f.help && <p className="text-[10px] text-[var(--color-text-faint)] mt-1">{f.help}</p>}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
