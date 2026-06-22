import { Link } from 'react-router-dom';
import LegalPageLayout, { LegalSection, LegalList } from '../components/LegalPageLayout';

const PAGE_TITLE = 'Privacy Policy | StormTracking';
const PAGE_DESCRIPTION =
  'How StormTracking.io collects, uses, and protects your data — including location, saved cities, account sign-in, and privacy-friendly analytics.';
const CONTACT_EMAIL = 'support@stormtracking.io';

export default function PrivacyPage() {
  return (
    <LegalPageLayout
      title={PAGE_TITLE}
      description={PAGE_DESCRIPTION}
      path="/privacy"
      heading="Privacy Policy"
      intro="StormTracking.io (“we,” “us,” or “our”) provides live weather alerts and radar for informational purposes. This policy explains what information we collect and how we use it."
    >
      <LegalSection title="Information We Collect">
        <p>We collect only what is needed to run the service:</p>
        <LegalList
          items={[
            'Location data you provide — ZIP codes, city searches, or browser geolocation when you choose “use my location.”',
            'Saved locations and alert preferences stored in your browser and, when signed in, synced to your account.',
            'Email address when you sign up for weather alerts, create an account, or contact support.',
            'Account credentials managed through Supabase Auth (email/password or Google sign-in).',
            'Usage analytics via Plausible Analytics (privacy-friendly, cookieless page views and feature events).',
            'Basic technical data such as browser type and approximate referrer, collected automatically by our hosting and analytics providers.',
          ]}
        />
      </LegalSection>

      <LegalSection title="How We Use Your Information">
        <LegalList
          items={[
            'Display weather alerts, radar, and forecasts for locations you select.',
            'Sync saved cities across devices when you sign in.',
            'Send email alerts you have requested.',
            'Authenticate your account and protect access to your saved data.',
            'Understand how the site is used so we can improve reliability and features.',
            'Respond to support requests and enforce our Terms of Service.',
          ]}
        />
      </LegalSection>

      <LegalSection title="Authentication">
        <p>
          Account sign-in is provided by{' '}
          <a
            href="https://supabase.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-400 hover:underline"
          >
            Supabase
          </a>
          . If you use Google sign-in, Google shares basic profile information (such as your name and email) with us
          according to Google&apos;s policies. We do not receive your Google password.
        </p>
      </LegalSection>

      <LegalSection title="Analytics">
        <p>
          We use{' '}
          <a
            href="https://plausible.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-400 hover:underline"
          >
            Plausible Analytics
          </a>
          , which does not use cookies and does not track you across other websites. Analytics help us understand
          traffic patterns and which features are used — not to sell your personal information.
        </p>
      </LegalSection>

      <LegalSection title="Sharing of Information">
        <p>We do not sell your personal information. We may share data only with:</p>
        <LegalList
          items={[
            'Service providers that help us operate the site (hosting, authentication, email delivery, analytics).',
            'Law enforcement or regulators when required by applicable law.',
          ]}
        />
        <p>Weather alert data is sourced from public National Weather Service feeds and is not personal information.</p>
      </LegalSection>

      <LegalSection title="Data Retention">
        <p>
          Alert signup and account data are retained while your account or subscription is active. Browser-stored
          locations remain on your device until you clear them. Analytics data is aggregated and retained according to
          our analytics provider&apos;s policies.
        </p>
      </LegalSection>

      <LegalSection title="Your Choices">
        <LegalList
          items={[
            'Use the site without signing in — saved locations stay local to your browser.',
            'Clear saved locations from your browser settings at any time.',
            'Unsubscribe from email alerts using the link in any alert email.',
            'Delete your account by contacting us at the email below.',
          ]}
        />
      </LegalSection>

      <LegalSection title="Weather Data Disclaimer">
        <p>
          StormTracking displays NOAA and National Weather Service data for informational purposes only. We are not
          affiliated with, endorsed by, or an official source of the NWS or NOAA. Always verify critical weather
          information at{' '}
          <a href="https://weather.gov" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">
            weather.gov
          </a>{' '}
          and follow guidance from local emergency officials.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>
          StormTracking is not directed at children under 13. We do not knowingly collect personal information from
          children. If you believe a child has provided us information, contact us and we will delete it.
        </p>
      </LegalSection>

      <LegalSection title="Changes to This Policy">
        <p>
          We may update this policy from time to time. The “Last updated” date at the top reflects the most recent
          revision. Continued use of the site after changes constitutes acceptance of the updated policy.
        </p>
      </LegalSection>

      <LegalSection title="Contact Us">
        <p>
          Questions about this policy? Email{' '}
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
