/**
 * generate-sounds.js
 * Run: node generate-sounds.js
 * Generates all required .wav sound files into ./files/
 * Uses only Node.js built-ins — no dependencies.
 */
const fs   = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'files');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const SR = 22050; // sample rate

// ─── WAV writer ──────────────────────────────────────────────────────────────
function writeWav(filename, samples /* Float32Array */) {
  const numSamples = samples.length;
  const pcm = Buffer.alloc(numSamples * 2);
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    pcm.writeInt16LE(Math.round(s * 32767), i * 2);
  }
  const dataSize   = pcm.length;
  const fileSize   = 44 + dataSize;
  const buf        = Buffer.alloc(fileSize);
  buf.write('RIFF',       0);  buf.writeUInt32LE(fileSize - 8, 4);
  buf.write('WAVE',       8);  buf.write('fmt ', 12);
  buf.writeUInt32LE(16,  16);  buf.writeUInt16LE(1,  20);  // PCM
  buf.writeUInt16LE(1,   22);  buf.writeUInt32LE(SR, 24);  // mono
  buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); // byteRate, blockAlign
  buf.writeUInt16LE(16,  34);  // bitsPerSample
  buf.write('data',      36);  buf.writeUInt32LE(dataSize, 40);
  pcm.copy(buf, 44);
  fs.writeFileSync(path.join(OUT, filename), buf);
  console.log('✓', filename, `(${(fileSize / 1024).toFixed(1)} KB)`);
}

// ─── Synthesis helpers ───────────────────────────────────────────────────────
function silence(durationSec) {
  return new Float32Array(Math.round(SR * durationSec));
}

function tone(freq, durationSec, wave = 'sine', ampEnv = null) {
  const n = Math.round(SR * durationSec);
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let v;
    if (wave === 'sine')     v = Math.sin(2 * Math.PI * freq * t);
    else if (wave === 'square') v = Math.sign(Math.sin(2 * Math.PI * freq * t));
    else if (wave === 'saw')    v = 2 * ((freq * t) % 1) - 1;
    else v = Math.sin(2 * Math.PI * freq * t);
    // Amplitude envelope: exponential decay unless overridden
    const env = ampEnv ? ampEnv(i, n) : Math.exp(-6 * i / n);
    // Fade last 10ms to prevent click
    const fadeEnd = Math.min(1, (n - i) / (SR * 0.01));
    s[i] = v * env * fadeEnd;
  }
  return s;
}

function noise(durationSec, ampEnv = null) {
  const n = Math.round(SR * durationSec);
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const v = Math.random() * 2 - 1;
    const env = ampEnv ? ampEnv(i, n) : Math.exp(-8 * i / n);
    s[i] = v * env;
  }
  return s;
}

function mix(...tracks) {
  const len = Math.max(...tracks.map(t => t.length));
  const out = new Float32Array(len);
  for (const t of tracks)
    for (let i = 0; i < t.length; i++) out[i] += t[i];
  // Soft normalise to ±0.95
  let peak = 0;
  for (const v of out) if (Math.abs(v) > peak) peak = Math.abs(v);
  if (peak > 0.95) for (let i = 0; i < out.length; i++) out[i] *= 0.95 / peak;
  return out;
}

function concat(...segs) {
  const len = segs.reduce((a, s) => a + s.length, 0);
  const out = new Float32Array(len);
  let pos = 0;
  for (const s of segs) { out.set(s, pos); pos += s.length; }
  return out;
}

// ─── click.wav  (beat pacer — crisp metronome click) ─────────────────────────
// Short 800 Hz sine + noise transient, fast decay
writeWav('click.wav', mix(
  tone(900,  0.04, 'sine', (i, n) => Math.exp(-12 * i / n)),
  noise(0.04, (i, n) => 0.3 * Math.exp(-20 * i / n)),
));

// ─── tick.wav  (claim progress milestones 25/50/75%) ─────────────────────────
writeWav('tick.wav', tone(1000, 0.03, 'square', (i, n) => 0.5 * Math.exp(-10 * i / n)));

// ─── claim.wav  (territory claimed — ascending 3-note chime) ─────────────────
writeWav('claim.wav', concat(
  tone(880,  0.10, 'sine'),
  tone(1100, 0.10, 'sine'),
  tone(1320, 0.18, 'sine'),
));

// ─── coin.wav  (coins earned — high bright chime) ────────────────────────────
writeWav('coin.wav', concat(
  tone(1400, 0.07, 'sine'),
  tone(1800, 0.12, 'sine'),
));

// ─── start_run.wav  (run starts — 4-note ascending) ─────────────────────────
writeWav('start_run.wav', concat(
  tone(440,  0.10, 'sine'),
  tone(554,  0.10, 'sine'),
  tone(659,  0.10, 'sine'),
  tone(880,  0.20, 'sine'),
));

// ─── finish_run.wav  (run ends — satisfying resolution) ──────────────────────
writeWav('finish_run.wav', concat(
  tone(880,  0.12, 'sine'),
  tone(660,  0.10, 'sine'),
  tone(880,  0.10, 'sine'),
  tone(1100, 0.25, 'sine'),
));

// ─── level_up.wav  (level up — fanfare) ──────────────────────────────────────
writeWav('level_up.wav', concat(
  tone(523,  0.10, 'sine'),
  tone(659,  0.10, 'sine'),
  tone(784,  0.10, 'sine'),
  tone(1047, 0.30, 'sine'),
));

// ─── mission_complete.wav  (mission done — 3-note upward) ────────────────────
writeWav('mission_complete.wav', concat(
  tone(784,  0.10, 'sine'),
  tone(988,  0.10, 'sine'),
  tone(1175, 0.22, 'sine'),
));

// ─── tap.wav  (UI tap — short high sine) ─────────────────────────────────────
writeWav('tap.wav', tone(800, 0.02, 'sine', (i, n) => 0.7 * Math.exp(-15 * i / n)));

// ─── notification.wav  (ping) ────────────────────────────────────────────────
writeWav('notification.wav', concat(
  tone(1200, 0.08, 'sine'),
  tone(1500, 0.14, 'sine'),
));

// ─── own_zone.wav  (entering own zone — gentle confirm) ──────────────────────
writeWav('own_zone.wav', concat(
  tone(660, 0.08, 'sine'),
  tone(880, 0.14, 'sine'),
));

// ─── enemy_zone.wav  (entering enemy zone — low warning pulse) ───────────────
writeWav('enemy_zone.wav', mix(
  tone(220, 0.20, 'saw', (i, n) => 0.6 * Math.exp(-3 * i / n)),
  tone(185, 0.20, 'saw', (i, n) => 0.4 * Math.exp(-3 * i / n)),
));

// ─── error.wav  (error state) ────────────────────────────────────────────────
writeWav('error.wav', mix(
  tone(300, 0.18, 'saw', (i, n) => 0.7 * Math.exp(-4 * i / n)),
  tone(200, 0.18, 'saw', (i, n) => 0.5 * Math.exp(-4 * i / n)),
));

console.log('\nAll sound files generated in ./files/');
