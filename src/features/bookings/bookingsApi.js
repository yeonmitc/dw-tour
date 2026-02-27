import { supabase } from '../../lib/supabase.js';

const LIST_COLUMNS =
  'id,code,status,paid_status,branch,start_date,end_date,pax,total_amount,currency,deposit_date,flight_info,customer_name,partner_code,base_date,memo,hotel_note,sc,first_hotel_name,first_hotel_note,"1TH","2TH","3TH","4TH","5TH","6TH",trans,created_at,updated_at,guide_vehicle,hotel_status,hotel_voucher_number,hotel_paid,hotel_paid_amount,golf_status,golf_voucher_number,golf_final,memo_1,pay_status_1,change_tee_time_1,memo_2,pay_status_2,change_tee_time_2,memo_3,pay_status_3,change_tee_time_3,memo_4,pay_status_4,change_tee_time_4,memo_5,pay_status_5,change_tee_time_5,memo_6,pay_status_6,change_tee_time_6';

export async function listBookings({
  branch = 'ALL',
  keyword = '',
  status = 'ALL',
  hotelPaid = 'ALL',
  paidStatus = 'ALL',
  from,
  to,
} = {}) {
  let q = supabase
    .from('booking_dashboard_view')
    .select(LIST_COLUMNS)
    .order('start_date', { ascending: true });

  if (branch !== 'ALL') q = q.eq('branch', branch);
  if (status !== 'ALL') q = q.eq('status', status);
  if (hotelPaid === 'PAID') q = q.eq('hotel_paid', true);
  if (hotelPaid === 'UNPAID') q = q.eq('hotel_paid', false);
  if (paidStatus !== 'ALL') q = q.eq('paid_status', paidStatus);
  if (keyword?.trim()) {
    // partner/name/code 같은 필드를 운영 스키마에 맞춰 확장 가능
    // 지금은 customer_name, code, partner_code 기준 ILIKE 예시
    q = q.or(
      `customer_name.ilike.%${keyword.trim()}%,code.ilike.%${keyword.trim()}%,partner_code.ilike.%${keyword.trim()}%`
    );
  } else {
    // 키워드가 없을 때만 날짜 필터 적용 (전체 검색 지원)
    if (from) q = q.gte('start_date', from);
    if (to) q = q.lte('start_date', to);
  }

  const { data, error } = await q;
  if (error) throw error;
  if (!data || data.length === 0) return [];

  // Manual join with partners table to get partner_name (label)
  const partnerCodes = [...new Set(data.map((b) => b.partner_code).filter(Boolean))];

  if (partnerCodes.length > 0) {
    const { data: partnersMap } = await supabase
      .from('partners')
      .select('code,label')
      .in('code', partnerCodes);

    const pMap = {};
    if (partnersMap) {
      partnersMap.forEach((p) => {
        pMap[p.code] = p.label;
      });
    }

    return data.map((row) => ({
      ...row,
      partner_name: pMap[row.partner_code] || row.partner_code,
    }));
  }

  return data;
}

export async function getBooking(id) {
  const { data, error } = await supabase.from('bookings').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function createBooking(payload) {
  const { data, error } = await supabase.from('bookings').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}

/**
 * Simple update without optimistic concurrency control (for quick inline edits)
 */
export async function updateBooking(id, patch) {
  const { data, error } = await supabase
    .from('bookings')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

/**
 * 동시 수정 대비(낙관적 동시성):
 * - 클라이언트가 알고 있는 updated_at 값과 DB의 updated_at이 같을 때만 update
 * - 이미 누군가 수정했다면 update 0건이 되므로 conflict로 처리
 */
export async function updateBookingWithGuard(id, prevUpdatedAt, patch) {
  const { data, error } = await supabase
    .from('bookings')
    .update(patch)
    .eq('id', id)
    .eq('updated_at', prevUpdatedAt)
    .select('*');

  if (error) throw error;
  const row = data?.[0];
  if (!row) {
    const err = new Error('CONFLICT: someone updated this booking. Please refresh and retry.');
    err.code = 'CONFLICT';
    throw err;
  }
  return row;
}

export async function setBookingStatus(id, prevUpdatedAt, status) {
  return updateBookingWithGuard(id, prevUpdatedAt, { status });
}

export async function upsertBookingDayItem(payload) {
  const { data, error } = await supabase
    .from('booking_day_items_mb')
    .upsert(payload, { onConflict: 'booking_id,service_date,slot_no' })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}
