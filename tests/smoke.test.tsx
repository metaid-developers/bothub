import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from '@/App'

function renderApp(initialPath = '/') {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('App smoke', () => {
  it('shows main tabs and connect wallet on Bot Hub route', () => {
    renderApp('/')
    expect(screen.getByRole('link', { name: 'Bot Hub' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Delivery' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '连接钱包' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Bot Hub' })).toBeInTheDocument()
  })

  it('navigates to Delivery route', () => {
    renderApp('/delivery')
    expect(screen.getByRole('heading', { name: 'Delivery' })).toBeInTheDocument()
  })
})
