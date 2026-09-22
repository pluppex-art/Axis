import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../../../lib/supabase";
import {
  DEFAULT_BRAND_COLOR,
  applyThemeColor,
} from "../../../lib/theme";

export interface TenantOption {
  id: string;
  name: string;
  primaryColor: string;
}

interface LoginTheme {
  /** Cor primária resolvida (hex) */
  primaryColor: string;
  /** Nome do tenant identificado (ou vazio) */
  tenantName: string;
  /** true enquanto busca a cor */
  resolving: boolean;
  /** Chama quando o e-mail muda para re-resolver a cor */
  resolveFromEmail: (email: string) => void;
}

/** Tenta extrair palavras-chave do e-mail (username e domínio) */
function extractEmailTokens(email: string): string[] {
  const clean = email.trim().toLowerCase();
  const [userPart, domainPart] = clean.split("@");
  if (!userPart) return [];

  const genericTokens = new Set([
    "gmail", "hotmail", "outlook", "yahoo", "icloud", "live", "admin", "contato",
    "com", "br", "net", "org", "io", "app", "dev", "vendas", "mkt", "financeiro"
  ]);

  const userTokens = userPart.split(/[^a-z0-9]/).filter((t) => t.length >= 3 && !genericTokens.has(t));
  const domainTokens = domainPart ? domainPart.split(".").filter((t) => t.length >= 3 && !genericTokens.has(t)) : [];

  return Array.from(new Set([...userTokens, ...domainTokens]));
}

/** Tenta inferir palavras do hostname */
function extractHostTokens(host: string): string[] {
  const clean = host.toLowerCase().replace(/^https?:\/\//, "").split(":")[0];
  const parts = clean.split(".");
  const ignore = new Set(["axis", "crm", "axis-crm", "app", "dashboard", "localhost", "com", "br", "io", "net"]);
  return parts.filter((p) => p.length >= 3 && !ignore.has(p));
}

export function useLoginTheme(): LoginTheme {
  const [primaryColor, setPrimaryColor] = useState<string>(DEFAULT_BRAND_COLOR);
  const [tenantName, setTenantName] = useState<string>("");

  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [resolving, setResolving] = useState(false);
  const activeTenantsRef = useRef<TenantOption[]>([]);

  // Aplica cor nas variáveis CSS e no Favicon
  useEffect(() => {
    applyThemeColor(primaryColor, tenantName);
  }, [primaryColor, tenantName]);

  // Carrega tenants ativos e tenta detectar automaticamente por host ou query string
  useEffect(() => {
    let cancelled = false;

    async function initThemeDiscovery() {
      try {
        // 1. Busca todos os tenants ativos no Supabase
        const { data } = await supabase
          .from("tenants")
          .select("id, name, primary_color")
          .eq("status", "Active")
          .order("name");

        if (cancelled) return;

        const loadedTenants: TenantOption[] = (data || []).map((t: any) => ({
          id: t.id,
          name: t.name,
          primaryColor: t.primary_color || DEFAULT_BRAND_COLOR,
        }));

        setTenants(loadedTenants);
        activeTenantsRef.current = loadedTenants;

        if (typeof window === "undefined") return;

        // 2. Verifica se há parâmetro na URL (?tenant=... ou ?empresa=... ou ?cor=...)
        const params = new URLSearchParams(window.location.search);
        const queryTarget = (
          params.get("tenant") ||
          params.get("client") ||
          params.get("empresa") ||
          ""
        ).toLowerCase().trim();

        const queryColor = params.get("cor") || params.get("color");
        if (queryColor && /^#[0-9a-fA-F]{6}$/.test(queryColor)) {
          setPrimaryColor(queryColor);
          applyThemeColor(queryColor, queryTarget || undefined);
          return;
        }

        if (queryTarget && loadedTenants.length > 0) {
          const match = loadedTenants.find(
            (t) =>
              t.name.toLowerCase().includes(queryTarget) ||
              t.id.toLowerCase() === queryTarget
          );
          if (match) {
            setPrimaryColor(match.primaryColor);
            setTenantName(match.name);
            applyThemeColor(match.primaryColor, match.name);
            return;
          }
        }

        // 3. Verifica se o hostname atual corresponde a algum tenant (ex: axis-crm.pluppex.com.br -> pluppex)
        const hostTokens = extractHostTokens(window.location.hostname);
        if (hostTokens.length > 0 && loadedTenants.length > 0) {
          for (const token of hostTokens) {
            const match = loadedTenants.find((t) =>
              t.name.toLowerCase().includes(token)
            );
            if (match) {
              setPrimaryColor(match.primaryColor);
              setTenantName(match.name);
              applyThemeColor(match.primaryColor, match.name);
              return;
            }
          }
        }

      } catch (err) {
        console.warn("[useLoginTheme] Falha ao carregar tenants:", err);
      }
    }

    initThemeDiscovery();

    return () => {
      cancelled = true;
    };
  }, []);

  // Seleção manual de empresa
  const selectTenant = useCallback((t: TenantOption) => {
    setPrimaryColor(t.primaryColor);
    setTenantName(t.name);
    applyThemeColor(t.primaryColor, t.name);
  }, []);

  // Resolução dinâmica por e-mail com debounce de 350ms
  const resolveFromEmail = useCallback((email: string) => {
    const clean = email.trim().toLowerCase();
    if (!clean || !clean.includes("@")) return;

    let cancelled = false;
    setResolving(true);

    const timer = setTimeout(async () => {
      try {
        // A) Tenta endpoint do servidor (com service_role para consultar tabela users)
        try {
          const res = await fetch(`/api/auth/tenant-theme?email=${encodeURIComponent(clean)}`);
          if (res.ok) {
            const json = await res.json();
            if (cancelled) return;
            if (json?.primaryColor) {
              setPrimaryColor(json.primaryColor);
              setTenantName(json.tenantName || "");
              applyThemeColor(json.primaryColor, json.tenantName);
              setResolving(false);
              return;
            }
          }
        } catch {
          // Fallback se /api não estiver respondendo
        }

        if (cancelled) return;

        // B) Match local por tokens do e-mail contra os tenants carregados
        const tokens = extractEmailTokens(clean);
        const currentTenants = activeTenantsRef.current;

        for (const token of tokens) {
          const match = currentTenants.find((t) => {
            const nameLower = t.name.toLowerCase();
            return nameLower.includes(token) || token.includes(nameLower);
          });

          if (match) {
            setPrimaryColor(match.primaryColor);
            setTenantName(match.name);
            applyThemeColor(match.primaryColor, match.name);
            setResolving(false);
            return;
          }
        }
      } finally {
        if (!cancelled) setResolving(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return {
    primaryColor,
    tenantName,
    resolving,
    resolveFromEmail,
  };
}

export function persistTenantTheme(color: string, name: string) {
  if (!color) return;
  applyThemeColor(color, name);
}
