import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CLARK_SHEETS } from '../../config/newSystem.js'
import { getVoucherEntry, listVoucherEntries, updateSectionRow } from '../../features/new/api.js'
import { Notice, formatDate, useRemote } from './shared.jsx'

export function VouchersNewPage() {
  const [sheet, setSheet] = useState(CLARK_SHEETS[0])
  const [keyword, setKeyword] = useState('')
  const result = useRemote(() => listVoucherEntries(sheet), [sheet])
  const rows = (result.data || []).filter(e => !keyword || [e.original_code,e.name_raw,e.payment_raw].some(x => String(x || '').toLocaleLowerCase().includes(keyword.toLocaleLowerCase())))
  return <>
    <div className="heading-row"><div><p className="eyebrow">필리핀 · 클락</p><h1>협력업체 바우처</h1></div></div>
    <div className="tab-row">{CLARK_SHEETS.map(name => <button key={name} className={name === sheet ? 'active' : ''} onClick={() => setSheet(name)}>{name}</button>)}</div>
    <section className="page-card"><label className="field">코드·손님 검색<input value={keyword} onChange={e => setKeyword(e.target.value)} /></label>
      <Notice loading={result.loading} error={result.error} empty={!rows.length && '해당 원본 시트의 바우처 업무 행이 없습니다.'}>
        <div className="table-scroll"><table className="excel-table"><thead><tr><th>원본 행</th><th>CODE</th><th>손님</th><th>인원 원문</th><th>지급 원문</th><th>검토</th><th></th></tr></thead><tbody>
          {rows.map(e => <tr key={e.id}><td>{e.source?.row_no ?? '—'}</td><td>{e.original_code || '—'}</td><td>{e.name_raw || '—'}</td><td>{e.pax_raw || '—'}</td><td>{e.payment_raw || '—'}</td><td>{e.review_state}</td><td><Link to={`/ph/clark/vouchers/${e.id}`}>상세 보기 →</Link></td></tr>)}
        </tbody></table></div>
      </Notice>
    </section>
  </>
}

export function VoucherDetailPage() {
  const { entryId } = useParams()
  const [version, setVersion] = useState(0)
  const result = useRemote(() => getVoucherEntry(entryId), [entryId, version])
  const entry = result.data
  return <>
    <Link className="back-link" to="/ph/clark/vouchers">← 클락 바우처</Link>
    <h1>{entry?.original_code || '바우처 업무 행'}</h1>
    <Notice loading={result.loading} error={result.error}>
      {entry && <><section className="page-card detail-grid"><div><small>원본 시트</small><p>{entry.source_rows?.source_sheets?.sheet_name || '—'} · {entry.source_rows?.row_no}행</p></div>
        <div><small>손님</small><p>{entry.name_raw || '미확정'}</p></div><div><small>지급 원문</small><p>{entry.payment_raw || '미확정'}</p></div><div><small>예약 연결</small><p>{entry.reservation_id || '미확정'}</p></div>
      </section><h2>날짜별 수배 항목</h2><div className="section-list">{entry.items.map(item => <VoucherItem key={item.id} item={item} onSaved={() => setVersion(v => v + 1)} />)}</div>
      {!entry.items.length && <p className="notice">아직 구조화된 수배 항목이 없습니다. 원본 행은 보존됩니다.</p>}</>}
    </Notice>
  </>
}

function VoucherItem({ item, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ service_date: item.service_date || '', service_time: item.service_time || '', detail_raw: item.detail_raw || '', status: item.status || '' })
  const [error, setError] = useState('')
  async function save(e) {
    e.preventDefault()
    try { await updateSectionRow('supplier_voucher_items', item.id, Object.fromEntries(Object.entries(form).map(([k,v]) => [k,v || null]))); setEditing(false); onSaved() } catch (err) { setError(err.message) }
  }
  return <article className="section-row"><div className="heading-row"><strong>{item.service_kind || '서비스'} · {formatDate(item.service_date)}</strong><button onClick={() => setEditing(v => !v)}>{editing ? '닫기' : '수정'}</button></div>
    <p>{item.detail_raw || '내용 미확정'} · {item.status || '상태 미확정'}</p>
    {editing && <form className="detail-grid" onSubmit={save}>
      <label>날짜<input type="date" value={form.service_date} onChange={e => setForm(f => ({ ...f, service_date: e.target.value }))} /></label>
      <label>시간<input type="time" value={form.service_time} onChange={e => setForm(f => ({ ...f, service_time: e.target.value }))} /></label>
      <label>내용<input value={form.detail_raw} onChange={e => setForm(f => ({ ...f, detail_raw: e.target.value }))} /></label>
      <label>상태<input value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} /></label>
      {error && <p className="error">{error}</p>}<button className="primary">저장</button>
    </form>}
  </article>
}
