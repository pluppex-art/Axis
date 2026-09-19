import { Card } from "../card";
import { Badge } from "../badge";
import { EmptyState } from "../empty-state";
import { CalendarClock, Users, LayoutGrid, Clock3 } from "lucide-react";
import { useLocalization } from "../../../contexts/LocalizationContext";

// Cada item vem de customFields.reservationsHistory (montado no server.ts do
// Axis, um por reserva sincronizada do to na pista — dedup por id, últimas 30).
interface ReservaHistorico {
  id: string;
  date?: string;
  time?: string;
  peopleCount?: number;
  laneCount?: number;
  duration?: number;
  totalValue?: number;
  eventType?: string;
  status?: string;
  paymentStatus?: string;
  createdAt?: string;
}

interface ReservasSectionProps {
  lead: any;
}

function statusVariant(status?: string): "secondary" | "info" | "warning" | "success" | "destructive" {
  const s = (status || "").toLowerCase();
  if (s.includes("cancel")) return "destructive";
  if (s.includes("no-show") || s.includes("no show") || s.includes("não compare") || s.includes("nao compare")) return "destructive";
  if (s.includes("check") || s.includes("compare")) return "success";
  if (s.includes("confirmad")) return "info";
  return "secondary";
}

function fmtDate(d?: string) {
  if (!d) return "—";
  const parsed = new Date(`${d}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function ReservasSection({ lead }: ReservasSectionProps) {
  const { formatCurrency } = useLocalization();
  const history: ReservaHistorico[] = Array.isArray(lead?.customFields?.reservationsHistory)
    ? lead.customFields.reservationsHistory
    : [];

  const sorted = [...history].sort((a, b) => {
    const da = a.date || a.createdAt || "";
    const db = b.date || b.createdAt || "";
    return db > da ? 1 : db < da ? -1 : 0;
  });

  if (sorted.length === 0) {
    return (
      <div className="px-5 py-4">
        <EmptyState
          icon={CalendarClock}
          title="Nenhuma reserva no histórico"
          description="Esse lead ainda não tem reservas sincronizadas."
        />
      </div>
    );
  }

  return (
    <div className="px-5 py-4 space-y-3">
      <h4 className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-muted)]">
        {sorted.length} reserva{sorted.length > 1 ? "s" : ""} no histórico
      </h4>

      <div className="space-y-2">
        {sorted.map((r) => (
          <Card key={r.id} className="p-3.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)]">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-blue)]/10 flex items-center justify-center shrink-0">
                  <CalendarClock className="w-4 h-4 text-[var(--color-primary-blue)]" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[var(--color-text-primary)]">
                    {fmtDate(r.date)}{r.time ? ` às ${String(r.time).slice(0, 5)}` : ""}
                  </div>
                  {r.eventType && (
                    <div className="text-[10px] text-[var(--color-text-muted)] italic truncate">{r.eventType}</div>
                  )}
                </div>
              </div>
              <Badge variant={statusVariant(r.status)} className="text-[8px] uppercase shrink-0">
                {r.status || "—"}
              </Badge>
            </div>

            <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-[var(--color-border-subtle)] text-[10px] text-[var(--color-text-muted)]">
              {typeof r.peopleCount === "number" && (
                <span className="flex items-center gap-1"><Users className="w-3 h-3" />{r.peopleCount}</span>
              )}
              {typeof r.laneCount === "number" && (
                <span className="flex items-center gap-1"><LayoutGrid className="w-3 h-3" />{r.laneCount} pista{r.laneCount > 1 ? "s" : ""}</span>
              )}
              {typeof r.duration === "number" && (
                <span className="flex items-center gap-1"><Clock3 className="w-3 h-3" />{r.duration}h</span>
              )}
              <span className="ml-auto font-mono font-bold text-success">
                {typeof r.totalValue === "number" ? formatCurrency(r.totalValue) : "—"}
              </span>
            </div>

            {r.paymentStatus && (
              <div className="mt-1.5 text-[9px] text-[var(--color-text-faint)]">
                Pagamento: {r.paymentStatus}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
