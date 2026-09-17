import { useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { useLocalization } from "../../contexts/LocalizationContext";

export interface SectionNavItem {
  title: string;
  path: string;
  icon?: LucideIcon;
  /** Item ainda não implementado — some com um rótulo "Em breve" e não navega. */
  soon?: boolean;
}

export interface SectionNavGroup {
  title: string;
  icon?: LucideIcon;
  items: SectionNavItem[];
}

interface SectionSidebarProps {
  heading: string;
  subheading?: string;
  groups: SectionNavGroup[];
  children: ReactNode;
}

/**
 * Shell de navegação secundária (sidebar colapsável desktop + dropdown mobile)
 * reutilizado por toda página que precisa de uma sub-navegação própria dentro
 * do app (Configurações, Financeiro...). Antes cada uma reimplementava isso do
 * zero com pequenas divergências de active-state/collapse; agora é um único
 * padrão visual e de comportamento.
 */
export function SectionSidebar({ heading, subheading, groups, children }: SectionSidebarProps) {
  const location = useLocation();
  const { t } = useLocalization();
  const [isHidden, setIsHidden] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <div className="flex flex-col lg:flex-row h-full -m-4 md:-m-8 relative overflow-hidden">
      {isHidden && (
        <div className="absolute left-0 top-12 z-[60] hidden lg:block">
          <Button
            variant="outline"
            onClick={() => setIsHidden(false)}
            className="h-10 w-6 rounded-l-none p-0"
            title={t("Abrir menu")}
          >
            <PanelLeftOpen className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      <div
        style={{ width: isHidden ? 0 : 256, opacity: isHidden ? 0 : 1 }}
        className="hidden lg:flex shrink-0 bg-[var(--color-surface-sunken)] border-r border-[var(--color-border-default)] flex-col z-20 sticky top-0 h-full overflow-hidden transition-all duration-300 ease-in-out"
      >
        <div className="px-6 py-6 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-black text-[var(--color-text-primary)] tracking-tight">{t(heading)}</h2>
            {subheading && (
              <p className="text-[10px] text-[var(--color-text-faint)] uppercase font-bold tracking-wider mt-0.5">
                {t(subheading)}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsHidden(true)}
            className="h-7 w-7"
            title={t("Recolher menu")}
          >
            <PanelLeftClose className="w-4 h-4" />
          </Button>
        </div>

        <nav className="flex flex-col overflow-y-auto pb-10 px-2 scrollbar-none">
          {groups.map((group) => (
            <SectionGroup key={group.title} group={group} isActive={isActive} />
          ))}
        </nav>
      </div>

      <div className="lg:hidden w-full bg-[var(--color-surface-sunken)] border-b border-[var(--color-border-default)] pt-3 shrink-0 z-20 sticky top-0">
        <div className="px-4 pb-3 flex items-center justify-between">
          <h2 className="text-lg font-black text-[var(--color-text-primary)] tracking-tight">{t(heading)}</h2>
          <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen((v) => !v)} className="h-8 w-8">
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>

        {mobileMenuOpen && (
          <div className="absolute top-full left-0 right-0 bg-[var(--color-surface-elevated)] border-b border-[var(--color-border-default)] shadow-[var(--shadow-panel)] max-h-[75vh] overflow-y-auto p-4 z-40">
            {groups.map((group) => (
              <SectionGroup
                key={group.title}
                group={group}
                isActive={isActive}
                onItemClick={() => setMobileMenuOpen(false)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 sm:p-4 lg:p-8 relative min-w-0 w-full">{children}</div>
    </div>
  );
}

function SectionGroup({
  group,
  isActive,
  onItemClick,
}: {
  group: SectionNavGroup;
  isActive: (path: string) => boolean;
  onItemClick?: () => void;
}) {
  const { t } = useLocalization();
  const GroupIcon = group.icon;
  return (
    <div className="px-2 w-full mb-6 last:mb-0">
      <div className="px-4 mb-2 flex items-center gap-2 text-[11px] font-bold text-[var(--color-text-faint)] uppercase tracking-widest">
        {GroupIcon && <GroupIcon className="w-4 h-4" />}
        <span>{t(group.title)}</span>
      </div>
      <div className="space-y-0.5 flex flex-col">
        {group.items.map((item) => {
          const active = isActive(item.path);
          const ItemIcon = item.icon;
          if (item.soon) {
            return (
              <div
                key={item.path}
                title={t("Em breve")}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm font-medium rounded-[var(--radius-control)] text-[var(--color-text-faint)] border border-transparent cursor-not-allowed opacity-60"
              >
                {ItemIcon && <ItemIcon className="w-4 h-4 shrink-0" />}
                <span className="truncate w-full text-left">{t(item.title)}</span>
                <span className="text-[8px] font-bold uppercase tracking-wider shrink-0 border border-[var(--color-border-default)] rounded px-1.5 py-0.5">
                  {t("Em breve")}
                </span>
              </div>
            );
          }
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onItemClick}
              className={cn(
                "w-full flex items-center gap-2.5 px-4 py-2 text-sm font-medium rounded-[var(--radius-control)] transition-all",
                active
                  ? "bg-[var(--color-primary-blue)]/10 text-[var(--color-primary-blue)] border border-[var(--color-primary-blue)]/20"
                  : "text-[var(--color-text-muted)] border border-transparent hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)]"
              )}
            >
              {ItemIcon && <ItemIcon className="w-4 h-4 shrink-0" />}
              <span className="truncate w-full text-left">{t(item.title)}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
