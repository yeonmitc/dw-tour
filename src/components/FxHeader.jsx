import { useEffect, useState } from 'react'
import { listFxRates } from '../features/new/api.js'
import { supabase } from '../lib/supabase.js'

const currencies = [['USD', 1], ['PHP', 1], ['JPY', 100]]

export default function FxHeader() {
  const [rates, setRates] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  async function load() {
    try { setRates(await listFxRates()); setError('') } catch { setError('환율 연결 대기') }
  }
  useEffect(() => { load() }, [])
  async function refresh() {
    if (busy) return
    setBusy(true)
    try {
      const { error: invokeError } = await supabase.functions.invoke('refresh-fx-rates')
      if (invokeError) throw invokeError
      await load()
    } catch (e) { setError(e.message || '새로고침 실패') } finally { setBusy(false) }
  }
  return <div className="fx-widget">
    <button className="fx-toggle" onClick={() => setOpen(v => !v)}>환율 {open ? '접기' : '보기'}</button>
    <div className={`fx-values ${open ? 'open' : ''}`}>
      {currencies.map(([currency, unit]) => {
        const row = rates.find(r => r.currency === currency)
        return <span key={currency} title={row ? `고시 ${row.source_quoted_at || '미확인'} · 조회 ${row.fetched_at}` : '서버 설정 대기'}>
          {currency} {unit} = {row ? `₩${Number(row.krw_amount).toLocaleString()}` : '—'}
        </span>
      })}
      <button onClick={refresh} disabled={busy} title="서버에서 네이버 환율 재확인">{busy ? '확인 중' : '↻'}</button>
      {error && <small>{error}</small>}
    </div>
  </div>
}
