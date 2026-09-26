import { useState } from "react";
import { Globe, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../../components/ui/button";
import { apiFetch } from "../../../lib/apiClient";

const MAX_ROUNDS = 40;

/**
 * "Pesquisar na internet": para os itens que continuam NÃO IDENTIFICADOS, a Aurora pesquisa na web o nome
 * oficial e os sinônimos do exame; o sistema compara com a base do cliente. O resultado só entra como
 * sugestão para REVISÃO (com as fontes), nunca como correspondência automática.
 * A busca roda no servidor/n8n em lotes pequenos — aqui só repetimos a chamada até acabar.
 */
export function ComparacaoPesquisaExterna({ comparacaoId, tenantId, pendentes }: { comparacaoId: string; tenantId: string; pendentes: number }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string>("");

  if (pendentes <= 0) return null;

  const pesquisar = async () => {
    setBusy(true);
    let sugeridos = 0, semCorrespondencia = 0, falhas = 0, analisados = 0;
    try {
      for (let round = 1; round <= MAX_ROUNDS; round++) {
        setProgress(round === 1 ? "Pesquisando…" : `Pesquisando… ${analisados} analisados`);
        const res = await apiFetch(`/api/health/table-comparison/${comparacaoId}/external-research?tenantId=${encodeURIComponent(tenantId)}&limite=10`, { method: "POST" });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error || "Falha na pesquisa externa.");
        sugeridos += body.sugeridos || 0; semCorrespondencia += body.sem_correspondencia || 0; falhas += body.falhas || 0; analisados += body.analisados || 0;
        if (!body.analisados || !body.restantes) break;
      }
      toast.success(
        analisados === 0 && falhas === 0
          ? "Nenhum item pendente para pesquisar."
          : `Pesquisa na internet: ${sugeridos} sugestão(ões) para revisar, ${semCorrespondencia} sem correspondência na sua base${falhas ? `, ${falhas} falharam (tente de novo)` : ""}.`,
        { duration: 9000 },
      );
      if (analisados > 0) setTimeout(() => window.location.reload(), 1200);
    } catch (e: any) {
      toast.error(e?.message || "Falha na pesquisa externa.");
      if (analisados > 0) setTimeout(() => window.location.reload(), 2500);
    } finally {
      setBusy(false);
      setProgress("");
    }
  };

  return (
    <Button
      variant="outline"
      onClick={pesquisar}
      disabled={busy}
      className="h-9 px-3 text-xs font-medium gap-1.5"
      title="A Aurora pesquisa na internet o nome oficial dos exames não identificados. O resultado vai para a fila de revisão, com as fontes."
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />} {busy ? progress || "Pesquisando…" : "Pesquisar na internet"}
    </Button>
  );
}
