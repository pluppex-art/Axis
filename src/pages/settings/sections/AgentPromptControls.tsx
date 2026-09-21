import { useState } from "react";
import { FileText, Save, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "../../../components/ui/button";
import type { AgentPrompt } from "../../../hooks/useAgentPrompts";

// Compartilhado entre a seção de controle da Aurora (radar/sdr/closer/aurora, chaves fixas
// ligadas a workflows reais do n8n) e o catálogo de agentes/personas (chaves derivadas do
// nome, ver promptKeyForAgent em SettingsSistemaAuroraAgentes.tsx) — extraído aqui pra
// evitar import circular entre os dois arquivos que agora usam os dois componentes.

export function ViewPromptButton({
  agentKey,
  expandedKey,
  setExpandedKey,
}: {
  agentKey: string;
  expandedKey: string | null;
  setExpandedKey: (key: string | null) => void;
}) {
  const isOpen = expandedKey === agentKey;
  return (
    <Button
      type="button"
      onClick={() => setExpandedKey(isOpen ? null : agentKey)}
      className="flex items-center gap-1.5 text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg bg-white/10 text-slate-200 border border-white/20 hover:bg-white/15"
    >
      <FileText className="w-3 h-3" />
      Ver prompt
      {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
    </Button>
  );
}

/**
 * Prompt de um agente, aberto inline dentro do card de toggle correspondente. Le/escreve
 * `ai_agent_prompts` (ver useAgentPrompts) — padrão "default + override": existe um texto
 * padrão global (mantido por master) e cada tenant pode salvar sua PRÓPRIA versão, que só
 * afeta esse tenant — editar aqui nunca muda o que os outros tenants veem. Disponível pra
 * qualquer tenant admin, não só master — mesma tela, mesmo acesso em todo tenant.
 *
 * O n8n (Helper - Checar Config Aurora Tenant + AURORA CORE) já lê esse valor ao vivo por
 * tenant — salvar aqui reflete na próxima mensagem da Aurora, sem precisar tocar em nada
 * no n8n.
 */
export function InlinePromptEditor({
  agentKey,
  agent,
  loading,
  saving,
  onSave,
}: {
  agentKey: string;
  agent: AgentPrompt | undefined;
  loading: boolean;
  saving: boolean;
  onSave: (text: string, name: string, description: string | null) => void;
}) {
  const [value, setValue] = useState(agent?.prompt ?? "");
  const [loadedFor, setLoadedFor] = useState<string | null>(agent ? agentKey : null);

  // Só inicializa o textarea quando o prompt desse agente chega pela primeira vez — evita
  // sobrescrever o que o usuário já está digitando caso o hook recarregue no meio da edição.
  if (agent && loadedFor !== agentKey) {
    setValue(agent.prompt);
    setLoadedFor(agentKey);
  }

  if (loading || !agent) {
    return <p className="text-xs text-slate-500 pt-2">Carregando prompt...</p>;
  }

  const dirty = value !== agent.prompt;

  return (
    <div className="pt-2 space-y-2 border-t border-white/5 mt-1">
      <div className="flex items-center justify-between gap-3 pt-2">
        <span
          className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${
            agent.isCustomized
              ? "bg-violet-500/25 text-violet-200 border border-violet-500/50"
              : "bg-white/10 text-slate-300 border border-white/20"
          }`}
        >
          {agent.isCustomized ? "Customizado por este tenant" : "Padrão global"}
        </span>
        <Button
          type="button"
          onClick={() => onSave(value, agent.name, agent.description)}
          disabled={!dirty || saving}
          className={`flex items-center gap-1.5 text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg ${
            dirty
              ? "bg-violet-500/25 text-violet-200 border border-violet-500/50 hover:bg-violet-500/35"
              : "bg-white/10 text-slate-400 border border-white/20"
          }`}
        >
          {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Cole aqui o texto atual do prompt (copiado do nó correspondente no n8n)..."
        rows={6}
        className="w-full text-xs font-mono bg-black/20 border border-white/10 rounded-lg p-3 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500/50 resize-y"
      />
      <p className="text-[10px] text-slate-600">
        Salvar aqui cria/atualiza só a versão deste tenant — não muda o padrão nem o que os outros tenants veem.
        O n8n já lê esse prompt ao vivo por tenant, isolado por execução.
        {agent.updatedAt && ` Última atualização: ${new Date(agent.updatedAt).toLocaleString("pt-BR")}.`}
      </p>
    </div>
  );
}
