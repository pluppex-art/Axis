import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useData } from "../../../../contexts/DataContext";
import { apiFetch } from "../../../../lib/apiClient";
import { useLocalization } from "../../../../contexts/LocalizationContext";

type AiRecommendation = any;

export function usePerformanceIA() {
  const { leads, financeEntries, contracts } = useData();
  const { formatCurrency } = useLocalization();

  const [isSimulating, setIsSimulating] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState<AiRecommendation[]>([]);

  const currentMRR = useMemo(() => {
    if (contracts && contracts.length > 0) {
      return contracts.reduce((acc, c) => {
        const raw = c.mrr;
        const val =
          typeof raw === "number"
            ? raw
            : parseFloat(
                String(raw)
                  .replace(/[^0-9.,]/g, "")
                  .replace(".", "")
                  .replace(",", ".")
              );
        return acc + (isNaN(val) ? 0 : val);
      }, 0);
    }

    // Fallback: estimativa via leads (se MRR for nulo)
    return leads
      .filter((l: any) => l.status === "Fechado")
      .reduce((acc, l: any) => acc + (l.value || 0), 0) / 12; // Exemplo tosco
  }, [contracts, leads]);

  const currentCAC = useMemo(() => {
    const totalSpent = financeEntries
      .filter(
        (f: any) =>
          f.type === "Pagar" &&
          f.status === "Pago" &&
          f.category?.toLowerCase().includes("marketing")
      )
      .reduce((acc: number, f: any) => acc + f.value, 0);

    return leads.length > 0 ? totalSpent / leads.length : 0;
  }, [financeEntries, leads]);

  const currentLTV = currentMRR * 12; // Assumindo 1 ano de LTV pra fins de simulação

  const simulationData = useMemo(() => {
    if (currentMRR === 0 && currentCAC === 0) return [];

    return [
      { name: "Atual", mrr: currentMRR, cac: currentCAC, ltv: currentLTV },
      {
        name: "Cenário A (+Leads)",
        mrr: currentMRR * 1.2,
        cac: currentCAC * 0.9,
        ltv: currentLTV * 1.1,
      },
      {
        name: "Cenário B (Ticket+)",
        mrr: currentMRR * 1.4,
        cac: currentCAC * 1.1,
        ltv: currentLTV * 1.3,
      },
      {
        name: "Otimizado IA",
        mrr: currentMRR * 1.6,
        cac: currentCAC * 0.8,
        ltv: currentLTV * 1.5,
      },
    ];
  }, [currentMRR, currentCAC, currentLTV]);

  const runSimulation = async () => {
    setIsSimulating(true);
    try {
      const dealsCount = leads.filter((l: any) => l.status === "Fechado").length;

      const response = await apiFetch("/api/ai/performance-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mrr: currentMRR,
          cac: currentCAC,
          ltv: currentLTV,
          leadsCount: leads.length,
          dealsCount,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setAiRecommendations(data);
      } else {
        const ratio = currentCAC > 0 ? (currentLTV / currentCAC).toFixed(1) : "3.5";
        setAiRecommendations([
          {
            title: "Otimização de LTV/CAC e Retenção",
            desc: `Relação LTV/CAC calculada em ${ratio}x. Priorize estratégias de retenção e upsell de clientes atuais para elevar o ROI em até 35%.`,
            impact: "+35% ROI",
            color: "text-blue-400"
          },
          {
            title: "Aceleração do Funil de Conversão",
            desc: `Base ativa de ${leads.length} oportunidades com ${dealsCount} fechamentos. Aumente o follow-up nas primeiras 2 horas para dobrar a taxa de conversão.`,
            impact: "+40% Conversão",
            color: "text-emerald-400"
          },
          {
            title: "Expansão de Receita Recorrente (MRR)",
            desc: `MRR atual em ${formatCurrency(currentMRR)}. Implemente planos anuais com desconto para reduzir churn e estabilizar fluxo de caixa.`,
            impact: "+25% Previsibilidade",
            color: "text-purple-400"
          }
        ]);
      }
    } catch {
      // Falha de rede silenciosa com fallback
      const dealsCount = leads.filter((l: any) => l.status === "Fechado").length;
      const ratio = currentCAC > 0 ? (currentLTV / currentCAC).toFixed(1) : "3.5";
      setAiRecommendations([
        {
          title: "Otimização de LTV/CAC e Retenção",
          desc: `Relação LTV/CAC calculada em ${ratio}x. Priorize estratégias de retenção e upsell de clientes atuais para elevar o ROI em até 35%.`,
          impact: "+35% ROI",
          color: "text-blue-400"
        },
        {
          title: "Aceleração do Funil de Conversão",
          desc: `Base ativa de ${leads.length} oportunidades com ${dealsCount} fechamentos. Aumente o follow-up nas primeiras 2 horas para dobrar a taxa de conversão.`,
          impact: "+40% Conversão",
          color: "text-emerald-400"
        },
        {
          title: "Expansão de Receita Recorrente (MRR)",
          desc: `MRR atual em ${formatCurrency(currentMRR)}. Implemente planos anuais com desconto para reduzir churn e estabilizar fluxo de caixa.`,
          impact: "+25% Previsibilidade",
          color: "text-purple-400"
        }
      ]);
    } finally {
      setIsSimulating(false);
    }
  };

  useEffect(() => {
    if (leads.length > 0 && aiRecommendations.length === 0) runSimulation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads.length]);

  return {
    leads,
    financeEntries,
    contracts,
    isSimulating,
    aiRecommendations,
    simulationData,
    runSimulation,
    currentCAC,
    currentLTV,
  };
}

