import { useEffect } from 'react';
import {
  initVisitorSession,
  stopVisitorSessionHeartbeat,
} from '../services/visitorSessionService';

/**
 * Runs durable visitor session tracking once per browser session on all routes.
 */
export default function VisitorSessionTracker() {
  useEffect(() => {
    initVisitorSession().catch(() => {});
    return () => stopVisitorSessionHeartbeat();
  }, []);

  return null;
}
