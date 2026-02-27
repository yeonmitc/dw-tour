import { useMemo } from 'react'
import { useBookingsList } from '../features/bookings/bookingsHooks.js'
import { useVouchersList } from '../features/vouchers/vouchersHooks.js'
import { useUiStore } from '../store/uiStore.js'
import { todayISO, addDaysISO } from '../utils/date.js'
import Loading from '../common/components/Loading.jsx'
import ErrorState from '../common/components/ErrorState.jsx'

export default function DashboardPage() {
  const branch = useUiStore(s => s.branch)
  const keyword = useUiStore(s => s.keyword)

  const today = todayISO()
  const weekEnd = addDaysISO(today, 7)

  const bookingsQ = useBookingsList({ branch, keyword, from: today, to: weekEnd, status: 'ALL' })
  const vouchersQ = useVouchersList({ branch, keyword, from: today, to: weekEnd, status: 'ALL' })

  const metrics = useMemo(() => {
    const bookings = bookingsQ.data ?? []
    const vouchers = vouchersQ.data ?? []
    const finalBookings = bookings.filter(b => b.status === 'FINAL')
    const newBookings = bookings.filter(b => b.status === 'NEW')
    const paidBookings = bookings.filter(b => b.paid_status === 'PAID')

    const finalVouchers = vouchers.filter(v => v.status === 'FINAL')
    const newVouchers = vouchers.filter(v => v.status === 'NEW')
    const paidVouchers = vouchers.filter(v => v.paid_status === 'PAID')

    return {
      b_total: bookings.length,
      b_final: finalBookings.length,
      b_new: newBookings.length,
      b_paid: paidBookings.length,
      v_total: vouchers.length,
      v_final: finalVouchers.length,
      v_new: newVouchers.length,
      v_paid: paidVouchers.length
    }
  }, [bookingsQ.data, vouchersQ.data])

  if (bookingsQ.isLoading || vouchersQ.isLoading) return <Loading label="Loading dashboard..." />
  if (bookingsQ.error) return <ErrorState title="Bookings load error" error={bookingsQ.error} />
  if (vouchersQ.error) return <ErrorState title="Vouchers load error" error={vouchersQ.error} />

  return (
    <div className="grid">
      <div className="card" style={{ gridColumn: 'span 3' }}>
        <h3>Bookings (Next 7 days)</h3>
        <div className="metric">{metrics.b_total}</div>
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>Final {metrics.b_final} / New {metrics.b_new}</div>
      </div>
      <div className="card" style={{ gridColumn: 'span 3' }}>
        <h3>Bookings Paid</h3>
        <div className="metric">{metrics.b_paid}</div>
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>Paid status = PAID</div>
      </div>
      <div className="card" style={{ gridColumn: 'span 3' }}>
        <h3>Vouchers (Next 7 days)</h3>
        <div className="metric">{metrics.v_total}</div>
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>Final {metrics.v_final} / New {metrics.v_new}</div>
      </div>
      <div className="card" style={{ gridColumn: 'span 3' }}>
        <h3>Vouchers Paid</h3>
        <div className="metric">{metrics.v_paid}</div>
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>Paid status = PAID</div>
      </div>

      <div className="card" style={{ gridColumn: 'span 12' }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>오늘/주간 운영용 기준</div>
        <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.5 }}>
          - “오늘 Final” = status 변경이력 기반이 이상적이지만, MVP에서는 status=FINAL 필터로 사용<br/>
          - 다중 사용자 동시 수정은 Booking/Voucher 업데이트 시 updated_at 가드로 기본 충돌 방지<br/>
          - 느린 인터넷은 Query 캐시(Persist) + 최소 컬럼 select + staleTime 확대가 가장 체감 큼
        </div>
      </div>
    </div>
  )
}
