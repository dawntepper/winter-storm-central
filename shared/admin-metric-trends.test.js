import { describe, expect, it } from 'vitest';
import { computeTrend, getPreviousPeriodBounds } from './admin-metric-trends.js';

describe('getPreviousPeriodBounds', () => {
  it('returns yesterday for today range', () => {
    const bounds = getPreviousPeriodBounds('today');
    expect(bounds).not.toBeNull();
    const since = new Date(bounds.since);
    const until = new Date(bounds.until);
    expect(until.getTime() - since.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('returns non-overlapping 7d window before current 7d', () => {
    const bounds = getPreviousPeriodBounds('7d');
    expect(bounds).not.toBeNull();
    const spanMs = new Date(bounds.until).getTime() - new Date(bounds.since).getTime();
    expect(spanMs).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('returns null for all time', () => {
    expect(getPreviousPeriodBounds('all')).toBeNull();
  });
});

describe('computeTrend', () => {
  it('detects upward change', () => {
    const trend = computeTrend(150, 100);
    expect(trend.direction).toBe('up');
    expect(trend.changePct).toBe(50);
  });

  it('detects downward change', () => {
    const trend = computeTrend(50, 100);
    expect(trend.direction).toBe('down');
    expect(trend.changePct).toBe(-50);
  });

  it('does not report flat when periods differ meaningfully', () => {
    const trend = computeTrend(120, 80);
    expect(trend.direction).toBe('up');
    expect(trend.changePct).toBe(50);
  });
});
