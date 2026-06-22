import { Link } from 'react-router-dom';
import ContactLink from './ContactLink';

const linkClass = 'text-slate-400 hover:text-sky-400 transition-colors';

function Separator() {
  return <span className="text-slate-600">|</span>;
}

export function FooterLinks({ showHome = false, contactClassName }) {
  const contactCls = contactClassName ?? `${linkClass} cursor-pointer`;

  return (
    <div className="flex items-center justify-center gap-4 text-sm flex-wrap">
      {showHome && (
        <>
          <Link to="/" className={linkClass}>
            Home
          </Link>
          <Separator />
        </>
      )}
      <Link to="/radar" className={linkClass}>
        Weather Radar
      </Link>
      <Separator />
      <ContactLink className={contactCls}>Contact</ContactLink>
      <Separator />
      <Link to="/privacy" className={linkClass}>
        Privacy
      </Link>
      <Separator />
      <Link to="/terms" className={linkClass}>
        Terms
      </Link>
      <Separator />
      <a
        href="https://status.stormtracking.io"
        className={linkClass}
        target="_blank"
        rel="noopener noreferrer"
      >
        Status
      </a>
    </div>
  );
}

export function FooterDisclaimer({ className = 'text-slate-500 text-xs max-w-2xl mx-auto' }) {
  return (
    <p className={className}>
      <span className="font-medium text-slate-400">Disclaimer:</span> StormTracking uses NOAA/National
      Weather Service data for informational purposes only. Weather forecasts can change rapidly.
      Always verify with official sources at{' '}
      <a
        href="https://weather.gov"
        target="_blank"
        rel="noopener noreferrer"
        className="text-sky-400 hover:underline cursor-pointer"
      >
        weather.gov
      </a>{' '}
      and follow local emergency management guidance. Not affiliated with NOAA or NWS.
    </p>
  );
}

export default function SiteFooter({ showHome = false, className = 'text-center py-6 border-t border-slate-800 px-4 space-y-4' }) {
  return (
    <footer className={className}>
      <FooterLinks showHome={showHome} />
      <FooterDisclaimer />
    </footer>
  );
}
