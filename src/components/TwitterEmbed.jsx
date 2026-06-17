import { useEffect, useRef } from 'react';

const WIDGETS_SRC = 'https://platform.x.com/widgets.js';

function extractTweetStatusId(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/(?:twitter\.com|x\.com)\/[^/]+\/status\/(\d+)/i);
  return match?.[1] || null;
}

export function isTweetUrl(url) {
  return Boolean(extractTweetStatusId(url));
}

function loadWidgetsScript() {
  if (window.twttr?.widgets) return Promise.resolve();

  const existing = document.querySelector('script[data-twitter-widgets]');
  if (existing) {
    return new Promise((resolve) => {
      const done = () => resolve();
      if (window.twttr?.widgets) {
        done();
        return;
      }
      existing.addEventListener('load', done, { once: true });
    });
  }

  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = WIDGETS_SRC;
    script.async = true;
    script.charset = 'utf-8';
    script.dataset.twitterWidgets = '1';
    script.onload = resolve;
    document.body.appendChild(script);
  });
}

export default function TwitterEmbed({ tweetUrl }) {
  const containerRef = useRef(null);
  const statusId = extractTweetStatusId(tweetUrl);

  useEffect(() => {
    if (!statusId || !containerRef.current) return;

    let cancelled = false;

    loadWidgetsScript().then(() => {
      if (cancelled || !containerRef.current) return;
      window.twttr?.widgets?.load(containerRef.current);
    });

    return () => {
      cancelled = true;
    };
  }, [statusId]);

  if (!statusId) return null;

  return (
    <div ref={containerRef} className="twitter-embed my-2 [&_.twitter-tweet]:mx-0">
      <blockquote className="twitter-tweet">
        <a href={`https://x.com/i/status/${statusId}`} />
      </blockquote>
    </div>
  );
}
