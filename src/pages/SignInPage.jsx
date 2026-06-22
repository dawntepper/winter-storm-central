import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import AuthForm from '../components/auth/AuthForm';
import { useAuth } from '../hooks/useAuth';
import { getReturnPathFromSearch } from '../lib/authRedirect';
import { FooterLinks } from '../components/SiteFooter';

export default function SignInPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, initializing, isConfigured } = useAuth();
  const returnPath = getReturnPathFromSearch(searchParams);
  const defaultMode = searchParams.get('mode') === 'signup' ? 'signup' : 'signin';

  useEffect(() => {
    document.title = 'Sign In | StormTracking';
    const desc = document.querySelector('meta[name="description"]');
    if (desc) {
      desc.setAttribute(
        'content',
        'Sign in to StormTracking to sync saved weather locations across your devices. Email, password, or Google — weather stays free.'
      );
    }
  }, []);

  useEffect(() => {
    if (initializing || !isAuthenticated) return;
    navigate(returnPath, { replace: true });
  }, [initializing, isAuthenticated, navigate, returnPath]);

  const handleSuccess = () => {
    navigate(returnPath, { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200">
      <Header />

      <main className="max-w-md mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {!isConfigured ? (
          <div className="rounded-2xl border border-slate-600 bg-slate-800 p-6 text-center">
            <p className="text-sm text-slate-300 mb-4">Account sign-in is not available in this environment.</p>
            <Link to="/" className="text-sm text-sky-400 hover:text-sky-300 font-medium">
              ← Back to live weather
            </Link>
          </div>
        ) : initializing ? (
          <div className="text-center py-12">
            <p className="text-sm text-slate-400">Loading…</p>
          </div>
        ) : (
          <>
            <AuthForm returnPath={returnPath} defaultMode={defaultMode} onSuccess={handleSuccess} />
            <div className="mt-6 text-center">
              <Link
                to={returnPath === '/' ? '/' : returnPath}
                className="text-sm text-slate-400 hover:text-sky-300 transition-colors"
              >
                ← Continue without signing in
              </Link>
            </div>
          </>
        )}
      </main>

      <footer className="text-center py-6 border-t border-slate-800 px-4">
        <FooterLinks />
      </footer>
    </div>
  );
}
