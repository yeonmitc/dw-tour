import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { QueryProvider } from './providers/QueryProvider.jsx'
import './index.css'

// Remove session state left by the former app before rendering the new screens.
try { localStorage.removeItem('travel-ops-auth-storage') } catch { /* storage disabled */ }
try { indexedDB.deleteDatabase('travel_ops_rq_cache_v1') } catch { /* storage disabled */ }

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryProvider>
  </React.StrictMode>
)
