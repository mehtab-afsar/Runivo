/**
 * Sound system — uses expo-av (already installed).
 * REQUIRED: Place 10 MP3 files in apps/mobile/assets/sounds/ before building.
 * Free sources: Mixkit.co (no attribution), Freesound.org (CC0 filter).
 * All playback is wrapped in try/catch — a missing or corrupt file never crashes the app.
 */
import { Audio } from 'expo-av';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SOUND_FILES = {
  gps_locked:   require('../../assets/sounds/gps_locked.mp3'),
  run_start:    require('../../assets/sounds/run_start.mp3'),
  km_tick:      require('../../assets/sounds/km_tick.mp3'),
  zone_claimed: require('../../assets/sounds/zone_claimed.mp3'),
  run_pause:    require('../../assets/sounds/run_pause.mp3'),
  run_complete: require('../../assets/sounds/run_complete.mp3'),
  award_unlock: require('../../assets/sounds/award_unlock.mp3'),
  rank_up:      require('../../assets/sounds/rank_up.mp3'),
  pace_cap:     require('../../assets/sounds/pace_cap.mp3'),
  rival_nearby: require('../../assets/sounds/rival_nearby.mp3'),
} as const;

type SoundName = keyof typeof SOUND_FILES;

const cache: Partial<Record<SoundName, Audio.Sound>> = {};
let soundEnabled = true;
export function setSoundEnabled(enabled: boolean) { soundEnabled = enabled; }

async function getSound(name: SoundName): Promise<Audio.Sound> {
  if (!cache[name]) {
    const { sound } = await Audio.Sound.createAsync(SOUND_FILES[name]);
    cache[name] = sound;
  }
  return cache[name]!;
}

export async function playSound(name: SoundName): Promise<void> {
  if (!soundEnabled) return;
  try {
    const sound = await getSound(name);
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch { /* never throw — audio failure must not affect the run */ }
}

export async function preloadSounds(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: false, staysActiveInBackground: false });
    await Promise.allSettled(
      (Object.keys(SOUND_FILES) as SoundName[]).map(name => getSound(name))
    );
  } catch { /* ignore — app works without preloaded sounds */ }
}
