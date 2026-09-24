import { apiFetch } from "./apiClient";
import type { MaskedIntegration } from "./tenantIntegrations";

export interface SyncResult {
  ok: boolean;
  tenantName: string;
  data: Record<string, any>;
  syncedAt: string;
  filled: string[];
  statusRaised: string[];
  usuarios: number;
}

const JSON_HEADERS = { "Content-Type": "application/json", Accept: "application/json" };

/** Puxa dados do ambiente do cliente pra implementação (só master; o servidor exige). */
export async function syncImplementationTenant(implementationId: string, tenantId: string): Promise<{ ok: true; body: SyncResult } | { ok: false; error: string }> {
  const res = await apiFetch(`/api/implementations/${implementationId}/sync-tenant`, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ tenantId }) });
  const body = await res.json().catch(() => ({}));
  return res.ok ? { ok: true, body } : { ok: false, error: body?.error || "Não foi possível puxar os dados do ambiente." };
}

export async function fetchTenantIntegrations(implementationId: string): Promise<{ ok: true; tenantName: string; integrations: MaskedIntegration[] } | { ok: false; error: string }> {
  const res = await apiFetch(`/api/implementations/${implementationId}/tenant-integrations`, { headers: { Accept: "application/json" } });
  const body = await res.json().catch(() => ({}));
  return res.ok ? { ok: true, tenantName: body.tenantName, integrations: body.integrations } : { ok: false, error: body?.error || "Não foi possível ler as integrações do cliente." };
}

export async function saveTenantIntegration(
  implementationId: string, integration: string, values: Record<string, string>, connected: boolean
): Promise<{ ok: true; integration: MaskedIntegration } | { ok: false; error: string }> {
  const res = await apiFetch(`/api/implementations/${implementationId}/tenant-integrations/${integration}`, {
    method: "PUT", headers: JSON_HEADERS, body: JSON.stringify({ values, connected }),
  });
  const body = await res.json().catch(() => ({}));
  return res.ok ? { ok: true, integration: body.integration } : { ok: false, error: body?.error || "Não foi possível gravar a integração." };
}
