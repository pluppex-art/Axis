import { Calendar } from "lucide-react";
import { useFinanceiroFiltro, type FinanceiroPeriodoPreset } from "../FinanceiroFilterContext";

const PRESETS: { id: FinanceiroPeriodoPreset; label: string }[] = [
  { id: "mes-atual", label: "Mês Atual" },
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "90d", label: "90 dias" },
  { id: "trimestre-atual", label: "Trimestre" },
  { id: "semestre-atual", label: "Semestre" },
  { id: "ano-atual", label: "Ano" },
];

/** Barra de filtro de período — usada pelas páginas do Financeiro que não
 * têm seletor de período próprio (ver FinanceiroFilterContext.tsx pro porquê
 * do escopo). Cada página que a usa lê `useFinanceiroFiltro()` e filtra seus
 * próprios dados por `dataInicio`/`dataFim`. */
export function FinanceiroFilterBar() {
  const { preset, setPreset, setCustomRange, customStart, customEnd } = useFinanceiroFiltro();

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-faint)] flex items-center gap-1 shrink-0">
        <Calendar className="w-3.5 h-3.5" /> Período
      </span>
      <div className="flex items-center gap-1 bg-[var(--color-surface-sunken)] p-1 rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] flex-wrap">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPreset(p.id)}
            className={`px-2.5 py-1 text-[11px] font-medium rounded cursor-pointer transition-all ${
              preset === p.id ? "bg-[var(--color-primary-blue)] !text-white" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPreset("personalizado")}
          className={`px-2.5 py-1 text-[11px] font-medium rounded cursor-pointer transition-all ${
            preset === "personalizado" ? "bg-[var(--color-primary-blue)] !text-white" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          }`}
        >
          Personalizado
        </button>
      </div>
      {preset === "personalizado" && (
        <div className="flex items-center gap-1.5 bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] px-2.5 h-8 text-xs">
          <span className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase">De:</span>
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomRange(e.target.value, customEnd)}
            className="bg-transparent text-xs text-[var(--color-text-primary)] font-mono focus:outline-none"
          />
          <span className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase ml-1">Até:</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomRange(customStart, e.target.value)}
            className="bg-transparent text-xs text-[var(--color-text-primary)] font-mono focus:outline-none"
          />
        </div>
      )}
    </div>
  );
}
