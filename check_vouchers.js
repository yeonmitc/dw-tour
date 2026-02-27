
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkVouchers() {
  console.log('Checking vouchers data...');
  const { data, error } = await supabase
    .from('vouchers')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('Error:', error);
  } else {
    if (data && data.length > 0) {
      console.log('Columns:', Object.keys(data[0]));
    } else {
      console.log('No data found in vouchers.');
      // Insert a dummy to see columns if possible? No, can't easily.
      // But listVouchers query succeeded before, so columns likely exist.
    }
  }
}

checkVouchers();
