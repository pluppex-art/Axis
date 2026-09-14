import { Link, useLocation } from "react-router-dom";
import { Building2, MapPin } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { useLocalization } from "../../contexts/LocalizationContext";

import { navSections, type NavReqCondition } from "./navData";
import { Logo } from "../ui/Logo";

// Predicados para itens gated por `reqCondition` (não dá pra resolver
// estaticamente em navData.ts porque dependem do usuário logado).
//
// NOTA: "master-or-gtech" ainda compara o nome do tenant — é um fix pontual
// (match exato em vez de substring, que colidia com qualquer tenant cujo nome
// contivesse "G-Tech", ex.: "G-Tech Consultoria"). O certo a prazo é uma
// permissão real (ex.: users.is_platform_staff) em vez de string, mas isso é
// uma decisão de modelagem de papel que ainda não foi tomada.
const conditionCheckers: Record<NavReqCondition, (user: ReturnType<typeof useAuth>["user"]) => boolean> = {
  "master-or-gtech": (user) => !!user?.isMaster || user?.tenantName?.trim().toLowerCase() === "g-tech master",
  "master-or-partner": (user) => !!user?.isMaster || !!user?.partnerId,
};

interface SidebarProps {
  isSidebarCollapsed: boolean;
  isMobileSidebarOpen: boolean;
  setIsMobileSidebarOpen: (isOpen: boolean) => void;
  setIsSDRWebhookOpen: (isOpen: boolean) => void;
}

export function Sidebar({
  isSidebarCollapsed,
  isMobileSidebarOpen,
  setIsMobileSidebarOpen,
  setIsSDRWebhookOpen,
}: SidebarProps) {
  const location = useLocation();
  const {
    user, isModuleEnabled, tenantIdMap,
    activeTenantId, activeTenantName, switchTenant,
    activeFilialId, switchFilial,
  } = useAuth();
  const { cargos, empresaFiliais, tenantPrimaryColor } = useData();
  const { t } = useLocalization();

  // Master vê e troca de cliente (tenant); admin do próprio tenant (ou master, dentro
  // do cliente ativo) vê e troca de filial daquele cliente.
  const tenantOptions = Object.entries(tenantIdMap).map(([name, id]) => ({ id, name }));
  const canSwitchTenant = !!user?.isMaster && tenantOptions.length > 0;
  const canSwitchFilial = !!(user?.isMaster || user?.isTenantAdmin) && empresaFiliais.length > 0;
  const userCargo = cargos.find(c => c.nome === user?.role);
  const cargoModulos: string[] | null = userCargo && Array.isArray(userCargo.modulos) && userCargo.modulos.length > 0
    ? userCargo.modulos
    : null;
  const checkModule = (mod: string) => {
    if (mod === "automotivo" || mod === "concessionaria") return isModuleEnabled("automotivo") || isModuleEnabled("concessionaria");
    if (mod === "agenda") return isModuleEnabled("agenda") || isModuleEnabled("crm");
    if (mod === "documentos") return isModuleEnabled("documentos") || isModuleEnabled("crm");
    return isModuleEnabled(mod);
  };
  const canAccessModule = (mod: string) => {
    if (user?.isMaster) return checkModule(mod);
    if (!cargoModulos) return checkModule(mod);
    return checkModule(mod) && cargoModulos.some(m => m === mod || ((mod === "automotivo" || mod === "concessionaria") && (m === "automotivo" || m === "concessionaria")));
  };

  return (
    <>
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      <aside
        className={`
        fixed inset-y-0 left-0 z-50 lg:z-30 lg:relative lg:h-full
        ${isSidebarCollapsed ? "lg:w-20" : "lg:w-68"}
        ${isMobileSidebarOpen ? "translate-x-0 w-64" : "-translate-x-full lg:translate-x-0"}
        transition-all duration-300 ease-in-out border-r border-[var(--color-border-default)] bg-[var(--color-surface)] flex flex-col shrink-0 select-none
      `}
      >
        <div className="h-20 flex items-center justify-center px-3 py-2.5 shrink-0 border-b border-[var(--color-border-subtle)]">
          <Link
            to="/app"
            className={`logo-image-container sidebar-logo-header flex items-center justify-center w-full h-full rounded-xl bg-transparent dark:bg-[var(--color-primary-blue)]/15 dark:border dark:border-[var(--color-primary-blue)]/25 dark:shadow-[0_0_20px_-6px_var(--color-primary-blue)] transition-all ${isSidebarCollapsed ? "mx-auto" : ""}`}
          >
            {isSidebarCollapsed ? (
              <div className="w-10 h-10 rounded-lg flex items-center justify-center">
                <Logo variant="icon" size={34} color={tenantPrimaryColor} />
              </div>
            ) : (
              <div className="relative w-full h-full flex items-center justify-center overflow-hidden px-2">
                <Logo variant="full" size={30} color={tenantPrimaryColor} />
              </div>
            )}
          </Link>
        </div>

        {!isSidebarCollapsed && (canSwitchTenant || canSwitchFilial) && (
          <div className="px-2 pt-2 pb-1 space-y-0.5 shrink-0">
            {canSwitchTenant ? (
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-[var(--radius-control)] hover:bg-[var(--color-surface-sunken)] transition-colors" title="Trocar de cliente (master)">
                <Building2 className="w-4 h-4 text-[var(--color-primary-blue)] shrink-0" />
                <select
                  className="appearance-none bg-transparent border-none outline-none shadow-none ring-0 text-[var(--color-text-primary)] focus:outline-none focus:ring-0 focus:shadow-none text-xs font-bold cursor-pointer w-full truncate"
                  value={activeTenantId || ""}
                  onChange={(e) => {
                    const opt = tenantOptions.find(t => t.id === e.target.value);
                    if (opt) switchTenant(opt.id, opt.name);
                  }}
                >
                  {tenantOptions.map(t => (
                    <option key={t.id} value={t.id} className="bg-[var(--color-surface)]">{t.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="text-xs text-[var(--color-text-muted)] font-bold truncate flex items-center gap-2.5 px-3 py-2">
                <Building2 className="w-4 h-4 shrink-0 text-[var(--color-text-faint)]" />
                {activeTenantName || user?.tenantName || "S.P.Y. Gestão Corporativa"}
              </div>
            )}

            {canSwitchFilial && (
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-[var(--radius-control)] hover:bg-[var(--color-surface-sunken)] transition-colors" title="Trocar de filial">
                <MapPin className="w-4 h-4 text-[var(--color-text-faint)] shrink-0" />
                <select
                  className="appearance-none bg-transparent border-none outline-none shadow-none ring-0 text-[var(--color-text-primary)] focus:outline-none focus:ring-0 focus:shadow-none text-xs font-bold cursor-pointer w-full truncate"
                  value={activeFilialId || ""}
                  onChange={(e) => {
                    const filial = empresaFiliais.find((f: any) => f.id === e.target.value);
                    switchFilial(filial ? { id: filial.id, name: filial.nome } : null);
                  }}
                >
                  <option value="" className="bg-[var(--color-surface)]">Todas as filiais</option>
                  {empresaFiliais.map((f: any) => (
                    <option key={f.id} value={f.id} className="bg-[var(--color-surface)]">{f.nome}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6 scrollbar-thin">
          {navSections
            .map((section) => {
              if (section.reqModule && !canAccessModule(section.reqModule)) {
                return null;
              }

              const visibleItems = section.items.filter((item: any) => {
                if (item.reqModule && item.reqModule !== 'master' && !canAccessModule(item.reqModule)) return false;
                if (item.reqModule === 'master' && !user?.isMaster) return false;
                if (item.reqCondition && !conditionCheckers[item.reqCondition as NavReqCondition](user)) return false;
                return true;
              });

              if (visibleItems.length === 0) return null;

              return { ...section, items: visibleItems };
            })
            .filter(Boolean)
            .map((section: any, idx) => (
              <div key={idx} className="space-y-1">
                {!isSidebarCollapsed ? (
                  <div className="px-2.5 text-[10px] font-black text-[var(--color-text-faint)] uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>{t(section.title)}</span>
                  </div>
                ) : (
                  <div className="h-2"></div>
                )}
                {section.items.map((item: any) => {
                  const isActive = item.path ? location.pathname === item.path || (item.path !== '/app/dashboard' && item.path !== '/app' && location.pathname.startsWith(item.path)) : false;

                  const btnContent = (
                    <button
                      type="button"
                      className={`w-full flex items-center ${isSidebarCollapsed ? "justify-center p-2.5" : "gap-2.5 px-3 py-2"} text-xs font-bold rounded-[var(--radius-control)] transition-all cursor-pointer border-none text-left ${
                        isActive
                          ? "bg-[var(--color-primary-blue)] !text-white font-bold shadow-md shadow-[var(--color-primary-blue)]/25"
                          : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-sunken)]"
                      }`}
                    >
                      <item.icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? "!text-white" : "text-[var(--color-text-faint)]"}`} />
                      {!isSidebarCollapsed && (
                        <span className={`truncate ${isActive ? "!text-white" : ""}`}>{t(item.name)}</span>
                      )}
                    </button>
                  );

                  if (item.action) {
                    return (
                      <div
                        key={item.name}
                        title={isSidebarCollapsed ? t(item.name) : undefined}
                        className="cursor-pointer"
                        onClick={() => {
                          if (item.action === "sdr-webhooks") setIsSDRWebhookOpen(true);
                          setIsMobileSidebarOpen(false);
                        }}
                      >
                        {btnContent}
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={item.name}
                      to={item.path}
                      title={isSidebarCollapsed ? t(item.name) : undefined}
                      onClick={() => setIsMobileSidebarOpen(false)}
                      className="block"
                    >
                      {btnContent}
                    </Link>
                  );
                })}
              </div>
            ))}
        </div>

        {!isSidebarCollapsed && (
          <div className="p-3 border-t border-[var(--color-border-default)] bg-[var(--color-surface-sunken)]/40 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-wider">
                {t("Sistema Operacional 100%")}
              </span>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
