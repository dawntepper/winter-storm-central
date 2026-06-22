import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isValidZipFormat,
  lookupZip,
  INVALID_ZIP_MESSAGE,
  _clearZipLookupCache,
} from './zipLookupService';

describe('isValidZipFormat', () => {
  it('accepts exactly 5 digits', () => {
    expect(isValidZipFormat('80301')).toBe(true);
    expect(isValidZipFormat(' 80301 ')).toBe(true);
  });

  it('rejects non-5-digit input', () => {
    expect(isValidZipFormat('8030')).toBe(false);
    expect(isValidZipFormat('803011')).toBe(false);
    expect(isValidZipFormat('abcde')).toBe(false);
    expect(isValidZipFormat('')).toBe(false);
  });
});

describe('lookupZip', () => {
  afterEach(() => {
    _clearZipLookupCache();
    vi.restoreAllMocks();
  });

  it('returns parsed place data from Zippopotam', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        places: [{
          'place name': 'Boulder',
          state: 'Colorado',
          'state abbreviation': 'CO',
          latitude: '40.0150',
          longitude: '-105.2705',
        }],
      }),
    }));

    const result = await lookupZip('80301');
    expect(result).toEqual({
      zip: '80301',
      city: 'Boulder',
      state: 'Colorado',
      stateAbbr: 'CO',
      lat: 40.015,
      lon: -105.2705,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('caches successful lookups for the session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        places: [{
          'place name': 'Boulder',
          state: 'Colorado',
          'state abbreviation': 'CO',
          latitude: '40.0150',
          longitude: '-105.2705',
        }],
      }),
    }));

    await lookupZip('80301');
    await lookupZip('80301');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('returns null for unknown ZIP and caches the miss', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    expect(await lookupZip('00000')).toBeNull();
    expect(await lookupZip('00000')).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('returns null for bad format without calling API', async () => {
    vi.stubGlobal('fetch', vi.fn());
    expect(await lookupZip('bad')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('INVALID_ZIP_MESSAGE', () => {
  it('is the user-facing validation copy', () => {
    expect(INVALID_ZIP_MESSAGE).toBe("That doesn't look like a valid US ZIP code");
  });
});
