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

function parseHaikuJSON(rawText) {
  try {
    return { parsed: JSON.parse(rawText), parseError: null };
  } catch (err) {
    const first = rawText.indexOf('{');
    const last = rawText.lastIndexOf('}');
    if (first !== -1 && last > first) {
      try {
        return { parsed: JSON.parse(rawText.slice(first, last + 1)), parseError: null };
      } catch (err2) {
        return { parsed: null, parseError: err2.message };
      }
    }
    return { parsed: null, parseError: err.message };
  }
}

module.exports = {
  HAIKU_MODEL,
  getAnthropicApiKey,
  describeAnthropicKeyConfig,
  callHaiku,
  parseHaikuJSON,
};
