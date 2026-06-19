import { Navigate, useLocation } from 'react-router-dom';

/**
 * Client-side mirror of the Netlify trailing-slash 301 redirect. Covers local
 * dev (vite) and any in-app navigation to a trailing-slash path. Root is exempt.
 */
export default function StripTrailingSlash() {
  const location = useLocation();

  if (location.pathname.length > 1 && location.pathname.endsWith('/')) {
    return (
      <Navigate
        to={{
          pathname: location.pathname.replace(/\/+$/, ''),
          search: location.search,
          hash: location.hash,
        }}
        replace
      />
    );
  }

  return null;
}
