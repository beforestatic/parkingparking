import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BlinkUIProvider, Toaster } from '@blinkdotnew/ui'
import { LanguageProvider } from './i18n/LanguageContext'
import App from './App'
import AdminPage from './pages/AdminPage'
import './index.css'

const queryClient = new QueryClient()

const isAdmin = window.location.pathname === '/admin'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BlinkUIProvider theme="linear" darkMode="system">
        <LanguageProvider>
          <Toaster />
          <div className="flex w-full flex-1 flex-col min-h-0">
            {isAdmin ? <AdminPage /> : <App />}
          </div>
        </LanguageProvider>
      </BlinkUIProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
