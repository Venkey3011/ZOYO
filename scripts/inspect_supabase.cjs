const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const tables = [
  'users',
  'rooms',
  'friend_requests',
  'direct_messages',
  'transfer_logs',
  'custom_games',
  'catalog_gifts',
  'catalog_frames'
];

async function inspect() {
  console.log('--- Inspecting Supabase Tables ---');
  for (const t of tables) {
    const { data, error, count } = await supabase.from(t).select('*', { count: 'exact' }).limit(1);
    if (error) {
      console.log(`Table [${t}]: ERROR ->`, error.message, `(Code: ${error.code})`);
    } else {
      console.log(`Table [${t}]: OK (${count} rows)`);
      if (data && data.length > 0) {
        console.log(`   Columns:`, Object.keys(data[0]).join(', '));
      }
    }
  }
}

inspect();
