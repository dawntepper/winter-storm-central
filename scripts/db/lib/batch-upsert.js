const DEFAULT_CHUNK = 400;

async function batchUpsert(supabase, table, rows, { onConflict, chunkSize = DEFAULT_CHUNK } = {}) {
  if (!rows.length) return { count: 0 };

  let total = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });
    if (error) {
      throw new Error(`${table} upsert failed (rows ${i}-${i + chunk.length}): ${error.message}`);
    }
    total += chunk.length;
  }
  return { count: total };
}

module.exports = { batchUpsert, DEFAULT_CHUNK };
