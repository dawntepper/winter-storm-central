import { describe, expect, it } from 'vitest';
import { sortAlertsBySeverity } from './alertRanking';

describe('sortAlertsBySeverity', () => {
  it('orders alerts Extreme → Severe → Moderate → Minor → Unknown', () => {
    const input = [
      { id: '1', event: 'Flood Watch', severity: 'Minor' },
      { id: '2', event: 'Tornado Warning', severity: 'Extreme' },
      { id: '3', event: 'Wind Advisory', severity: 'Moderate' },
      { id: '4', event: 'Severe Thunderstorm Warning', severity: 'Severe' },
      { id: '5', event: 'Special Weather Statement', severity: 'Unknown' },
    ];
    const sorted = sortAlertsBySeverity(input);
    expect(sorted.map((a) => a.severity)).toEqual([
      'Extreme',
      'Severe',
      'Moderate',
      'Minor',
      'Unknown',
    ]);
  });

  it('returns empty array for empty input', () => {
    expect(sortAlertsBySeverity([])).toEqual([]);
  });
});
