import { useState, useEffect } from "react";
import { PageContainer } from "../../components/PageContainer";
import { Button } from "../../components/ui/button";
import {
  Calendar, CheckCircle2, ShieldCheck, Zap,
  Save, RefreshCw, MessageSquare, Video, Clock, XCircle
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import {
  connectGoogleCalendar,
  consumeGoogleCalendarRedirectResult,
  disconnectGoogleCalendar,
  getGoogleCalendarStatus,
  type GoogleCalendarStatus,
} from "../../lib/google-auth";

type AgendaConfig = {
  autoInvite: boolean;
  lembreteWhatsapp: boolean;
  autoMeetLink: boolean;
  permitirRemarcacao: boolean;
  antecedenciaMinimaHoras: string;
};

const DEFAULT_CONFIG: AgendaConfig = {
  autoInvite: true,
  lembreteWhatsapp: true,
  autoMeetLink: true,
  permitirRemarcacao: true,
  antecedenciaMinimaHoras: "2",
};

const SETTING_KEY = "agenda_configuracoes";

export default function AgendaConfiguracoes() {
  const { activeTenantId } = useAuth();
  const { appSettings, appSettingsLoaded, saveAppSetting } = useData();

  const [config, setConfig] = useState<AgendaConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    if (appSettingsLoaded && appSettings?.[SETTING_KEY]) {
      setConfig({ ...DEFAULT_CONFIG, ...appSettings[SETTING_KEY] });
    }
  }, [appSettings, appSettingsLoaded]);

  // Estado real da conexão Google vem sempre do backend (server/googleCalendar.ts)
  // via getGoogleCalendarStatus — nunca é um valor local/otimista, pra não mentir
  // "Conectado" quando o backend não tem token nenhum guardado.
  const [googleStatus, setGoogleStatus] = useState<GoogleCalendarStatus | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const refreshGoogleStatus = () => {
    if (!activeTenantId) return;
    getGoogleCalendarStatus(activeTenantId).then(setGoogleStatus);
  };

  useEffect(() => {
    refreshGoogleStatus();
  }, [activeTenantId]);

  // Depois de voltar do consentimento do Google (redirect real pro backend e de
  // volta), avisa o usuário e recarrega o status.
  useEffect(() => {
    const result = consumeGoogleCalendarRedirectResult();
    if (!result) return;
    if (result.status === "connected") {
      toast.success("Conta Google conectada com sucesso!");
      refreshGoogleStatus();
    } else {
      toast.error("Não foi possível conectar ao Google" + (result.reason ? ` (${result.reason})` : "."));
    }
  }, [activeTenantId]);

  const handleToggle = (key: keyof AgendaConfig) => {
    setConfig(prev => ({
      ...prev,
      [key]: typeof prev[key] === "boolean" ? !prev[key] : prev[key],
    }));
  };

  const handleSave = async () => {
    try {
      await saveAppSetting(SETTING_KEY, config);
      toast.success("Configurações da Agenda salvas com sucesso!");
    } catch (e) {
      toast.error("Erro ao salvar preferências.");
    }
  };

  const handleConnectGoogle = async () => {
    if (!activeTenantId) return;
    setIsConnecting(true);
    try {
      await connectGoogleCalendar(activeTenantId, window.location.pathname);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao conectar ao Google.");
      setIsConnecting(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!activeTenantId) return;
    setIsDisconnecting(true);
    try {
      await disconnectGoogleCalendar(activeTenantId);
      toast.success("Conta Google desconectada.");
      refreshGoogleStatus();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao desconectar a conta Google.");
    } finally {
      setIsDisconnecting(false);
    }
  };

  const isConnected = googleStatus?.connected ?? false;

  return (
    <PageContainer
      title="Configurações da Agenda"
      description="Gerencie a sincronização bidirecional do Google Calendar, geração de salas e alertas aos clientes."
      actions={
        <Button
          onClick={handleSave}
          className="h-9 px-4 text-xs font-bold gap-1.5 shadow-xs bg-[var(--color-primary-blue)] text-white hover:opacity-95"
        >
          <Save className="w-3.5 h-3.5" /> Salvar Preferências
        </Button>
      }
    >
      <div className="max-w-3xl space-y-6">
        {/* Google Calendar */}
        <div className="p-6 bg-[var(--color-surface)] border border-[var(--color-border-default)] rounded-2xl space-y-4 shadow-xs">
          <h4 className="text-xs font-bold text-[var(--color-text-primary)] uppercase tracking-wider flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[var(--color-primary-blue)]" /> Conexão Google Calendar & Meet
          </h4>

          <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            isConnected ? "bg-emerald-500/10 border-emerald-500/25" : "bg-amber-500/10 border-amber-500/25"
          }`}>
            <div className="flex items-center gap-3">
              {isConnected
                ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                : <XCircle className="w-5 h-5 text-amber-500 shrink-0" />}
              <div>
                <p className="text-xs font-bold text-[var(--color-text-primary)]">
                  {isConnected ? "Google Agenda Conectado e Ativo" : "Google Agenda Desconectado"}
                </p>
                <p className="text-[10px] text-[var(--color-text-muted)]">
                  {isConnected
                    ? `Sincronizado com ${googleStatus?.email || "sua conta Google"}. Reuniões criadas geram links do Google Meet automaticamente.`
                    : "Conecte sua conta para habilitar sincronização em tempo real."}
                </p>
              </div>
            </div>
            {isConnected ? (
              <button
                onClick={handleDisconnectGoogle}
                disabled={isDisconnecting}
                className="px-3 py-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border-default)] text-xs font-bold text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)] transition-all shrink-0 flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isDisconnecting ? 'animate-spin text-blue-500' : ''}`} />
                {isDisconnecting ? "Desconectando..." : "Desconectar"}
              </button>
            ) : (
              <button
                onClick={handleConnectGoogle}
                disabled={isConnecting}
                className="px-3 py-1.5 rounded-lg bg-[var(--color-primary-blue)] text-white text-xs font-bold hover:opacity-95 transition-all shrink-0 flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isConnecting ? 'animate-spin' : ''}`} />
                {isConnecting ? "Conectando..." : "Conectar Google Agenda"}
              </button>
            )}
          </div>

          <div className="space-y-3 pt-2">
            <label className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--color-surface-sunken)]/60 border border-[var(--color-border-subtle)] cursor-pointer">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-[var(--color-text-primary)] block">
                  Gerar Sala Google Meet Automaticamente
                </span>
                <span className="text-[10px] text-[var(--color-text-muted)] block">
                  Ao criar uma reunião remota, gera o link único do Google Meet para os participantes.
                </span>
              </div>
              <input
                type="checkbox"
                checked={config.autoMeetLink}
                onChange={() => handleToggle("autoMeetLink")}
                className="w-4 h-4 rounded border-[var(--color-border-default)] text-[var(--color-primary-blue)]"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--color-surface-sunken)]/60 border border-[var(--color-border-subtle)] cursor-pointer">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-[var(--color-text-primary)] block">
                  Envio Automático de Convite por E-mail
                </span>
                <span className="text-[10px] text-[var(--color-text-muted)] block">
                  Dispara convite formal do calendário aos e-mails de todos os participantes convidados.
                </span>
              </div>
              <input
                type="checkbox"
                checked={config.autoInvite}
                onChange={() => handleToggle("autoInvite")}
                className="w-4 h-4 rounded border-[var(--color-border-default)] text-[var(--color-primary-blue)]"
              />
            </label>
          </div>
        </div>

        {/* Lembretes e WhatsApp */}
        <div className="p-6 bg-[var(--color-surface)] border border-[var(--color-border-default)] rounded-2xl space-y-4 shadow-xs">
          <h4 className="text-xs font-bold text-[var(--color-text-primary)] uppercase tracking-wider flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-emerald-500" /> Mensageria & Notificações aos Clientes
          </h4>

          <div className="space-y-3">
            <label className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--color-surface-sunken)]/60 border border-[var(--color-border-subtle)] cursor-pointer">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-[var(--color-text-primary)] block">
                  Disparo de Lembrete via WhatsApp (1h antes)
                </span>
                <span className="text-[10px] text-[var(--color-text-muted)] block">
                  Envia link de acesso à sala e orientações para o WhatsApp do cliente 60 minutos antes.
                </span>
              </div>
              <input
                type="checkbox"
                checked={config.lembreteWhatsapp}
                onChange={() => handleToggle("lembreteWhatsapp")}
                className="w-4 h-4 rounded border-[var(--color-border-default)] text-[var(--color-primary-blue)]"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--color-surface-sunken)]/60 border border-[var(--color-border-subtle)] cursor-pointer">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-[var(--color-text-primary)] block">
                  Permitir Auto-Remarcação pelo Cliente
                </span>
                <span className="text-[10px] text-[var(--color-text-muted)] block">
                  Inclui link seguro no convite para o cliente solicitar novo horário em sua grade livre.
                </span>
              </div>
              <input
                type="checkbox"
                checked={config.permitirRemarcacao}
                onChange={() => handleToggle("permitirRemarcacao")}
                className="w-4 h-4 rounded border-[var(--color-border-default)] text-[var(--color-primary-blue)]"
              />
            </label>

            <div className="p-3.5 rounded-xl bg-[var(--color-surface-sunken)]/60 border border-[var(--color-border-subtle)] flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-[var(--color-text-primary)] block">
                  Antecedência Mínima para Agendamento
                </span>
                <span className="text-[10px] text-[var(--color-text-muted)] block">
                  Tempo mínimo entre o momento do agendamento e o início da reunião.
                </span>
              </div>
              <select
                value={config.antecedenciaMinimaHoras}
                onChange={e => setConfig({ ...config, antecedenciaMinimaHoras: e.target.value })}
                className="bg-[var(--color-surface)] border border-[var(--color-border-default)] rounded-xl px-3 py-1.5 text-xs font-bold text-[var(--color-text-primary)] focus:outline-none"
              >
                <option value="1">1 hora</option>
                <option value="2">2 horas</option>
                <option value="4">4 horas</option>
                <option value="24">24 horas</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
