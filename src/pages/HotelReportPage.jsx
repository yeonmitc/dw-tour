import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useBranchFilter } from '../features/auth/useBranchFilter.js';
import { useBookingsList } from '../features/bookings/bookingsHooks.js';
import { listHotelReport } from '../features/reports/reportsApi.js';
import { useAuthStore } from '../store/authStore.js';

export default function HotelReportPage() {
  const { branch: branchFilter } = useBranchFilter();
  const profile = useAuthStore((s) => s.profile);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selectedHotels, setSelectedHotels] = useState([]);
  const [selectedPartners, setSelectedPartners] = useState([]);

  const effectiveBranch = branchFilter === 'ALL' ? (profile?.branch ?? 'ALL') : branchFilter;

  const {
    data: rows = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['hotel-report', { from, to, selectedHotels, selectedPartners, effectiveBranch }],
    queryFn: () =>
      listHotelReport({
        from: from || undefined,
        to: to || undefined,
        hotels: selectedHotels,
        partners: selectedPartners,
        branch: effectiveBranch,
      }),
  });

  const { data: bookings = [] } = useBookingsList({
    branch: effectiveBranch,
  });

  const hotelOptions = Array.from(new Set(rows.map((r) => r.hotel_name).filter(Boolean))).sort();
  const partnerOptions = Array.from(
    new Set(bookings.map((b) => b.partner_code).filter(Boolean))
  ).sort();

  const handleToggleHotel = (name) => {
    setSelectedHotels((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const handleTogglePartner = (code) => {
    setSelectedPartners((prev) =>
      prev.includes(code) ? prev.filter((n) => n !== code) : [...prev, code]
    );
  };

  const totalAmount = rows.reduce((sum, r) => sum + (Number(r.total_amount) || 0), 0);

  return (
    <div style={{ padding: 16 }}>
      <div
        style={{
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          justifyContent: 'space-between',
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700 }}>Hotel / Villa Report</div>
        <div style={{ color: 'var(--muted)', fontSize: 12 }}>
          Branch: {effectiveBranch === 'ALL' ? 'ALL' : effectiveBranch}
        </div>
      </div>

      <div
        style={{
          marginBottom: 16,
          padding: 12,
          borderRadius: 8,
          border: '1px solid var(--line)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12 }}>기간</span>
          <input
            type="date"
            className="input"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            style={{ height: 30, fontSize: 12 }}
          />
          <span>~</span>
          <input
            type="date"
            className="input"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            style={{ height: 30, fontSize: 12 }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12 }}>호텔 / 풀빌라</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 260 }}>
            {hotelOptions.map((name) => {
              const active = selectedHotels.length === 0 || selectedHotels.includes(name);
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => handleToggleHotel(name)}
                  style={{
                    borderRadius: 16,
                    padding: '2px 8px',
                    fontSize: 11,
                    border: '1px solid var(--line)',
                    background: active ? 'var(--accent)' : 'transparent',
                    color: active ? '#fff' : 'var(--text)',
                    cursor: 'pointer',
                  }}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12 }}>파트너</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 260 }}>
            {partnerOptions.map((code) => {
              const active = selectedPartners.length === 0 || selectedPartners.includes(code);
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => handleTogglePartner(code)}
                  style={{
                    borderRadius: 16,
                    padding: '2px 8px',
                    fontSize: 11,
                    border: '1px solid var(--line)',
                    background: active ? 'var(--accent)' : 'transparent',
                    color: active ? '#fff' : 'var(--text)',
                    cursor: 'pointer',
                  }}
                >
                  {code}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div
        style={{
          borderRadius: 8,
          border: '1px solid var(--line)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: 8,
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 12,
            background: 'var(--chip)',
          }}
        >
          <div>Rows: {rows.length}</div>
          <div>
            TOTAL AMOUNT:{' '}
            <span style={{ fontWeight: 700 }}>
              {totalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} PHP
            </span>
          </div>
        </div>

        <div style={{ maxHeight: '65vh', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ padding: '4px 8px', borderBottom: '1px solid var(--line)' }}>
                  예약 날짜
                </th>
                <th style={{ padding: '4px 8px', borderBottom: '1px solid var(--line)' }}>
                  예약코드
                </th>
                <th style={{ padding: '4px 8px', borderBottom: '1px solid var(--line)' }}>내역</th>
                <th style={{ padding: '4px 8px', borderBottom: '1px solid var(--line)' }}>가격</th>
                <th style={{ padding: '4px 8px', borderBottom: '1px solid var(--line)' }}>
                  인원/룸
                </th>
                <th style={{ padding: '4px 8px', borderBottom: '1px solid var(--line)' }}>비고</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} style={{ padding: 12, textAlign: 'center', fontSize: 12 }}>
                    Loading...
                  </td>
                </tr>
              )}
              {error && !isLoading && (
                <tr>
                  <td colSpan={7} style={{ padding: 12, textAlign: 'center', fontSize: 12 }}>
                    {error.message}
                  </td>
                </tr>
              )}
              {!isLoading && !error && rows.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: 12, textAlign: 'center', fontSize: 12 }}>
                    결과가 없습니다.
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const unit = r.unit_count || 1;
                const rate = Number(r.unit_price ?? 0);
                return (
                  <tr key={r.id}>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--line)' }}>
                      {r.check_in}
                    </td>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--line)' }}>
                      {r.booking_code}
                    </td>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--line)' }}>
                      {r.hotel_name} {r.customer_name}
                    </td>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--line)' }}>
                      {rate ? rate.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '-'}
                    </td>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--line)' }}>
                      {(r.pax ?? '-') + ' / ' + unit}
                    </td>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--line)' }}>-</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
