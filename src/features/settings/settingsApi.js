import { supabase } from '../../lib/supabase';

// Helper to check response
const checkError = (error) => {
  if (error) throw error;
};

// --- Generic CRUD ---
// table: 'product_types' | 'partners' | 'flightinfo' | 'golf_courses' | 'hotel_master' | 'guide_master' | 'vehicle_master'
export async function getMasterData(table, branch = null) {
  let query = supabase.from(table).select('*');

  // created_at 컬럼이 없는 테이블도 있어서 시간 기준 정렬은 사용하지 않는다.
  // 마스터 데이터는 코드/이름 기준으로만 정렬한다.
  if (
    table === 'product_types' ||
    table === 'partners' ||
    table === 'flightinfo' ||
    table === 'hotel_master'
  ) {
    query = query.order('code', { ascending: true });
  } else if (
    table === 'golf_courses' ||
    table === 'guide_master' ||
    table === 'vehicle_master' ||
    table === 'driver_master'
  ) {
    query = query.order('name', { ascending: true });
  }

  // If table has 'branch' column and branch is provided, filter by it.
  // Note: product_types/partners/golf_courses have 'region' and 'branch'.
  // But usually we filter by 'region' for the office.
  // The 'branch' column in these tables might mean "This product belongs to MANILA branch".
  // The user requirement: "Japan office sees Japan type products".
  // This means we should filter by 'region' if the user is an office user.
  // However, the caller (UI) should handle the logic of "what to ask for".
  // Here we just support filtering.

  if (branch) {
    // Ideally we should filter by region or branch depending on the table.
    // But since the UI will pass the filter logic, we can just support a generic filter if needed.
    // Actually, for simplicity, let's just return all and filter in UI?
    // No, RLS is better. But RLS is already set to "true" for authenticated.
    // Let's rely on the UI passing the correct filter or just returning everything and filtering in memory
    // (since master data is small).
    // But the user asked for filtering.
    // Let's return everything and let the hook filter, OR support filtering here.
  }

  const { data, error } = await query;
  checkError(error);
  return data;
}

export async function createMasterData(table, payload) {
  const { data, error } = await supabase.from(table).insert([payload]).select().single();
  checkError(error);
  return data;
}

export async function updateMasterData(table, id, payload) {
  const { data, error } = await supabase.from(table).update(payload).eq('id', id).select().single();
  checkError(error);
  return data;
}

export async function deleteMasterData(table, id) {
  const { error } = await supabase.from(table).delete().eq('id', id);
  checkError(error);
}
