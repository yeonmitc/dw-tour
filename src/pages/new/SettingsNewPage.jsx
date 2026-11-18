import { useState } from 'react'
import { MARKETS } from '../../config/newSystem.js'
import { listAgencies, listGlossary, listSuppliers, marketId, saveGlossary, saveMaster } from '../../features/new/api.js'
import { useAdmin } from '../../features/new/Admin.jsx'
import { Field, Notice, useRemote } from './shared.jsx'

const tabs = [['agencies','거래처'],['suppliers','협력업체'],['code_glossary','코드 뜻'],['color_glossary','색상 뜻']]

export default function SettingsNewPage() {
  const [market, setMarket] = useState('PH')
  const [tab, setTab] = useState('agencies')
  const [editing, setEditing] = useState(null)
  const [version, setVersion] = useState(0)
  const [message, setMessage] = useState('')
  const { requireAdmin } = useAdmin()
  const result = useRemote(() => tab === 'agencies' ? listAgencies(market) : tab === 'suppliers' ? listSuppliers(market) : listGlossary(tab, market), [market, tab, version])
  async function save(e) {
    e.preventDefault()
    const payload = { ...editing }
    try {
      if (!payload.id && tab !== 'color_glossary') payload.market_id = await marketId(market)
      await requireAdmin('기본 설정 변경', () => ['agencies','suppliers'].includes(tab) ? saveMaster(tab, payload) : saveGlossary(tab, payload))
      setEditing(null); setVersion(v => v + 1); setMessage('저장했습니다.')
    } catch (err) { setMessage(err.message) }
  }
  return <><div className="heading-row"><div><p className="eyebrow">확정된 업무 값</p><h1>기본 설정</h1></div><select value={market} onChange={e => setMarket(e.target.value)}>{Object.entries(MARKETS).map(([code,m]) => <option key={code} value={code}>{m.label}</option>)}</select></div>
    <div className="tab-row">{tabs.map(([key,label]) => <button key={key} className={key === tab ? 'active' : ''} onClick={() => { setTab(key); setEditing(null) }}>{label}</button>)}</div>
    {message && <p className="notice" role="status">{message}</p>}
    <section className="page-card"><button onClick={() => setEditing(tab === 'agencies' ? { name: '', aliases_json: [], active: true } : tab === 'suppliers' ? { name: '', type: 'hotel', aliases_json: [], active: true } : tab === 'code_glossary' ? { code_family: '', observed_text: '', meaning: '' } : { color_signature: '', meaning: '' })}>+ 새 항목</button>
      {editing && <form className="section-add" onSubmit={save}><h3>{editing.id ? '수정' : '새 항목'}</h3><div className="detail-grid">
        {['agencies','suppliers'].includes(tab) ? <>
          <Field label="이름"><input value={editing.name || ''} onChange={e => setEditing(x => ({ ...x, name: e.target.value }))} required /></Field>
          {tab === 'suppliers' && <Field label="종류"><select value={editing.type || 'hotel'} onChange={e => setEditing(x => ({ ...x, type: e.target.value }))}><option value="hotel">호텔</option><option value="golf">골프장</option><option value="vehicle">차량</option><option value="other">기타</option></select></Field>}
          <Field label="원본 별칭 (쉼표 구분)"><input value={(editing.aliases_json || []).join(', ')} onChange={e => setEditing(x => ({ ...x, aliases_json: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} /></Field>
        </> : tab === 'code_glossary' ? <>
          <Field label="코드 계열"><input value={editing.code_family || ''} onChange={e => setEditing(x => ({ ...x, code_family: e.target.value }))} required /></Field>
          <Field label="관찰 문자열"><input value={editing.observed_text || ''} onChange={e => setEditing(x => ({ ...x, observed_text: e.target.value }))} required /></Field>
          <Field label="의미"><input value={editing.meaning || ''} onChange={e => setEditing(x => ({ ...x, meaning: e.target.value }))} /></Field>
        </> : <><Field label="색상 서명"><input value={editing.color_signature || ''} onChange={e => setEditing(x => ({ ...x, color_signature: e.target.value }))} required /></Field>
          <Field label="의미"><input value={editing.meaning || ''} onChange={e => setEditing(x => ({ ...x, meaning: e.target.value }))} /></Field></>}
      </div><div className="actions"><button className="primary">저장</button><button type="button" onClick={() => setEditing(null)}>취소</button></div></form>}
      <Notice loading={result.loading} error={result.error} empty={!result.data?.length && '등록된 항목이 없습니다.'}>
        <div className="section-list">{(result.data || []).map(row => <article className="section-row" key={row.id}><div className="heading-row"><strong>{row.name || row.observed_text || row.color_signature}</strong><button onClick={() => setEditing(row)}>수정</button></div>
          <p>{row.type || row.code_family || row.meaning || ''} {(row.aliases_json || []).join(', ')}</p>
        </article>)}</div>
      </Notice>
    </section>
  </>
}
