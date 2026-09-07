import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { toast } from 'sonner';
import type { TarefaSprintPayload } from '../modals/NovaTarefaSprintModal';

export type Priority = 'crítica' | 'alta' | 'média' | 'baixa';
export type Column = 'backlog' | 'todo' | 'inprogress' | 'review' | 'done';

export interface SprintTask {
  id: string | number;
  title: string;
  type: 'feature' | 'bug' | 'chore' | 'refactor';
  priority: Priority;
  points: number;
  assignee: string;
  tags: string[];
  column: Column;
}

const COL_MAP: Record<string, Column> = {
  'Backlog': 'backlog', 'A Fazer': 'todo', 'Em Progresso': 'inprogress',
  'Em Review': 'review', 'Concluído': 'done',
};



function rowToTask(row: any): SprintTask {
  return {
    id: row.id,
    title: row.title,
    type: row.type as SprintTask['type'],
    priority: row.priority as Priority,
    points: row.points || 1,
    assignee: row.assignee || '',
    tags: row.tags || [],
    column: row.column_id as Column,
  };
}

export function useDevSprints(projectId?: string | null) {
  const [tasks, setTasks] = useState<SprintTask[]>([]);


  const [loading, setLoading] = useState(false);


  useEffect(() => {
    if (!supabase) return;
    if (!projectId) {
      setTasks([]);
      return;
    }

    async function load() {
      setLoading(true);
      const { data, error } = await supabase!
      .from('dev_sprint_tasks')
        .select('*')
        // Suporta o schema novo (project_id) e legado (project)
        .or(`project_id.eq.${projectId},project.eq.${projectId}`)
        .order('created_at', { ascending: true });

      if (!error && data !== null) {
        setTasks(data.map(rowToTask));
      }
      setLoading(false);
    }

    load();
  }, [projectId]);


  async function addTask(payload: TarefaSprintPayload) {
    const column = (COL_MAP[payload.column] || 'backlog') as Column;

    if (!projectId) {
      toast.error('Selecione um projeto para adicionar tarefas.');
      return;
    }

    if (!supabase) {
      setTasks(prev => [...prev, { id: Date.now(), title: payload.title, type: payload.type, priority: payload.priority, points: payload.points, assignee: payload.assignee || '?', tags: [], column }]);
      toast.success('Tarefa adicionada!');
      return;
    }

    const { data, error } = await supabase
      .from('dev_sprint_tasks')
      .insert({
        title: payload.title,
        type: payload.type,
        priority: payload.priority,
        points: payload.points,
        assignee: payload.assignee || '',
        tags: [],
        column_id: column,
        project: projectId,
        sprint_id: projectId,
      })
      .select()
      .maybeSingle();

    if (error) { toast.error('Erro ao adicionar tarefa'); return; }
    if (data) {
      setTasks(prev => [...prev, rowToTask(data)]);
      toast.success('Tarefa adicionada!');
    }
  }


  async function moveTask(id: string | number, column: Column) {
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, column } : t)));
    if (!supabase) return;

    // Atualiza card
    const { error: moveError } = await supabase
      .from('dev_sprint_tasks')
      .update({ column_id: column })
      .eq('id', id);

    if (moveError) {
      console.error('[Supabase] move dev_sprint_tasks error:', moveError.message);
      toast.error(`Erro ao mover tarefa: ${moveError.message}`);
    }

    // Recalcula progresso do projeto (100% automático)
    // Progresso = cards concluídos / total backlog do projeto
    if (!projectId) return;

    const { data: tasksAfter } = await supabase
      .from('dev_sprint_tasks')
      .select('column_id, points')
      .eq('project', projectId);

    if (!tasksAfter) return;

    const backlogPoints = tasksAfter
      .filter((t: any) => t.column_id === 'backlog')
      .reduce((s: number, t: any) => s + (t.points || 0), 0);

    const donePoints = tasksAfter
      .filter((t: any) => t.column_id === 'done')
      .reduce((s: number, t: any) => s + (t.points || 0), 0);

    const nextProgress = backlogPoints > 0 ? Math.round((donePoints / backlogPoints) * 100) : 0;

    const { error: progressError } = await supabase
      .from('dev_projects')
      .update({ progress: nextProgress })
      .eq('id', projectId);

    if (progressError) {
      console.error('[Supabase] update dev_projects progress error:', progressError.message);
    }
  }


  return { tasks, loading, addTask, moveTask };
}
