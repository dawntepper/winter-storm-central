import { useState, useEffect } from 'react';

const DISMISSED_KEY = 'stormtracking_signup_dismissed';
const SUBSCRIBER_KEY = 'stormtracking_subscriber';
const KIT_FORM_ID = '9086634';

export default function AlertSignupBar() {
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [status, setStatus] = useState('idle'); // idle | submitting | success | error
  const [errorMsg, setErrorMsg] = useState('');
  const [isReturning, setIsReturning] = useState(false);

  useEffect(() => {
    // Don't show if dismissed this session
    if (sessionStorage.getItem(DISMISSED_KEY)) return;

    // Check if this is a returning subscriber
    try {
      const saved = JSON.parse(localStorage.getItem(SUBSCRIBER_KEY));
      if (saved?.email) {
        setEmail(saved.email);
        setZipCode(saved.zip || '');
        setIsReturning(true);
      }
    } catch {
      // ignore bad data
    }

    // Slide up after a short delay for a smooth entrance
    const timer = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    sessionStorage.setItem(DISMISSED_KEY, '1');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanEmail = email.trim();
    const cleanZip = zipCode.trim();

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Please enter a valid email address');
      return;
    }
    if (!cleanZip || !/^\d{5}$/.test(cleanZip)) {
      setErrorMsg('Please enter a valid 5-digit zip code');
      return;
    }

    setStatus('submitting');

    try {
      const response = await fetch('/api/subscribe-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, zip_code: cleanZip }),
      });

      if (!response.ok) {
        let msg = `Server error (${response.status})`;
        try {
          const data = await response.json();
          msg = data.error || msg;
        } catch {
          // non-JSON response (e.g. 502 gateway error)
        }
        throw new Error(msg);
      }

      const data = await response.json();

      // Remember subscriber for future visits
      localStorage.setItem(
        SUBSCRIBER_KEY,
        JSON.stringify({ email: cleanEmail, zip: cleanZip })
      );

      setStatus('success');
      setIsReturning(true);
      // Auto-dismiss after success
      setTimeout(() => {
        handleDismiss();
      }, 4000);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'Something went wrong. Please try again.');
    }
  };

  if (!visible && status !== 'success') return null;

  const headline = isReturning
    ? 'Update Your Weather Alert Location'
    : 'Get Severe Weather Alerts For Your Area';

  const buttonLabel = isReturning ? 'Update Alerts' : 'Get Alerts';
  const submittingLabel = isReturning ? 'Updating...' : 'Signing up...';
  const successMessage = isReturning
    ? 'Your alert location has been updated!'
    : "You're signed up! You'll receive alerts when severe weather is detected in your area.";

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: '#1e293b',
        borderTop: '3px solid #2563eb',
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.5)',
        transform: visible ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '16px 20px',
          position: 'relative',
        }}
      >
        {/* Close button */}
        <button
          onClick={handleDismiss}
          aria-label="Close signup bar"
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#94a3b8',
            fontSize: '20px',
            lineHeight: 1,
            padding: '4px 8px',
          }}
        >
          &times;
        </button>

        {status === 'success' ? (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <p style={{ color: '#34d399', fontWeight: 600, fontSize: '15px', margin: 0 }}>
              {successMessage}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="signup-bar-form">
            <div className="signup-bar-inner">
              {/* Headline */}
              <p className="signup-bar-headline">
                {headline}
              </p>

              {/* Inputs row */}
              <div className="signup-bar-inputs">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  required
                  style={{
                    flex: '1 1 220px',
                    minWidth: 0,
                    padding: '10px 14px',
                    border: '1px solid #475569',
                    borderRadius: '6px',
                    background: '#0f172a',
                    color: '#e2e8f0',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                />
                <input
                  type="text"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  placeholder="Zip code"
                  required
                  maxLength={5}
                  style={{
                    flex: '0 0 110px',
                    padding: '10px 14px',
                    border: '1px solid #475569',
                    borderRadius: '6px',
                    background: '#0f172a',
                    color: '#e2e8f0',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                />
                <button
                  type="submit"
                  disabled={status === 'submitting'}
                  style={{
                    flex: '0 0 auto',
                    padding: '10px 24px',
                    background: status === 'submitting' ? '#1e40af' : '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 600,
                    fontSize: '14px',
                    cursor: status === 'submitting' ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => { if (status !== 'submitting') e.target.style.background = '#3b82f6'; }}
                  onMouseLeave={(e) => { if (status !== 'submitting') e.target.style.background = '#2563eb'; }}
                >
                  {status === 'submitting' ? submittingLabel : buttonLabel}
                </button>
              </div>
            </div>

            {/* Error message */}
            {errorMsg && (
              <p style={{ color: '#f87171', fontSize: '13px', margin: '8px 0 0', textAlign: 'center' }}>
                {errorMsg}
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
