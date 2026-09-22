import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { toast } from 'sonner';

export interface ExamePedido {
  id: string | number;
  patient: string;
  exam: string;
  date: string;
  lab: string;
  status: string;
  result: string;
}

function rowToExame(row: any): ExamePedido {
  return {
    id: row.id,
    patient: row.patient,
    exam: row.exam,
    date: row.date,
    lab: row.lab || '',
    status: row.status,
    result: row.result || '-',
  };
}

export function useExames() {
  const { activeTenantId } = useAuth();
  const [exames, setExames] = useState<ExamePedido[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supabase || !activeTenantId) return;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase!
        .from('exames_pedidos')
        .select('*')
        .eq('tenant_id', activeTenantId)
        .order('created_at', { ascending: false });
      if (!error && data !== null) {
        setExames(data.map(rowToExame));
      }
      setLoading(false);
    }
    load();
  }, [activeTenantId]);

  async function addExame(payload: { patient: string; exam: string; date: string; lab: string }) {
    if (!supabase || !activeTenantId) {
      setExames(prev => [{ id: Date.now(), ...payload, status: 'Aguardando Coleta', result: '-' }, ...prev]);
      toast.success('Pedido criado!');
      return;
    }
    const { data, error } = await supabase
      .from('exames_pedidos')
      .insert({ tenant_id: activeTenantId, patient: payload.patient, exam: payload.exam, date: payload.date, lab: payload.lab, status: 'Aguardando Coleta', result: '-' })
      .select()
      .maybeSingle();
    if (error) { toast.error('Erro ao criar pedido'); return; }
    if (data) {
      setExames(prev => [rowToExame(data), ...prev]);
      toast.success('Pedido criado!');
    }
  }

  async function updateExame(id: string | number, payload: { status: string; result: string }) {
    if (!supabase) {
      setExames(prev => prev.map(e => e.id === id ? { ...e, ...payload } : e));
      toast.success('Pedido atualizado!');
      return;
    }
    const { error } = await supabase
      .from('exames_pedidos')
      .update({ status: payload.status, result: payload.result })
      .eq('id', id);
    if (error) { toast.error('Erro ao atualizar pedido'); return; }
    setExames(prev => prev.map(e => e.id === id ? { ...e, ...payload } : e));
    toast.success('Pedido atualizado!');
  }

  return { exames, loading, addExame, updateExame };
}
