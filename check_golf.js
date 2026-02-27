
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkGolfCourses() {
  console.log('Checking golf_courses data...');
  const { data, error } = await supabase
    .from('golf_courses')
    .select('*')
    .limit(10);
  
  if (error) {
    console.error('Error:', error);
  } else {
    if (data && data.length > 0) {
      console.log('Columns:', Object.keys(data[0]));
      console.table(data.map(g => ({ id: g.id, name: g.name, country: g.country, region: g.region })));
    } else {
      console.log('No data found in golf_courses.');
    }
  }
}

checkGolfCourses();
