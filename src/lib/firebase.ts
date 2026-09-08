// Cliente Google Identity Services (GIS) — popup client-side, sem passar pelo
// backend. Usado originalmente só por Google Tasks (useTarefas.ts); o Google
// Calendar tentou um fluxo server-side com refresh_token em
// server/googleCalendar.ts, mas cada ambiente novo (redirect_uri, client
// secret, app não verificado) virou um ponto de falha diferente — o GIS
// popup já funciona de verdade pro usuário hoje, então Calendar passou a usar
// o mesmo mecanismo, só com escopos diferentes (ver SCOPES_CALENDAR abaixo).
// O token do GIS (implicit flow) nunca vem com refresh_token — dura só até
// expirar (~1h), não é possível ficar "conectado" para sempre sem reabrir o
// popup. Mas o token em si (e seu prazo de validade) é persistido no
// localStorage, então um reload de página dentro dessa 1h não te desconecta
// mais — só quando o token realmente expira é que é preciso conectar de novo.
declare global {
  interface Window { google: any; }
}

export const SCOPES_TASKS = [
  "https://www.googleapis.com/auth/tasks",
  "https://www.googleapis.com/auth/tasks.readonly",
  "email",
  "profile",
].join(" ");

export const SCOPES_CALENDAR = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "email",
  "profile",
].join(" ");

export interface GoogleUser {
  email: string | null;
  displayName?: string | null;
}

interface CachedToken {
  access_token: string;
  expires_at: number;
  email?: string;
}

// Chave = `${tenantId}:${scope}` — Tasks e Calendar guardam tokens
// independentes (escopos diferentes), mesmo tendo o mesmo tenant.
const cachedTokens = new Map<string, CachedToken>();
const tokenKey = (tenantId: string, scope: string) => `${tenantId}:${scope}`;
const storageKey = (key: string) => `axis_google_token:${key}`;

function persistToken(key: string, token: CachedToken) {
  try {
    localStorage.setItem(storageKey(key), JSON.stringify(token));
  } catch {
    // localStorage indisponível (modo privado, quota etc.) — o token ainda
    // funciona nesta aba via cachedTokens, só não sobrevive a um reload.
  }
}

function clearPersistedToken(key: string) {
  try {
    localStorage.removeItem(storageKey(key));
  } catch {}
}

function readPersistedToken(key: string): CachedToken | null {
  try {
    const raw = localStorage.getItem(storageKey(key));
    if (!raw) return null;
    const token = JSON.parse(raw) as CachedToken;
    if (!token?.access_token || !token?.expires_at) return null;
    if (token.expires_at <= Date.now() + 60_000) {
      clearPersistedToken(key);
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

function isGISLoaded(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.google !== "undefined" &&
    typeof window.google.accounts?.oauth2 !== "undefined"
  );
}

async function waitForGIS(maxMs = 8000): Promise<boolean> {
  if (isGISLoaded()) return true;
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      if (isGISLoaded()) { resolve(true); return; }
      if (Date.now() - start > maxMs) { resolve(false); return; }
      setTimeout(check, 150);
    };
    check();
  });
}

export const googleSignIn = async (tenantId: string, scope: string = SCOPES_TASKS): Promise<{ user: GoogleUser; accessToken: string }> => {
  const loaded = await waitForGIS();
  if (!loaded) throw new Error("Google Identity Services não carregou. Verifique sua conexão e recarregue a página.");

  const clientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID as string | undefined;
  if (!clientId) throw new Error("Credencial Google (VITE_GOOGLE_CLIENT_ID) não configurada no .env.");

  return new Promise((resolve, reject) => {
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope,
        callback: async (response: any) => {
          if (response.error) {
            if (["access_denied", "user_cancelled"].includes(response.error)) {
              reject(new Error("Acesso cancelado ou não autorizado pelo usuário no Google."));
              return;
            }
            reject(new Error(response.error_description || response.error));
            return;
          }
          const expiresAt = Date.now() + (parseInt(response.expires_in) || 3600) * 1000;
          let email: string | null = null;
          try {
            const r = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
              headers: { Authorization: `Bearer ${response.access_token}` },
            });
            if (r.ok) email = (await r.json())?.email ?? null;
          } catch {}
          const token: CachedToken = { access_token: response.access_token, expires_at: expiresAt, email: email ?? undefined };
          const key = tokenKey(tenantId, scope);
          cachedTokens.set(key, token);
          persistToken(key, token);
          resolve({ user: { email, displayName: null }, accessToken: response.access_token });
        },
        error_callback: (err: any) => {
          if (err?.type === "popup_failed_to_open") {
            reject(new Error("O navegador bloqueou a janela pop-up do Google. Permita pop-ups para este site nas opções do navegador e tente novamente."));
            return;
          }
          if (err?.type === "popup_closed") {
            reject(new Error("A janela de conexão Google foi fechada antes de autorizar."));
            return;
          }
          reject(new Error(err?.message || "Erro ao conectar conta Google. Verifique se a origem está autorizada no Google Cloud Console."));
        },
      });
      client.requestAccessToken({ prompt: "" });
    } catch (e: any) {
      reject(new Error("Falha ao inicializar autenticação Google: " + (e?.message || e)));
    }
  });
};

export const getAccessToken = async (tenantId: string, scope: string = SCOPES_TASKS): Promise<string | null> => {
  const key = tokenKey(tenantId, scope);
  let cached = cachedTokens.get(key);
  if (!cached || cached.expires_at <= Date.now() + 60_000) {
    // Ao recarregar a página, cachedTokens começa vazio (é só memória) —
    // antes de considerar desconectado, tenta reidratar do localStorage.
    const persisted = readPersistedToken(key);
    if (persisted) {
      cached = persisted;
      cachedTokens.set(key, persisted);
    }
  }
  if (cached && cached.expires_at > Date.now() + 60_000) return cached.access_token;
  cachedTokens.delete(key);
  clearPersistedToken(key);
  return null;
};

export const logout = async (tenantId: string, scope: string = SCOPES_TASKS) => {
  const key = tokenKey(tenantId, scope);
  const cached = cachedTokens.get(key) || readPersistedToken(key);
  if (cached?.access_token && isGISLoaded()) {
    try { window.google.accounts.oauth2.revoke(cached.access_token, () => {}); } catch {}
  }
  cachedTokens.delete(key);
  clearPersistedToken(key);
};

export const initAuth = (
  tenantId: string,
  onAuthSuccess?: (user: GoogleUser, token: string) => void,
  onAuthFailure?: () => void,
  scope: string = SCOPES_TASKS
): (() => void) => {
  getAccessToken(tenantId, scope).then((token) => {
    const cached = cachedTokens.get(tokenKey(tenantId, scope));
    if (token && cached) onAuthSuccess?.({ email: cached.email ?? null }, token);
    else onAuthFailure?.();
  });
  return () => {};
};
