import { useEffect, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { useLpTheme } from "./theme/LpThemeContext";

/**
 * Anima tickers/loops contínuos (setInterval) só quando o visitante não pediu menos movimento no SO.
 * Motion (whileInView/initial→animate) já é leve o bastante pra manter mesmo com reduced-motion —
 * isso aqui existe só pra loops artificiais e infinitos que rodam sozinhos na tela.
 */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export const FONT_DISPLAY = "'Archivo', 'Inter', ui-sans-serif, system-ui, sans-serif";
export const FONT_BODY = "'Inter', ui-sans-serif, system-ui, sans-serif";
/** Face utilitária para leituras/telemetria (kickers, timestamps, contadores de status) — reforça o
 * registro de "instrumento operacional" do produto em vez de decorar com mais uma sans genérica. */
export const FONT_MONO = "'JetBrains Mono', ui-monospace, 'SF Mono', 'Roboto Mono', monospace";

export function Section({
  id,
  children,
  className = "",
  bordered = true,
  glow = false,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  bordered?: boolean;
  /** Renderiza dois blobs radiais desfocados e sutis para dar profundidade a seções de fundo sólido. */
  glow?: boolean;
}) {
  const { theme } = useLpTheme();
  return (
    <section
      id={id}
      className={`relative overflow-hidden py-20 sm:py-28 lg:py-32 px-5 sm:px-8 ${bordered ? "border-t border-slate-200" : ""} ${className}`}
    >
      {glow && (
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-[-10%] left-[-5%] w-[420px] h-[420px] rounded-full blur-[120px]"
            style={{ background: theme.glowColor, opacity: 0.07 }}
          />
          <div
            className="absolute bottom-[-15%] right-[-5%] w-[380px] h-[380px] rounded-full blur-[120px]"
            style={{ background: theme.glowColorAlt, opacity: 0.07 }}
          />
        </div>
      )}
      <div className="max-w-6xl mx-auto relative z-10">{children}</div>
    </section>
  );
}

export function Kicker({ children }: { children: ReactNode }) {
  const { theme } = useLpTheme();
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.22em] mb-5 ${theme.kickerTextClass}`}
      style={{ fontFamily: FONT_MONO }}
    >
      <span className={`w-1.5 h-1.5 rotate-45 bg-gradient-to-br ${theme.kickerGradient} shrink-0`} />
      {children}
    </motion.div>
  );
}

export function SectionTitle({
  children,
  className = "",
  as = "h2",
}: {
  children: ReactNode;
  className?: string;
  as?: "h1" | "h2";
}) {
  const Comp = motion[as] as any;
  return (
    <Comp
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      style={{ fontFamily: FONT_DISPLAY }}
      className={`font-extrabold tracking-tight text-slate-900 leading-[1.08] ${className}`}
    >
      {children}
    </Comp>
  );
}

export function Lede({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <motion.p
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: 0.1, duration: 0.5 }}
      className={`text-slate-500 leading-relaxed ${className}`}
    >
      {children}
    </motion.p>
  );
}

export function GlassCard({
  children,
  className = "",
  glow = false,
  interactive = false,
  style,
}: {
  children: ReactNode;
  className?: string;
  glow?: boolean;
  /** Levanta o card e intensifica a sombra no hover — usar em cards clicáveis/navegáveis. */
  interactive?: boolean;
  style?: import("react").CSSProperties;
}) {
  const { glow: themeGlow } = useLpTheme();
  return (
    <div
      className={`relative rounded-2xl border border-slate-200 bg-white transition-all duration-300 ${
        glow ? "shadow-md" : "shadow-sm"
      } ${interactive ? "hover:-translate-y-1 hover:shadow-lg hover:border-slate-300" : ""} ${className}`}
      style={{
        ...(glow ? { boxShadow: `0 20px 60px -15px ${themeGlow(0.2)}` } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Palco escuro para o núcleo da Aurora — o canvas 2D desenha um "glow" radial que só lê como brilho
 * de verdade contra um fundo escuro (contra branco, uma "luz" fica achatada, sem contraste pra
 * clarear). Preserva a LP no modo claro mantendo esse elemento pontual como uma ilha escura, técnica
 * comum em SaaS premium (ex: dashboards/mockups embutidos sobre fundo claro).
 */
export function AuroraStage({
  children,
  size = 220,
  className = "",
}: {
  children: ReactNode;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={`relative rounded-full flex items-center justify-center shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        background: "radial-gradient(circle at 50% 38%, #141a33 0%, #05060a 72%)",
        boxShadow: "0 0 100px -12px rgba(99,102,241,0.4), 0 30px 60px -20px rgba(15,23,42,0.35)",
      }}
    >
      <div className="absolute inset-0 rounded-full border border-white/[0.07]" />
      <div className="absolute inset-[6px] rounded-full border border-white/[0.04]" />
      {children}
    </div>
  );
}

export function FadeIn({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function BrandLine({ children }: { children: ReactNode }) {
  return (
    <p className="text-xl sm:text-2xl font-medium text-slate-700 italic leading-snug" style={{ fontFamily: FONT_DISPLAY }}>
      {children}
    </p>
  );
}

export const ACCENT_GRADIENT = "bg-gradient-to-r from-emerald-400 via-green-500 to-teal-400 bg-clip-text text-transparent";

/** Versão temática do Kicker — usa a cor primária do LpTheme ativo. */
export function ThemedKicker({ children }: { children: ReactNode }) {
  const { theme } = useLpTheme();
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.22em] mb-5 ${theme.kickerTextClass}`}
      style={{ fontFamily: FONT_MONO }}
    >
      <span className={`w-1.5 h-1.5 rotate-45 bg-gradient-to-br ${theme.kickerGradient} shrink-0`} />
      {children}
    </motion.div>
  );
}

/** Botão CTA primário temático. */
export function ThemedCTAButton({
  onClick,
  children,
  className = "",
}: {
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  const { theme } = useLpTheme();
  return (
    <button
      onClick={onClick}
      className={`group inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl text-sm font-bold transition-all duration-200 ${theme.ctaClass} ${className}`}
    >
      {children}
    </button>
  );
}

/** Botão CTA outline temático. */
export function ThemedOutlineButton({
  onClick,
  children,
  className = "",
}: {
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  const { theme } = useLpTheme();
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl text-sm font-bold transition-all duration-200 ${theme.ctaOutlineClass} ${className}`}
    >
      {children}
    </button>
  );
}

/** Badge/pill temático. */
export function ThemedBadge({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { theme } = useLpTheme();
  return (
    <span className={`inline-flex items-center px-3.5 py-1.5 rounded-full border text-[11px] font-black uppercase tracking-[0.15em] ${theme.badgeClass} ${className}`} style={{ fontFamily: FONT_DISPLAY }}>
      {children}
    </span>
  );
}

/** Número que conta de 0 até `value` quando entra na tela — só uma vez, via IntersectionObserver. */
export function AnimatedCounter({
  value,
  duration = 1.4,
  prefix = "",
  suffix = "",
  decimals = 0,
  className = "",
}: {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);
  const [ref, setRef] = useState<HTMLSpanElement | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (!ref) return;
    if (reducedMotion) {
      setDisplay(value);
      return;
    }
    let raf = 0;
    let started = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || started) return;
        started = true;
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min((now - start) / (duration * 1000), 1);
          const eased = 1 - Math.pow(1 - t, 3);
          setDisplay(value * eased);
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        observer.disconnect();
      },
      { threshold: 0.4 }
    );
    observer.observe(ref);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [ref, value, duration, reducedMotion]);

  return (
    <span ref={setRef} className={className}>
      {prefix}
      {display.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

/** Selo dos pilares (SPY / Aurora) — usado no hero e no fechamento da página. */
export function PillarBadge({ label, tone }: { label: string; tone?: "blue" | "violet" | "emerald" }) {
  const { theme } = useLpTheme();
  const TONE = tone && tone !== "blue" ? {
    violet: "border-violet-200 bg-violet-50 text-violet-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  }[tone] : theme.badgeClass;

  return (
    <span
      className={`inline-flex items-center px-3.5 py-1.5 rounded-full border text-[11px] font-black uppercase tracking-[0.15em] ${TONE}`}
      style={{ fontFamily: FONT_DISPLAY }}
    >
      {label}
    </span>
  );
}
