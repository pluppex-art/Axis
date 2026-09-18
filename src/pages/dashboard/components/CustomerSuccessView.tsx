import { motion } from 'motion/react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { AlertCircle, ShieldAlert, HeartHandshake, CheckCircle2 } from 'lucide-react';
import { useData } from '../../../contexts/DataContext';
import { toast } from 'sonner';
import { useLocalization } from '../../../contexts/LocalizationContext';
import { parseCurrencyBR as toNumberMRR } from '../../../lib/utils';

export function CustomerSuccessView() {
  const { contracts, addTask } = useData();
  const { formatCurrency } = useLocalization();

  const ativos = contracts.filter(c => c.status === 'Ativo');
  const emRisco = contracts.filter(c => c.status === 'Inadimplente');
  const mrrAtivo = ativos.reduce((s, c: any) => s + toNumberMRR(c.mrr), 0);
  const mrrEmRisco = emRisco.reduce((s, c: any) => s + toNumberMRR(c.mrr), 0);
  const taxaRisco = contracts.length > 0 ? (emRisco.length / contracts.length) * 100 : 0;

  const handleAbrirProtocolo = (contractClient: string) => {
    addTask({
      title: `Protocolo CS — ${contractClient}`,
      description: 'Tipo: Sucesso do Cliente · Tags: CS, Inadimplência',
      status: 'Em Aberto',
      priority: 'Alta',
    });
  };

  return (
    <motion.div
      key="sucesso"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="grid lg:grid-cols-3 gap-6 text-left"
    >
      <Card className="p-6 bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] relative overflow-hidden shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-rose-500/10 text-rose-500 rounded-xl">
                <AlertCircle className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-black text-[var(--color-text-primary)] uppercase tracking-wider">
                Contratos Inadimplentes
              </h4>
            </div>
            {emRisco.length > 0 && (
              <Badge variant="destructive" dot dotPulse>
                {emRisco.length}
              </Badge>
            )}
          </div>

          {emRisco.length === 0 ? (
            <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-[var(--radius-control)] flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <p className="text-xs text-[var(--color-text-muted)]">Nenhum contrato inadimplente no momento.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
              {emRisco.map((c: any) => (
                <div key={c.id} className="p-3 bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] rounded-[var(--radius-control)]">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-[var(--color-text-primary)] truncate">{c.client}</span>
                    <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 px-2 py-0.5 bg-rose-500/10 rounded-full shrink-0">
                      {formatCurrency(toNumberMRR(c.mrr))}/mês
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-[11px] font-bold gap-1.5 h-8"
                    onClick={() => {
                      handleAbrirProtocolo(c.client);
                      toast.success(`Tarefa de CS criada para ${c.client}.`);
                    }}
                  >
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-500" /> Abrir Protocolo CS
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card className="lg:col-span-2 p-6 bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] shadow-sm space-y-6">
        <div>
          <h3 className="text-sm font-black text-[var(--color-text-primary)] uppercase tracking-wider flex items-center gap-2.5">
            <HeartHandshake className="w-4 h-4 text-emerald-500" /> Carteira de Contratos
          </h3>
          <p className="text-xs text-[var(--color-text-muted)] mt-1 font-medium">
            Estado atual da base de contratos recorrentes.
          </p>
        </div>

        {contracts.length === 0 ? (
          <div className="h-[160px] flex items-center justify-center text-xs text-[var(--color-text-muted)]">
            Nenhum contrato cadastrado ainda.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-[var(--color-surface-sunken)] rounded-[var(--radius-control)] border border-[var(--color-border-subtle)]">
              <span className="text-[10px] text-[var(--color-text-faint)] font-bold uppercase tracking-wider block mb-1">
                MRR Ativo
              </span>
              <span className="text-2xl font-black text-[var(--color-text-primary)] font-mono">{formatCurrency(mrrAtivo)}</span>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1">{ativos.length} contrato(s) ativo(s)</p>
            </div>

            <div className="p-4 bg-[var(--color-surface-sunken)] rounded-[var(--radius-control)] border border-[var(--color-border-subtle)]">
              <span className="text-[10px] text-[var(--color-text-faint)] font-bold uppercase tracking-wider block mb-1">
                MRR em Risco (Inadimplente)
              </span>
              <span className="text-2xl font-black text-rose-500 font-mono">{formatCurrency(mrrEmRisco)}</span>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1">{emRisco.length} contrato(s)</p>
            </div>

            <div className="p-4 bg-[var(--color-surface-sunken)] rounded-[var(--radius-control)] border border-[var(--color-border-subtle)]">
              <span className="text-[10px] text-[var(--color-text-faint)] font-bold uppercase tracking-wider block mb-1">
                Taxa de Inadimplência
              </span>
              <span className="text-2xl font-black text-[var(--color-text-primary)] font-mono">{taxaRisco.toFixed(1)}%</span>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1">sobre {contracts.length} contrato(s) no total</p>
            </div>
          </div>
        )}
      </Card>
    </motion.div>
  );
}
