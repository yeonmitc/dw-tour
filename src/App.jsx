import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './common/components/Layout.jsx'
import LoginPage from './pages/LoginPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import BookingsPage from './pages/BookingsPage.jsx'
import BookingDetailPage from './pages/BookingDetailPage.jsx'
import VouchersPage from './pages/VouchersPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import GolfReportPage from './pages/GolfReportPage.jsx'
import HotelReportPage from './pages/HotelReportPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import { useAuthStore } from './store/authStore.js'

function Protected({ children }) {
  const session = useAuthStore(s => s.session)
  if (!session) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="bookings" element={<BookingsPage />} />
        <Route path="bookings/:id" element={<BookingDetailPage />} />
        <Route path="vouchers" element={<VouchersPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="reports/golf" element={<GolfReportPage />} />
        <Route path="reports/hotel" element={<HotelReportPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
