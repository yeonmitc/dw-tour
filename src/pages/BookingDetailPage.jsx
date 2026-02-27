import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import Badge from '../common/components/Badge';
import CustomerNameFields from '../common/components/CustomerNameFields.jsx';
import { useBranchFilter } from '../features/auth/useBranchFilter';
import BookingCodeSection from '../features/bookings/BookingCodeSection.jsx';
import { getMasterData } from '../features/settings/settingsApi';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { getDurationText, todayISO } from '../utils/date';
import { koreanToEnglishName } from '../utils/koreanName';

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

const CURRENCY_OPTIONS = [
  { value: 'KRW', label: 'KRW (₩)' },
  { value: 'THB', label: 'THB (฿)' },
  { value: 'PHP', label: 'PHP (₱)' },
  { value: 'JPY', label: 'JPY (¥)' },
];

const BRANCH_REGION_MAP = {
  PHILIPPINES: 'PHILIPPINES',
  JAPAN: 'JAPAN',
  CHIANGMAI: 'CHIANGMAI',
};

const REGION_COUNTRY_MAP = {
  PHILIPPINES: 'PHILIPPINES',
  JAPAN: 'JAPAN',
  CHIANGMAI: 'THAILAND',
};

export default function BookingDetailPage() {
  const { id } = useParams();
  const isNew = id === 'new';
  const nav = useNavigate();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      status: 'NEW',
      currency: 'PHP',
      base_date: todayISO(),
      booking_code: '',
    },
  });

  const { getEffectiveBranch } = useBranchFilter();
  const currentUser = useAuthStore((s) => s.user);
  const currentProfile = useAuthStore((s) => s.profile);

  // Define effectiveBranch early to avoid ReferenceError
  const effectiveBranch = getEffectiveBranch(null);

  // Watch fields
  const startDate = watch('start_date');
  const endDate = watch('end_date');
  const productCode = watch('product_code');
  const partnerCode = watch('partner_code');
  const flightInfoId = watch('flight_info_id');
  const baseDate = watch('base_date');
  const bookingCode = watch('booking_code');
  const hotelPaid = watch('hotel_paid');
  const customerName = watch('customer_name');
  const customerNameEn = watch('customer_name_en');
  const pax = watch('pax');
  const firstHotelName = watch('first_hotel_name');
  const branch = watch('branch');

  const computedNights = useMemo(() => {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return null;
    return diffDays;
  }, [startDate, endDate]);

  const holidayBranch = branch || effectiveBranch || null;
  const holidayLabel = useMemo(() => {
    if (holidayBranch === 'PHILIPPINES') return 'Philippines Holiday';
    if (holidayBranch === 'FUKUOKA') return 'Japan Holiday';
    if (holidayBranch === 'CHIANGMAI') return 'Thailand Holiday';
    return 'Holiday';
  }, [holidayBranch]);

  const [holidayNotices, setHolidayNotices] = useState([]);

  useEffect(() => {
    const run = async () => {
      if (!startDate || !endDate) {
        setHolidayNotices([]);
        return;
      }
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
        setHolidayNotices([]);
        return;
      }

      const dates = [];
      const cursor = new Date(start);
      cursor.setHours(0, 0, 0, 0);
      const endCursor = new Date(end);
      endCursor.setHours(0, 0, 0, 0);

      let guard = 0;
      while (cursor <= endCursor && guard < 120) {
        dates.push(cursor.toISOString().slice(0, 10));
        cursor.setDate(cursor.getDate() + 1);
        guard += 1;
      }

      if (dates.length === 0) {
        setHolidayNotices([]);
        return;
      }

      // Query Logic:
      // If holidayBranch is set, we want holidays that are EITHER specific to that branch OR have no branch (global).
      // If holidayBranch is NOT set (e.g. initial load or all), we might show nothing or global.
      // The user requested: "if Philippines selected, show only Philippines holiday"
      // "if Japan selected, show only Japan holiday"
      // "if Chiangmai selected, show only Thailand holiday"

      let q = supabase
        .from('holidays')
        .select('date, branch, name')
        .eq('is_active', true)
        .in('date', dates);

      if (holidayBranch) {
        // Fetch branch-specific holidays AND global holidays (null branch)
        // OR logic: branch is null OR branch equals holidayBranch
        q = q.or(`branch.is.null,branch.eq.${holidayBranch}`);
      } else {
        // If no branch selected, maybe fetch nothing? or global only?
        // Let's assume global only if no branch
        q = q.is('branch', null);
      }

      const { data, error } = await q.order('date');
      if (error) {
        setHolidayNotices([]);
        return;
      }

      // Deduplicate by date
      const uniqueHolidays = [];
      const seenDates = new Set();
      data?.forEach((h) => {
        if (!seenDates.has(h.date)) {
          seenDates.add(h.date);
          uniqueHolidays.push(h);
        }
      });

      const list =
        uniqueHolidays.map((h) => {
          const d = h.date;
          const mmdd =
            typeof d === 'string' && d.length >= 10 ? `${d.slice(5, 7)}/${d.slice(8, 10)}` : '';

          // Determine label based on the record's branch
          let label = 'Holiday';
          if (h.branch === 'PHILIPPINES') label = 'Philippines Holiday';
          else if (h.branch === 'FUKUOKA' || h.branch === 'JAPAN') label = 'Japan Holiday';
          else if (h.branch === 'CHIANGMAI') label = 'Thailand Holiday';
          else label = 'Holiday'; // Global or fallback

          return `${mmdd} ${label}`;
        }) ?? [];
      setHolidayNotices(list.filter(Boolean));
    };

    run();
  }, [startDate, endDate, holidayBranch]);

  const [duration, setDuration] = useState('');
  const [addingMaster, setAddingMaster] = useState(null);
  const [newMasterCode, setNewMasterCode] = useState('');
  const [newMasterLabel, setNewMasterLabel] = useState('');
  const [scheduleManualFlags, setScheduleManualFlags] = useState({});
  const [flightRegionFilter, setFlightRegionFilter] = useState('ALL');
  const [bookingRegion, setBookingRegion] = useState(null);
  const [guideSummary, setGuideSummary] = useState('');
  const [driverSummary, setDriverSummary] = useState('');
  const [vehicleSummary, setVehicleSummary] = useState('');

  // Automation Logic Variables
  const totalAmount = watch('total_amount');
  const scheduleTimes = [1, 2, 3, 4, 5, 6].map((n) => watch(`schedule_${n}`)); // Watch text fields for '>>'
  const hasSchedule = scheduleTimes.some((t) => !!t);
  const hasChangeTee = scheduleTimes.some((t) => String(t).includes('>>'));
  const currentStatus = watch('status');
  const today = new Date().toISOString().slice(0, 10);
  const isTravelEnded = endDate && today > endDate;

  // Status Automation Effect
  useEffect(() => {
    const current = getValues('status');
    if (current === 'CANCLE') return; // Do not override cancelled
    if (current === 'CHANGE_INFO') return; // Wait for confirmation
    if (current === 'CLOSED') return; // Wait for manual re-open

    let nextStatus = 'NEW';

    // Logic Priority (Reverse order of checking)
    // 1. Schedule -> REQUESTED
    if (hasSchedule) nextStatus = 'REQUESTED';

    // 2. Deposit -> DEPOSIT (if paid)
    if (totalAmount > 0) nextStatus = 'DEPOSIT';

    // 3. Travel Date -> INPROGRESS
    if (startDate && today >= startDate) nextStatus = 'INPROGRESS';

    // 4. Change Tee Request (Has '>>') -> REQUESTED
    if (hasChangeTee) nextStatus = 'REQUESTED';

    // 5. End Date -> GUID_PAY
    if (endDate && today > endDate) nextStatus = 'GUID_PAY';

    // Apply change if needed
    if (current !== nextStatus && nextStatus !== 'NEW') {
      setValue('status', nextStatus);
    }
  }, [startDate, endDate, totalAmount, hasSchedule, hasChangeTee, setValue, getValues, today]);

  const calculateAutoStatus = () => {
    let next = 'NEW';
    if (hasSchedule) next = 'REQUESTED';
    if (totalAmount > 0) next = 'DEPOSIT';
    if (startDate && today >= startDate) next = 'INPROGRESS';
    if (hasChangeTee) next = 'REQUESTED';
    if (endDate && today > endDate) next = 'GUID_PAY';
    return next;
  };

  const handleStatusChange = async (newStatus) => {
    setValue('status', newStatus);

    // Immediate DB update for better UX
    if (!isNew) {
      try {
        await supabase
          .from('bookings')
          .update({ status: newStatus, updated_by: currentUser?.id })
          .eq('id', id);
        queryClient.invalidateQueries({ queryKey: ['bookings'] });
        queryClient.invalidateQueries({ queryKey: ['booking', id] });
      } catch (err) {
        console.error('Failed to update status:', err);
      }
    }
  };

  const extraActions = (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      {/* Settlement Button */}
      <button
        type="button"
        disabled={!isTravelEnded}
        onClick={() => {
          if (currentStatus === 'CLOSED') {
            // Revert to auto status
            handleStatusChange(calculateAutoStatus());
          } else {
            handleStatusChange('CLOSED');
          }
        }}
        style={{
          padding: '10px 20px',
          fontSize: 14,
          fontWeight: 600,
          borderRadius: 6,
          border: currentStatus === 'CLOSED' ? 'none' : '1px solid var(--line)',
          background: currentStatus === 'CLOSED' ? '#2ecc71' : '#fff',
          color: currentStatus === 'CLOSED' ? '#fff' : '#2ecc71',
          cursor: isTravelEnded ? 'pointer' : 'not-allowed',
          opacity: isTravelEnded ? 1 : 0.5,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          whiteSpace: 'nowrap',
          transition: 'all 0.2s ease',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        }}
      >
        <span>{currentStatus === 'CLOSED' ? '✔' : ''}</span>
        정산 완료
      </button>

      {/* Change Confirmation Button */}
      <button
        type="button"
        onClick={() => {
          if (currentStatus === 'CHANGE_INFO') {
            // Revert to automation logic
            handleStatusChange(calculateAutoStatus());
          } else {
            handleStatusChange('CHANGE_INFO');
          }
        }}
        style={{
          padding: '10px 20px',
          fontSize: 14,
          fontWeight: 600,
          borderRadius: 6,
          border: 'none',
          background: currentStatus === 'CHANGE_INFO' ? '#4169E1' : '#e74c3c',
          color: '#fff',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          transition: 'all 0.2s ease',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
      >
        {currentStatus === 'CHANGE_INFO' ? '✔ 변경 확인 완료' : '변경 확인 필요'}
      </button>
    </div>
  );

  const buildGolfScheduleText = (n) => {
    const date = watch(`schedule_${n}_date`);
    const time = watch(`schedule_${n}_time`);
    const course = watch(`schedule_${n}_golf_course`);
    const courseCode = watch(`schedule_${n}_golf_course_code`);
    const voucher = watch(`schedule_${n}_voucher_vendor_code`);

    if (!date && !time && !course && !courseCode && !voucher) return null;

    let mmdd = '';
    if (date) {
      const d = new Date(date);
      if (!Number.isNaN(d.getTime())) {
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

    let result = `${mmdd}${timePart ? ` ${timePart}` : ''}${namePart}`.trim();

    const extra = [];
    if (courseCode) extra.push(courseCode);
    if (voucher) extra.push(voucher);
    if (extra.length) {
      // 괄호/콤마 없이 공백으로만 이어붙이기
      result += ` ${extra.join(' ')}`;
    }

    return result || null;
  };

  const ensureScheduleDateDefault = (n) => {
    if (!startDate) return;
    const current = watch(`schedule_${n}_date`);
    if (current) return;
    const base = new Date(startDate);
    if (Number.isNaN(base.getTime())) return;
    base.setDate(base.getDate() + (n - 1));
    const iso = base.toISOString().slice(0, 10);
    setValue(`schedule_${n}_date`, iso);
  };

  const handleAutoFillSchedule = (n, type) => {
    // Default Time 10:00 for Golf
    if (type === 'GOLF') {
      const currentTime = getValues(`schedule_${n}_time`);
      const notYet = getValues(`schedule_${n}_time_not_yet`);
      if (!currentTime && !notYet) {
        setValue(`schedule_${n}_time`, '10:00');
      }
    }

    if (type !== 'GOLF') return;
    if (scheduleManualFlags[n]) return;
    const text = buildGolfScheduleText(n);
    if (text) {
      setValue(`schedule_${n}`, text);
    }
  };

  // 1. Fetch Master Data
  const { data: productTypes = [] } = useQuery({
    queryKey: ['product_types'],
    queryFn: () => getMasterData('product_types'),
  });

  const { data: partners = [] } = useQuery({
    queryKey: ['partners'],
    queryFn: () => getMasterData('partners'),
  });

  const { data: flightOptions = [] } = useQuery({
    queryKey: ['flightinfo'],
    queryFn: () => getMasterData('flightinfo'),
  });
  const { data: golfCourses = [] } = useQuery({
    queryKey: ['golf_courses'],
    queryFn: () => getMasterData('golf_courses'),
  });
  const { data: hotels = [] } = useQuery({
    queryKey: ['hotel_master'],
    queryFn: () => getMasterData('hotel_master'),
  });
  const { data: guides = [] } = useQuery({
    queryKey: ['guide_master'],
    queryFn: () => getMasterData('guide_master'),
  });
  const { data: drivers = [] } = useQuery({
    queryKey: ['driver_master'],
    queryFn: () => getMasterData('driver_master'),
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicle_master'],
    queryFn: () => getMasterData('vehicle_master'),
  });

  const currentRegion = effectiveBranch ? BRANCH_REGION_MAP[effectiveBranch] : null;
  const regionForFilters = isNew ? bookingRegion || null : bookingRegion || currentRegion;
  const regionLocked = isNew && !regionForFilters;

  // Currency default by region for new bookings
  useEffect(() => {
    if (!isNew || !regionForFilters) return;

    let currency = 'KRW';
    if (regionForFilters === 'PHILIPPINES') currency = 'PHP';
    else if (regionForFilters === 'CHIANGMAI') currency = 'THB';
    else if (regionForFilters === 'JAPAN') currency = 'JPY';

    setValue('currency', currency);
  }, [isNew, regionForFilters, setValue]);

  // Default product by region for new bookings
  useEffect(() => {
    if (!isNew || !regionForFilters) return;
    const current = getValues('product_code');
    if (current) return;
    const defaults = {
      PHILIPPINES: 'KGP',
      JAPAN: 'FGP',
      CHIANGMAI: 'AGP',
    };
    const code = defaults[regionForFilters];
    if (code) {
      setValue('product_code', code);
    }
  }, [isNew, regionForFilters, setValue, getValues]);

  // Default partner and hotel for new bookings
  useEffect(() => {
    if (!isNew) return;
    if (!getValues('partner_code')) {
      setValue('partner_code', 'TR');
    }
    if (!getValues('first_hotel_name')) {
      setValue('first_hotel_name', '위더스');
    }
  }, [isNew, setValue, getValues]);

  const filteredProductTypes = useMemo(() => {
    if (!regionForFilters) return productTypes;
    const targetCountry = REGION_COUNTRY_MAP[regionForFilters] || regionForFilters;
    return productTypes.filter(
      (p) =>
        !p.country ||
        p.country === targetCountry ||
        p.country === regionForFilters ||
        p.country === 'ALL'
    );
  }, [productTypes, regionForFilters]);

  const filteredPartners = useMemo(() => {
    if (!regionForFilters) return partners;
    return partners.filter((p) => !p.region || p.region === regionForFilters || p.region === 'ALL');
  }, [partners, regionForFilters]);

  const filteredFlightOptions = useMemo(() => {
    if (!regionForFilters) return flightOptions;
    const targetCountry = REGION_COUNTRY_MAP[regionForFilters] || regionForFilters;
    return flightOptions.filter(
      (f) =>
        !f.country ||
        f.country === targetCountry ||
        f.country === regionForFilters ||
        f.country === 'ALL'
    );
  }, [flightOptions, regionForFilters]);
  const flightRegions = useMemo(() => {
    const set = new Set();
    filteredFlightOptions.forEach((f) => {
      if (f.country) set.add(f.country);
    });
    return Array.from(set).sort();
  }, [filteredFlightOptions]);
  const regionFilteredFlightOptions = useMemo(() => {
    if (!flightRegionFilter || flightRegionFilter === 'ALL') return filteredFlightOptions;
    return filteredFlightOptions.filter((f) => f.country === flightRegionFilter);
  }, [filteredFlightOptions, flightRegionFilter]);
  const filteredHotels = useMemo(() => {
    if (!regionForFilters) return hotels;
    const targetCountry = REGION_COUNTRY_MAP[regionForFilters] || null;
    if (!targetCountry) return hotels;
    return hotels.filter(
      (h) =>
        !h.country ||
        h.country === targetCountry ||
        h.country === regionForFilters ||
        h.country === 'ALL'
    );
  }, [hotels, regionForFilters]);

  const filteredGolfCourses = useMemo(() => {
    if (!regionForFilters) return golfCourses;
    const targetCountry = REGION_COUNTRY_MAP[regionForFilters] || regionForFilters;
    return golfCourses.filter((g) => {
      const c = g.country;
      const r = g.region;
      return (
        (!c && !r) || c === targetCountry || r === regionForFilters || c === 'ALL' || r === 'ALL'
      );
    });
  }, [golfCourses, regionForFilters]);

  const suggestedBoardCode = useMemo(() => {
    if (!productCode || !baseDate || !partnerCode || !pax) return '';

    const selectedProduct = productTypes.find((p) => p.code === productCode);
    const prefix = selectedProduct
      ? selectedProduct.prefix || selectedProduct.code
      : productCode.toUpperCase();

    const dateObj = new Date(baseDate);
    if (Number.isNaN(dateObj.getTime())) return '';
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const mmdd = `${mm}${dd}`;

    let suffix = '';
    if (firstHotelName && filteredHotels.length > 0) {
      const match = filteredHotels.find((h) => {
        if (h.name && h.name === firstHotelName) return true;
        if (h.code && h.code === firstHotelName) return true;
        const combined = `${h.name || ''} ${h.room_type || ''}`.trim();
        return combined && combined === firstHotelName;
      });
      if (match) {
        if (match.kind === 'poolvilla') {
          suffix = 'POOL';
        } else if (match.code) {
          suffix = String(match.code).slice(0, 3).toUpperCase();
        }
      }
    }

    const detail = `${partnerCode}${pax}${suffix}`;
    return `${prefix}${mmdd}-${detail}`;
  }, [productCode, baseDate, partnerCode, pax, firstHotelName, productTypes, filteredHotels]);

  const updateGuideVehicleCombined = (nextGuide, nextDriver, nextVehicle) => {
    const parts = [nextGuide, nextDriver, nextVehicle].map((v) => v && v.trim()).filter(Boolean);
    const combined = parts.join(' ');
    setValue('guide_vehicle', combined);
  };

  const filteredGuides = useMemo(() => {
    if (!regionForFilters) return guides;
    const targetCountry = REGION_COUNTRY_MAP[regionForFilters] || null;
    if (!targetCountry) return guides;
    return guides.filter(
      (g) =>
        !g.country ||
        g.country === targetCountry ||
        g.country === regionForFilters ||
        g.country === 'ALL'
    );
  }, [guides, regionForFilters]);

  const filteredDrivers = useMemo(() => {
    if (!regionForFilters) return drivers;
    const targetCountry = REGION_COUNTRY_MAP[regionForFilters] || null;
    if (!targetCountry) return drivers;
    return drivers.filter(
      (d) =>
        !d.country ||
        d.country === targetCountry ||
        d.country === regionForFilters ||
        d.country === 'ALL'
    );
  }, [drivers, regionForFilters]);

  const filteredVehicles = useMemo(() => {
    if (!regionForFilters) return vehicles;
    const targetCountry = REGION_COUNTRY_MAP[regionForFilters] || null;
    if (!targetCountry) return vehicles;
    return vehicles.filter(
      (v) =>
        !v.country ||
        v.country === targetCountry ||
        v.country === regionForFilters ||
        v.country === 'ALL'
    );
  }, [vehicles, regionForFilters]);

  const handleApplySuggestedCode = () => {
    if (!suggestedBoardCode) return;
    setValue('booking_code', suggestedBoardCode);
  };

  const handleRegionPreset = (region) => {
    setBookingRegion(region);
    setFlightRegionFilter(region);
    setValue('branch', region);
    if (isNew) {
      let currency = 'KRW';
      if (region === 'PHILIPPINES') currency = 'PHP';
      else if (region === 'CHIANGMAI') currency = 'THB';
      else if (region === 'JAPAN') currency = 'JPY';
      setValue('currency', currency);

      const defaults = {
        PHILIPPINES: 'KGP',
        JAPAN: 'FGP',
        CHIANGMAI: 'AGP',
      };
      const code = defaults[region];
      if (code) setValue('product_code', code);

      // Also set partner and hotel defaults on region preset
      if (!getValues('partner_code')) setValue('partner_code', 'TR');
      if (!getValues('first_hotel_name')) setValue('first_hotel_name', '위더스');
    }
  };

  const handleQuickAddMaster = async (kind) => {
    const code = newMasterCode.trim();
    const label = newMasterLabel.trim();
    if (!code) {
      alert('코드는 필수입니다.');
      return;
    }

    try {
      if (kind === 'product') {
        // 일회성 코드: 이 예약에만 적용
        setValue('product_code', code);
      } else if (kind === 'partner') {
        // 일회성 코드: 이 예약에만 적용
        setValue('partner_code', code);
      } else if (kind === 'flight') {
        const effectiveBranchInner = getEffectiveBranch(null);
        const baseRegion = effectiveBranchInner ? BRANCH_REGION_MAP[effectiveBranchInner] : null;
        const country = regionForFilters || baseRegion;
        const { data, error } = await supabase
          .from('flightinfo')
          .insert({
            code,
            country,
          })
          .select()
          .single();
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['flightinfo'] });
        setValue('flight_info_id', data.id);
      }

      setAddingMaster(null);
      setNewMasterCode('');
      setNewMasterLabel('');
    } catch (err) {
      alert(`저장 실패: ${err.message}`);
    }
  };

  // Sync Product Code -> Type/Branch/Prefix
  useEffect(() => {
    if (productCode && productTypes.length > 0) {
      const selected = productTypes.find((p) => p.code === productCode);
      if (selected) {
        setValue('type', selected.type);
        if (selected.country) {
          setValue('branch', selected.country);
        }
      }
    }
  }, [productCode, productTypes, setValue]);

  // Sync selected Flight Info (ID) to text field (for board display / manual override)
  useEffect(() => {
    if (!flightInfoId) return;
    const selected = filteredFlightOptions.find((f) => f.id === flightInfoId);
    if (selected) {
      setValue('flight_info', selected.code);
    }
  }, [flightInfoId, filteredFlightOptions, setValue]);

  // Duration Calc
  useEffect(() => {
    if (startDate && endDate) {
      setDuration(getDurationText(startDate, endDate));
    } else {
      setDuration('');
    }
  }, [startDate, endDate]);

  // If start date is selected and end date is empty, default end date = start date
  useEffect(() => {
    if (startDate && !endDate) {
      setValue('end_date', startDate);
    }
  }, [startDate, endDate, setValue]);

  // Auto-set Base Date to Start Date if empty (convenience)
  useEffect(() => {
    if (startDate) {
      if (!baseDate) {
        setValue('base_date', startDate);
      }

      // Auto-set 1TH date to startDate and cascade to others
      // Only if 1TH date is empty or matches old startDate logic
      const date1 = getValues('schedule_1_date');
      if (!date1 || date1 !== startDate) {
        // Set 1TH date
        setValue('schedule_1_date', startDate);

        // Cascade to 2TH-6TH
        for (let i = 2; i <= 6; i++) {
          const d = new Date(startDate);
          d.setDate(d.getDate() + (i - 1));
          const iso = d.toISOString().slice(0, 10);
          setValue(`schedule_${i}_date`, iso);
        }
      }
    }
  }, [startDate, baseDate, setValue, getValues]);

  // Watch for schedule_1_date changes to cascade if user manually changes it?
  // User asked: "1th 끝나면 1th 기준으로 +1 로 2th 날짜 선택해줘"
  // So if 1TH date changes, we should update 2TH..6TH
  const schedule1Date = watch('schedule_1_date');
  useEffect(() => {
    if (schedule1Date) {
      for (let i = 2; i <= 6; i++) {
        // Only update if empty? Or always sync?
        // User said "1th 끝나면 1th 기준으로 +1 로 2th 날짜 선택해줘" -> sounds like sync
        const d = new Date(schedule1Date);
        if (!Number.isNaN(d.getTime())) {
          d.setDate(d.getDate() + (i - 1));
          const iso = d.toISOString().slice(0, 10);
          setValue(`schedule_${i}_date`, iso);
        }
      }
    }
  }, [schedule1Date, setValue]);

  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('bookings').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
    enabled: !isNew,
  });

  const { data: bookingStaff = [] } = useQuery({
    queryKey: ['booking-staff', booking?.created_by, booking?.updated_by],
    queryFn: async () => {
      const ids = [booking?.created_by, booking?.updated_by].filter(Boolean);
      if (!ids.length) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', ids);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!booking,
  });

  const createdByName =
    bookingStaff.find((p) => p.user_id === booking?.created_by)?.display_name || null;
  const updatedByName =
    bookingStaff.find((p) => p.user_id === booking?.updated_by)?.display_name || null;

  useEffect(() => {
    if (booking) {
      reset(booking, { keepDirty: true });
      [4, 5, 6].forEach((n) => {
        const key = `schedule_${n}`;
        if (booking[key]) {
          setValue(`schedule_${n}_enabled`, true);
        }
      });
      if (booking.branch && BRANCH_REGION_MAP[booking.branch]) {
        setBookingRegion(BRANCH_REGION_MAP[booking.branch]);
      }
      if (booking.guide_vehicle) {
        const parts = String(booking.guide_vehicle).split(' ').filter(Boolean);
        setGuideSummary(parts[0] || '');
        setDriverSummary(parts[1] || '');
        setVehicleSummary(parts.slice(2).join(' ') || '');
      } else {
        setGuideSummary('');
        setDriverSummary('');
        setVehicleSummary('');
      }
    }
  }, [booking, reset, setValue]);

  // Auto-Close Logic
  useEffect(() => {
    if (isNew || !booking) return;

    const checkAutoClose = () => {
      const currentStatus = getValues('status');
      if (currentStatus === 'CLOSED') return;

      let allPassed = true;
      let hasGolf = false;

      for (let i = 1; i <= 6; i++) {
        const type = getValues(`schedule_${i}_type`);
        if (type === 'GOLF') {
          hasGolf = true;
          const date = getValues(`schedule_${i}_date`);
          const time = getValues(`schedule_${i}_time`);
          const notYet = getValues(`schedule_${i}_time_not_yet`);

          if (!date || (!time && !notYet)) {
            allPassed = false;
            break;
          }

          if (date && time) {
            const teeTime = new Date(`${date}T${time}`);
            if (new Date() < teeTime) {
              allPassed = false;
              break;
            }
          } else if (notYet) {
            allPassed = false;
            break;
          }
        }
      }

      if (hasGolf && allPassed) {
        setValue('status', 'CLOSED');
      }
    };

    const timer = setInterval(checkAutoClose, 60000);
    checkAutoClose();
    return () => clearInterval(timer);
  }, [booking, setValue, getValues, isNew]);

  useEffect(() => {
    if (!customerName) {
      setValue('customer_name_en', '');
      return;
    }
    const auto = koreanToEnglishName(customerName);
    if (!customerNameEn || customerNameEn === auto) {
      setValue('customer_name_en', auto);
    }
  }, [customerName, customerNameEn, setValue]);

  // Mutation for create/update
  const mutation = useMutation({
    mutationFn: async (formData) => {
      const dataToSave = {
        ...formData,
        // Ensure numeric fields have defaults
        total_amount: formData.total_amount || 0,
        pax: formData.pax || 1,
        // Handle UUID fields: Convert empty string to null
        flight_info_id: formData.flight_info_id || null,
        // If new, set branch based on user permissions
        ...(isNew && { branch: getEffectiveBranch(formData.branch) }),
        ...(isNew && { created_by: currentUser?.id }),
        updated_by: currentUser?.id || null,
      };

      if (formData.start_date && formData.end_date) {
        const start = new Date(formData.start_date);
        const end = new Date(formData.end_date);
        const diffMs = end.getTime() - start.getTime();
        const nights = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (nights >= 0) {
          dataToSave.sc = String(nights);
        }
      }

      if (isNew) {
        const { data, error } = await supabase
          .from('bookings')
          .insert(dataToSave)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('bookings')
          .update(dataToSave)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      nav('/bookings');
    },
    onError: (err) => {
      alert('Error saving booking: ' + err.message);
    },
  });

  const onSubmit = (data) => {
    const cleaned = { ...data };
    for (let i = 1; i <= 6; i += 1) {
      const base = `schedule_${i}`;
      delete cleaned[`${base}_time_not_yet`];
      delete cleaned[`${base}_date`];
      delete cleaned[`${base}_time`];
      delete cleaned[`${base}_golf_course`];
      delete cleaned[`${base}_golf_course_code`];
      delete cleaned[`${base}_voucher_vendor_code`];
      delete cleaned[`${base}_enabled`];
      delete cleaned[`${base}_type`];
    }
    delete cleaned.customer_name_en;
    mutation.mutate(cleaned);
  };

  const handleDelete = async () => {
    if (isNew) {
      nav('/bookings');
      return;
    }
    if (!id) return;
    if (!window.confirm('이 Booking 을 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('bookings').delete().eq('id', id);
    if (error) {
      alert('Error deleting booking: ' + error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['bookings'] });
    nav('/bookings');
  };

  if (isLoading) return <div style={{ padding: 20 }}>Loading...</div>;

  return (
    <div style={{ padding: 20 }}>
      <div className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h2
                  style={{
                    fontSize: 20,
                    fontWeight: 'bold',
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span>{isNew ? 'New Booking' : `Booking ${booking?.booking_code || ''}`}</span>
                  {isNew && regionForFilters && (
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#f1c40f' }}>
                      {regionForFilters === 'PHILIPPINES'
                        ? 'Philippines'
                        : regionForFilters === 'JAPAN'
                          ? 'Japan'
                          : regionForFilters === 'CHIANGMAI'
                            ? 'Chiangmai'
                            : regionForFilters}
                    </span>
                  )}
                </h2>
                {!isNew && booking?.booking_code && (
                  <Badge variant="good">{booking.booking_code}</Badge>
                )}
              </div>
              {isNew && (
                <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                  <button
                    type="button"
                    onClick={() => handleRegionPreset('PHILIPPINES')}
                    style={{
                      padding: '6px 16px',
                      fontSize: 13,
                      fontWeight: 600,
                      borderRadius: 999,
                      border: '2px solid transparent',
                      background: regionForFilters === 'PHILIPPINES' ? '#000' : '#3498db',
                      color: regionForFilters === 'PHILIPPINES' ? '#fff' : '#000',
                      cursor: 'pointer',
                      minWidth: 110,
                    }}
                  >
                    Philippines
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRegionPreset('JAPAN')}
                    style={{
                      padding: '6px 16px',
                      fontSize: 13,
                      fontWeight: 600,
                      borderRadius: 999,
                      border: '2px solid transparent',
                      background: regionForFilters === 'JAPAN' ? '#000' : '#f39c12',
                      color: regionForFilters === 'JAPAN' ? '#fff' : '#000',
                      cursor: 'pointer',
                      minWidth: 110,
                    }}
                  >
                    Japan
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRegionPreset('CHIANGMAI')}
                    style={{
                      padding: '6px 16px',
                      fontSize: 13,
                      fontWeight: 600,
                      borderRadius: 999,
                      border: '2px solid transparent',
                      background: regionForFilters === 'CHIANGMAI' ? '#000' : '#f1c40f',
                      color: regionForFilters === 'CHIANGMAI' ? '#fff' : '#000',
                      cursor: 'pointer',
                      minWidth: 110,
                    }}
                  >
                    Chiangmai
                  </button>
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {!isNew && (
              <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'right' }}>
                <div>
                  생성:{' '}
                  {createdByName || booking?.created_by || currentProfile?.display_name || '-'}
                </div>
                <div>
                  마지막 수정:{' '}
                  {updatedByName ||
                    booking?.updated_by ||
                    (isNew ? currentProfile?.display_name : '') ||
                    '-'}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              {!isNew && (
                <button type="button" className="btn danger" onClick={handleDelete}>
                  Delete
                </button>
              )}
              <button type="button" className="btn secondary" onClick={() => nav(-1)}>
                Cancel
              </button>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="form">
          <input type="hidden" {...register('type')} />
          <input type="hidden" {...register('branch')} />

          <BookingCodeSection
            isNew={isNew}
            productCode={productCode}
            partnerCode={partnerCode}
            baseDate={baseDate}
            holidayNotices={holidayNotices}
            filteredProductTypes={filteredProductTypes}
            filteredPartners={filteredPartners}
            errors={errors}
            register={register}
            setValue={setValue}
            regionLocked={regionLocked}
            bookingCode={bookingCode}
            suggestedCode={suggestedBoardCode}
            onApplySuggestedCode={handleApplySuggestedCode}
            extraActions={extraActions}
          />

          {/* 메인 정보 + Schedule 양옆 배치 */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 0.9fr)',
              gap: 16,
              alignItems: 'flex-start',
              marginTop: 12,
            }}
          >
            <div>
              {/* 2. Basic Info */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: 16,
                  padding: 12,
                  borderRadius: 8,
                  border: '1px solid var(--line)',
                }}
              >
                <div>
                  <div className="label" style={{ marginBottom: 5 }}>
                    Status
                  </div>
                  <select
                    className="select"
                    {...register('status')}
                    style={{ width: '100%', border: '1px solid rgba(241, 196, 15, 0.5)' }}
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="label" style={{ marginBottom: 5 }}>
                    Booking Title
                  </div>
                  <input
                    className="input"
                    {...register('title', { required: true })}
                    placeholder="e.g. 홍길동님 4박 5일 골프"
                    defaultValue="New Booking"
                    style={{ width: '100%' }}
                  />
                </div>
                <CustomerNameFields
                  register={register}
                  watch={watch}
                  setValue={setValue}
                  layout="booking"
                />
              </div>

              {/* 3. Financial Info */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '3fr 2fr 2fr 1fr', // 3:2:2:1 Ratio
                  gap: 16,
                  alignItems: 'end',
                  marginTop: 16,
                  padding: 12,
                  borderRadius: 8,
                  border: '1px solid var(--line)',
                }}
              >
                <div>
                  <div className="label" style={{ marginBottom: 5, fontSize: 14, fontWeight: 800 }}>
                    Schedule date / 박
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map((n) => {
                        const isActive = computedNights === n;
                        return (
                          <button
                            key={n}
                            type="button"
                            className="btn secondary"
                            title={`SC ${n}`}
                            style={{
                              height: 32,
                              width: 32,
                              padding: 0,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 12,
                              background: isActive ? '#f1c40f' : undefined,
                              color: isActive ? '#000' : undefined,
                              border: isActive ? '1px solid #f39c12' : undefined,
                              fontWeight: isActive ? 'bold' : undefined,
                            }}
                            onClick={() => {
                              if (!startDate) return;
                              const d = new Date(startDate);
                              if (Number.isNaN(d.getTime())) return;
                              d.setDate(d.getDate() + n);
                              const iso = d.toISOString().slice(0, 10);
                              setValue('end_date', iso);
                            }}
                          >
                            {n}
                          </button>
                        );
                      })}

                      <select
                        className="select"
                        value={
                          computedNights != null && computedNights >= 8 && computedNights <= 40
                            ? String(computedNights)
                            : ''
                        }
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (!startDate) return;
                          const d = new Date(startDate);
                          if (Number.isNaN(d.getTime())) return;
                          if (!Number.isFinite(v) || v < 8 || v > 40) return;
                          d.setDate(d.getDate() + v);
                          const iso = d.toISOString().slice(0, 10);
                          setValue('end_date', iso);
                        }}
                        style={{ height: 32, fontSize: 12, padding: '0 8px' }}
                      >
                        <option value="">8~40</option>
                        {Array.from({ length: 33 }, (_, i) => i + 8).map((n) => (
                          <option key={n} value={String(n)}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="label" style={{ marginBottom: 5 }}>
                    Currency
                  </div>
                  <select
                    className="select"
                    {...register('currency')}
                    disabled={regionLocked}
                    style={{
                      width: '100%',
                      border: '1px solid rgba(241, 196, 15, 0.5)',
                    }}
                  >
                    {CURRENCY_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="label" style={{ marginBottom: 5 }}>
                    Tour Fee
                  </div>
                  <input
                    type="number"
                    className="input"
                    {...register('total_amount', { valueAsNumber: true })}
                    placeholder="0"
                    style={{ width: '100%', border: '1px solid rgba(241, 196, 15, 0.5)' }}
                  />
                </div>
                <div>
                  <div className="label" style={{ marginBottom: 5 }}>
                    Deposit date / 입금날짜
                  </div>
                  <input
                    type="text"
                    className="input"
                    {...register('deposit_date')}
                    placeholder="MM/DD"
                    maxLength={5}
                    style={{ width: '100%', border: '1px solid rgba(241, 196, 15, 0.5)' }}
                  />
                </div>
              </div>

              {/* 4. Date & Duration */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: 16,
                  marginTop: 16,
                }}
              >
                <div>
                  <div className="label" style={{ marginBottom: 5 }}>
                    Start Date
                  </div>
                  <input
                    type="date"
                    className="input"
                    {...register('start_date', { required: true })}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <div className="label" style={{ marginBottom: 5 }}>
                    End Date
                  </div>
                  <input
                    type="date"
                    className="input"
                    {...register('end_date', { required: true })}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <div className="label" style={{ marginBottom: 5 }}>
                    Duration
                  </div>
                  <div
                    style={{
                      padding: '10px',
                      background: 'var(--chip)',
                      borderRadius: 4,
                      fontWeight: 'bold',
                      textAlign: 'center',
                      color: 'var(--text)',
                      border: '1px solid var(--line)',
                    }}
                  >
                    {duration || '-'}
                  </div>
                </div>
              </div>

              {/* 5. Logistics */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr',
                  gap: 16,
                  marginTop: 16,
                  padding: 12,
                  borderRadius: 8,
                  border: '1px solid var(--line)',
                }}
              >
                <div>
                  <div className="label" style={{ marginBottom: 5 }}>
                    Flight Info
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select
                        className="select"
                        value={flightRegionFilter}
                        onChange={(e) => setFlightRegionFilter(e.target.value)}
                        disabled={regionLocked}
                        style={{ width: '40%', border: '1px solid rgba(241, 196, 15, 0.5)' }}
                      >
                        <option value="ALL">All Regions</option>
                        {flightRegions.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      <select
                        className="select"
                        {...register('flight_info_id')}
                        disabled={regionLocked}
                        style={{ width: '100%', border: '1px solid rgba(241, 196, 15, 0.5)' }}
                      >
                        <option value="">Select Flight...</option>
                        {regionFilteredFlightOptions?.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.region ? `[${f.region}] ${f.code}` : f.code}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn secondary"
                        style={{ padding: '4px 8px', fontSize: 11 }}
                        onClick={() => {
                          setAddingMaster('flight');
                          setNewMasterCode('');
                          setNewMasterLabel('');
                        }}
                        disabled={regionLocked}
                      >
                        +
                      </button>
                    </div>
                    <input
                      className="input"
                      {...register('flight_info')}
                      placeholder="Flight 정보 직접 입력"
                      disabled={regionLocked}
                      style={{ width: '100%', border: '1px solid rgba(241, 196, 15, 0.5)' }}
                    />
                  </div>
                  {addingMaster === 'flight' && (
                    <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                      <input
                        className="input"
                        style={{ flex: 0.8 }}
                        placeholder="Flight Code"
                        value={newMasterCode}
                        onChange={(e) => setNewMasterCode(e.target.value.toUpperCase())}
                      />
                      <button
                        type="button"
                        className="btn primary"
                        style={{ fontSize: 11, padding: '4px 8px' }}
                        onClick={() => handleQuickAddMaster('flight')}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="btn secondary"
                        style={{ fontSize: 11, padding: '4px 8px' }}
                        onClick={() => {
                          setAddingMaster(null);
                          setNewMasterCode('');
                          setNewMasterLabel('');
                        }}
                      >
                        X
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <div className="label" style={{ marginBottom: 5 }}>
                    PAX (People)
                  </div>
                  <input
                    type="number"
                    className="input"
                    {...register('pax', { valueAsNumber: true })}
                    style={{ width: '100%', border: '1px solid rgba(241, 196, 15, 0.5)' }}
                  />
                </div>
              </div>

              {/* 5.5 Hotel / Guide Summary (Board Row) + Notes */}
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 8,
                  border: '1px solid var(--line)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div>
                  <div className="label" style={{ marginBottom: 5 }}>
                    Hotel / RT & Guide (보드용)
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 8,
                      marginBottom: 6,
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <select
                        className="select"
                        value={watch('first_hotel_name') || ''}
                        onChange={(e) => setValue('first_hotel_name', e.target.value)}
                        style={{
                          width: '100%',
                          border: '1px solid rgba(241, 196, 15, 0.5)',
                        }}
                        disabled={regionLocked}
                      >
                        <option value="">Hotel 선택</option>
                        {filteredHotels.map((h) => {
                          const base = h.name || '';
                          const room = h.room_type ? ` ${h.room_type}` : '';
                          const value = `${base}${room}`;
                          const display = h.code || value;
                          return (
                            <option key={h.id} value={value}>
                              {display}
                            </option>
                          );
                        })}
                      </select>
                      <input
                        className="input"
                        {...register('first_hotel_name')}
                        placeholder="Hotel /Poolvilla 직접 입력"
                        style={{
                          width: '100%',
                          border: '1px solid rgba(241, 196, 15, 0.5)',
                        }}
                      />
                      <input
                        className="input"
                        {...register('first_hotel_note')}
                        placeholder="Room Type 메모 직접 입력"
                        style={{
                          width: '100%',
                          border: '1px solid rgba(241, 196, 15, 0.5)',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr',
                          gap: 4,
                        }}
                      >
                        <select
                          className="select"
                          value={guideSummary}
                          onChange={(e) => {
                            const next = e.target.value;
                            setGuideSummary(next);
                            updateGuideVehicleCombined(next, driverSummary, vehicleSummary);
                          }}
                          style={{
                            width: '100%',
                            border: '1px solid rgba(241, 196, 15, 0.5)',
                          }}
                          disabled={regionLocked}
                        >
                          <option value="">Guide 선택</option>
                          {filteredGuides.map((g) => (
                            <option key={g.id} value={g.nickname || g.name || ''}>
                              {g.nickname || g.name}
                            </option>
                          ))}
                        </select>
                        <input
                          className="input"
                          value={guideSummary}
                          onChange={(e) => {
                            const next = e.target.value;
                            setGuideSummary(next);
                            updateGuideVehicleCombined(next, driverSummary, vehicleSummary);
                          }}
                          placeholder="Guide 직접 입력"
                          style={{
                            width: '100%',
                            border: '1px solid rgba(241, 196, 15, 0.5)',
                          }}
                          disabled={regionLocked}
                        />
                        <select
                          className="select"
                          value={driverSummary}
                          onChange={(e) => {
                            const next = e.target.value;
                            setDriverSummary(next);
                            updateGuideVehicleCombined(guideSummary, next, vehicleSummary);
                          }}
                          style={{
                            width: '100%',
                            border: '1px solid rgba(241, 196, 15, 0.5)',
                          }}
                          disabled={regionLocked}
                        >
                          <option value="">Driver 선택</option>
                          {filteredDrivers.map((d) => (
                            <option key={d.id} value={d.nickname || d.name || ''}>
                              {d.nickname || d.name}
                            </option>
                          ))}
                        </select>
                        <input
                          className="input"
                          value={driverSummary}
                          onChange={(e) => {
                            const next = e.target.value;
                            setDriverSummary(next);
                            updateGuideVehicleCombined(guideSummary, next, vehicleSummary);
                          }}
                          placeholder="Driver 직접 입력"
                          style={{
                            width: '100%',
                            border: '1px solid rgba(241, 196, 15, 0.5)',
                          }}
                          disabled={regionLocked}
                        />
                        <select
                          className="select"
                          value={vehicleSummary}
                          onChange={(e) => {
                            const next = e.target.value;
                            setVehicleSummary(next);
                            updateGuideVehicleCombined(guideSummary, driverSummary, next);
                          }}
                          style={{
                            width: '100%',
                            border: '1px solid rgba(241, 196, 15, 0.5)',
                          }}
                          disabled={regionLocked}
                        >
                          <option value="">Vehicle 선택</option>
                          {filteredVehicles.map((v) => {
                            const label = v.number || v.name || '';
                            return (
                              <option key={v.id} value={label}>
                                {label}
                              </option>
                            );
                          })}
                        </select>
                        <input
                          className="input"
                          value={vehicleSummary}
                          onChange={(e) => {
                            const next = e.target.value;
                            setVehicleSummary(next);
                            updateGuideVehicleCombined(guideSummary, driverSummary, next);
                          }}
                          placeholder="Vehicle 직접 입력"
                          style={{
                            width: '100%',
                            border: '1px solid rgba(241, 196, 15, 0.5)',
                          }}
                          disabled={regionLocked}
                        />
                      </div>
                      <input
                        className="input"
                        {...register('guide_vehicle')}
                        placeholder="Guide / Driver / Vehicle 최종 값"
                        style={{
                          width: '100%',
                          border: '1px solid rgba(241, 196, 15, 0.5)',
                        }}
                        disabled={regionLocked}
                      />
                    </div>
                  </div>
                  <input type="checkbox" {...register('hotel_paid')} style={{ display: 'none' }} />
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginTop: 6,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setValue('hotel_paid', !hotelPaid)}
                      style={{
                        padding: '8px 18px',
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: 999,
                        border: 'none',
                        cursor: 'pointer',
                        background: hotelPaid ? '#e74c3c' : '#3498db',
                        color: '#fff',
                        boxShadow: '0 0 0 1px rgba(255,255,255,0.08)',
                        minWidth: 90,
                      }}
                    >
                      {hotelPaid ? 'Paid' : 'Pay'}
                    </button>
                    <input
                      type="number"
                      className="input"
                      {...register('hotel_paid_amount', { valueAsNumber: true })}
                      placeholder="Paid"
                      disabled={!hotelPaid}
                      style={{
                        width: 120,
                        border: '1px solid rgba(241, 196, 15, 0.5)',
                        background: hotelPaid ? 'var(--bg)' : 'rgba(0, 0, 0, 0.7)',
                        color: hotelPaid ? 'var(--text)' : 'rgba(255, 255, 255, 0.3)',
                        cursor: hotelPaid ? 'text' : 'not-allowed',
                      }}
                    />
                    <input
                      className="input"
                      {...register('hotel_voucher_number')}
                      placeholder="Hotel Voucher 코드"
                      disabled={!hotelPaid}
                      style={{
                        flex: 1,
                        border: '1px solid rgba(241, 196, 15, 0.5)',
                        background: hotelPaid ? 'var(--bg)' : 'rgba(0, 0, 0, 0.7)',
                        color: hotelPaid ? 'var(--text)' : 'rgba(255, 255, 255, 0.3)',
                        cursor: hotelPaid ? 'text' : 'not-allowed',
                      }}
                    />
                  </div>
                </div>
                <div
                  style={{
                    paddingTop: 8,
                    borderTop: '1px solid var(--line)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div>
                    <div className="label" style={{ marginBottom: 5 }}>
                      Internal Memo
                    </div>
                    <textarea
                      className="input"
                      {...register('memo')}
                      rows={3}
                      style={{
                        width: '100%',
                        resize: 'vertical',
                        border: '1px solid rgba(241, 196, 15, 0.5)',
                      }}
                      placeholder="Internal use only..."
                    />
                  </div>
                  <div>
                    <div className="label" style={{ marginBottom: 5 }}>
                      Hotel Note
                    </div>
                    <textarea
                      className="input"
                      {...register('hotel_note')}
                      rows={3}
                      style={{ width: '100%', resize: 'vertical' }}
                      placeholder="Hotel requests..."
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div
                style={{
                  padding: 12,
                  borderRadius: 8,
                  border: '1px solid var(--line)',
                }}
              >
                <div className="label" style={{ marginBottom: 8 }}>
                  Schedule Details
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                  {Array.from({ length: 6 }).map((_, idx) => {
                    const n = idx + 1;
                    const type = watch(`schedule_${n}_type`);
                    const enabled = n <= 3 || watch(`schedule_${n}_enabled`);

                    if (n >= 4 && !enabled) {
                      return (
                        <div
                          key={n}
                          style={{
                            padding: 8,
                            borderRadius: 8,
                            border: '1px dashed var(--line)',
                            background: 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <label
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              fontSize: 12,
                              color: 'var(--muted)',
                            }}
                          >
                            <input
                              type="checkbox"
                              {...register(`schedule_${n}_enabled`)}
                              style={{ width: 14, height: 14 }}
                            />
                            <span>{n}TH 추가</span>
                          </label>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={n}
                        style={{
                          padding: 8,
                          borderRadius: 8,
                          border: '1px solid var(--line)',
                          background: 'var(--panel)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: 12,
                            color: 'var(--muted)',
                          }}
                        >
                          <span style={{ fontWeight: 'bold' }}>{n}TH</span>
                          {n >= 4 && (
                            <button
                              type="button"
                              className="btn secondary"
                              style={{ fontSize: 11, padding: '2px 6px' }}
                              onClick={() => setValue(`schedule_${n}_enabled`, false)}
                            >
                              비활성
                            </button>
                          )}
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            gap: 12,
                            alignItems: 'center',
                            fontSize: 12,
                            marginBottom: 4,
                          }}
                        >
                          <input type="hidden" {...register(`schedule_${n}_type`)} />
                          <label
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              cursor: 'pointer',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={type === 'GOLF'}
                              onChange={() => {
                                const nextType = type === 'GOLF' ? '' : 'GOLF';
                                setValue(`schedule_${n}_type`, nextType);
                                if (nextType === 'GOLF') {
                                  ensureScheduleDateDefault(n);
                                }
                              }}
                              style={{ width: 14, height: 14 }}
                            />
                            <span>GOLF</span>
                          </label>
                          <label
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              cursor: 'pointer',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={type === 'TOUR'}
                              onChange={() =>
                                setValue(`schedule_${n}_type`, type === 'TOUR' ? '' : 'TOUR')
                              }
                              style={{ width: 14, height: 14 }}
                            />
                            <span>Tour</span>
                          </label>
                        </div>
                        {type === 'GOLF' && (
                          <>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <input
                                type="date"
                                className="input"
                                {...register(`schedule_${n}_date`, {
                                  onBlur: () => handleAutoFillSchedule(n, type),
                                })}
                                onFocus={() => ensureScheduleDateDefault(n)}
                                style={{ flex: 1 }}
                              />
                              <div
                                style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 4 }}
                              >
                                <input
                                  type="text"
                                  className="input"
                                  placeholder="HH:MM"
                                  maxLength={5}
                                  {...register(`schedule_${n}_time`, {
                                    onBlur: () => handleAutoFillSchedule(n, type),
                                    onChange: (e) => {
                                      // Simple Auto-Format HHMM -> HH:MM
                                      let val = e.target.value.replace(/[^0-9:]/g, '');
                                      if (
                                        val.length === 2 &&
                                        !val.includes(':') &&
                                        e.nativeEvent.inputType !== 'deleteContentBackward'
                                      ) {
                                        val += ':';
                                      }
                                      setValue(`schedule_${n}_time`, val);
                                    },
                                  })}
                                  style={{ flex: 1, textAlign: 'center' }}
                                />
                                <label
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    fontSize: 11,
                                    color: 'var(--muted)',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    {...register(`schedule_${n}_time_not_yet`, {
                                      onChange: (e) => {
                                        if (e.target.checked) {
                                          setValue(`schedule_${n}_time`, '');
                                        } else {
                                          setValue(`schedule_${n}_time`, '10:00');
                                        }
                                        // Slight delay to ensure value propogation if needed, or just call
                                        setTimeout(() => handleAutoFillSchedule(n, type), 0);
                                      },
                                    })}
                                    style={{ width: 14, height: 14 }}
                                  />
                                  <span>Not Yet</span>
                                </label>
                                <label
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    fontSize: 11,
                                    color: 'var(--muted)',
                                    cursor: 'pointer',
                                    marginLeft: 6,
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setValue('status', 'REQUESTED');
                                      }
                                    }}
                                    style={{ width: 14, height: 14 }}
                                  />
                                  <span>Change</span>
                                </label>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                              <select
                                className="select"
                                style={{ flex: 1 }}
                                value={watch(`schedule_${n}_golf_course`) || ''}
                                onChange={(e) => {
                                  setValue(`schedule_${n}_golf_course`, e.target.value);
                                  handleAutoFillSchedule(n, type);
                                }}
                                disabled={regionLocked}
                              >
                                <option value="">골프장 선택</option>
                                {filteredGolfCourses.map((g) => (
                                  <option key={g.id} value={g.code || g.name}>
                                    {g.code ? `[${g.code}] ${g.name || ''}` : g.name}
                                  </option>
                                ))}
                              </select>
                              <input
                                className="input"
                                {...register(`schedule_${n}_golf_course`, {
                                  onBlur: () => handleAutoFillSchedule(n, type),
                                })}
                                placeholder="골프장 직접 입력"
                                style={{ flex: 1 }}
                                disabled={regionLocked}
                              />
                            </div>
                            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                              <input
                                className="input"
                                {...register(`schedule_${n}_golf_course_code`, {
                                  onBlur: () => handleAutoFillSchedule(n, type),
                                })}
                                placeholder="코스 (옵션)"
                                style={{ flex: 1 }}
                              />
                            </div>
                            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                              <input
                                className="input"
                                {...register(`schedule_${n}_voucher_vendor_code`, {
                                  onBlur: () => handleAutoFillSchedule(n, type),
                                })}
                                placeholder="Voucher 코드 (옵션)"
                                style={{ flex: 1 }}
                              />
                              <input
                                className="input"
                                {...register(`schedule_${n}`, {
                                  onChange: () =>
                                    setScheduleManualFlags((prev) => ({ ...prev, [n]: true })),
                                })}
                                placeholder="표시 텍스트 (보드용)"
                                style={{ flex: 1, border: '1px solid rgba(241, 196, 15, 0.5)' }}
                              />
                            </div>
                          </>
                        )}
                        {type !== 'GOLF' && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input
                              className="input"
                              {...register(`schedule_${n}`, {
                                onChange: () =>
                                  setScheduleManualFlags((prev) => ({ ...prev, [n]: true })),
                              })}
                              placeholder="표시 텍스트 (보드용)"
                              style={{ flex: 1, border: '1px solid rgba(241, 196, 15, 0.5)' }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div style={{ marginTop: 30, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn secondary" onClick={() => nav(-1)}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving...' : 'Save Booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
