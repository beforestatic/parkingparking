import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LanguageProvider } from './i18n/LanguageContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import App from './App'
import AdminPage from './pages/AdminPage'
import StatsPage from './pages/StatsPage'
import './index.css'

const queryClient = new QueryClient()

const path = window.location.pathname
const isAdmin = path === '/admin'
const isStats = path === '/stats'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <div className="flex w-full flex-1 flex-col min-h-0">
            {isAdmin ? <AdminPage /> : isStats ? <StatsPage /> : <App />}
          </div>
        </LanguageProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
