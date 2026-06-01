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
    expect(screen.getByRole('link', { name: '服务广场' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '我的交付' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '连接钱包' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '可下单服务' })).toBeInTheDocument()
  })

  it('navigates to Delivery route', () => {
    renderApp('/delivery')
    expect(screen.getByRole('heading', { name: '我的交付' })).toBeInTheDocument()
  })
})
