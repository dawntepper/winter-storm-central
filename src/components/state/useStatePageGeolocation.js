import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { resolveCityPageFromCoords } from '../../services/locationCatalogService';
import {
  trackStateUseMyLocationClicked,
  trackUseMyLocationClick,
  trackCityPageLocationChanged,
  trackGeolocationUsed,
  FORECAST_SOURCE_PAGES,
} from '../../utils/analytics';

/**
 * Shared geolocation → city page navigation for state alert surfaces.
 */
export default function useStatePageGeolocation(stateCode) {
  const navigate = useNavigate();
  const [gpsStatus, setGpsStatus] = useState('idle');
  const [error, setError] = useState('');

  const handleUseMyLocation = useCallback(() => {
    trackStateUseMyLocationClicked({ state: stateCode });

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsStatus('unsupported');
      return;
    }
    setError('');
    setGpsStatus('locating');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        trackGeolocationUsed();
        try {
          const resolved = await resolveCityPageFromCoords(latitude, longitude);
          trackUseMyLocationClick({
            sourcePage: FORECAST_SOURCE_PAGES.STATE_ALERT_PAGE,
            currentCity: null,
            currentState: stateCode,
            resolvedCity: resolved.cityName,
            resolvedState: resolved.stateCode,
            navigationSuccess: resolved.navigationSuccess,
          });

          if (resolved.navigationSuccess && resolved.path) {
            trackCityPageLocationChanged({
              fromCity: null,
              fromState: stateCode,
              toCity: resolved.cityName,
              toState: resolved.stateCode,
              source: 'use_my_location',
            });
            navigate(resolved.path);
            setGpsStatus('idle');
            return;
          }

          setError(resolved.fallbackMessage || 'Could not find a city page near you.');
        } catch (err) {
          console.warn('Use My Location failed:', err);
          setError('Could not resolve your location — try selecting a city below.');
        }
        setGpsStatus('idle');
      },
      (err) => {
        setGpsStatus(err.code === 1 ? 'denied' : 'error');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }, [navigate, stateCode]);

  const gpsMessage =
    gpsStatus === 'unsupported'
      ? 'Geolocation unavailable on this device.'
      : gpsStatus === 'denied'
        ? 'Location access blocked in browser settings.'
        : gpsStatus === 'error'
          ? 'Could not get your location — try again.'
          : null;

  return {
    handleUseMyLocation,
    isLocating: gpsStatus === 'locating',
    error,
    gpsMessage,
  };
}
