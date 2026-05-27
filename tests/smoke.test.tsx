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
  it('shows BotHub header and Bot Hub route', () => {
    renderApp('/')
    expect(screen.getByText(/BotHub/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Bot Hub' })).toBeInTheDocument()
  })

  it('navigates to Delivery route', () => {
    renderApp('/delivery')
    expect(screen.getByRole('heading', { name: 'Delivery' })).toBeInTheDocument()
  })
})
