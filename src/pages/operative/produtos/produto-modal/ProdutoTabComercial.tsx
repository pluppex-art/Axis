import { DollarSign, Coins, Percent, TrendingUp, RotateCw, Wrench, Calendar, Sparkles } from "lucide-react";
import { cn } from "../../../../lib/utils";

interface ProdutoTabComercialProps {
  formPrice: string;
  setFormPrice: (v: string) => void;
  formCost: string;
  setFormCost: (v: string) => void;
  formCommission: string;
  setFormCommission: (v: string) => void;
  simulateTax: boolean;
  setSimulateTax: (v: boolean) => void;
  formIsRecurring?: boolean;
  setFormIsRecurring?: (v: boolean) => void;
  formBillingCycle?: string;
  setFormBillingCycle?: (v: string) => void;
  formContractMonths?: string;
  setFormContractMonths?: (v: string) => void;
  formHasImplementation?: boolean;
  setFormHasImplementation?: (v: boolean) => void;
  formImplementationFee?: string;
  setFormImplementationFee?: (v: string) => void;
}

export function ProdutoTabComercial({
  formPrice,
  setFormPrice,
  formCost,
  setFormCost,
  formCommission,
  setFormCommission,
  simulateTax,
  setSimulateTax,
  formIsRecurring = false,
  setFormIsRecurring,
  formBillingCycle = "Mensal",
  setFormBillingCycle,
  formContractMonths = "12",
  setFormContractMonths,
  formHasImplementation = false,
  setFormHasImplementation,
  formImplementationFee = "0",
  setFormImplementationFee,
}: ProdutoTabComercialProps) {
  const inputCls =
    "w-full bg-[var(--color-surface-elevated)] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#2563EB]/40 font-mono font-bold transition-all";

  const p = parseFloat(formPrice) || 0;
  const c = parseFloat(formCost) || 0;
  const commPercent = parseFloat(formCommission) || 0;
  const commissionVal = (p * commPercent) / 100;
  const taxRate = simulateTax ? 0.08 : 0;
  const estimatedTaxVal = p * taxRate;
  const netProfitRaw = Math.max(0, p - c - commissionVal - estimatedTaxVal);
  const netMarginVal = p > 0 ? Math.round((netProfitRaw / p) * 1000) / 10 : 0;

  const contractMonthsNum = parseInt(formContractMonths) || 12;
  const implFeeNum = parseFloat(formImplementationFee) || 0;
  const totalContractLtv = formIsRecurring ? implFeeNum + p * contractMonthsNum : p + implFeeNum;

  let rentabilityLabel = "Digite valores acima";
  let rentabilityColor = "text-slate-400 bg-slate-400/10 border-slate-400/20";
  if (p > 0) {
    if (netMarginVal >= 55) {
      rentabilityLabel = "Rentabilidade Excelente";
      rentabilityColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    } else if (netMarginVal >= 30) {
      rentabilityLabel = "Rentabilidade Saudável";
      rentabilityColor = "text-blue-400 bg-blue-500/10 border-blue-500/20";
    } else {
      rentabilityLabel = "Rentabilidade Baixa — Ajuste o Preço";
      rentabilityColor = "text-rose-400 bg-rose-500/10 border-rose-500/20";
    }
  }

  return (
    <div className="space-y-5">
      {/* Step Banner */}
      <div className="bg-[var(--color-surface-elevated)] border border-white/5 p-4 rounded-xl flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-400 shrink-0 font-black text-xs font-mono">
          2
        </div>
        <div>
          <h4 className="text-xs font-black text-white uppercase tracking-wider">
            Comercial, Recorrência & Implantação
          </h4>
          <p className="text-[10px] text-slate-500">
            Configure preços, mensalidades recorrentes, meses de vigência e taxa de setup/onboarding.
          </p>
        </div>
      </div>

      {/* ── PARÂMETROS DE RECORRÊNCIA E IMPLANTAÇÃO (SOFTWARE / SISTEMA) ── */}
      <div className="bg-gradient-to-br from-blue-950/20 to-indigo-950/20 border border-blue-500/20 p-4.5 rounded-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <h5 className="text-xs font-black uppercase text-white tracking-wide">
              Modelo de Cobrança & Vigência (SaaS / Serviços)
            </h5>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">Definição Contratual</span>
        </div>

        {/* Toggles de Recorrência e Implantação */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Toggle Recorrente */}
          <div
            onClick={() => setFormIsRecurring && setFormIsRecurring(!formIsRecurring)}
            className={cn(
              "p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3",
              formIsRecurring
                ? "bg-blue-500/15 border-blue-500/40 text-white shadow-sm"
                : "bg-white/[0.02] border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200"
            )}
          >
            <div
              className={cn(
                "w-5 h-5 rounded-md flex items-center justify-center mt-0.5 transition-colors",
                formIsRecurring ? "bg-blue-500 text-white" : "bg-white/10 text-transparent"
              )}
            >
              <RotateCw className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold leading-tight text-white">Cobrança Recorrente</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Mensalidade periódica (Assinatura, SaaS, Manutenção)
              </p>
            </div>
          </div>

          {/* Toggle Implantação */}
          <div
            onClick={() => setFormHasImplementation && setFormHasImplementation(!formHasImplementation)}
            className={cn(
              "p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3",
              formHasImplementation
                ? "bg-indigo-500/15 border-indigo-500/40 text-white shadow-sm"
                : "bg-white/[0.02] border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200"
            )}
          >
            <div
              className={cn(
                "w-5 h-5 rounded-md flex items-center justify-center mt-0.5 transition-colors",
                formHasImplementation ? "bg-indigo-500 text-white" : "bg-white/10 text-transparent"
              )}
            >
              <Wrench className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold leading-tight text-white">Taxa de Implantação / Setup</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Onboarding, parametrização técnica inicial ou treinamento
              </p>
            </div>
          </div>
        </div>

        {/* Campos Condicionais de Recorrência (Meses e Ciclo) */}
        {formIsRecurring && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 animate-in fade-in slide-in-from-top-1">
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-extrabold uppercase block tracking-wider flex items-center gap-1">
                <Calendar className="w-3 h-3 text-blue-400" /> Duração do Contrato (Quantos Meses?)
              </label>
              <div className="flex items-center gap-1.5">
                {["1", "3", "6", "12", "24"].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setFormContractMonths && setFormContractMonths(m)}
                    className={cn(
                      "px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer",
                      formContractMonths === m
                        ? "bg-blue-600 border-blue-500 text-white shadow-sm"
                        : "bg-white/[0.03] border-white/10 text-slate-400 hover:text-white"
                    )}
                  >
                    {m}m
                  </button>
                ))}
                <input
                  type="number"
                  min="1"
                  value={formContractMonths}
                  onChange={(e) => setFormContractMonths && setFormContractMonths(e.target.value)}
                  placeholder="Meses"
                  className="w-16 bg-[var(--color-surface-elevated)] border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-mono text-center"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-extrabold uppercase block tracking-wider">
                Ciclo de Cobrança
              </label>
              <select
                value={formBillingCycle}
                onChange={(e) => setFormBillingCycle && setFormBillingCycle(e.target.value)}
                className={inputCls}
              >
                <option value="Mensal">Mensal</option>
                <option value="Trimestral">Trimestral</option>
                <option value="Semestral">Semestral</option>
                <option value="Anual">Anual</option>
              </select>
            </div>
          </div>
        )}

        {/* Campo Condicional de Taxa de Implantação */}
        {formHasImplementation && (
          <div className="space-y-1.5 pt-2 animate-in fade-in slide-in-from-top-1">
            <label className="text-[10px] text-indigo-400 font-extrabold uppercase block tracking-wider flex items-center gap-1">
              <Wrench className="w-3 h-3" /> Valor da Implantação / Setup Fee (R$)
            </label>
            <div className="relative max-w-xs">
              <DollarSign className="w-4 h-4 text-indigo-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="number"
                step="any"
                value={formImplementationFee}
                onChange={(e) => setFormImplementationFee && setFormImplementationFee(e.target.value)}
                placeholder="Ex: 1500"
                className={`${inputCls} pl-9 text-indigo-300`}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── PREÇO DE VENDA, CUSTO E COMISSÃO ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className="text-[10px] text-slate-400 font-extrabold uppercase block tracking-wider">
            {formIsRecurring ? "Valor da Mensalidade (R$/mês)" : "Preço de Venda (R$)"}{" "}
            <strong className="text-rose-400">*</strong>
          </label>
          <div className="relative">
            <DollarSign className="w-4 h-4 text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="number"
              step="any"
              value={formPrice}
              onChange={(e) => setFormPrice(e.target.value)}
              placeholder="Ex: 450"
              className={`${inputCls} pl-9 text-emerald-400`}
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] text-slate-400 font-extrabold uppercase block tracking-wider">
            Custo Operacional / Aquisição (R$)
          </label>
          <div className="relative">
            <Coins className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="number"
              step="any"
              value={formCost}
              onChange={(e) => setFormCost(e.target.value)}
              placeholder="Ex: 120"
              className={`${inputCls} pl-9 text-slate-300`}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] text-slate-400 font-extrabold uppercase block tracking-wider">
            Comissão Vendedor (%)
          </label>
          <div className="relative">
            <Percent className="w-3.5 h-3.5 text-cyan-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="number"
              value={formCommission}
              onChange={(e) => setFormCommission(e.target.value)}
              placeholder="Ex: 5"
              className={`${inputCls} pl-9 text-cyan-400`}
            />
          </div>
        </div>
      </div>

      {/* ── CARD DE RENTABILIDADE E LTV CONTRATUAL ── */}
      <div className="border border-white/5 rounded-xl bg-white/[0.01] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Detalhamento de Rentabilidade & LTV
          </h5>
          {p > 0 && (
            <span
              className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${rentabilityColor}`}
            >
              {rentabilityLabel}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
          {[
            {
              label: formIsRecurring ? "Mensalidade (MRR)" : "Faturamento Bruto",
              value: `R$ ${p.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
              cls: "text-white",
            },
            {
              label: "Taxa de Implantação",
              value: formHasImplementation
                ? `R$ ${implFeeNum.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                : "Sem taxa",
              cls: formHasImplementation ? "text-indigo-400 font-bold" : "text-slate-500",
            },
            {
              label: formIsRecurring ? `Duração (${contractMonthsNum} meses)` : "Custo Origem",
              value: formIsRecurring
                ? `${contractMonthsNum} meses`
                : `-R$ ${c.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
              cls: formIsRecurring ? "text-blue-400 font-bold" : "text-rose-400",
            },
            {
              label: formIsRecurring ? "LTV Total do Contrato" : "Lucro Estimado",
              value: `R$ ${totalContractLtv.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
              cls: "text-emerald-400 font-black",
              highlight: true,
            },
          ].map((item) => (
            <div
              key={item.label}
              className={`p-3 border rounded-xl ${
                item.highlight ? "bg-[#2563EB]/5 border-[#2563EB]/20" : "bg-white/[0.015] border-white/5"
              }`}
            >
              <span className="text-[9px] text-slate-500 uppercase font-black block">{item.label}</span>
              <span className={`text-sm font-bold font-mono block mt-1 ${item.cls}`}>{item.value}</span>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-white/5 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div className="flex items-center gap-2 select-none">
            <input
              type="checkbox"
              id="taxSimulationCheck"
              checked={simulateTax}
              onChange={(e) => setSimulateTax(e.target.checked)}
              className="w-4 h-4 rounded text-[#2563EB] focus:ring-[#2563EB] bg-slate-900 border-white/20 cursor-pointer"
            />
            <label htmlFor="taxSimulationCheck" className="text-xs font-semibold text-slate-300 cursor-pointer">
              Simular imposto do Simples Nacional (8%)
            </label>
          </div>
          {p > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-white">
              <span className="text-slate-500 text-[10px] uppercase font-bold">Margem Real Líquida:</span>
              <span className="font-mono font-black text-emerald-400 text-sm">{netMarginVal}%</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
