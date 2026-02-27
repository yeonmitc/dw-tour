// bulk_create_staff.mjs
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

// ====== 환경변수 ======
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing env: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function parseCSV(csvText) {
  // 간단 CSV 파서 (콤마 포함 필드 없음 가정)
  const lines = csvText.split(/\r?\n/).filter(Boolean);
  const header = lines[0].split(',').map((s) => s.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(',').map((s) => s.trim());
    const row = {};
    header.forEach((h, i) => (row[h] = cols[i] ?? ''));
    return row;
  });
}

async function upsertProfile(userId, { role, branch, display_name }) {
  // profiles 테이블이 이미 만들어져 있어야 함
  const payload = {
    user_id: userId,
    role,
    branch: branch || null,
    display_name: display_name || null,
    is_active: true,
  };

  const { error } = await supabaseAdmin.from('profiles').upsert(payload, { onConflict: 'user_id' });

  if (error) throw error;
}

async function ensureUser({ email, password }) {
  // 1) 이미 존재하는지 확인
  const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listErr) throw listErr;

  const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (existing) return existing;

  // 2) 없으면 생성
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Confirm email OFF여도 상관없이 확정 상태로 생성
  });

  if (error) throw error;
  return data.user;
}

async function main() {
  const csvPath = path.resolve(process.cwd(), 'employees.csv');
  if (!fs.existsSync(csvPath)) {
    console.error('employees.csv not found:', csvPath);
    process.exit(1);
  }

  const rows = parseCSV(fs.readFileSync(csvPath, 'utf-8'));

  console.log(`Loaded ${rows.length} employees`);
  const results = { created: 0, existed: 0, profiled: 0, failed: 0 };

  for (const r of rows) {
    const email = r.email;
    const password = r.password;
    const role = r.role;
    const branch = r.branch;
    const display_name = r.display_name;

    if (!email || !password || !role) {
      console.log('SKIP (missing required):', r);
      continue;
    }

    if (role === 'office' && !branch) {
      console.log('SKIP (office needs branch):', email);
      continue;
    }

    try {
      const user = await ensureUser({ email, password });
      // users list로 존재 판별을 했기 때문에 여기서는 대략적으로 카운트만
      // (정확히 나누려면 ensureUser에서 플래그를 반환하면 됨)
      results.profiled++;

      await upsertProfile(user.id, { role, branch, display_name });

      console.log('OK:', email, '->', role, branch || '');
    } catch (e) {
      results.failed++;
      console.error('FAIL:', email, e?.message || e);
    }
  }

  console.log('DONE:', results);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
