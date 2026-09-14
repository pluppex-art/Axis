import * as React from "react"
import { cn } from "../../lib/utils"
import type { LucideIcon } from "lucide-react"
import { useLocalization } from "../../contexts/LocalizationContext"

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}

function EmptyState({ icon: Icon, title, description, action, className, ...props }: EmptyStateProps) {
  const { t } = useLocalization();
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center gap-3 py-16 px-6 rounded-[var(--radius-panel)] border border-dashed border-[var(--color-border-default)] bg-[var(--color-surface-sunken)]/40",
        className
      )}
      {...props}
    >
      {Icon && (
        <div className="w-12 h-12 rounded-full bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] flex items-center justify-center text-[var(--color-text-faint)]">
          <Icon className="w-6 h-6" />
        </div>
      )}
      <div className="space-y-1">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">{t(title)}</p>
        {description && (
          <p className="text-sm text-[var(--color-text-muted)] max-w-sm">{t(description)}</p>
        )}
      </div>
      {action}
    </div>
  )
}

export { EmptyState }
