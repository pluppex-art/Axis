import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
  itemLabel?: string;
}

/**
 * Paginação server-side genérica — usada por qualquer tela que busca uma
 * página por vez direto do Supabase (ver src/pages/crm/useLeadsList.ts como
 * referência de hook). `page` é 0-indexed.
 */
export function Pagination({ page, totalPages, total, pageSize, loading, onPageChange, itemLabel = "item" }: PaginationProps) {
  if (total === 0) return null;

  const from = page * pageSize + 1;
  const to = Math.min(total, from + pageSize - 1);
  const plural = total === 1 ? "" : "s";

  return (
    <div className="flex items-center justify-between gap-3 mt-4 text-xs text-[var(--color-text-muted)]">
      <span>
        {from}–{to} de {total} {itemLabel}{plural}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page === 0 || loading}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </Button>
        <span className="font-bold">Página {page + 1} de {totalPages}</span>
        <Button
          variant="outline"
          size="sm"
          disabled={page + 1 >= totalPages || loading}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
