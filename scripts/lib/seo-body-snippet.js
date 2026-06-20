/**
 * Visually hidden HTML body snippets for crawler-visible storm metadata.
 */

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function pickField(obj, keys) {
  if (!obj) return null;
  for (const key of keys) {
    const value = obj[key];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return null;
}

function formatTrackingValue(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'object') {
    const parts = [];
    if (value.speed != null) parts.push(`${value.speed} mph`);
    if (value.direction != null) parts.push(`direction ${value.direction}`);
    if (value.label != null) parts.push(String(value.label));
    if (parts.length) return parts.join(', ');
    return JSON.stringify(value);
  }
  return String(value);
}

function resolveWinds(storm, content) {
  const direct = pickField(storm, ['winds', 'max_sustained_winds', 'max_winds', 'wind_speed']);
  if (direct != null) return formatTrackingValue(direct);

  const fromContent = pickField(content, [
    'winds',
    'max_sustained_winds',
    'max_winds',
    'wind_speed',
    'windSpeed',
    'sustained_winds',
  ]);
  if (fromContent != null) return formatTrackingValue(fromContent);

  const tracking = content.tracking || content.tropical_tracking || content.hurricane_tracking;
  const fromTracking = pickField(tracking, ['winds', 'max_sustained_winds', 'wind_speed', 'windSpeed']);
  if (fromTracking != null) return formatTrackingValue(fromTracking);

  return null;
}

function resolvePressure(storm, content) {
  const direct = pickField(storm, ['pressure', 'central_pressure', 'min_pressure']);
  if (direct != null) return formatTrackingValue(direct);

  const fromContent = pickField(content, [
    'pressure',
    'central_pressure',
    'min_pressure',
    'barometric_pressure',
  ]);
  if (fromContent != null) return formatTrackingValue(fromContent);

  const tracking = content.tracking || content.tropical_tracking || content.hurricane_tracking;
  const fromTracking = pickField(tracking, ['pressure', 'central_pressure', 'min_pressure']);
  if (fromTracking != null) return formatTrackingValue(fromTracking);

  return null;
}

function resolveMovement(storm, content) {
  const direct = pickField(storm, ['movement', 'storm_movement', 'motion']);
  if (direct != null) return formatTrackingValue(direct);

  const fromContent = pickField(content, [
    'movement',
    'storm_movement',
    'motion',
    'track',
    'storm_track',
  ]);
  if (fromContent != null) return formatTrackingValue(fromContent);

  const tracking = content.tracking || content.tropical_tracking || content.hurricane_tracking;
  const fromTracking = pickField(tracking, ['movement', 'storm_movement', 'motion', 'track']);
  if (fromTracking != null) return formatTrackingValue(fromTracking);

  if (storm.location_label) return storm.location_label;
  return null;
}

function resolveTimestamp(storm) {
  return (
    storm._updated_at ||
    storm.updated_at ||
    storm.emergency_summary?.updated_at ||
    storm.emergency_summary?.updatedAt ||
    null
  );
}

/**
 * @param {object} storm — merged JSON/DB storm object
 * @returns {string} HTML snippet (visually hidden)
 */
function buildStormBodySnippet(storm) {
  const content = storm._content || storm.content || {};
  const name = storm.title || storm.slug || 'Storm event';
  const type = storm.type_label || storm.typeLabel || storm.type || 'weather event';
  const winds = resolveWinds(storm, content);
  const pressure = resolvePressure(storm, content);
  const movement = resolveMovement(storm, content);
  const updatedAt = resolveTimestamp(storm);

  const lines = [
    `Name: ${name}`,
    `Type: ${type}`,
    `Winds: ${winds || '—'}`,
    `Pressure: ${pressure || '—'}`,
    `Movement: ${movement || '—'}`,
    `Last updated: ${updatedAt || '—'}`,
  ];

  return `<div id="seo-storm-snippet" style="display:none !important" aria-hidden="true">${lines
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('')}</div>`;
}

module.exports = {
  buildStormBodySnippet,
  escapeHtml,
};
