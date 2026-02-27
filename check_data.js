import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://spndbojijpfaotowhtul.supabase.co';
const supabaseKey = 'sb_publishable_gImsit5kcdaOVFmIz7FSRA_9MJXmXUM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable(table) {
  console.log(`Checking table: ${table}`);
  const { data, error } = await supabase.from(table).select('*').limit(1);
  if (error) {
    console.error(`Error fetching ${table}:`, error.message);
  } else {
    if (data.length > 0) {
      console.log('Columns:', Object.keys(data[0]));
      console.log('First row:', data[0]);
    } else {
      console.log('Table is empty');
    }
  }
  console.log('-----------------------------------');
}

async function main() {
  await checkTable('driver_master');
}

main();
