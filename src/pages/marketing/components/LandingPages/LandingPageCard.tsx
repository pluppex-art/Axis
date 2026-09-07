import { Card } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { Globe, Link as LinkIcon, Eye, MousePointerClick, TrendingUp, CheckCircle2, Clock, Settings, Edit2, Trash2 } from "lucide-react";
import { motion } from "motion/react";

interface LandingPage {
  id: string;
  name: string;
  url: string;
  status: string;
  views: number;
  conversions: number;
  conversion_rate?: number;
  meta_pixel_id?: string;
  google_analytics_id?: string;
}

interface LandingPageCardProps {
  page: LandingPage;
  index: number;
  onToggleStatus: (id: string) => void;
  onOpenTracking: (page: LandingPage) => void;
  onEdit: (page: LandingPage) => void;
  onDelete: (id: string) => void;
}

export function LandingPageCard({ page, index, onToggleStatus, onOpenTracking, onEdit, onDelete }: LandingPageCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
    >
      <Card className="p-5 bg-[var(--color-surface-elevated)] border-white/5 hover:border-blue-500/20 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-6 group">
        <div className="flex items-start gap-4 flex-1">
          <div className={`p-3 rounded-2xl flex items-center justify-center shrink-0 ${page.status === 'published' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-yellow-500/10 text-yellow-500'}`}>
            <Globe className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h4 className="font-bold text-white text-base">{page.name}</h4>
              <button
                onClick={() => onToggleStatus(page.id)}
                className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border transition-colors hover:bg-opacity-80 ${
                  page.status === 'published'
                    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20'
                    : 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20 hover:bg-yellow-500/20'
                }`}
              >
                {page.status === 'published' ? <><CheckCircle2 className="w-3 h-3" /> Online</> : <><Clock className="w-3 h-3" /> Rascunho</>}
              </button>
            </div>
            <a href={`https://${page.url}`} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1">
              <LinkIcon className="w-3 h-3" /> {page.url}
            </a>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:gap-6 lg:gap-12 flex-1 lg:flex-none border-t lg:border-t-0 border-white/10 pt-4 lg:pt-0 overflow-x-auto pb-2 lg:pb-0">
          <div className="flex flex-col items-center lg:items-start shrink-0">
            <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest flex items-center gap-1 mb-1"><Eye className="w-3" /> Visitas</span>
            <span className="text-lg font-bold text-white">{page.views > 0 ? page.views.toLocaleString() : "—"}</span>
          </div>
          <div className="flex flex-col items-center lg:items-start shrink-0">
            <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest flex items-center gap-1 mb-1"><MousePointerClick className="w-3 text-purple-400" /> Leads</span>
            <span className="text-lg font-bold text-white">{page.conversions > 0 ? page.conversions.toLocaleString() : "—"}</span>
          </div>
          <div className="flex flex-col items-center lg:items-start shrink-0">
            <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest flex items-center gap-1 mb-1"><TrendingUp className="w-3 text-emerald-400" /> Tx Conv</span>
            <span className="text-lg font-bold text-emerald-400">{page.views > 0 ? `${page.conversion_rate ?? 0}%` : "—"}</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 shrink-0 border-t lg:border-t-0 border-white/10 pt-4 lg:pt-0">
          <div className="hidden lg:flex items-center gap-4 mr-4 border-r border-white/10 pr-4">
            <div className="text-right">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Pixel Meta</p>
              <p className="text-xs text-emerald-400 font-semibold">• {page.meta_pixel_id ? 'Ativo' : 'Inativo'}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onOpenTracking(page)} className="hover:bg-blue-500/10 text-slate-400 hover:text-blue-400" title="Configurações de Rastreamento">
            <Settings className="w-4 h-4" />
          </Button>
          <Button onClick={() => onEdit(page)} variant="ghost" size="icon" className="hover:bg-blue-500/10 text-slate-400 hover:text-blue-400">
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button onClick={() => onDelete(page.id)} variant="ghost" size="icon" className="hover:bg-rose-500/10 text-slate-400 hover:text-rose-400">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}
