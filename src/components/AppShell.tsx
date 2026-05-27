import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'
import { WalletConnectButton } from '@/components/WalletConnectButton'

const tabClass = ({ isActive }: { isActive: boolean }) =>
  clsx(
    'relative px-4 py-4 text-sm font-semibold transition-colors',
    isActive ? 'text-white' : 'text-hub-muted hover:text-white',
  )

function TabIndicator({ isActive }: { isActive: boolean }) {
  if (!isActive) return null
  return (
    <span
      className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-hub-accent"
      aria-hidden
    />
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-hub-bg font-body text-white">
      <header className="sticky top-0 z-20 border-b border-hub-border bg-hub-surface/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1600px] items-stretch justify-between px-4">
          <nav className="flex items-stretch gap-1" aria-label="Main">
            <NavLink to="/" end className={tabClass}>
              {({ isActive }) => (
                <>
                  Bot Hub
                  <TabIndicator isActive={isActive} />
                </>
              )}
            </NavLink>
            <NavLink to="/delivery" className={tabClass}>
              {({ isActive }) => (
                <>
                  Delivery
                  <TabIndicator isActive={isActive} />
                </>
              )}
            </NavLink>
          </nav>
          <div className="flex items-center">
            <WalletConnectButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6">{children}</main>
    </div>
  )
}
