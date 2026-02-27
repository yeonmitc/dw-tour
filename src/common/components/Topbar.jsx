import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useUiStore } from '../../store/uiStore.js'
import { useIsFetching, useIsMutating } from '@tanstack/react-query'

export default function Topbar() {
  const branch = useUiStore(s => s.branch)
  const keyword = useUiStore(s => s.keyword)
  const setBranch = useUiStore(s => s.setBranch)
  const setKeyword = useUiStore(s => s.setKeyword)
  const fetching = useIsFetching()
  const mutating = useIsMutating()

  const loc = useLocation()
  const nav = useNavigate()

  const title = useMemo(() => {
    if (loc.pathname.startsWith('/bookings')) return 'Bookings'
    if (loc.pathname.startsWith('/vouchers')) return 'Golf Vouchers'
    if (loc.pathname.startsWith('/settings')) return 'Settings'
    return 'Dashboard'
  }, [loc.pathname])

  function onSearchKeyDown(e) {
    if (e.key !== 'Enter') return
    // 간단 규칙: 검색은 현재 페이지에서만 반영 (store로 공유)
    // 필요하면 URL q= 로도 확장 가능
  }

  return (
    <div className="topbar">
      <div className="left">
        <div style={{ fontWeight: 800 }}>{title}</div>
        <span className="badge">{fetching ? `Sync ${fetching}` : 'Synced'}{mutating ? ` / Saving ${mutating}` : ''}</span>
      </div>
      <div className="right">
        <select className="select" value={branch} onChange={(e) => setBranch(e.target.value)}>
          <option value="ALL">All Branches</option>
          <option value="PHILIPPINES">Philippines</option>
          <option value="CHIANGMAI">Chiang Mai</option>
          <option value="FUKUOKA">Fukuoka</option>
        </select>

        <input
          className="input"
          placeholder="Search (partner / name / code)"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={onSearchKeyDown}
        />
        <button className="btn" onClick={() => nav(0)}>Refresh</button>
      </div>
    </div>
  )
}
