import { useState, useEffect } from "react";
import {
  Bot, Plus, Trash2, Pencil, Sparkles, UserSearch, Eye, Radar,
  Handshake, Briefcase, LineChart, Search, Headset, Wallet, Megaphone, ClipboardList,
} from "lucide-react";
import { Card } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Switch } from "../../../components/ui/switch";
import { Modal } from "../../../components/ui/modal";
import { Input } from "../../../components/ui/input";
import { FormField } from "../../../components/ui/form-field";
import { confirmDialog } from "../../../components/ui/confirm-dialog";
import { toast } from "sonner";
import { useData } from "../../../contexts/DataContext";
import type { AuroraAgent } from "../../../contexts/DataContextTypes";

// Catálogo padrão só exibido em memória enquanto o tenant não salvou nenhum
// agente ainda — mesmo padrão já usado pros funis (FUNIS_DEFAULT em
// funisTypes.ts): nada é gravado sozinho, vira registro real só quando o
// admin editar/salvar algo pela primeira vez. Cobre todas as frentes reais
// do CRM (SDR, inteligência, prospecção, vendas, comercial, atendimento,
// financeiro, marketing, operações, executivo, pesquisa) — são personas de
// negócio, não os nomes técnicos das AURORA_TOOLS (ferramentas internas que
// a Aurora chama por trás; o agente é quem representa isso pro usuário).
const AURORA_AGENTS_DEFAULT: Array<Pick<AuroraAgent, "name" | "role" | "description">> = [
  { name: "Júlia — SDR", role: "SDR", description: "Qualificação e primeiro contato com leads recebidos." },
  { name: "Agente Secreto", role: "Inteligência", description: "Monitoramento e alertas de oportunidades ocultas no pipeline." },
  { name: "Radar de Oportunidades", role: "Prospecção", description: "Identifica leads quentes e sinais de compra em tempo real." },
  { name: "Closer", role: "Vendas", description: "Condução de negociações e fechamento de propostas." },
  { name: "Agente Comercial", role: "Comercial", description: "Suporte geral ao time comercial no dia a dia do CRM." },
  { name: "Diretoria", role: "Executivo", description: "Resumos e recomendações estratégicas para a liderança." },
  { name: "Pesquisa", role: "Pesquisa", description: "Levantamento de dados de mercado e concorrência." },
  { name: "Atendimento", role: "Suporte", description: "Acompanhamento de clientes ativos e chamados de suporte." },
  { name: "Financeiro", role: "Financeiro", description: "Resumos de fluxo de caixa, contas e inadimplência." },
  { name: "Marketing", role: "Marketing", description: "Leitura de campanhas, landing pages e origem dos leads." },
  { name: "Organização", role: "Operações", description: "Tarefas pendentes, agenda e follow-ups do dia a dia." },
];

const ROLE_ICONS: Record<string, typeof Bot> = {
  SDR: UserSearch,
  "Inteligência": Eye,
  "Prospecção": Radar,
  Vendas: Handshake,
  Comercial: Briefcase,
  Executivo: LineChart,
  Pesquisa: Search,
  Suporte: Headset,
  Financeiro: Wallet,
  Marketing: Megaphone,
  "Operações": ClipboardList,
};

function RoleIcon({ role }: { role?: string }) {
  const Icon = (role && ROLE_ICONS[role]) || Bot;
  return <Icon className="w-4 h-4 text-violet-400" />;
}

type EditingState = { id?: string; name: string; role: string; description: string } | null;

export function ConfigSistemaAuroraAgentes() {
  const { auroraAgents, addAuroraAgent, updateAuroraAgent, deleteAuroraAgent, toggleAuroraAgent, ensureNicheModulesLoaded } = useData();
  useEffect(() => { ensureNicheModulesLoaded(); }, [ensureNicheModulesLoaded]);
  const [editing, setEditing] = useState<EditingState>(null);

  const hasCustomAgents = auroraAgents.length > 0;
  const displayList = hasCustomAgents ? auroraAgents : AURORA_AGENTS_DEFAULT.map((a, i) => ({ ...a, id: `default-${i}`, active: true } as AuroraAgent));

  const handleToggle = (agent: AuroraAgent) => {
    if (!hasCustomAgents) {
      // Ainda é só o catálogo padrão em memória — a primeira interação
      // materializa o agente como registro real no tenant.
      addAuroraAgent({ name: agent.name, role: agent.role, description: agent.description, active: false });
      toast.info(`"${agent.name}" desativado. Os demais agentes do catálogo padrão foram salvos como ativos.`);
      AURORA_AGENTS_DEFAULT.filter(a => a.name !== agent.name).forEach(a => {
        addAuroraAgent({ name: a.name, role: a.role, description: a.description, active: true });
      });
      return;
    }
    toggleAuroraAgent(agent.id);
  };

  const handleSave = () => {
    if (!editing?.name.trim()) { toast.error("Nome do agente é obrigatório."); return; }
    if (editing.id) {
      updateAuroraAgent(editing.id, { name: editing.name, role: editing.role, description: editing.description });
      toast.success("Agente atualizado.");
    } else {
      addAuroraAgent({ name: editing.name, role: editing.role, description: editing.description, active: true });
      toast.success("Agente adicionado.");
    }
    setEditing(null);
  };

  const handleDelete = async (agent: AuroraAgent) => {
    if (!(await confirmDialog({
      title: "Remover agente",
      description: `Remover "${agent.name}" da lista de agentes vinculados à Aurora? Essa ação não pode ser desfeita.`,
    }))) return;
    deleteAuroraAgent(agent.id);
    toast.success("Agente removido.");
  };

  const activeCount = displayList.filter((a) => a.active).length;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <Bot className="w-5 h-5 text-violet-400" /> Agentes vinculados à Aurora
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Cada agente pode ser ativado ou desativado — a Aurora não age em nome de um agente inativo quando ele é citado diretamente na conversa.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-bold text-slate-400 bg-white/5 border border-white/10 rounded-full px-3 py-1.5 whitespace-nowrap">
            {activeCount}/{displayList.length} ativos
          </span>
          <Button
            type="button"
            onClick={() => setEditing({ name: "", role: "", description: "" })}
            size="sm"
            className="bg-violet-600 hover:bg-violet-500 text-white border border-violet-600 font-bold uppercase tracking-wider"
          >
            <Plus className="w-3.5 h-3.5" /> Novo Agente
          </Button>
        </div>
      </div>

      {!hasCustomAgents && (
        <div className="p-3 bg-violet-500/10 border border-violet-500/20 rounded-xl flex items-start gap-2">
          <Sparkles className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Nenhum agente foi salvo ainda — mostrando o catálogo padrão. Ative/desative ou edite algum pra começar a personalizar por sua empresa.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {displayList.map((agent) => (
          <Card
            key={agent.id}
            className={`p-4 bg-[var(--color-surface-elevated)]/80 border flex items-start gap-3 transition-colors ${
              agent.active ? "border-white/10" : "border-white/5 opacity-60"
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
              <RoleIcon role={agent.role} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[var(--color-text-primary)] truncate">{agent.name}</p>
                  {agent.role && (
                    <span className="text-[9px] font-black uppercase tracking-widest text-violet-400">
                      {agent.role}
                    </span>
                  )}
                </div>
                <Switch checked={agent.active} onCheckedChange={() => handleToggle(agent)} />
              </div>
              {agent.description && <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{agent.description}</p>}
              {hasCustomAgents && (
                <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-white/5">
                  <button
                    onClick={() => setEditing({ id: agent.id, name: agent.name, role: agent.role || "", description: agent.description || "" })}
                    className="flex items-center gap-1 px-2 py-1 bg-white/5 border border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/10 rounded-lg transition-colors text-[10px] font-bold"
                    title="Editar agente"
                  >
                    <Pencil className="w-3 h-3" /> Editar
                  </button>
                  <button
                    onClick={() => handleDelete(agent)}
                    className="flex items-center gap-1 px-2 py-1 bg-white/5 border border-white/10 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors text-[10px] font-bold"
                    title="Remover agente"
                  >
                    <Trash2 className="w-3 h-3" /> Remover
                  </button>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Modal
        isOpen={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Editar Agente" : "Novo Agente"}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </div>
        }
      >
        {editing && (
          <div className="space-y-4">
            <FormField label="Nome do Agente">
              <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Ex: Closer" />
            </FormField>
            <FormField label="Papel/Função">
              <Input value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value })} placeholder="Ex: Vendas" />
            </FormField>
            <FormField label="Descrição">
              <Input value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="O que esse agente faz" />
            </FormField>
          </div>
        )}
      </Modal>
    </div>
  );
}
