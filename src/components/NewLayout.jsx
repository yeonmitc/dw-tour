import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAdmin } from '../features/new/Admin.jsx'
import { MARKETS } from '../config/newSystem.js'
import FxHeader from './FxHeader.jsx'

const links = [
  ['/ph/reservations', '필리핀 예약'], ['/ph/clark/vouchers', '클락 바우처'], ['/ph/cash', '필리핀 시제'],
  ['/th/reservations', '태국 예약'], ['/jp/reservations', '일본 예약'],
  ['/settlements', '정산서'], ['/search', '전체 검색'], ['/sources', '원본·검토'], ['/settings', '기본 설정'],
]

export default function NewLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const { session, signOut } = useAdmin()
  const market = Object.entries(MARKETS).find(([code]) => location.pathname.startsWith(`/${code.toLowerCase()}/`))
  return <div className="app-shell">
    <aside className={`app-sidebar ${menuOpen ? 'open' : ''}`}>
      <Link to="/ph/reservations" className="app-brand" onClick={() => setMenuOpen(false)}>DW <span>Tour</span></Link>
      <nav aria-label="주 메뉴">
        {links.map(([path, label]) => <NavLink key={path} to={path} onClick={() => setMenuOpen(false)}
          className={({ isActive }) => isActive ? 'active' : ''}>{label}</NavLink>)}
      </nav>
      {session && <button className="sidebar-logout" onClick={signOut}>관리자 로그아웃</button>}
    </aside>
    {menuOpen && <button className="menu-scrim" aria-label="메뉴 닫기" onClick={() => setMenuOpen(false)} />}
    <div className="app-content">
      <header className="app-header">
        <button className="menu-toggle" onClick={() => setMenuOpen(v => !v)} aria-label="메뉴 열기">☰</button>
        <strong>{market ? `${market[1].label} 예약` : links.find(([path]) => location.pathname.startsWith(path))?.[1] || 'DW Tour'}</strong>
        <FxHeader />
        <Link className="header-search" to="/search">⌕ 전체 검색</Link>
      </header>
      <main className="page-content"><Outlet /></main>
    </div>
  </div>
}
