import { Howl } from 'howler';

class SoundManager {
  private sounds: Map<string, Howl> = new Map();
  private enabled: boolean = true;
  private volume: number = 0.5;

  constructor() {
    const stored = localStorage.getItem('runivo-sound');
    if (stored === 'false') this.enabled = false;

    const storedVol = localStorage.getItem('runivo-volume');
    if (storedVol) this.volume = parseFloat(storedVol);

    this.preload();
  }

  private preload() {
    // Claim territory — ascending chime
    this.register('claim', this.generateTone([
      { freq: 880, duration: 0.08, type: 'sine' },
      { freq: 1100, duration: 0.08, type: 'sine' },
      { freq: 1320, duration: 0.15, type: 'sine' },
    ]));

    // Enter enemy zone — low warning pulse
    this.register('enemy_zone', this.generateTone([
      { freq: 220, duration: 0.15, type: 'sawtooth' },
      { freq: 185, duration: 0.2, type: 'sawtooth' },
    ]));

    // Enter own zone — gentle confirmation
    this.register('own_zone', this.generateTone([
      { freq: 660, duration: 0.06, type: 'sine' },
      { freq: 880, duration: 0.1, type: 'sine' },
    ]));

    // Tick (claim progress)
    this.register('tick', this.generateTone([
      { freq: 1000, duration: 0.03, type: 'square' },
    ]));

    // Level up — fanfare
    this.register('level_up', this.generateTone([
      { freq: 523, duration: 0.12, type: 'sine' },
      { freq: 659, duration: 0.12, type: 'sine' },
      { freq: 784, duration: 0.12, type: 'sine' },
      { freq: 1047, duration: 0.3, type: 'sine' },
    ]));

    // Mission complete
    this.register('mission_complete', this.generateTone([
      { freq: 784, duration: 0.1, type: 'sine' },
      { freq: 988, duration: 0.1, type: 'sine' },
      { freq: 1175, duration: 0.2, type: 'sine' },
    ]));

    // UI tap
    this.register('tap', this.generateTone([
      { freq: 800, duration: 0.02, type: 'sine' },
    ]));

    // Start run — energetic
    this.register('start_run', this.generateTone([
      { freq: 440, duration: 0.08, type: 'sine' },
      { freq: 554, duration: 0.08, type: 'sine' },
      { freq: 659, duration: 0.08, type: 'sine' },
      { freq: 880, duration: 0.15, type: 'sine' },
    ]));

    // Finish run — satisfying completion
    this.register('finish_run', this.generateTone([
      { freq: 880, duration: 0.1, type: 'sine' },
      { freq: 660, duration: 0.1, type: 'sine' },
      { freq: 880, duration: 0.1, type: 'sine' },
      { freq: 1100, duration: 0.25, type: 'sine' },
    ]));

    // Error
    this.register('error', this.generateTone([
      { freq: 300, duration: 0.15, type: 'sawtooth' },
      { freq: 200, duration: 0.2, type: 'sawtooth' },
    ]));

    // Coin
    this.register('coin', this.generateTone([
      { freq: 1400, duration: 0.05, type: 'sine' },
      { freq: 1800, duration: 0.08, type: 'sine' },
    ]));
  }

  private generateTone(
    notes: { freq: number; duration: number; type: OscillatorType }[]
  ): string {
    const sampleRate = 22050;
    const totalDuration = notes.reduce((sum, n) => sum + n.duration, 0);
    const numSamples = Math.ceil(sampleRate * totalDuration);

    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    // WAV header
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, numSamples * 2, true);

    let offset = 0;
    let sampleIndex = 0;

    for (const note of notes) {
      const noteSamples = Math.ceil(sampleRate * note.duration);
      for (let i = 0; i < noteSamples && sampleIndex < numSamples; i++) {
        const t = i / sampleRate;
        const envelope = Math.min(1, (noteSamples - i) / (sampleRate * 0.02));
        let sample = 0;

        switch (note.type) {
          case 'sine':
            sample = Math.sin(2 * Math.PI * note.freq * t);
            break;
          case 'square':
            sample = Math.sin(2 * Math.PI * note.freq * t) > 0 ? 1 : -1;
            break;
          case 'sawtooth':
            sample = 2 * ((note.freq * t) % 1) - 1;
            break;
          case 'triangle': {
            const phase = (note.freq * t) % 1;
            sample = 4 * Math.abs(phase - 0.5) - 1;
            break;
          }
        }

        sample *= envelope * 0.3;
        const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
        view.setInt16(44 + sampleIndex * 2, intSample, true);
        sampleIndex++;
      }
      offset += note.duration;
    }

    const blob = new Blob([buffer], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  }

  private register(name: string, src: string) {
    this.sounds.set(
      name,
      new Howl({
        src: [src],
        format: ['wav'],
        volume: this.volume,
        preload: true,
      })
    );
  }

  play(name: string, volumeOverride?: number) {
    if (!this.enabled) return;

    const sound = this.sounds.get(name);
    if (sound) {
      if (volumeOverride !== undefined) {
        sound.volume(volumeOverride);
      } else {
        sound.volume(this.volume);
      }
      sound.play();
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    localStorage.setItem('runivo-sound', String(enabled));
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    localStorage.setItem('runivo-volume', String(this.volume));
  }

  isEnabled() {
    return this.enabled;
  }

  getVolume() {
    return this.volume;
  }
}

export const soundManager = new SoundManager();
