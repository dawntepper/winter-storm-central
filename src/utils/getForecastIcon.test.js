import { describe, expect, it } from 'vitest';
import { FORECAST_NAV_ICON, getForecastIcon } from './getForecastIcon';

describe('getForecastIcon', () => {
  it('maps severe and precipitation conditions', () => {
    expect(getForecastIcon('Showers and thunderstorms likely')).toBe('⛈️');
    expect(getForecastIcon('Chance of showers')).toBe('🌧️');
    expect(getForecastIcon('Heavy rain')).toBe('🌧️');
    expect(getForecastIcon('Winter storm warning')).toBe('❄️');
    expect(getForecastIcon('Light snow and flurries')).toBe('❄️');
    expect(getForecastIcon('Tropical storm conditions')).toBe('🌀');
    expect(getForecastIcon('Hurricane force winds')).toBe('🌀');
  });

  it('maps sky and visibility conditions', () => {
    expect(getForecastIcon('Mostly sunny')).toBe('🌤️');
    expect(getForecastIcon('Partly cloudy')).toBe('🌤️');
    expect(getForecastIcon('Clear')).toBe('☀️');
    expect(getForecastIcon('Sunny')).toBe('☀️');
    expect(getForecastIcon('Overcast')).toBe('☁️');
    expect(getForecastIcon('Cloudy')).toBe('☁️');
    expect(getForecastIcon('Patchy fog')).toBe('🌫️');
  });

  it('checks specific terms before generic ones', () => {
    expect(getForecastIcon('Snowstorm')).toBe('❄️');
    expect(getForecastIcon('Thunderstorms and rain')).toBe('⛈️');
    expect(getForecastIcon('Mostly sunny then cloudy')).toBe('🌤️');
  });

  it('returns neutral fallback when no forecast text', () => {
    expect(getForecastIcon(null)).toBe(FORECAST_NAV_ICON);
    expect(getForecastIcon(undefined)).toBe(FORECAST_NAV_ICON);
    expect(getForecastIcon('')).toBe(FORECAST_NAV_ICON);
    expect(getForecastIcon('   ')).toBe(FORECAST_NAV_ICON);
    expect(getForecastIcon(null, '')).toBe('');
  });

  it('returns fallback for unrecognized text', () => {
    expect(getForecastIcon('Unknown conditions')).toBe(FORECAST_NAV_ICON);
    expect(getForecastIcon('Unknown conditions', '')).toBe('');
  });
});
