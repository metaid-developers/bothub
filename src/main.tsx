import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { useSocket } from './ws/useSocket'
import { useWallet } from './wallet/useWallet'
import './styles/globals.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

function WalletHydrator({ children }: { children: React.ReactNode }) {
  const hydrateFromMetalet = useWallet((s) => s.hydrateFromMetalet)
  const status = useWallet((s) => s.status)
  const identity = useWallet((s) => s.identity)
  const connectSocket = useSocket((s) => s.connect)
  const disconnectSocket = useSocket((s) => s.disconnect)

  useEffect(() => {
    if (status === 'connected') {
      void hydrateFromMetalet()
    }
  }, [hydrateFromMetalet, status])

  useEffect(() => {
    const gmid = identity?.globalMetaId?.trim()
    if (status === 'connected' && gmid) {
      connectSocket(gmid)
      return () => disconnectSocket()
    }
    disconnectSocket()
  }, [connectSocket, disconnectSocket, identity?.globalMetaId, status])

  return children
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <WalletHydrator>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </WalletHydrator>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
