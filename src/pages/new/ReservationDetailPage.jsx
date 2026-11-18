import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { MARKETS, SOURCE_RESERVATION_COLUMNS, suggestCode } from '../../config/newSystem.js'
import { addSectionRow, createReservation, getReservation, getReservationSection, listAgencies,
  getReservationSourceSnapshot, marketId, softDeleteReservation, updateReservation, updateSectionRow } from '../../features/new/api.js'
import { useAdmin } from '../../features/new/Admin.jsx'
import { Field, Notice, formatDate, formatMoney, useRemote } from './shared.jsx'

const tabs = [
  ['itinerary', '일정'], ['people', '손님 명단'], ['costs', '비용'],
  ['payments', '입금·지급'], ['events', '변경 이력'], ['sources', '원본 출처'],
]
const sectionSchemas = {
  itinerary: { table: 'itinerary_items', fields: [['item_type','서비스 종류'],['service_date','서비스 날짜','date'],['service_time','시간','time'],['detail_raw','원문·내용'],['location_raw','지역'],['pax','인원','number']] },
  people: { table: 'reservation_people', fields: [['name_raw','원문 이름'],['name_en','영문 이름'],['role','역할'],['room_note','객실 메모']] },
  costs: { table: 'cost_lines', fields: [['kind','비용 종류'],['currency','통화'],['unit_price','단가','number'],['quantity','수량','number'],['actual_amount','실제 금액','number'],['formula_raw','원본 수식']] },
  payments: { table: 'payment_transactions', fields: [['direction','방향'],['amount','금액','number'],['currency','통화'],['effective_date','날짜','date'],['note_raw','메모']] },
}

export default function ReservationDetailPage({ market }) {
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()
  const { requireAdmin } = useAdmin()
  const [row, setRow] = useState(null)
  const [form, setForm] = useState({ reservation_code: '', lead_name_raw: '', pax: '', start_date: '', end_date: '', status: '', agency_id: '' })
  const [codeFields, setCodeFields] = useState({ productCode: '', partnerCode: '', firstHotelName: '' })
  const [codeMode, setCodeMode] = useState('manual')
  const [tab, setTab] = useState('itinerary')
  const [version, setVersion] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const agencies = useRemote(() => listAgencies(market), [market])
  const section = useRemote(() => id ? getReservationSection(id, tab) : Promise.resolve([]), [id, tab, version])
  const sourceSnapshot = useRemote(() => id ? getReservationSourceSnapshot(id) : Promise.resolve({ source: null, cells: {} }), [id])
  const source = sourceSnapshot.data?.source
  const sourceCells = sourceSnapshot.data?.cells || {}
  const sourceLetter = market === 'JP' ? { note: 'F', code: 'G', pax: 'H', days: ['P', 'Q', 'R', 'S'] }
    : { note: 'E', code: 'F', pax: 'G', days: ['O', 'R', 'U', 'X', 'AA'] }

  useEffect(() => {
    if (isNew) { setRow(null); setForm({ reservation_code: '', lead_name_raw: '', pax: '', start_date: '', end_date: '', status: '', agency_id: '' }); return }
    let live = true
    getReservation(id).then(data => {
      if (!live) return
      setRow(data)
      setForm(Object.fromEntries(['reservation_code','lead_name_raw','pax','start_date','end_date','status','agency_id'].map(k => [k, data[k] ?? ''])))
      if (data.code_entry_mode) setCodeMode(data.code_entry_mode)
    }).catch(e => live && setMessage(e.message))
    return () => { live = false }
  }, [id, isNew])

  const suggestion = suggestCode({ ...codeFields, baseDate: form.start_date, pax: form.pax })
  function change(key, value) { setForm(f => ({ ...f, [key]: value })) }
  async function save(e) {
    e.preventDefault(); setBusy(true); setMessage('')
    try {
      const payload = {
        reservation_code: form.reservation_code.trim() || null,
        lead_name_raw: form.lead_name_raw.trim() || null,
        pax: form.pax === '' ? null : Number(form.pax),
        start_date: form.start_date || null, end_date: form.end_date || null,
        status: form.status || null, agency_id: form.agency_id || null,
      }
      if (isNew) {
        const created = await createReservation({ ...payload, market_id: await marketId(market), code_entry_mode: codeMode })
        navigate(`${MARKETS[market].path}/${created.id}`, { replace: true })
      } else {
        const updated = await updateReservation(id, row.row_version, payload)
        setRow(updated)
        setMessage('저장했습니다.')
      }
    } catch (err) { setMessage(err.message) } finally { setBusy(false) }
  }
  async function remove() {
    if (!row) return
    const code = row.reservation_code || row.original_code || row.id
    if (!window.confirm(`${code} · ${row.lead_name_raw || '손님 미확정'} 예약을 삭제 처리할까요?`)) return
    const reason = window.prompt('삭제 사유를 입력하세요.')
    if (!reason?.trim()) return
    try {
      await requireAdmin('예약 삭제', () => softDeleteReservation(row.id, row.row_version, reason.trim()))
      navigate(MARKETS[market].path)
    } catch (e) { setMessage(e.message) }
  }

  return <>
    <div className="heading-row"><div><Link className="back-link" to={MARKETS[market].path}>← {MARKETS[market].label} 목록</Link><h1>{isNew ? '새 예약' : '예약 상세'}</h1></div>{!isNew && <span className="badge">버전 {row?.row_version ?? '—'}</span>}</div>
    {message && <p className={message.includes('저장') ? 'notice success' : 'notice error'} role="status">{message}</p>}
    <form className="page-card detail-form" onSubmit={save}>
      {!isNew && source && <div className="source-context"><strong>엑셀 원본: {source.source_sheets?.sheet_name} · {source.row_no}행</strong><span>아래 입력란은 웹 예약 관리값입니다. 원본 셀과 메모는 아래 “원본 출처”에서 확인할 수 있습니다.</span></div>}
      <div className="detail-grid">
        <Field label="국가"><input value={MARKETS[market].label} disabled /></Field>
        {source && <Field label={`원본 ${sourceLetter.note}${source.row_no} · 내용 / 비고 / 거래처 (읽기 전용)`}><input className="source-readonly" value={source.original_json?.[sourceLetter.note] || ''} readOnly /></Field>}
        <Field label="대표자 · 웹 관리값"><input value={form.lead_name_raw} onChange={e => change('lead_name_raw', e.target.value)} placeholder="원본 비고에서 대표자를 확인 후 입력" /></Field>
        <Field label={`CODE · ${source ? `원본 ${sourceLetter.code}${source.row_no} 대응` : '예약 코드'}`}><input value={form.reservation_code} onChange={e => { change('reservation_code', e.target.value); setCodeMode('manual') }} placeholder="수기 입력 가능" /></Field>
        <Field label={`PAX · ${source ? `원본 ${sourceLetter.pax}${source.row_no} 대응` : '인원'}`}><input type="number" min="0" value={form.pax} onChange={e => change('pax', e.target.value)} /></Field>
        <Field label="행사 시작일 · 코드에서 해석한 날짜"><input type="date" value={form.start_date} onChange={e => change('start_date', e.target.value)} /></Field>
        <Field label="행사 종료일 · 웹 관리값"><input type="date" value={form.end_date} onChange={e => change('end_date', e.target.value)} /></Field>
        <Field label="거래처 · 웹 관리값"><select value={form.agency_id} onChange={e => change('agency_id', e.target.value)}><option value="">미확정</option>{(agencies.data || []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
        <Field label="예약 상태 · 웹 관리값"><input value={form.status} onChange={e => change('status', e.target.value)} placeholder="미확정이면 비워 둠" /></Field>
      </div>
      {isNew && <div className="code-suggestion"><h3>신규 코드 추천</h3><div className="detail-grid">
        <Field label="상품 접두어"><input value={codeFields.productCode} onChange={e => setCodeFields(f => ({ ...f, productCode: e.target.value }))} /></Field>
        <Field label="거래처 코드"><input value={codeFields.partnerCode} onChange={e => setCodeFields(f => ({ ...f, partnerCode: e.target.value }))} /></Field>
        <Field label="첫 호텔"><input value={codeFields.firstHotelName} onChange={e => setCodeFields(f => ({ ...f, firstHotelName: e.target.value }))} /></Field>
      </div><div className="actions"><code>{suggestion || '입력 후 추천 코드 표시'}</code><button type="button" disabled={!suggestion} onClick={() => { change('reservation_code', suggestion); setCodeMode('suggested') }}>추천 코드 사용</button></div></div>}
      <div className="actions"><button className="primary" disabled={busy}>{busy ? '저장 중…' : '예약 저장'}</button>{!isNew && <button type="button" className="danger" onClick={remove}>삭제</button>}</div>
    </form>
    {!isNew && <>
      <div className="tab-row" role="tablist">{tabs.map(([key,label]) => <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}</div>
      <section className="page-card"><Notice loading={section.loading} error={section.error} empty={!section.data?.length && `${tabs.find(x => x[0] === tab)?.[1]} 항목이 없습니다.`}>
        {tab === 'sources' && sourceSnapshot.error && <p className="notice error">원본 셀을 불러오지 못했습니다: {sourceSnapshot.error}</p>}
        <div className="section-list">{tab === 'sources' ? <SourceSnapshot source={source} cells={sourceCells} market={market} /> : (section.data || []).map(item => <SectionRow key={item.id || item.source_row_id} item={item} tab={tab} source={source} sourceCells={sourceCells} dayColumns={sourceLetter.days} onSaved={() => setVersion(v => v + 1)} />)}</div>
      </Notice>
      {sectionSchemas[tab] && <SectionAdd tab={tab} reservationId={id} onSaved={() => setVersion(v => v + 1)} />}
      </section>
    </>}
  </>
}

function SectionRow({ item, tab, source, sourceCells, dayColumns, onSaved }) {
  const schema = sectionSchemas[tab]
  const sourceColumn = tab === 'itinerary' && source && dayColumns?.find(letter => String(source.original_json?.[letter] || '').trim() === String(item.detail_raw || '').trim())
  const sourceCoordinate = sourceColumn ? `${sourceColumn}${source.row_no}` : null
  const sourceMemo = sourceCoordinate ? sourceCells[sourceCoordinate]?.comment_text : null
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [error, setError] = useState('')
  async function save(e) {
    e.preventDefault(); setError('')
    try { await updateSectionRow(schema.table, item.id, form); setEditing(false); onSaved() } catch (err) { setError(err.message) }
  }
  if (editing && schema) return <form className="section-row" onSubmit={save}>
    {sourceCoordinate && <p className="source-context">{sourceCoordinate} 원본 일정에 연결된 웹 관리 항목 수정</p>}
    <div className="detail-grid">{schema.fields.map(([key,label,type]) => <Field key={key} label={key === 'detail_raw' && sourceCoordinate ? `${sourceCoordinate} 대응 · ${label}` : label}><input type={type || 'text'} value={form[key] ?? ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value || null }))} /></Field>)}</div>
    {sourceMemo && <div className="linked-memo"><strong>📝 {sourceCoordinate} 원본 메모</strong><pre>{sourceMemo}</pre></div>}
    {error && <p className="error">{error}</p>}<div className="actions"><button className="primary">저장</button><button type="button" onClick={() => setEditing(false)}>취소</button></div>
  </form>
  if (tab === 'sources') return <article className="section-row"><strong>{item.source_rows?.source_sheets?.sheet_name || '원본 시트'} · {item.source_rows?.row_no}행</strong><p>{item.link_state}</p></article>
  if (tab === 'events') return <article className="section-row"><strong>{item.event_kind}</strong><p>{formatDate(item.created_at)} · {item.note_raw || '변경 기록'}</p></article>
  return <article className="section-row"><div className="heading-row"><strong>{sourceCoordinate ? `${sourceCoordinate} · 원본 일정` : item.item_type || item.name_raw || item.kind || item.direction || '항목'}</strong>{schema && <button onClick={() => { setForm(Object.fromEntries(schema.fields.map(([key]) => [key, item[key] ?? '']))); setEditing(true) }}>수정</button>}</div>
    <p>{item.detail_raw || item.room_note || item.note_raw || item.location_raw || ''}</p>
    {sourceMemo && <div className="linked-memo"><strong>📝 {sourceCoordinate} 원본 메모</strong><pre>{sourceMemo}</pre></div>}
    <small>{item.service_date || item.effective_date || ''} {item.amount != null ? formatMoney(item.amount, item.currency) : ''}</small>
  </article>
}

function SourceSnapshot({ source, cells, market }) {
  if (!source) return <p>연결된 엑셀 원본 행이 없습니다.</p>
  const labels = Object.fromEntries((SOURCE_RESERVATION_COLUMNS[market] || []).map(([letter, label]) => [letter, label.replace(/\n/g, ' ')]))
  const letters = [...new Set([...Object.keys(source.original_json || {}), ...Object.keys(cells).filter(coordinate => cells[coordinate].comment_text).map(coordinate => coordinate.match(/^[A-Z]+/)?.[0])])]
    .filter(Boolean).sort((a, b) => columnNumber(a) - columnNumber(b))
  return <div className="source-snapshot"><p>{source.source_sheets?.sheet_name} · {source.row_no}행 원본 값과 메모</p><div className="source-snapshot-grid">{letters.map(letter => {
    const coordinate = `${letter}${source.row_no}`
    const cell = cells[coordinate]
    const value = source.original_json?.[letter]
    return <article key={coordinate}><strong>{coordinate} · {labels[letter] || '원본 셀'}</strong><p>{value && !String(value).startsWith('=') ? String(value) : cell?.cached_value || '빈 셀'}</p>{cell?.comment_text && <div className="linked-memo"><strong>📝 원본 메모</strong><pre>{cell.comment_text}</pre></div>}</article>
  })}</div></div>
}

function columnNumber(letter) { return [...letter].reduce((n, char) => n * 26 + char.charCodeAt(0) - 64, 0) }

function SectionAdd({ tab, reservationId, onSaved }) {
  const schema = sectionSchemas[tab]
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({})
  const [error, setError] = useState('')
  async function save(e) {
    e.preventDefault(); setError('')
    try {
      const payload = Object.fromEntries(Object.entries(form).filter(([,v]) => v !== '' && v != null))
      await addSectionRow(schema.table, { ...payload, reservation_id: reservationId })
      setOpen(false); setForm({}); onSaved()
    } catch (err) { setError(err.message) }
  }
  if (!open) return <button onClick={() => setOpen(true)}>+ {tabs.find(x => x[0] === tab)?.[1]} 추가</button>
  return <form className="section-add" onSubmit={save}><h3>새 항목</h3><div className="detail-grid">
    {schema.fields.map(([key,label,type]) => <Field key={key} label={label}><input type={type || 'text'} value={form[key] ?? ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} /></Field>)}
  </div>{error && <p className="error">{error}</p>}<div className="actions"><button className="primary">추가</button><button type="button" onClick={() => setOpen(false)}>취소</button></div></form>
}
