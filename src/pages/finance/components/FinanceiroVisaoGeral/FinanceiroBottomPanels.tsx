import { Card } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { TrendingUp, Clock, ArrowUpRight, ArrowDownRight, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { useLocalization } from "../../../../contexts/LocalizationContext";

interface UpcomingEntry { label: string; date: string; value: string; type: "pagar" | "receber"; }

interface FinanceiroBottomPanelsProps {
  upcomingEntries: UpcomingEntry[];
  cpl: number | null;
  ltvProjetado: number | null;
  margemEbitda: number | null;
}

export function FinanceiroBottomPanels({ upcomingEntries, cpl, ltvProjetado, margemEbitda }: FinanceiroBottomPanelsProps) {
  const { formatCurrency } = useLocalization();
  const fmtBRL = (n: number) => formatCurrency(n);
  const insights = [
    { label: "Custo por Lead (CPL)", value: cpl !== null ? fmtBRL(cpl) : "—" },
    { label: "LTV Projetado (12m)", value: ltvProjetado !== null ? fmtBRL(ltvProjetado) : "—" },
    { label: "Margem Ebitda", value: margemEbitda !== null ? `${margemEbitda.toFixed(1)}%` : "—" },
  ];
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <Card className="p-8 border-white/5 bg-[var(--color-surface-elevated)]/80 backdrop-blur-xl">
          <h3 className="font-black flex items-center gap-3 mb-8 uppercase text-[10px] tracking-[0.2em] text-slate-300">
            <Clock className="w-4 h-4 text-blue-500" /> Agenda de Lançamentos
          </h3>
          <div className="space-y-3">
            {upcomingEntries.length === 0 ? (
              <div className="py-16 text-center italic text-slate-600 text-[10px] font-black uppercase tracking-widest bg-white/[0.01] rounded-3xl border border-dashed border-white/5">Nenhum pendente.</div>
            ) : upcomingEntries.map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-blue-500/30 hover:bg-blue-600/5 transition-all group cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:rotate-12 ${item.type === "receber" ? "text-emerald-400 bg-emerald-500/10" : "text-rose-400 bg-rose-500/10"}`}>
                    {item.type === "receber" ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="text-xs font-black text-white uppercase tracking-tight leading-none mb-1">{item.label}</p>
                    <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{item.date}</p>
                  </div>
                </div>
                <p className={`text-sm font-mono font-black ${item.type === "receber" ? "text-emerald-400" : "text-slate-300"}`}>{item.value}</p>
              </motion.div>
            ))}
          </div>
          <Button variant="ghost" className="w-full mt-8 text-[9px] font-black uppercase tracking-[0.3em] text-slate-600 hover:text-blue-400 hover:bg-blue-600/5 h-14 rounded-2xl transition-all border border-transparent hover:border-blue-500/20">Fluxo Completo</Button>
        </Card>

        <Card className="lg:col-span-2 p-8 border-white/5 bg-[var(--color-surface-elevated)]/80 backdrop-blur-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-10">
            <h3 className="font-black flex items-center gap-3 uppercase text-[10px] tracking-[0.2em] text-slate-300">
              <TrendingUp className="w-4 h-4 text-emerald-400" /> Indicadores Operacionais
            </h3>
            <Badge className="bg-white/5 border-white/10 text-slate-500 text-[8px] font-black uppercase h-6">Calculado a partir dos lançamentos do período</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              {insights.map((insight, idx) => (
                <div key={idx} className="flex items-center justify-between border-b border-white/5 pb-4 last:border-0 last:pb-0">
                  <div>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{insight.label}</p>
                    <h5 className="text-lg font-black text-white italic tracking-tighter">{insight.value}</h5>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-[32px] p-6 flex flex-col justify-center">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-blue-600/20 flex items-center justify-center text-blue-400">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white uppercase italic tracking-tighter">Consultoria IA</h4>
                  <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Recomendação Automatizada</p>
                </div>
              </div>
              <p className="text-[11px] font-bold text-slate-400 leading-relaxed uppercase tracking-tighter">
                Recomendações automatizadas de estratégia financeira ainda não estão disponíveis nesta versão do S.P.Y.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
