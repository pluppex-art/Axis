import { useState, useEffect } from "react";
import { RefreshCw, Save, Plus, Trash2 } from "lucide-react";
import { supabase } from "../../../../lib/supabase";
import { toast } from "sonner";

interface CardOption { value: string; label: string; sub?: string; icon?: string }
interface StepConfig { indicator: string; label: string; options?: CardOption[]; description?: string; }
interface FormStepsConfig {
  step0: StepConfig; step1: StepConfig; step2: StepConfig; step3: StepConfig; step4: StepConfig;
}

const DEFAULT_STEPS: FormStepsConfig = {
  step0: { indicator: "1 → IDENTIFICAÇÃO", label: "Qual é o seu nome?" },
  step1: { indicator: "2 → CONTATO",       label: "Como podemos te encontrar?" },
  step2: {
    indicator: "3 → SEU PERFIL", label: "Qual melhor descreve você hoje?",
    options: [
      { value: "aspirante", label: "Quero Empreender",  sub: "Tenho uma ideia ou vontade de abrir um negócio", icon: "🌱" },
      { value: "iniciante", label: "Estou Começando",   sub: "Tenho um negócio recente (menos de 2 anos)",      icon: "🚀" },
      { value: "pequeno",   label: "Já Empreendo",      sub: "Tenho empresa, mas quero crescer e estruturar",   icon: "📈" },
      { value: "retomada",  label: "Quero Recomeçar",   sub: "Já empreendi antes e quero retomar",              icon: "🔄" },
    ],
  },
  step3: {
    indicator: "4 → SEU DESAFIO", label: "Qual é seu maior desafio agora?",
    options: [
      { value: "validar",  label: "Validar minha ideia",               icon: "💡" },
      { value: "clientes", label: "Conseguir meus primeiros clientes",  icon: "🤝" },
      { value: "gestao",   label: "Organizar e estruturar o negócio",   icon: "⚙️" },
      { value: "escalar",  label: "Escalar e crescer com consistência", icon: "⚡" },
    ],
  },
  step4: {
    indicator: "5 → FINALIZAR", label: "Confirme sua inscrição.",
    description: "Você está solicitando uma vaga na Turma 3 da E-EMPREENDA+. Nossa equipe entrará em contato em até 48h.",
  },
};

async function loadFormSteps(tenantId: string, siteKey: string): Promise<{ data: FormStepsConfig; fromDB: boolean }> {
  if (!supabase) return { data: DEFAULT_STEPS, fromDB: false };
  const { data, error } = await supabase
    .from("landing_configs").select("content")
    .eq("tenant_id", tenantId).eq("site_key", siteKey).eq("section", "form_steps").maybeSingle();
  if (error) console.error("[FormSteps] load error:", error.message);
  const content = data?.content as FormStepsConfig | undefined;
  return { data: content ?? DEFAULT_STEPS, fromDB: !!content };
}

async function saveFormSteps(tenantId: string, siteKey: string, steps: FormStepsConfig) {
  if (!supabase) return { error: { message: "Não foi possível conectar ao servidor" } };
  return supabase.from("landing_configs").upsert(
    { tenant_id: tenantId, site_key: siteKey, section: "form_steps", content: steps, updated_at: new Date().toISOString() },
    { onConflict: "tenant_id,site_key,section" }
  );
}

interface FormStepsEditorProps {
  tenantId: string;
  siteKey: string;
}

export function FormStepsEditor({ tenantId, siteKey }: FormStepsEditorProps) {
  const [steps,  setSteps]  = useState<FormStepsConfig>(DEFAULT_STEPS);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    loadFormSteps(tenantId, siteKey).then(({ data }) => { setSteps(data); setLoaded(true); });
  }, [tenantId, siteKey]);

  const updateStep = (key: keyof FormStepsConfig, field: keyof StepConfig, val: string) =>
    setSteps(p => ({ ...p, [key]: { ...p[key], [field]: val } }));

  const updateOption = (stepKey: keyof FormStepsConfig, i: number, field: keyof CardOption, val: string) =>
    setSteps(p => {
      const opts = [...(p[stepKey].options ?? [])];
      opts[i] = { ...opts[i], [field]: val };
      return { ...p, [stepKey]: { ...p[stepKey], options: opts } };
    });

  const addOption = (stepKey: keyof FormStepsConfig) =>
    setSteps(p => ({
      ...p,
      [stepKey]: { ...p[stepKey], options: [...(p[stepKey].options ?? []), { value: `opcao_${Date.now()}`, label: "", icon: "✅" }] },
    }));

  const removeOption = (stepKey: keyof FormStepsConfig, i: number) =>
    setSteps(p => ({
      ...p,
      [stepKey]: { ...p[stepKey], options: p[stepKey].options?.filter((_, idx) => idx !== i) },
    }));

  const handleSave = async () => {
    setSaving(true);
    const { error } = await saveFormSteps(tenantId, siteKey, steps);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar."); return; }
    toast.success("Perguntas salvas! Recarregue o formulário para ver.");
  };

  if (!loaded) return <div className="py-10 flex justify-center"><RefreshCw className="w-5 h-5 text-slate-600 animate-spin" /></div>;

  const stepMeta: Array<{ key: keyof FormStepsConfig; label: string }> = [
    { key: "step0", label: "Passo 1 — Nome" },
    { key: "step1", label: "Passo 2 — Contato" },
    { key: "step2", label: "Passo 3 — Perfil (cards)" },
    { key: "step3", label: "Passo 4 — Desafio (cards)" },
    { key: "step4", label: "Passo 5 — Confirmação" },
  ];

  return (
    <div className="space-y-5">
      {stepMeta.map(({ key, label }) => {
        const step = steps[key];
        const hasOptions = !!step.options;
        return (
          <div key={key} className="bg-[var(--color-surface-elevated)] border border-white/5 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/5 bg-white/[0.02]">
              <div className="w-2 h-2 rounded-full bg-orange-500" />
              <span className="text-[11px] font-black text-white uppercase tracking-widest">{label}</span>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Pergunta</label>
                <input value={step.label} onChange={e => updateStep(key, "label", e.target.value)}
                  className="w-full bg-[var(--color-surface-elevated)] text-white border border-white/10 rounded-xl h-10 px-4 text-sm focus:outline-none focus:border-orange-500/50 transition-colors" />
              </div>
              {step.description !== undefined && (
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Descrição (texto de apoio)</label>
                  <textarea rows={2} value={step.description} onChange={e => updateStep(key, "description", e.target.value)}
                    className="w-full bg-[var(--color-surface-elevated)] text-white border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500/50 transition-colors resize-none" />
                </div>
              )}
              {hasOptions && (
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Opções</label>
                  <div className="space-y-2">
                    {step.options!.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input value={opt.icon ?? ""} onChange={e => updateOption(key, i, "icon", e.target.value)}
                          className="w-12 bg-[var(--color-surface-elevated)] text-white border border-white/10 rounded-lg h-9 px-2 text-center text-base focus:outline-none focus:border-orange-500/50 transition-colors" />
                        <input placeholder="Label" value={opt.label} onChange={e => updateOption(key, i, "label", e.target.value)}
                          className="flex-1 bg-[var(--color-surface-elevated)] text-white border border-white/10 rounded-xl h-9 px-3 text-sm focus:outline-none focus:border-orange-500/50 transition-colors" />
                        {opt.sub !== undefined && (
                          <input placeholder="Subtexto" value={opt.sub} onChange={e => updateOption(key, i, "sub", e.target.value)}
                            className="flex-1 bg-[var(--color-surface-elevated)] text-white border border-white/10 rounded-xl h-9 px-3 text-sm focus:outline-none focus:border-orange-500/50 transition-colors" />
                        )}
                        <button onClick={() => removeOption(key, i)} disabled={(step.options?.length ?? 0) <= 1}
                          className="p-2 rounded-lg bg-rose-500/5 hover:bg-rose-500/10 text-slate-600 hover:text-rose-400 disabled:opacity-30 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => addOption(key)}
                    className="mt-2 flex items-center gap-1.5 text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest transition-colors">
                    <Plus className="w-3 h-3" /> Adicionar opção
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
      <div className="flex justify-end pt-2">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-colors">
          {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {saving ? "Salvando..." : "Salvar Perguntas"}
        </button>
      </div>
    </div>
  );
}
