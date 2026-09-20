import { useEffect, useRef, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../contexts/AuthContext";
import { Task } from "../../../types";

const PAGE_SIZE = 50;

/**
 * Paginação real (server-side) só pro modo Lista de Tarefas
 * (`src/pages/operative/Tarefas.tsx`, `TasksListMode`). O modo Kanban
 * continua usando `filteredTasks` de `useTarefas.ts` (array completo do
 * DataContext) porque precisa mostrar todas as colunas/status ao mesmo
 * tempo — pagina por offset não faz sentido pra uma visão agrupada.
 *
 * Busca por título/descrição no servidor (não inclui mais o nome do lead
 * relacionado na busca — isso exigiria um join, fora do escopo desta
 * passagem; o modo Kanban, que continua sem paginação, ainda busca por lead).
 */
export function useTarefasList(params: { searchQuery: string; selectedPriorities: string[]; deadlineFilter: string; active: boolean }) {
  const { activeTenantId: tenantId, activeFilialId } = useAuth();
  const { searchQuery, selectedPriorities, deadlineFilter, active } = params;

  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setPage(0); }, [searchQuery, selectedPriorities.join(","), deadlineFilter]);

  const requestIdRef = useRef(0);

  const fetchPage = async () => {
    if (!supabase || !tenantId || !active) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      let query = supabase.from("tasks").select("*", { count: "exact" }).eq("tenant_id", tenantId);
      if (activeFilialId) query = query.or(`filial_id.is.null,filial_id.eq.${activeFilialId}`);
      if (searchQuery.trim()) {
        const q = searchQuery.trim().replace(/[%,]/g, "");
        query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
      }
      if (selectedPriorities.length > 0) query = query.in("priority", selectedPriorities);
      if (deadlineFilter) query = query.lte("due_date", `${deadlineFilter}T23:59:59`);

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, count, error } = await query.order("created_at", { ascending: false }).range(from, to);

      if (requestId !== requestIdRef.current) return;
      if (!error && data) {
        setRows(data as Task[]);
        setTotal(count ?? 0);
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    fetchPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, activeFilialId, active, page, searchQuery, selectedPriorities.join(","), deadlineFilter]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return {
    tasks: rows,
    total,
    page,
    setPage,
    totalPages,
    pageSize: PAGE_SIZE,
    loading,
    refetch: fetchPage,
  };
}
