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

module.exports = { printTableCounts };
