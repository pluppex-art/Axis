import { Wallet, Sparkles, Trash2 } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import { Card } from "../../../../components/ui/card";
import { Input } from "../../../../components/ui/input";
import { toast } from "sonner";
import { confirmDialog } from "../../../../components/ui/confirm-dialog";

interface SquadOTECalculatorProps {
  oteBaseSalary: string;
  setOteBaseSalary: (v: string) => void;
  oteCommPercentage: string;
  setOteCommPercentage: (v: string) => void;
  oteVendasRealizadas: string;
  setOteVendasRealizadas: (v: string) => void;
  oteAtingimentoMeta: string;
  setOteAtingimentoMeta: (v: string) => void;
  oteColaboradorId: string;
  setOteColaboradorId: (v: string) => void;
  oteNivel: string;
  setOteNivel: (v: string) => void;
  otePeriod: string;
  setOtePeriod: (v: string) => void;
  colaboradores: any[];
  financeCommissionEntries: any[];
  onSaveOteEntry: () => void;
  onDeleteOteEntry: (id: string) => void;
  calcVariable: number;
  calcBonus: number;
  totalOTE: number;
}

const PRESETS = [
  { l: "Analista Jr.", s: "2500", c: "2", v: "30000" },
  { l: "Especialista", s: "5000", c: "4", v: "80000" },
  { l: "Líder de Squad", s: "7000", c: "6", v: "150000" },
];

export function SquadOTECalculator({
  oteBaseSalary, setOteBaseSalary, oteCommPercentage, setOteCommPercentage,
  oteVendasRealizadas, setOteVendasRealizadas, oteAtingimentoMeta, setOteAtingimentoMeta,
  oteColaboradorId, setOteColaboradorId, oteNivel, setOteNivel, otePeriod, setOtePeriod,
  colaboradores, financeCommissionEntries, onSaveOteEntry, onDeleteOteEntry,
  calcVariable, calcBonus, totalOTE,
}: SquadOTECalculatorProps) {
  const entriesForPeriod = financeCommissionEntries
    .filter(e => e.period === otePeriod)
    .sort((a, b) => (b.realizado ?? 0) - (a.realizado ?? 0));

  const handleDelete = async (id: string, nome: string) => {
    if (!(await confirmDialog({
      title: "Remover lançamento",
      description: `Remover o lançamento de comissão de "${nome}" para ${otePeriod}? Essa ação não pode ser desfeita.`,
    }))) return;
    onDeleteOteEntry(id);
  };
  return (
    <Card className="p-6 sm:p-10 bg-[var(--color-surface)]/80 backdrop-blur-xl border border-white/10 rounded-[3rem] mt-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
        <Wallet className="w-40 h-40 text-white" />
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-400 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Ferramenta Integrada de RH & Planejamento</span>
        </div>
        <h3 className="text-xl font-bold text-white uppercase tracking-tight mt-1">Calculadora de OTE & Comissões</h3>
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Simule o On-Target Earnings de qualquer colaborador baseando-se no salário base, comissão e metas do squad.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Inputs */}
        <div className="lg:col-span-7 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">Colaborador</label>
              <select
                value={oteColaboradorId}
                onChange={e => setOteColaboradorId(e.target.value)}
                className="w-full bg-white/5 border border-white/5 h-11 text-sm rounded-xl px-3 text-white"
              >
                <option value="" className="bg-slate-900">Selecione...</option>
                {colaboradores.map(c => (
                  <option key={c.id} value={c.id} className="bg-slate-900">{c.nome} — {c.cargo}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">Período</label>
              <Input type="month" value={otePeriod} onChange={e => setOtePeriod(e.target.value)} className="bg-white/5 border-white/5 h-11 text-sm rounded-xl" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">Salário Base Mensal (R$)</label>
              <Input type="number" value={oteBaseSalary} onChange={e => setOteBaseSalary(e.target.value)} className="bg-white/5 border-white/5 h-11 text-sm rounded-xl" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">Taxa de Comissão (% sobre vendas)</label>
              <Input type="number" value={oteCommPercentage} onChange={e => setOteCommPercentage(e.target.value)} className="bg-white/5 border-white/5 h-11 text-sm rounded-xl" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">Volume de Vendas Faturado (R$)</label>
              <Input type="number" value={oteVendasRealizadas} onChange={e => setOteVendasRealizadas(e.target.value)} className="bg-white/5 border-white/5 h-11 text-sm rounded-xl" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">Atingimento da Meta Squad (%)</label>
              <Input type="number" value={oteAtingimentoMeta} onChange={e => setOteAtingimentoMeta(e.target.value)} className="bg-white/5 border-white/5 h-11 text-sm rounded-xl" />
              <span className="text-[8px] text-slate-500 font-bold block">Meta &gt;= 100% libera Bônus Superador de 25% do Base!</span>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">Nível</label>
            <Input value={oteNivel} onChange={e => setOteNivel(e.target.value)} placeholder="Ex: Júnior, Pleno, Sênior..." className="bg-white/5 border-white/5 h-11 text-sm rounded-xl" />
          </div>

          {/* Preset buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
            {PRESETS.map((loader, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setOteBaseSalary(loader.s);
                  setOteCommPercentage(loader.c);
                  setOteVendasRealizadas(loader.v);
                  setOteAtingimentoMeta("100");
                  setOteNivel(loader.l);
                  toast.info(`Simulador pré-carregado para: ${loader.l}`);
                }}
                className="p-2 py-2.5 bg-slate-900 border border-white/5 hover:bg-white/5 text-slate-400 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-wider text-center"
              >
                💼 {loader.l}
              </button>
            ))}
          </div>
        </div>

        {/* Results panel */}
        <div className="lg:col-span-5 p-6 bg-slate-950/80 border border-[#2563EB]/25 rounded-[2rem] flex flex-col justify-between">
          <div className="space-y-4">
            <span className="text-[10px] font-mono font-black uppercase tracking-widest text-[#2563EB]">ESTRUTURA DE GANHOS ESTIMADOS</span>
            <div className="border-b border-white/5 pb-3">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">On-Target Earnings (OTE Total)</div>
              <div className="text-3xl font-display font-black text-white italic mt-1 font-mono">
                R$ {totalOTE.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span>Fixo Mensal Garantido:</span>
                <span className="font-semibold text-white">R$ {parseFloat(oteBaseSalary || "0").toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Comissão Variável Estimada:</span>
                <span className="font-semibold text-emerald-400">+ R$ {calcVariable.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Acelerador de Alto Desempenho:</span>
                <span className={`font-semibold ${calcBonus > 0 ? "text-indigo-400 animate-pulse" : "text-slate-600"}`}>
                  {calcBonus > 0 ? `+ R$ ${calcBonus.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "Não Qualificado"}
                </span>
              </div>
            </div>
          </div>
          <div className="pt-6 border-t border-white/5">
            <Button
              onClick={onSaveOteEntry}
              disabled={!oteColaboradorId}
              className="w-full bg-[#2563EB] hover:bg-blue-600 font-black text-[9px] uppercase tracking-widest h-11 rounded-xl disabled:opacity-40"
            >
              Aplicar e Salvar Modelo Salarial
            </Button>
          </div>
        </div>
      </div>

      {/* Histórico de lançamentos do período */}
      <div className="mt-8 pt-6 border-t border-white/5">
        <span className="text-[10px] font-mono font-black uppercase tracking-widest text-slate-400">Lançamentos salvos — {otePeriod}</span>
        {entriesForPeriod.length === 0 ? (
          <p className="text-xs text-slate-500 mt-3">Nenhum lançamento salvo para este período ainda.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[9px] uppercase tracking-wider text-slate-500 border-b border-white/5">
                  <th className="py-2 pr-3">Nome</th>
                  <th className="py-2 pr-3">Cargo</th>
                  <th className="py-2 pr-3">Nível</th>
                  <th className="py-2 pr-3">Squad</th>
                  <th className="py-2 pr-3 text-right">Meta (R$)</th>
                  <th className="py-2 pr-3 text-right">Realizado (R$)</th>
                  <th className="py-2 pr-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {entriesForPeriod.map(entry => (
                  <tr key={entry.id}>
                    <td className="py-2 pr-3 text-white font-semibold">{entry.nome}</td>
                    <td className="py-2 pr-3 text-slate-400">{entry.cargo}</td>
                    <td className="py-2 pr-3 text-slate-400">{entry.nivel}</td>
                    <td className="py-2 pr-3 text-slate-400">{entry.squad || "—"}</td>
                    <td className="py-2 pr-3 text-right text-slate-300 font-mono">{(entry.meta ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="py-2 pr-3 text-right text-emerald-400 font-mono">{(entry.realizado ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="py-2 pr-3 text-right">
                      <button onClick={() => handleDelete(entry.id, entry.nome)} className="p-1 rounded-lg bg-white/5 border border-white/10 text-slate-500 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/25 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}
