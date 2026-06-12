import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  initVisitorSession,
  pulseVisitorSessionLastSeen,
  stopVisitorSessionHeartbeat,
} from '../services/visitorSessionService';

/**
 * Runs durable visitor session tracking once per browser session on all routes.
 * Pulses last_seen on route changes and periodic activity.
 */
export default function VisitorSessionTracker() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    initVisitorSession().catch(() => {});
    return () => stopVisitorSessionHeartbeat();
  }, []);

  useEffect(() => {
    pulseVisitorSessionLastSeen().catch(() => {});
  }, [pathname, search]);

  return null;
}
