import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * @deprecated Use /sign-in page. Kept for any legacy modal triggers — redirects immediately.
 */
export default function SignInModal({ onClose, returnPath = '/' }) {
  const navigate = useNavigate();

  useEffect(() => {
    const redirect =
      returnPath && returnPath.startsWith('/') && !returnPath.startsWith('//')
        ? `?redirect=${encodeURIComponent(returnPath)}`
        : '';
    navigate(`/sign-in${redirect}`, { replace: true });
    onClose?.();
  }, [navigate, onClose, returnPath]);

  return null;
}
