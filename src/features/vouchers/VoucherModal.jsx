import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import CustomerNameFields from '../../common/components/CustomerNameFields.jsx';
import { getMasterData } from '../../features/settings/settingsApi';
import { todayISO } from '../../utils/date';

const STATUS_OPTIONS = [
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

const PAID_STATUS_OPTIONS = ['UNPAID', 'PARTIAL', 'PAID'];

export default function VoucherModal({ isOpen, onClose, onSubmit, initialData }) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    getValues,
    formState: { errors },
  } = useForm({
    defaultValues: {
      status: 'NEW',
      currency: 'PHP',
      play_date: todayISO(),
      booking_code: '',
      partner_name: 'Monkey Travel',
      pax: 4,
      amount: 0,
      paid_status: 'UNPAID',
      manager: '',
      reserver_name: '',
      customer_name: '',
      request_note: '',
    },
  });

  const [scheduleManualFlag, setScheduleManualFlag] = useState(false);

  const playDate = watch('play_date');
  const bookingCode = watch('booking_code');
  const schedule1Time = watch('schedule_1_time');
  const schedule1Voucher = watch('schedule_1_voucher');
  // Fetch Golf Courses for Philippines
  const { data: golfCourses = [] } = useQuery({
    queryKey: ['golf_courses'],
    queryFn: () => getMasterData('golf_courses'),
    staleTime: 1000 * 60 * 5,
  });

  const philippineGolfCourses = golfCourses.filter((g) => {
    const isPhilippines =
      g.country === 'PHILIPPINES' || ['MANILA', 'CEBU', 'CLARK', 'SUBIC'].includes(g.country);
    const isRegionPhilippines = g.region === 'PHILIPPINES';
    return isPhilippines || isRegionPhilippines;
  });

  const schedule1Course = watch('schedule_1_course');
  const pax = watch('pax');

  // Suggested Code Logic
  const suggestedVoucherCode = useMemo(() => {
    if (!playDate || !pax || !schedule1Course) return '';

    const dateObj = new Date(playDate);
    if (Number.isNaN(dateObj.getTime())) return '';
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const mmdd = `${mm}${dd}`;

    const partnerCode = 'MK'; // Hardcoded for Monkey Travel

    // Find course code
    const courseObj = philippineGolfCourses.find(
      (g) => g.code === schedule1Course || g.name === schedule1Course
    );

    let suffix = '';
    if (courseObj && courseObj.code) {
      suffix = courseObj.code;
    } else {
      // If manually typed or no code, use the value itself, cleaned up
      suffix = String(schedule1Course).replace(/\s/g, '').toUpperCase();
      // Optionally truncate if needed, but user examples vary
    }

    return `GONLY${mmdd}-${partnerCode}${pax}${suffix}`;
  }, [playDate, pax, schedule1Course, philippineGolfCourses]);

  // Status Automation
  const currentStatus = watch('status');
  const paidStatus = watch('paid_status');
  const schedule1Text = watch('schedule_1_text'); // Text
  const schedule1Date = watch('schedule_1_date');
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    // Only automate status if editing an existing voucher
    if (!initialData) return;

    const current = getValues('status');
    if (current === 'CANCLE') return; // Don't override cancelled
    if (current === 'CLOSED') return; // Don't override closed

    let nextStatus = current;
    let shouldUpdate = false;

    // 1. Date Passed -> CLOSED (Based on Golf Schedule Date AND Paid Status)
    if (schedule1Date && schedule1Date < today && paidStatus === 'PAID') {
      nextStatus = 'CLOSED';
      shouldUpdate = true;
    } else {
      // 2. Change Tee (>>) -> REQUESTED
      if (schedule1Text && String(schedule1Text).includes('>>')) {
        if (current !== 'REQUESTED') {
          nextStatus = 'REQUESTED';
          shouldUpdate = true;
        }
      }
      // 3. Paid -> DEPOSIT (Only if NEW?)
      else if (paidStatus === 'PAID' && current === 'NEW') {
        nextStatus = 'DEPOSIT';
        shouldUpdate = true;
      }
    }

    if (shouldUpdate && nextStatus !== current) {
      setValue('status', nextStatus);
    }
  }, [playDate, schedule1Text, paidStatus, today, setValue, getValues, initialData, schedule1Date]);

  // Effect: Handle Initial Data & Reset
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // Parse Existing Schedule Strings if possible
        // Expected format from DB: "MM/DD HH:MM CourseName Note"
        // We will try to extract what we can, but primarily load into "Note" if complex.
        const parsedData = { ...initialData };

        const parseSchedule = (str) => {
          if (!str) {
            return {
              date: '',
              time: '',
              course: '',
              courseCode: '',
              voucher: '',
              changeTee: false,
            };
          }

          let tempStr = str;
          let date = '';
          let time = '';
          let changeTee = false;

          // 1. Check Change Tee
          if (tempStr.includes('[CH_TEE]')) {
            changeTee = true;
            tempStr = tempStr.replace('[CH_TEE]', '');
          } else if (initialData.change_tee_time_1) {
            changeTee = true;
          }

          // 2. Extract Date (MM/DD)
          const dateMatch = tempStr.match(/(\d{1,2})\/(\d{1,2})/);
          if (dateMatch) {
            const [full, m, d] = dateMatch;
            // Need year. Use initialData.play_date year or current year.
            const baseDate = initialData.play_date ? new Date(initialData.play_date) : new Date();
            const year = baseDate.getFullYear();
            const mm = m.padStart(2, '0');
            const dd = d.padStart(2, '0');
            date = `${year}-${mm}-${dd}`;
            tempStr = tempStr.replace(full, '');
          }

          // 3. Extract Time (HH:MM)
          const timeMatch = tempStr.match(/(\d{1,2}):(\d{1,2})/);
          if (timeMatch) {
            const [full, h, min] = timeMatch;
            time = `${h.padStart(2, '0')}:${min.padStart(2, '0')}`;
            tempStr = tempStr.replace(full, '');
          }

          // 4. Remaining is Course + Extras
          // We put it all in 'course' so it appears in the input
          const course = tempStr.trim();

          return {
            date,
            time,
            course,
            courseCode: '',
            voucher: '',
            changeTee,
          };
        };

        const raw1 = initialData.schedule_1;
        const { date, time, course, changeTee } = parseSchedule(raw1);

        // Use parsed values if initialData fields are empty
        parsedData.schedule_1_date = initialData.schedule_1_date || date || '';
        parsedData.schedule_1_time = initialData.schedule_1_time || time || '';
        parsedData.schedule_1_course = initialData.schedule_1_course || course || '';
        parsedData.schedule_1_change_tee = changeTee;
        parsedData.schedule_1_text = raw1; // Populate the text field with the full string

        reset({
          ...parsedData,
          play_date: initialData.play_date?.slice(0, 10) || todayISO(),
          currency: 'PHP',
          product_code: 'GONLY',
          partner_name: 'Monkey Travel',
        });
      } else {
        reset({
          status: 'NEW',
          play_date: todayISO(),
          currency: 'PHP',
          product_code: 'GONLY',
          partner_name: 'Monkey Travel',
          pax: 4,
          amount: 0,
          paid_status: 'UNPAID',
          manager: '',
          reserver_name: '',
          customer_name: '',
          customer_name_en: '',
          booking_code: '',
          request_note: '',
          title: 'New Voucher',
          schedule_1_voucher: '',
          schedule_1_text: '',
          schedule_1_time: '10:00',
        });
        setScheduleManualFlag(false);
      }
    }
  }, [isOpen, initialData, reset]);

  if (!isOpen) return null;

  const buildScheduleText = () => {
    const date = getValues('schedule_1_date');
    const time = getValues('schedule_1_time');
    const course = getValues('schedule_1_course');
    const courseCode = getValues('schedule_1_course_code');
    const voucher = getValues('schedule_1_voucher');
    const changeTee = getValues('schedule_1_change_tee');

    if (!date && !time && !course && !courseCode && !voucher && !changeTee) return '';

    let mmdd = '';
    if (date) {
      const d = new Date(date);
      if (!isNaN(d.getTime())) {
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        mmdd = `${mm}/${dd}`;
      }
    }

    let timePart = '';
    if (time) {
      const [hh, min] = time.split(':');
      if (hh && min) {
        timePart = `${hh}:${min}`;
      }
    }

    const namePart = course ? ` ${course}` : '';
    // User requested format: "1/23 KCC 1:11 >>" (Date Course Time >>)
    let result = `${mmdd}${namePart}${timePart ? ` ${timePart}` : ''}`.trim();

    const extra = [];
    if (courseCode) extra.push(courseCode);
    if (voucher) extra.push(voucher);
    if (extra.length) {
      result += ` ${extra.join(' ')}`;
    }

    if (changeTee) {
      result += ' >>';
    }

    return result.trim();
  };

  const handleAutoFill = () => {
    if (scheduleManualFlag) return;
    const text = buildScheduleText();
    setValue('schedule_1_text', text);
  };

  const ensureDateDefault = (fieldName) => {
    const val = getValues(fieldName);
    if (!val && playDate) {
      setValue(fieldName, playDate);
    }
  };

  const onSave = (data) => {
    const cleaned = { ...data };

    cleaned.schedule_1 = data.schedule_1_text || '';
    // cleaned.change_tee_time_1 = data.schedule_1_change_tee; // Removed to prevent schema error

    // Map customer_name to reserver_name if reserver_name is empty
    if (!cleaned.reserver_name && cleaned.customer_name) {
      cleaned.reserver_name = cleaned.customer_name;
    }

    delete cleaned.customer_name;
    delete cleaned.customer_name_en;
    delete cleaned.schedule_1_text;
    delete cleaned.schedule_1_date;
    delete cleaned.schedule_1_time;
    delete cleaned.schedule_1_course;
    delete cleaned.schedule_1_course_code;
    delete cleaned.schedule_1_voucher;
    delete cleaned.schedule_1_change_tee;

    delete cleaned.product_code;
    delete cleaned.title;

    // Ensure fixed values
    cleaned.partner_name = 'Monkey Travel';
    cleaned.currency = 'PHP';

    onSubmit(cleaned);
  };

  // Styles reused to match BookingDetailPage look-and-feel
  const containerStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  };

  const modalStyle = {
    background: '#1e1e1e', // Dark theme background
    padding: 24,
    borderRadius: 12,
    width: 1100,
    maxWidth: '95%',
    maxHeight: '90vh',
    overflowY: 'auto',
    border: '1px solid #333',
    color: '#ecf0f1',
    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
  };

  const headerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: 20,
    borderBottom: '1px solid #333',
    paddingBottom: 10,
  };

  const sectionStyle = {
    background: '#2c3e50',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    border: '1px solid #34495e',
  };

  const labelStyle = { fontSize: 12, fontWeight: 600, color: '#bdc3c7', marginBottom: 6 };
  const inputStyle = {
    background: '#34495e',
    border: '1px solid #465c71',
    color: 'white',
    padding: '8px 10px',
    borderRadius: 4,
    width: '100%',
    fontSize: 14,
    boxSizing: 'border-box', // Ensure padding doesn't affect width
  };

  const readOnlyInputStyle = {
    ...inputStyle,
    background: '#233040',
    color: '#95a5a6',
    cursor: 'not-allowed',
    border: '1px solid #2c3e50',
  };

  const checkboxLabelStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    color: '#bdc3c7',
    whiteSpace: 'nowrap',
  };

  return (
    <div style={containerStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 'bold' }}>
              {initialData
                ? `Edit Voucher (${initialData.booking_code || 'GONLY'})`
                : 'New Golf Voucher'}
            </h2>
            <span
              style={{
                background: '#f1c40f',
                color: '#000',
                padding: '4px 8px',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 'bold',
              }}
            >
              Philippines
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#bdc3c7',
              fontSize: 24,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit(onSave)}>
          {/* Top Section: Booking Code & Product Info (Like BookingCodeSection) */}
          <div style={sectionStyle}>
            <div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 15,
                  marginBottom: 15,
                }}
              >
                <div>
                  <div style={labelStyle}>Product Type</div>
                  <input style={readOnlyInputStyle} value="GONLY (Golf Only)" readOnly />
                </div>
                <div>
                  <div style={labelStyle}>Partner</div>
                  <input style={readOnlyInputStyle} value="Monkey Travel" readOnly />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 15 }}>
                <div>
                  <div style={labelStyle}>Base Date</div>
                  <input
                    type="date"
                    style={inputStyle}
                    {...register('play_date', { required: true })}
                  />
                </div>
                <div>
                  <div style={labelStyle}>Booking Code</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      style={{
                        ...inputStyle,
                        flex: 1,
                      }}
                      {...register('booking_code', { required: true })}
                      placeholder="Manual Input or Use Suggested Code"
                    />
                  </div>
                  {suggestedVoucherCode && suggestedVoucherCode !== bookingCode && (
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 11,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <span style={{ color: '#95a5a6' }}>Suggested Code:</span>
                      <span style={{ fontWeight: 600, color: '#ecf0f1' }}>
                        {suggestedVoucherCode}
                      </span>
                      <button
                        type="button"
                        onClick={() => setValue('booking_code', suggestedVoucherCode)}
                        style={{
                          padding: '2px 6px',
                          fontSize: 10,
                          cursor: 'pointer',
                          borderRadius: 4,
                          border: '1px solid #f1c40f',
                          background: 'transparent',
                          color: '#f1c40f',
                        }}
                      >
                        Use
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ marginTop: 12, fontSize: 12, color: '#95a5a6' }}>
                * This voucher is processed as a <strong>GONLY</strong> booking for the{' '}
                <strong>Philippines</strong> region. The booking code serves as the booking title.
              </div>
            </div>
          </div>

          {/* Middle Section: Main Grid (Like BookingDetailPage Main Info) */}
          <div
            style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20, marginBottom: 20 }}
          >
            {/* Left: Basic Info */}
            <div style={sectionStyle}>
              <h3
                style={{
                  marginTop: 0,
                  fontSize: 16,
                  color: '#f39c12',
                  marginBottom: 15,
                  borderBottom: '1px solid #34495e',
                  paddingBottom: 8,
                }}
              >
                Basic Info
              </h3>

              <div style={{ marginBottom: 15 }}>
                <div style={labelStyle}>Status</div>
                <select style={inputStyle} {...register('status')}>
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <CustomerNameFields
                register={register}
                watch={watch}
                setValue={setValue}
                layout="voucher"
              />

              <div>
                <div style={labelStyle}>Manager</div>
                <input style={inputStyle} {...register('manager')} placeholder="Manager Name" />
              </div>
            </div>

            {/* Right: Financial Info */}
            <div style={sectionStyle}>
              <h3
                style={{
                  marginTop: 0,
                  fontSize: 16,
                  color: '#2ecc71',
                  marginBottom: 15,
                  borderBottom: '1px solid #34495e',
                  paddingBottom: 8,
                }}
              >
                Financial Info
              </h3>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 15,
                  marginBottom: 15,
                }}
              >
                <div>
                  <div style={labelStyle}>Currency</div>
                  <input style={readOnlyInputStyle} value="PHP" readOnly />
                </div>
                <div>
                  <div style={labelStyle}>Pax</div>
                  <input
                    type="number"
                    style={inputStyle}
                    {...register('pax', { valueAsNumber: true })}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 15 }}>
                <div style={labelStyle}>Total Amount</div>
                <input
                  type="number"
                  style={inputStyle}
                  {...register('amount', { valueAsNumber: true })}
                />
              </div>

              <div>
                <div style={labelStyle}>Payment Status</div>
                <select style={inputStyle} {...register('paid_status')}>
                  {PAID_STATUS_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Schedule Section */}
          <div style={sectionStyle}>
            <h3
              style={{
                marginTop: 0,
                fontSize: 16,
                color: '#e74c3c',
                marginBottom: 15,
                borderBottom: '1px solid #34495e',
                paddingBottom: 8,
              }}
            >
              Golf Schedule (Philippines)
            </h3>

            <div
              style={{
                background: 'rgba(0,0,0,0.2)',
                padding: 15,
                borderRadius: 8,
                border: '1px solid #34495e',
              }}
            >
              <div style={{ marginBottom: 15, display: 'flex', alignItems: 'center', gap: 15 }}>
                <span style={{ fontWeight: 'bold', fontSize: 14 }}>1TH</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={true}
                    readOnly
                    style={{ width: 16, height: 16 }}
                  />
                  <span>Golf</span>
                </label>
                {/* Tour Checkbox Removed */}
              </div>

              {/* Row 1: Date | Time | Not Yet */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr auto',
                  gap: 10,
                  marginBottom: 10,
                  alignItems: 'center',
                }}
              >
                <input
                  type="date"
                  style={inputStyle}
                  {...register('schedule_1_date', { onBlur: handleAutoFill })}
                  onFocus={() => ensureDateDefault('schedule_1_date')}
                />
                <input
                  type="text"
                  style={{ ...inputStyle, textAlign: 'center' }}
                  placeholder="HH:MM"
                  maxLength={5}
                  {...register('schedule_1_time', {
                    onBlur: handleAutoFill,
                    onChange: (e) => {
                      let val = e.target.value.replace(/[^0-9:]/g, '');
                      if (
                        val.length === 2 &&
                        !val.includes(':') &&
                        e.nativeEvent.inputType !== 'deleteContentBackward'
                      ) {
                        val += ':';
                      }
                      setValue('schedule_1_time', val);
                    },
                  })}
                />
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    color: '#bdc3c7',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      if (e.target.checked) setValue('schedule_1_time', '');
                      else setValue('schedule_1_time', '10:00');
                      handleAutoFill();
                    }}
                  />
                  Not Yet
                </label>
              </div>

              {/* Row 2: Course Select | Course Input */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <select
                  style={inputStyle}
                  value={watch('schedule_1_course') || ''}
                  onChange={(e) => {
                    setValue('schedule_1_course', e.target.value);
                    handleAutoFill();
                  }}
                >
                  <option value="">Select Golf Course</option>
                  {philippineGolfCourses.map((g) => (
                    <option key={g.id} value={g.code || g.name}>
                      {g.code ? `[${g.code}] ${g.name}` : g.name}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Enter Golf Course"
                  style={inputStyle}
                  {...register('schedule_1_course', { onBlur: handleAutoFill })}
                />
              </div>

              {/* Row 3: Course Option (Code) */}
              <div style={{ marginBottom: 10 }}>
                <input
                  placeholder="Course (Optional)"
                  style={inputStyle}
                  {...register('schedule_1_course_code', { onBlur: handleAutoFill })}
                />
              </div>

              {/* Row 4: Voucher Code | Display Text */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <input
                  placeholder="Voucher Code (Optional)"
                  style={inputStyle}
                  {...register('schedule_1_voucher', { onBlur: handleAutoFill })}
                />
                <div style={{ position: 'relative' }}>
                  <input
                    placeholder="Display Text (For Board)"
                    style={{
                      ...inputStyle,
                      border: '1px solid #f1c40f',
                      paddingRight: 30,
                    }}
                    {...register('schedule_1_text', {
                      onChange: () => setScheduleManualFlag(true),
                    })}
                  />
                  {scheduleManualFlag && (
                    <span
                      title="Manual Mode"
                      style={{
                        position: 'absolute',
                        right: 8,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#f39c12',
                        fontSize: 16,
                      }}
                    >
                      ⚠️
                    </span>
                  )}
                </div>
              </div>

              {/* Change Tee Checkbox */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    color: '#e74c3c',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                  }}
                >
                  <input
                    type="checkbox"
                    {...register('schedule_1_change_tee', {
                      onChange: (e) => {
                        const checked = e.target.checked;
                        if (checked) setValue('status', 'REQUESTED');

                        // Ensure value is updated for logic
                        setValue('schedule_1_change_tee', checked);

                        if (scheduleManualFlag) {
                          const prevText = getValues('schedule_1_text') || '';
                          if (checked) {
                            if (!prevText.includes('>>'))
                              setValue('schedule_1_text', `${prevText} >>`);
                          } else {
                            setValue('schedule_1_text', prevText.replace(/\s*>>/g, ''));
                          }
                        } else {
                          handleAutoFill();
                        }
                      },
                    })}
                  />
                  Change Tee Time
                </label>
              </div>
            </div>
          </div>

          {/* Request Note */}
          <div style={sectionStyle}>
            <div style={labelStyle}>Request Note / Internal Memo</div>
            <textarea
              style={{ ...inputStyle, minHeight: 80, resize: 'vertical', lineHeight: '1.5' }}
              {...register('request_note')}
              placeholder="Enter special requests or internal memo..."
            />
          </div>

          {/* Footer Actions */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 15,
              marginTop: 20,
              borderTop: '1px solid #333',
              paddingTop: 20,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '12px 24px',
                borderRadius: 6,
                border: '1px solid #7f8c8d',
                background: 'transparent',
                color: '#bdc3c7',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Are you sure you want to cancel this booking?')) {
                  setValue('status', 'CANCLE');
                }
              }}
              style={{
                padding: '12px 24px',
                borderRadius: 6,
                border: '1px solid #e74c3c',
                background: 'rgba(231, 76, 60, 0.1)',
                color: '#e74c3c',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Cancel Booking
            </button>
            <button
              type="submit"
              style={{
                padding: '12px 36px',
                borderRadius: 6,
                border: 'none',
                background: '#3498db',
                color: 'white',
                cursor: 'pointer',
                fontWeight: 600,
                boxShadow: '0 4px 6px rgba(52, 152, 219, 0.3)',
              }}
            >
              Save Voucher
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
