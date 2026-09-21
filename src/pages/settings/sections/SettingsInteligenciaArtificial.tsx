import { useState } from "react";
import { Bot, Power, ShieldAlert, RefreshCw, Radar as RadarIcon, FileText, Save, Lock } from "lucide-react";
import { Card } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { useTenantAiConfig } from "../../../hooks/useTenantAiConfig";
import { useAgentPrompts } from "../../../hooks/useAgentPrompts";
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
 * Importante (honestidade, nao fachada): so `auroraEnabled` e os 3 toggles de execucao abaixo
 * sao de fato enforcados hoje do lado do n8n. Permissao granular de leitura/escrita por
 * ferramenta ainda nao existe — fica para uma fase futura, e essa tela nao finge que existe.
 */
export function ConfigInteligenciaArtificialAurora() {
  const { config, loading, saving, update } = useTenantAiConfig();
  const { activeTenantName, user } = useAuth();
  const [pendingKey, setPendingKey] = useState<string | null>(null);

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
              <Button
                type="button"
                onClick={handleToggleAurora}
                disabled={saving && pendingKey === "aurora_enabled"}
                className={`shrink-0 font-bold text-xs px-4 py-2 rounded-xl ${
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
                  <div
                    key={mod.key}
                    className="flex items-center justify-between gap-3 p-3 bg-[var(--color-surface)] border border-white/5 rounded-xl"
                  >
                    <div>
                      <p className="text-sm font-bold text-white">{mod.label}</p>
                      <p className="text-xs text-slate-500">{mod.description}</p>
                    </div>
                    <Button
                      type="button"
                      onClick={() => handleToggleExecuteModule(mod.key)}
                      disabled={saving && pendingKey === mod.key}
                      className={`shrink-0 text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg ${
                        active
                          ? "bg-violet-500/15 text-violet-300 border border-violet-500/30"
                          : "bg-white/5 text-slate-500 border border-white/10"
                      }`}
                    >
                      {saving && pendingKey === mod.key ? <RefreshCw className="w-3 h-3 animate-spin" /> : active ? "Liberado" : "Bloqueado"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </Card>

          {user?.isMaster ? (
            <AgentPromptsSection />
          ) : (
            <Card className="p-5 bg-white/5 border border-white/10 space-y-2">
              <h3 className="font-bold text-xs text-slate-300 flex items-center gap-2">
                <Lock className="w-3.5 h-3.5" /> Prompts dos agentes — acesso restrito
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                O texto que rege o comportamento da Aurora e dos agentes é compartilhado entre todas as empresas da
                plataforma, por isso só a administração master pode visualizar ou editar.
              </p>
            </Card>
          )}

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

/**
 * Prompts dos agentes (Aurora core + Radar/Júlia-SDR/Closer AI) — texto lido/escrito em
 * `ai_agent_prompts`, master-only (ver useAgentPrompts). Depois de salvar aqui, o node
 * correspondente no n8n ainda precisa ser apontado pra ler daqui — isso não acontece
 * sozinho, é dito explicitamente no aviso abaixo, mesma honestidade do resto da tela.
 */
function AgentPromptsSection() {
  const { prompts, loading, savingKey, updatePrompt } = useAgentPrompts();

  return (
    <Card className="p-6 bg-[var(--color-surface-elevated)]/80 border border-white/10 space-y-4">
      <div>
        <h3 className="font-bold text-xs uppercase tracking-widest text-violet-400 flex items-center gap-2">
          <FileText className="w-3.5 h-3.5" />
          <span>Prompts dos agentes</span>
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Texto que rege o comportamento de cada agente. Editar aqui salva no S.P.Y., mas o workflow no n8n
          ainda precisa ser atualizado manualmente pra ler o prompt daqui em vez do texto fixo no nó — essa
          ponte automática ainda não existe.
        </p>
      </div>

      {loading ? (
        <p className="text-xs text-slate-500">Carregando prompts...</p>
      ) : (
        <div className="space-y-4">
          {prompts.map((agent) => (
            <AgentPromptEditor
              key={agent.agentKey}
              agent={agent}
              saving={savingKey === agent.agentKey}
              onSave={(text) => updatePrompt(agent.agentKey, text)}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function AgentPromptEditor({
  agent,
  saving,
  onSave,
}: {
  agent: { agentKey: string; name: string; description: string | null; prompt: string; updatedAt: string | null };
  saving: boolean;
  onSave: (text: string) => void;
}) {
  const [value, setValue] = useState(agent.prompt);
  const dirty = value !== agent.prompt;

  return (
    <div className="p-3 bg-[var(--color-surface)] border border-white/5 rounded-xl space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-white">{agent.name}</p>
          {agent.description && <p className="text-xs text-slate-500">{agent.description}</p>}
        </div>
        <Button
          type="button"
          onClick={() => onSave(value)}
          disabled={!dirty || saving}
          className={`shrink-0 flex items-center gap-1.5 text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg ${
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
      {agent.updatedAt && (
        <p className="text-[10px] text-slate-600">
          Última atualização: {new Date(agent.updatedAt).toLocaleString("pt-BR")}
        </p>
      )}
    </div>
  );
}
