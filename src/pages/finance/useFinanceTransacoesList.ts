import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";

const PAGE_SIZE = 50;

/**
 * Paginação real (server-side) pro extrato consolidado
 * (`src/pages/finance/FinanceiroTransacoes.tsx`, só-leitura). Mesmo padrão
 * de `useFinanceEntriesList.ts`, mas mais simples: sem statusFilter/
 * categoria/conta/centro de custo, cobre os dois tipos (Pagar+Receber)
 * juntos. Ordena por `date_normalized` (coluna gerada — ver
 * supabase/migrations/20260920_finance_entries_date_normalized.sql).
 */
export function useFinanceTransacoesList(params: { search: string; tipoFilter: "Todos" | "Entradas" | "Saídas" }) {
  const { activeTenantId: tenantId, activeFilialId } = useAuth();
  const { search, tipoFilter } = params;

  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [totalEntradas, setTotalEntradas] = useState(0);
  const [totalSaidas, setTotalSaidas] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setPage(0); }, [search, tipoFilter]);

  const requestIdRef = useRef(0);

  const applyFilters = (query: any) => {
    let q = query;
    if (activeFilialId) q = q.or(`filial_id.is.null,filial_id.eq.${activeFilialId}`);
    if (tipoFilter === "Entradas") q = q.eq("type", "Receber");
    else if (tipoFilter === "Saídas") q = q.eq("type", "Pagar");
    if (search.trim()) {
      const term = search.trim().replace(/[%,]/g, "");
      q = q.or(`description.ilike.%${term}%,category.ilike.%${term}%,counterparty.ilike.%${term}%`);
    }
    return q;
  };

  const fetchPage = async () => {
    if (!supabase || !tenantId) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      let query = applyFilters(supabase.from("finance_entries").select("*", { count: "exact" }).eq("tenant_id", tenantId));
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, count, error } = await query
        .order("date_normalized", { ascending: false, nullsFirst: false })
        .range(from, to);

      if (requestId !== requestIdRef.current) return;
      if (!error && data) {
        setRows(data);
        setTotal(count ?? 0);
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  };

  const fetchTotals = async () => {
    if (!supabase || !tenantId) return;
    let query = applyFilters(supabase.from("finance_entries").select("value,type").eq("tenant_id", tenantId));
    const { data } = await query;
    if (data) {
      const entradas = (data as any[]).filter(r => r.type === "Receber").reduce((s, r) => s + (Number(r.value) || 0), 0);
      const saidas = (data as any[]).filter(r => r.type === "Pagar").reduce((s, r) => s + (Number(r.value) || 0), 0);
      setTotalEntradas(entradas);
      setTotalSaidas(saidas);
    }
  };

  useEffect(() => {
    fetchPage();
    fetchTotals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, activeFilialId, search, tipoFilter, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchAllForExport = async (): Promise<any[]> => {
    if (!supabase || !tenantId) return [];
    const { data } = await applyFilters(supabase.from("finance_entries").select("*").eq("tenant_id", tenantId))
      .order("date_normalized", { ascending: false, nullsFirst: false });
    return data || [];
  };

  return {
    entries: rows,
    total,
    totalEntradas,
    totalSaidas,
    page,
    setPage,
    totalPages,
    pageSize: PAGE_SIZE,
    loading,
    fetchAllForExport,
  };
}
