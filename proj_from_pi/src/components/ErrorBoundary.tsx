import React from 'react'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: '100dvh', background: '#12141a', color: '#e5e7eb',
          fontFamily: "'Space Grotesk', 'DM Sans', sans-serif",
          padding: 32,
        }}>
          <div style={{ textAlign: 'center', maxWidth: 400 }}>
            <div style={{
              fontSize: 48, marginBottom: 16,
              filter: 'grayscale(0.3)',
            }}>⚠️</div>
            <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              Something went wrong
            </h1>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 20, lineHeight: 1.6 }}>
              {this.state.error?.message ?? 'An unexpected error occurred.'}
            </p>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload() }}
              style={{
                padding: '10px 24px', background: '#F7C12E', color: '#111',
                border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
