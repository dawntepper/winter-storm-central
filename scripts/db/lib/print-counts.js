async function printTableCounts(supabase, tables = ['counties', 'cities', 'city_counties', 'zip_locations']) {
  console.log('\nRow counts:');
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`  ${table}: ERROR — ${error.message}`);
    } else {
      console.log(`  ${table}: ${count ?? 0}`);
    }
  }
}

async function fetchAllRows(supabase, table, select) {
  const pageSize = 1000;
  const rows = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + pageSize - 1);
    if (error) throw new Error(`${table} fetch failed: ${error.message}`);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

async function printStateBreakdown(supabase) {
  const tables = [
    { name: 'cities', stateCol: 'state_code' },
    { name: 'zip_locations', stateCol: 'state_code' },
  ];

  for (const { name, stateCol } of tables) {
    let data;
    try {
      data = await fetchAllRows(supabase, name, stateCol);
    } catch (err) {
      console.log(`\n${name} by state: ERROR — ${err.message}`);
      continue;
    }
    const counts = {};
    for (const row of data) {
      const st = row[stateCol];
      if (st) counts[st] = (counts[st] || 0) + 1;
    }
    const sorted = Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
    console.log(`\n${name} by state (${sorted.length} states/territories, ${data.length} rows):`);
    for (const [st, n] of sorted) console.log(`  ${st}: ${n}`);
  }

  try {
    const ccData = await fetchAllRows(supabase, 'city_counties', 'city_id, cities!inner(state_code)');
    const ccCounts = {};
    for (const row of ccData) {
      const st = row.cities?.state_code;
      if (st) ccCounts[st] = (ccCounts[st] || 0) + 1;
    }
    const ccSorted = Object.entries(ccCounts).sort((a, b) => a[0].localeCompare(b[0]));
    console.log(`\ncity_counties by state (${ccSorted.length} states/territories, ${ccData.length} rows):`);
    for (const [st, n] of ccSorted) console.log(`  ${st}: ${n}`);
  } catch (err) {
    console.log(`\ncity_counties by state: ERROR — ${err.message}`);
  }
}

module.exports = { printTableCounts, printStateBreakdown };
