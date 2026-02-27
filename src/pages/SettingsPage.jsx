import { useEffect, useState } from 'react';
import { useBranchFilter } from '../features/auth/useBranchFilter.js';
import {
  createMasterData,
  deleteMasterData,
  getMasterData,
  updateMasterData,
} from '../features/settings/settingsApi.js';
import { useAuthStore } from '../store/authStore.js';

const getRegionFromBranch = (branch) => {
  if (!branch) return null;
  return branch;
};

const REGION_OPTIONS = [
  { value: 'ALL', label: 'ALL' },
  { value: 'CLARK', label: 'Clark' },
  { value: 'MANILA', label: 'Manila' },
  { value: 'CEBU', label: 'Cebu' },
  { value: 'FUKUOKA', label: 'Fukuoka' },
  { value: 'CHIANGMAI', label: 'Chiang Mai' },
];

const COUNTRY_OPTIONS = [
  { value: 'ALL', label: 'ALL' },
  { value: 'PHILIPPINES', label: 'Philippines' },
  { value: 'JAPAN', label: 'Japan' },
  { value: 'CHIANGMAI', label: 'Chiang Mai' },
];

const INITIAL_NEW_ITEM = {
  code: '',
  label: '',
  region: '',
  type: '',
  prefix: '',
  name: '',
  note: '',
  country: '',
  room_type: '',
  nickname: '',
  phone: '',
  number: '',
};

const MasterDataSection = ({ title, table, userBranch, userRole }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [newItem, setNewItem] = useState({ ...INITIAL_NEW_ITEM });
  const [editModal, setEditModal] = useState(null);

  // Determine effective region for filtering
  const effectiveRegion = userRole === 'master_office' ? null : getRegionFromBranch(userBranch);

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await getMasterData(table);
      let finalData = result;

      if (effectiveRegion) {
        if (table === 'product_types') {
          finalData = result.filter(
            (r) => !r.country || r.country === effectiveRegion || r.country === 'ALL'
          );
        } else {
          finalData = result.filter(
            (r) => !r.region || r.region === effectiveRegion || r.region === 'ALL'
          );
        }
      }

      setData(finalData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (item) => {
    if (table === 'golf_courses') {
      setEditModal({
        id: item.id,
        code: item.code || '',
        country: item.country || '',
        name: item.name || '',
        note: item.note || '',
        region: item.region || '',
        peak_start_date: item.peak_start_date || '',
        offpeak_start_date: item.offpeak_start_date || '',
        peak_price: item.peak_price ?? '',
        offpeak_price: item.offpeak_price ?? '',
        weekday_price: item.weekday_price ?? '',
        weekend_price: item.weekend_price ?? '',
        cart_fee_2pax: item.cart_fee_2pax ?? '',
        caddie_fee: item.caddie_fee ?? '',
        insurance_fee: item.insurance_fee ?? '',
        consumable_fee: item.consumable_fee ?? '',
      });
    } else if (table === 'flightinfo') {
      setEditModal({
        id: item.id,
        code: item.code || '',
        country: item.country || '',
        airport: item.airport || '',
        label: item.memo || '',
      });
    } else if (table === 'product_types') {
      setEditModal({
        id: item.id,
        code: item.code || '',
        label: item.label || '',
        type: item.type || '',
        prefix: item.prefix || '',
        country: item.country || '',
      });
    } else if (table === 'hotel_master') {
      setEditModal({
        id: item.id,
        code: item.code || '',
        country: item.country || '',
        name: item.name || '',
        note: item.note || '',
        room_type: item.room_type || '',
        region: item.region || '',
      });
    } else if (table === 'guide_master') {
      setEditModal({
        id: item.id,
        country: item.country || '',
        name: item.name || '',
        nickname: item.nickname || '',
        phone: item.phone || '',
        region: item.region || '',
      });
    } else if (table === 'driver_master') {
      setEditModal({
        id: item.id,
        country: item.country || '',
        name: item.name || '',
        nickname: item.nickname || '',
        phone: item.phone || '',
        type: item.type || '',
        region: item.region || '',
      });
    } else {
      setEditModal({
        id: item.id,
        code: item.code || '',
        label: item.label || '',
        region: item.region || '',
      });
    }
  };

  const handleUpdate = async () => {
    if (!editModal) return;
    try {
      let payload;

      if (table === 'golf_courses') {
        payload = {
          code: editModal.code,
          country: editModal.country || null,
          name: editModal.name || null,
          note: editModal.note || null,
          peak_start_date: editModal.peak_start_date || null,
          offpeak_start_date: editModal.offpeak_start_date || null,
          peak_price:
            editModal.peak_price === '' || editModal.peak_price == null
              ? null
              : Number(editModal.peak_price),
          offpeak_price:
            editModal.offpeak_price === '' || editModal.offpeak_price == null
              ? null
              : Number(editModal.offpeak_price),
          weekday_price:
            editModal.weekday_price === '' || editModal.weekday_price == null
              ? null
              : Number(editModal.weekday_price),
          weekend_price:
            editModal.weekend_price === '' || editModal.weekend_price == null
              ? null
              : Number(editModal.weekend_price),
          cart_fee_2pax:
            editModal.cart_fee_2pax === '' || editModal.cart_fee_2pax == null
              ? null
              : Number(editModal.cart_fee_2pax),
          caddie_fee:
            editModal.caddie_fee === '' || editModal.caddie_fee == null
              ? null
              : Number(editModal.caddie_fee),
          insurance_fee:
            editModal.insurance_fee === '' || editModal.insurance_fee == null
              ? null
              : Number(editModal.insurance_fee),
          consumable_fee:
            editModal.consumable_fee === '' || editModal.consumable_fee == null
              ? null
              : Number(editModal.consumable_fee),
        };
        if (editModal.region) payload.region = editModal.region;
      } else if (table === 'flightinfo') {
        payload = {
          code: editModal.code,
          country: editModal.country || null,
          airport: editModal.airport || null,
          memo: editModal.label || null,
        };
      } else if (table === 'product_types') {
        payload = {
          code: editModal.code,
          label: editModal.label,
          type: editModal.type || null,
          prefix: editModal.prefix || null,
        };
        if (editModal.country) payload.country = editModal.country;
      } else if (table === 'hotel_master') {
        payload = {
          code: editModal.code,
          country: editModal.country || null,
          name: editModal.name || null,
          note: editModal.note || null,
          room_type: editModal.room_type || null,
        };
        if (editModal.region) payload.region = editModal.region;
      } else if (table === 'guide_master') {
        payload = {
          country: editModal.country || null,
          name: editModal.name || null,
          nickname: editModal.nickname || null,
          phone: editModal.phone || null,
        };
        if (editModal.region) payload.region = editModal.region;
      } else if (table === 'driver_master') {
        payload = {
          country: editModal.country || null,
          name: editModal.name || null,
          nickname: editModal.nickname || null,
          phone: editModal.phone || null,
        };
        if (editModal.region) payload.region = editModal.region;
      } else {
        payload = {
          code: editModal.code,
          label: editModal.label,
        };
        if (editModal.region) payload.region = editModal.region;
      }

      await updateMasterData(table, editModal.id, payload);
      setEditModal(null);
      fetchData();
    } catch (err) {
      alert(`Failed to update: ${err.message}`);
    }
  };

  useEffect(() => {
    fetchData();
  }, [table, userBranch, userRole]);

  const handleCreate = async () => {
    try {
      let payload;

      if (table === 'golf_courses') {
        let region = null;
        const countryKey = (newItem.country || '').toUpperCase();
        if (['MANILA', 'CEBU', 'CLARK', 'SUBIC'].includes(countryKey)) {
          region = 'PHILIPPINES';
        } else if (countryKey === 'FUKUOKA') {
          region = 'JAPAN';
        } else if (countryKey === 'CHIANGMAI') {
          region = 'CHIANGMAI';
        }

        payload = {
          code: newItem.code?.trim().toUpperCase(),
          country: countryKey || null,
          name: newItem.name?.trim() || null,
          note: newItem.note?.trim() || null,
          region: region,
        };
      } else if (table === 'hotel_master') {
        payload = {
          code: newItem.code?.trim(),
          country: newItem.country?.trim() || null,
          name: newItem.name?.trim() || null,
          note: newItem.note?.trim() || null,
          room_type: newItem.room_type?.trim() || null,
        };
      } else if (table === 'guide_master') {
        const baseRegion = effectiveRegion || newItem.region || 'ALL';
        payload = {
          country: newItem.country?.trim() || null,
          name: newItem.name?.trim() || null,
          nickname: newItem.nickname?.trim() || null,
          phone: newItem.phone?.trim() || null,
          region: baseRegion,
        };
      } else if (table === 'driver_master') {
        const baseRegion = effectiveRegion || newItem.region || 'ALL';
        payload = {
          country: newItem.country?.trim() || null,
          name: newItem.name?.trim() || null,
          nickname: newItem.nickname?.trim() || null,
          phone: newItem.phone?.trim() || null,
          region: baseRegion,
        };
      } else if (table === 'vehicle_master') {
        const baseRegion = effectiveRegion || newItem.region || 'ALL';
        payload = {
          country: newItem.country?.trim() || null,
          name: newItem.name?.trim() || null,
          number: newItem.number?.trim() || null,
          region: baseRegion,
        };
      } else {
        payload = { ...newItem };

        if (table === 'flightinfo') {
          delete payload.label;
          delete payload.type;
          delete payload.prefix;
          delete payload.name;
          delete payload.note;
          delete payload.country;
          delete payload.nickname;
          delete payload.phone;
          delete payload.room_type;
          delete payload.number;
        } else if (table === 'product_types') {
          delete payload.name;
          delete payload.note;
          delete payload.nickname;
          delete payload.phone;
          delete payload.room_type;
          delete payload.number;
        } else {
          delete payload.name;
          delete payload.note;
          delete payload.country;
          delete payload.type;
          delete payload.prefix;
          delete payload.nickname;
          delete payload.phone;
          delete payload.room_type;
          delete payload.number;
        }
      }

      if (
        (table === 'golf_courses' ||
          table === 'product_types' ||
          table === 'partners' ||
          table === 'flightinfo' ||
          table === 'hotel_master') &&
        !payload.code
      ) {
        alert('Code is required.');
        return;
      }

      if (table !== 'golf_courses' && table !== 'guide_master' && table !== 'driver_master') {
        if (table === 'product_types') {
        } else if (effectiveRegion) {
          payload.region = effectiveRegion;
          payload.branch = userBranch;
        } else {
          payload.region = newItem.region || 'ALL';
        }
      }

      await createMasterData(table, payload);
      setNewItem({ ...INITIAL_NEW_ITEM });
      fetchData();
    } catch (err) {
      alert(`Failed to create: ${err.message}`);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure?')) return;
    try {
      await deleteMasterData(table, id);
      fetchData();
    } catch (err) {
      alert(`Failed to delete: ${err.message}`);
    }
  };

  return (
    <div style={{ marginTop: 20 }}>
      <h3 style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 10 }}>{title}</h3>
      {loading && <div>Loading...</div>}
      {error && <div style={{ color: 'red' }}>{error}</div>}

      {/* Create Form */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        {table === 'golf_courses' ? (
          <>
            <input
              placeholder="Code (e.g. SCC)"
              value={newItem.code}
              onChange={(e) => setNewItem({ ...newItem, code: e.target.value.toUpperCase() })}
              className="input"
              style={{ padding: 4, flex: 1 }}
            />
            <select
              value={newItem.country || ''}
              onChange={(e) => setNewItem({ ...newItem, country: e.target.value })}
              className="select"
              style={{ padding: 4, flex: 1 }}
            >
              <option value="">Select Country</option>
              <option value="MANILA">Manila</option>
              <option value="CEBU">Cebu</option>
              <option value="CLARK">Clark</option>
              <option value="SUBIC">Subic</option>
              <option value="FUKUOKA">Fukuoka</option>
              <option value="CHIANGMAI">Chiangmai</option>
            </select>
            <input
              placeholder="Name"
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              className="input"
              style={{ padding: 4, flex: 1 }}
            />
            <input
              placeholder="Note"
              value={newItem.note}
              onChange={(e) => setNewItem({ ...newItem, note: e.target.value })}
              className="input"
              style={{ padding: 4, flex: 1 }}
            />
          </>
        ) : table === 'hotel_master' ? (
          <>
            <input
              placeholder="Code (e.g. H001)"
              value={newItem.code}
              onChange={(e) => setNewItem({ ...newItem, code: e.target.value })}
              className="input"
              style={{ padding: 4, width: 100 }}
            />
            <select
              value={newItem.country || ''}
              onChange={(e) => setNewItem({ ...newItem, country: e.target.value })}
              className="select"
              style={{ padding: 4, width: 140 }}
            >
              <option value="">Country</option>
              <option value="PHILIPPINES">Philippines</option>
              <option value="THAILAND">Thailand</option>
              <option value="JAPAN">Japan</option>
            </select>
            <select
              value={newItem.region || ''}
              onChange={(e) => setNewItem({ ...newItem, region: e.target.value })}
              className="select"
              style={{ padding: 4, width: 140 }}
            >
              <option value="">Region</option>
              {REGION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <input
              placeholder="Name"
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              className="input"
              style={{ padding: 4, flex: 1 }}
            />
            <input
              placeholder="Room Type"
              value={newItem.room_type}
              onChange={(e) => setNewItem({ ...newItem, room_type: e.target.value })}
              className="input"
              style={{ padding: 4, width: 160 }}
            />
            <input
              placeholder="Note"
              value={newItem.note}
              onChange={(e) => setNewItem({ ...newItem, note: e.target.value })}
              className="input"
              style={{ padding: 4, flex: 1 }}
            />
          </>
        ) : table === 'guide_master' ? (
          <>
            <select
              value={newItem.country || ''}
              onChange={(e) => setNewItem({ ...newItem, country: e.target.value })}
              className="select"
              style={{ padding: 4, width: 140 }}
            >
              <option value="">Country</option>
              <option value="PHILIPPINES">Philippines</option>
              <option value="THAILAND">Thailand</option>
              <option value="JAPAN">Japan</option>
            </select>
            <select
              value={newItem.region || ''}
              onChange={(e) => setNewItem({ ...newItem, region: e.target.value })}
              className="select"
              style={{ padding: 4, width: 140 }}
            >
              <option value="">Region</option>
              {REGION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <input
              placeholder="Name"
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              className="input"
              style={{ padding: 4, flex: 1 }}
            />
            <input
              placeholder="Nickname"
              value={newItem.nickname}
              onChange={(e) => setNewItem({ ...newItem, nickname: e.target.value })}
              className="input"
              style={{ padding: 4, width: 160 }}
            />
            <input
              placeholder="Phone"
              value={newItem.phone}
              onChange={(e) => setNewItem({ ...newItem, phone: e.target.value })}
              className="input"
              style={{ padding: 4, width: 160 }}
            />
          </>
        ) : table === 'driver_master' ? (
          <>
            <select
              value={newItem.country || ''}
              onChange={(e) => setNewItem({ ...newItem, country: e.target.value })}
              className="select"
              style={{ padding: 4, width: 140 }}
            >
              <option value="">Country</option>
              <option value="PHILIPPINES">Philippines</option>
              <option value="THAILAND">Thailand</option>
              <option value="JAPAN">Japan</option>
            </select>
            <select
              value={newItem.region || ''}
              onChange={(e) => setNewItem({ ...newItem, region: e.target.value })}
              className="select"
              style={{ padding: 4, width: 140 }}
            >
              <option value="">Region</option>
              {REGION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <input
              placeholder="Name"
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              className="input"
              style={{ padding: 4, flex: 1 }}
            />
            <input
              placeholder="Nickname"
              value={newItem.nickname}
              onChange={(e) => setNewItem({ ...newItem, nickname: e.target.value })}
              className="input"
              style={{ padding: 4, width: 120 }}
            />
            <input
              placeholder="Phone"
              value={newItem.phone}
              onChange={(e) => setNewItem({ ...newItem, phone: e.target.value })}
              className="input"
              style={{ padding: 4, width: 120 }}
            />
          </>
        ) : (
          <>
            <input
              placeholder="Code (e.g. AGP)"
              value={newItem.code}
              onChange={(e) => setNewItem({ ...newItem, code: e.target.value })}
              className="input"
              style={{ padding: 4, width: 100 }}
            />
            {table !== 'flightinfo' && (
              <input
                placeholder="Label"
                value={newItem.label}
                onChange={(e) => setNewItem({ ...newItem, label: e.target.value })}
                className="input"
                style={{ padding: 4, flex: 1 }}
              />
            )}
          </>
        )}

        {table === 'product_types' && (
          <>
            <input
              placeholder="Type (PACKAGE...)"
              value={newItem.type}
              onChange={(e) => setNewItem({ ...newItem, type: e.target.value })}
              className="input"
              style={{ padding: 4, width: 120 }}
            />
            <input
              placeholder="Prefix (e.g. AGP)"
              value={newItem.prefix}
              onChange={(e) => setNewItem({ ...newItem, prefix: e.target.value })}
              className="input"
              style={{ padding: 4, width: 100 }}
            />
          </>
        )}

        {table !== 'golf_courses' &&
          table !== 'guide_master' &&
          table !== 'driver_master' &&
          table !== 'hotel_master' &&
          !effectiveRegion &&
          (table === 'product_types' ? (
            <select
              value={newItem.country || ''}
              onChange={(e) => setNewItem({ ...newItem, country: e.target.value })}
              className="select"
              style={{ padding: 4 }}
            >
              <option value="">Select Country</option>
              {COUNTRY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <select
              value={newItem.region || ''}
              onChange={(e) => setNewItem({ ...newItem, region: e.target.value })}
              className="select"
              style={{ padding: 4 }}
            >
              <option value="">Select Region</option>
              {REGION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ))}

        <button onClick={handleCreate} className="btn primary" style={{ padding: '4px 12px' }}>
          Add
        </button>
      </div>

      {/* List */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'var(--chip)', textAlign: 'left' }}>
            {table === 'golf_courses' ? (
              <>
                <th style={{ padding: '2px 4px', whiteSpace: 'nowrap' }}>Country</th>
                <th style={{ padding: '2px 4px', whiteSpace: 'nowrap' }}>Region</th>
                <th style={{ padding: '2px 4px', whiteSpace: 'nowrap' }}>Code</th>
                <th style={{ padding: '2px 4px', whiteSpace: 'nowrap' }}>Name</th>
                <th style={{ padding: '2px 4px', whiteSpace: 'nowrap' }}>성수기 시작일</th>
                <th style={{ padding: '2px 4px', whiteSpace: 'nowrap' }}>비수기 시작일</th>
                <th style={{ padding: '2px 4px', whiteSpace: 'nowrap' }}>성수기 요금</th>
                <th style={{ padding: '2px 4px', whiteSpace: 'nowrap' }}>비수기 요금</th>
                <th style={{ padding: '2px 4px', whiteSpace: 'nowrap' }}>주중 요금</th>
                <th style={{ padding: '2px 4px', whiteSpace: 'nowrap' }}>주말 요금</th>
                <th style={{ padding: '2px 4px', whiteSpace: 'nowrap' }}>카트비(2인)</th>
                <th style={{ padding: '2px 4px', whiteSpace: 'nowrap' }}>캐디피</th>
                <th style={{ padding: '2px 4px', whiteSpace: 'nowrap' }}>보험료</th>
                <th style={{ padding: '2px 4px', whiteSpace: 'nowrap' }}>컨슈머블</th>
                <th style={{ padding: '2px 4px', whiteSpace: 'nowrap' }}>Note</th>
              </>
            ) : table === 'flightinfo' ? (
              <>
                <th style={{ padding: '2px 8px' }}>Country</th>
                <th style={{ padding: '2px 8px' }}>Airport</th>
                <th style={{ padding: '2px 8px' }}>Code</th>
                <th style={{ padding: '2px 8px' }}>Memo</th>
              </>
            ) : table === 'hotel_master' ? (
              <>
                <th style={{ padding: '2px 4px', whiteSpace: 'nowrap' }}>Country</th>
                <th style={{ padding: '2px 4px', whiteSpace: 'nowrap' }}>Region</th>
                <th style={{ padding: '2px 4px', whiteSpace: 'nowrap' }}>Code</th>
                <th style={{ padding: '2px 4px', whiteSpace: 'nowrap' }}>Name</th>
                <th style={{ padding: '2px 4px', whiteSpace: 'nowrap' }}>Room Type</th>
                <th style={{ padding: '2px 4px', whiteSpace: 'nowrap' }}>Note</th>
              </>
            ) : table === 'guide_master' ? (
              <>
                <th style={{ padding: '2px 8px' }}>Country</th>
                <th style={{ padding: '2px 8px' }}>Region</th>
                <th style={{ padding: '2px 8px' }}>Name</th>
                <th style={{ padding: '2px 8px' }}>Nickname</th>
                <th style={{ padding: '2px 8px' }}>Phone</th>
              </>
            ) : table === 'driver_master' ? (
              <>
                <th style={{ padding: '2px 8px' }}>Country</th>
                <th style={{ padding: '2px 8px' }}>Region</th>
                <th style={{ padding: '2px 8px' }}>Name</th>
                <th style={{ padding: '2px 8px' }}>Nickname</th>
                <th style={{ padding: '2px 8px' }}>Phone</th>
              </>
            ) : (
              <>
                <th style={{ padding: '2px 8px' }}>Code</th>
                <th style={{ padding: '2px 8px' }}>Label</th>
                {table === 'product_types' && (
                  <>
                    <th style={{ padding: '2px 8px' }}>Type</th>
                    <th style={{ padding: '2px 8px' }}>Prefix</th>
                  </>
                )}
              </>
            )}
            {table !== 'golf_courses' &&
              table !== 'flightinfo' &&
              table !== 'hotel_master' &&
              table !== 'guide_master' &&
              table !== 'driver_master' && (
                <th style={{ padding: '2px 8px' }}>
                  {table === 'product_types' ? 'Country' : 'Region'}
                </th>
              )}
            <th style={{ padding: '2px 8px' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {(table === 'golf_courses'
            ? [...data].sort((a, b) => {
                const ca = (a.country || '').localeCompare(b.country || '');
                if (ca !== 0) return ca;
                const ra = (a.region || '').localeCompare(b.region || '');
                if (ra !== 0) return ra;
                return (a.code || '').localeCompare(b.code || '');
              })
            : table === 'hotel_master'
              ? [...data].sort((a, b) => {
                  const ca = (a.country || '').localeCompare(b.country || '');
                  if (ca !== 0) return ca;
                  const ra = (a.region || '').localeCompare(b.region || '');
                  if (ra !== 0) return ra;
                  return (a.name || '').localeCompare(b.name || '');
                })
              : table === 'guide_master'
                ? [...data].sort((a, b) => {
                    const ca = (a.country || '').localeCompare(b.country || '');
                    if (ca !== 0) return ca;
                    const ra = (a.region || '').localeCompare(b.region || '');
                    if (ra !== 0) return ra;
                    return (a.name || '').localeCompare(b.name || '');
                  })
                : table === 'driver_master'
                  ? [...data].sort((a, b) => {
                      const ca = (a.country || '').localeCompare(b.country || '');
                      if (ca !== 0) return ca;
                      const ra = (a.region || '').localeCompare(b.region || '');
                      if (ra !== 0) return ra;
                      return (a.name || '').localeCompare(b.name || '');
                    })
                  : data
          ).map((item) => (
            <tr
              key={item.id}
              style={{ borderBottom: '1px solid var(--line)', cursor: 'pointer' }}
              onClick={() => handleRowClick(item)}
            >
              {table === 'golf_courses' ? (
                <>
                  <td style={{ padding: '2px 4px' }}>{item.country || '-'}</td>
                  <td style={{ padding: '2px 4px' }}>{item.region || '-'}</td>
                  <td style={{ padding: '2px 4px', fontWeight: 'bold' }}>{item.code}</td>
                  <td style={{ padding: '2px 4px' }}>{item.name || '-'}</td>
                  <td style={{ padding: '2px 4px' }}>
                    {item.peak_start_date ? String(item.peak_start_date).slice(0, 10) : '-'}
                  </td>
                  <td style={{ padding: '2px 4px' }}>
                    {item.offpeak_start_date ? String(item.offpeak_start_date).slice(0, 10) : '-'}
                  </td>
                  <td style={{ padding: '2px 4px', textAlign: 'right' }}>
                    {item.peak_price != null ? Number(item.peak_price) : '-'}
                  </td>
                  <td style={{ padding: '2px 4px', textAlign: 'right' }}>
                    {item.offpeak_price != null ? Number(item.offpeak_price) : '-'}
                  </td>
                  <td style={{ padding: '2px 4px', textAlign: 'right' }}>
                    {item.weekday_price != null ? Number(item.weekday_price) : '-'}
                  </td>
                  <td style={{ padding: '2px 4px', textAlign: 'right' }}>
                    {item.weekend_price != null ? Number(item.weekend_price) : '-'}
                  </td>
                  <td style={{ padding: '2px 4px', textAlign: 'right' }}>
                    {item.cart_fee_2pax != null ? Number(item.cart_fee_2pax) : '-'}
                  </td>
                  <td style={{ padding: '2px 4px', textAlign: 'right' }}>
                    {item.caddie_fee != null ? Number(item.caddie_fee) : '-'}
                  </td>
                  <td style={{ padding: '2px 4px', textAlign: 'right' }}>
                    {item.insurance_fee != null ? Number(item.insurance_fee) : '-'}
                  </td>
                  <td style={{ padding: '2px 4px', textAlign: 'right' }}>
                    {item.consumable_fee != null ? Number(item.consumable_fee) : '-'}
                  </td>
                  <td style={{ padding: '2px 4px' }}>{item.note || '-'}</td>
                </>
              ) : table === 'flightinfo' ? (
                <>
                  <td style={{ padding: '2px 8px' }}>{item.country || '-'}</td>
                  <td style={{ padding: '2px 8px' }}>{item.airport || '-'}</td>
                  <td style={{ padding: '2px 8px', fontWeight: 'bold' }}>{item.code}</td>
                  <td style={{ padding: '2px 8px' }}>{item.memo || '-'}</td>
                </>
              ) : table === 'hotel_master' ? (
                <>
                  <td style={{ padding: '2px 4px' }}>{item.country || '-'}</td>
                  <td style={{ padding: '2px 4px' }}>{item.region || '-'}</td>
                  <td style={{ padding: '2px 4px', fontWeight: 'bold' }}>{item.code}</td>
                  <td style={{ padding: '2px 4px' }}>{item.name || '-'}</td>
                  <td style={{ padding: '2px 4px' }}>{item.room_type || '-'}</td>
                  <td style={{ padding: '2px 4px' }}>{item.note || '-'}</td>
                </>
              ) : table === 'guide_master' ? (
                <>
                  <td style={{ padding: '2px 8px' }}>{item.country || '-'}</td>
                  <td style={{ padding: '2px 8px' }}>{item.region || '-'}</td>
                  <td style={{ padding: '2px 8px' }}>{item.name || '-'}</td>
                  <td style={{ padding: '2px 8px' }}>{item.nickname || '-'}</td>
                  <td style={{ padding: '2px 8px' }}>{item.phone || '-'}</td>
                </>
              ) : table === 'driver_master' ? (
                <>
                  <td style={{ padding: '2px 8px' }}>{item.country || '-'}</td>
                  <td style={{ padding: '2px 8px' }}>{item.region || '-'}</td>
                  <td style={{ padding: '2px 8px' }}>{item.name || '-'}</td>
                  <td style={{ padding: '2px 8px' }}>{item.nickname || '-'}</td>
                  <td style={{ padding: '2px 8px' }}>{item.phone || '-'}</td>
                </>
              ) : (
                <>
                  <td style={{ padding: '2px 8px', fontWeight: 'bold' }}>{item.code}</td>
                  <td style={{ padding: '2px 8px' }}>{item.label}</td>
                  {table === 'product_types' && (
                    <>
                      <td style={{ padding: '2px 8px' }}>{item.type}</td>
                      <td style={{ padding: '2px 8px' }}>{item.prefix}</td>
                    </>
                  )}
                </>
              )}
              {table !== 'golf_courses' &&
                table !== 'flightinfo' &&
                table !== 'hotel_master' &&
                table !== 'guide_master' &&
                table !== 'driver_master' && (
                  <td style={{ padding: '2px 8px' }}>
                    {table === 'product_types' ? item.country || '-' : item.region || '-'}
                  </td>
                )}
              <td style={{ padding: '2px 8px' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(item.id);
                  }}
                  style={{
                    border: 'none',
                    background: '#e74c3c',
                    cursor: 'pointer',
                    color: '#fff',
                    fontSize: 12,
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    boxShadow: '0 0 0 1px rgba(0,0,0,0.2)',
                  }}
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.35)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setEditModal(null)}
        >
          <div
            style={{
              background: 'var(--panel)',
              borderRadius: 8,
              border: '1px solid var(--line)',
              padding: 16,
              minWidth: 320,
              maxWidth: 380,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 'bold', fontSize: 14, marginBottom: 12 }}>{title} 수정</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {table === 'golf_courses' ? (
                <>
                  <div>
                    <div className="label">Code</div>
                    <input
                      className="input"
                      value={editModal.code}
                      maxLength={10}
                      onChange={(e) =>
                        setEditModal({ ...editModal, code: e.target.value.toUpperCase() })
                      }
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <div className="label">Country</div>
                    <input
                      className="input"
                      value={editModal.country || ''}
                      maxLength={5}
                      onChange={(e) =>
                        setEditModal({ ...editModal, country: e.target.value.toUpperCase() })
                      }
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <div className="label">Name</div>
                    <input
                      className="input"
                      value={editModal.name || ''}
                      maxLength={50}
                      onChange={(e) => setEditModal({ ...editModal, name: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <div className="label">성수기 시작일</div>
                    <input
                      type="date"
                      className="input"
                      value={editModal.peak_start_date || ''}
                      onChange={(e) =>
                        setEditModal({ ...editModal, peak_start_date: e.target.value })
                      }
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <div className="label">비수기 시작일</div>
                    <input
                      type="date"
                      className="input"
                      value={editModal.offpeak_start_date || ''}
                      onChange={(e) =>
                        setEditModal({ ...editModal, offpeak_start_date: e.target.value })
                      }
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <div className="label">성수기 요금</div>
                    <input
                      type="number"
                      className="input"
                      value={editModal.peak_price}
                      onChange={(e) => setEditModal({ ...editModal, peak_price: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <div className="label">비수기 요금</div>
                    <input
                      type="number"
                      className="input"
                      value={editModal.offpeak_price}
                      onChange={(e) =>
                        setEditModal({ ...editModal, offpeak_price: e.target.value })
                      }
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <div className="label">주중 요금</div>
                    <input
                      type="number"
                      className="input"
                      value={editModal.weekday_price}
                      onChange={(e) =>
                        setEditModal({ ...editModal, weekday_price: e.target.value })
                      }
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <div className="label">주말 요금</div>
                    <input
                      type="number"
                      className="input"
                      value={editModal.weekend_price}
                      onChange={(e) =>
                        setEditModal({ ...editModal, weekend_price: e.target.value })
                      }
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <div className="label">카트비(2인)</div>
                    <input
                      type="number"
                      className="input"
                      value={editModal.cart_fee_2pax}
                      onChange={(e) =>
                        setEditModal({ ...editModal, cart_fee_2pax: e.target.value })
                      }
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <div className="label">캐디피</div>
                    <input
                      type="number"
                      className="input"
                      value={editModal.caddie_fee}
                      onChange={(e) => setEditModal({ ...editModal, caddie_fee: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <div className="label">보험료</div>
                    <input
                      type="number"
                      className="input"
                      value={editModal.insurance_fee}
                      onChange={(e) =>
                        setEditModal({ ...editModal, insurance_fee: e.target.value })
                      }
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <div className="label">컨슈머블</div>
                    <input
                      type="number"
                      className="input"
                      value={editModal.consumable_fee}
                      onChange={(e) =>
                        setEditModal({ ...editModal, consumable_fee: e.target.value })
                      }
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <div className="label">Note</div>
                    <input
                      className="input"
                      value={editModal.note || ''}
                      maxLength={100}
                      onChange={(e) => setEditModal({ ...editModal, note: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                  {!effectiveRegion && (
                    <div>
                      <div className="label">Region</div>
                      <select
                        className="select"
                        value={editModal.region || ''}
                        onChange={(e) => setEditModal({ ...editModal, region: e.target.value })}
                        style={{ width: '100%' }}
                      >
                        <option value="">Select Region</option>
                        {REGION_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              ) : table === 'flightinfo' ? (
                <>
                  <div>
                    <div className="label">Code</div>
                    <input
                      className="input"
                      value={editModal.code}
                      maxLength={10}
                      onChange={(e) => setEditModal({ ...editModal, code: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <div className="label">Country</div>
                    <input
                      className="input"
                      value={editModal.country || ''}
                      maxLength={5}
                      onChange={(e) => setEditModal({ ...editModal, country: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <div className="label">Airport</div>
                    <input
                      className="input"
                      value={editModal.airport || ''}
                      maxLength={5}
                      onChange={(e) => setEditModal({ ...editModal, airport: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <div className="label">Memo</div>
                    <input
                      className="input"
                      value={editModal.label || ''}
                      maxLength={100}
                      onChange={(e) => setEditModal({ ...editModal, label: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                  {!effectiveRegion && (
                    <div>
                      <div className="label">Region</div>
                      <select
                        className="select"
                        value={editModal.region || ''}
                        onChange={(e) => setEditModal({ ...editModal, region: e.target.value })}
                        style={{ width: '100%' }}
                      >
                        <option value="">Select Region</option>
                        {REGION_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              ) : table === 'hotel_master' ? (
                <>
                  <div>
                    <div className="label">Code</div>
                    <input
                      className="input"
                      value={editModal.code}
                      maxLength={20}
                      onChange={(e) => setEditModal({ ...editModal, code: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <div className="label">Country</div>
                    <select
                      className="select"
                      value={editModal.country || ''}
                      onChange={(e) => setEditModal({ ...editModal, country: e.target.value })}
                      style={{ width: '100%' }}
                    >
                      <option value="">Select Country</option>
                      {COUNTRY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="label">Name</div>
                    <input
                      className="input"
                      value={editModal.name || ''}
                      maxLength={80}
                      onChange={(e) => setEditModal({ ...editModal, name: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <div className="label">Room Type</div>
                    <input
                      className="input"
                      value={editModal.room_type || ''}
                      maxLength={80}
                      onChange={(e) => setEditModal({ ...editModal, room_type: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <div className="label">Note</div>
                    <input
                      className="input"
                      value={editModal.note || ''}
                      maxLength={200}
                      onChange={(e) => setEditModal({ ...editModal, note: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                  {!effectiveRegion && (
                    <div>
                      <div className="label">Region</div>
                      <select
                        className="select"
                        value={editModal.region || ''}
                        onChange={(e) => setEditModal({ ...editModal, region: e.target.value })}
                        style={{ width: '100%' }}
                      >
                        <option value="">Select Region</option>
                        {REGION_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              ) : table === 'guide_master' ? (
                <>
                  <div>
                    <div className="label">Country</div>
                    <select
                      className="select"
                      value={editModal.country || ''}
                      onChange={(e) => setEditModal({ ...editModal, country: e.target.value })}
                      style={{ width: '100%' }}
                    >
                      <option value="">Select Country</option>
                      {COUNTRY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="label">Name</div>
                    <input
                      className="input"
                      value={editModal.name || ''}
                      maxLength={80}
                      onChange={(e) => setEditModal({ ...editModal, name: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <div className="label">Nickname</div>
                    <input
                      className="input"
                      value={editModal.nickname || ''}
                      maxLength={80}
                      onChange={(e) => setEditModal({ ...editModal, nickname: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <div className="label">Phone</div>
                    <input
                      className="input"
                      value={editModal.phone || ''}
                      maxLength={80}
                      onChange={(e) => setEditModal({ ...editModal, phone: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                  {!effectiveRegion && (
                    <div>
                      <div className="label">Region</div>
                      <select
                        className="select"
                        value={editModal.region || ''}
                        onChange={(e) => setEditModal({ ...editModal, region: e.target.value })}
                        style={{ width: '100%' }}
                      >
                        <option value="">Select Region</option>
                        {REGION_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              ) : table === 'vehicle_master' ? (
                <>
                  <div>
                    <div className="label">Country</div>
                    <select
                      className="select"
                      value={editModal.country || ''}
                      onChange={(e) => setEditModal({ ...editModal, country: e.target.value })}
                      style={{ width: '100%' }}
                    >
                      <option value="">Select Country</option>
                      {COUNTRY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="label">Name</div>
                    <input
                      className="input"
                      value={editModal.name || ''}
                      maxLength={80}
                      onChange={(e) => setEditModal({ ...editModal, name: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <div className="label">Number</div>
                    <input
                      className="input"
                      value={editModal.number || ''}
                      maxLength={80}
                      onChange={(e) => setEditModal({ ...editModal, number: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                  {!effectiveRegion && (
                    <div>
                      <div className="label">Region</div>
                      <select
                        className="select"
                        value={editModal.region || ''}
                        onChange={(e) => setEditModal({ ...editModal, region: e.target.value })}
                        style={{ width: '100%' }}
                      >
                        <option value="">Select Region</option>
                        {REGION_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              ) : table === 'driver_master' ? (
                <>
                  <div>
                    <div className="label">Country</div>
                    <select
                      className="select"
                      value={editModal.country || ''}
                      onChange={(e) => setEditModal({ ...editModal, country: e.target.value })}
                      style={{ width: '100%' }}
                    >
                      <option value="">Select Country</option>
                      {COUNTRY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="label">Region</div>
                    <select
                      className="select"
                      value={editModal.region || ''}
                      onChange={(e) => setEditModal({ ...editModal, region: e.target.value })}
                      style={{ width: '100%' }}
                    >
                      <option value="">Select Region</option>
                      {REGION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="label">Name</div>
                    <input
                      className="input"
                      value={editModal.name || ''}
                      maxLength={80}
                      onChange={(e) => setEditModal({ ...editModal, name: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <div className="label">Nickname</div>
                    <input
                      className="input"
                      value={editModal.nickname || ''}
                      maxLength={80}
                      onChange={(e) => setEditModal({ ...editModal, nickname: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <div className="label">Phone</div>
                    <input
                      className="input"
                      value={editModal.phone || ''}
                      maxLength={80}
                      onChange={(e) => setEditModal({ ...editModal, phone: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                </>
              ) : table === 'product_types' ? (
                <>
                  <div>
                    <div className="label">Code</div>
                    <input
                      className="input"
                      value={editModal.code}
                      maxLength={10}
                      onChange={(e) => setEditModal({ ...editModal, code: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <div className="label">Label</div>
                    <input
                      className="input"
                      value={editModal.label}
                      maxLength={10}
                      onChange={(e) => setEditModal({ ...editModal, label: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <div className="label">Type</div>
                    <input
                      className="input"
                      value={editModal.type || ''}
                      maxLength={20}
                      onChange={(e) => setEditModal({ ...editModal, type: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <div className="label">Prefix</div>
                    <input
                      className="input"
                      value={editModal.prefix || ''}
                      maxLength={10}
                      onChange={(e) => setEditModal({ ...editModal, prefix: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                  {!effectiveRegion && (
                    <div>
                      <div className="label">Country</div>
                      <select
                        className="select"
                        value={editModal.country || ''}
                        onChange={(e) => setEditModal({ ...editModal, country: e.target.value })}
                        style={{ width: '100%' }}
                      >
                        <option value="">Select Country</option>
                        {COUNTRY_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div>
                    <div className="label">Code</div>
                    <input
                      className="input"
                      value={editModal.code}
                      maxLength={10}
                      onChange={(e) => setEditModal({ ...editModal, code: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <div className="label">Label</div>
                    <input
                      className="input"
                      value={editModal.label}
                      maxLength={10}
                      onChange={(e) => setEditModal({ ...editModal, label: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                  {!effectiveRegion && (
                    <div>
                      <div className="label">Region</div>
                      <select
                        className="select"
                        value={editModal.region || ''}
                        onChange={(e) => setEditModal({ ...editModal, region: e.target.value })}
                        style={{ width: '100%' }}
                      >
                        <option value="">Select Region</option>
                        {REGION_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button
                className="btn secondary"
                style={{ padding: '6px 12px', fontSize: 12 }}
                onClick={() => setEditModal(null)}
              >
                Cancel
              </button>
              <button
                className="btn primary"
                style={{ padding: '6px 12px', fontSize: 12 }}
                onClick={handleUpdate}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const { userBranch, userRole } = useBranchFilter();
  const [activeTab, setActiveTab] = useState('products');

  const tabs = [
    { id: 'products', label: 'Product Types' },
    { id: 'partners', label: 'Partners' },
    { id: 'flights', label: 'Flight Info' },
    { id: 'golf', label: 'Golf Courses' },
    { id: 'hotels', label: 'Hotels' },
    { id: 'guides', label: 'Guides' },
    { id: 'drivers', label: 'Drivers' },
  ];

  return (
    <div style={{ marginTop: 14 }}>
      <div className="card">
        <div style={{ fontWeight: 900, marginBottom: 6 }}>Settings</div>
        <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.5 }}>
          Manage master data for your office.
        </div>
        <hr />

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '6px 12px',
                border: 'none',
                background: activeTab === tab.id ? 'var(--accent)' : 'var(--chip)',
                color: activeTab === tab.id ? '#fff' : 'var(--text)',
                borderRadius: 4,
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: 12,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === 'products' && (
          <MasterDataSection
            title="Product Types"
            table="product_types"
            userBranch={userBranch}
            userRole={userRole}
          />
        )}
        {activeTab === 'partners' && (
          <MasterDataSection
            title="Partners"
            table="partners"
            userBranch={userBranch}
            userRole={userRole}
          />
        )}
        {activeTab === 'flights' && (
          <MasterDataSection
            title="Flight Info"
            table="flightinfo"
            userBranch={userBranch}
            userRole={userRole}
          />
        )}
        {activeTab === 'golf' && (
          <MasterDataSection
            title="Golf Courses"
            table="golf_courses"
            userBranch={userBranch}
            userRole={userRole}
          />
        )}
        {activeTab === 'hotels' && (
          <MasterDataSection
            title="Hotels"
            table="hotel_master"
            userBranch={userBranch}
            userRole={userRole}
          />
        )}
        {activeTab === 'guides' && (
          <MasterDataSection
            title="Guides"
            table="guide_master"
            userBranch={userBranch}
            userRole={userRole}
          />
        )}
        {activeTab === 'drivers' && (
          <MasterDataSection
            title="Drivers"
            table="driver_master"
            userBranch={userBranch}
            userRole={userRole}
          />
        )}
      </div>
    </div>
  );
}
