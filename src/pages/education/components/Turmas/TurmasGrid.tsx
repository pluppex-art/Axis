import { Card } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { MoreVertical, Clock, Calendar, ChevronRight } from "lucide-react";

interface Turma {
  id: string;
  name: string;
  instructor: string;
  subject: string;
  students: number;
  capacity: number;
  status: "Ativa" | "Planejamento" | "Concluída";
  startDate: string;
  shift: "Manhã" | "Tarde" | "Noite";
  progress: number;
}

interface TurmasGridProps {
  turmas: Turma[];
  onSelect: (turma: Turma) => void;
}

export function TurmasGrid({ turmas, onSelect }: TurmasGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-10">
      {turmas.map((turma) => (
        <Card key={turma.id} className="group relative overflow-hidden bg-[var(--color-surface-elevated)]/80 border-white/5 hover:border-blue-500/30 transition-all duration-300">
          <div className={`absolute top-0 left-0 w-1 h-full ${
            turma.status === "Ativa" ? "bg-emerald-500" :
            turma.status === "Planejamento" ? "bg-amber-500" : "bg-slate-700"
          }`} />
          <div className="p-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <Badge className={`${
                  turma.status === "Ativa" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                  turma.status === "Planejamento" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                  "bg-slate-500/10 text-slate-500 border-slate-500/20"
                } font-black uppercase tracking-widest text-[9px] px-2.5 py-1 mb-3`}>
                  ● {turma.status}
                </Badge>
                <h3 className="text-xl font-black text-white italic group-hover:text-blue-500 transition-colors uppercase tracking-tight leading-tight">
                  {turma.name}
                </h3>
              </div>
              <button className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 flex items-center justify-center text-[10px] font-black text-blue-400">
                  {turma.instructor.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Professor / Tutor</div>
                  <div className="text-sm font-bold text-slate-200">{turma.instructor}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/[0.02] border border-white/5 p-3 rounded-xl">
                  <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1 flex items-center gap-1.5 font-mono">
                    <Clock className="w-3 h-3 text-blue-500" /> Turno
                  </div>
                  <div className="text-xs font-black text-white">{turma.shift}</div>
                </div>
                <div className="bg-white/[0.02] border border-white/5 p-3 rounded-xl">
                  <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1 flex items-center gap-1.5 font-mono">
                    <Calendar className="w-3 h-3 text-blue-500" /> Início
                  </div>
                  <div className="text-xs font-black text-white">{turma.startDate}</div>
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-white/5">
              <div className="flex justify-between items-end mb-2">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Progresso Acadêmico</div>
                <div className="text-[10px] font-black text-white font-mono">{turma.progress}%</div>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(37,99,235,0.4)]"
                  style={{ width: `${turma.progress}%` }}
                />
              </div>
              <div className="flex items-center justify-between pt-4">
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="w-6 h-6 rounded-full border border-[var(--color-surface)] bg-slate-800 flex items-center justify-center text-[8px] font-black text-slate-400">{i}</div>
                    ))}
                  </div>
                  <span className="text-[10px] font-black text-slate-400 ml-1">+{turma.students - 3} ALUNOS</span>
                </div>
                <Button
                  onClick={() => onSelect(turma)}
                  variant="ghost"
                  className="h-10 text-[10px] font-black uppercase tracking-widest text-[#2563EB] hover:bg-blue-600/10 gap-2 rounded-xl"
                >
                  Gerenciar <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
