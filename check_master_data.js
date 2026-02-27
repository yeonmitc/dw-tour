import { createClient } from '@supabase/supabase-js';

const url = 'https://spndbojijpfaotowhtul.supabase.co';
const anon = 'sb_publishable_gImsit5kcdaOVFmIz7FSRA_9MJXmXUM';

const supabase = createClient(url, anon);

async function checkData() {
  const tables = ['partners'];

  for (const table of tables) {
    console.log(`--- Checking ${table} ---`);
    const { data, error } = await supabase.from(table).select('region');
    if (error) {
      console.error(`Error fetching ${table}:`, error);
    } else {
      if (data.length === 0) {
        console.log(`No data found in ${table}`);
      } else {
        const regions = [...new Set(data.map((item) => item.region))];
        console.log(`Distinct regions in ${table}:`, regions);
      }
    }
    console.log('\n');
  }
}

checkData();
