
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkColumns() {
  console.log('Checking bookings columns...');
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('Error:', error);
  } else {
    if (data && data.length > 0) {
      console.log('Columns:', Object.keys(data[0]));
    } else {
      console.log('No data found, cannot infer columns easily without metadata query.');
    }
  }
}

checkColumns();
