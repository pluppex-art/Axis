import { Card } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { MoreVertical } from "lucide-react";

interface Student {
  id: string;
  name: string;
  status: "onboarding" | "active" | "at_risk" | "completed";
  progress: number;
}

const KANBAN_COLUMNS = [
  { id: "onboarding" as const, label: "Onboarding", colorText: "text-purple-500", colorBg: "bg-purple-500" },
  { id: "active" as const, label: "Ativos", colorText: "text-blue-500", colorBg: "bg-blue-500" },
  { id: "at_risk" as const, label: "Em Risco", colorText: "text-rose-500", colorBg: "bg-rose-500" },
  { id: "completed" as const, label: "Concluídos", colorText: "text-emerald-500", colorBg: "bg-emerald-500" },
];

interface TurmaDetalhesKanbanProps {
  students: Student[];
}

export function TurmaDetalhesKanban({ students }: TurmaDetalhesKanbanProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
      {KANBAN_COLUMNS.map((col) => (
        <div key={col.id} className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${col.colorBg}`} />
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{col.label}</h3>
            </div>
            <Badge className="bg-white/5 text-slate-500 border-none font-black text-[9px]">{students.filter(s => s.status === col.id).length}</Badge>
          </div>
          <div className="space-y-4 min-h-[500px] p-2 rounded-2xl bg-[var(--color-surface-elevated)]/30 border border-white/5 border-dashed">
            {students.filter(s => s.status === col.id).map((student) => (
              <Card key={student.id} className="p-5 bg-[var(--color-surface-elevated)] border-white/5 hover:border-blue-500/30 transition-all cursor-move group">
                <div className="flex justify-between items-start mb-4">
                  <div className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors uppercase tracking-tight">{student.name}</div>
                  <button className="p-1 rounded-lg bg-white/5 border border-white/10 opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all">
                    <MoreVertical className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-[8px] font-black text-slate-600 uppercase tracking-widest">
                    <span>Progresso</span>
                    <span className="text-blue-400">{student.progress}%</span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full" style={{ width: `${student.progress}%` }} />
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-end pt-4 border-t border-white/5">
                  <div className="flex -space-x-2">
                    <div className="w-5 h-5 rounded-full bg-indigo-500 border border-[var(--color-surface-elevated)]" />
                  </div>
                </div>
              </Card>
            ))}
            <button className="w-full py-3 rounded-xl border border-white/5 border-dashed text-[9px] font-black uppercase tracking-widest text-slate-600 hover:text-white hover:border-white/20 transition-all">
              + Mover para cá
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
