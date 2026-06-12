const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const ANTHROPIC_MAX_TOKENS = 2000;
const ANTHROPIC_TIMEOUT_MS = 30_000;

async function callHaiku({ systemPrompt, userPrompt, apiKey, maxTokens = ANTHROPIC_MAX_TOKENS }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ANTHROPIC_TIMEOUT_MS);

  let resp;
  try {
    resp = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
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
  callHaiku,
  parseHaikuJSON,
};
