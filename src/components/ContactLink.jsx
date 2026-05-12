import { useState } from 'react';
import { trackSupportClick } from '../utils/analytics';

export default function ContactLink({ children, className }) {
  const [copied, setCopied] = useState(false);

  const handleClick = async (e) => {
    e.preventDefault();
    const email = ['stormtracking', 'mkzlabs.com'].join('@');
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt('Copy this email address:', email);
    }
    trackSupportClick('email');
  };

  return (
    <span className="relative inline-block">
      <a
        href="#"
        onClick={handleClick}
        aria-label="Copy StormTracking support email to clipboard"
        className={className}
      >
        {children}
      </a>
      {copied && (
        <span
          role="status"
          className="absolute top-full left-1/2 -translate-x-1/2 mt-1 text-xs text-emerald-300 whitespace-nowrap bg-slate-900 border border-slate-700 px-2 py-1 rounded shadow-lg z-50"
        >
          &#10003; Copied: stormtracking@mkzlabs.com
        </span>
      )}
    </span>
  );
}
