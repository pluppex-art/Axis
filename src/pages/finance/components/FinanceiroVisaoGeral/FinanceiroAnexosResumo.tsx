import { Link } from "react-router-dom";
import { Card } from "../../../../components/ui/card";
import { Paperclip } from "lucide-react";

const fmtBytes = (n: number) => n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / (1024 * 1024)).toFixed(2)} MB`;

/** Espaço de anexos (§5, widget 9). Sem cota configurada no sistema ainda,
 * mostra só o uso real — nunca um percentual contra uma cota inventada. */
export function FinanceiroAnexosResumo({ totalArquivos, totalBytes }: { totalArquivos: number; totalBytes: number }) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-[var(--color-text-faint)]" /> Espaço de Anexos
        </h3>
      </div>
      {totalArquivos === 0 ? (
        <p className="text-xs text-[var(--color-text-faint)]">Nenhum arquivo anexado a lançamentos ainda.</p>
      ) : (
        <p className="text-xs text-[var(--color-text-muted)]">
          <span className="font-semibold text-[var(--color-text-primary)]">{fmtBytes(totalBytes)}</span> usados em {totalArquivos} arquivo(s).
        </p>
      )}
      <Link to="/app/financeiro/transacoes" className="text-[11px] text-[var(--color-text-faint)] hover:text-[var(--color-text-primary)] hover:underline mt-2 inline-block">
        Ver lançamentos
      </Link>
    </Card>
  );
}
