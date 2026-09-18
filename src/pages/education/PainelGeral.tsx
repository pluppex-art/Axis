import { useState, useEffect, useMemo } from 'react';
import { 
  GraduationCap, Users, BookOpen, Award, 
  TrendingUp, Activity, Star, Calendar,
  ArrowUpRight, Clock, ArrowRight, CheckCircle2, 
  AlertTriangle, DollarSign, Wallet
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, BarChart, Bar,
  PieChart, Pie, Cell 
} from 'recharts';
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { PageContainer } from "../../components/PageContainer";
import { useData } from "../../contexts/DataContext";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import { useNavigate } from "react-router-dom";
import { useLocalization } from "../../contexts/LocalizationContext";

const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899'];

export default function PainelGeralEducation() {
  const { formatCurrency } = useLocalization();
  const navigate = useNavigate();
  const { turmas, students, certificates } = useData();
  const { activeTenantId } = useAuth();
  const [mensalidades, setMensalidades] = useState<any[]>([]);
  const [loadingMensalidades, setLoadingMensalidades] = useState(true);

  useEffect(() => {
    if (!supabase || !activeTenantId) {
      setLoadingMensalidades(false);
      return;
    }
    // Sem o filtro de tenant, os KPIs de mensalidades (Recebido/A Receber/Em
    // Atraso) somavam os valores de TODOS os tenants juntos.
    supabase
      .from("mensalidades")
      .select("*")
      .eq("tenant_id", activeTenantId)
      .order("vencimento", { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) {
          setMensalidades(data);
        }
        setLoadingMensalidades(false);
      });
  }, [activeTenantId]);

  // KPIs
  const totalAlunos = students.length;
  const totalTurmas = turmas.length;
  const totalCertificados = certificates.length;

  const totalRecebido = useMemo(() => {
    return mensalidades
      .filter(m => m.status === 'Pago')
      .reduce((acc, m) => acc + (Number(m.valor) || 0), 0);
  }, [mensalidades]);

  const totalPendente = useMemo(() => {
    return mensalidades
      .filter(m => m.status === 'Pendente')
      .reduce((acc, m) => acc + (Number(m.valor) || 0), 0);
  }, [mensalidades]);

  const totalAtrasado = useMemo(() => {
    return mensalidades
      .filter(m => m.status === 'Atrasado')
      .reduce((acc, m) => acc + (Number(m.valor) || 0), 0);
  }, [mensalidades]);

  // Alunos por Turma
  const turmasData = useMemo(() => {
    return turmas.map(t => ({
      name: t.nome || t.name || 'Turma',
      alunos: (students || []).filter((s: any) => s.turma_id === t.id || s.turma === t.nome).length || (t.alunos_count || 0),
    }));
  }, [turmas, students]);

  // Status de Mensalidades (Pie)
  const mensalidadesStatusData = useMemo(() => {
    const pagos = mensalidades.filter(m => m.status === 'Pago').length;
    const pendentes = mensalidades.filter(m => m.status === 'Pendente').length;
    const atrasados = mensalidades.filter(m => m.status === 'Atrasado').length;

    return [
      { name: 'Pagas', value: pagos, color: '#10b981' },
      { name: 'A Vencer', value: pendentes, color: '#3b82f6' },
      { name: 'Atrasadas', value: atrasados, color: '#ef4444' },
    ].filter(d => d.value > 0);
  }, [mensalidades]);

  const fmt = (v: number) => formatCurrency(v);

  return (
    <PageContainer 
      title="Painel Educacional S.P.Y." 
      description="Visão 360º da operação pedagógica, turmas ativas, base de alunos e controle de mensalidades."
      actions={
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={() => navigate('/app/educacao/mensalidades')}
            className="h-10 rounded-xl border-white/10 text-xs font-bold gap-2"
          >
            <Wallet className="w-4 h-4 text-emerald-400" /> Mensalidades
          </Button>
          <Button 
            onClick={() => navigate('/app/educacao/turmas')}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-10 px-6 text-xs font-bold gap-2 shadow-lg"
          >
            <GraduationCap className="w-4 h-4" /> Gestão de Turmas
          </Button>
        </div>
      }
    >
      <div className="max-w-[1700px] mx-auto space-y-6 pb-10">
        
        {/* KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-5 bg-[var(--color-surface-elevated)] border border-white/5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total de Alunos</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-display font-black text-white italic">{totalAlunos}</div>
            <p className="text-[11px] text-slate-500 mt-1">Alunos matriculados no sistema</p>
          </Card>

          <Card className="p-5 bg-[var(--color-surface-elevated)] border border-white/5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Turmas Ativas</span>
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <GraduationCap className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-display font-black text-white italic">{totalTurmas}</div>
            <p className="text-[11px] text-slate-500 mt-1">Turmas pedagógicas cadastradas</p>
          </Card>

          <Card className="p-5 bg-[var(--color-surface-elevated)] border border-white/5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recebido (Mensalidades)</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-display font-black text-emerald-400 italic">{fmt(totalRecebido)}</div>
            <p className="text-[11px] text-slate-500 mt-1">Parcelas pagas confirmadas</p>
          </Card>

          <Card className="p-5 bg-[var(--color-surface-elevated)] border border-white/5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Certificados Emitidos</span>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Award className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-display font-black text-amber-400 italic">{totalCertificados}</div>
            <p className="text-[11px] text-slate-500 mt-1">Conclusões registradas</p>
          </Card>
        </div>

        {/* Charts & Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Alunos por Turma */}
          <Card className="lg:col-span-2 p-6 bg-[var(--color-surface-elevated)] border-white/5">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" /> Distribuição de Alunos por Turma
                </h3>
                <p className="text-xs text-slate-400">Capacidade e ocupação por turma ativa</p>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate('/app/educacao/turmas')}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Ver todas <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>

            {turmasData.length === 0 ? (
              <div className="h-[280px] flex flex-col items-center justify-center gap-2 text-slate-500">
                <GraduationCap className="w-10 h-10 opacity-30" />
                <p className="text-xs">Nenhuma turma cadastrada no momento.</p>
              </div>
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={turmasData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "var(--color-surface-elevated)", 
                        borderColor: "rgba(255,255,255,0.1)",
                        borderRadius: "12px",
                        fontSize: "12px"
                      }} 
                    />
                    <Bar dataKey="alunos" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={48} name="Alunos" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* Situação Financeira / Mensalidades */}
          <Card className="p-6 bg-[var(--color-surface-elevated)] border-white/5 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
                <Wallet className="w-4 h-4 text-emerald-400" /> Saúde Financeira (Mensalidades)
              </h3>
              <p className="text-xs text-slate-400 mb-6">Status dos títulos e inadimplência</p>

              {mensalidadesStatusData.length === 0 ? (
                <div className="h-[180px] flex flex-col items-center justify-center gap-2 text-slate-500">
                  <Wallet className="w-8 h-8 opacity-30" />
                  <p className="text-xs">Nenhuma mensalidade gerada.</p>
                </div>
              ) : (
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={mensalidadesStatusData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={4}
                      >
                        {mensalidadesStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "var(--color-surface-elevated)", 
                          borderColor: "rgba(255,255,255,0.1)",
                          borderRadius: "12px",
                          fontSize: "12px"
                        }} 
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="space-y-2 pt-4 border-t border-white/5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" /> A Receber
                </span>
                <span className="font-bold text-white">{fmt(totalPendente)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-rose-500" /> Em Atraso
                </span>
                <span className="font-bold text-rose-400">{fmt(totalAtrasado)}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Turmas Recentes */}
        <Card className="bg-[var(--color-surface-elevated)] border-white/5 overflow-hidden">
          <div className="p-5 border-b border-white/5 flex justify-between items-center">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-indigo-400" /> Turmas em Andamento
            </h3>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => navigate('/app/educacao/turmas')}
              className="text-xs"
            >
              Gerenciar Turmas
            </Button>
          </div>

          {turmas.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <GraduationCap className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-xs">Nenhuma turma cadastrada.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {turmas.slice(0, 5).map((turma) => (
                <div key={turma.id} className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-xs">
                      {turma.nome?.charAt(0) || 'T'}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{turma.nome || turma.name}</h4>
                      <p className="text-xs text-slate-400">{turma.curso || 'Curso Profissionalizante'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant="neutral">
                      {(students || []).filter((s: any) => s.turma_id === turma.id).length} alunos
                    </Badge>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => navigate('/app/educacao/turmas')}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      Acessar <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

      </div>
    </PageContainer>
  );
}
