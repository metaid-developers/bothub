import { Component, type ErrorInfo, type ReactNode } from 'react'
import { t } from '@/i18n'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary]', error, info.componentStack)
    }
  }

  private handleReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-hub-bg px-6 py-16 text-center">
        <h1 className="font-display text-xl font-semibold text-white">
          {t('common.somethingWrong')}
        </h1>
        <p className="mt-3 max-w-md text-sm text-hub-muted">{t('common.appCrash')}</p>
        {import.meta.env.DEV && this.state.error ? (
          <pre className="mt-4 max-w-lg overflow-auto rounded-lg border border-hub-border bg-hub-surface p-3 text-left text-xs text-red-200">
            {this.state.error.message}
          </pre>
        ) : null}
        <button
          type="button"
          onClick={this.handleReload}
          className="mt-6 rounded-xl bg-hub-accent px-5 py-2.5 text-sm font-semibold text-hub-bg hover:bg-hub-accent-hover"
        >
          {t('common.reload')}
        </button>
      </div>
    )
  }
}
