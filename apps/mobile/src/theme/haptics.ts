import * as Haptics from 'expo-haptics';

let hapticEnabled = true;
export function setHapticEnabled(enabled: boolean) { hapticEnabled = enabled; }

export const haptic = {
  light:   () => { if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); },
  medium:  () => { if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); },
  heavy:   () => { if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); },
  success: () => { if (hapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); },
  warning: () => { if (hapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); },
};
