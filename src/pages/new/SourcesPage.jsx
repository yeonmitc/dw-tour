import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { listBatches, listReviewIssues, listSourceCells, listSourceRows,
  listSourceSheets, listSourceStyles, resolveReviewIssue } from '../../features/new/api.js'
import { useAdmin } from '../../features/new/Admin.jsx'
import { Notice, useRemote } from './shared.jsx'

export default function SourcesPage() {
  const { batchId } = useParams()
  const [sheetId, setSheetId] = useState('')
  const [fromRow, setFromRow] = useState(1)
  const [rowId, setRowId] = useState('')
  const [version, setVersion] = useState(0)
  const [message, setMessage] = useState('')
  const { requireAdmin } = useAdmin()
  const batches = useRemote(listBatches, [])
  const sheets = useRemote(() => batchId ? listSourceSheets(batchId) : Promise.resolve([]), [batchId])
  const rows = useRemote(() => sheetId ? listSourceRows(sheetId, fromRow) : Promise.resolve([]), [sheetId, fromRow])
  const cells = useRemote(() => rowId ? listSourceCells(rowId) : Promise.resolve([]), [rowId])
  const styles = useRemote(() => sheetId ? listSourceStyles(sheetId) : Promise.resolve([]), [sheetId])
  const issues = useRemote(listReviewIssues, [version])

  async function resolve(issue) {
    const note = window.prompt(`${issue.issue_type} · ${issue.source_ref || ''}\n확정 근거를 입력하세요.`)
    if (!note?.trim()) return
    try { await requireAdmin('원본 검토 확정', () => resolveReviewIssue(issue.id, { note: note.trim() }, issue.row_version)); setVersion(v => v + 1); setMessage('검토 결과를 저장했습니다.') }
    catch (e) { setMessage(e.message) }
  }

  return <><div className="heading-row"><div><p className="eyebrow">엑셀 원문 보존</p><h1>원본·검토</h1></div></div>
    {message && <p className="notice" role="status">{message}</p>}
    <section className="page-card"><h2>가져오기 배치</h2><Notice loading={batches.loading} error={batches.error} empty={!batches.data?.length && '아직 가져온 파일이 없습니다.'}>
      <div className="section-list">{(batches.data || []).map(batch => <Link className="section-row" key={batch.id} to={`/sources/${batch.id}`}>
        <strong>{batch.source_file_name}</strong><p>{batch.state} · {batch.imported_at?.slice(0, 19).replace('T',' ')}</p>
      </Link>)}</div>
    </Notice></section>
    {batchId && <section className="page-card"><h2>시트·원본 행</h2><Notice loading={sheets.loading} error={sheets.error}>
      <div className="tab-row">{(sheets.data || []).map(s => <button key={s.id} className={s.id === sheetId ? 'active' : ''} onClick={() => { setSheetId(s.id); setFromRow(1); setRowId('') }}>{s.sheet_name}</button>)}</div>
      {sheetId && <><div className="heading-row"><span>행 {fromRow}–{fromRow + 49}</span><div className="actions"><button disabled={fromRow <= 1} onClick={() => setFromRow(Math.max(1, fromRow - 50))}>이전</button><button onClick={() => setFromRow(fromRow + 50)}>다음</button></div></div>
        <Notice loading={rows.loading} error={rows.error} empty={!rows.data?.length && '이 범위에 원본 행이 없습니다.'}>
          <div className="source-rows">{(rows.data || []).map(r => <button key={r.id} className={r.id === rowId ? 'active' : ''} onClick={() => setRowId(r.id)}>{r.row_no}행 · {r.row_kind}</button>)}</div>
        </Notice>
        {rowId && <><h3>셀 원문·메모</h3><Notice loading={cells.loading} error={cells.error} empty={!cells.data?.length && '값 또는 메모가 있는 셀이 없습니다.'}>
          <div className="source-cells">{(cells.data || []).map(c => <article className="source-cell" key={c.id}><strong>{c.coordinate}</strong><p>{c.raw_value ?? '빈 값'}</p>{c.formula && <code>{c.formula}</code>}{c.cached_value && <small>저장 계산값: {c.cached_value}</small>}{c.comment_text && <blockquote>{c.comment_text}</blockquote>}</article>)}</div>
        </Notice></>}
        <details><summary>색상·서식 영역 ({styles.data?.length || 0})</summary><Notice loading={styles.loading} error={styles.error}>
          <div className="source-rows">{(styles.data || []).map(s => <span key={s.id}>{s.range_ref} · {s.rgb || s.theme || s.indexed || '색상 미확정'}</span>)}</div>
        </Notice></details>
      </>}
    </Notice></section>}
    <section className="page-card"><h2>검토 항목</h2><Notice loading={issues.loading} error={issues.error} empty={!issues.data?.length && '검토 항목이 없습니다.'}>
      <div className="section-list">{(issues.data || []).map(issue => <article className="section-row" key={issue.id}><div className="heading-row"><strong>{issue.issue_type} · {issue.source_ref || '좌표 미확정'}</strong><span className="badge">{issue.state}</span></div>
        <p>{issue.raw_text || '원문 없음'}</p>{issue.state !== 'resolved' && <button onClick={() => resolve(issue)}>근거 입력·확정</button>}
      </article>)}</div>
    </Notice></section>
  </>
}
