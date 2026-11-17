// Procedural sound: every effect is synthesised with WebAudio, so the game ships
// no audio files and never touches the network. The context is created lazily on
// the first user gesture (browsers block audio before one) and every call before
// that is a silent no-op.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;
  // No AudioContext is created until a user gesture unlocks it: browsers warn
  // on every resume attempt before one, and a screenshot run has no gesture.
  let unlocked = false;

  function ensure() {
    if (!unlocked) return false;
    if (context) {
      if (context.state === 'suspended') context.resume();
      return true;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.35;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  /** A short oscillator blip that slides from one frequency to another. */
  function blip(type, from, to, duration, volume) {
    if (!ensure() || muted) return;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  /** A burst of filtered noise, for explosions and whooshes. */
  function noise(duration, volume, filterFrom, filterTo) {
    if (!ensure() || muted) return;
    const now = context.currentTime;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFrom, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, filterTo), now + duration);
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(now);
  }

  return {
    unlock() {
      unlocked = true;
      ensure();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    get muted() {
      return muted;
    },
    shoot() {
      blip('square', 880 + Math.random() * 120, 320, 0.07, 0.10);
    },
    hit() {
      blip('triangle', 300, 140, 0.05, 0.12);
    },
    explode() {
      noise(0.28, 0.30, 2400, 120);
      blip('sine', 220, 40, 0.25, 0.25);
    },
    bigExplode() {
      noise(0.5, 0.4, 3200, 80);
      blip('sine', 160, 28, 0.45, 0.35);
    },
    pickup(combo) {
      const step = Math.min(combo, 12);
      blip('sine', 620 + step * 45, 940 + step * 45, 0.08, 0.12);
    },
    levelUp() {
      [523, 659, 784, 1047].forEach((freq, index) => {
        setTimeout(() => blip('triangle', freq, freq, 0.16, 0.16), index * 70);
      });
    },
    dash() {
      noise(0.16, 0.18, 1800, 500);
    },
    hurt() {
      blip('sawtooth', 180, 60, 0.22, 0.28);
      noise(0.12, 0.2, 900, 200);
    },
    waveClear() {
      [392, 523, 659].forEach((freq, index) => {
        setTimeout(() => blip('triangle', freq, freq, 0.14, 0.14), index * 90);
      });
    },
    gameOver() {
      [392, 311, 233, 175].forEach((freq, index) => {
        setTimeout(() => blip('triangle', freq, freq * 0.9, 0.3, 0.16), index * 160);
      });
    },
    click() {
      blip('sine', 700, 900, 0.05, 0.12);
    },
  };
}
