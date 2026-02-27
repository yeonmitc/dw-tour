
import { createClient } from '@supabase/supabase-js';

const url = 'https://spndbojijpfaotowhtul.supabase.co';
const key = 'sb_publishable_gImsit5kcdaOVFmIz7FSRA_9MJXmXUM';

const supabase = createClient(url, key);

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
    console.error('Insert Error:', JSON.stringify(error, null, 2));
  } else {
    console.log('Insert Success:', data);
    // Cleanup
    if (data && data[0]) {
      const { error: delError } = await supabase.from('vouchers').delete().eq('id', data[0].id);
      if (delError) console.error('Cleanup Error:', delError);
      else console.log('Cleanup Success');
    }
  }
}

testInsertVoucher();
