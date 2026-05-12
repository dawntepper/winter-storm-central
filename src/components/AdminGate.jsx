import { useState } from 'react';
import { Link } from 'react-router-dom';

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD;
const SESSION_KEY = 'admin_authenticated';

/**
 * Wraps an admin page with a password gate. Auth persists in sessionStorage
 * so navigating between /admin, /admin/storms, /admin/blog doesn't re-prompt.
 */
export default function AdminGate({ children }) {
  const [authenticated, setAuthenticated] = useState(
    sessionStorage.getItem(SESSION_KEY) === 'true'
  );

  if (authenticated) return children;
  return <PasswordGate onAuthenticate={() => setAuthenticated(true)} />;
}

function PasswordGate({ onAuthenticate }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, 'true');
      onAuthenticate();
    } else {
      setError('Incorrect password');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-sm">
        <h1 className="text-xl font-bold text-white mb-4">Admin Access</h1>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter admin password"
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 mb-3"
            autoFocus
          />
          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
          <button
            type="submit"
            className="w-full py-2 bg-sky-600 hover:bg-sky-500 text-white font-medium rounded-lg transition-colors cursor-pointer"
          >
            Login
          </button>
        </form>
        <Link to="/" className="block text-center mt-4 text-slate-400 text-sm hover:text-white">
          ← Back to site
        </Link>
      </div>
    </div>
  );
}
