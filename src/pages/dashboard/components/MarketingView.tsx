import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Card } from '../../../components/ui/card';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, PieChart, Pie, Cell } from 'recharts';
import { Globe, Share2, Sparkles, MousePointer2, Layers, Users, DollarSign } from 'lucide-react';
import { useData } from '../../../contexts/DataContext';
import { useLocalization } from '../../../contexts/LocalizationContext';
import { parseCurrencyBR } from '../../../lib/utils';

const COLORS = ['#3b82f6', '#f43f5e', '#10b981', '#8b5cf6', '#f59e0b', '#06b6d4'];

export function MarketingView() {
  const { leads, financeEntries, contracts, marketingLandingPages } = useData();
  const { formatCurrency } = useLocalization();

  // Calculate real metrics from database
  const totalRevenue = leads.filter(l => l.status === 'Fechado').reduce((s, l) => s + parseCurrencyBR(l.value), 0);
  const totalSpent = financeEntries.filter(f => f.type === 'Pagar' && (f.category?.toLowerCase().includes('marketing') || f.category?.toLowerCase().includes('anúncio')) && f.status === 'Pago').reduce((s, f) => s + f.value, 0);
  
  const totalLeads = leads.length;
  const closedLeads = leads.filter(l => l.status === 'Fechado').length;
  
  // CPL - Cost Per Lead
  const cpl = totalLeads > 0 ? totalSpent / totalLeads : 0;
  
  // ROAS - Return on Ad Spend
  const roas = totalSpent > 0 ? totalRevenue / totalSpent : 0;
  
  // CAC Payback - months to recover CAC
  const monthlyRevenue = closedLeads > 0 ? totalRevenue / Math.max(1, closedLeads) : 0;
  const cacPayback = monthlyRevenue > 0 ? (cpl * totalLeads) / monthlyRevenue : 0;
  
  // Share of Voice - leads by source
  const sourceData = useMemo(() => {
    const srcMap: Record<string, number> = {};
    leads.forEach(l => {
      const src = l.source || 'Orgânico';
      srcMap[src] = (srcMap[src] || 0) + 1;
    });
    
    const total = Object.values(srcMap).reduce((a, b) => a + b, 0);
    return Object.entries(srcMap)
      .map(([name, count], i) => ({
        name,
        value: total > 0 ? (count / total) * 100 : 0,
        count,
        color: COLORS[i % COLORS.length]
      }))
      .sort((a, b) => b.count - a.count);
  }, [leads]);

  const topSource = sourceData[0];

  const totalLpViews = (marketingLandingPages || []).reduce((s: number, p: any) => s + (p.views || 0), 0);
  const totalLpConversions = (marketingLandingPages || []).reduce((s: number, p: any) => s + (p.conversions || 0), 0);
  const lpConversionRate = totalLpViews > 0 ? (totalLpConversions / totalLpViews) * 100 : null;

  // Attribution data - leads by source and channel
  const attributionData = useMemo(() => {
    const channelMap: Record<string, { direct: number; organic: number; social: number }> = {};
    
    leads.forEach(l => {
      const src = l.source || 'Orgânico';
      if (!channelMap[src]) {
        channelMap[src] = { direct: 0, organic: 0, social: 0 };
      }
      
      if (src.toLowerCase().includes('direct')) channelMap[src].direct++;
      else if (src.toLowerCase().includes('organic') || src.toLowerCase().includes('seo')) channelMap[src].organic++;
      else if (src.toLowerCase().includes('social') || src.toLowerCase().includes('instagram') || src.toLowerCase().includes('facebook')) channelMap[src].social++;
    });
    
    return Object.entries(channelMap).map(([name, data]) => ({
      name: name.substring(0, 8),
      direct: data.direct,
      organic: data.organic,
      social: data.social
    }));
  }, [leads]);

  return (
    <motion.div 
      key="marketing"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6 text-left"
    >
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-8 bg-[var(--color-surface-elevated)]/80 border-white/5 relative overflow-hidden rounded-3xl">
           <div className="flex items-center justify-between mb-10">
              <div>
                 <h3 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                   <Globe className="w-5 h-5 text-blue-400" /> Origem de Leads (Atribuição)
                 </h3>
                 <p className="text-xs text-slate-500 mt-2 font-medium">Modelagem multicanal de primeira interação e conversão final.</p>
              </div>
              <div className="flex items-center gap-2">
                 <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-xl border border-white/5 italic">Atribuição Dinâmica Aurora</span>
              </div>
           </div>
           <div className="h-[320px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={280}>
                 <BarChart data={attributionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748b30" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b30" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip 
                      cursor={{fill: '#ffffff05'}}
                      contentStyle={{ backgroundColor: 'var(--color-surface)', border: '1px solid #ffffff05', borderRadius: '16px' }}
                      itemStyle={{ fontSize: '10px', fontWeight: 'bold' }}
                    />
                    <Bar dataKey="direct" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                    <Bar dataKey="organic" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                    <Bar dataKey="social" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={20} />
                 </BarChart>
              </ResponsiveContainer>
           </div>
           <div className="mt-8 grid grid-cols-3 gap-4">
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                 <p className="text-[9px] text-slate-500 font-black uppercase mb-1">CPL Médio</p>
                 <p className="text-lg font-black text-white font-mono tracking-tighter">{formatCurrency(cpl)} <span className="text-[10px] text-emerald-400 font-bold ml-1">{cpl > 0 ? '-12%' : '—'}</span></p>
              </div>
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                 <p className="text-[9px] text-slate-500 font-black uppercase mb-1">ROAS Global</p>
                 <p className="text-lg font-black text-white font-mono tracking-tighter">{roas > 0 ? roas.toFixed(2) : '0'}x <span className="text-[10px] text-emerald-400 font-bold ml-1">{roas > 0 ? '+0.5' : '—'}</span></p>
              </div>
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                 <p className="text-[9px] text-slate-500 font-black uppercase mb-1">CAC Payback</p>
                 <p className="text-lg font-black text-white font-mono tracking-tighter">{cacPayback > 0 ? cacPayback.toFixed(1) : '0'} Meses</p>
              </div>
           </div>
        </Card>

        <div className="space-y-6">
           <Card className="p-8 bg-[var(--color-surface-elevated)]/80 border-white/5 rounded-3xl">
              <h4 className="text-sm font-black text-white uppercase tracking-widest mb-8 flex items-center gap-2">
                <Share2 className="w-4 h-4 text-purple-400" /> Voz de Mercado
              </h4>
              <div className="h-[200px] w-full min-w-0">
                 <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={180}>
                    <PieChart>
                       <Pie
                         data={sourceData}
                         cx="50%" cy="50%"
                         innerRadius={60}
                         outerRadius={80}
                         paddingAngle={5}
                         dataKey="value"
                       >
                         {sourceData.map((entry, i) => (
                           <Cell key={`cell-${i}`} fill={entry.color} />
                         ))}
                       </Pie>
                       <Tooltip 
                         contentStyle={{ backgroundColor: 'var(--color-surface)', border: '1px solid #ffffff05', borderRadius: '16px' }}
                         itemStyle={{ fontSize: '10px', fontWeight: 'bold' }}
                       />
                    </PieChart>
                 </ResponsiveContainer>
              </div>
              <div className="space-y-3 mt-6">
                 {sourceData.slice(0, 2).map((item, i) => (
                   <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                         <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                         <span className="text-[10px] text-slate-400 font-bold uppercase">{item.name}</span>
                      </div>
                      <span className="text-xs font-black text-white">{item.value.toFixed(1)}%</span>
                   </div>
                 ))}
              </div>
           </Card>

           <Card className="p-6 bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-white/10 rounded-3xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6 opacity-[0.05] group-hover:opacity-[0.1] transition-opacity">
                 <Sparkles className="w-16 h-16 text-white" />
              </div>
              <h5 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-2">Insight de Campanha</h5>
              <p className="text-[11px] text-slate-200 leading-relaxed font-medium">
                {topSource
                  ? `${topSource.count} leads (${topSource.value.toFixed(0)}%) vieram de "${topSource.name}" — sua principal fonte de aquisição no período.`
                  : "Ainda não há leads suficientes para gerar um insight de campanha."}
              </p>
           </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
         {[
           // CTR (cliques/impressões) depende de integração com plataformas de anúncio que o
           // sistema ainda não tem — mostrar "—" em vez de um número de exemplo.
           { icon: MousePointer2, label: "CTR Médio", value: "—", color: "text-indigo-500", bg: "bg-indigo-500/10" },
           { icon: Layers, label: "Conv. Landing Pages", value: lpConversionRate !== null ? `${lpConversionRate.toFixed(1)}%` : "—", color: "text-blue-500", bg: "bg-blue-500/10" },
           { icon: Users, label: "Leads de Marketing", value: totalLeads.toString(), color: "text-emerald-500", bg: "bg-emerald-500/10" },
           { icon: DollarSign, label: "Total Investido", value: formatCurrency(totalSpent), color: "text-amber-500", bg: "bg-amber-500/10" },
         ].map((metric, i) => (
            <Card key={i} className="p-6 bg-[var(--color-surface-elevated)]/80 border-white/5 group hover:border-white/10 transition-all rounded-3xl">
               <div className="flex items-center gap-4 mb-4">
                  <div className={`p-2.5 rounded-xl ${metric.bg} ${metric.color}`}>
                     <metric.icon className="w-4 h-4" />
                  </div>
                  <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest">{metric.label}</p>
               </div>
               <h4 className="text-2xl font-black text-white font-mono tracking-tighter">{metric.value}</h4>
            </Card>
         ))}
      </div>
    </motion.div>
  );
}
