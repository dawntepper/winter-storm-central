import { useEffect, useState } from 'react';

/**
 * Triggers a re-render every minute. Returns the current Date.now() value
 * so consumers can read a fresh `nowMs` synchronously alongside the tick.
 *
 * Use this when a component renders time-sensitive text (e.g. "in 25 min"
 * relative-time labels) that needs to stay accurate as the clock advances,
 * without re-fetching data. Pairs with pure formatters like
 * formatExpirationBadge(expiresAt, nowMs).
 *
 * The interval is intentionally cheap: 60s cadence, one setInterval per
 * mounted consumer. If many components on a page need ticks, consider
 * lifting this into a context — but for the current single-page use
 * (StateAlertsPage), per-component is fine.
 */
export function useMinuteTick() {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  return nowMs;
}

export default useMinuteTick;
