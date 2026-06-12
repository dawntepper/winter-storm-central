const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const ANTHROPIC_MAX_TOKENS = 2000;
const ANTHROPIC_TIMEOUT_MS = 30_000;

/** Bracket access avoids esbuild inlining env vars at bundle time. */
function readAnthropicEnvRaw() {
  return process.env['ANTHROPIC_API_KEY'];
}

/**
 * Normalize ANTHROPIC_API_KEY from Netlify/UI paste quirks (quotes, BOM, whitespace).
 */
function normalizeAnthropicApiKey(raw) {
  if (typeof raw !== 'string') return { key: '', hadOuterQuotes: false };
  let key = raw.trim().replace(/^\uFEFF/, '');
  let hadOuterQuotes = false;
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    hadOuterQuotes = true;
    key = key.slice(1, -1).trim();
  }
  return { key, hadOuterQuotes };
}

function getAnthropicApiKey() {
  const { key, hadOuterQuotes } = normalizeAnthropicApiKey(readAnthropicEnvRaw());
  if (!key) {
    throw new Error('Server is missing ANTHROPIC_API_KEY env var');
  }
  if (!key.startsWith('sk-ant-')) {
    throw new Error(
      `ANTHROPIC_API_KEY looks malformed (expected sk-ant-… prefix, got length ${key.length})${
        hadOuterQuotes ? '; remove surrounding quotes in Netlify env' : ''
      }`
    );
  }
  return key;
}

/** Safe metadata for admin diagnostics — never returns the full key. */
function describeAnthropicKeyConfig() {
  const raw = readAnthropicEnvRaw();
  const { key, hadOuterQuotes } = normalizeAnthropicApiKey(raw);
  return {
    configured: Boolean(key),
    keyLength: key.length,
    keyPrefix: key.slice(0, 10),
    looksValid: key.startsWith('sk-ant-'),
    hadOuterQuotes,
    model: HAIKU_MODEL,
    apiUrl: ANTHROPIC_API,
  };
}

function normalizePassedApiKey(apiKey) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) return null;
  const { key } = normalizeAnthropicApiKey(apiKey);
  return key || null;
}

function formatAnthropicAuthHint() {
  const diag = describeAnthropicKeyConfig();
  const parts = [
    `configured=${diag.configured}`,
    `length=${diag.keyLength}`,
    `prefix=${diag.keyPrefix || '(empty)'}`,
    `looksValid=${diag.looksValid}`,
  ];
  if (diag.hadOuterQuotes) parts.push('hadOuterQuotes=true');
  return parts.join(', ');
}

async function callHaiku({ systemPrompt, userPrompt, apiKey, maxTokens = ANTHROPIC_MAX_TOKENS }) {
  const resolvedKey = normalizePassedApiKey(apiKey) || getAnthropicApiKey();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ANTHROPIC_TIMEOUT_MS);

  let resp;
  try {
    resp = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': resolvedKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: HAIKU_MODEL,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt },
          { role: 'assistant', content: '{' },
        ],
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Anthropic API timed out after 30 seconds');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok) {
    const text = await resp.text();
    if (resp.status === 401) {
      const hint = formatAnthropicAuthHint();
      console.error('Anthropic 401 — key diagnostic:', describeAnthropicKeyConfig());
      throw new Error(
        `Anthropic API 401: invalid x-api-key (${hint}). ` +
          'Check Netlify → Environment variables → ANTHROPIC_API_KEY: no quotes, Functions scope, redeploy after save.'
      );
    }
    throw new Error(`Anthropic API ${resp.status}: ${text.slice(0, 500)}`);
  }

  const data = await resp.json();
  const text = '{' + (data?.content?.[0]?.text || '');
  return {
    text,
    usage: data?.usage || null,
    stopReason: data?.stop_reason || null,
    model: HAIKU_MODEL,
  };
}

function stripMarkdownFences(text) {
  let s = String(text || '').trim();
  const fullFence = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fullFence) return fullFence[1].trim();
  s = s.replace(/^```(?:json)?\s*\n?/i, '');
  s = s.replace(/\n?```\s*$/i, '');
  return s.trim();
}

function removeTrailingCommas(jsonStr) {
  return jsonStr.replace(/,(\s*[}\]])/g, '$1');
}

function extractJSONObject(text) {
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first !== -1 && last > first) {
    return text.slice(first, last + 1);
  }
  if (first !== -1) return text.slice(first);
  return text;
}

/** Close unbalanced brackets/strings when Haiku output is truncated mid-JSON. */
function repairTruncatedJSON(jsonStr) {
  let s = jsonStr.trim();
  const stack = [];
  let inString = false;
  let escaped = false;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (c === '\\') {
        escaped = true;
        continue;
      }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === '{') stack.push('}');
    else if (c === '[') stack.push(']');
    else if ((c === '}' || c === ']') && stack.length && stack[stack.length - 1] === c) {
      stack.pop();
    }
  }

  if (inString) s += '"';

  s = s.replace(/,\s*"[^"]*"\s*:\s*("[^"]*)?$/, '');
  s = s.replace(/,\s*\{[^{}]*$/, '');
  s = s.replace(/,\s*\[[^\[\]]*$/, '');
  s = s.replace(/,\s*"[^"]*$/, '');
  s = s.replace(/:\s*$/, ': null');
  s = s.replace(/,\s*$/, '');

  while (stack.length) s += stack.pop();
  return s;
}

function tryParseJSON(text) {
  try {
    return { parsed: JSON.parse(text), error: null };
  } catch (err) {
    return { parsed: null, error: err.message };
  }
}

function parseHaikuJSON(rawText) {
  const candidates = new Set();
  const base = String(rawText || '');
  candidates.add(base);
  const stripped = stripMarkdownFences(base);
  candidates.add(stripped);
  candidates.add(extractJSONObject(stripped));
  candidates.add(extractJSONObject(base));

  let lastError = 'Unknown parse error';

  for (const candidate of candidates) {
    const direct = tryParseJSON(candidate);
    if (direct.parsed) {
      return { parsed: direct.parsed, parseError: null, repaired: false };
    }
    lastError = direct.error;

    const noTrailing = removeTrailingCommas(candidate);
    const fixed = tryParseJSON(noTrailing);
    if (fixed.parsed) {
      return { parsed: fixed.parsed, parseError: null, repaired: true };
    }
    lastError = fixed.error;

    const repaired = repairTruncatedJSON(noTrailing);
    const fixedRepaired = tryParseJSON(repaired);
    if (fixedRepaired.parsed) {
      return { parsed: fixedRepaired.parsed, parseError: null, repaired: true };
    }
    lastError = fixedRepaired.error;
  }

  return { parsed: null, parseError: lastError, repaired: false };
}

/**
 * Call Haiku and parse JSON with repair + optional compact retry on failure.
 * @param {object} opts
 * @param {object} [opts.retry] — { systemPrompt, userPrompt?, maxTokens? }
 */
async function callHaikuForJSON({
  systemPrompt,
  userPrompt,
  apiKey,
  maxTokens = ANTHROPIC_MAX_TOKENS,
  retry = null,
}) {
  const first = await callHaiku({ systemPrompt, userPrompt, apiKey, maxTokens });
  let { parsed, parseError, repaired } = parseHaikuJSON(first.text);

  if (parsed) {
    const warnings = [];
    if (first.stopReason === 'max_tokens') warnings.push('Response may be truncated');
    if (repaired) warnings.push('JSON was auto-repaired');
    return {
      parsed,
      parseError: null,
      parseWarning: warnings.length ? warnings.join('; ') : null,
      truncated: first.stopReason === 'max_tokens',
      repaired,
      usage: first.usage,
      model: first.model,
      stopReason: first.stopReason,
      retried: false,
    };
  }

  if (retry) {
    console.warn('Haiku JSON parse failed, retrying with compact prompt:', parseError);
    const second = await callHaiku({
      systemPrompt: retry.systemPrompt,
      userPrompt: retry.userPrompt ?? userPrompt,
      apiKey,
      maxTokens: retry.maxTokens ?? maxTokens,
    });
    ({ parsed, parseError, repaired } = parseHaikuJSON(second.text));
    if (parsed) {
      return {
        parsed,
        parseError: null,
        parseWarning: 'Generated with compact prompt after initial parse failure',
        truncated: second.stopReason === 'max_tokens',
        repaired,
        usage: second.usage,
        model: second.model,
        stopReason: second.stopReason,
        retried: true,
      };
    }
    return {
      parsed: null,
      parseError,
      rawText: second.text,
      usage: second.usage,
      model: second.model,
      stopReason: second.stopReason,
      retried: true,
    };
  }

  return {
    parsed: null,
    parseError,
    rawText: first.text,
    usage: first.usage,
    model: first.model,
    stopReason: first.stopReason,
    retried: false,
  };
}

module.exports = {
  HAIKU_MODEL,
  getAnthropicApiKey,
  describeAnthropicKeyConfig,
  callHaiku,
  callHaikuForJSON,
  parseHaikuJSON,
};
