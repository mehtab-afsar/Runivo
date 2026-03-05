/* eslint-disable @typescript-eslint/no-explicit-any */
let HapticsPlugin: any = null;

// Lazy-load Capacitor Haptics only on native
try {
  if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform()) {
    const mod = '@capacitor/haptics';
    (Function('m', 'return import(m)')(mod) as Promise<any>)
      .then((m: any) => { HapticsPlugin = m.Haptics; })
      .catch(() => {});
  }
} catch {
  // Not on native platform
}

export function haptic(
  type: 'light' | 'medium' | 'heavy' | 'success' | 'error' = 'light'
) {
  // Try Capacitor native haptics first
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
