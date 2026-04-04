import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres:SANDEEP%401717%23@db.zdcywmtcdrphhiynrpka.supabase.co:5432/postgres'
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to DB');

    // Get all tables
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    const tables = res.rows.map(r => r.table_name);
    console.log('Tables found:', tables);

    // Search for Sukh6565 in any relevant looking table
    for (const table of tables) {
      if (['pg_stat_statements_info', 'pg_stat_statements'].includes(table)) continue;
      
      try {
        // Just select 10 rows to see what's in there
        // Or better, let's get columns to see if there's anything like user/agent/Sukh6565
        const colsRes = await client.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = $1
        `, [table]);
        
        const cols = colsRes.rows.map(r => r.column_name);
        
        let hasPotentialText = false;
        const textCols = colsRes.rows.filter(r => ['character varying', 'text'].includes(r.data_type)).map(r => r.column_name);

        if (textCols.length > 0) {
            const conditions = textCols.map(c => `"${c}" ILIKE '%Sukh6565%'`).join(' OR ');
            const query = `SELECT * FROM "${table}" WHERE ${conditions} LIMIT 5`;
            const dataRes = await client.query(query);
            if (dataRes.rows.length > 0) {
                console.log(`\n✅ FOUND "Sukh6565" in table: ${table}`);
                console.log(JSON.stringify(dataRes.rows, null, 2));
            } else {
                // If it's something that looks like bank accounts, let's print 1 sample row anyway
                if (table.includes('bank') || table.includes('account') || table.includes('subagent') || table.includes('data')) {
                   const sampleRes = await client.query(`SELECT * FROM "${table}" LIMIT 1`);
                   if (sampleRes.rows.length > 0) {
                       console.log(`\n--- Sample from ${table} ---`);
                       console.log(JSON.stringify(sampleRes.rows[0], null, 2));
                   }
                }
            }
        }
      } catch (err) {
        console.error(`Error querying table ${table}:`, err.message);
      }
    }

  } catch (err) {
    console.error('Connection error', err.stack);
  } finally {
    await client.end();
  }
}

run();
