import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './index.css'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .then((registration) => {
        if (import.meta.env.DEV) {
          console.log('[PWA debug]', {
            href: window.location.href,
            baseUrl: import.meta.env.BASE_URL,
            scope: registration.scope,
          })
        }
      })
      .catch((error) => {
        console.warn('Service worker registration failed.', error)
      })
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
)
