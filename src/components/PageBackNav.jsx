import { Link, useNavigate } from 'react-router-dom';
import { goBackOrHome } from '../utils/navigation';

function BackArrow() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}

/**
 * Subpage header back control: arrow uses browser history; optional "Home" link goes to /.
 */
export default function PageBackNav({ showHomeLabel = true, className = '' }) {
  const navigate = useNavigate();

  return (
    <div className={`flex items-center gap-2 text-slate-400 ${className}`}>
      <button
        type="button"
        onClick={() => goBackOrHome(navigate)}
        aria-label="Go back"
        className="hover:text-white transition-colors"
      >
        <BackArrow />
      </button>
      {showHomeLabel && (
        <Link to="/" className="hidden sm:inline text-sm hover:text-white transition-colors">
          Home
        </Link>
      )}
    </div>
  );
}
