import { createClient } from '@supabase/supabase-js';

const url = 'https://spndbojijpfaotowhtul.supabase.co';
const key = 'sb_publishable_gImsit5kcdaOVFmIz7FSRA_9MJXmXUM';

const supabase = createClient(url, key);

const tables = [
  {
    name: 'product_types',
    payload: { code: 'TEST_PT', label: 'Test Product', type: 'TEST', prefix: 'TP', country: 'ALL' },
    update: { label: 'Test Product Updated' },
  },
  {
    name: 'partners',
    payload: { code: 'TEST_PTN', label: 'Test Partner', region: 'ALL' },
    update: { label: 'Test Partner Updated' },
  },
  {
    name: 'flightinfo',
    // Removed 'region' as it caused error. Will verify schema later.
    payload: { code: 'TEST_FL', country: 'ALL', airport: 'TEST', memo: 'Test Flight' },
    update: { memo: 'Test Flight Updated' },
  },
  {
    name: 'golf_courses',
    payload: {
      code: 'TEST_GC',
      name: 'Test Golf',
      country: 'ALL',
      region: 'ALL',
      note: 'Test Note',
    },
    update: { name: 'Test Golf Updated' },
  },
  {
    name: 'hotel_master',
    payload: {
      code: 'TEST_HT',
      name: 'Test Hotel',
      country: 'ALL',
      region: 'ALL',
      room_type: 'Standard',
      note: 'Test Note',
    },
    update: { name: 'Test Hotel Updated' },
  },
  {
    name: 'guide_master',
    payload: {
      name: 'Test Guide',
      nickname: 'TG',
      phone: '000-0000',
      country: 'ALL',
      region: 'ALL',
    },
    update: { nickname: 'TG Updated' },
  },
  {
    name: 'driver_master',
    payload: {
      name: 'Test Driver',
      nickname: 'TD',
      phone: '000-0000',
      country: 'ALL',
      region: 'ALL',
    },
    update: { nickname: 'TD Updated' },
  },
];

async function testCRUD() {
  console.log('Authenticating as master@test.com...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'master@test.com',
    password: 'Master123',
  });

  if (authError) {
    console.error('Authentication failed:', authError.message);
    return;
  }
  console.log('Authenticated successfully.\n');

  console.log('Starting CRUD tests for Settings tables...\n');

  for (const t of tables) {
    console.log(`--- Testing table: ${t.name} ---`);

    // 1. Create
    // Add unique timestamp to code/name to avoid unique constraint violations
    const suffix = '_' + Date.now();
    const insertPayload = { ...t.payload };
    if (insertPayload.code) insertPayload.code += suffix;
    else insertPayload.name += suffix;

    const { data: created, error: createError } = await supabase
      .from(t.name)
      .insert(insertPayload)
      .select()
      .single();

    if (createError) {
      console.error(`[CREATE FAILED] ${t.name}:`, createError.message);
      continue;
    }
    console.log(`[CREATE SUCCESS] ID: ${created.id}`);

    // 2. Read
    const { data: read, error: readError } = await supabase
      .from(t.name)
      .select('*')
      .eq('id', created.id)
      .single();
    if (readError) {
      console.error(`[READ FAILED] ${t.name}:`, readError.message);
    } else {
      console.log(`[READ SUCCESS] Verified ID: ${read.id}`);
    }

    // 3. Update
    const { data: updated, error: updateError } = await supabase
      .from(t.name)
      .update(t.update)
      .eq('id', created.id)
      .select()
      .single();
    if (updateError) {
      console.error(`[UPDATE FAILED] ${t.name}:`, updateError.message);
    } else {
      console.log(`[UPDATE SUCCESS] Updated field:`, t.update);
    }

    // 4. Delete
    const { error: deleteError } = await supabase.from(t.name).delete().eq('id', created.id);
    if (deleteError) {
      console.error(`[DELETE FAILED] ${t.name}:`, deleteError.message);
    } else {
      console.log(`[DELETE SUCCESS]`);
    }
    console.log('');
  }
}

testCRUD();
