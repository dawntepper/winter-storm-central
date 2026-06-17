/** Period-over-period trend helpers (shared with admin-analysis-api tests). */

function getPreviousPeriodBounds(dateRange) {
  const now = new Date();
  switch (dateRange) {
    case 'today': {
      const until = new Date(now);
      until.setHours(0, 0, 0, 0);
      const since = new Date(until);
      since.setDate(since.getDate() - 1);
      return { since: since.toISOString(), until: until.toISOString() };
    }
    case 'yesterday': {
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      const since = new Date(yesterdayStart);
      since.setDate(since.getDate() - 1);
      return { since: since.toISOString(), until: yesterdayStart.toISOString() };
    }
    case '7d': {
      const until = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const since = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      return { since: since.toISOString(), until: until.toISOString() };
    }
    case '30d': {
      const until = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const since = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      return { since: since.toISOString(), until: until.toISOString() };
    }
    case 'all':
    default:
      return null;
  }
}

function computeTrend(current, previous) {
  const cur = Number(current) || 0;
  const prev = Number(previous) || 0;
  if (cur === 0 && prev === 0) {
    return { direction: 'flat', changePct: 0, current: cur, previous: prev };
  }
  if (prev === 0) {
    return { direction: 'up', changePct: 100, current: cur, previous: prev };
  }
  const changePct = Math.round(((cur - prev) / prev) * 1000) / 10;
  return {
    direction: changePct > 1 ? 'up' : changePct < -1 ? 'down' : 'flat',
    changePct,
    current: cur,
    previous: prev,
  };
}

module.exports = {
  getPreviousPeriodBounds,
  computeTrend,
};
