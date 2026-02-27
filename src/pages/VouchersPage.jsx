import { useMemo, useState } from 'react';
import Badge from '../common/components/Badge.jsx';
import ErrorState from '../common/components/ErrorState.jsx';
import Loading from '../common/components/Loading.jsx';
import VoucherModal from '../features/vouchers/VoucherModal.jsx';
import {
  useCreateVoucher,
  useUpdateVoucher,
  useVouchersList,
} from '../features/vouchers/vouchersHooks.js';
import { useUiStore } from '../store/uiStore.js';
import { addDaysISO, fmtDate, todayISO } from '../utils/date.js';

const STATUS_OPTIONS = ['ALL', 'NEW', 'REQUESTED', 'CONFIRMED', 'CANCLE', 'CLOSED', 'CHANGE_INFO'];

const getRowStyle = (status) => {
  // if (status === 'CANCLE') return { background: '#c0392b', color: '#fff' };
  // if (status === 'CLOSED') return { background: '#7f8c8d', color: '#fff' };
  // if (status === 'CHANGE_INFO') return { background: '#e74c3c', color: '#fff' };
  // if (status === 'REQUESTED') return { background: '#e74c3c', color: '#fff' };
  // if (status === 'INPROGRESS') return { background: '#4169e1', color: '#fff' };
  // if (status === 'GUID_PAY') return { background: '#2ecc71', color: '#fff' };
  return {};
};

const get1THStyle = (row) => {
  // const schedule = row.schedule_1 || row.tee_time || '';
  // const isChangeTee = String(schedule).includes('>>');
  const isChangeTee = Boolean(row.change_tee_time_1); // Use checkbox field
  const isPaid = row.paid_status === 'PAID';

  if (isPaid) return { background: 'rgba(46, 204, 113, 0.1)', color: 'var(--text)' }; // Green 10%
  if (isChangeTee) return { background: 'rgba(231, 76, 60, 0.1)', color: 'var(--text)' }; // Red 10%
  if (row.memo || row.request_note)
    return { background: 'rgba(255, 165, 0, 0.1)', color: 'var(--text)' }; // Orange 10%
  return {};
};

export default function VouchersPage() {
  const branch = useUiStore((s) => s.branch);
  const keyword = useUiStore((s) => s.keyword);

  const [status, setStatus] = useState('ALL');
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(addDaysISO(todayISO(), 30));

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});

  const q = useVouchersList({ branch, keyword, status, from, to });
  const createM = useCreateVoucher();
  const updateM = useUpdateVoucher();

  const rows = useMemo(() => q.data ?? [], [q.data]);

  const handleEditClick = (e, row) => {
    e.stopPropagation();
    setEditingId(row.id);
    setEditValues({
      amount: row.amount || 0,
      manager: row.manager || '',
      booking_code: row.booking_code || '',
      reserver_name: row.reserver_name || '',
      pax: row.pax || 0,
      schedule_1: row.schedule_1 || row.tee_time || '',
      status: row.status || 'NEW',
      paid_status: row.paid_status || 'UNPAID',
      request_note: row.request_note || '',
    });
  };

  const handleEditChange = (field, value) => {
    setEditValues((prev) => ({ ...prev, [field]: value }));
  };

  const handlePayToggle = async (e, row) => {
    e.stopPropagation();
    const newStatus = row.paid_status === 'PAID' ? 'UNPAID' : 'PAID';
    try {
      await updateM.mutateAsync({
        id: row.id,
        prevUpdatedAt: row.updated_at,
        patch: { paid_status: newStatus },
      });
    } catch (err) {
      alert(`Error updating paid status: ${err.message}`);
    }
  };

  const handleSaveClick = async (e, row) => {
    e.stopPropagation();
    try {
      await updateM.mutateAsync({
        id: row.id,
        prevUpdatedAt: row.updated_at,
        patch: editValues,
      });
      setEditingId(null);
      setEditValues({});
    } catch (err) {
      alert(`Error saving voucher: ${err.message}`);
    }
  };

  const onOpenNew = () => {
    setEditingVoucher(null);
    setIsModalOpen(true);
  };

  const onOpenEdit = (row) => {
    setEditingVoucher(row);
    setIsModalOpen(true);
  };

  const onSave = async (data) => {
    try {
      if (editingVoucher) {
        await updateM.mutateAsync({
          id: editingVoucher.id,
          prevUpdatedAt: editingVoucher.updated_at,
          patch: data,
        });
      } else {
        // Fix: Map specific branches to Region if the DB Enum expects Regions
        let targetBranch = branch === 'ALL' ? 'PHILIPPINES' : branch;

        // Map known sub-branches to their region
        const PHILIPPINES_BRANCHES = ['CEBU', 'MANILA', 'CLARK', 'SUBIC'];
        if (PHILIPPINES_BRANCHES.includes(targetBranch)) {
          targetBranch = 'PHILIPPINES';
        } else if (targetBranch === 'FUKUOKA') {
          targetBranch = 'JAPAN';
        }

        const payload = {
          ...data,
          branch: targetBranch,
        };
        await createM.mutateAsync(payload);
      }
      setIsModalOpen(false);
    } catch (err) {
      alert(`Error saving voucher: ${err.message}`);
    }
  };

  if (q.isLoading) return <Loading label="Loading vouchers..." />;
  if (q.error) return <ErrorState title="Vouchers load error" error={q.error} />;

  return (
    <div style={{ marginTop: 14 }}>
      <VoucherModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={onSave}
        initialData={editingVoucher}
      />

      <div className="card">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="label">From</span>
            <input
              className="input"
              style={{ width: 160 }}
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="label">To</span>
            <input
              className="input"
              style={{ width: 160 }}
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <button className="btn primary" onClick={onOpenNew} disabled={createM.isPending}>
            {createM.isPending ? 'Creating...' : 'Quick New'}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 12, overflowX: 'auto' }}>
        <table className="table" style={{ minWidth: 1200 }}>
          <thead>
            <tr>
              <th style={{ width: 40 }}>Edit</th>
              <th style={{ width: 40 }}>Paid</th>
              <th>Booking Date</th>
              <th>Amount</th>
              <th>Manager</th>
              <th>Booking Code</th>
              <th>Reserver Name</th>
              <th>Pax</th>
              <th>1TH</th>
              <th>Status</th>
              <th>Memo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => onOpenEdit(r)}
                style={{ cursor: 'pointer', ...getRowStyle(r.status) }}
                className="hover-row"
              >
                <td style={{ textAlign: 'center' }}>
                  {editingId === r.id ? (
                    <button
                      onClick={(e) => handleSaveClick(e, r)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        fontSize: '14px',
                      }}
                      title="Save"
                    >
                      💾
                    </button>
                  ) : (
                    <button
                      onClick={(e) => handleEditClick(e, r)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        fontSize: '14px',
                        opacity: 0.5,
                      }}
                      title="Edit"
                    >
                      ✏️
                    </button>
                  )}
                </td>
                <td style={{ textAlign: 'center' }}>
                  {editingId === r.id ? (
                    <input
                      type="checkbox"
                      checked={editValues.paid_status === 'PAID'}
                      onChange={(e) =>
                        handleEditChange('paid_status', e.target.checked ? 'PAID' : 'UNPAID')
                      }
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <input
                      type="checkbox"
                      checked={r.paid_status === 'PAID'}
                      onChange={(e) => handlePayToggle(e, r)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                </td>
                <td>{fmtDate(r.play_date)}</td>
                <td style={{ fontWeight: 'bold', textAlign: 'right' }}>
                  {editingId === r.id ? (
                    <input
                      type="number"
                      value={editValues.amount ?? ''}
                      onChange={(e) => handleEditChange('amount', Number(e.target.value || 0))}
                      onClick={(e) => e.stopPropagation()}
                      style={{ width: '100%', fontSize: 11, padding: 2 }}
                    />
                  ) : (
                    (() => {
                      const val = r.amount?.toLocaleString() ?? '0';
                      return r.currency === 'KRW'
                        ? `₩ ${val}`
                        : r.currency === 'PHP'
                          ? `₱ ${val}`
                          : `${r.currency} ${val}`;
                    })()
                  )}
                </td>
                <td style={{ color: 'var(--muted)' }}>
                  {editingId === r.id ? (
                    <input
                      value={editValues.manager || ''}
                      onChange={(e) => handleEditChange('manager', e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ width: '100%', fontSize: 11, padding: 2 }}
                    />
                  ) : (
                    r.manager || '-'
                  )}
                </td>
                <td style={{ fontWeight: 'bold' }}>
                  {editingId === r.id ? (
                    <input
                      value={editValues.booking_code || ''}
                      onChange={(e) => handleEditChange('booking_code', e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ width: '100%', fontSize: 11, padding: 2 }}
                    />
                  ) : (
                    r.booking_code || '-'
                  )}
                </td>
                <td style={{ fontWeight: 700 }}>
                  {editingId === r.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <input
                        value={editValues.customer_name || ''}
                        onChange={(e) => handleEditChange('customer_name', e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: '100%', fontSize: 11, padding: 2 }}
                        placeholder="한글이름"
                      />
                      <input
                        value={editValues.customer_name_en || ''}
                        onChange={(e) => handleEditChange('customer_name_en', e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: '100%', fontSize: 11, padding: 2 }}
                        placeholder="English Name"
                      />
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <span>{r.customer_name || r.reserver_name || '-'}</span>
                      <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                        {r.customer_name_en || '-'}
                      </span>
                    </div>
                  )}
                </td>
                <td>
                  {editingId === r.id ? (
                    <input
                      type="number"
                      value={editValues.pax ?? ''}
                      onChange={(e) => handleEditChange('pax', Number(e.target.value || 0))}
                      onClick={(e) => e.stopPropagation()}
                      style={{ width: '100%', fontSize: 11, padding: 2 }}
                    />
                  ) : (
                    r.pax
                  )}
                </td>
                <td style={get1THStyle(r)}>
                  {editingId === r.id ? (
                    <input
                      value={editValues.schedule_1 || ''}
                      onChange={(e) => handleEditChange('schedule_1', e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ width: '100%', fontSize: 11, padding: 2 }}
                    />
                  ) : (
                    r.schedule_1 || (
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{r.tee_time}</div>
                    )
                  )}
                </td>
                <td>
                  {editingId === r.id ? (
                    <select
                      value={editValues.status}
                      onChange={(e) => handleEditChange('status', e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ width: '100%', fontSize: 11, padding: 2 }}
                    >
                      {STATUS_OPTIONS.filter((s) => s !== 'ALL').map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Badge
                      variant={
                        r.status === 'CONFIRMED' ? 'good' : r.status === 'CANCLE' ? 'bad' : 'warn'
                      }
                    >
                      {r.status}
                    </Badge>
                  )}
                </td>
                <td>
                  {editingId === r.id ? (
                    <input
                      value={editValues.request_note || ''}
                      onChange={(e) => handleEditChange('request_note', e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ width: '100%', fontSize: 11, padding: 2 }}
                    />
                  ) : (
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--muted)',
                        maxWidth: 200,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={r.request_note}
                    >
                      {r.request_note}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan="11"
                  style={{ color: 'var(--muted)', textAlign: 'center', padding: 20 }}
                >
                  No data
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {updateM.error ? (
        <div
          className="card"
          style={{ marginTop: 12, color: 'var(--bad)', fontSize: 13, whiteSpace: 'pre-wrap' }}
        >
          {updateM.error.message}
        </div>
      ) : null}
    </div>
  );
}
