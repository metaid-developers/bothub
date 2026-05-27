import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
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

  useEffect(() => {
    if (status === 'connected') {
      void hydrateFromMetalet()
    }
  }, [hydrateFromMetalet, status])

  return children
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <WalletHydrator>
          <App />
        </WalletHydrator>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
