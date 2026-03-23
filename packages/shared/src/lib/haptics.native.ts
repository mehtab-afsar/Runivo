/**
 * haptics.native.ts — Expo Haptics implementation.
 *
 * Metro resolves this over haptics.ts on iOS/Android.
 * Matches the same exported `haptic()` signature as the web version.
 */

import * as ExpoHaptics from 'expo-haptics';

export function haptic(
  type: 'light' | 'medium' | 'heavy' | 'success' | 'error' = 'light'
): void {
  try {
    switch (type) {
      case 'light':
        ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Light);
        break;
      case 'medium':
        ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Medium);
        break;
      case 'heavy':
        ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Heavy);
        break;
      case 'success':
        ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Success);
        break;
      case 'error':
        ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Error);
        break;
    }
  } catch {
    // Simulator / device without haptics — silent no-op
  }
}
