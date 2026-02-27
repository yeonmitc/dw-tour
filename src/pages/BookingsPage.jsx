import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ErrorState from '../common/components/ErrorState.jsx';
import Loading from '../common/components/Loading.jsx';
import { useBranchFilter } from '../features/auth/useBranchFilter.js';
import { updateBooking, upsertBookingDayItem } from '../features/bookings/bookingsApi.js';
import { useBookingsList } from '../features/bookings/bookingsHooks.js';

const STATUS_OPTIONS = [
  'ALL',
  'NEW',
  'REQUESTED',
  'CONFIRMED',
  'DEPOSIT',
  'INPROGRESS',
  'GUID_PAY',
  'CLOSED',
  'CANCLE',
  'CHANGE_INFO',
];

// Styles for Excel Grid (Dark Mode Compatible)
const gridStyle = {
  th: {
    background: 'var(--chip)', // Darker background
    color: 'var(--muted)',
    fontWeight: 'bold',
    fontSize: '12px', // Slightly larger
    padding: '6px 8px',
    border: '1px solid var(--line)',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    height: '36px',
  },
  td: {
    padding: '6px 8px',
    fontSize: '12px',
    border: '1px solid var(--line)',
    whiteSpace: 'nowrap',
    color: 'inherit',
    height: '36px',
    verticalAlign: 'middle',
  },
  statusBadge: (status) => ({
    background:
      status === 'FINAL'
        ? 'rgba(233, 30, 99, 0.2)' // Pink
        : status === 'CANCELLED'
          ? 'rgba(231, 76, 60, 0.2)' // Red
          : 'rgba(241, 196, 15, 0.2)', // Yellow (Default/New)
    color: status === 'FINAL' ? '#e91e63' : status === 'CANCELLED' ? '#e74c3c' : '#f1c40f',
    padding: '2px 6px',
    borderRadius: '4px',
    fontWeight: 'bold',
    fontSize: '10px',
    display: 'inline-block',
  }),
  paidBadge: (status) => {
    if (status === 'PAID') {
      return {
        border: '1px solid var(--good)',
        color: 'var(--good)',
        padding: '1px 4px',
        borderRadius: '4px',
        fontSize: '10px',
        fontWeight: 'bold',
      };
    }
    if (status === 'PARTIAL') {
      return {
        border: '1px solid rgba(241, 196, 15, 0.5)',
        color: '#f1c40f',
        padding: '1px 4px',
        borderRadius: '4px',
        fontSize: '10px',
        fontWeight: 'bold',
      };
    }
    return {
      border: '1px solid var(--warn)',
      color: 'var(--warn)',
      padding: '1px 4px',
      borderRadius: '4px',
      fontSize: '10px',
      fontWeight: 'bold',
    };
  },
  statusTag: (label, color, bg) => ({
    background: bg,
    color: color,
    padding: '4px 8px',
    borderRadius: '6px',
    fontWeight: '800',
    fontSize: '11px',
    display: 'inline-block',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  }),
};

const getStatusTag = (row) => {
  // 1. Cancelled (CANCLE)
  if (row.status === 'CANCLE')
    return { label: 'cancle', color: '#e74c3c', bg: 'rgba(231, 76, 60, 0.1)' };

  // 2. Closed (Completed)
  if (row.status === 'CLOSED')
    return { label: 'closed', color: '#95a5a6', bg: 'rgba(149, 165, 166, 0.1)' };

  // 3. In Progress (INPROGRESS) - Change Verification Complete (Royal Blue)
  if (row.status === 'INPROGRESS') return { label: 'inprogress', color: '#fff', bg: '#4169e1' };

  // 4. Confirmed (CONFIRMED)
  if (row.status === 'CONFIRMED')
    return { label: 'confirmed', color: '#2ecc71', bg: 'rgba(46, 204, 113, 0.1)' };

  // 5. Deposit (DEPOSIT)
  if (row.status === 'DEPOSIT')
    return { label: 'deposit', color: '#9b59b6', bg: 'rgba(155, 89, 182, 0.1)' };

  // 6. Requested (REQUESTED) - Change Verification Needed (Red)
  if (row.status === 'REQUESTED') return { label: 'requested', color: '#e74c3c', bg: '#fff' };

  // 7. New
  if (row.status === 'NEW')
    return { label: 'new', color: '#f1c40f', bg: 'rgba(241, 196, 15, 0.25)' };

  // 8. Guid Pay (Settlement Complete - Green)
  if (row.status === 'GUID_PAY') return { label: 'guid_pay', color: '#fff', bg: '#2ecc71' };

  // 9. Change Info
  if (row.status === 'CHANGE_INFO') return { label: 'change info', color: '#e74c3c', bg: '#fff' };

  // Fallback
  return { label: row.status, color: '#7f8c8d', bg: 'rgba(127, 140, 141, 0.1)' };
};

const getRowBackground = (status) => {
  // if (status === 'CHANGE_INFO') return 'rgba(231, 76, 60, 0.1)'; // Red 10%
  // if (status === 'REQUESTED') return 'rgba(231, 76, 60, 0.1)'; // Red 10% - Removed as per user request
  // if (status === 'INPROGRESS') return 'rgba(65, 105, 225, 0.1)'; // Royal Blue 10%
  // if (status === 'GUID_PAY') return 'rgba(46, 204, 113, 0.1)'; // Green 10%
  // if (status === 'CANCLE') return 'rgba(192, 57, 43, 0.1)'; // Dark Red 10%
  // if (status === 'CLOSED') return 'rgba(127, 140, 141, 0.1)'; // Gray 10%
  return 'transparent';
};

const getDailyCellBackground = (row, dayIndex) => {
  const scheduleText = row[`${dayIndex}TH`] || '';
  const changeTee = String(scheduleText).includes('>>');
  const payStatus = row[`pay_status_${dayIndex}`];
  const dailyMemo = row[`memo_${dayIndex}`];
  const changeTeeFlag = row[`change_tee_time_${dayIndex}`];

  if (changeTee || changeTeeFlag) return 'rgba(231, 76, 60, 0.1)'; // Red 10%
  if (payStatus === 'PAID') return 'rgba(46, 204, 113, 0.1)'; // Green 10%
  const HIGHLIGHT_KEYWORDS = ['투어로', '썬벨리', '코라이', '뉴아시아'];
  if (HIGHLIGHT_KEYWORDS.some((k) => String(scheduleText).includes(k)))
    return 'rgba(241, 196, 15, 0.1)'; // Yellow 10%
  if (dailyMemo) return 'rgba(255, 165, 0, 0.1)'; // Orange 10%
  return 'transparent';
};

const getCurrencyByBranch = (branch) => {
  if (branch === 'PHILIPPINES') return 'PHP';
  if (branch === 'CHIANGMAI') return 'THB';
  if (branch === 'FUKUOKA') return 'JPY';
  return 'KRW';
};

export default function BookingsPage() {
  const navigate = useNavigate();
  const { userBranch, canAccessBranch, getEffectiveBranch } = useBranchFilter();

  // State
  const [selectedBranch, setSelectedBranch] = useState(userBranch || 'ALL');
  const [status, setStatus] = useState('ALL');
  const [currentDate, setCurrentDate] = useState(new Date()); // Month navigation
  const [keyword, setKeyword] = useState('');
  const [viewMode, setViewMode] = useState('excel'); // 'excel' | 'calendar'
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [activeMemo, setActiveMemo] = useState(null); // { x, y, row, field, dayIndex }
  const [hoveredHotel, setHoveredHotel] = useState(null); // { text, x, y }
  const [memoEditValue, setMemoEditValue] = useState('');
  const [dailyStatusValue, setDailyStatusValue] = useState('');
  const [changeTeeValue, setChangeTeeValue] = useState(false);
  const [scheduleTextValue, setScheduleTextValue] = useState('');
  const [hotelPaidFilter, setHotelPaidFilter] = useState('ALL');
  const [paidStatusFilter, setPaidStatusFilter] = useState('ALL');

  // Derived filters
  const effectiveBranch = getEffectiveBranch(selectedBranch === 'ALL' ? null : selectedBranch);

  // Date range (First to Last day of current month)
  const from = format(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1), 'yyyy-MM-dd');
  const to = format(
    new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0),
    'yyyy-MM-dd'
  );

  // Query
  const {
    data: bookings,
    isLoading,
    error,
    refetch,
  } = useBookingsList({
    branch: effectiveBranch || 'ALL',
    status,
    hotelPaid: hotelPaidFilter,
    paidStatus: paidStatusFilter,
    from,
    to,
    keyword,
  });

  // Auto-Close Logic: When end date passed AND paid_status is PAID, set status to CLOSED
  useEffect(() => {
    if (!bookings || bookings.length === 0) return;

    const checkAndClose = async () => {
      const now = new Date();
      const candidates = [];

      for (const row of bookings) {
        if (row.status === 'CLOSED' || row.status === 'CANCLE') continue;

        // Condition 1: Paid Status must be 'PAID'
        if (row.paid_status !== 'PAID') continue;

        // Condition 2: End Date must be passed
        if (!row.end_date) continue;

        // Parse YYYY-MM-DD to Local Date (end of day)
        const [y, m, dVal] = row.end_date.split('-').map(Number);
        const endDate = new Date(y, m - 1, dVal);
        endDate.setHours(23, 59, 59, 999);

        if (now > endDate) {
          candidates.push(row);
        }
      }

      if (candidates.length > 0) {
        try {
          await Promise.all(candidates.map((c) => updateBooking(c.id, { status: 'CLOSED' })));
          refetch();
        } catch (err) {
          console.error('Auto-Close Error:', err);
        }
      }
    };

    checkAndClose();
  }, [bookings, refetch]);

  // Handlers
  const handleEditClick = (e, row) => {
    e.stopPropagation();
    setEditingId(row.id);
    setEditValues({
      total_amount: row.total_amount,
      deposit_date: row.deposit_date,
      currency: row.currency,
      status: row.status,
      memo: row.memo,
      partner_code: row.partner_code,
      code: row.code,
      first_hotel_name: row.first_hotel_name,
      first_hotel_note: row.first_hotel_note,
      sc: row.sc,
      flight_info: row.flight_info,
      guide_vehicle: row.guide_vehicle,
      schedule_1: row['1TH'],
      schedule_2: row['2TH'],
      schedule_3: row['3TH'],
      schedule_4: row['4TH'],
      schedule_5: row['5TH'],
      schedule_6: row['6TH'],
      golf_final: row.golf_final,
      pay_status_1: row.pay_status_1,
      pay_status_2: row.pay_status_2,
      pay_status_3: row.pay_status_3,
      pay_status_4: row.pay_status_4,
      pay_status_5: row.pay_status_5,
      pay_status_6: row.pay_status_6,
    });
  };

  const handleTourFeeChange = (value) => {
    const branchForCurrency = selectedBranch === 'ALL' ? 'PHILIPPINES' : selectedBranch;
    const currency = getCurrencyByBranch(branchForCurrency);
    setEditValues((prev) => ({
      ...prev,
      total_amount: value,
      currency,
    }));
  };

  const handleEditChange = (field, value) => {
    setEditValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveClick = async (e, row) => {
    e.stopPropagation();
    try {
      const payload = { ...editValues };
      // Map 'code' alias to real column 'booking_code'
      if ('code' in payload) {
        payload.booking_code = payload.code;
        delete payload.code;
      }
      await updateBooking(row.id, payload);
      setEditingId(null);
      setEditValues({});
      refetch(); // Refresh list to see updates
    } catch (err) {
      console.error(err);
      alert(`Failed to save changes: ${err.message || JSON.stringify(err)}`);
    }
  };

  const handleCancelBooking = async (e, row) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to cancel this booking?')) return;
    try {
      await updateBooking(row.id, { status: 'CANCLE' });
      refetch();
    } catch (err) {
      console.error(err);
      alert('Failed to cancel booking');
    }
  };

  const handleCancelClick = (e) => {
    e.stopPropagation();
    setEditingId(null);
    setEditValues({});
  };

  const handleCellClick = (e, row, field) => {
    e.stopPropagation();
    if (editingId === row.id) return; // Don't show memo while editing

    const dayMatch = field.match(/(\d+)TH/);
    const dayIndex = dayMatch ? dayMatch[1] : null;

    let x = e.clientX;
    let y = e.clientY;

    if (typeof window !== 'undefined') {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const popoverWidth = 320;
      const popoverHeight = 260;
      const margin = 16;

      if (x + popoverWidth + margin > viewportWidth) {
        x = viewportWidth - popoverWidth - margin;
      }
      if (y + popoverHeight + margin > viewportHeight) {
        y = viewportHeight - popoverHeight - margin;
      }
      if (x < margin) x = margin;
      if (y < margin) y = margin;
    }

    setActiveMemo({ x, y, row, field, dayIndex });

    if (dayIndex) {
      setMemoEditValue(row[`memo_${dayIndex}`] || '');
      setScheduleTextValue(row[field] || '');
    } else {
      setMemoEditValue(row.memo || '');
      setScheduleTextValue('');
    }

    if (dayIndex) {
      setDailyStatusValue(row[`pay_status_${dayIndex}`] || '');
      setChangeTeeValue(Boolean(row[`change_tee_time_${dayIndex}`]));
    } else {
      setDailyStatusValue('');
      setChangeTeeValue(false);
    }
  };

  const handleMemoSave = async (e) => {
    e.stopPropagation();
    if (!activeMemo) return;
    try {
      const patch = {};

      if (activeMemo.dayIndex) {
        patch[`memo_${activeMemo.dayIndex}`] = memoEditValue;
        patch[`pay_status_${activeMemo.dayIndex}`] = dailyStatusValue;
        patch[`change_tee_time_${activeMemo.dayIndex}`] = changeTeeValue;
        patch[`schedule_${activeMemo.dayIndex}`] = scheduleTextValue;

        // Auto-update status to REQUESTED if Change Tee is checked
        if (changeTeeValue) {
          patch.status = 'REQUESTED';
        }
      } else {
        patch.memo = memoEditValue;
      }

      if (activeMemo.dayIndex) {
        const slotNo = Number(activeMemo.dayIndex);
        const baseDate = activeMemo.row.start_date;
        let serviceDate = baseDate || null;
        if (baseDate) {
          const d = new Date(baseDate);
          d.setDate(d.getDate() + (slotNo - 1));
          serviceDate = d.toISOString().slice(0, 10);
        }
        if (serviceDate) {
          await upsertBookingDayItem({
            booking_id: activeMemo.row.id,
            service_date: serviceDate,
            slot_no: slotNo,
            item_type: 'GOLF',
            status: dailyStatusValue || 'REQUESTED',
            paid: dailyStatusValue === 'PAID',
            change_flag: changeTeeValue,
            display_text: scheduleTextValue,
            memo: memoEditValue,
          });
        }
      }

      await updateBooking(activeMemo.row.id, patch);
      setActiveMemo(null);
      setMemoEditValue('');
      setDailyStatusValue('');
      setChangeTeeValue(false);
      refetch();
    } catch (err) {
      console.error(err);
      alert(`Failed to save memo: ${err.message}`);
    }
  };

  const handlePayStatusToggle = async (e, row, dayIndex) => {
    e.stopPropagation();
    try {
      const field = `pay_status_${dayIndex}`;
      const currentValue = row[field];
      const newValue = currentValue === 'PAID' ? '' : 'PAID';

      const slotNo = Number(dayIndex);
      const baseDate = row.start_date;
      let serviceDate = baseDate || null;
      if (baseDate) {
        const d = new Date(baseDate);
        d.setDate(d.getDate() + (slotNo - 1));
        serviceDate = d.toISOString().slice(0, 10);
      }
      if (serviceDate) {
        await upsertBookingDayItem({
          booking_id: row.id,
          service_date: serviceDate,
          slot_no: slotNo,
          item_type: 'GOLF',
          status: newValue || 'REQUESTED',
          paid: newValue === 'PAID',
          change_flag: Boolean(row[`change_tee_time_${dayIndex}`]),
          display_text: row[`${dayIndex}TH`] || '',
          memo: row[`memo_${dayIndex}`] || '',
        });
      }

      await updateBooking(row.id, { [field]: newValue });
      refetch();
    } catch (err) {
      console.error(err);
      alert(`Failed to update payment status: ${err.message || JSON.stringify(err)}`);
    }
  };

  const handleGolfFinalToggle = async (e, row) => {
    e.stopPropagation();
    try {
      await updateBooking(row.id, { golf_final: !row.golf_final });
      refetch();
    } catch (err) {
      console.error(err);
      alert('Failed to update golf final status');
    }
  };

  const handleMonthChange = (offset) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentDate(newDate);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleCreate = () => {
    navigate('/bookings/new');
  };

  // Render Calendar
  const renderCalendar = () => {
    if (!bookings) return null;

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    // Group bookings by date
    const bookingsByDate = {};
    bookings.forEach((b) => {
      const dateKey = b.start_date; // YYYY-MM-DD
      if (!bookingsByDate[dateKey]) bookingsByDate[dateKey] = [];
      bookingsByDate[dateKey].push(b);
    });

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          border: '1px solid var(--line)',
          borderRadius: 8,
          background: 'var(--panel)',
          overflow: 'hidden',
        }}
      >
        {/* Week Header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            borderBottom: '1px solid var(--line)',
            background: 'var(--chip)',
          }}
        >
          {weekDays.map((d) => (
            <div
              key={d}
              style={{
                padding: '8px',
                textAlign: 'center',
                fontWeight: 'bold',
                color: 'var(--muted)',
                fontSize: 12,
                borderRight: '1px solid var(--line)',
              }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            flex: 1,
            overflowY: 'auto',
            autoRows: 'minmax(100px, 1fr)',
          }}
        >
          {days.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayBookings = bookingsByDate[dateKey] || [];
            const isCurrentMonth = isSameMonth(day, monthStart);
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={dateKey}
                style={{
                  borderRight: '1px solid var(--line)',
                  borderBottom: '1px solid var(--line)',
                  padding: 4,
                  background: !isCurrentMonth ? 'rgba(0,0,0,0.2)' : 'transparent',
                  minHeight: 100,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div
                  style={{
                    textAlign: 'right',
                    fontSize: 12,
                    fontWeight: isToday ? '900' : 'normal',
                    color: isToday
                      ? 'var(--accent)'
                      : !isCurrentMonth
                        ? 'var(--muted)'
                        : 'var(--text)',
                    marginBottom: 2,
                  }}
                >
                  {format(day, 'd')}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {dayBookings.slice(0, 5).map((b) => (
                    <div
                      key={b.id}
                      onClick={() => navigate(`/bookings/${b.id}`)}
                      style={{
                        fontSize: 10,
                        padding: '2px 4px',
                        borderRadius: 3,
                        background: 'var(--chip)',
                        border: '1px solid var(--line)',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        color: 'var(--text)',
                      }}
                      title={`${b.customer_name} (${b.code})`}
                    >
                      {b.flight_info ? `[${b.flight_info}] ` : ''}
                      {b.customer_name}
                    </div>
                  ))}
                  {dayBookings.length > 5 && (
                    <div style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center' }}>
                      + {dayBookings.length - 5} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (isLoading) return <Loading label="Loading bookings..." />;
  if (error) return <ErrorState title="Failed to load bookings" error={error} />;

  return (
    <div
      style={{
        padding: '16px',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Header & Filters */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ fontSize: 20, fontWeight: '800', margin: 0 }}>Bookings</h2>

          {/* View Toggle */}
          <div style={{ display: 'flex', background: 'var(--line)', borderRadius: 8, padding: 2 }}>
            <button
              onClick={() => setViewMode('excel')}
              style={{
                border: 'none',
                background: viewMode === 'excel' ? 'var(--chip)' : 'transparent',
                color: viewMode === 'excel' ? 'var(--text)' : 'var(--muted)',
                padding: '6px 12px',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 'bold',
              }}
            >
              Excel
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              style={{
                border: 'none',
                background: viewMode === 'calendar' ? 'var(--chip)' : 'transparent',
                color: viewMode === 'calendar' ? 'var(--text)' : 'var(--muted)',
                padding: '6px 12px',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 'bold',
              }}
            >
              Calendar
            </button>
          </div>

          {/* Month Navigation */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--chip)',
              borderRadius: 8,
              border: '1px solid var(--line)',
            }}
          >
            <button
              onClick={() => handleMonthChange(-1)}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: '6px 10px',
                color: 'var(--text)',
              }}
            >
              &lt;
            </button>
            <span
              style={{
                padding: '0 8px',
                fontWeight: 'bold',
                fontSize: 14,
                minWidth: 80,
                textAlign: 'center',
              }}
            >
              {format(currentDate, 'yyyy-MM')}
            </span>
            <button
              onClick={() => handleMonthChange(1)}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: '6px 10px',
                color: 'var(--text)',
              }}
            >
              &gt;
            </button>
            <button
              onClick={handleToday}
              style={{
                border: 'none',
                borderLeft: '1px solid var(--line)',
                background: 'transparent',
                cursor: 'pointer',
                padding: '6px 10px',
                color: 'var(--accent)',
                fontWeight: 'bold',
                fontSize: 12,
              }}
            >
              Today
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Branch Filter */}
          {canAccessBranch(null) && (
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="select"
              style={{ height: 32, fontSize: 12, padding: '0 8px' }}
            >
              <option value="ALL">All Branches</option>
              <option value="PHILIPPINES">Philippines</option>
              <option value="CHIANGMAI">Chiang Mai</option>
              <option value="FUKUOKA">Fukuoka</option>
            </select>
          )}

          {/* Status Filter */}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="select"
            style={{ height: 32, fontSize: 12, padding: '0 8px' }}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {/* Booking Paid Status Filter */}
          <select
            value={paidStatusFilter}
            onChange={(e) => setPaidStatusFilter(e.target.value)}
            className="select"
            style={{ height: 32, fontSize: 12, padding: '0 8px' }}
          >
            <option value="ALL">Pay 전체</option>
            <option value="UNPAID">페이전</option>
            <option value="PARTIAL">부분페이</option>
            <option value="PAID">페이완료</option>
          </select>

          {/* Hotel Pay Filter */}
          <select
            value={hotelPaidFilter}
            onChange={(e) => setHotelPaidFilter(e.target.value)}
            className="select"
            style={{ height: 32, fontSize: 12, padding: '0 8px' }}
          >
            <option value="ALL">Hotel Pay 전체</option>
            <option value="PAID">Hotel Pay 완료</option>
            <option value="UNPAID">Hotel Pay 미완료</option>
          </select>

          {/* Search */}
          <input
            type="text"
            placeholder="Search..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="input"
            style={{ height: 32, fontSize: 12, padding: '0 8px', width: 200 }}
          />

          <button
            onClick={() => refetch()}
            className="btn"
            style={{ height: 32, padding: '0 12px', fontSize: 12 }}
          >
            Refresh
          </button>

          <button
            className="btn primary"
            onClick={handleCreate}
            style={{ fontSize: 12, height: 32, padding: '0 12px' }}
          >
            + New Booking
          </button>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'excel' ? (
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            border: '1px solid var(--line)',
            background: 'var(--panel)',
            borderRadius: 8,
            position: 'relative',
          }}
        >
          {/* Hotel Note Tooltip */}
          {hoveredHotel && (
            <div
              style={{
                position: 'fixed',
                top: hoveredHotel.y + 10,
                left: hoveredHotel.x + 10,
                background: '#fff',
                color: '#000',
                border: '1px solid #ccc',
                borderRadius: 4,
                padding: '8px 12px',
                zIndex: 10000,
                whiteSpace: 'pre-wrap',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                maxWidth: 320,
                fontSize: '12px',
                pointerEvents: 'none',
              }}
            >
              {hoveredHotel.text}
            </div>
          )}

          {/* Memo Popover */}
          {activeMemo && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                zIndex: 9999,
                background: 'rgba(0,0,0,0.1)',
              }}
              onClick={() => setActiveMemo(null)}
            >
              <div
                style={{
                  position: 'fixed',
                  top: activeMemo.y,
                  left: activeMemo.x,
                  background: 'var(--panel)',
                  border: '1px solid var(--line)',
                  borderRadius: 8,
                  padding: 12,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  minWidth: 250,
                  maxWidth: 350,
                  color: 'var(--text)',
                  fontSize: 12,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* 1. Schedule Text (Editable) */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 'bold', color: 'var(--accent)', marginBottom: 4 }}>
                    [{activeMemo.field}] Text
                  </div>
                  <input
                    value={scheduleTextValue}
                    onChange={(e) => setScheduleTextValue(e.target.value)}
                    placeholder="e.g. 1/23 KCC 1:11 >>"
                    style={{
                      width: '100%',
                      padding: 6,
                      background: 'var(--bg)',
                      color: 'var(--text)',
                      border: '1px solid var(--line)',
                      borderRadius: 4,
                      fontSize: 12,
                    }}
                  />
                </div>

                {/* 2. Daily Status & Memo (Only for 1TH-6TH) */}
                {activeMemo.dayIndex && (
                  <div
                    style={{
                      marginBottom: 12,
                      paddingBottom: 12,
                      borderBottom: '1px solid var(--line)',
                    }}
                  >
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontWeight: 'bold', color: 'var(--accent)', marginBottom: 4 }}>
                        [Daily Status]
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="checkbox"
                            checked={dailyStatusValue === 'PAID'}
                            onChange={(e) => setDailyStatusValue(e.target.checked ? 'PAID' : '')}
                            style={{ width: 16, height: 16, cursor: 'pointer' }}
                            id="popover-paid-checkbox"
                          />
                          <label
                            htmlFor="popover-paid-checkbox"
                            style={{
                              cursor: 'pointer',
                              fontWeight: 'bold',
                              color: dailyStatusValue === 'PAID' ? '#2ecc71' : 'var(--text)',
                            }}
                          >
                            PAID
                          </label>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="checkbox"
                            checked={changeTeeValue}
                            onChange={(e) => setChangeTeeValue(e.target.checked)}
                            style={{ width: 16, height: 16, cursor: 'pointer' }}
                            id="popover-change-tee-checkbox"
                          />
                          <label
                            htmlFor="popover-change-tee-checkbox"
                            style={{
                              cursor: 'pointer',
                              fontWeight: 'bold',
                              color: changeTeeValue ? '#e74c3c' : 'var(--text)',
                            }}
                          >
                            CHANGE TEE TIME
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Global Booking Memo */}
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontWeight: 'bold', color: 'var(--accent)', marginBottom: 4 }}>
                    [Booking Memo]
                  </div>
                  <textarea
                    value={memoEditValue}
                    onChange={(e) => setMemoEditValue(e.target.value)}
                    placeholder="Enter booking memo..."
                    style={{
                      width: '100%',
                      height: 80,
                      padding: 6,
                      background: 'var(--bg)',
                      color: 'var(--text)',
                      border: '1px solid var(--line)',
                      borderRadius: 4,
                      resize: 'vertical',
                      fontSize: 12,
                    }}
                  />
                </div>

                {/* 4. Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button
                    onClick={() => setActiveMemo(null)}
                    style={{
                      padding: '6px 12px',
                      fontSize: 11,
                      cursor: 'pointer',
                      background: 'transparent',
                      border: '1px solid var(--line)',
                      borderRadius: 4,
                      color: 'var(--text)',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleMemoSave}
                    style={{
                      padding: '6px 12px',
                      fontSize: 11,
                      cursor: 'pointer',
                      background: 'var(--accent)',
                      border: 'none',
                      borderRadius: 4,
                      color: '#fff',
                      fontWeight: 'bold',
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}

          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 2000 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--panel)' }}>
              <tr>
                <th style={{ ...gridStyle.th, width: 40 }}>Edit</th>
                <th style={{ ...gridStyle.th, width: 60, color: 'var(--accent)' }}>Create</th>
                <th style={{ ...gridStyle.th, width: 90 }}>Tour Fee</th>
                <th style={{ ...gridStyle.th, width: 80 }}>Status</th>
                <th style={{ ...gridStyle.th, width: 120 }}>Memo</th>
                <th style={{ ...gridStyle.th, width: 140 }}>Partner</th>
                <th style={{ ...gridStyle.th, width: 110 }}>Code</th>
                <th style={{ ...gridStyle.th, width: 110 }}>Hotel/RT</th>
                <th style={{ ...gridStyle.th, width: 40 }}>SC</th>
                <th style={{ ...gridStyle.th, width: 80 }}>Flight</th>
                <th style={{ ...gridStyle.th, width: 120 }}>Guide/Vehicle</th>
                <th style={{ ...gridStyle.th, width: 100 }}>1TH</th>
                <th style={{ ...gridStyle.th, width: 100 }}>2TH</th>
                <th style={{ ...gridStyle.th, width: 100 }}>3TH</th>
                <th style={{ ...gridStyle.th, width: 100 }}>4TH</th>
                <th style={{ ...gridStyle.th, width: 100 }}>5TH</th>
                <th style={{ ...gridStyle.th, width: 140 }}>6TH</th>
              </tr>
            </thead>
            <tbody>
              {bookings.length === 0 ? (
                <tr>
                  <td
                    colSpan="17"
                    style={{ padding: 20, textAlign: 'center', color: 'var(--muted)' }}
                  >
                    No bookings found for {format(currentDate, 'MMMM yyyy')}.
                  </td>
                </tr>
              ) : (
                bookings.map((row) => (
                  <tr
                    key={row.id}
                    style={{
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                      background: getRowBackground(row.status),
                      color: ['CHANGE_INFO', 'CANCLE', 'CLOSED'].includes(row.status)
                        ? '#fff'
                        : 'var(--text)',
                    }}
                    onClick={() => navigate(`/bookings/${row.id}`)}
                    onMouseOver={(e) =>
                      (e.currentTarget.style.background =
                        row.status === 'CANCLE' || row.status === 'CLOSED'
                          ? getRowBackground(row.status) // Keep status color on hover (or maybe darken it?)
                          : 'rgba(74,163,255,0.05)')
                    }
                    onMouseOut={(e) =>
                      (e.currentTarget.style.background = getRowBackground(row.status))
                    }
                  >
                    {/* 0. Edit/Save Action */}
                    <td
                      style={{ ...gridStyle.td, textAlign: 'center', minWidth: 60 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                        <span
                          onClick={(e) => {
                            if (editingId === row.id) {
                              handleSaveClick(e, row);
                            } else {
                              handleEditClick(e, row);
                            }
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 24,
                            height: 24,
                            borderRadius: 6,
                            border:
                              editingId === row.id
                                ? '1px solid rgba(236, 240, 241, 0.8)'
                                : '1px solid transparent',
                            backgroundColor:
                              editingId === row.id ? 'rgba(236, 240, 241, 0.08)' : 'transparent',
                            cursor: 'pointer',
                            fontSize: 14,
                            opacity: editingId === row.id ? 1 : 0.7,
                          }}
                          title={editingId === row.id ? 'Save' : 'Edit'}
                        >
                          {editingId === row.id ? '💾' : '✏️'}
                        </span>
                      </div>
                    </td>

                    {/* 1. Create Date (MM/DD) */}
                    <td
                      style={{
                        ...gridStyle.td,
                        textAlign: 'center',
                        color: 'var(--muted)',
                        fontSize: '15px',
                        fontWeight: 'bold',
                      }}
                    >
                      {row.base_date ? format(new Date(row.base_date), 'MM/dd') : '-'}
                    </td>

                    {/* 2. Tour Fee (Small width) */}
                    <td
                      style={{
                        ...gridStyle.td,
                        textAlign: 'right',
                        fontWeight: 'bold',
                        fontSize: '11px',
                      }}
                    >
                      {editingId === row.id ? (
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="number"
                            value={editValues.total_amount || ''}
                            onChange={(e) => handleTourFeeChange(e.target.value)}
                            style={{ width: '100%', fontSize: 11, padding: 2 }}
                          />
                          <input
                            type="text"
                            value={editValues.deposit_date || ''}
                            onChange={(e) => handleEditChange('deposit_date', e.target.value)}
                            placeholder="MM/DD"
                            maxLength={5}
                            style={{ width: 62, fontSize: 11, padding: 2, textAlign: 'center' }}
                          />
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <div>
                            {(() => {
                              const amount = row.total_amount?.toLocaleString() ?? '0';
                              switch (row.currency) {
                                case 'KRW':
                                  return `₩ ${amount}`;
                                case 'THB':
                                  return `฿ ${amount}`;
                                case 'PHP':
                                  return `₱ ${amount}`;
                                case 'USD':
                                  return `$ ${amount}`;
                                case 'JPY':
                                  return `¥ ${amount}`;
                                default:
                                  return amount;
                              }
                            })()}
                          </div>
                          {row.deposit_date ? (
                            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)' }}>
                              {row.deposit_date}
                            </div>
                          ) : null}
                        </div>
                      )}
                    </td>

                    {/* 3. Status Tag (Small width) */}
                    <td style={{ ...gridStyle.td, textAlign: 'center' }}>
                      {editingId === row.id ? (
                        <select
                          value={editValues.status || ''}
                          onChange={(e) => handleEditChange('status', e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ width: '100%', fontSize: 11, padding: 2 }}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      ) : (
                        (() => {
                          const tag = getStatusTag(row);
                          return (
                            <span style={gridStyle.statusTag(tag.label, tag.color, tag.bg)}>
                              {tag.label}
                            </span>
                          );
                        })()
                      )}
                    </td>

                    {/* 4. Memo */}
                    <td
                      style={{
                        ...gridStyle.td,
                        maxWidth: 120,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        color: '#fff',
                        fontSize: '13px', // Slightly larger as requested
                      }}
                      title={row.memo}
                    >
                      {editingId === row.id ? (
                        <input
                          value={editValues.memo || ''}
                          onChange={(e) => handleEditChange('memo', e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ width: '100%', fontSize: 11, padding: 2 }}
                        />
                      ) : (
                        row.memo
                      )}
                    </td>

                    {/* 5. Partner */}
                    <td
                      style={{
                        ...gridStyle.td,
                      }}
                    >
                      {editingId === row.id ? (
                        <input
                          value={editValues.partner_code || ''}
                          onChange={(e) => handleEditChange('partner_code', e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ width: '100%', fontSize: 11, padding: 2 }}
                        />
                      ) : row.customer_name ? (
                        `${row.partner_name || row.partner_code} (${row.customer_name})`
                      ) : (
                        row.partner_name || row.partner_code
                      )}
                    </td>

                    {/* 6. Booking Code */}
                    <td style={{ ...gridStyle.td, fontWeight: 'bold' }}>
                      {editingId === row.id ? (
                        <input
                          value={editValues.code || ''}
                          onChange={(e) => handleEditChange('code', e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ width: '100%', fontSize: 11, padding: 2 }}
                        />
                      ) : (
                        row.code
                      )}
                    </td>

                    {/* 7. Hotel/RT */}
                    <td
                      style={{
                        ...gridStyle.td,
                        width: 150,
                        background: row.hotel_paid ? 'rgba(46, 204, 113, 0.1)' : undefined,
                        cursor: row.hotel_note && row.hotel_paid ? 'help' : 'default',
                        position: 'relative',
                      }}
                      onMouseEnter={(e) => {
                        if (row.hotel_note && row.hotel_paid) {
                          setHoveredHotel({
                            text: row.hotel_note,
                            x: e.clientX,
                            y: e.clientY,
                          });
                        }
                      }}
                      onMouseLeave={() => setHoveredHotel(null)}
                    >
                      {editingId === row.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <input
                            placeholder="Hotel Name"
                            value={editValues.first_hotel_name || ''}
                            onChange={(e) => handleEditChange('first_hotel_name', e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: '100%', fontSize: 10, padding: 2 }}
                          />
                          <input
                            placeholder="Note"
                            value={editValues.first_hotel_note || ''}
                            onChange={(e) => handleEditChange('first_hotel_note', e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: '100%', fontSize: 10, padding: 2 }}
                          />
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <input
                              type="checkbox"
                              checked={editValues.hotel_paid || false}
                              onChange={(e) => handleEditChange('hotel_paid', e.target.checked)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span style={{ fontSize: 10 }}>Paid</span>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div style={{ fontWeight: 'bold' }}>{row.first_hotel_name}</div>
                          <div
                            style={{
                              fontSize: '10px',
                              color: 'var(--muted)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {row.first_hotel_note}
                          </div>
                        </>
                      )}
                    </td>

                    {/* 8. SC (auto-calculated nights) */}
                    <td style={{ ...gridStyle.td, textAlign: 'center' }}>{row.sc}</td>

                    {/* 9. Flight */}
                    <td style={{ ...gridStyle.td, textAlign: 'center' }}>
                      {editingId === row.id ? (
                        <input
                          value={editValues.flight_info || ''}
                          onChange={(e) => handleEditChange('flight_info', e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ width: '100%', fontSize: 11, padding: 2 }}
                        />
                      ) : (
                        row.flight_info
                      )}
                    </td>

                    {/* 10. Guide/Vehicle */}
                    <td style={{ ...gridStyle.td, fontSize: '11px' }}>
                      {editingId === row.id ? (
                        <input
                          value={editValues.guide_vehicle || ''}
                          onChange={(e) => handleEditChange('guide_vehicle', e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ width: '100%', fontSize: 11, padding: 2 }}
                        />
                      ) : (
                        row.guide_vehicle
                      )}
                    </td>

                    {/* 11. 1TH */}
                    <td
                      style={{
                        ...gridStyle.td,
                        background: getDailyCellBackground(row, 1),
                      }}
                      onClick={(e) => handleCellClick(e, row, '1TH')}
                    >
                      {editingId === row.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input
                            type="checkbox"
                            checked={editValues.pay_status_1 === 'PAID'}
                            onChange={(e) =>
                              handleEditChange('pay_status_1', e.target.checked ? 'PAID' : '')
                            }
                            onClick={(e) => e.stopPropagation()}
                          />
                          <input
                            value={editValues.schedule_1 || ''}
                            onChange={(e) => handleEditChange('schedule_1', e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: '100%', fontSize: 11, padding: 2 }}
                          />
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input
                            type="checkbox"
                            checked={row.pay_status_1 === 'PAID'}
                            onChange={(e) => handlePayStatusToggle(e, row, 1)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ cursor: 'pointer' }}
                          />
                          <span style={{ flex: 1 }}>{row['1TH']}</span>
                        </div>
                      )}
                    </td>

                    {/* 12. 2TH */}
                    <td
                      style={{
                        ...gridStyle.td,
                        background: getDailyCellBackground(row, 2),
                      }}
                      onClick={(e) => handleCellClick(e, row, '2TH')}
                    >
                      {editingId === row.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input
                            type="checkbox"
                            checked={editValues.pay_status_2 === 'PAID'}
                            onChange={(e) =>
                              handleEditChange('pay_status_2', e.target.checked ? 'PAID' : '')
                            }
                            onClick={(e) => e.stopPropagation()}
                          />
                          <input
                            value={editValues.schedule_2 || ''}
                            onChange={(e) => handleEditChange('schedule_2', e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: '100%', fontSize: 11, padding: 2 }}
                          />
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input
                            type="checkbox"
                            checked={row.pay_status_2 === 'PAID'}
                            onChange={(e) => handlePayStatusToggle(e, row, 2)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ cursor: 'pointer' }}
                          />
                          <span style={{ flex: 1 }}>{row['2TH']}</span>
                        </div>
                      )}
                    </td>

                    {/* 13. 3TH */}
                    <td
                      style={{
                        ...gridStyle.td,
                        background: getDailyCellBackground(row, 3),
                      }}
                      onClick={(e) => handleCellClick(e, row, '3TH')}
                    >
                      {editingId === row.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input
                            type="checkbox"
                            checked={editValues.pay_status_3 === 'PAID'}
                            onChange={(e) =>
                              handleEditChange('pay_status_3', e.target.checked ? 'PAID' : '')
                            }
                            onClick={(e) => e.stopPropagation()}
                          />
                          <input
                            value={editValues.schedule_3 || ''}
                            onChange={(e) => handleEditChange('schedule_3', e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: '100%', fontSize: 11, padding: 2 }}
                          />
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input
                            type="checkbox"
                            checked={row.pay_status_3 === 'PAID'}
                            onChange={(e) => handlePayStatusToggle(e, row, 3)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ cursor: 'pointer' }}
                          />
                          <span style={{ flex: 1 }}>{row['3TH']}</span>
                        </div>
                      )}
                    </td>

                    {/* 14. 4TH */}
                    <td
                      style={{
                        ...gridStyle.td,
                        background: getDailyCellBackground(row, 4),
                      }}
                      onClick={(e) => handleCellClick(e, row, '4TH')}
                    >
                      {editingId === row.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input
                            type="checkbox"
                            checked={editValues.pay_status_4 === 'PAID'}
                            onChange={(e) =>
                              handleEditChange('pay_status_4', e.target.checked ? 'PAID' : '')
                            }
                            onClick={(e) => e.stopPropagation()}
                          />
                          <input
                            value={editValues.schedule_4 || ''}
                            onChange={(e) => handleEditChange('schedule_4', e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: '100%', fontSize: 11, padding: 2 }}
                          />
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input
                            type="checkbox"
                            checked={row.pay_status_4 === 'PAID'}
                            onChange={(e) => handlePayStatusToggle(e, row, 4)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ cursor: 'pointer' }}
                          />
                          <span style={{ flex: 1 }}>{row['4TH']}</span>
                        </div>
                      )}
                    </td>

                    {/* 15. 5TH */}
                    <td
                      style={{
                        ...gridStyle.td,
                        background: getDailyCellBackground(row, 5),
                      }}
                      onClick={(e) => handleCellClick(e, row, '5TH')}
                    >
                      {editingId === row.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input
                            type="checkbox"
                            checked={editValues.pay_status_5 === 'PAID'}
                            onChange={(e) =>
                              handleEditChange('pay_status_5', e.target.checked ? 'PAID' : '')
                            }
                            onClick={(e) => e.stopPropagation()}
                          />
                          <input
                            value={editValues.schedule_5 || ''}
                            onChange={(e) => handleEditChange('schedule_5', e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: '100%', fontSize: 11, padding: 2 }}
                          />
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input
                            type="checkbox"
                            checked={row.pay_status_5 === 'PAID'}
                            onChange={(e) => handlePayStatusToggle(e, row, 5)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ cursor: 'pointer' }}
                          />
                          <span style={{ flex: 1 }}>{row['5TH']}</span>
                        </div>
                      )}
                    </td>

                    {/* 16. 6TH (Editable) */}
                    <td
                      style={{
                        ...gridStyle.td,
                        background: getDailyCellBackground(row, 6),
                      }}
                      onClick={(e) => handleCellClick(e, row, '6TH')}
                    >
                      {editingId === row.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input
                            type="checkbox"
                            checked={editValues.pay_status_6 === 'PAID'}
                            onChange={(e) =>
                              handleEditChange('pay_status_6', e.target.checked ? 'PAID' : '')
                            }
                            onClick={(e) => e.stopPropagation()}
                          />
                          <input
                            value={editValues.schedule_6 || ''}
                            onChange={(e) => handleEditChange('schedule_6', e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: '100%', fontSize: 11, padding: 2 }}
                          />
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input
                            type="checkbox"
                            checked={row.pay_status_6 === 'PAID'}
                            onChange={(e) => handlePayStatusToggle(e, row, 6)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ cursor: 'pointer' }}
                          />
                          <span style={{ flex: 1 }}>{row['6TH']}</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        renderCalendar()
      )}
    </div>
  );
}
