import { useState } from "react";
import { Bot, Power, ShieldAlert, RefreshCw, Radar as RadarIcon, FileText, Save, ChevronDown, ChevronUp } from "lucide-react";
import { Card } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { useTenantAiConfig } from "../../../hooks/useTenantAiConfig";
import { useAgentPrompts, AgentPrompt } from "../../../hooks/useAgentPrompts";
import { useAuth } from "../../../contexts/AuthContext";

const EXECUTE_MODULES: { key: string; label: string; description: string }[] = [
  { key: "radar", label: "Radar (prospecção ativa)", description: "Aurora pode buscar empresas reais (Google Maps) e propor cadastro como lead." },
  { key: "sdr", label: "Júlia / SDR", description: "Aurora pode acionar a Júlia para abordar um lead pelo WhatsApp." },
  { key: "closer", label: "Closer AI", description: "Aurora pode consultar técnicas de negociação/fechamento." },
];

/**
 * Configuracoes → Inteligencia Artificial → Aurora — Fase 5.1 do mandato "Aurora + S.P.Y. +
 * Integracao com Sistemas Externos" (2026-09-18). Le/escreve `tenant_ai_config` via
 * useTenantAiConfig. Aurora (n8n) consulta esta mesma tabela ao vivo, sem nada hardcoded
 * no prompt — desligar aqui reflete na proxima mensagem da Aurora para este tenant.
 *
 * O botão "Ver prompt" em cada card abre/fecha o texto do prompt daquele agente (ver
 * useAgentPrompts) — mesmo padrão "default + override" por tenant, disponível pra
 * qualquer tenant admin (não só master), igual em todo tenant, sem exceção.
 *
 * Dois mecanismos complementares de prompt, não redundantes: `ai_agent_prompts` é o texto
 * BASE de cada agente (Aurora/Radar/Júlia-SDR/Closer); `tenant_ai_config.custom_prompt`
 * (card "Instruções específicas deste tenant") é um contexto de negócio ANEXADO por cima,
 * um por tenant, sem variante padrão/override — já é isolado por tenant desde a origem.
 * Ambos já são lidos ao vivo pelo n8n (Helper - Checar Config Aurora Tenant + AURORA CORE),
 * cada um isolado por tenant/execução — salvar aqui já reflete na Aurora, sem passo manual.
 *
 * Importante (honestidade, nao fachada): so `auroraEnabled` e os 3 toggles de execucao abaixo
 * sao de fato enforcados hoje do lado do n8n. Permissao granular de leitura/escrita por
 * ferramenta ainda nao existe — fica para uma fase futura, e essa tela nao finge que existe.
 */
export function ConfigInteligenciaArtificialAurora() {
  const { config, loading, saving, update } = useTenantAiConfig();
  const { activeTenantName } = useAuth();
  const { prompts, loading: promptsLoading, savingKey: promptSavingKey, updatePrompt } = useAgentPrompts();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [customPromptDraft, setCustomPromptDraft] = useState<string | null>(null);
  const [savingCustomPrompt, setSavingCustomPrompt] = useState(false);

  const handleSaveCustomPrompt = async () => {
    if (customPromptDraft === null) return;
    setSavingCustomPrompt(true);
    await update({ customPrompt: customPromptDraft });
    setSavingCustomPrompt(false);
  };

  const handleToggleAurora = async () => {
    if (!config) return;
    setPendingKey("aurora_enabled");
    await update({ auroraEnabled: !config.auroraEnabled });
    setPendingKey(null);
  };

  const handleToggleExecuteModule = async (moduleKey: string) => {
    if (!config) return;
    setPendingKey(moduleKey);
    const current = config.allowedExecuteModules;
    const next = current.includes(moduleKey)
      ? current.filter((k) => k !== moduleKey)
      : [...current, moduleKey];
    await update({ allowedExecuteModules: next });
    setPendingKey(null);
  };

  // Convencao da tabela: array vazio = tudo liberado (nenhuma restricao adicional).
  const executeRestricted = (config?.allowedExecuteModules.length ?? 0) > 0;
  const promptByKey = new Map(prompts.map((p) => [p.agentKey, p]));

  return (
    <div className="max-w-3xl space-y-6 animate-in fade-in duration-300 pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          Aurora <Bot className="w-5 h-5 text-violet-400" />
        </h1>
        <p className="text-sm text-slate-400">
          Controle da IA da Aurora para {activeTenantName ?? "sua empresa"} — o que ela pode fazer, ativado em tempo real (sem precisar mudar nenhum prompt).
        </p>
      </div>

      {loading || !config ? (
        <p className="text-xs text-slate-500">Carregando configuração...</p>
      ) : (
        <>
          <Card className="p-6 bg-[var(--color-surface-elevated)]/80 border border-white/10 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <Power className={`w-5 h-5 mt-0.5 ${config.auroraEnabled ? "text-emerald-400" : "text-rose-400"}`} />
                <div>
                  <h3 className="font-bold text-sm">Aurora ativada</h3>
                  <p className="text-xs text-slate-400 leading-relaxed max-w-md">
                    Desativar aqui faz a Aurora recusar educadamente qualquer mensagem desta empresa (chat pessoal e WhatsApp da equipe) até reativar.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <ViewPromptButton agentKey="aurora" expandedKey={expandedKey} setExpandedKey={setExpandedKey} />
                <Button
                  type="button"
                  onClick={handleToggleAurora}
                  disabled={saving && pendingKey === "aurora_enabled"}
                  className={`font-bold text-xs px-4 py-2 rounded-xl ${
                    config.auroraEnabled
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25"
                      : "bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25"
                  }`}
                >
                  {saving && pendingKey === "aurora_enabled" ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : config.auroraEnabled ? (
                    "Ativada"
                  ) : (
                    "Desativada"
                  )}
                </Button>
              </div>
            </div>
            {expandedKey === "aurora" && (
              <InlinePromptEditor
                agentKey="aurora"
                agent={promptByKey.get("aurora")}
                loading={promptsLoading}
                saving={promptSavingKey === "aurora"}
                onSave={(text, name, description) => updatePrompt("aurora", text, name, description)}
              />
            )}
          </Card>

          <Card className="p-6 bg-[var(--color-surface-elevated)]/80 border border-white/10 space-y-3">
            <div>
              <h3 className="font-bold text-xs uppercase tracking-widest text-violet-400 flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" />
                <span>Instruções específicas deste tenant</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Contexto de negócio anexado ao prompt da Aurora só para {activeTenantName ?? "esta empresa"} (ex.: termos,
                produtos, tom de voz específicos). Buscado direto pelo tenant a cada execução no n8n — nunca compartilhado
                com outros tenants.
              </p>
            </div>
            <textarea
              value={customPromptDraft ?? config.customPrompt}
              onChange={(e) => setCustomPromptDraft(e.target.value)}
              placeholder="Ex.: Somos uma boliche/lazer familiar, sempre trate reservas como 'partidas', evite jargão técnico..."
              rows={5}
              className="w-full text-xs font-mono bg-black/20 border border-white/10 rounded-lg p-3 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500/50 resize-y"
            />
            <div className="flex items-center justify-between">
              {config.updatedAt ? (
                <p className="text-[10px] text-slate-600">
                  Última atualização: {new Date(config.updatedAt).toLocaleString("pt-BR")}
                </p>
              ) : <span />}
              <Button
                type="button"
                onClick={handleSaveCustomPrompt}
                disabled={savingCustomPrompt || customPromptDraft === null || customPromptDraft === config.customPrompt}
                className={`flex items-center gap-1.5 text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg ${
                  customPromptDraft !== null && customPromptDraft !== config.customPrompt
                    ? "bg-violet-500/15 text-violet-300 border border-violet-500/30 hover:bg-violet-500/25"
                    : "bg-white/5 text-slate-600 border border-white/10"
                }`}
              >
                {savingCustomPrompt ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                {savingCustomPrompt ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </Card>

          <Card className="p-6 bg-[var(--color-surface-elevated)]/80 border border-white/10 space-y-4">
            <h3 className="font-bold text-xs uppercase tracking-widest text-violet-400 flex items-center gap-2">
              <RadarIcon className="w-3.5 h-3.5" />
              <span>Agentes que a Aurora pode acionar</span>
            </h3>
            <p className="text-xs text-slate-500 -mt-2">
              Além do módulo estar contratado, a Aurora só aciona um agente abaixo se ele estiver marcado aqui. Nenhum marcado = sem restrição extra (segue só o módulo contratado).
            </p>
            <div className="space-y-2">
              {EXECUTE_MODULES.map((mod) => {
                const active = !executeRestricted || config.allowedExecuteModules.includes(mod.key);
                return (
                  <div key={mod.key} className="bg-[var(--color-surface)] border border-white/5 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between gap-3 p-3">
                      <div>
                        <p className="text-sm font-bold text-white">{mod.label}</p>
                        <p className="text-xs text-slate-500">{mod.description}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <ViewPromptButton agentKey={mod.key} expandedKey={expandedKey} setExpandedKey={setExpandedKey} />
                        <Button
                          type="button"
                          onClick={() => handleToggleExecuteModule(mod.key)}
                          disabled={saving && pendingKey === mod.key}
                          className={`text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg ${
                            active
                              ? "bg-violet-500/15 text-violet-300 border border-violet-500/30"
                              : "bg-white/5 text-slate-500 border border-white/10"
                          }`}
                        >
                          {saving && pendingKey === mod.key ? <RefreshCw className="w-3 h-3 animate-spin" /> : active ? "Liberado" : "Bloqueado"}
                        </Button>
                      </div>
                    </div>
                    {expandedKey === mod.key && (
                      <div className="px-3 pb-3">
                        <InlinePromptEditor
                          agentKey={mod.key}
                          agent={promptByKey.get(mod.key)}
                          loading={promptsLoading}
                          saving={promptSavingKey === mod.key}
                          onSave={(text, name, description) => updatePrompt(mod.key, text, name, description)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-5 bg-amber-500/5 border border-amber-500/20 space-y-2">
            <h3 className="font-bold text-xs text-amber-400 flex items-center gap-2">
              <ShieldAlert className="w-3.5 h-3.5" /> Ainda não existe nesta tela
            </h3>
            <p className="text-xs text-amber-200/70 leading-relaxed">
              Permissão granular de leitura/escrita por ferramenta (ex: "Aurora pode ler leads mas não criar"),
              conexão com sistemas externos do cliente e integrações/APIs de terceiros fazem parte de fases
              futuras do projeto de integração — ainda não estão implementadas, e esta tela não finge que estão.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}

function ViewPromptButton({
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
      className="flex items-center gap-1.5 text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10"
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
function InlinePromptEditor({
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
              ? "bg-violet-500/15 text-violet-300 border border-violet-500/30"
              : "bg-white/5 text-slate-500 border border-white/10"
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
              ? "bg-violet-500/15 text-violet-300 border border-violet-500/30 hover:bg-violet-500/25"
              : "bg-white/5 text-slate-600 border border-white/10"
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
