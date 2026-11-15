/**
 * Drop-in replacement for `import * as Haptics from 'expo-haptics'` that honours the
 * Haptics setting. Screens used to call expo-haptics directly, so turning haptics off
 * still buzzed on most taps. Same API surface, gated on setHapticEnabled().
 */
import * as Native from 'expo-haptics';
import { isHapticEnabled } from './haptics';

export const ImpactFeedbackStyle = Native.ImpactFeedbackStyle;
export const NotificationFeedbackType = Native.NotificationFeedbackType;

export function impactAsync(style?: Native.ImpactFeedbackStyle): Promise<void> {
  return isHapticEnabled() ? Native.impactAsync(style) : Promise.resolve();
}
export function notificationAsync(type?: Native.NotificationFeedbackType): Promise<void> {
  return isHapticEnabled() ? Native.notificationAsync(type) : Promise.resolve();
}
export function selectionAsync(): Promise<void> {
  return isHapticEnabled() ? Native.selectionAsync() : Promise.resolve();
}
