// Deep scan — find Sukh6565 UUID and all their bank_data records
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://zdcywmtcdrphhiynrpka.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkY3l3bXRjZHJwaGhpeW5ycGthIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDIxNTY1NSwiZXhwIjoyMDg5NzkxNjU1fQ.K7pJPQ67dxo7LGYAOloqiiQ5WPAla5ORQYKOd-GUaK4',
  { auth: { persistSession: false } }
);

(async () => {
  // 1. Find the user by login_id = Sukh6565
  console.log('\n── Finding user Sukh6565 ──');
  const { data: users, error: uErr } = await supabase
    .from('users')
    .select('id, name, login_id, role, agent_id, email')
    .eq('login_id', 'Sukh6565');

  if (uErr || !users?.length) {
    // Try by name
    const { data: u2 } = await supabase.from('users').select('id,name,login_id,role,agent_id,email').ilike('name','%Sukh6565%');
    console.log('By name search:', JSON.stringify(u2, null, 2));
  } else {
    console.log('User found:', JSON.stringify(users, null, 2));
  }

  // 2. Also try finding by login_id directly
  const { data: byLogin } = await supabase.from('users').select('*').eq('login_id','Sukh6565');
  console.log('\n── By login_id ──');
  console.log(JSON.stringify(byLogin, null, 2));

  // 3. Fetch bank_data for this user (all possible column references)
  // We'll try uploaded_by, agent_id, subagent_id with both the login_id and UUID
  console.log('\n── bank_data sample (5 rows) ──');
  const { data: bankSample } = await supabase.from('bank_data').select('*').limit(5);
  console.log(JSON.stringify(bankSample, null, 2));

  // 4. Count total rows in bank_data
  const { count } = await supabase.from('bank_data').select('*', { count: 'exact', head: true });
  console.log(`\nTotal rows in bank_data: ${count}`);

})();
