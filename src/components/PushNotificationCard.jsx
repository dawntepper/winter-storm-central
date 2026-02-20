import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

/**
 * Native push notification opt-in card.
 * Only renders on iOS/Android (Capacitor native platform).
 * Replaces the email signup bar in the native app.
 */
export default function PushNotificationCard() {
  const [permissionStatus, setPermissionStatus] = useState('unknown'); // 'unknown' | 'prompt' | 'granted' | 'denied'
  const [dismissed, setDismissed] = useState(false);
  const [token, setToken] = useState(null);

  // Only show on native platforms
  if (!Capacitor.isNativePlatform()) return null;

  useEffect(() => {
    checkPermission();
  }, []);

  const checkPermission = async () => {
    try {
      const status = await PushNotifications.checkPermissions();
      setPermissionStatus(status.receive);
    } catch {
      setPermissionStatus('prompt');
    }
  };

  const requestPermission = async () => {
    try {
      const status = await PushNotifications.requestPermissions();
      setPermissionStatus(status.receive);

      if (status.receive === 'granted') {
        await PushNotifications.register();

        // Listen for registration token
        PushNotifications.addListener('registration', (tokenData) => {
          setToken(tokenData.value);
          // TODO: Send token to your backend (Supabase) for push delivery
          console.log('Push registration token:', tokenData.value);
        });

        PushNotifications.addListener('registrationError', (error) => {
          console.error('Push registration error:', error);
        });

        // Listen for incoming notifications
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Push notification received:', notification);
        });

        // Listen for notification taps
        PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          console.log('Push notification action:', action);
          // TODO: Navigate to relevant alert/state based on notification data
        });
      }
    } catch (err) {
      console.error('Push permission error:', err);
    }
  };

  // Don't show if already granted or dismissed
  if (permissionStatus === 'granted' || dismissed) return null;

  // Don't show if denied (user made their choice in Settings)
  if (permissionStatus === 'denied') return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[999] bg-slate-800 border-t border-slate-600 px-4 py-3 shadow-lg shadow-black/40"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}
    >
      <div className="max-w-lg mx-auto flex items-center gap-3">
        {/* Icon */}
        <span className="text-2xl flex-shrink-0">🔔</span>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Severe Weather Alerts</p>
          <p className="text-xs text-slate-400">Get instant push notifications for your area</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setDismissed(true)}
            className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
          >
            Later
          </button>
          <button
            onClick={requestPermission}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors cursor-pointer"
          >
            Enable
          </button>
        </div>
      </div>
    </div>
  );
}
