import { useEffect, useState } from 'react'
import { SETTLEMENT_COLUMNS } from '../../config/newSystem.js'
import { getReservationSection, listSettlementCells } from '../../features/new/api.js'
import { Notice, formatMoney } from './shared.jsx'

export default function SettlementModal({ reservation, onClose }) {
  const [state, setState] = useState({ loading: true, error: '', cells: [], costs: [], payments: [] })
  useEffect(() => {
    let live = true
    Promise.all([listSettlementCells(reservation.id), getReservationSection(reservation.id, 'costs'), getReservationSection(reservation.id, 'payments')])
      .then(([cells, costs, payments]) => live && setState({ loading: false, error: '', cells, costs, payments }))
      .catch(e => live && setState(s => ({ ...s, loading: false, error: e.message })))
    return () => { live = false }
  }, [reservation.id])
  useEffect(() => {
    const close = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [onClose])
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="modal-card wide" role="dialog" aria-modal="true" aria-label="정산서" onMouseDown={e => e.stopPropagation()}>
      <div className="heading-row"><div><h2>정산서</h2><p>{reservation.reservation_code || reservation.original_code || '코드 없음'} · {reservation.lead_name_raw || '대표자 미확정'}</p></div><button onClick={onClose}>닫기</button></div>
      <Notice loading={state.loading} error={state.error}>
        <h3>원본 AD:AQ</h3>
        <div className="settlement-grid">
          {SETTLEMENT_COLUMNS.map(([letter, label]) => {
            const cell = state.cells.find(c => c.coordinate.toUpperCase().startsWith(letter) && c.coordinate.slice(letter.length).match(/^\d+$/))
            return <div className="settlement-cell" key={letter} title={cell?.comment_text || ''}>
              <small>{letter} · {label}</small><strong>{cell?.raw_value ?? cell?.cached_value ?? '—'}</strong>
              {cell?.formula && <code>{cell.formula}</code>}
              {cell?.comment_text && <span className="memo-mark">메모</span>}
              {cell?.coordinate && <small>{cell.coordinate}</small>}
            </div>
          })}
        </div>
        {!state.cells.length && <p className="notice">이 예약에 연결된 원본 정산 행이 없습니다.</p>}
        <div className="detail-grid">
          <section><h3>비용</h3>{state.costs.length ? state.costs.map(c => <p key={c.id}>{c.kind}: {formatMoney(c.actual_amount ?? c.calculated_amount, c.currency)}</p>) : <p className="muted">등록된 비용 없음</p>}</section>
          <section><h3>입금·지급</h3>{state.payments.length ? state.payments.map(p => <p key={p.id}>{p.direction}: {formatMoney(p.amount, p.currency)} {p.review_state}</p>) : <p className="muted">등록된 거래 없음</p>}</section>
        </div>
      </Notice>
    </section>
  </div>
}
