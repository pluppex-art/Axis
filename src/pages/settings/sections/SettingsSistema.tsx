import { useState } from "react";
import {
  ShieldCheck, HardDrive, ExternalLink, RefreshCw, Gauge, Power, ShieldAlert,
  Radar as RadarIcon, FileText, Save,
} from "lucide-react";
import { Card } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { useAuroraTokenUsage } from "../../../hooks/useAuroraTokenUsage";
import { useTenantAiConfig } from "../../../hooks/useTenantAiConfig";
import { useAgentPrompts } from "../../../hooks/useAgentPrompts";
import { useAuth } from "../../../contexts/AuthContext";
import { ConfigSistemaAuroraAgentes } from "./SettingsSistemaAuroraAgentes";
import { ViewPromptButton, InlinePromptEditor } from "./AgentPromptControls";

// Esta tela mostrava um painel inteiro de "backup" que não fazia nada:
// destino de storage (S3/GCS/SFTP), botão "Criar Snapshot Agora" e um card
// com data/tamanho/checksum SHA-512 fixos — nenhum backup nunca foi
// disparado por nenhum desses controles. O armazenamento real deste sistema
// é o Postgres gerenciado pelo Supabase, que já faz backup automático (e
// Point-in-Time Recovery nos planos pagos) na infraestrutura deles — não faz
// sentido fingir um sistema de backup próprio por cima disso. Esta versão
// só descreve a realidade e aponta pra onde o backup de fato é gerenciado.
export function ConfigSistemaBackups() {
  return (
    <div className="max-w-4xl space-y-6 animate-in fade-in duration-300 pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)] flex items-center gap-2">
          Backups & Segurança do Banco de Dados <ShieldCheck className="w-5 h-5 text-[var(--color-primary-blue)]" />
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          O banco de dados deste sistema roda no Supabase, que gerencia backup e recuperação na própria infraestrutura.
        </p>
      </div>

      <Card className="p-6 bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] space-y-4 shadow-sm">
        <h3 className="font-bold text-sm text-[var(--color-text-primary)] flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-emerald-500" /> Onde o backup é gerenciado
        </h3>
        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
          O Supabase realiza backups automáticos do banco de dados de acordo com o plano contratado do projeto
          (backups diários e, em planos superiores, Point-in-Time Recovery). Este painel do S.P.Y. CRM não controla
          nem substitui isso — a configuração e restauração de backups fica no painel do próprio Supabase.
        </p>
        <a
          href="https://supabase.com/docs/guides/platform/backups"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-primary-blue)] hover:underline"
        >
          Ver documentação de backups do Supabase <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </Card>
    </div>
  );
}

function daysLeftInCycle(): number {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return lastDay - now.getDate();
}

function formatFull(n: number): string {
  return n.toLocaleString("pt-BR");
}

// Todo plano vende um pacote fixo de 10 mil créditos por ciclo — o número de
// tokens por trás (tenant_token_limits.monthly_limit) varia por plano, mas o
// cliente nunca vê "tokens" na tela, só créditos. Os créditos são sempre
// proporcionais ao % de consumo real (mesma base que já trava a Aurora no
// backend), então não existe conversão fixa tokens→créditos por plano: é
// sempre "% consumido do ciclo" aplicado sobre os 10 mil créditos do pacote.
const CREDITS_PER_CYCLE = 10000;

const EXECUTE_MODULES: { key: string; label: string; description: string }[] = [
  { key: "radar", label: "Radar (prospecção ativa)", description: "Aurora pode buscar empresas reais (Google Maps) e propor cadastro como lead." },
  { key: "sdr", label: "Júlia / SDR", description: "Aurora pode acionar a Júlia para abordar um lead pelo WhatsApp." },
  { key: "closer", label: "Closer AI", description: "Aurora pode consultar técnicas de negociação/fechamento." },
];

/**
 * Configurações → Sistema → Aurora — página única (era duas: "Aurora" em Inteligência
 * Artificial e "Aurora — Consumo & Agentes" em Sistema; unificadas a pedido, já que o
 * conteúdo é o mesmo tema e a divisão só confundia). Reúne: controle liga/desliga +
 * instruções específicas do tenant + prompts base por agente (tenant_ai_config +
 * ai_agent_prompts, ver useTenantAiConfig/useAgentPrompts), consumo de créditos do ciclo
 * (tenant_token_limits/tenant_token_usage_current_month, ver useAuroraTokenUsage) e o
 * catálogo de agentes/personas vinculados à Aurora (aurora_agents, ver
 * SettingsSistemaAuroraAgentes). Acesso: mesmo de antes, só pelo módulo "aurora" contratado
 * (isModuleEnabled em SettingsLayout.tsx) — nenhum gate extra de master/admin, disponível
 * pra qualquer tenant e qualquer usuário dele, igual em todo o sistema.
 *
 * Dois mecanismos complementares de prompt, não redundantes: `ai_agent_prompts` é o texto
 * BASE de cada agente (Aurora/Radar/Júlia-SDR/Closer); `tenant_ai_config.custom_prompt`
 * (card "Instruções específicas deste tenant") é um contexto de negócio ANEXADO por cima,
 * um por tenant, sem variante padrão/override — já é isolado por tenant desde a origem.
 * Ambos já são lidos ao vivo pelo n8n (Helper - Checar Config Aurora Tenant + AURORA CORE),
 * cada um isolado por tenant/execução — salvar aqui já reflete na Aurora, sem passo manual.
 *
 * Importante (honestidade, nao fachada): so `auroraEnabled` e os 3 toggles de execucao
 * abaixo sao de fato enforcados hoje do lado do n8n. Permissao granular de leitura/escrita
 * por ferramenta ainda nao existe — fica para uma fase futura, e essa tela nao finge que
 * existe.
 */
export function ConfigSistemaAuroraUso() {
  const { usage, loading: usageLoading, refresh } = useAuroraTokenUsage();
  const { config, loading: configLoading, saving, update } = useTenantAiConfig();
  const { activeTenantName } = useAuth();
  const { prompts, loading: promptsLoading, savingKey: promptSavingKey, updatePrompt } = useAgentPrompts();
  const [refreshing, setRefreshing] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [customPromptDraft, setCustomPromptDraft] = useState<string | null>(null);
  const [savingCustomPrompt, setSavingCustomPrompt] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

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

  const percent = usage?.percentUsed ?? 0;
  const creditsUsed = Math.round((percent / 100) * CREDITS_PER_CYCLE);
  const creditsLeft = Math.max(0, CREDITS_PER_CYCLE - creditsUsed);
  const barColor = usage?.limitReached ? "bg-rose-500" : percent >= 90 ? "bg-amber-500" : "bg-violet-500";
  const textColor = usage?.limitReached ? "text-rose-400" : percent >= 90 ? "text-amber-400" : "text-violet-400";

  return (
    <div className="max-w-3xl space-y-6 animate-in fade-in duration-300 pb-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Aurora — Controle, Consumo & Agentes</h1>
          <p className="text-sm text-slate-400">
            O que a Aurora pode fazer, seu consumo de IA no ciclo mensal e os agentes vinculados, tudo pra{" "}
            {activeTenantName ?? "sua empresa"}.
          </p>
        </div>
        <Button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          size="sm"
          className="bg-violet-600 hover:bg-violet-500 text-white border border-violet-600 font-bold uppercase tracking-wider shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {configLoading || !config ? (
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
        </>
      )}

      <Card className="p-6 bg-[var(--color-surface-elevated)]/80 border border-white/10 space-y-5">
        <h3 className="font-bold text-xs uppercase tracking-widest text-violet-400 flex items-center gap-2">
          <Gauge className="w-3.5 h-3.5" />
          <span>Consumo do ciclo atual</span>
        </h3>

        {usageLoading ? (
          <p className="text-xs text-slate-500">Carregando consumo...</p>
        ) : !usage || usage.tokensLimit === null ? (
          <p className="text-xs text-slate-500">
            Nenhum limite configurado para este tenant ainda — a Aurora está liberada sem restrição de consumo.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className={`text-3xl font-black tabular-nums ${textColor}`}>{percent.toFixed(1)}%</span>
                <span className="text-xs text-slate-400 tabular-nums">
                  {formatFull(creditsUsed)} / {formatFull(CREDITS_PER_CYCLE)} créditos
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: `${Math.max(1, Math.min(100, percent))}%` }}
                />
              </div>
            </div>

            {usage.limitReached && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                <p className="text-xs text-rose-400 leading-relaxed">
                  Limite atingido — a Aurora está bloqueada até o próximo ciclo ou até um upgrade de plano.
                </p>
              </div>
            )}
            {!usage.limitReached && percent >= 90 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <p className="text-xs text-amber-400 leading-relaxed">
                  Consumo perto do limite deste ciclo — a Aurora bloqueia automaticamente ao atingir 100%.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-[var(--color-surface)] border border-white/5 p-3 rounded-xl space-y-0.5">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Plano</p>
                <p className="font-bold text-white">{usage.planName ?? "—"}</p>
              </div>
              <div className="bg-[var(--color-surface)] border border-white/5 p-3 rounded-xl space-y-0.5">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Restam no mês</p>
                <p className="font-bold text-white">{formatFull(creditsLeft)} créditos</p>
              </div>
              <div className="bg-[var(--color-surface)] border border-white/5 p-3 rounded-xl space-y-0.5">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Renova em</p>
                <p className="font-bold text-white">{daysLeftInCycle()} dias</p>
              </div>
            </div>
          </>
        )}
      </Card>

      <div className="pt-4 border-t border-white/10">
        <ConfigSistemaAuroraAgentes />
      </div>

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
    </div>
  );
}
