// Cliente do frontend para a integração Google Calendar. NENHUM token Google
// (access_token/refresh_token) passa por este arquivo, por localStorage ou
// por qualquer outro estado do browser — toda credencial fica no backend
// (server/googleCalendar.ts), que é quem de fato fala com o Google. Aqui só
// chamamos as rotas /api/google-calendar/* (autenticadas via apiFetch, que
// anexa o JWT da sessão Supabase) e devolvemos dados já sanitizados.
//
// tenantId é sempre o tenant ATIVO no momento da chamada (activeTenantId do
// useAuth()) — mandado como header pro backend decidir se aceita (via
// has_tenant_access) ou ignora; nunca é usado aqui pra decidir o que mostrar
// na tela sem round-trip ao servidor.
import { apiFetch } from "./apiClient";

export interface GoogleCalendarStatus {
  connected: boolean;
  email: string | null;
  status: string;
  lastSyncAt: string | null;
  calendarId: string | null;
}

export interface GoogleCalendarRedirectResult {
  status: "connected" | "error";
  reason?: string;
}

function tenantHeaders(tenantId: string): HeadersInit {
  return { "x-active-tenant-id": tenantId };
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    return body?.error || fallback;
  } catch {
    return fallback;
  }
}

export async function getGoogleCalendarStatus(tenantId: string): Promise<GoogleCalendarStatus> {
  try {
    const res = await apiFetch("/api/google-calendar/status", { headers: tenantHeaders(tenantId) });
    if (!res.ok) return { connected: false, email: null, status: "disconnected", lastSyncAt: null, calendarId: null };
    return await res.json();
  } catch {
    return { connected: false, email: null, status: "disconnected", lastSyncAt: null, calendarId: null };
  }
}

// Redireciona a página inteira pro consentimento do Google (fluxo OAuth
// "authorization code" de verdade — não é mais o token client implícito do
// Google Identity Services, que nunca conseguia devolver refresh_token).
// Ao voltar, o backend redireciona de volta pra `returnTo` com
// ?google_calendar=connected|error — ver consumeGoogleCalendarRedirectResult.
export async function connectGoogleCalendar(tenantId: string, returnTo?: string): Promise<void> {
  const params = new URLSearchParams();
  if (returnTo) params.set("returnTo", returnTo);
  const qs = params.toString();
  const res = await apiFetch(`/api/google-calendar/connect/start${qs ? `?${qs}` : ""}`, {
    headers: tenantHeaders(tenantId),
  });
  if (!res.ok) throw new Error(await readError(res, "Não foi possível iniciar a conexão com o Google."));
  const { url } = await res.json();
  window.location.href = url;
}

export async function disconnectGoogleCalendar(tenantId: string): Promise<void> {
  const res = await apiFetch("/api/google-calendar/disconnect", { method: "POST", headers: tenantHeaders(tenantId) });
  if (!res.ok) throw new Error(await readError(res, "Não foi possível desconectar a conta Google."));
}

export interface GoogleSyncResult {
  imported: number;
  updated: number;
}

export async function syncGoogleCalendar(tenantId: string, range?: { timeMin?: string; timeMax?: string }): Promise<GoogleSyncResult> {
  const res = await apiFetch("/api/google-calendar/sync", {
    method: "POST",
    headers: { ...tenantHeaders(tenantId), "Content-Type": "application/json" },
    body: JSON.stringify(range || {}),
  });
  if (!res.ok) throw new Error(await readError(res, "Erro ao sincronizar com o Google Calendar."));
  return res.json();
}

// Lê o resultado do redirect de volta do /oauth/callback (?google_calendar=
// connected|error&reason=...) e limpa a URL, sem deixar o parâmetro preso no
// histórico do navegador.
export function consumeGoogleCalendarRedirectResult(): GoogleCalendarRedirectResult | null {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const status = url.searchParams.get("google_calendar");
  if (status !== "connected" && status !== "error") return null;
  const reason = url.searchParams.get("reason") || undefined;
  url.searchParams.delete("google_calendar");
  url.searchParams.delete("reason");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  return { status, reason };
}

export function formatGoogleCalendarError(reason?: string): string {
  if (!reason) return "Não foi possível conectar ao Google Calendar.";

  if (reason.startsWith("token_exchange_failed")) {
    const detail = reason.split(":")[1];
    if (detail === "redirect_uri_mismatch") {
      return "URL de redirecionamento divergente. Verifique se https://axis-crm.pluppex.com.br/api/google-calendar/oauth/callback está cadastrada nos 'URIs de redirecionamento autorizados' no Google Cloud Console.";
    }
    if (detail === "invalid_client") {
      return "Credencial do Google inválida. Verifique GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no servidor (Easypanel) e garanta que o cliente OAuth seja do tipo 'Aplicativo da Web'.";
    }
    if (detail === "invalid_grant") {
      return "O código de autorização expirou ou já foi utilizado. Tente conectar novamente.";
    }
    if (detail === "unauthorized_client") {
      return "Cliente OAuth não autorizado para este fluxo. Verifique se o tipo no Google Cloud Console é 'Aplicativo da Web'.";
    }
    return `Falha na troca de tokens com o Google (${detail || "verifique GOOGLE_CLIENT_SECRET e deploy do servidor"}).`;
  }

  switch (reason) {
    case "missing_refresh_token":
      return "O Google não retornou o token permanente. Remova o acesso ao Axis na sua Conta Google (Segurança > Apps de terceiros) e tente conectar novamente.";
    case "access_denied":
      return "Acesso cancelado na tela de login do Google.";
    case "invalid_state":
      return "Sessão de autenticação expirou. Tente novamente.";
    case "missing_code":
      return "Nenhum código de autorização recebido do Google.";
    case "save_failed":
      return "Falha ao gravar conexão no banco de dados. Tente novamente.";
    default:
      return `Não foi possível conectar ao Google: ${reason}`;
  }
}
