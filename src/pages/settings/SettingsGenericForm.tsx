import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Save } from "lucide-react";
import { useLocation } from "react-router-dom";

export default function SettingsGenericForm() {
  const location = useLocation();
  const pathParts = location.pathname.split('/');
  const activeSection = pathParts[pathParts.length - 1];
  
  const titles: Record<string, string> = {
    'marca': 'Aparência & Marca',
    'filiais': 'Filiais da Empresa',
    'equipe': 'Equipe & Convites',
    'permissoes': 'Perfis & Permissões',
    'funis': 'Funis & Etapas (CRM)',
    'origens': 'Origens de Leads',
    'produtos': 'Catálogo de Produtos',
    'categorias': 'Categorias do Sistema',
    'modelos': 'Modelos de Mensagem',
    'automacoes': 'Regras de Automação',
    'apps': 'Aplicativos e Integrações'
  };

  const title = titles[activeSection] || 'Configuração Adicional';

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-slate-400">Esta configuração ainda está em desenvolvimento.</p>
        </div>
      </div>

      <Card className="p-6 bg-[var(--color-surface-elevated)]/80 backdrop-blur-xl border border-white/10">
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
              Parâmetro 1
            </label>
            <input 
              type="text" 
              disabled 
              className="w-full bg-[var(--color-surface)] border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors"
              placeholder="Configuração padrão auto-preenchida"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
              Habilitar Recurso
            </label>
            <div className="flex items-center gap-3">
              <input type="checkbox" disabled className="w-4 h-4 rounded border-white/10 bg-[var(--color-surface)] text-[#2563EB] focus:ring-0" />
              <span className="text-sm text-slate-300">Ativar processamento automático para este módulo</span>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-white/10 flex justify-end">
          <Button disabled title="Em breve: esta configuração ainda não pode ser salva" className="px-6 py-2 bg-[#2563EB] hover:bg-blue-600 rounded-lg font-bold shadow-lg shadow-blue-500/20 gap-2">
            <Save className="w-4 h-4" /> Salvar (em breve)
          </Button>
        </div>
      </Card>
      
      {/* Skeleton list block */}
      <Card className="p-6 bg-[var(--color-surface-elevated)]/80 backdrop-blur-xl border border-white/10">
         <h4 className="text-sm font-bold text-white mb-4">Registros Adicionados</h4>
         <div className="space-y-3">
            {[].map((i: any) => (
              <div key={i} className="p-4 rounded-xl border border-white/5 bg-white/5 flex items-center justify-between">
                 <div>
                   <div className="font-semibold text-sm text-white">Item de Configuração {i}</div>
                   <div className="text-xs text-slate-400 mt-1">Atualizado há 2 dias</div>
                 </div>
                 <button className="text-xs font-bold text-slate-500 hover:text-[#2563EB]">Editar</button>
              </div>
            ))}
         </div>
      </Card>
    </div>
  );
}
