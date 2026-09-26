import { Fragment, useState } from "react";
import { CheckCircle2, Loader2, Search, AlertTriangle } from "lucide-react";
import { cn } from "../../lib/utils";
import type { ImplData, ImplField, ImplSection } from "../../lib/implementationForm";
import { LookupError, fetchCep, fetchCnpj, formatCepMask, formatCnpjMask, isValidCnpj, onlyDigits } from "../../lib/brLookup";

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

/** Campo com consulta pública (CNPJ → Receita, CEP → endereço). Buscar é uma ação explícita: os dados
 * da Receita/Correios SUBSTITUEM razão social, endereço e CEP (fonte oficial — um endereço antigo
 * vindo do cadastro do lead não pode ficar). Nome fantasia só troca se a Receita tiver um; segmento
 * só é preenchido se estiver vazio (o CNAE é genérico e o cliente pode ter descrito melhor). O
 * resumo mostra o que mudou. Se a consulta falhar, o preenchimento manual segue valendo. */
function LookupField({ field, data, onFill }: { field: ImplField; data: ImplData; onFill: (fieldId: string, value: any) => void }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "warn" | "err"; text: string } | null>(null);
  const value = (data?.[field.id] as string) ?? "";
  const isCnpj = field.lookup === "cnpj";
  const digits = onlyDigits(value);
  const complete = isCnpj ? digits.length === 14 : digits.length === 8;
  const cur = (id: string) => String(data?.[id] ?? "").trim();

  const buscar = async () => {
    setLoading(true); setMsg(null);
    try {
      if (isCnpj) {
        const info = await fetchCnpj(value);
        const changed: string[] = [];
        const apply = (id: string, v: string, label: string, onlyIfEmpty = false) => {
          if (!v || cur(id) === v) return;
          if (onlyIfEmpty && cur(id)) return;
          onFill(id, v); changed.push(label);
        };
        apply("razao_social", info.razao_social, "razão social");
        apply("nome_fantasia", info.nome_fantasia, "nome fantasia");
        apply("segmento", info.segmento, "segmento", true);
        apply("endereco", info.endereco, "endereço");
        apply("cep", formatCepMask(info.cep), "CEP");
        const ativa = /ativa/i.test(info.situacao);
        setMsg({
          tone: ativa ? "ok" : "warn",
          text: `${info.razao_social} — situação ${info.situacao || "não informada"}. ${changed.length ? `Atualizado: ${changed.join(", ")}.` : "Os dados já estavam iguais aos da Receita."}`,
        });
      } else {
        const info = await fetchCep(value);
        const changed = cur("endereco") !== info.endereco;
        if (changed) onFill("endereco", info.endereco);
        setMsg({ tone: "ok", text: `${info.endereco}${changed ? " — endereço atualizado." : " — o endereço já estava igual."}` });
      }
    } catch (e: any) {
      setMsg({ tone: "err", text: e instanceof LookupError ? e.message : "Não foi possível consultar agora." });
    } finally { setLoading(false); }
  };

  const invalid = isCnpj && digits.length === 14 && !isValidCnpj(digits);
  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          type="text" inputMode="numeric" value={value} placeholder={field.placeholder}
          maxLength={isCnpj ? 18 : 9}
          onChange={(e) => { setMsg(null); onFill(field.id, isCnpj ? formatCnpjMask(e.target.value) : formatCepMask(e.target.value)); }}
          className={cn(inputCls, invalid && "!border-rose-500")}
        />
        <button
          type="button" onClick={buscar} disabled={!complete || invalid || loading}
          className="shrink-0 h-[34px] px-3 rounded-[var(--radius-control)] border border-[var(--color-border-default)] text-xs font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-sunken)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />} Buscar
        </button>
      </div>
      {invalid && !msg && <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> CNPJ inválido — confira os dígitos.</p>}
      {msg && (
        <p className={cn("text-[11px] mt-1 flex items-start gap-1", msg.tone === "ok" ? "text-emerald-600" : msg.tone === "warn" ? "text-amber-600" : "text-rose-500")}>
          {msg.tone === "ok" ? <CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0" /> : <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />} <span>{msg.text}</span>
        </p>
      )}
    </div>
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
              {f.lookup
                ? <LookupField field={f} data={data} onFill={onChange} />
                : <FieldControl field={f} value={data?.[f.id]} onChange={(v) => onChange(f.id, v)} />}
              {f.help && <p className="text-[10px] text-[var(--color-text-faint)] mt-1">{f.help}</p>}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
