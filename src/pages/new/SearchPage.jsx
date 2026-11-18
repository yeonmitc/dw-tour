import { useState } from 'react'
import { Link } from 'react-router-dom'
import { searchReservations } from '../../features/new/api.js'
import { MARKETS } from '../../config/newSystem.js'
import { Notice, formatDate, marketPath, useDebounced, useRemote } from './shared.jsx'

export default function SearchPage() {
  const [keyword, setKeyword] = useState('')
  const term = useDebounced(keyword)
  const result = useRemote(() => searchReservations(term), [term])
  return <><div className="heading-row"><div><p className="eyebrow">PH · TH · JP</p><h1>전체 검색</h1></div></div>
    <section className="page-card"><label className="field">코드 또는 손님<input autoFocus value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="검색어를 입력하세요" /></label>
      <Notice loading={result.loading} error={result.error} empty={term && !result.data?.length ? '검색 결과가 없습니다.' : null}>
        <div className="section-list">{(result.data || []).map(row => <Link className="section-row" key={row.id} to={marketPath(row.market_code, row.id)}>
          <strong>{MARKETS[row.market_code]?.label || row.market_code} · {row.reservation_code || row.original_code || '코드 없음'}</strong><p>{formatDate(row.display_date)} · {row.lead_name_raw || '손님 미확정'} · {row.agency_name || '거래처 미확정'}</p>
        </Link>)}</div>
      </Notice></section>
  </>
}
