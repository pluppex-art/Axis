import { Card } from "../../../../components/ui/card";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Cell, PieChart, Pie } from "recharts";

interface ChartEntry { name: string; receita: number; despesa: number; }

interface FinanceiroCashflowChartProps {
  chartData: ChartEntry[];
  stabilityScore: number;
  liquidez: number | null;
  burnRate: number;
}

export function FinanceiroCashflowChart({ chartData, stabilityScore, liquidez, burnRate }: FinanceiroCashflowChartProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
      <Card className="lg:col-span-8 rounded-3xl p-8 border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)]/80 backdrop-blur-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
          <div>
            <h3 className="font-black text-lg text-[var(--color-text-primary)] uppercase italic tracking-tighter flex items-center gap-3">
              <div className="w-2 h-8 bg-blue-500 rounded-full" /> Motor de Performance Financeira
            </h3>
            <p className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mt-1">Histórico real de receita e despesa dos últimos 6 meses</p>
          </div>
          <div className="flex flex-wrap gap-4 bg-[var(--color-surface-sunken)] p-2 rounded-2xl border border-[var(--color-border-subtle)]">
            {[{ label: "Receita", color: "bg-[#2563EB]" }, { label: "Despesa", color: "bg-rose-500" }].map(l => (
              <div key={l.label} className="flex items-center gap-2 px-2">
                <div className={`w-2 h-2 rounded-full ${l.color}`} />
                <span className="text-[9px] text-[var(--color-text-muted)] uppercase font-black tracking-widest">{l.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563EB" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "var(--color-text-muted)", fontSize: 10, fontWeight: 900 }} dy={15} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--color-text-muted)", fontSize: 10, fontWeight: 900 }} tickFormatter={(val) => `R$ ${val / 1000}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: "var(--color-surface-elevated)", border: "1px solid var(--color-border-default)", borderRadius: "24px", padding: "20px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)" }}
                itemStyle={{ fontSize: "11px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.05em" }}
                labelStyle={{ fontSize: "12px", fontWeight: 900, marginBottom: "12px", color: "#60a5fa", textTransform: "uppercase" }}
              />
              <Area type="monotone" dataKey="receita" stroke="#2563EB" strokeWidth={4} fillOpacity={1} fill="url(#colorRec)" />
              <Area type="monotone" dataKey="despesa" stroke="#f43f5e" strokeWidth={2} fill="transparent" strokeDasharray="4 4" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="lg:col-span-4 rounded-3xl p-8 border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)]/80 backdrop-blur-xl flex flex-col items-center justify-center text-center">
        <h4 className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.3em] mb-8">Score de Estabilidade</h4>
        <div className="relative w-full aspect-square max-w-[240px] flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={[{ name: "Stability", value: stabilityScore }, { name: "Remaining", value: 100 - stabilityScore }]}
                cx="50%" cy="50%" innerRadius="80%" outerRadius="100%" startAngle={220} endAngle={-40} paddingAngle={0} dataKey="value" stroke="none">
                <Cell fill="#2563EB" />
                <Cell fill="var(--color-border-subtle)" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl font-black text-[var(--color-text-primary)] italic tracking-tighter">{stabilityScore}</span>
            <span className="text-[10px] font-black text-blue-500 dark:text-blue-400 uppercase tracking-widest mt-2">Saúde Global</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 w-full mt-10">
          <div className="bg-[var(--color-surface-sunken)] p-4 rounded-2xl border border-[var(--color-border-subtle)]">
            <p className="text-[9px] font-black text-[var(--color-text-muted)] uppercase mb-1">Liquidez</p>
            <span className="text-[var(--color-text-primary)] font-black font-mono">{liquidez !== null ? `${liquidez.toFixed(0)}%` : "—"}</span>
          </div>
          <div className="bg-[var(--color-surface-sunken)] p-4 rounded-2xl border border-[var(--color-border-subtle)]">
            <p className="text-[9px] font-black text-[var(--color-text-muted)] uppercase mb-1">Burn Rate</p>
            <span className="text-rose-600 dark:text-rose-400 font-black font-mono">{burnRate > 0 ? `R$ ${burnRate.toLocaleString('pt-BR')}` : "R$ 0"}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
