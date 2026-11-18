import { useState } from 'react'
import { listCash } from '../../features/new/api.js'
import { Notice, formatDate, formatMoney, useRemote } from './shared.jsx'

export default function CashPage() {
  const [currency, setCurrency] = useState('PHP')
  const result = useRemote(() => listCash(currency), [currency])
  return <><div className="heading-row"><div><p className="eyebrow">필리핀</p><h1>시제 장부</h1></div><select value={currency} onChange={e => setCurrency(e.target.value)}><option>PHP</option><option>KRW</option></select></div>
    <section className="page-card"><Notice loading={result.loading} error={result.error} empty={!result.data?.length && '시제 거래가 없습니다.'}>
      <div className="table-scroll"><table className="excel-table"><thead><tr><th>날짜</th><th>적요</th><th>입금</th><th>출금</th><th>원본 잔액</th></tr></thead><tbody>
        {(result.data || []).map(row => <tr key={row.id}><td>{formatDate(row.transacted_on)}</td><td>{row.description_raw || '—'}</td><td>{formatMoney(row.inflow, currency)}</td><td>{formatMoney(row.outflow, currency)}</td><td>{formatMoney(row.balance_raw, currency)}</td></tr>)}
      </tbody></table></div>
    </Notice></section>
  </>
}
