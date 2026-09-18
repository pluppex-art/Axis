import { useMemo, useState } from "react";
import { Card } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useData } from "../../../../contexts/DataContext";
import { useLocalization } from "../../../../contexts/LocalizationContext";
import { parseEntryDate } from "../../lib/financeDates";
import { cn } from "../../../../lib/utils";

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];
const MONTH_NAMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

/** Agenda do mês (§5, widget 5) — calendário com marcadores de
 * recebimentos/despesas/transferências por dia; clicar num dia mostra o
 * detalhe. Mistura status de propósito (é uma visão geral do mês, não só
 * pendências — isso é o widget separado "Vencimentos do dia"). */
export function FinanceiroAgendaMes() {
  const { financeEntries, financeTransfers } = useData();
  const { formatCurrency } = useLocalization();
  const [ref, setRef] = useState(() => new Date());
  const [diaSelecionado, setDiaSelecionado] = useState<number | null>(null);

  const ano = ref.getFullYear(), mes = ref.getMonth();

  const porDia = useMemo(() => {
    const map = new Map<number, { receber: boolean; pagar: boolean; transfer: boolean }>();
    for (const e of financeEntries as any[]) {
      const d = parseEntryDate(e.date);
      if (!d || d.getFullYear() !== ano || d.getMonth() !== mes) continue;
      const cur = map.get(d.getDate()) || { receber: false, pagar: false, transfer: false };
      if (e.type === "Receber") cur.receber = true; else cur.pagar = true;
      map.set(d.getDate(), cur);
    }
    for (const t of financeTransfers as any[]) {
      const d = new Date(t.data_pagamento + "T12:00:00");
      if (d.getFullYear() !== ano || d.getMonth() !== mes) continue;
      const cur = map.get(d.getDate()) || { receber: false, pagar: false, transfer: false };
      cur.transfer = true;
      map.set(d.getDate(), cur);
    }
    return map;
  }, [financeEntries, financeTransfers, ano, mes]);

  const itensDoDia = useMemo(() => {
    if (diaSelecionado === null) return { entries: [] as any[], recebimentosDia: 0 };
    const entries = (financeEntries as any[]).filter(e => {
      const d = parseEntryDate(e.date);
      return d && d.getFullYear() === ano && d.getMonth() === mes && d.getDate() === diaSelecionado;
    });
    const recebimentosDia = entries.filter(e => e.type === "Receber").reduce((s, e) => s + e.value, 0);
    return { entries, recebimentosDia };
  }, [financeEntries, ano, mes, diaSelecionado]);

  const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
  const totalDias = new Date(ano, mes + 1, 0).getDate();
  const celulas = [...Array(primeiroDiaSemana).fill(null), ...Array.from({ length: totalDias }, (_, i) => i + 1)];

  const hoje = new Date();
  const isHoje = (dia: number) => hoje.getFullYear() === ano && hoje.getMonth() === mes && hoje.getDate() === dia;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Agenda do Mês</h3>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => { setRef(new Date(ano, mes - 1, 1)); setDiaSelecionado(null); }} className="h-7 w-7 p-0"><ChevronLeft className="w-3.5 h-3.5" /></Button>
          <span className="text-xs font-medium text-[var(--color-text-muted)] w-28 text-center">{MONTH_NAMES[mes]} {ano}</span>
          <Button size="sm" variant="ghost" onClick={() => { setRef(new Date(ano, mes + 1, 1)); setDiaSelecionado(null); }} className="h-7 w-7 p-0"><ChevronRight className="w-3.5 h-3.5" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {WEEKDAYS.map((w, i) => <span key={i} className="text-[10px] font-semibold text-[var(--color-text-faint)] py-1">{w}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {celulas.map((dia, i) => {
          if (dia === null) return <div key={i} />;
          const marcas = porDia.get(dia);
          const selecionado = diaSelecionado === dia;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setDiaSelecionado(selecionado ? null : dia)}
              className={cn(
                "aspect-square rounded-[var(--radius-control)] text-xs flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer",
                selecionado ? "bg-[var(--color-primary-blue)] text-white" : isHoje(dia) ? "bg-[var(--color-surface-sunken)] font-semibold text-[var(--color-text-primary)] ring-1 ring-[var(--color-primary-blue)]/40" : "hover:bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)]"
              )}
            >
              <span>{dia}</span>
              {marcas && (
                <span className="flex gap-0.5">
                  {marcas.receber && <span className="w-1 h-1 rounded-full bg-[var(--color-success)]" />}
                  {marcas.pagar && <span className="w-1 h-1 rounded-full bg-[var(--color-danger)]" />}
                  {marcas.transfer && <span className="w-1 h-1 rounded-full bg-[var(--color-info)]" />}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-4 mt-4 text-[10px] text-[var(--color-text-faint)]">
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]" /> Recebimentos</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[var(--color-danger)]" /> Despesas</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[var(--color-info)]" /> Transferências</span>
      </div>

      {diaSelecionado !== null && (
        <div className="mt-4 pt-4 border-t border-[var(--color-border-subtle)]">
          <p className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">{diaSelecionado} de {MONTH_NAMES[mes]}</p>
          {itensDoDia.entries.length === 0 ? (
            <p className="text-xs text-[var(--color-text-faint)]">Nenhuma movimentação neste dia.</p>
          ) : (
            <div className="space-y-1.5">
              {itensDoDia.entries.map(e => (
                <p key={e.id} className="text-xs text-[var(--color-text-muted)]">
                  <span className="text-[var(--color-text-primary)] font-medium">{e.description}</span> - {formatCurrency(e.value)} / {e.date}, de: {e.counterparty || "Não informado"}
                </p>
              ))}
            </div>
          )}
          <p className="text-[11px] text-[var(--color-text-faint)] mt-2">Recebimentos do dia: {formatCurrency(itensDoDia.recebimentosDia)}</p>
        </div>
      )}
    </Card>
  );
}
