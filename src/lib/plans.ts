/**
 * Planos comerciais reais do S.P.Y. — mesmos nomes e preços exibidos na
 * landing page pública (src/pages/lp/Planos.tsx). Fonte única para o
 * provisionamento de tenants não divergir dos valores comerciais do produto.
 */
export interface SpyPlan {
  value: string;
  label: string;
  price: string;
}

export const SPY_PLANS: SpyPlan[] = [
  { value: "START", label: "Start", price: "R$ 997/mês" },
  { value: "AUTOPILOT", label: "Autopilot", price: "R$ 1.997/mês" },
  { value: "AUTONOMOUS", label: "Autonomous", price: "R$ 3.997/mês" },
  { value: "PERSONALIZADO", label: "Personalizado", price: "Negociado" },
];

export const DEFAULT_SPY_PLAN = "AUTOPILOT";
