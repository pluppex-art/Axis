import { Users, Mail, Calendar, X, Phone, Building } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import { Badge } from "../../../../components/ui/badge";

interface ColaboradorPerfilModalProps {
  colab: any;
  onClose: () => void;
}

export function ColaboradorPerfilModal({ colab, onClose }: ColaboradorPerfilModalProps) {
  if (!colab) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150" onClick={onClose}>
      <div className="w-full max-w-md bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <div className="h-20 bg-[var(--color-primary-blue)]/15 relative flex items-end justify-center border-b border-[var(--color-border-subtle)]">
          <button 
            onClick={onClose} 
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-[var(--color-surface)] border border-[var(--color-border-default)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-primary-blue)] text-white font-bold text-xl border-4 border-[var(--color-surface-elevated)] -mb-8 flex items-center justify-center shadow-md">
            {(colab.nome || "?").substring(0, 2).toUpperCase()}
          </div>
        </div>
        <div className="p-6 pt-10 text-center space-y-4">
          <div>
            <Badge variant={colab.status === "Ativo" ? "success" : colab.status === "Férias" ? "info" : "destructive"}>
              ● {colab.status}
            </Badge>
            <h2 className="text-base font-bold text-[var(--color-text-primary)] mt-2">{colab.nome}</h2>
            <p className="text-xs text-[var(--color-text-muted)] font-medium">{colab.cargo}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 border-y border-[var(--color-border-subtle)] py-3 text-left">
            <div>
              <div className="text-[10px] font-black text-[var(--color-text-faint)] uppercase">Departamento</div>
              <div className="text-xs font-bold text-[var(--color-text-primary)]">{colab.departamento || "—"}</div>
            </div>
            <div>
              <div className="text-[10px] font-black text-[var(--color-text-faint)] uppercase">Desempenho</div>
              <div className="text-xs font-bold text-emerald-500">{colab.desempenho ?? 100}%</div>
            </div>
          </div>

          <div className="space-y-2 text-left text-xs text-[var(--color-text-muted)]">
            <div className="flex items-center gap-2.5">
              <Mail className="w-4 h-4 text-[var(--color-text-faint)] shrink-0" />
              <span className="truncate">{colab.email}</span>
            </div>
            {colab.phone && (
              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-[var(--color-text-faint)] shrink-0" />
                <span className="font-mono">{colab.phone}</span>
              </div>
            )}
            <div className="flex items-center gap-2.5">
              <Calendar className="w-4 h-4 text-[var(--color-text-faint)] shrink-0" />
              <span>Admissão: {colab.dataAdmissao || "—"}</span>
            </div>
          </div>

          <Button onClick={onClose} className="w-full h-9 text-xs font-bold shadow-xs">
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}
