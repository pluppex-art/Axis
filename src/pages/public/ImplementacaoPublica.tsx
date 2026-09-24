import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle, Check, Loader2, Lock, ShieldCheck } from "lucide-react";
import { Card } from "../../components/ui/card";
import { ImplementationProgressBar } from "../../components/implementacao/ImplementationProgressBar";
import { ImplementationSectionForm } from "../../components/implementacao/ImplementationFormFields";
import { IMPLEMENTATION_SECTIONS, computeProgress, type ImplData } from "../../lib/implementationForm";
import { cn } from "../../lib/utils";

interface PublicImplementation {
  clienteNome: string;
  tenant: { name: string; primary_color: string | null };
  status: string;
  data: ImplData;
  editable: boolean;
}

const SAVE_DELAY_MS = 800;

/**
 * Link seguro em que o CLIENTE preenche a parte dele da implantação. Só os
 * campos marcados `audience: "client"` existem aqui — status de integração,
 * checklist de go-live e notas internas nem chegam do servidor. Acesso é pelo
 * token (share_token) na URL, mesmo modelo da proposta pública.
 */
export default function ImplementacaoPublica() {
  const { token } = useParams<{ token: string }>();
  const [impl, setImpl] = useState<PublicImplementation | null | undefined>(undefined);
  const [data, setData] = useState<ImplData>({});
  const [active, setActive] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const pending = useRef<Record<string, any>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Link com token não deve ser indexado.
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, []);

  useEffect(() => {
    if (!token) { setImpl(null); return; }
    fetch(`/api/public-implementation/${token}`, { headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: PublicImplementation | null) => {
        setImpl(d);
        if (d) {
          setData(d.data || {});
          const first = IMPLEMENTATION_SECTIONS.find((s) => s.fields.some((f) => f.audience === "client"));
          setActive(first?.id || "");
          document.title = `Implementação — ${d.clienteNome}`;
        }
      })
      .catch(() => setImpl(null));
  }, [token]);

  const flush = async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const fields = pending.current;
    if (!token || Object.keys(fields).length === 0) return;
    pending.current = {};
    setSaveState("saving");
    try {
      const r = await fetch(`/api/public-implementation/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ fields }),
      });
      if (!r.ok) throw new Error(String(r.status));
      setSaveState("saved");
    } catch {
      // Devolve pra fila — o próximo ajuste (ou o próximo ciclo) tenta de novo.
      pending.current = { ...fields, ...pending.current };
      setSaveState("error");
    }
  };

  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => { flushRef.current(); }, []);

  const handleChange = (fieldId: string, value: any) => {
    setData((prev) => {
      const next = { ...prev, [fieldId]: value };
      if (value === undefined) delete next[fieldId];
      return next;
    });
    // JSON descarta `undefined` — `null` é como o servidor entende "limpar a resposta".
    pending.current[fieldId] = value === undefined ? null : value;
    setSaveState("idle");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => flushRef.current(), SAVE_DELAY_MS);
  };

  if (impl === undefined) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0d0f14] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!impl) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0d0f14] flex items-center justify-center px-4">
        <Card className="p-8 max-w-md text-center">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
          <h1 className="text-base font-bold text-[var(--color-text-primary)] mb-1">Link não encontrado</h1>
          <p className="text-xs text-[var(--color-text-muted)]">Este link é inválido ou foi substituído. Peça um novo link a quem te enviou.</p>
        </Card>
      </div>
    );
  }

  const sections = IMPLEMENTATION_SECTIONS.filter((s) => s.fields.some((f) => f.audience === "client"));
  const section = sections.find((s) => s.id === active) || sections[0];
  const { overall, sections: bySection } = computeProgress(data, "client");
  const brand = impl.tenant.primary_color
    ? ({ "--color-primary-blue": impl.tenant.primary_color } as CSSProperties)
    : undefined;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0d0f14] px-4 py-8" style={brand}>
      <div className="max-w-3xl mx-auto space-y-5">
        <header>
          {impl.tenant.name && <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--color-text-faint)] mb-2">{impl.tenant.name}</p>}
          <h1 className="text-2xl font-black tracking-tight text-[var(--color-text-primary)]">Implementação — {impl.clienteNome}</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1.5 max-w-xl">
            Preencha o que você souber, no seu tempo. Tudo é salvo automaticamente e você pode voltar depois pelo mesmo link.
          </p>
        </header>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Seu preenchimento</span>
            <span className="text-sm font-black tabular-nums text-[var(--color-text-primary)]">{overall.percent}%</span>
          </div>
          <ImplementationProgressBar percent={overall.percent} className="h-2.5" />
          <div className="flex items-center justify-between mt-2 min-h-[16px]">
            <p className="text-[11px] text-[var(--color-text-faint)]">{overall.done} de {overall.total} itens principais respondidos</p>
            <span className="text-[11px] text-[var(--color-text-faint)] flex items-center gap-1">
              {saveState === "saving" && <><Loader2 className="w-3 h-3 animate-spin" /> Salvando…</>}
              {saveState === "saved" && <><Check className="w-3 h-3 text-emerald-500" /> Salvo</>}
              {saveState === "error" && <span className="text-rose-500">Não foi possível salvar — tentaremos de novo</span>}
            </span>
          </div>
        </Card>

        {!impl.editable && (
          <div className="flex items-center gap-2 rounded-[var(--radius-control)] bg-emerald-500/10 border border-emerald-500/25 px-4 py-3 text-xs text-emerald-600 dark:text-emerald-400">
            <Lock className="w-4 h-4 shrink-0" /> Esta implementação foi concluída — o formulário está somente para consulta.
          </div>
        )}

        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActive(s.id)}
              className={cn(
                "px-3.5 py-2 rounded-[var(--radius-control)] text-xs font-semibold border whitespace-nowrap cursor-pointer transition-colors",
                s.id === section.id
                  ? "bg-[var(--color-primary-blue)] border-[var(--color-primary-blue)] !text-white"
                  : "bg-[var(--color-surface-elevated)] border-[var(--color-border-default)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              )}
            >
              {s.title}
              {bySection[s.id]?.total > 0 && <span className="ml-1.5 opacity-70 tabular-nums">{bySection[s.id].percent}%</span>}
            </button>
          ))}
        </div>

        <Card className="p-6">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">{section.title}</h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-1 mb-5">{section.description}</p>
          <fieldset disabled={!impl.editable} className="contents">
            <ImplementationSectionForm section={section} data={data} onChange={handleChange} audience="client" />
          </fieldset>
        </Card>

        <p className="text-[11px] text-[var(--color-text-faint)] flex items-start gap-1.5 max-w-xl">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-px" />
          Por segurança, nunca envie senhas ou códigos de acesso por aqui — quando precisarmos de acesso, você concede diretamente na plataforma (ex.: Business Manager).
        </p>
      </div>
    </div>
  );
}
