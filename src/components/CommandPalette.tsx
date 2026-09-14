import { useState, useEffect } from "react";
import { 
  Search, Command, LayoutDashboard, Users, 
  FileText, Zap, Settings, BarChart2, 
  MessageSquare, Briefcase, Plus, Terminal
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router-dom";
import { useLocalization } from "../contexts/LocalizationContext";

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { t } = useLocalization();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((open) => !open);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const ACTIONS = [
    { name: "Dashboard Principal", icon: LayoutDashboard, path: "/app/dashboard", category: "Navegação" },
    { name: "Pipeline de Vendas", icon: Briefcase, path: "/app/pipeline", category: "Navegação" },
    { name: "Clientes & CRM", icon: Users, path: "/app/clientes", category: "CRM" },
    { name: "Automações de Marketing", icon: Zap, path: "/app/automacoes", category: "Marketing" },
    { name: "Gestão de Turmas", icon: GraduationCap, path: "/app/educacao/turmas", category: "Educação" },
    { name: "Configurações do Sistema", icon: Settings, path: "/app/configuracoes", category: "Sistema" },
  ].filter(action => action.name.toLowerCase().includes(search.toLowerCase()));

  const handleSelect = (path: string) => {
    navigate(path);
    setIsOpen(false);
    setSearch("");
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2.5 w-full sm:w-[28rem] px-3.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-500 hover:text-white hover:bg-white/10 transition-all text-sm font-medium"
      >
        <Search className="w-4 h-4 shrink-0" />
        <span className="hidden sm:inline">{t("Buscar...")}</span>
        <kbd className="hidden sm:flex items-center gap-1 ml-auto px-1.5 py-0.5 rounded border border-white/10 bg-white/5 font-mono text-xs">
          <Command className="w-3 h-3" /> K
        </kbd>
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="relative w-full max-w-2xl bg-[var(--color-surface)] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center gap-3 px-4 py-4 border-b border-white/5">
                <Search className="w-5 h-5 text-slate-500" />
                <input 
                  autoFocus
                  placeholder={t("O que você deseja fazer hoje?")}
                  className="bg-transparent border-none text-white outline-none flex-1 font-medium text-lg placeholder:text-slate-600"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest bg-white/5 px-2 py-1 rounded-md border border-white/5">
                  S.P.Y. Command Center
                </div>
              </div>

              <div className="max-h-[400px] overflow-y-auto p-2 scrollbar-none">
                {ACTIONS.length > 0 ? (
                  <div className="space-y-4">
                    {Array.from(new Set(ACTIONS.map(a => a.category))).map(category => (
                      <div key={category} className="space-y-1">
                        <div className="px-3 py-1.5 text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">
                          {t(category)}
                        </div>
                        {ACTIONS.filter(a => a.category === category).map(action => (
                          <button
                            key={action.name}
                            onClick={() => handleSelect(action.path)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-blue-600/10 group transition-all text-left"
                          >
                            <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 group-hover:text-blue-500 group-hover:border-blue-500/20 transition-all">
                              <action.icon className="w-4 h-4" />
                            </div>
                            <span className="text-sm font-bold text-slate-400 group-hover:text-white transition-colors">{t(action.name)}</span>
                            <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                              <Plus className="w-4 h-4 text-blue-500" />
                            </div>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <Terminal className="w-8 h-8 text-slate-700 mx-auto mb-3" />
                    <p className="text-sm text-slate-500 font-medium italic">{t('Nenhum comando encontrado para "{search}"').replace("{search}", search)}</p>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-white/5 bg-white/[0.02] flex items-center justify-between">
                <div className="flex gap-4">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    <span className="bg-white/10 px-1 rounded text-white">ESC</span> {t("Fechar")}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    <span className="bg-white/10 px-1 rounded text-white">ENTER</span> {t("Selecionar")}
                  </div>
                </div>
                <div className="text-[10px] text-slate-600 font-bold italic">
                  v2.4.0-stable
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

// Fixed missing import for graduation cap in the filter map above if needed, but graduation cap isn't in lucide-react list above.
import { GraduationCap } from "lucide-react";
