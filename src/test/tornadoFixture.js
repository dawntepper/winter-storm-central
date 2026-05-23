// ============================================================
// TEMPORARY SMOKE-TEST FIXTURE — remove after pulse animation
// has been verified. See LiveAlertsPage.jsx for the injection
// site (gated on `import.meta.env.DEV && ?test-tornado=1`).
//
// To use: run `npm run dev` and visit /alerts?test-tornado=1
//   - The "ACTIVE WARNING" fixture should pulse (deep red halo).
//   - The "ACTIVE WATCH" fixture should NOT pulse (same color,
//     no halo) — proves the Warning-vs-Watch gating works.
// ============================================================

const HOUR = 60 * 60 * 1000;

export function makeTornadoFixtures() {
  const now = Date.now();
  const onset = new Date(now - 15 * 60 * 1000).toISOString();  // started 15min ago
  const expires = new Date(now + 2 * HOUR).toISOString();      // expires in 2h

  return [
    {
      id: 'fixture-tornado-warning',
      event: 'Tornado Warning',
      category: 'tornado',
      state: 'OK',
      location: 'Moore, OK',
      lat: 35.3395,
      lon: -97.4867,
      headline: 'Tornado Warning issued for Cleveland County',
      description: 'A tornado has been reported on the ground. Take cover immediately.',
      fullDescription:
        'A confirmed tornado was reported near Moore moving northeast at 35 mph. ' +
        'Flying debris will be dangerous to those caught without shelter. ' +
        'Mobile homes will be destroyed. Considerable damage to homes, businesses, and vehicles.',
      areaDesc: 'Cleveland, OK; Oklahoma, OK',
      severity: 'Extreme',
      urgency: 'Immediate',
      onset,
      expires,
    },
    {
      id: 'fixture-tornado-watch',
      event: 'Tornado Watch',
      category: 'tornado',
      state: 'KS',
      location: 'Wichita, KS',
      lat: 37.6872,
      lon: -97.3301,
      headline: 'Tornado Watch in effect until 9 PM CDT',
      description: 'Conditions are favorable for the development of tornadoes.',
      fullDescription:
        'A Tornado Watch means conditions are favorable for tornadoes to develop. ' +
        'Stay tuned to local media and be prepared to take shelter quickly if a Warning is issued.',
      areaDesc: 'Sedgwick, KS; Butler, KS; Harvey, KS',
      severity: 'Severe',
      urgency: 'Expected',
      onset,
      expires,
    },
  ];
}
