import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { translations, SupportedLanguage } from "../lib/i18n/translations";

export type SupportedCurrency = "BRL" | "USD" | "EUR";

const CURRENCY_LOCALE: Record<SupportedCurrency, string> = {
  BRL: "pt-BR",
  USD: "en-US",
  EUR: "de-DE",
};

// Todo valor monetário no banco é gravado em BRL (não existe multi-moeda na
// gravação, só na exibição). A conversão usa taxas reais buscadas da API
// pública e gratuita exchangerate-api.com (via open.er-api.com, sem chave),
// com cache em localStorage para não bater na API a cada render/reload.
const RATES_CACHE_KEY = "spy_exchange_rates_v1";
const RATES_TTL_MS = 6 * 60 * 60 * 1000;
const RATES_API_URL = "https://open.er-api.com/v6/latest/BRL";

interface RatesCache {
  rates: Record<string, number>;
  timestamp: number;
}

interface LocalizationContextValue {
  language: SupportedLanguage;
  currency: SupportedCurrency;
  setLanguage: (lang: SupportedLanguage) => void;
  setCurrency: (curr: SupportedCurrency) => void;
  t: (text: string) => string;
  formatCurrency: (valueInBRL: number) => string;
  convertFromBRL: (valueInBRL: number) => number;
  ratesLoading: boolean;
  ratesStale: boolean;
}

const LocalizationContext = createContext<LocalizationContextValue | undefined>(undefined);

function readRatesCache(): RatesCache | null {
  try {
    const raw = localStorage.getItem(RATES_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function LocalizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const prefLanguage = user?.preferences?.systemPreferences?.language as SupportedLanguage | undefined;
  const prefCurrency = user?.preferences?.systemPreferences?.currency as SupportedCurrency | undefined;

  const [language, setLanguageState] = useState<SupportedLanguage>(prefLanguage || "pt-BR");
  const [currency, setCurrencyState] = useState<SupportedCurrency>(prefCurrency || "BRL");
  const [rates, setRates] = useState<Record<string, number>>(() => readRatesCache()?.rates || { BRL: 1 });
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesStale, setRatesStale] = useState(false);

  // Sincroniza com a preferência persistida (ex.: ao carregar a página ou
  // trocar de usuário) sem sobrescrever uma troca feita nesta mesma sessão.
  useEffect(() => {
    if (prefLanguage) setLanguageState(prefLanguage);
  }, [prefLanguage]);

  useEffect(() => {
    if (prefCurrency) setCurrencyState(prefCurrency);
  }, [prefCurrency]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const fetchRates = useCallback(async (force = false) => {
    const cached = readRatesCache();
    if (!force && cached && Date.now() - cached.timestamp < RATES_TTL_MS) {
      setRates(cached.rates);
      setRatesStale(false);
      return;
    }
    setRatesLoading(true);
    try {
      const res = await fetch(RATES_API_URL);
      const data = await res.json();
      if (data?.result === "success" && data.rates) {
        setRates(data.rates);
        setRatesStale(false);
        localStorage.setItem(RATES_CACHE_KEY, JSON.stringify({ rates: data.rates, timestamp: Date.now() }));
      } else {
        throw new Error("bad response");
      }
    } catch {
      // API fora do ar / offline: mantém a última cotação conhecida em cache
      // (ou 1:1 se nunca buscou nenhuma) em vez de quebrar a formatação.
      if (cached?.rates) setRates(cached.rates);
      setRatesStale(true);
    } finally {
      setRatesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRates();
    const interval = setInterval(() => fetchRates(), RATES_TTL_MS);
    return () => clearInterval(interval);
  }, [fetchRates]);

  const convertFromBRL = useCallback(
    (valueInBRL: number) => {
      if (currency === "BRL" || !Number.isFinite(valueInBRL)) return valueInBRL;
      const rate = rates[currency];
      if (!rate) return valueInBRL;
      return valueInBRL * rate;
    },
    [currency, rates]
  );

  const formatCurrency = useCallback(
    (valueInBRL: number) => {
      const converted = convertFromBRL(valueInBRL || 0);
      try {
        return new Intl.NumberFormat(CURRENCY_LOCALE[currency] || "pt-BR", {
          style: "currency",
          currency,
        }).format(converted);
      } catch {
        return `${currency} ${converted.toFixed(2)}`;
      }
    },
    [convertFromBRL, currency]
  );

  const t = useCallback(
    (text: string) => {
      if (language === "pt-BR") return text;
      return translations[language]?.[text] ?? text;
    },
    [language]
  );

  const setLanguage = useCallback((lang: SupportedLanguage) => setLanguageState(lang), []);
  const setCurrency = useCallback(
    (curr: SupportedCurrency) => {
      setCurrencyState(curr);
      fetchRates();
    },
    [fetchRates]
  );

  const value = useMemo<LocalizationContextValue>(
    () => ({ language, currency, setLanguage, setCurrency, t, formatCurrency, convertFromBRL, ratesLoading, ratesStale }),
    [language, currency, setLanguage, setCurrency, t, formatCurrency, convertFromBRL, ratesLoading, ratesStale]
  );

  return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>;
}

export function useLocalization() {
  const ctx = useContext(LocalizationContext);
  if (!ctx) throw new Error("useLocalization deve ser usado dentro de LocalizationProvider");
  return ctx;
}
