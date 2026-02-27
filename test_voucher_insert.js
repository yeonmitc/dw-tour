
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testInsertVoucher() {
  console.log('Testing voucher insert...');
  
  const payload = {
    branch: 'PHILIPPINES',
    status: 'NEW',
    partner_name: 'Monkey Travel',
    play_date: '2026-03-01',
    pax: 4,
    currency: 'PHP',
    amount: 0,
    paid_status: 'UNPAID',
    booking_code: 'TEST-VOUCHER-' + Date.now(),
    schedule_1: '03/01 10:00 Test Course',
    manager: 'Test Manager'
  };

  const { data, error } = await supabase.from('vouchers').insert(payload).select();

  if (error) {
    console.error('Insert Error:', error);
  } else {
    console.log('Insert Success:', data);
    // Cleanup
    if (data && data[0]) {
      await supabase.from('vouchers').delete().eq('id', data[0].id);
      console.log('Cleanup Success');
    }
  }
}

testInsertVoucher();
