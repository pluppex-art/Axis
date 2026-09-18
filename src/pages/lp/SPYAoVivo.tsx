import { useEffect, useState } from "react";
import { Inbox, ScanSearch, Tag, Workflow, BellRing, CalendarCheck2 } from "lucide-react";
import { Section, Kicker, SectionTitle, Lede, FadeIn, usePrefersReducedMotion, FONT_MONO } from "./shared";
import { useLpTheme } from "./theme/LpThemeContext";

const EVENTS = [
  { time: "09:42", icon: Inbox, text: "Novo lead recebido." },
  { time: "09:42", icon: ScanSearch, text: "Lead identificado pela inteligência." },
  { time: "09:43", icon: Tag, text: "Lead classificado por intenção e urgência." },
  { time: "09:43", icon: Workflow, text: "Automação de qualificação iniciada." },
  { time: "09:44", icon: BellRing, text: "Vendedor responsável notificado." },
  { time: "09:45", icon: CalendarCheck2, text: "Follow-up criado no pipeline." },
];

export function SPYAoVivoSection() {
  const { theme } = useLpTheme();
  const reducedMotion = usePrefersReducedMotion();
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (reducedMotion) return;
    const id = setInterval(() => setActive((v) => (v + 1) % (EVENTS.length + 1)), 1400);
    return () => clearInterval(id);
  }, [reducedMotion]);

  const visibleCount = reducedMotion ? EVENTS.length : active;

  return (
    <Section id="spy-ao-vivo" className="bg-slate-50/70">
      <div className="text-center mb-14">
        <Kicker>Em operação agora</Kicker>
        <SectionTitle className="text-3xl sm:text-4xl lg:text-5xl mb-5">O S.P.Y. está vivo.</SectionTitle>
        <Lede className="max-w-xl mx-auto text-base sm:text-lg">
          Ele não apenas armazena informações. Ele movimenta a sua operação, passo a passo, em tempo real.
        </Lede>
      </div>

      <FadeIn>
        <div className="max-w-md mx-auto rounded-2xl border border-slate-200 bg-white shadow-sm p-6 sm:p-7">
          <div className="space-y-0">
            {EVENTS.map((e, i) => {
              const shown = i < visibleCount;
              return (
                <div
                  key={e.time + e.text}
                  className={`flex items-start gap-3.5 py-3 transition-opacity duration-500 ${shown ? "opacity-100" : "opacity-20"} ${i < EVENTS.length - 1 ? "border-b border-slate-100" : ""}`}
                >
                  <span className={`text-[11px] font-semibold tracking-tight pt-1.5 w-10 shrink-0 transition-colors duration-500 ${shown ? "text-slate-400" : "text-slate-300"}`} style={{ fontFamily: FONT_MONO }}>{e.time}</span>
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-500 border ${shown ? "" : "bg-slate-50 border-slate-200"}`}
                    style={shown ? { background: `${theme.primary}18`, borderColor: `${theme.primary}40` } : undefined}
                  >
                    <e.icon
                      className="w-3.5 h-3.5 transition-colors duration-500"
                      style={{ color: shown ? theme.primaryDark : "#94A3B8" }}
                    />
                  </div>
                  <span className={`text-sm pt-1 transition-colors duration-500 ${shown ? "text-slate-700 font-medium" : "text-slate-400"}`}>{e.text}</span>
                </div>
              );
            })}
          </div>
        </div>
        <p className="text-center text-[11px] text-slate-400 mt-5 uppercase tracking-wider font-medium" style={{ fontFamily: FONT_MONO }}>Sequência ilustrativa</p>
      </FadeIn>
    </Section>
  );
}
