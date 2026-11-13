/**
 * Native packages added after a build (expo-speech, expo-calendar,
 * expo-widgets) throw on import when the installed app was built without
 * them. These loaders return null instead, so new JS never crashes an older
 * binary: the feature simply stays off until the next native build.
 */
import { requireOptionalNativeModule } from 'expo';

function load<T>(nativeName: string, get: () => T): T | null {
  try {
    if (!requireOptionalNativeModule(nativeName)) return null;
    return get();
  } catch {
    return null;
  }
}

type SpeechModule = typeof import('expo-speech');
type CalendarModule = typeof import('expo-calendar');

let speech: SpeechModule | null | undefined;
let calendar: CalendarModule | null | undefined;

// eslint-disable-next-line @typescript-eslint/no-require-imports
export const getSpeech = (): SpeechModule | null => (speech === undefined ? (speech = load('ExpoSpeech', () => require('expo-speech'))) : speech);
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const getCalendar = (): CalendarModule | null => (calendar === undefined ? (calendar = load('ExpoCalendar', () => require('expo-calendar'))) : calendar);
/** True when this build includes expo-widgets (iOS Live Activities). */
export const hasWidgets = (): boolean => load('ExpoWidgets', () => true) === true;
