import { useState } from "react";
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../../components/ui/button";
import { apiFetch } from "../../../lib/apiClient";

type Kind = "xlsx" | "pdf";

/**
 * Baixa o relatório da comparação (Excel completo / PDF). O arquivo é montado no servidor
 * (server/tableComparisonExport.ts); aqui só se autentica a chamada e se dispara o download.
 */
export function ComparacaoExportButtons({ comparacaoId, tenantId }: { comparacaoId: string; tenantId: string }) {
  const [busy, setBusy] = useState<Kind | null>(null);

  const baixar = async (kind: Kind) => {
    setBusy(kind);
    try {
      const res = await apiFetch(`/api/health/table-comparison/${comparacaoId}/export.${kind}?tenantId=${encodeURIComponent(tenantId)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Não foi possível gerar o ${kind === "pdf" ? "PDF" : "Excel"}.`);
      }
      const nome = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") || "")?.[1] || `comparacao.${kind}`;
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = nome;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao gerar o relatório.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => baixar("xlsx")} disabled={busy !== null} className="h-9 px-3 text-xs font-medium gap-1.5" title="Exporta a comparação completa em Excel">
        {busy === "xlsx" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />} Excel
      </Button>
      <Button variant="outline" onClick={() => baixar("pdf")} disabled={busy !== null} className="h-9 px-3 text-xs font-medium gap-1.5" title="Gera o relatório em PDF, pronto para apresentar">
        {busy === "pdf" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />} PDF
      </Button>
    </>
  );
}
