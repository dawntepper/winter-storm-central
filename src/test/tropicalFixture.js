// ============================================================
// Tropical fixture — dev-only verification tool for the tropical
// alert UI (🌀 category icon, dark-blue category color, Warning
// vs Watch markers, card badges, etc.). Activated via the
// ?test-tropical=1 URL param in `npm run dev`; tree-shaken from
// prod bundles because the only call site is gated on
// import.meta.env.DEV (see noaaAlertsService.js).
//
// Hurricanes/tropical storms are seasonal and US-landfalling ones
// are infrequent, so live-data QA is unreliable outside an active
// system. This fixture lets us verify the tropical UI — on the
// main radar AND per-state radars — without waiting for a storm.
//
// Fixtures span coastal CONUS + Puerto Rico so Caribbean territory pages
// and map framing can be verified too, and cover tropical event keywords
// (Hurricane, Tropical Storm, Storm Surge) that map to the 'tropical'
// category in shared/nws-alert-parser.js.
//
// To use: run `npm run dev` → visit /radar?test-tropical=1
//   - Hurricane Warning (Miami, FL)
//   - Tropical Storm Warning (San Juan, PR)
//   - Storm Surge Warning (Galveston, TX)
//
// If you add new tropical UI: extend this fixture if needed, but
// keep the shape (id, event, category, state, lat/lon, onset,
// expires, severity, urgency) aligned with parsed NWS alerts so
// downstream code doesn't branch on real-vs-fixture origin.
// ============================================================

const HOUR = 60 * 60 * 1000;

export function makeTropicalFixtures() {
  const now = Date.now();
  const onset = new Date(now - 3 * HOUR).toISOString();   // started 3h ago
  const expires = new Date(now + 24 * HOUR).toISOString(); // expires in 24h

  return [
    {
      id: 'fixture-hurricane-warning',
      event: 'Hurricane Warning',
      category: 'tropical',
      state: 'FL',
      location: 'Miami, FL',
      lat: 25.7617,
      lon: -80.1918,
      headline: 'Hurricane Warning issued for Southeast Florida',
      description: 'A major hurricane with 115 mph winds is approaching the coast. Complete preparations now.',
      fullDescription:
        'Hurricane conditions are expected within 36 hours. Maximum sustained winds near 115 mph with ' +
        'higher gusts. Life-threatening storm surge, damaging winds, and flooding rain are expected. ' +
        'Follow evacuation orders from local officials.',
      areaDesc: 'Miami-Dade, FL; Broward, FL',
      severity: 'Extreme',
      urgency: 'Immediate',
      onset,
      expires,
    },
    {
      id: 'fixture-tropical-storm-warning-pr',
      event: 'Tropical Storm Warning',
      category: 'tropical',
      state: 'PR',
      location: 'San Juan, PR',
      lat: 18.4655,
      lon: -66.1057,
      headline: 'Tropical Storm Warning in effect for Puerto Rico',
      description: 'Tropical storm conditions expected with winds of 45-65 mph and heavy rainfall.',
      fullDescription:
        'Tropical storm conditions are expected within 36 hours. Sustained winds of 45 to 65 mph with ' +
        'higher gusts. Heavy rainfall may produce flash flooding and mudslides. Secure loose outdoor ' +
        'objects and prepare for power outages.',
      areaDesc: 'San Juan, PR; Bayamon, PR; Carolina, PR',
      severity: 'Severe',
      urgency: 'Expected',
      onset,
      expires,
    },
    {
      id: 'fixture-storm-surge-warning',
      event: 'Storm Surge Warning',
      category: 'tropical',
      state: 'TX',
      location: 'Galveston, TX',
      lat: 29.3013,
      lon: -94.7977,
      headline: 'Storm Surge Warning issued for the upper Texas coast',
      description: 'Life-threatening inundation of 4 to 7 feet above ground level is possible.',
      fullDescription:
        'There is a danger of life-threatening inundation from rising water moving inland from the ' +
        'coastline. Peak storm surge of 4 to 7 feet above ground level is possible in low-lying areas. ' +
        'Move to higher ground and follow instructions from local officials.',
      areaDesc: 'Galveston, TX; Brazoria, TX',
      severity: 'Extreme',
      urgency: 'Immediate',
      onset,
      expires,
    },
  ];
}
