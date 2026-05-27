import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  clsx(
    'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
    isActive
      ? 'bg-hub-accent/15 text-hub-accent'
      : 'text-hub-muted hover:bg-hub-surface2 hover:text-white',
  )

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-hub-bg font-body text-white">
      <header className="sticky top-0 z-20 border-b border-hub-border bg-hub-surface/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-6 px-4">
          <span className="font-display text-lg font-semibold tracking-tight">
            Bot<span className="text-hub-accent">Hub</span>
          </span>
          <nav className="flex gap-1" aria-label="Main">
            <NavLink to="/" end className={navLinkClass}>
              Bot Hub
            </NavLink>
            <NavLink to="/delivery" className={navLinkClass}>
              Delivery
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6">{children}</main>
    </div>
  )
}
