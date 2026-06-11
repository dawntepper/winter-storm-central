#!/usr/bin/env node
/**
 * Build scripts/db/data/us-places-top50.json from SimpleMaps uscities.csv.
 *
 * Source: https://simplemaps.com/data/us-cities (Basic / free tier)
 * Run after updating uscities.csv: node scripts/db/data/build-places-dataset.js
 */
const fs = require('fs');
const path = require('path');
const { citySlug } = require('../lib/slug');

const DATA_DIR = __dirname;
const CSV_PATH = path.join(DATA_DIR, 'uscities.csv');
const ADDITIONS_PATH = path.join(DATA_DIR, 'city-priority-additions.json');
const OUT_PATH = path.join(DATA_DIR, 'us-places-top50.json');
const TOP_N = 50;

function parseCsvLine(line) {
  const fields = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      fields.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  fields.push(cur);
  return fields;
}

function parsePopulation(rawProper, rawTotal) {
  const proper = parseFloat(String(rawProper || '').replace(/,/g, ''));
  if (Number.isFinite(proper) && proper > 0) return Math.round(proper);
  const total = parseFloat(String(rawTotal || '').replace(/,/g, ''));
  if (Number.isFinite(total) && total > 0) return Math.round(total);
  return null;
}

function firstZip(zipsField) {
  if (!zipsField) return null;
  const first = String(zipsField).trim().split(/\s+/)[0];
  return /^\d{5}$/.test(first) ? first : null;
}

function loadCsvRows() {
  const text = fs.readFileSync(CSV_PATH, 'utf8');
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  const idx = Object.fromEntries(header.map((h, i) => [h.replace(/"/g, ''), i]));

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const f = parseCsvLine(lines[i]);
    const stateCode = f[idx.state_id]?.replace(/"/g, '');
    const city = f[idx.city]?.replace(/"/g, '');
    const lat = parseFloat(f[idx.lat]);
    const lon = parseFloat(f[idx.lng]);
    if (!stateCode || !city || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const population = parsePopulation(f[idx.population_proper], f[idx.population]);
    if (!population) continue;

    const countyFips = String(f[idx.county_fips] || '').replace(/\D/g, '').padStart(5, '0');
    rows.push({
      slug: citySlug(city, stateCode),
      city,
      state_abbr: stateCode,
      state: f[idx.state_name]?.replace(/"/g, '') || null,
      lat: Number(lat.toFixed(6)),
      lon: Number(lon.toFixed(6)),
      population,
      county: f[idx.county_name]?.replace(/"/g, '') || null,
      county_fips: countyFips.length === 5 ? countyFips : null,
      primary_zip: firstZip(f[idx.zips]?.replace(/"/g, '')),
    });
  }
  return rows;
}

function loadPriorityAdditions() {
  if (!fs.existsSync(ADDITIONS_PATH)) return [];
  return JSON.parse(fs.readFileSync(ADDITIONS_PATH, 'utf8')).map((row) => ({
    slug: citySlug(row.city, row.state_abbr),
    city: row.city,
    state_abbr: row.state_abbr,
    state: row.state || null,
    lat: Number(row.lat),
    lon: Number(row.lon),
    population: row.population,
    county: row.county || null,
    county_fips: row.county_fips ? String(row.county_fips).padStart(5, '0') : null,
    primary_zip: row.primary_zip || null,
  }));
}

function mergeRows(csvRows, additions) {
  const bySlug = new Map();
  for (const row of csvRows) {
    if (!row.population) continue;
    bySlug.set(row.slug, row);
  }
  for (const row of additions) {
    const existing = bySlug.get(row.slug);
    if (!existing || (row.population || 0) > (existing.population || 0)) {
      bySlug.set(row.slug, { ...existing, ...row });
    }
  }
  return [...bySlug.values()];
}

function buildTopNByState(rows, n) {
  const byState = new Map();
  for (const row of rows) {
    if (!byState.has(row.state_abbr)) byState.set(row.state_abbr, []);
    byState.get(row.state_abbr).push(row);
  }

  const out = [];
  for (const [stateCode, list] of [...byState.entries()].sort()) {
    list.sort((a, b) => b.population - a.population);
    const seen = new Set();
    for (const row of list) {
      if (seen.has(row.slug)) continue;
      seen.add(row.slug);
      out.push({ ...row, source: row.source || 'population' });
      if (seen.size >= n) break;
    }
  }
  return out;
}

function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`Missing ${CSV_PATH} — download SimpleMaps uscities.csv first.`);
    process.exit(1);
  }

  const all = mergeRows(loadCsvRows(), loadPriorityAdditions());
  const top50 = buildTopNByState(all, TOP_N);

  const meta = {
    generated_at: new Date().toISOString(),
    source: 'SimpleMaps uscities.csv (https://simplemaps.com/data/us-cities)',
    top_n_per_state: TOP_N,
    total_rows: top50.length,
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify({ meta, places: top50 }, null, 2));
  console.log(`Wrote ${top50.length} places → ${OUT_PATH}`);

  const md = top50.filter((p) => p.state_abbr === 'MD');
  console.log(`MD sample (${md.length}): ${md.slice(0, 12).map((p) => p.city).join(', ')}`);
}

main();
