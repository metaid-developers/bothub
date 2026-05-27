import type { ReactNode } from 'react'
import { clsx } from 'clsx'

export interface EmptyStateProps {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
  className?: string
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center rounded-card border border-dashed border-hub-border bg-hub-surface/50 px-6 py-12 text-center',
        className,
      )}
      role="status"
    >
      {icon ? <div className="mb-3 text-hub-muted">{icon}</div> : null}
      <p className="font-display text-lg font-semibold text-white">{title}</p>
      {description ? (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-hub-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
