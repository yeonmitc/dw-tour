import { useEffect, useState } from 'react'

export function useRemote(loader, deps) {
  const [state, setState] = useState({ data: null, loading: true, error: '' })
  useEffect(() => {
    let live = true
    setState(previous => ({ ...previous, loading: true, error: '' }))
    Promise.resolve().then(loader).then(data => { if (live) setState({ data, loading: false, error: '' }) })
      .catch(error => { if (live) setState(previous => ({ ...previous, loading: false, error: error.message || String(error) })) })
    return () => { live = false }
  }, deps)
  return state
}

export function Notice({ error, loading, empty, children }) {
  if (loading) return <p className="notice">불러오는 중…</p>
  if (error) return <p className="notice error" role="alert">{error}</p>
  if (empty) return <p className="notice">{empty}</p>
  return children
}

export function Field({ label, children }) { return <label className="field"><span>{label}</span>{children}</label> }
export function formatDate(value) { return value ? String(value).slice(0, 10) : '날짜 미확정' }
export function formatMoney(value, currency) { return value == null ? '미확정' : `${Number(value).toLocaleString()} ${currency || ''}` }
export function dateMonth(value) { return value ? value.slice(0, 7) : '날짜 검토' }
export function marketPath(code, id) { return `/${String(code || 'PH').toLowerCase()}/reservations/${id}` }

export function useDebounced(value, delay = 250) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => { const timer = setTimeout(() => setDebounced(value), delay); return () => clearTimeout(timer) }, [value, delay])
  return debounced
}
