import { toast } from "sonner";

export function formatLeadValueBRL(value: unknown, formatCurrency?: (v: number) => string) {
  const cleaned = String(value ?? "0").replace(/[^\d,.]/g, "");
  // pt-BR: dots = thousands separator, comma = decimal → remove dots first, then swap comma
  const normalized = cleaned.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(normalized) || 0;
  if (formatCurrency) return formatCurrency(num);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
}

export function safeParseTimeIdle(timeIdle: unknown) {
  return typeof timeIdle === "number" ? timeIdle : parseInt(String(timeIdle)) || 0;
}

export function safeParseProbability(probability: unknown) {
  return Math.round(Number(probability) || 0);
}

export function createAlterationLog(params: {
  author: string;
  desc: string;
  time?: string;
}) {
  return {
    id: Date.now().toString(),
    author: params.author,
    desc: params.desc,
    time: params.time ?? "Agora",
  };
}

export function handleMarkLead(params: {
  updateLead: (leadId: string, payload: any) => void;
  leadId: string;
  seller: string;
  setAlterationLogs: (updater: (prev: any[]) => any[]) => void;
  toastSuccess: string;
  toastWarning?: string;
  status: "Fechado" | "Perdido" | string;
  stageId?: string;
  desc: string;
  kind: "success" | "warning";
}) {
  params.updateLead(params.leadId, {
    ...(params.stageId ? { stageId: params.stageId } : {}),
    status: params.status,
  });

  if (params.kind === "success") toast.success(params.toastSuccess);
  if (params.kind === "warning") toast.warning(params.toastWarning ?? params.toastSuccess);

  params.setAlterationLogs((prev: any[]) => [
    {
      id: Date.now().toString(),
      author: params.seller || "Sistema",
      desc: params.desc,
      time: "Agora",
    },
    ...prev,
  ]);
}


/** Estimativa a partir dos produtos de interesse: só vale enquanto o lead não tem valor real
 * (lead.value zerado) nem proposta — depois disso o valor da proposta manda. */
export function leadInterestEstimate(lead: any, proposals: any[], products: any[]): number {
  if (!lead) return 0;
  const raw = Number(String(lead.value ?? "0").replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".")) || 0;
  if (raw > 0) return 0;
  if ((proposals || []).some((p: any) => p.lead_id === lead.id)) return 0;
  const ids: string[] = Array.isArray(lead.customFields?.produtosInteresseIds) ? lead.customFields.produtosInteresseIds : [];
  return ids.reduce((sum, id) => sum + (Number((products || []).find((p: any) => p.id === id)?.price) || 0), 0);
}
