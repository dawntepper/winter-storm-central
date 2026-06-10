/**
 * Navigate back one step in browser history, or to fallback when there is
 * no prior entry (e.g. page opened in a new tab).
 */
export function goBackOrHome(navigate, fallback = '/') {
  const idx = window.history.state?.idx;
  const canGoBack =
    (typeof idx === 'number' && idx > 0) ||
    window.history.length > 1;

  if (canGoBack) {
    navigate(-1);
  } else {
    navigate(fallback);
  }
}
