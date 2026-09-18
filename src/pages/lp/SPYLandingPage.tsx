import { useEffect, useRef } from "react";
import { Navbar } from "./Navbar";
import { Hero } from "./Hero";
import { ProblemSection, NovaLogicaSection } from "./ProblemAndLogic";
import { EcossistemaSection } from "./Ecossistema";
import { ProductShowcaseSection } from "./ProductShowcase";
import { FuncionalidadesSection } from "./Funcionalidades";
import { CalculadoraROISection } from "./CalculadoraROI";
import { ComoFuncionaSection } from "./ComoFunciona";
import { ComoComecarSection } from "./ComoComecar";
import { InteligenciaSection } from "./Inteligencia";
import { SPYAoVivoSection } from "./SPYAoVivo";
import { ExemploOportunidadeSection } from "./ExemploOportunidade";
import { RadarOportunidadesSection } from "./RadarOportunidades";
import { AutomacaoWorkflowSection } from "./AutomacaoWorkflow";
import { AgentesSection } from "./Agentes";
import { EquipeHumanaSection } from "./EquipeHumana";
import { AutonomiaSection } from "./Autonomia";
import { SegmentacaoSection } from "./Segmentacao";
import { PlanosSection } from "./Planos";
import { ProvaCredibilidadeSection } from "./ProvaCredibilidade";
import { CanaisSection, BeneficiosSection } from "./CanaisEBeneficios";
import { FAQSection } from "./FAQ";
import { CTAFinalFormSection } from "./CTAFinalForm";
import { FooterSection } from "./FooterSection";
import { FONT_BODY } from "./shared";
import { LpThemeProvider } from "./theme/LpThemeContext";
import type { LpTheme } from "./theme/LP_THEMES";

const SEO_TITLE       = "S.P.Y. — O cérebro operacional da sua empresa";
const SEO_DESCRIPTION =
  "S.P.Y. é o ecossistema operacional inteligente que conecta sua empresa: a Aurora liga dados, canais e times, entende o contexto e sugere a próxima ação. Não é apenas um CRM.";
const GOOGLE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Archivo:wght@600;700;800;900&family=JetBrains+Mono:wght@500;600&display=swap";

const VALID_THEMES: LpTheme["id"][] = ["blue", "purple", "orange", "green"];

function useLandingPageSeo() {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = SEO_TITLE;

    const upsertMeta = (attr: "name" | "property", key: string, content: string) => {
      let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
      const created = !el;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      const prev = el.getAttribute("content");
      el.setAttribute("content", content);
      return { el, prev, created };
    };

    const touched = [
      upsertMeta("name",     "description",    SEO_DESCRIPTION),
      upsertMeta("property", "og:title",        SEO_TITLE),
      upsertMeta("property", "og:description",  SEO_DESCRIPTION),
      upsertMeta("property", "og:type",         "website"),
    ];

    const fontLink = document.createElement("link");
    fontLink.rel  = "stylesheet";
    fontLink.href = GOOGLE_FONTS_HREF;
    document.head.appendChild(fontLink);

    const prevHtmlBg = document.documentElement.style.backgroundColor;
    const prevBodyBg = document.body.style.backgroundColor;
    document.documentElement.style.backgroundColor = "#FFFFFF";
    document.body.style.backgroundColor            = "#FFFFFF";

    return () => {
      document.title = prevTitle;
      touched.forEach(({ el, prev, created }) => {
        if (created) el.remove();
        else if (prev !== null) el.setAttribute("content", prev);
      });
      fontLink.remove();
      document.documentElement.style.backgroundColor = prevHtmlBg;
      document.body.style.backgroundColor            = prevBodyBg;
    };
  }, []);
}

/** Lê ?theme=purple da URL e retorna o ID se válido, senão null */
function getUrlTheme(): LpTheme["id"] | null {
  try {
    const p = new URLSearchParams(window.location.search).get("theme");
    return p && VALID_THEMES.includes(p as LpTheme["id"]) ? (p as LpTheme["id"]) : null;
  } catch {
    return null;
  }
}

/** Wrapper interno que pode receber o themeId inicial da URL */
function LpContent({ initialTheme }: { initialTheme?: LpTheme["id"] }) {
  const formRef = useRef<HTMLDivElement>(null);

  const scrollToForm    = () => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const scrollToProduto = () =>
    document.querySelector("#produto")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased" style={{ fontFamily: FONT_BODY }}>
      <Navbar onCtaClick={scrollToForm} />
      <main>
        <Hero onPrimaryCta={scrollToForm} onSecondaryCta={scrollToProduto} />
        <ProblemSection />
        <EcossistemaSection />
        <ProductShowcaseSection onCta={scrollToForm} />
        <NovaLogicaSection onCta={scrollToForm} />
        <FuncionalidadesSection />
        <CalculadoraROISection onCta={scrollToForm} />
        <ComoFuncionaSection />
        <ComoComecarSection />
        <InteligenciaSection />
        <SPYAoVivoSection />
        <ExemploOportunidadeSection />
        <RadarOportunidadesSection />
        <AutomacaoWorkflowSection />
        <AgentesSection />
        <EquipeHumanaSection />
        <AutonomiaSection />
        <SegmentacaoSection />
        <PlanosSection onCta={scrollToForm} />
        <ProvaCredibilidadeSection />
        <CanaisSection />
        <BeneficiosSection />
        <FAQSection />
        <CTAFinalFormSection ref={formRef} />
      </main>
      <FooterSection />
    </div>
  );
}

export default function SPYLandingPage() {
  useLandingPageSeo();
  const urlTheme = getUrlTheme();

  return (
    <LpThemeProvider initialTheme={urlTheme ?? undefined}>
      <LpContent />
    </LpThemeProvider>
  );
}
