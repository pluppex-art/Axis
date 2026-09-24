import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type FinanceiroPeriodoPreset =
  | "mes-atual" | "7d" | "30d" | "90d"
  | "trimestre-atual" | "semestre-atual" | "ano-atual" | "personalizado";

export const FINANCEIRO_PERIODO_LABELS: Record<FinanceiroPeriodoPreset, string> = {
  "mes-atual": "Mês Atual",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
  "trimestre-atual": "Trimestre Atual",
  "semestre-atual": "Semestre Atual",
  "ano-atual": "Ano Atual",
  personalizado: "Personalizado",
};

interface FinanceiroFilterState {
  preset: FinanceiroPeriodoPreset;
  dataInicio: Date;
  dataFim: Date;
  label: string;
  customStart: string; // YYYY-MM-DD
  customEnd: string; // YYYY-MM-DD
  setPreset: (p: FinanceiroPeriodoPreset) => void;
  setCustomRange: (inicio: string, fim: string) => void;
}

const FinanceiroFilterContext = createContext<FinanceiroFilterState | null>(null);

function computeRange(preset: FinanceiroPeriodoPreset, customStart: string, customEnd: string): { dataInicio: Date; dataFim: Date } {
  const now = new Date();
  const hoje = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  if (preset === "personalizado") {
    return {
      dataInicio: customStart ? new Date(customStart + "T00:00:00") : new Date(now.getFullYear(), now.getMonth(), 1),
      dataFim: customEnd ? new Date(customEnd + "T23:59:59") : hoje,
    };
  }
  if (preset === "7d" || preset === "30d" || preset === "90d") {
    const dias = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
    const inicio = new Date(hoje);
    inicio.setDate(inicio.getDate() - dias);
    inicio.setHours(0, 0, 0, 0);
    return { dataInicio: inicio, dataFim: hoje };
  }
  if (preset === "trimestre-atual") {
    const q = Math.floor(now.getMonth() / 3);
    return { dataInicio: new Date(now.getFullYear(), q * 3, 1), dataFim: hoje };
  }
  if (preset === "semestre-atual") {
    const h = Math.floor(now.getMonth() / 6);
    return { dataInicio: new Date(now.getFullYear(), h * 6, 1), dataFim: hoje };
  }
  if (preset === "ano-atual") {
    return { dataInicio: new Date(now.getFullYear(), 0, 1), dataFim: hoje };
  }
  // "mes-atual"
  return { dataInicio: new Date(now.getFullYear(), now.getMonth(), 1), dataFim: hoje };
}

const STORAGE_KEY = "spy_financeiro_filtro_periodo";

/**
 * Filtro de período GLOBAL do módulo Financeiro — um seletor só, no topo,
 * que vale pras páginas que não tinham nenhum recorte de tempo próprio
 * (Central de Relatórios, Contatos, Transferências, Cobranças). Escopo
 * deliberadamente NÃO inclui Painel Financeiro/DRE/Fluxo de
 * Caixa/Projeção/Receber-Pagar-Receitas-Despesas — essas já têm seletor de
 * período próprio, mais específico pro que cada uma faz (ex.: o Painel tem
 * cards que são "sempre mês atual vs mês anterior" por design,
 * independente de qualquer seletor; forçar um filtro genérico ali quebraria
 * esse comportamento documentado). Ver FinanceiroFilterBar.tsx pro seletor.
 */
export function FinanceiroFilterProvider({ children }: { children: ReactNode }) {
  const [preset, setPresetState] = useState<FinanceiroPeriodoPreset>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved && saved in FINANCEIRO_PERIODO_LABELS) return saved as FinanceiroPeriodoPreset;
    } catch { /* sessionStorage indisponível (modo privado etc.) — usa o default */ }
    return "mes-atual";
  });
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const setPreset = (p: FinanceiroPeriodoPreset) => {
    setPresetState(p);
    try { sessionStorage.setItem(STORAGE_KEY, p); } catch { /* ignora — só perde a persistência entre abas */ }
  };
  const setCustomRange = (inicio: string, fim: string) => {
    setCustomStart(inicio);
    setCustomEnd(fim);
    setPresetState("personalizado");
    try { sessionStorage.setItem(STORAGE_KEY, "personalizado"); } catch { /* ignora */ }
  };

  const { dataInicio, dataFim } = useMemo(() => computeRange(preset, customStart, customEnd), [preset, customStart, customEnd]);

  const value: FinanceiroFilterState = {
    preset, dataInicio, dataFim, label: FINANCEIRO_PERIODO_LABELS[preset],
    customStart, customEnd, setPreset, setCustomRange,
  };

  return <FinanceiroFilterContext.Provider value={value}>{children}</FinanceiroFilterContext.Provider>;
}

export function useFinanceiroFiltro(): FinanceiroFilterState {
  const ctx = useContext(FinanceiroFilterContext);
  if (!ctx) throw new Error("useFinanceiroFiltro precisa ser usado dentro de <FinanceiroFilterProvider> (FinanceiroLayout).");
  return ctx;
}
