import { useEffect, useMemo, useState } from 'react';

export default function BookingCodeSection({
  isNew,
  productCode,
  partnerCode,
  baseDate,
  holidayNotices = [],
  filteredProductTypes,
  filteredPartners,
  errors,
  register,
  setValue,
  regionLocked,
  bookingCode,
  suggestedCode,
  onApplySuggestedCode,
  extraActions,
}) {
  const [toast, setToast] = useState(null);
  const [productLabel, setProductLabel] = useState('');
  const [partnerLabel, setPartnerLabel] = useState('');

  // Sync labels when codes change (from parent or selection)
  useEffect(() => {
    const type = filteredProductTypes.find((t) => t.code === productCode);
    if (type) setProductLabel(type.label);
    // Do not clear label if code is empty, as user might be typing to search
  }, [productCode, filteredProductTypes]);

  useEffect(() => {
    const partner = filteredPartners.find((p) => p.code === partnerCode);
    if (partner) setPartnerLabel(partner.label);
    // Do not clear label if code is empty, as user might be typing to search
  }, [partnerCode, filteredPartners]);

  // Derived filtered lists based on local search inputs
  const displayProductTypes = useMemo(() => {
    // If input label matches exactly the selected item's label, show all options
    // This allows user to see the full list after making a selection
    const selected = filteredProductTypes.find((t) => t.code === productCode);
    if (selected && productLabel === selected.label) {
      return filteredProductTypes;
    }
    // Otherwise filter by input label
    return filteredProductTypes.filter((t) =>
      t.label.toLowerCase().includes(productLabel.toLowerCase())
    );
  }, [filteredProductTypes, productLabel, productCode]);

  const displayPartners = useMemo(() => {
    const selected = filteredPartners.find((p) => p.code === partnerCode);
    if (selected && partnerLabel === selected.label) {
      return filteredPartners;
    }
    return filteredPartners.filter((p) =>
      p.label.toLowerCase().includes(partnerLabel.toLowerCase())
    );
  }, [filteredPartners, partnerLabel, partnerCode]);

  const showToast = () => {
    setToast('먼저 나라를 선택해주세요 / Please select a country first');
    setTimeout(() => setToast(null), 200);
  };

  return (
    <div
      style={{
        padding: '16px',
        background: 'var(--panel)',
        borderRadius: 8,
        marginBottom: 20,
        border: '1px solid var(--line)',
        position: 'relative',
      }}
    >
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '10%',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0, 0, 0, 0.8)',
            color: '#fff',
            padding: '8px 16px',
            borderRadius: 4,
            zIndex: 9999,
            fontSize: 14,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            textAlign: 'center',
          }}
        >
          {toast}
        </div>
      )}
      <div style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 12, color: 'var(--muted)' }}>
        Booking Code Generation (Required)
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr', gap: 16 }}>
        <div style={{ position: 'relative' }}>
          {regionLocked && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 10,
                cursor: 'not-allowed',
              }}
              onClick={(e) => {
                e.stopPropagation();
                showToast();
              }}
            />
          )}
          <div className="label" style={{ marginBottom: 5 }}>
            Product Type <span style={{ color: 'red' }}>*</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select
              className="select"
              style={{ flex: 1, border: '1px solid rgba(241, 196, 15, 0.5)' }}
              value={productCode || ''}
              onChange={(e) => setValue('product_code', e.target.value)}
              disabled={regionLocked}
            >
              <option value="">Select Type...</option>
              {!displayProductTypes.some((t) => t.code === productCode) && productCode && (
                <option value={productCode}>{productCode}</option>
              )}
              {displayProductTypes.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.label}
                </option>
              ))}
            </select>
            <input
              className="input"
              placeholder="Direct Input"
              value={productLabel}
              onChange={(e) => {
                const val = e.target.value;
                setProductLabel(val);
                // If the current code is no longer in the filtered list (and not empty), clear it?
                // Or if there is an exact match, select it?
                const exactMatch = filteredProductTypes.find(
                  (t) => t.label.toLowerCase() === val.toLowerCase()
                );
                if (exactMatch) {
                  setValue('product_code', exactMatch.code);
                }
              }}
              onBlur={() => {
                const val = (productLabel || '').trim();
                if (val) {
                  const match = filteredProductTypes.find(
                    (t) => t.label.toLowerCase() === val.toLowerCase()
                  );
                  if (match) {
                    setValue('product_code', match.code);
                  } else {
                    setValue('product_code', val.toUpperCase());
                  }
                }
              }}
              style={{ flex: 1, border: '1px solid rgba(241, 196, 15, 0.5)' }}
              disabled={regionLocked}
            />
            <input
              className="input"
              {...register('product_code', { required: 'Product Type is required' })}
              placeholder="Code"
              style={{
                width: 70,
                textAlign: 'center',
                border: '1px solid rgba(241, 196, 15, 0.5)',
              }}
              disabled={regionLocked}
            />
          </div>
          {errors.product_code && (
            <span style={{ color: 'red', fontSize: 12 }}>{errors.product_code.message}</span>
          )}
        </div>

        <div style={{ position: 'relative' }}>
          {regionLocked && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 10,
                cursor: 'not-allowed',
              }}
              onClick={(e) => {
                e.stopPropagation();
                showToast();
              }}
            />
          )}
          <div className="label" style={{ marginBottom: 5 }}>
            Partner <span style={{ color: 'red' }}>*</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select
              className="select"
              style={{ flex: 1, border: '1px solid rgba(241, 196, 15, 0.5)' }}
              value={partnerCode || ''}
              onChange={(e) => setValue('partner_code', e.target.value)}
              disabled={regionLocked}
            >
              <option value="">Select Partner...</option>
              {!displayPartners.some((p) => p.code === partnerCode) && partnerCode && (
                <option value={partnerCode}>{partnerCode}</option>
              )}
              {displayPartners.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.label}
                </option>
              ))}
            </select>
            <input
              className="input"
              placeholder="Direct Input"
              value={partnerLabel}
              onChange={(e) => {
                const val = e.target.value;
                setPartnerLabel(val);
                const exactMatch = filteredPartners.find(
                  (p) => p.label.toLowerCase() === val.toLowerCase()
                );
                if (exactMatch) {
                  setValue('partner_code', exactMatch.code);
                }
              }}
              onBlur={() => {
                const val = (partnerLabel || '').trim();
                if (val) {
                  const match = filteredPartners.find(
                    (p) => p.label.toLowerCase() === val.toLowerCase()
                  );
                  if (match) {
                    setValue('partner_code', match.code);
                  } else {
                    setValue('partner_code', val.toUpperCase());
                  }
                }
              }}
              style={{ flex: 1, border: '1px solid rgba(241, 196, 15, 0.5)' }}
              disabled={regionLocked}
            />
            <input
              className="input"
              {...register('partner_code', { required: 'Partner is required' })}
              placeholder="Code"
              style={{
                width: 70,
                textAlign: 'center',
                border: '1px solid rgba(241, 196, 15, 0.5)',
              }}
              disabled={regionLocked}
            />
          </div>
          {errors.partner_code && (
            <span style={{ color: 'red', fontSize: 12 }}>{errors.partner_code.message}</span>
          )}
        </div>
      </div>

      <div
        style={{
          marginTop: 12,
          fontSize: 13,
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr',
          gap: 16,
          alignItems: 'flex-start',
        }}
      >
        <div>
          <div className="label" style={{ marginBottom: 5 }}>
            Base Date <span style={{ color: 'red' }}>*</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="date"
              className="input"
              {...register('base_date', { required: 'Base Date is required' })}
              style={{ width: 180, maxWidth: '100%', fontSize: 16 }} // Increased font size
            />
            {holidayNotices && holidayNotices.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {holidayNotices.map((t, idx) => (
                  <div
                    key={idx}
                    style={{
                      fontSize: 16, // Increased font size to match input/product type
                      fontWeight: 800,
                      color: '#f1c40f',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t}
                  </div>
                ))}
              </div>
            )}
          </div>
          {errors.base_date && (
            <span style={{ color: 'red', fontSize: 12 }}>{errors.base_date.message}</span>
          )}
        </div>
        <div
          style={{
            color: 'var(--accent)',
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
          }}
        >
          <span style={{ marginBottom: 4 }}>Booking Code</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
            <input
              className="input"
              {...register('booking_code')}
              style={{
                flex: 1,
                width: '100%',
              }}
              placeholder="직접 입력 또는 추천 코드 사용"
            />
            {extraActions}
          </div>
          {suggestedCode && suggestedCode !== bookingCode && (
            <div
              style={{
                marginTop: 4,
                fontSize: 11,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span style={{ color: 'var(--muted)' }}>Suggested:</span>
              <span style={{ fontWeight: 600 }}>{suggestedCode}</span>
              {onApplySuggestedCode && (
                <button
                  type="button"
                  onClick={onApplySuggestedCode}
                  style={{
                    padding: '2px 6px',
                    fontSize: 10,
                    cursor: 'pointer',
                    borderRadius: 4,
                    border: '1px solid var(--accent)',
                    background: 'transparent',
                    color: 'var(--accent)',
                  }}
                >
                  Use
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
