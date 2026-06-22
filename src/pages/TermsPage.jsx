import { Link } from 'react-router-dom';
import LegalPageLayout, { LegalSection, LegalList } from '../components/LegalPageLayout';

const PAGE_TITLE = 'Terms of Service | StormTracking';
const PAGE_DESCRIPTION =
  'Terms of Service for StormTracking.io — live weather alerts, radar, and account features. Informational use only; not an official NWS source.';
const CONTACT_EMAIL = 'support@stormtracking.io';

export default function TermsPage() {
  return (
    <LegalPageLayout
      title={PAGE_TITLE}
      description={PAGE_DESCRIPTION}
      path="/terms"
      heading="Terms of Service"
      intro="These Terms of Service (“Terms”) govern your use of StormTracking.io. By accessing or using the site, you agree to these Terms."
    >
      <LegalSection title="The Service">
        <p>
          StormTracking.io provides live weather radar, National Weather Service alert feeds, forecasts, and related
          tools for personal, informational use. Weather data and alerts are always free. Optional account sign-in
          syncs saved locations across your devices.
        </p>
      </LegalSection>

      <LegalSection title="Not an Official Weather Source">
        <p>
          StormTracking is an independent service. We are <strong className="text-slate-200">not</strong> affiliated
          with, endorsed by, or operated by the National Weather Service, NOAA, or any government agency. Data may be
          delayed, incomplete, or inaccurate. Weather conditions change rapidly.
        </p>
        <p>
          <strong className="text-slate-200">Do not rely on StormTracking as your sole source for life-safety decisions.</strong>{' '}
          For official warnings and emergency guidance, visit{' '}
          <a href="https://weather.gov" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">
            weather.gov
          </a>{' '}
          and follow instructions from local emergency management.
        </p>
      </LegalSection>

      <LegalSection title="Accounts">
        <p>
          You may create an account with email and password or Google sign-in (via Supabase Auth). You are responsible
          for maintaining the security of your credentials and for activity under your account. You must provide
          accurate information and be at least 13 years old to create an account.
        </p>
        <p>
          See our{' '}
          <Link to="/privacy" className="text-sky-400 hover:underline">
            Privacy Policy
          </Link>{' '}
          for how we handle your data.
        </p>
      </LegalSection>

      <LegalSection title="Acceptable Use">
        <p>You agree not to:</p>
        <LegalList
          items={[
            'Use the service for any unlawful purpose or in violation of applicable regulations.',
            'Attempt to gain unauthorized access to our systems, other accounts, or third-party data feeds.',
            'Scrape, overload, or interfere with the operation of the site or its data sources.',
            'Misrepresent StormTracking as an official government weather service.',
          ]}
        />
      </LegalSection>

      <LegalSection title="Intellectual Property">
        <p>
          The StormTracking name, branding, site design, and original content are owned by us or our licensors. NWS
          alert data and NOAA radar products are in the public domain but remain subject to their respective source
          terms. You may not copy or redistribute substantial portions of the site without permission.
        </p>
      </LegalSection>

      <LegalSection title="Third-Party Services">
        <p>
          The site links to or integrates third-party services (hosting, authentication, analytics, affiliate
          partners). Your use of those services is subject to their own terms and privacy policies.
        </p>
      </LegalSection>

      <LegalSection title="Disclaimer of Warranties">
        <p>
          THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE” WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED,
          INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT
          ALERTS, RADAR, OR FORECASTS WILL BE TIMELY, ACCURATE, OR UNINTERRUPTED.
        </p>
      </LegalSection>

      <LegalSection title="Limitation of Liability">
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, STORMTRACKING AND ITS OPERATORS WILL NOT BE LIABLE FOR ANY INDIRECT,
          INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF LIFE, PROPERTY, OR DATA, ARISING FROM
          YOUR USE OF OR RELIANCE ON THE SERVICE — INCLUDING MISSED OR DELAYED WEATHER ALERTS.
        </p>
      </LegalSection>

      <LegalSection title="Termination">
        <p>
          We may suspend or terminate access to the service at any time, with or without notice, for conduct that
          violates these Terms or harms the service or other users. You may stop using the site at any time.
        </p>
      </LegalSection>

      <LegalSection title="Governing Law">
        <p>
          These Terms are governed by the laws of the United States and the State of Florida, without regard to
          conflict-of-law principles. Any disputes shall be resolved in courts located in Florida, unless otherwise
          required by applicable law.
        </p>
      </LegalSection>

      <LegalSection title="Changes to These Terms">
        <p>
          We may revise these Terms from time to time. The “Last updated” date reflects the latest version. Continued
          use after changes constitutes acceptance. Material changes may be noted on the site.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions about these Terms? Email{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-sky-400 hover:underline">
            {CONTACT_EMAIL}
          </a>{' '}
          or use the{' '}
          <Link to="/" className="text-sky-400 hover:underline">
            Contact link
          </Link>{' '}
          on our homepage.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
