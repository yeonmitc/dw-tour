import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminProvider } from './features/new/Admin.jsx'
import NewLayout from './components/NewLayout.jsx'

const ReservationListPage = lazy(() => import('./pages/new/ReservationListPage.jsx'))
const ReservationDetailPage = lazy(() => import('./pages/new/ReservationDetailPage.jsx'))
const VouchersNewPage = lazy(() => import('./pages/new/VouchersNewPage.jsx').then(m => ({ default: m.VouchersNewPage })))
const VoucherDetailPage = lazy(() => import('./pages/new/VouchersNewPage.jsx').then(m => ({ default: m.VoucherDetailPage })))
const CashPage = lazy(() => import('./pages/new/CashPage.jsx'))
const SettlementsPage = lazy(() => import('./pages/new/SettlementsPage.jsx'))
const SearchPage = lazy(() => import('./pages/new/SearchPage.jsx'))
const SourcesPage = lazy(() => import('./pages/new/SourcesPage.jsx'))
const SettingsNewPage = lazy(() => import('./pages/new/SettingsNewPage.jsx'))

export default function App() {
  return <AdminProvider><Suspense fallback={<div className="page-card">화면을 불러오는 중…</div>}><Routes>
    <Route element={<NewLayout />}>
      <Route path="/" element={<Navigate to="/ph/reservations" replace />} />
      {['ph','th','jp'].map(code => [
        <Route key={`${code}-list`} path={`/${code}/reservations`} element={<ReservationListPage market={code.toUpperCase()} />} />,
        <Route key={`${code}-new`} path={`/${code}/reservations/new`} element={<ReservationDetailPage market={code.toUpperCase()} />} />,
        <Route key={`${code}-detail`} path={`/${code}/reservations/:id`} element={<ReservationDetailPage market={code.toUpperCase()} />} />,
      ])}
      <Route path="/ph/clark/vouchers" element={<VouchersNewPage />} />
      <Route path="/ph/clark/vouchers/:entryId" element={<VoucherDetailPage />} />
      <Route path="/ph/cash" element={<CashPage />} />
      <Route path="/settlements" element={<SettlementsPage />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/sources" element={<SourcesPage />} />
      <Route path="/sources/:batchId" element={<SourcesPage />} />
      <Route path="/settings" element={<SettingsNewPage />} />
      <Route path="/bookings" element={<Navigate to="/ph/reservations" replace />} />
      <Route path="*" element={<div className="page-card">페이지를 찾을 수 없습니다.</div>} />
    </Route>
  </Routes></Suspense></AdminProvider>
}
