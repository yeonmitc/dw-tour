
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
    .select('id, name, country, region')
    .limit(20);
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.table(data);
  }
}

checkGolfCourses();
