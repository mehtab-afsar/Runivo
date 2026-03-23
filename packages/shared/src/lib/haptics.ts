/* eslint-disable @typescript-eslint/no-explicit-any */
let HapticsPlugin: any = null;
let capacitorReady = false;
let pendingHaptic: Parameters<typeof haptic>[0] | null = null;

// Eagerly kick off the Capacitor import so it resolves as fast as possible.
// Any haptic() call that arrives before it resolves is stored in pendingHaptic
// and replayed once the plugin is available.
try {
  if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform()) {
    const mod = '@capacitor/haptics';
    (Function('m', 'return import(m)')(mod) as Promise<any>)
      .then((m: any) => {
        HapticsPlugin = m.Haptics;
        capacitorReady = true;
        // Replay the most-recent pending haptic if there is one
        if (pendingHaptic) {
          const queued = pendingHaptic;
          pendingHaptic = null;
          haptic(queued);
        }
      })
      .catch(() => {
        capacitorReady = true; // plugin unavailable — stop queuing
      });
  } else {
    capacitorReady = true; // web env — no plugin to wait for
  }
} catch {
  capacitorReady = true;
}

export function haptic(
  type: 'light' | 'medium' | 'heavy' | 'success' | 'error' = 'light'
) {
  // Plugin is available — fire immediately
  if (HapticsPlugin) {
    try {
      switch (type) {
        case 'light':
          HapticsPlugin.impact({ style: 'LIGHT' });
          break;
        case 'medium':
          HapticsPlugin.impact({ style: 'MEDIUM' });
          break;
        case 'heavy':
          HapticsPlugin.impact({ style: 'HEAVY' });
          break;
        case 'success':
          HapticsPlugin.notification({ type: 'SUCCESS' });
          break;
        case 'error':
          HapticsPlugin.notification({ type: 'ERROR' });
          break;
      }
      return;
    } catch {
      // Fall through to web vibration
    }
  }

  // Plugin not yet loaded on native — queue and replay once ready
  if (!capacitorReady) {
    pendingHaptic = type; // only keep the most recent
    return;
  }

  // Fallback: Web Vibration API
  if (!navigator.vibrate) return;
  const patterns: Record<string, number[]> = {
    light: [10],
    medium: [20],
    heavy: [30],
    success: [10, 50, 10],
    error: [30, 50, 30, 50, 30],
  };
  navigator.vibrate(patterns[type] || [10]);
}
