import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { QueryProvider } from './providers/QueryProvider.jsx'
import { useAuthBootstrap } from './features/auth/useAuthBootstrap.js'
import './index.css'

function Bootstrap() {
  useAuthBootstrap()
  return <App />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryProvider>
      <BrowserRouter>
        <Bootstrap />
      </BrowserRouter>
    </QueryProvider>
  </React.StrictMode>
)
