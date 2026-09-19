import { useMemo } from "react";
import { CalendarRange, X } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { cn } from "../../../lib/utils";

interface DashboardDateFilterProps {
  dateFrom: string | null;
  setDateFrom: (v: string | null) => void;
  dateTo: string | null;
  setDateTo: (v: string | null) => void;
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Atalhos mais comuns pra um dashboard de vendas — evita o usuário ter que
// abrir o calendário e contar dias/meses manualmente toda vez.
function buildPresets() {
  const now = new Date();
  const today = toISO(now);
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const days = (n: number) => toISO(startOfDay(new Date(now.getTime() - n * 86400000)));

  const startOfMonth = toISO(new Date(now.getFullYear(), now.getMonth(), 1));
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const startOfYear = toISO(new Date(now.getFullYear(), 0, 1));

  return [
    { label: "Hoje", from: today, to: today },
    { label: "Últimos 7 dias", from: days(6), to: today },
    { label: "Últimos 30 dias", from: days(29), to: today },
    { label: "Este mês", from: startOfMonth, to: today },
    { label: "Mês passado", from: toISO(lastMonthStart), to: toISO(lastMonthEnd) },
    { label: "Este ano", from: startOfYear, to: today },
    { label: "Tudo", from: null, to: null },
  ] as const;
}

export function DashboardDateFilter({ dateFrom, setDateFrom, dateTo, setDateTo }: DashboardDateFilterProps) {
  const presets = useMemo(buildPresets, []);
  const activePreset = presets.find((p) => p.from === dateFrom && p.to === dateTo);

  return (
    <div className="flex flex-wrap items-center gap-2 bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] px-3 py-2.5">
      <CalendarRange className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />

      {/* Atalhos rápidos */}
      <div className="flex flex-wrap items-center gap-1">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => { setDateFrom(p.from); setDateTo(p.to); }}
            className={cn(
              "px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer border",
              activePreset?.label === p.label
                ? "bg-[var(--color-primary-blue)]/10 border-[var(--color-primary-blue)]/30 text-[var(--color-primary-blue)]"
                : "bg-transparent border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-sunken)]"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="w-px h-5 bg-[var(--color-border-subtle)] mx-0.5 shrink-0" />

      {/* Período customizado */}
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          value={dateFrom ?? ""}
          onChange={(e) => setDateFrom(e.target.value || null)}
          className="bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] rounded-lg px-2 py-1 text-[11px] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-blue)]/40 cursor-pointer"
        />
        <span className="text-[10px] text-[var(--color-text-faint)] font-bold uppercase">até</span>
        <input
          type="date"
          value={dateTo ?? ""}
          onChange={(e) => setDateTo(e.target.value || null)}
          className="bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] rounded-lg px-2 py-1 text-[11px] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-blue)]/40 cursor-pointer"
        />
      </div>

      {(dateFrom || dateTo) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { setDateFrom(null); setDateTo(null); }}
          className="h-6 px-2 text-[10px] gap-1 shrink-0"
        >
          <X className="w-3 h-3" /> Limpar
        </Button>
      )}
    </div>
  );
}
