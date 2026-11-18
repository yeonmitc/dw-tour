import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MARKETS, RESERVATION_COLUMNS, SOURCE_RESERVATION_COLUMNS, monthWindow } from '../../config/newSystem.js'
import { listAgencies, listReservationCellDetails, listReservationSourceRows, listReservations } from '../../features/new/api.js'
import { Notice, dateMonth, formatDate, marketPath, useDebounced, useRemote } from './shared.jsx'
import SettlementModal from './SettlementModal.jsx'

function readFilters(market) {
  try { return JSON.parse(sessionStorage.getItem(`reservations_${market}`) || '{}') } catch { return {} }
}

export default function ReservationListPage({ market }) {
  const navigate = useNavigate()
  const [filters, setFilters] = useState(() => readFilters(market))
  const [settlement, setSettlement] = useState(null)
  const [openMemo, setOpenMemo] = useState(null)
  const debounced = useDebounced(filters.keyword || '')
  const offset = filters.offset || 0
  const window = monthWindow(offset)
  useEffect(() => setFilters(readFilters(market)), [market])
  useEffect(() => sessionStorage.setItem(`reservations_${market}`, JSON.stringify(filters)), [market, filters])
  const result = useRemote(() => listReservations({ code: market, from: window.from, toExclusive: window.toExclusive,
    keyword: debounced, agencyId: filters.agencyId || '' }),
  [market, window.from, window.toExclusive, debounced, filters.agencyId])
  const agencies = useRemote(() => listAgencies(market), [market])
  const allRows = result.data || []
  const statusCounts = allRows.reduce((counts, row) => {
    const status = row.status?.trim() || '미지정'
    counts[status] = (counts[status] || 0) + 1
    return counts
  }, {})
  const statusOptions = ['미지정', '접수', '진행', '완료', '취소', ...Object.keys(statusCounts).filter(x => !['미지정', '접수', '진행', '완료', '취소'].includes(x))]
  const rows = filters.status ? allRows.filter(row => (row.status?.trim() || '미지정') === filters.status) : allRows
  useEffect(() => {
    if (!result.loading && result.data && filters.status && !statusCounts[filters.status]) {
      setFilters(current => ({ ...current, status: '' }))
    }
  }, [result.loading, result.data, filters.status])
  const sourceRows = useRemote(() => rows.length ? listReservationSourceRows(rows.map(r => r.id)) : Promise.resolve({}), [rows.map(r => r.id).join(',')])
  const sourceDetails = useRemote(() => sourceRows.data ? listReservationCellDetails(sourceRows.data) : Promise.resolve({ comments: {}, fills: {} }), [sourceRows.data])
  const sourceColumns = SOURCE_RESERVATION_COLUMNS[market]
  const groups = Object.entries(rows.reduce((acc, row) => {
    const key = dateMonth(row.display_date)
    ;(acc[key] ||= []).push(row)
    return acc
  }, {})).map(([month, entries]) => [month, sourceColumns ? entries.sort((a, b) => {
    const left = sourceRows.data?.[a.id]
    const right = sourceRows.data?.[b.id]
    return (left?.row_no ?? Infinity) - (right?.row_no ?? Infinity)
      || String(a.display_date).localeCompare(String(b.display_date))
  }) : entries])
  function change(patch) { setFilters(f => ({ ...f, ...patch })) }

  return <>
    <div className="heading-row"><div><p className="eyebrow">{market} · 예약 관리</p><h1>{MARKETS[market].label} 예약</h1></div><Link className="button primary" to={`${MARKETS[market].path}/new`}>+ 새 예약</Link></div>
    <section className="page-card controls">
      <div className="period-controls"><button onClick={() => change({ offset: offset - 1 })}>‹ 한 달</button><strong>{window.label}</strong><button onClick={() => change({ offset: offset + 1 })}>한 달 ›</button><button onClick={() => change({ offset: 0 })}>오늘</button></div>
      <div className="filter-controls">
        <label>상태<select value={filters.status || ''} onChange={e => change({ status: e.target.value })}><option value="">전체 ({allRows.length})</option>{statusOptions.map(x => <option key={x} value={x} disabled={!statusCounts[x]}>{x} ({statusCounts[x] || 0})</option>)}</select></label>
        <label>거래처<select value={filters.agencyId || ''} onChange={e => change({ agencyId: e.target.value })}><option value="">전체</option>{(agencies.data || []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
        <label>코드·손님 검색<input value={filters.keyword || ''} onChange={e => change({ keyword: e.target.value })} placeholder="검색어" /></label>
        <Link className="button" to="/sources">날짜 검토</Link>
      </div>
    </section>
    <Notice loading={result.loading} error={result.error} empty={!rows.length && '이 기간의 예약이 없습니다.'}>
      <p className="result-count">{rows.length.toLocaleString()}건 · {window.from}부터 {window.toExclusive} 전까지</p>
      {allRows.length > 0 && statusCounts['미지정'] === allRows.length && <p className="status-hint">이 기간의 원본 예약은 상태가 미지정입니다. 예약 상세에서 상태를 입력하면 필터에 반영됩니다.</p>}
      <div className="desktop-reservations">
        {sourceRows.error && <p className="notice error">원본 행을 불러오지 못했습니다: {sourceRows.error}</p>}
        {sourceDetails.error && <p className="notice error">원본 셀 서식을 불러오지 못했습니다: {sourceDetails.error}</p>}
        {sourceColumns && <p className="sheet-caption">{market === 'PH' ? 'NEW 2026.xlsx · 2025 MAR' : '일본 수배.xlsx · 2025 0820 시작'} · 원본 열 위치와 셀 색 · 📝 메모</p>}
        <div className="table-scroll"><table className={`excel-table ${sourceColumns ? 'source-grid' : ''}`}>
          {sourceColumns && <colgroup><col style={{ width: 54 }} />{sourceColumns.map(([letter,,width]) => <col key={letter} style={{ width: width * 8 }} />)}<col style={{ width: 76 }} /></colgroup>}
          <thead>{sourceColumns && <tr className="excel-letters"><th>#</th>{sourceColumns.map(([letter]) => <th key={letter}>{letter}</th>)}<th></th></tr>}
            <tr>{sourceColumns && <th className="row-head">행</th>}{sourceColumns ? sourceColumns.map(([letter,label]) => <th key={letter} title={`원본 ${letter}열`}>{label || '\u00a0'}</th>) : RESERVATION_COLUMNS.map(c => <th key={c.key}>{c.label}</th>)}<th>정산서</th></tr></thead>
          {groups.map(([month, entries]) => <tbody key={month}><tr className="month-divider"><th colSpan={(sourceColumns ? sourceColumns.length + 1 : RESERVATION_COLUMNS.length) + 1}>{month}</th></tr>
            {entries.map(row => <tr key={row.id} className="reservation-row" tabIndex={0} onClick={() => navigate(marketPath(market, row.id))}
              onKeyDown={e => { if (e.key === 'Enter') navigate(marketPath(market, row.id)) }}>
              {sourceColumns && <th className="row-number" scope="row">{sourceRows.data?.[row.id]?.row_no ?? '새 항목'}</th>}
              {sourceColumns ? sourceColumns.map(([letter], index) => {
                const source = sourceRows.data?.[row.id]
                const cell = sourceDetails.data?.comments?.[source?.id]?.[`${letter}${source?.row_no}`]
                const fill = sourceDetails.data?.fills?.[source?.sheet_id]?.[source?.row_no]?.find(region => region.from <= index + 1 && region.to >= index + 1)
                const color = fillColor(fill, market)
                const value = sourceValue(source?.original_json, letter, sourceColumns, cell, market) ??
                  (!source ? ({ [market === 'JP' ? 'G' : 'F']: row.reservation_code || row.original_code,
                    [market === 'JP' ? 'F' : 'E']: row.lead_name_raw, [market === 'JP' ? 'H' : 'G']: row.pax })[letter] : null)
                return <td key={letter} className={cell?.comment_text ? 'has-memo' : ''}
                  style={color ? { backgroundColor: color, color: readableText(color) } : undefined}
                  title={source ? `${source.source_sheets?.sheet_name || '원본'}!${letter}${source.row_no}` : '웹에서 새로 작성한 예약'}>
                  <span>{value ?? ''}</span>{cell?.comment_text && <button className="memo-mark" title={`${letter}${source.row_no} 메모 보기`} onClick={e => { e.stopPropagation(); setOpenMemo({ coordinate: cell.coordinate, text: cell.comment_text }) }}>📝</button>}
                </td>
              }) : RESERVATION_COLUMNS.map(c => <td key={c.key}>{c.key === 'display_date' ? formatDate(row.display_date) : row[c.key] ?? '—'}</td>)}
              <td><button onClick={e => { e.stopPropagation(); setSettlement(row) }}>정산서</button></td></tr>)}
          </tbody>)}</table></div>
      </div>
      <div className="mobile-reservations">{rows.map(row => <article className="reservation-card" key={row.id}>
        <div className="heading-row"><strong>{row.reservation_code || row.original_code || '코드 미확정'}</strong><span className="badge">{row.review_state || '검토'}</span></div>
        <p>{formatDate(row.display_date)} · {row.lead_name_raw || '대표자 미확정'} · {row.pax ?? '—'}명</p>
        <div className="actions"><Link className="button" to={marketPath(market, row.id)}>상세 보기</Link><button onClick={() => setSettlement(row)}>정산서</button></div>
      </article>)}</div>
    </Notice>
    {settlement && <SettlementModal reservation={settlement} onClose={() => setSettlement(null)} />}
    {openMemo && <div className="memo-overlay" onClick={() => setOpenMemo(null)}><section className="memo-dialog" role="dialog" aria-modal="true" aria-label={`${openMemo.coordinate} 원본 메모`} onClick={e => e.stopPropagation()}><div className="heading-row"><strong>{openMemo.coordinate} 원본 메모</strong><button onClick={() => setOpenMemo(null)}>닫기</button></div><pre>{openMemo.text}</pre></section></div>}
  </>
}

function sourceValue(raw, letter, columns, cell, market) {
  const value = Array.isArray(raw) ? raw[columns.findIndex(([column]) => column === letter)]
    : raw?.[letter] ?? raw?.cells?.[letter]
  if (value == null || value === '') return null
  if (typeof value === 'object') return value.raw_value ?? value.value ?? value.cached_value ?? null
  if (cell?.formula && !cell.cached_value) return null
  const text = String(value)
  if (/^\d{4}-\d\d-\d\d(?:T|$)/.test(text)) {
    const [, month, day] = text.slice(0, 10).split('-')
    return `${Number(month)}/${Number(day)}`
  }
  if (/^\d+(?:\.\d+)?$/.test(text) && ((market === 'PH' && letter === 'B') || (market === 'JP' && ['B', 'C'].includes(letter)))) {
    return `${market === 'JP' && letter === 'B' ? '¥' : '₩'}${Number(text).toLocaleString('en-US')}`
  }
  if (/^\d+\.0$/.test(text)) return text.slice(0, -2)
  return text
}

const THEME = {
  PH: ['#ffffff','#000000','#ffffff','#000000','#4f81bd','#c0504d','#9bbb59','#8064a2','#4bacc6','#f79646'],
  JP: ['#ffffff','#000000','#ffffff','#000000','#4285f4','#ea4335','#fbbc04','#34a853','#ff6d01','#46bdc6'],
}
function fillColor(fill, market) {
  if (!fill) return null
  let hex = fill.color_type === 'rgb' ? `#${String(fill.rgb || '').slice(-6)}` :
    fill.color_type === 'theme' ? THEME[market]?.[fill.theme] : null
  if (!hex || !/^#[\da-f]{6}$/i.test(hex)) return null
  const tint = Number(fill.tint || 0)
  if (!tint) return hex
  const channels = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
    .map(value => Math.round(tint > 0 ? value + (255 - value) * tint : value * (1 + tint)))
  return `#${channels.map(value => Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0')).join('')}`
}
function readableText(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
  return (r * 299 + g * 587 + b * 114) / 1000 < 135 ? '#fff' : '#17212b'
}
