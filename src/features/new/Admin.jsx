import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase.js'

const AdminContext = createContext(null)

export function AdminProvider({ children }) {
  const [session, setSession] = useState(null)
  const [prompt, setPrompt] = useState(null)
  const pending = useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  function requireAdmin(reason, action) {
    if (session) return action()
    return new Promise((resolve, reject) => {
      pending.current = { action, resolve, reject }
      setPrompt(reason)
    })
  }

  async function confirm(password) {
    const email = import.meta.env.VITE_SUPABASE_ADMIN_EMAIL
    if (!email) throw new Error('VITE_SUPABASE_ADMIN_EMAIL 설정이 필요합니다.')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    const task = pending.current
    pending.current = null
    setPrompt(null)
    try { task?.resolve(await task?.action()) } catch (e) { task?.reject(e) }
  }

  function cancel() {
    pending.current?.reject(new Error('관리자 인증이 취소됐습니다.'))
    pending.current = null
    setPrompt(null)
  }

  async function signOut() {
    await supabase.auth.signOut()
    setSession(null)
  }

  return <AdminContext.Provider value={{ session, requireAdmin, signOut }}>
    {children}
    {prompt && <AdminModal reason={prompt} onConfirm={confirm} onCancel={cancel} />}
  </AdminContext.Provider>
}

export function useAdmin() {
  const value = useContext(AdminContext)
  if (!value) throw new Error('AdminProvider is missing')
  return value
}

function AdminModal({ reason, onConfirm, onCancel }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try { await onConfirm(password) } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
    <form className="modal-card" role="dialog" aria-modal="true" aria-label="관리자 권한" onMouseDown={e => e.stopPropagation()} onSubmit={submit}>
      <h2>관리자 권한 필요</h2>
      <p>{reason}</p>
      <label>관리자 비밀번호<input autoFocus type="password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="actions"><button type="button" onClick={onCancel}>취소</button><button className="primary" disabled={busy}>확인 후 계속</button></div>
    </form>
  </div>
}
