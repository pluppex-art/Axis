import { Briefcase, Users, Target, Package, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "../button";
import { FormField } from "../form-field";
import { Input } from "../input";

interface QualificationBlockProps {
  teamSize: string;
  setTeamSize: (v: string) => void;
  currentRole: string;
  setCurrentRole: (v: string) => void;
  linkedinLink: string;
  setLinkedinLink: (v: string) => void;
  tags: string;
  setTags: (v: string) => void;
  aiLoading: boolean;
  suggestTags: (e: React.MouseEvent) => void;
  isMaster: boolean;
  selectedTenant: string;
  setSelectedTenant: (v: string) => void;
  allTenantModules: Record<string, any>;
  products: any[];
  selectedProductIds: string[];
  setSelectedProductIds: React.Dispatch<React.SetStateAction<string[]>>;
}

export function QualificationBlock({
  teamSize, setTeamSize, currentRole, setCurrentRole, linkedinLink, setLinkedinLink,
  tags, setTags, aiLoading, suggestTags, isMaster, selectedTenant, setSelectedTenant,
  allTenantModules, products, selectedProductIds, setSelectedProductIds,
}: QualificationBlockProps) {
  const activeProducts = products.filter((p: any) => p.active !== false);

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-black text-[var(--color-text-primary)] border-b border-[var(--color-border-subtle)] pb-2 flex items-center gap-2 uppercase tracking-wider">
        <Briefcase className="w-3.5 h-3.5 text-purple-500" /> Qualificação & Produtos
      </h4>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField label="Porte da Empresa">
          <select
            value={teamSize}
            onChange={(e) => setTeamSize(e.target.value)}
            className="w-full bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] px-3 py-2 text-xs font-bold text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-blue)] h-9"
          >
            <option value="">Indefinido</option>
            <option value="1-10">1 a 10 colaboradores</option>
            <option value="11-50">11 a 50 colaboradores</option>
            <option value="51-200">51 a 200 colaboradores</option>
            <option value="200+">Grande Empresa (+200)</option>
          </select>
        </FormField>

        <div className="md:col-span-2">
          <FormField label="Cargo do Decisor">
            <Input
              name="currentRole"
              type="text"
              value={currentRole}
              onChange={(e) => setCurrentRole(e.target.value)}
              placeholder="Ex: Diretor Comercial, CEO, Gerente de TI"
            />
          </FormField>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Interesse Principal">
          <Input
            name="lead_interesse_cliente"
            type="text"
            placeholder="Ex: Consultoria, Licença Enterprise..."
          />
        </FormField>
        <FormField label="Perfil LinkedIn">
          <Input
            name="linkedinLink"
            type="url"
            value={linkedinLink}
            onChange={(e) => setLinkedinLink(e.target.value)}
            placeholder="https://linkedin.com/in/..."
          />
        </FormField>
      </div>

      {isMaster && (
        <div className="p-3.5 bg-[var(--color-primary-blue)]/5 border border-[var(--color-primary-blue)]/20 rounded-[var(--radius-control)]">
          <FormField label="Distribuição de Tenant (Master)">
            <select
              value={selectedTenant}
              onChange={(e) => setSelectedTenant(e.target.value)}
              className="w-full bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] px-3 py-2 text-xs font-bold text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-blue)] h-9"
            >
              {Object.keys(allTenantModules).map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </FormField>
        </div>
      )}

      {activeProducts.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-[var(--color-border-subtle)]">
          <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-emerald-500" /> Produtos de Interesse
            </span>
            <span className="text-[10px] text-[var(--color-text-faint)] font-normal normal-case">Opcional</span>
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {activeProducts.map((p: any) => {
              const isSelected = selectedProductIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedProductIds(prev => isSelected ? prev.filter(id => id !== p.id) : [...prev, p.id])}
                  className={`p-2.5 rounded-[var(--radius-control)] border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                    isSelected
                      ? "bg-emerald-500/10 border-emerald-500/40 text-[var(--color-text-primary)] font-bold shadow-sm"
                      : "bg-[var(--color-surface-sunken)] border-[var(--color-border-default)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">{p.name}</p>
                    {p.price > 0 && (
                      <p className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                        R$ {Number(p.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                    )}
                  </div>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-2 pt-2 border-t border-[var(--color-border-subtle)]">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
            Notas & Tags do Lead
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={suggestTags}
            disabled={aiLoading}
            className="h-7 text-[10px] gap-1 font-bold"
          >
            <Sparkles className="w-3 h-3 text-purple-500" /> {aiLoading ? "Gerando..." : "Sugerir Tags (IA)"}
          </Button>
        </div>
        <textarea
          name="notes"
          rows={2}
          className="w-full bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] p-3 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-blue)] transition-all resize-none"
          placeholder="Anotações iniciais sobre a oportunidade..."
        />
        <Input
          name="tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          type="text"
          placeholder="Tags separadas por vírgula (ex: inbound, enterprise, urgente)"
        />
      </div>
    </div>
  );
}
