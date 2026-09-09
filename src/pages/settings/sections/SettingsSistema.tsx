import { useState } from "react";
import { ShieldCheck, HardDrive, ExternalLink, RefreshCw, Gauge } from "lucide-react";
import { Card } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { useAuroraTokenUsage } from "../../../hooks/useAuroraTokenUsage";
import { useAuth } from "../../../contexts/AuthContext";

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

function formatTokensFull(n: number): string {
  return n.toLocaleString("pt-BR");
}

/**
 * Uso de tokens da Aurora no ciclo atual, "igual da Claude" (pedido do Gustavo) — lê direto do
 * Supabase (tenant_token_limits + a view tenant_token_usage_current_month), RLS-escopado ao
 * tenant logado, mesmo dado que o gate de bloqueio em AURORA CORE (n8n) usa pra decidir se
 * bloqueia a Aurora neste ciclo. Ver memória gtech_aurora_token_limiter.
 */
export function ConfigSistemaAuroraUso() {
  const { usage, loading, refresh } = useAuroraTokenUsage();
  const { activeTenantName } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const percent = usage?.percentUsed ?? 0;
  const barColor = usage?.limitReached ? "bg-rose-500" : percent >= 90 ? "bg-amber-500" : "bg-violet-500";
  const textColor = usage?.limitReached ? "text-rose-400" : percent >= 90 ? "text-amber-400" : "text-violet-400";

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Uso de Tokens da Aurora</h1>
          <p className="text-sm text-slate-400">
            Consumo de IA de {activeTenantName ?? "sua empresa"} no ciclo mensal atual — mesmo limite que controla o bloqueio automático da Aurora.
          </p>
        </div>
        <Button
          type="button"
          onClick={handleRefresh}
          className="bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 font-bold uppercase text-[10px] py-2 px-3 rounded-xl shrink-0"
        >
          <RefreshCw className={`w-3 h-3 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <Card className="p-6 bg-[var(--color-surface-elevated)]/80 border border-white/10 space-y-5">
        <h3 className="font-bold text-xs uppercase tracking-widest text-violet-400 flex items-center gap-2">
          <Gauge className="w-3.5 h-3.5" />
          <span>Consumo do ciclo atual</span>
        </h3>

        {loading ? (
          <p className="text-xs text-slate-500">Carregando uso de tokens...</p>
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
                  {formatTokensFull(usage.tokensUsed)} / {formatTokensFull(usage.tokensLimit)} tokens
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
                <p className="font-bold text-white">{formatTokensFull(Math.max(0, usage.tokensLimit - usage.tokensUsed))}</p>
              </div>
              <div className="bg-[var(--color-surface)] border border-white/5 p-3 rounded-xl space-y-0.5">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Renova em</p>
                <p className="font-bold text-white">{daysLeftInCycle()} dias</p>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
