import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../../../../components/ui/button";

interface LeadsPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  loading: boolean;
  onPageChange: (page: number) => void;
}

export function LeadsPagination({ page, totalPages, total, pageSize, loading, onPageChange }: LeadsPaginationProps) {
  if (total === 0) return null;

  const from = page * pageSize + 1;
  const to = Math.min(total, from + pageSize - 1);

  return (
    <div className="flex items-center justify-between gap-3 mt-4 text-xs text-[var(--color-text-muted)]">
      <span>
        {from}–{to} de {total} lead{total === 1 ? "" : "s"}
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
