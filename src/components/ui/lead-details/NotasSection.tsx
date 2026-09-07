import { useState, useEffect, useRef, useMemo } from "react";
import {
  Phone,
  Mic,
  MicOff,
  Plus,
  Trash2,
  MessageSquare,
  Sparkles,
  Flame,
  Sun,
  Snowflake,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sliders,
} from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { toast } from "sonner";
import { apiFetch } from "../../../lib/apiClient";
import { Button } from "../button";
import { Card } from "../card";
import { Badge } from "../badge";
import { cn } from "../../../lib/utils";
import { calculateLeadScore } from "../../../lib/leadScore";

interface Note {
  id: string;
  text: string;
  author: string;
  createdAt: string;
  category?: "chamada" | "interesse" | "objecao" | "decisor" | "geral";
  scoreImpact?: number;
}

interface NotasSectionProps {
  lead: any;
  leadName: string;
  companyName?: string;
  updateLead: (id: string, data: any) => void;
  score?: number;
  temperature?: "Quente" | "Morno" | "Frio";
  probability?: number;
  handleUpdateScore?: (newScore: number, customTemp?: "Quente" | "Morno" | "Frio") => void;
  seller?: string;
  setAlterationLogs?: any;
}

function parseNotes(raw: string | null | undefined): Note[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  if (raw.trim()) {
    return [
      {
        id: crypto.randomUUID(),
        text: raw.trim(),
        author: "Sistema",
        createdAt: new Date().toISOString(),
        category: "geral",
      },
    ];
  }
  return [];
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

export function NotasSection({
  lead,
  leadName,
  companyName,
  updateLead,
  score = 50,
  temperature = "Morno",
  probability = 50,
  handleUpdateScore,
  seller,
  setAlterationLogs,
}: NotasSectionProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [authorName, setAuthorName] = useState("Usuário");
  const [isAnalyzingIA, setIsAnalyzingIA] = useState(false);
  const [showScoreSlider, setShowScoreSlider] = useState(false);
  const [activeCategory, setActiveCategory] = useState<"chamada" | "interesse" | "objecao" | "decisor" | "geral">("geral");

  const recognitionRef = useRef<any>(null);
  const inputPrefixRef = useRef("");

  useEffect(() => {
    setNotes(parseNotes(lead?.notes));
  }, [lead?.id, lead?.notes]);

  useEffect(() => {
    supabase?.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      setAuthorName(
        user?.user_metadata?.name ||
        user?.user_metadata?.full_name ||
        user?.email?.split("@")[0] ||
        seller ||
        "Consultor"
      );
    });
  }, [seller]);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  const persist = async (updated: Note[]) => {
    const json = JSON.stringify(updated);
    updateLead(lead.id, { notes: json });
    if (supabase) await supabase.from("leads").update({ notes: json }).eq("id", lead.id);
  };

  const applyScoreChange = (deltaOrTarget: number, isAbsolute = false) => {
    const current = score;
    const target = isAbsolute ? deltaOrTarget : Math.max(0, Math.min(100, current + deltaOrTarget));
    if (handleUpdateScore) {
      handleUpdateScore(target);
    } else {
      const derivedTemp = target >= 71 ? "Quente" : target >= 41 ? "Morno" : "Frio";
      updateLead(lead.id, { scoreIA: target, temperature: derivedTemp });
    }
    toast.success(`Score atualizado para ${target}/100!`);
  };

  const addNoteWithCategory = async (cat: "chamada" | "interesse" | "objecao" | "decisor" | "geral" = activeCategory) => {
    const text = input.trim();
    if (!text || saving) return;

    setSaving(true);
    const id = crypto.randomUUID();

    let scoreImpact = 0;
    if (cat === "interesse") scoreImpact = 15;
    else if (cat === "decisor") scoreImpact = 10;
    else if (cat === "objecao") scoreImpact = -10;

    const note: Note = {
      id,
      text,
      author: authorName,
      createdAt: new Date().toISOString(),
      category: cat,
      scoreImpact: scoreImpact !== 0 ? scoreImpact : undefined,
    };

    const updated = [note, ...notes];
    setNotes(updated);
    setInput("");
    setActiveCategory("geral");
    await persist(updated);
    setSaving(false);

    // Recalcular Score IA do lead com base na etapa atual e no novo histórico de notas
    const evalResult = calculateLeadScore(lead, null, null, updated);
    if (handleUpdateScore) {
      handleUpdateScore(evalResult.score, evalResult.temperature);
    } else {
      updateLead(lead.id, {
        scoreIA: evalResult.score,
        temperature: evalResult.temperature,
        probability: evalResult.probability,
      });
    }

    // AI Grammar & refinement check
    try {
      const res = await apiFetch("/api/ai/corrigir-nota", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: text }),
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        let data: any;
        try { data = await res.json(); } catch { return; }
        if (data.corrigido?.trim() && data.corrigido.trim() !== text) {
          const corrected = updated.map((n) =>
            n.id === id ? { ...n, text: data.corrigido.trim() } : n
          );
          setNotes(corrected);
          await persist(corrected);
        }
      }
    } catch {}
  };

  const deleteNote = async (noteId: string) => {
    const updated = notes.filter((n) => n.id !== noteId);
    setNotes(updated);
    await persist(updated);
    toast.info("Anotação removida.");

    // Recalcular Score IA com as notas restantes e a etapa do lead
    const evalResult = calculateLeadScore(lead, null, null, updated);
    if (handleUpdateScore) {
      handleUpdateScore(evalResult.score, evalResult.temperature);
    } else {
      updateLead(lead.id, {
        scoreIA: evalResult.score,
        temperature: evalResult.temperature,
        probability: evalResult.probability,
      });
    }
  };

  const startRecording = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error("Gravação de voz não suportada neste navegador.");
      return;
    }

    inputPrefixRef.current = input.trim();
    const r = new SR();
    r.lang = "pt-BR";
    r.continuous = true;
    r.interimResults = true;

    r.onresult = (e: any) => {
      let interim = "", final = "";
      for (let i = 0; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t + " ";
        else interim += t;
      }
      const voiceText = (final + interim).trim();
      const prefix = inputPrefixRef.current;
      setInput(prefix ? `${prefix} ${voiceText}` : voiceText);
    };

    r.onerror = (e: any) => {
      if (e.error !== "aborted") toast.error("Erro na gravação: " + e.error);
      stopRecording();
    };

    r.onend = () => {
      if (recognitionRef.current) {
        recognitionRef.current = null;
        setIsRecording(false);
      }
    };

    recognitionRef.current = r;
    r.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsRecording(false);
  };

  // Avaliação do Score baseado no histórico real de anotações E na etapa do lead no funil
  const handleAIEvaluateScore = () => {
    if (notes.length === 0 && !input.trim()) {
      toast.info("Adicione pelo menos uma nota para a IA analisar o perfil do lead.");
      return;
    }

    setIsAnalyzingIA(true);

    setTimeout(() => {
      const candidateNotes = input.trim()
        ? [{ text: input.trim(), category: activeCategory }, ...notes]
        : notes;

      const evalResult = calculateLeadScore(lead, null, null, candidateNotes);

      if (handleUpdateScore) {
        handleUpdateScore(evalResult.score, evalResult.temperature);
      } else {
        updateLead(lead.id, {
          scoreIA: evalResult.score,
          score_ia: evalResult.score,
          temperature: evalResult.temperature,
          probability: evalResult.probability,
        });
      }

      setIsAnalyzingIA(false);
      toast.success(`Score IA Recalculado: ${evalResult.score}/100 (${evalResult.temperature})!`, {
        description: evalResult.reasons.join(" • ") || "Avaliação calibrada considerando a etapa do funil e as anotações.",
      });
    }, 500);
  };

  const tempIcon = temperature === "Quente"
    ? <Flame className="w-4 h-4 text-rose-500" />
    : temperature === "Morno"
    ? <Sun className="w-4 h-4 text-amber-500" />
    : <Snowflake className="w-4 h-4 text-blue-400" />;

  const tempBadgeClass = temperature === "Quente"
    ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
    : temperature === "Morno"
    ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
    : "bg-blue-500/10 border-blue-500/30 text-blue-400";

  return (
    <div className="px-5 py-4 space-y-4">
      {/* ── CARD CENTRAL DE SCORE & TEMPERATURA INTEGRADO ÀS NOTAS ── */}
      <Card className="p-4 bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[var(--color-primary-blue)]/10 flex items-center justify-center">
              {tempIcon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-white tracking-wide">Score do Lead</span>
                <span className={cn("text-[9px] px-2 py-0.5 rounded-full border font-black uppercase tracking-wider", tempBadgeClass)}>
                  {temperature}
                </span>
              </div>
              <p className="text-[10px] text-[var(--color-text-faint)]">
                Qualificação baseada nas interações e notas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAIEvaluateScore}
              disabled={isAnalyzingIA}
              className="h-7 text-[10px] font-bold gap-1 text-purple-400 border-purple-500/30 hover:bg-purple-500/10 cursor-pointer"
              title="A IA analisa as notas e calcula o Score automaticamente"
            >
              <Sparkles className={cn("w-3 h-3 text-purple-400", isAnalyzingIA && "animate-spin")} />
              {isAnalyzingIA ? "Avaliando..." : "Score por IA"}
            </Button>

            <button
              type="button"
              onClick={() => setShowScoreSlider(v => !v)}
              className="w-7 h-7 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-sunken)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-white transition-colors"
              title="Ajuste manual de Score"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Visual Score Gauge & Progress Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-white tabular-nums">{score}</span>
              <span className="text-[10px] text-slate-500 font-bold">/100</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold">
              <TrendingUp className="w-3 h-3 text-emerald-400" />
              <span>{probability}% de conversão</span>
            </div>
          </div>

          <div className="h-2 w-full bg-[var(--color-surface-sunken)] rounded-full overflow-hidden border border-white/[0.05]">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                score >= 71 ? "bg-gradient-to-r from-amber-500 to-rose-500" :
                score >= 41 ? "bg-gradient-to-r from-cyan-500 to-amber-500" :
                "bg-gradient-to-r from-slate-600 to-blue-500"
              )}
              style={{ width: `${Math.max(4, score)}%` }}
            />
          </div>
        </div>

        {/* Quick presets or Slider */}
        {showScoreSlider ? (
          <div className="pt-2 border-t border-[var(--color-border-subtle)] space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
              <span>Frio (0)</span>
              <span className="text-white font-mono text-xs">{score}</span>
              <span>Quente (100)</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={score}
              onChange={(e) => applyScoreChange(Number(e.target.value), true)}
              className="w-full accent-blue-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
            />
          </div>
        ) : (
          <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-[var(--color-border-subtle)] text-[10px]">
            <span className="text-slate-500 font-bold">Ajustes rápidos:</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => applyScoreChange(30, true)}
                className="px-2 py-0.5 rounded border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/15 text-blue-400 font-bold transition-all"
              >
                ❄️ 30
              </button>
              <button
                type="button"
                onClick={() => applyScoreChange(65, true)}
                className="px-2 py-0.5 rounded border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/15 text-amber-400 font-bold transition-all"
              >
                ☀️ 65
              </button>
              <button
                type="button"
                onClick={() => applyScoreChange(90, true)}
                className="px-2 py-0.5 rounded border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/15 text-rose-400 font-bold transition-all"
              >
                🔥 90
              </button>
              <button
                type="button"
                onClick={() => applyScoreChange(5, false)}
                className="px-2 py-0.5 rounded border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 font-bold transition-all"
              >
                +5
              </button>
              <button
                type="button"
                onClick={() => applyScoreChange(-5, false)}
                className="px-2 py-0.5 rounded border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 font-bold transition-all"
              >
                -5
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* ── SELETOR DE CATEGORIA RÁPIDA / CHIPS DE INTENÇÃO ── */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-muted)]">
            Nova Anotação
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant={isRecording ? "danger" : "outline"}
              size="sm"
              onClick={() => (isRecording ? stopRecording() : startRecording())}
              className="text-[10px] font-bold h-7 gap-1"
            >
              {isRecording ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3 text-purple-400" />}
              {isRecording ? "Parar" : "Gravar Voz"}
            </Button>
          </div>
        </div>

        {/* Chips de intenção que impactam o score */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
          <button
            type="button"
            onClick={() => {
              setActiveCategory("chamada");
              if (!input.includes("📞 Ligação:")) setInput(v => `📞 Ligação: ${v}`);
            }}
            className={cn(
              "px-2.5 py-1 rounded-lg border text-[10px] font-bold whitespace-nowrap transition-all cursor-pointer",
              activeCategory === "chamada"
                ? "bg-blue-500/20 border-blue-500 text-blue-300"
                : "bg-[var(--color-surface-sunken)] border-[var(--color-border-subtle)] text-slate-400 hover:text-white"
            )}
          >
            <Phone className="w-3 h-3 inline mr-1 text-blue-400" /> Ligação
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveCategory("interesse");
              if (!input.includes("🔥 Alto Interesse:")) setInput(v => `🔥 Alto Interesse: ${v}`);
            }}
            className={cn(
              "px-2.5 py-1 rounded-lg border text-[10px] font-bold whitespace-nowrap transition-all cursor-pointer",
              activeCategory === "interesse"
                ? "bg-rose-500/20 border-rose-500 text-rose-300"
                : "bg-[var(--color-surface-sunken)] border-[var(--color-border-subtle)] text-slate-400 hover:text-white"
            )}
          >
            <Flame className="w-3 h-3 inline mr-1 text-rose-400" /> Interesse (+15)
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveCategory("decisor");
              if (!input.includes("🎯 Decisor Contatado:")) setInput(v => `🎯 Decisor Contatado: ${v}`);
            }}
            className={cn(
              "px-2.5 py-1 rounded-lg border text-[10px] font-bold whitespace-nowrap transition-all cursor-pointer",
              activeCategory === "decisor"
                ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                : "bg-[var(--color-surface-sunken)] border-[var(--color-border-subtle)] text-slate-400 hover:text-white"
            )}
          >
            <CheckCircle2 className="w-3 h-3 inline mr-1 text-emerald-400" /> Decisor (+10)
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveCategory("objecao");
              if (!input.includes("⚠️ Objeção:")) setInput(v => `⚠️ Objeção: ${v}`);
            }}
            className={cn(
              "px-2.5 py-1 rounded-lg border text-[10px] font-bold whitespace-nowrap transition-all cursor-pointer",
              activeCategory === "objecao"
                ? "bg-amber-500/20 border-amber-500 text-amber-300"
                : "bg-[var(--color-surface-sunken)] border-[var(--color-border-subtle)] text-slate-400 hover:text-white"
            )}
          >
            <AlertTriangle className="w-3 h-3 inline mr-1 text-amber-400" /> Objeção (-10)
          </button>
        </div>
      </div>

      {/* ── TEXTAREA DE NOTA ── */}
      <div className="relative">
        {isRecording && (
          <div className="absolute top-2.5 left-3.5 flex items-center gap-1.5 z-10 pointer-events-none">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-[9px] text-rose-500 font-black uppercase tracking-widest">Gravando voz...</span>
          </div>
        )}
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              addNoteWithCategory();
            }
          }}
          placeholder="Escreva anotações importantes sobre a negociação (Ctrl+Enter para salvar)..."
          rows={3}
          className={cn(
            "w-full bg-[var(--color-surface-elevated)] border rounded-[var(--radius-control)] px-4 py-3 pr-12 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-blue)] transition-all resize-none leading-relaxed",
            isRecording ? "border-rose-500/30 pt-8" : "border-[var(--color-border-default)]"
          )}
        />
        <Button
          size="sm"
          onClick={() => addNoteWithCategory()}
          disabled={!input.trim() || saving}
          loading={saving}
          className="absolute bottom-3 right-3 w-7 h-7 p-0 rounded-lg shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex items-center justify-between -mt-2">
        <p className="text-[10px] text-[var(--color-text-faint)]">
          Autor: <span className="text-[var(--color-text-muted)] font-semibold">{authorName}</span>
        </p>
        <p className="text-[10px] text-[var(--color-text-faint)] flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-purple-400" /> Correção ortográfica IA ativa
        </p>
      </div>

      {/* ── LISTA DE NOTAS ── */}
      {notes.length > 0 ? (
        <div className="space-y-2.5">
          {notes.map((note) => {
            const isCall = note.category === "chamada" || note.text.includes("📞");
            const isInterest = note.category === "interesse" || (note.scoreImpact && note.scoreImpact > 0);
            const isObjection = note.category === "objecao" || (note.scoreImpact && note.scoreImpact < 0);

            return (
              <Card
                key={note.id}
                className={cn(
                  "p-3.5 bg-[var(--color-surface-elevated)] border space-y-2 transition-all",
                  isInterest ? "border-rose-500/25 bg-rose-500/[0.02]" :
                  isObjection ? "border-amber-500/25 bg-amber-500/[0.02]" :
                  "border-[var(--color-border-default)]"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-bold text-[var(--color-primary-blue)] uppercase tracking-wider">
                      {formatDate(note.createdAt)}
                    </p>
                    {note.scoreImpact && (
                      <span className={cn(
                        "text-[9px] font-black px-1.5 py-0.2 rounded border",
                        note.scoreImpact > 0
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                          : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                      )}>
                        {note.scoreImpact > 0 ? `+${note.scoreImpact}` : note.scoreImpact} Score
                      </span>
                    )}
                    <span className="text-[10px] text-[var(--color-text-faint)]">por {note.author}</span>
                  </div>

                  <button
                    onClick={() => deleteNote(note.id)}
                    className="p-1 bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] hover:bg-rose-500/10 rounded text-[var(--color-text-faint)] hover:text-rose-500 transition-all cursor-pointer"
                    title="Remover Nota"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <p className="text-xs text-[var(--color-text-primary)] leading-relaxed whitespace-pre-wrap">
                  {note.text}
                </p>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-8 text-center border border-dashed border-[var(--color-border-default)] rounded-[var(--radius-panel)]">
          <MessageSquare className="w-6 h-6 text-[var(--color-text-faint)]" />
          <p className="text-xs text-[var(--color-text-muted)] font-bold">Nenhuma anotação registrada ainda.</p>
          <p className="text-[11px] text-[var(--color-text-faint)]">
            Adicione observações da negociação acima para calibrar o Score do Lead automaticamente.
          </p>
        </div>
      )}
    </div>
  );
}
