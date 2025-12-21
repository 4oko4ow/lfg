import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Toaster } from 'react-hot-toast'
import { BrowserRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from './i18n.ts'
import { AuthProvider } from './context/AuthContext.tsx'
import { OnlineCountProvider } from './context/OnlineCountContext.tsx'



createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>


      <AuthProvider>
        <OnlineCountProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </OnlineCountProvider>
      </AuthProvider>
    </I18nextProvider>
    <Toaster position="top-right" />
  </StrictMode>,
)
