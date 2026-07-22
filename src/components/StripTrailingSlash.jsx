import { Navigate, useLocation } from 'react-router-dom';

/**
 * Client-side mirror of the strip-trailing-slash edge 301.
 * Covers local Vite dev and in-app navigations to a trailing-slash path.
 * Root `/` is exempt. Canonical public URLs never end with `/`.
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
