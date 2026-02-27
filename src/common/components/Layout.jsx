import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { signOut } from '../../features/auth/authApi.js';
import { useAuthStore } from '../../store/authStore.js';
import Topbar from './Topbar.jsx';

export default function Layout() {
  const user = useAuthStore((s) => s.user);
  const nav = useNavigate();

  async function onLogout() {
    await signOut();
    nav('/login', { replace: true });
  }

  return (
    <div className="container">
      <aside className="sidebar">
        <div className="brand">DW Tour</div>
        <div style={{ color: 'var(--muted)', fontSize: 12 }}>{user?.email ?? '-'}</div>

        <div className="nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
            Dashboard
          </NavLink>
          <NavLink to="/bookings" className={({ isActive }) => (isActive ? 'active' : '')}>
            Bookings
          </NavLink>
          <NavLink to="/vouchers" className={({ isActive }) => (isActive ? 'active' : '')}>
            Golf Vouchers
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')}>
            Settings
          </NavLink>
          <NavLink to="/reports/golf" className={({ isActive }) => (isActive ? 'active' : '')}>
            Golf Report
          </NavLink>
          <NavLink to="/reports/hotel" className={({ isActive }) => (isActive ? 'active' : '')}>
            Hotel Report
          </NavLink>
        </div>

        <div style={{ marginTop: 14 }}>
          <button className="btn danger" onClick={onLogout}>
            Logout
          </button>
        </div>

        <div style={{ marginTop: 18, color: 'var(--muted)', fontSize: 12, lineHeight: 1.4 }}>
          - 느린 인터넷 대응: 캐시(Persist) 기본 탑재
          <br />- 동시 수정 대응: updated_at 가드 예시 포함
        </div>
      </aside>

      <main className="main">
        <Topbar />
        <Outlet />
      </main>
    </div>
  );
}
