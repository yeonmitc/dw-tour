import { supabase } from '../../lib/supabase.js';

const LIST_COLUMNS =
  'id,status,partner_name,play_date,tee_time,pax,currency,amount,paid_status,updated_at,created_at,voucher_no,request_note,manager,reserver_name,schedule_1,schedule_2,schedule_3,schedule_4,booking_code';

export async function listVouchers({
  branch = 'ALL',
  keyword = '',
  status = 'ALL',
  from,
  to,
} = {}) {
  let q = supabase.from('vouchers').select(LIST_COLUMNS).order('play_date', { ascending: true });

  if (branch !== 'ALL') q = q.eq('branch', branch);
  if (status !== 'ALL') q = q.eq('status', status);
  if (from) q = q.gte('play_date', from);
  if (to) q = q.lte('play_date', to);

  if (keyword?.trim()) {
    q = q.or(`partner_name.ilike.%${keyword.trim()}%`);
  }

  const { data: vouchers, error } = await q;
  if (error) throw error;
  if (!vouchers || vouchers.length === 0) return [];

  // Manual join with bookings table to get customer info
  const bookingCodes = [...new Set(vouchers.map((v) => v.booking_code).filter(Boolean))];

  if (bookingCodes.length === 0) return vouchers;

  const { data: bookingsMap } = await supabase
    .from('bookings')
    .select('code,customer_name,customer_name_en')
    .in('code', bookingCodes);

  const bMap = {};
  if (bookingsMap) {
    bookingsMap.forEach((b) => {
      bMap[b.code] = b;
    });
  }

  return vouchers.map((row) => {
    const b = bMap[row.booking_code];
    return {
      ...row,
      customer_name: b?.customer_name,
      customer_name_en: b?.customer_name_en,
    };
  });
}

export async function createVoucher(payload) {
  const { data, error } = await supabase.from('vouchers').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateVoucherWithGuard(id, prevUpdatedAt, patch) {
  const { data, error } = await supabase
    .from('vouchers')
    .update(patch)
    .eq('id', id)
    .eq('updated_at', prevUpdatedAt)
    .select('*');

  if (error) throw error;
  const row = data?.[0];
  if (!row) {
    const err = new Error('CONFLICT: someone updated this voucher. Please refresh and retry.');
    err.code = 'CONFLICT';
    throw err;
  }
  return row;
}
