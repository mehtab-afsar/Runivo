/**
 * sounds.native.ts — real expo-audio implementation.
 * Lazily loads MP3 assets, unloads on background, persists enabled/volume.
 * Audio is imported dynamically so a missing ExpoAudio native module is
 * silently swallowed rather than crashing the app on startup.
 */
import { AppState, type AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let AudioModule: any = null;
try {
  // Dynamic require so missing native module doesn't crash import
  AudioModule = require('expo-audio');
} catch { /* expo-audio not available — sounds disabled */ }

export type SoundName =
  | 'claim' | 'enemy_zone' | 'own_zone' | 'tick'
  | 'level_up' | 'mission_complete' | 'tap'
  | 'start_run' | 'finish_run' | 'error' | 'notification';

const ENABLED_KEY = 'runivo-sound-enabled';
const VOLUME_KEY  = 'runivo-sound-volume';

// Lazy-require map. Each value is a require() call (evaluated once at load time).
// Files under ./files/ — add real MP3s to that folder to activate sounds.
type SoundSource = ReturnType<typeof require>;

const SOUND_FILES: Partial<Record<SoundName, SoundSource>> = {
  claim:            require('./files/claim.wav'),
  start_run:        require('./files/start_run.wav'),
  finish_run:       require('./files/finish_run.wav'),
  level_up:         require('./files/level_up.wav'),
  mission_complete: require('./files/mission_complete.wav'),
  tap:              require('./files/tap.wav'),
  tick:             require('./files/tick.wav'),
  notification:     require('./files/notification.wav'),
  own_zone:         require('./files/own_zone.wav'),
  enemy_zone:       require('./files/enemy_zone.wav'),
  error:            require('./files/error.wav'),
};

class SoundManager {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sounds: Partial<Record<SoundName, any>> = {};
  private enabled = true;
  private volume  = 1.0;

  constructor() {
    this.init().catch(() => {});

    AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next.match(/inactive|background/)) {
        this.unloadAll().catch(() => {});
      }
    });
  }

  private async init() {
    try {
      const [en, vol] = await Promise.all([
        AsyncStorage.getItem(ENABLED_KEY),
        AsyncStorage.getItem(VOLUME_KEY),
      ]);
      if (en !== null)  this.enabled = en === 'true';
      if (vol !== null) this.volume  = parseFloat(vol);
    } catch { /* ignore */ }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getSound(name: SoundName): Promise<any | null> {
    if (this.sounds[name]) return this.sounds[name]!;
    const src = SOUND_FILES[name];
    if (!src) return null;
    try {
      if (!AudioModule) return null;
      await AudioModule.setAudioModeAsync({ playsInSilentMode: true });
      const sound = AudioModule.createAudioPlayer(src);
      sound.volume = this.volume;
      this.sounds[name] = sound;
      return sound;
    } catch {
      return null;
    }
  }

  async play(name: SoundName, volumeOverride?: number): Promise<void> {
    if (!this.enabled) return;
    const sound = await this.getSound(name);
    if (!sound) return;
    try {
      const vol = volumeOverride ?? this.volume;
      sound.volume = Math.max(0, Math.min(1, vol));
      await sound.seekTo(0);
      sound.play();
    } catch { /* ignore */ }
  }

  private async unloadAll() {
    for (const name of Object.keys(this.sounds) as SoundName[]) {
      try { this.sounds[name]?.remove(); } catch { /* ignore */ }
    }
    this.sounds = {};
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    AsyncStorage.setItem(ENABLED_KEY, String(enabled)).catch(() => {});
    if (!enabled) this.unloadAll().catch(() => {});
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    AsyncStorage.setItem(VOLUME_KEY, String(this.volume)).catch(() => {});
    for (const sound of Object.values(this.sounds)) {
      try { if (sound) sound.volume = this.volume; } catch { /* ignore */ }
    }
  }

  isEnabled(): boolean { return this.enabled; }
  getVolume(): number  { return this.volume; }
}

export const soundManager = new SoundManager();
