import { supabase } from '../../lib/supabase.js';

const GOLF_COLUMNS =
  'id,booking_id,booking_code,service_date,golf_name,tee_time,customer_name,currency,unit_price,unit_count,total_amount,pax,partner_code,branch';

export async function listGolfReport({
  from,
  to,
  courses = [],
  partners = [],
  branch = 'ALL',
} = {}) {
  let q = supabase.from('golf_report_view').select(GOLF_COLUMNS).order('service_date', {
    ascending: true,
  });

  if (from) q = q.gte('service_date', from);
  if (to) q = q.lte('service_date', to);
  if (branch !== 'ALL') q = q.eq('branch', branch);
  if (courses.length) q = q.in('golf_name', courses);
  if (partners.length) q = q.in('partner_code', partners);

  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

const HOTEL_COLUMNS =
  'id,booking_id,booking_code,check_in,hotel_name,customer_name,currency,unit_price,unit_count,total_amount,pax,partner_code,branch';

export async function listHotelReport({
  from,
  to,
  hotels = [],
  partners = [],
  branch = 'ALL',
} = {}) {
  let q = supabase.from('hotel_report_view').select(HOTEL_COLUMNS).order('check_in', {
    ascending: true,
  });

  if (from) q = q.gte('check_in', from);
  if (to) q = q.lte('check_in', to);
  if (branch !== 'ALL') q = q.eq('branch', branch);
  if (hotels.length) q = q.in('hotel_name', hotels);
  if (partners.length) q = q.in('partner_code', partners);

  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}
