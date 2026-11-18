import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MARKETS, SETTLEMENT_COLUMNS, monthWindow } from '../../config/newSystem.js'
import { listReservations, listSettlementSummaries } from '../../features/new/api.js'
import { Notice, formatDate, useRemote } from './shared.jsx'
import SettlementModal from './SettlementModal.jsx'

export default function SettlementsPage() {
  const [market, setMarket] = useState('PH')
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState(null)
  const period = monthWindow(offset)
  const result = useRemote(() => listReservations({ code: market, from: period.from, toExclusive: period.toExclusive }), [market,period.from,period.toExclusive])
  const ids = (result.data || []).map(row => row.id)
  const summaries = useRemote(() => ids.length ? listSettlementSummaries(ids) : Promise.resolve({}), [ids.join(',')])
  return <><div className="heading-row"><div><p className="eyebrow">전체 예약 정산</p><h1>정산서</h1></div></div>
    <section className="page-card controls"><div className="filter-controls"><label>국가<select value={market} onChange={e => setMarket(e.target.value)}>{Object.entries(MARKETS).map(([code,m]) => <option key={code} value={code}>{m.label}</option>)}</select></label>
      <button onClick={() => setOffset(v => v - 1)}>‹ 한 달</button><strong>{period.label}</strong><button onClick={() => setOffset(v => v + 1)}>한 달 ›</button></div></section>
    <section className="page-card"><Notice loading={result.loading} error={result.error} empty={!result.data?.length && '이 기간에 정산 대상 예약이 없습니다.'}>
      {summaries.error && <p className="notice error">원본 정산 열을 읽지 못했습니다: {summaries.error}</p>}
      <div className="table-scroll"><table className="excel-table"><thead><tr><th>일자</th><th>국가</th><th>대표자</th>{SETTLEMENT_COLUMNS.map(([column,label]) => <th key={column}>{label}</th>)}<th>검토</th><th>상세</th></tr></thead><tbody>
        {(result.data || []).map(row => <tr key={row.id}><td>{formatDate(row.display_date)}</td><td>{market}</td><td>{row.lead_name_raw || '—'}</td>{SETTLEMENT_COLUMNS.map(([column]) => <td key={column}>{summaries.data?.[row.id]?.[column] ?? (column === 'AD' ? <Link to={`${MARKETS[market].path}/${row.id}`}>{row.reservation_code || row.original_code || '—'}</Link> : '—')}</td>)}<td>{row.review_state}</td><td><button onClick={() => setSelected(row)}>정산서 열기</button></td></tr>)}
      </tbody></table></div>
    </Notice></section>
    {selected && <SettlementModal reservation={selected} onClose={() => setSelected(null)} />}
  </>
}
