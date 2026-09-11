import { Card } from "../../components/ui/card";
import { Download, Percent, DollarSign, Calendar, RefreshCw, BarChart3, PiggyBank } from "lucide-react";
import { useData } from "../../contexts/DataContext";
import { useMemo, useState, useEffect } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { PageContainer } from "../../components/PageContainer";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";

const SETTING_KEY = "finance_dre_config";

export default function FinanceiroDRE() {
  const { financeEntries, appSettings, appSettingsLoaded, saveAppSetting } = useData();

  const [impostoPct, setImpostoPct] = useState(0);
  const [cpvPct, setCpvPct] = useState(0);
  const [despesaPessoal, setDespesaPessoal] = useState(0);
  const [despesaMarketing, setDespesaMarketing] = useState(0);
  const [despesaAdmin, setDespesaAdmin] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  const [period, setPeriod] = useState<"mensal" | "trimestral" | "semestral" | "anual" | "personalizado">("mensal");
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  // Hidrata do Supabase (app_settings) uma vez quando os dados do tenant chegam
  useEffect(() => {
    if (hydrated || !appSettingsLoaded) return;
    const saved = appSettings?.[SETTING_KEY];
    if (saved) {
      setImpostoPct(saved.impostoPct ?? 0);
      setCpvPct(saved.cpvPct ?? 0);
      setDespesaPessoal(saved.despesaPessoal ?? 0);
      setDespesaMarketing(saved.despesaMarketing ?? 0);
      setDespesaAdmin(saved.despesaAdmin ?? 0);
    }
    setHydrated(true);
  }, [appSettings, appSettingsLoaded, hydrated]);

  // Persiste no Supabase a cada mudança, só depois de hidratar (pra não
  // sobrescrever dado real salvo com os zeros iniciais).
  useEffect(() => {
    if (!hydrated) return;
    saveAppSetting(SETTING_KEY, { impostoPct, cpvPct, despesaPessoal, despesaMarketing, despesaAdmin });
  }, [impostoPct, cpvPct, despesaPessoal, despesaMarketing, despesaAdmin, hydrated]);

  // Aggregate current actuals from the data provider
  const parsedData = useMemo(() => {
    let scaleFactor = 1;
    let filteredReceitas = financeEntries.filter(f => f.type === "Receber" && f.status === "Pago");
    let filteredDespesas = financeEntries.filter(f => f.type === "Pagar" && f.status === "Pago");

    if (period === "mensal") {
      scaleFactor = 1;
    } else if (period === "trimestral") {
      scaleFactor = 3;
    } else if (period === "semestral") {
      scaleFactor = 6;
    } else if (period === "anual") {
      scaleFactor = 12;
    } else if (period === "personalizado") {
      if (customStartDate) {
        filteredReceitas = filteredReceitas.filter(f => !f.date || f.date >= customStartDate);
        filteredDespesas = filteredDespesas.filter(f => !f.date || f.date >= customStartDate);
      }
      if (customEndDate) {
        filteredReceitas = filteredReceitas.filter(f => !f.date || f.date <= customEndDate);
        filteredDespesas = filteredDespesas.filter(f => !f.date || f.date <= customEndDate);
      }
      if (customStartDate && customEndDate) {
        const start = new Date(customStartDate);
        const end = new Date(customEndDate);
        const diffDays = Math.max(1, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        scaleFactor = Math.max(0.1, parseFloat((diffDays / 30.4375).toFixed(2)));
      }
    }

    const receitaBrutaPaid = filteredReceitas.reduce((sum, f) => sum + f.value, 0);
    const scaledReceitaBruta = period === "personalizado" ? receitaBrutaPaid : receitaBrutaPaid * scaleFactor;

    const impostos = scaledReceitaBruta * (impostoPct / 100);
    const receitaLiquida = scaledReceitaBruta - impostos;
    const cpv = receitaLiquida * (cpvPct / 100);
    const lucroBruto = receitaLiquida - cpv;

    const actualFixedExpenses = filteredDespesas.reduce((sum, f) => sum + f.value, 0);
    const fixedExpensesPaid = period === "personalizado" ? actualFixedExpenses : actualFixedExpenses * scaleFactor;

    const despesasOp = fixedExpensesPaid + (despesaPessoal + despesaMarketing + despesaAdmin) * scaleFactor;
    const ebitda = lucroBruto - despesasOp;
    const lucroLiquido = ebitda;

    return {
      scaleFactor,
      receitaBruta: scaledReceitaBruta,
      impostos,
      receitaLiquida,
      cpv,
      lucroBruto,
      despesasOp,
      ebitda,
      lucroLiquido
    };
  }, [financeEntries, impostoPct, cpvPct, despesaPessoal, despesaMarketing, despesaAdmin, period, customStartDate, customEndDate]);

  const fmt = (v: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  };

  const chartData = [
    { name: "Receita Bruta", Valor: Math.max(0, parsedData.receitaBruta), fill: "#2563EB" },
    { name: "Receita Líquida", Valor: Math.max(0, parsedData.receitaLiquida), fill: "#3b82f6" },
    { name: "Lucro Bruto", Valor: Math.max(0, parsedData.lucroBruto), fill: "#10b981" },
    { name: "EBITDA", Valor: Math.max(0, parsedData.ebitda), fill: "#8b5cf6" },
  ];

  const dreLines = [
    { name: "1. RECEITA OPERACIONAL BRUTA", value: fmt(parsedData.receitaBruta), isTotal: true },
    { name: "(-) Impostos sobre Vendas", value: `(${fmt(parsedData.impostos)})`, isSub: true, indent: true },
    { name: "2. RECEITA OPERACIONAL LÍQUIDA", value: fmt(parsedData.receitaLiquida), isTotal: true },
    { name: "(-) Custos dos Produtos / Serviços (CPV)", value: `(${fmt(parsedData.cpv)})`, isSub: true, indent: true },
    { name: "3. LUCRO BRUTO", value: fmt(parsedData.lucroBruto), isTotal: true },
    { name: "(-) Despesas com Pessoal & Folha", value: `(${fmt(despesaPessoal * parsedData.scaleFactor)})`, isSub: true, indent: true },
    { name: "(-) Despesas com Marketing & Tráfego", value: `(${fmt(despesaMarketing * parsedData.scaleFactor)})`, isSub: true, indent: true },
    { name: "(-) Despesas Administrativas & Infra", value: `(${fmt(despesaAdmin * parsedData.scaleFactor)})`, isSub: true, indent: true },
    { name: "4. DESPESAS OPERACIONAIS TOTAIS", value: `(${fmt(parsedData.despesasOp)})`, isTotal: true },
    { name: "5. EBITDA / LAJIDA", value: fmt(parsedData.ebitda), isTotal: true, isEbitda: true },
    { name: "6. RESULTADO LÍQUIDO DO EXERCÍCIO", value: fmt(parsedData.lucroLiquido), isTotal: true },
  ];

  const handleExportXLS = () => {
    const csvContent = "data:text/csv;charset=utf-8,"
      + "Linha DRE;Valor\r\n"
      + dreLines.map(line => `"${line.name.trim()}";"${line.value}"`).join("\r\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `dre_gerencial_${period}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Demonstrativo exportado com sucesso em formato de planilha (CSV)!");
  };

  const handleResetParameters = () => {
    setImpostoPct(0);
    setCpvPct(0);
    setDespesaPessoal(0);
    setDespesaMarketing(0);
    setDespesaAdmin(0);
    toast.info("Parâmetros do DRE zerados.");
  };

  return (
    <PageContainer
      title="DRE Gerencial S.P.Y."
      description="Demonstrativo de Resultados do Exercício gerado em tempo real com apuração de fluxo de caixa e filtros inteligentes."
      actions={
        <div className="flex gap-2 flex-wrap items-center">
          <div className="flex bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] p-0.5 gap-1 h-9">
            {[
              { id: "mensal", label: "Mensal" },
              { id: "trimestral", label: "Trimestral" },
              { id: "semestral", label: "Semestral" },
              { id: "anual", label: "Anual" },
              { id: "personalizado", label: "Personalizado" },
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id as any)}
                className={`px-3 text-xs font-bold rounded cursor-pointer transition-all ${
                  period === p.id ? "bg-[var(--color-primary-blue)] !text-white" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {period === "personalizado" && (
            <div className="flex items-center gap-1.5 bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] px-2.5 h-9 text-xs">
              <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase">De:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-transparent text-xs text-white font-mono focus:outline-none"
              />
              <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase ml-1">Até:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-transparent text-xs text-white font-mono focus:outline-none"
              />
            </div>
          )}

          <Button 
            onClick={handleExportXLS}
            className="h-9 px-4 text-xs font-bold gap-1.5 shadow-xs"
          >
            <Download className="w-3.5 h-3.5" /> Exportar DRE
          </Button>
        </div>
      }
    >
      <div className="space-y-6 max-w-[1700px] mx-auto pb-12">
        {/* Dynamic setup and simulation panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 p-6 bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] shadow-sm">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-[var(--color-border-subtle)]">
              <h3 className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[var(--color-primary-blue)]" /> Parâmetros e Simulação do DRE
              </h3>
              <button 
                type="button"
                onClick={handleResetParameters}
                className="text-xs font-bold text-[var(--color-text-muted)] hover:text-[var(--color-primary-blue)] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Resetar Padrões
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-[var(--color-text-muted)] flex items-center gap-1"><Percent className="w-3.5 h-3.5 text-[var(--color-primary-blue)]" /> Impostos / Deduções</span>
                    <span className="font-mono text-[var(--color-text-primary)]">{impostoPct}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="40" 
                    value={impostoPct} 
                    onChange={(e) => setImpostoPct(Number(e.target.value))}
                    className="w-full accent-[var(--color-primary-blue)] bg-[var(--color-surface-sunken)] h-2 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-[var(--color-text-muted)] flex items-center gap-1"><Percent className="w-3.5 h-3.5 text-emerald-500" /> CPV / Provedores</span>
                    <span className="font-mono text-[var(--color-text-primary)]">{cpvPct}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="5" 
                    max="60" 
                    value={cpvPct} 
                    onChange={(e) => setCpvPct(Number(e.target.value))}
                    className="w-full accent-emerald-500 bg-[var(--color-surface-sunken)] h-2 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>

              <div className="border-t border-[var(--color-border-subtle)] my-4" />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-[var(--color-text-muted)] mb-1 block">Folha de Pessoal (R$/Mês)</label>
                  <div className="relative">
                    <DollarSign className="w-3.5 h-3.5 text-[var(--color-text-faint)] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="number"
                      step="1000"
                      value={despesaPessoal}
                      onChange={(e) => setDespesaPessoal(Number(e.target.value))}
                      className="w-full bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] h-9 rounded-[var(--radius-control)] pl-8 pr-3 text-xs font-bold text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-blue)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-[var(--color-text-muted)] mb-1 block">Orçamento Marketing (R$/Mês)</label>
                  <div className="relative">
                    <DollarSign className="w-3.5 h-3.5 text-[var(--color-text-faint)] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="number"
                      step="500"
                      value={despesaMarketing}
                      onChange={(e) => setDespesaMarketing(Number(e.target.value))}
                      className="w-full bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] h-9 rounded-[var(--radius-control)] pl-8 pr-3 text-xs font-bold text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-blue)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-[var(--color-text-muted)] mb-1 block">Despesa Admin / Infra (R$/Mês)</label>
                  <div className="relative">
                    <DollarSign className="w-3.5 h-3.5 text-[var(--color-text-faint)] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="number"
                      step="500"
                      value={despesaAdmin}
                      onChange={(e) => setDespesaAdmin(Number(e.target.value))}
                      className="w-full bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] h-9 rounded-[var(--radius-control)] pl-8 pr-3 text-xs font-bold text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-blue)]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] shadow-sm flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-4">Gráfico de Lucratividade</h4>
              <div className="h-36 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" stroke="var(--color-text-muted)" fontSize={10} width={90} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: "var(--color-surface-elevated)", border: "1px solid var(--color-border-default)", borderRadius: "8px" }} itemStyle={{ fontSize: "11px", color: "var(--color-text-primary)" }} />
                    <Bar dataKey="Valor" radius={[0, 4, 4, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="pt-4 border-t border-[var(--color-border-subtle)] mt-4 flex items-center justify-between">
               <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Margem EBITDA Líquida</p>
                  <h5 className="text-lg font-black text-emerald-500 font-mono">
                    {parsedData.receitaBruta > 0 ? ((parsedData.ebitda / parsedData.receitaBruta) * 100).toFixed(1) : "0"}%
                  </h5>
               </div>
               <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-xl">
                 <PiggyBank className="w-5 h-5" />
               </div>
            </div>
          </Card>
        </div>

        {/* Dynamic DRE Table display */}
        <Card className="bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] p-6 overflow-hidden shadow-sm">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-[var(--color-border-subtle)]">
             <div>
                 <h3 className="text-base font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[var(--color-primary-blue)]" /> Demonstração Consolidada ({
                    period === "mensal" ? "Mês Atual" :
                    period === "trimestral" ? "Trimestre" :
                    period === "semestral" ? "Semestre" :
                    period === "anual" ? "Anual" : "Período Personalizado"
                  })
                </h3>
             </div>
             <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 bg-[var(--color-primary-blue)]/10 border border-[var(--color-primary-blue)]/20 rounded-lg text-[var(--color-primary-blue)]">
               Regime de Caixa
             </span>
          </div>
          
          <div className="space-y-1.5">
             {dreLines.map((line, idx) => (
               <div 
                  key={idx} 
                  className={`flex items-center justify-between p-3 rounded-lg transition-all ${
                    line.isTotal 
                      ? 'bg-[var(--color-surface-sunken)] font-bold text-[var(--color-text-primary)] border border-[var(--color-border-subtle)]' 
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                  } ${line.indent && !line.isTotal ? 'pl-8' : ''}`}
               >
                  <div className={`text-xs font-bold ${line.isSub ? 'text-[var(--color-text-muted)] italic' : ''}`}>{line.name}</div>
                  <div className={`font-mono font-bold ${line.isTotal ? 'text-sm' : 'text-xs'} ${
                    line.value.includes('(') 
                      ? 'text-rose-500' 
                      : (line.isTotal ? 'text-emerald-500' : 'text-[var(--color-text-primary)]')
                  }`}>
                     {line.value}
                  </div>
               </div>
             ))}
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}
