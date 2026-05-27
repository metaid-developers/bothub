import { clsx } from 'clsx'

function PulseBlock({ className }: { className?: string }) {
  return <div className={clsx('rounded bg-hub-surface2', className)} aria-hidden />
}

export function ServiceCardSkeleton() {
  return (
    <div
      className="animate-pulse rounded-card border border-hub-border bg-hub-surface p-4"
      aria-hidden
    >
      <div className="flex gap-3">
        <PulseBlock className="h-14 w-14 rounded-xl" />
        <div className="flex-1 space-y-2">
          <PulseBlock className="h-4 w-3/4" />
          <PulseBlock className="h-3 w-1/2" />
          <PulseBlock className="h-8 w-full" />
        </div>
      </div>
      <PulseBlock className="mt-4 h-10 rounded-xl" />
    </div>
  )
}

export function ServiceListSkeleton({
  count = 4,
  className,
  label,
}: {
  count?: number
  className?: string
  label: string
}) {
  return (
    <div
      className={clsx('grid gap-4 md:grid-cols-2', className)}
      aria-busy="true"
      aria-label={label}
    >
      {Array.from({ length: count }, (_, i) => (
        <ServiceCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function ServiceDetailSkeleton({ label }: { label: string }) {
  return (
    <div className="animate-pulse space-y-4 p-1" aria-busy="true" aria-label={label}>
      <div className="flex gap-3">
        <PulseBlock className="h-16 w-16 rounded-xl" />
        <div className="flex-1 space-y-2">
          <PulseBlock className="h-5 w-3/4" />
          <PulseBlock className="h-3 w-1/2" />
        </div>
      </div>
      <PulseBlock className="h-24 rounded-xl" />
      <PulseBlock className="h-28 rounded-xl" />
    </div>
  )
}

export function SessionRowSkeleton() {
  return (
    <div
      className="animate-pulse rounded-card border border-hub-border bg-hub-surface/60 px-3 py-3"
      aria-hidden
    >
      <PulseBlock className="h-4 w-2/3" />
      <PulseBlock className="mt-2 h-3 w-full" />
      <PulseBlock className="mt-2 h-3 w-1/3" />
    </div>
  )
}

export function SessionsListSkeleton({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-1" aria-busy="true" aria-label={label}>
      {Array.from({ length: 3 }, (_, i) => (
        <SessionRowSkeleton key={i} />
      ))}
    </div>
  )
}
