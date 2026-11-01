/* Synthesized sounds via the Web Audio API. Original tones and filtered
   noise only — no audio files. Callers check the user's sound setting;
   the simulation never depends on audio. Browsers only start audio after
   a user gesture, which the welcome screen provides. */

export type SoundName =
  | "tap"
  | "add"
  | "remove"
  | "brew"
  | "dispense"
  | "complete"
  | "clean"
  | "error"
  | "success"
  | "warning"
  | "chime";

/** Longer machine sounds that play for the length of a preparation step. */
export type MachineSound = "grind" | "brewing" | "steam" | "pour" | "vend" | "rinse" | "hum";

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Call from a user gesture so later sounds are allowed to play. */
export function unlockAudio(): void {
  context();
}

function tone(ac: AudioContext, freq: number, start: number, duration: number, type: OscillatorType = "sine", gain = 0.06) {
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime + start);
  amp.gain.setValueAtTime(0, ac.currentTime + start);
  amp.gain.linearRampToValueAtTime(gain, ac.currentTime + start + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + duration);
  osc.connect(amp).connect(ac.destination);
  osc.start(ac.currentTime + start);
  osc.stop(ac.currentTime + start + duration + 0.05);
}

interface NoiseOptions {
  duration: number;
  gain?: number;
  type?: BiquadFilterType;
  freq?: number;
  q?: number;
  /** Amplitude wobble in Hz (grinder rattle, pour flutter). */
  wobble?: number;
  fadeIn?: number;
}

/** Filtered noise with a soft envelope. Returns a stop function. */
function noise(ac: AudioContext, { duration, gain = 0.02, type = "bandpass", freq = 1200, q = 1, wobble = 0, fadeIn = 0.08 }: NoiseOptions): () => void {
  const length = Math.max(1, Math.floor(ac.sampleRate * Math.min(duration, 12)));
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  const filter = ac.createBiquadFilter();
  const amp = ac.createGain();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  src.buffer = buffer;
  const t = ac.currentTime;
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(gain, t + fadeIn);
  amp.gain.setValueAtTime(gain, t + Math.max(fadeIn, duration - 0.25));
  amp.gain.linearRampToValueAtTime(0.0001, t + duration);
  src.connect(filter).connect(amp).connect(ac.destination);
  let lfo: OscillatorNode | null = null;
  if (wobble > 0) {
    lfo = ac.createOscillator();
    const depth = ac.createGain();
    lfo.frequency.value = wobble;
    depth.gain.value = gain * 0.6;
    lfo.connect(depth).connect(amp.gain);
    lfo.start(t);
    lfo.stop(t + duration);
  }
  src.start(t);
  src.stop(t + duration);
  return () => {
    try {
      amp.gain.cancelScheduledValues(ac.currentTime);
      amp.gain.setTargetAtTime(0.0001, ac.currentTime, 0.05);
      src.stop(ac.currentTime + 0.2);
      lfo?.stop(ac.currentTime + 0.2);
    } catch {
      /* already stopped */
    }
  };
}

function hum(ac: AudioContext, freq: number, duration: number, gain: number, type: OscillatorType = "sawtooth"): () => void {
  const osc = ac.createOscillator();
  const filter = ac.createBiquadFilter();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  filter.type = "lowpass";
  filter.frequency.value = freq * 4;
  const t = ac.currentTime;
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(gain, t + 0.15);
  amp.gain.setValueAtTime(gain, t + Math.max(0.15, duration - 0.2));
  amp.gain.linearRampToValueAtTime(0.0001, t + duration);
  osc.connect(filter).connect(amp).connect(ac.destination);
  osc.start(t);
  osc.stop(t + duration);
  return () => {
    try {
      amp.gain.cancelScheduledValues(ac.currentTime);
      amp.gain.setTargetAtTime(0.0001, ac.currentTime, 0.05);
      osc.stop(ac.currentTime + 0.2);
    } catch {
      /* already stopped */
    }
  };
}

export function playSound(name: SoundName): void {
  const ac = context();
  if (!ac) return;
  switch (name) {
    case "tap":
      tone(ac, 1180, 0, 0.045, "triangle", 0.025);
      break;
    case "add":
      tone(ac, 740, 0, 0.08, "triangle", 0.045);
      tone(ac, 1110, 0.06, 0.12, "triangle", 0.04);
      break;
    case "remove":
      tone(ac, 660, 0, 0.08, "triangle", 0.04);
      tone(ac, 440, 0.06, 0.14, "triangle", 0.035);
      break;
    case "brew":
      tone(ac, 196, 0, 0.5, "sine", 0.05);
      noise(ac, { duration: 0.6, gain: 0.015, freq: 900 });
      break;
    case "dispense":
      noise(ac, { duration: 0.8, gain: 0.02, freq: 2400 });
      break;
    case "complete":
      tone(ac, 659.25, 0, 0.18, "sine", 0.06);
      tone(ac, 880, 0.12, 0.22, "sine", 0.06);
      tone(ac, 1318.5, 0.26, 0.45, "sine", 0.045);
      break;
    case "success":
      tone(ac, 523.25, 0, 0.14, "sine", 0.05);
      tone(ac, 783.99, 0.1, 0.24, "sine", 0.05);
      break;
    case "clean":
      tone(ac, 523.25, 0, 0.2, "triangle", 0.05);
      tone(ac, 783.99, 0.16, 0.35, "triangle", 0.05);
      break;
    case "warning":
      tone(ac, 587.33, 0, 0.16, "triangle", 0.05);
      tone(ac, 587.33, 0.2, 0.16, "triangle", 0.05);
      break;
    case "chime":
      tone(ac, 880, 0, 0.5, "sine", 0.04);
      tone(ac, 1318.5, 0.08, 0.6, "sine", 0.03);
      tone(ac, 1760, 0.16, 0.7, "sine", 0.02);
      break;
    case "error":
      tone(ac, 220, 0, 0.18, "square", 0.03);
      tone(ac, 196, 0.16, 0.25, "square", 0.03);
      break;
  }
}

/** Plays a machine sound for `seconds`; returns a function that stops it early. */
export function playMachineSound(name: MachineSound, seconds: number): () => void {
  const ac = context();
  if (!ac) return () => {};
  const d = Math.max(0.3, seconds);
  const stops: Array<() => void> = [];
  switch (name) {
    case "grind":
      stops.push(noise(ac, { duration: d, gain: 0.05, freq: 700, q: 0.7, wobble: 28 }));
      stops.push(hum(ac, 92, d, 0.025));
      break;
    case "brewing":
      stops.push(hum(ac, 60, d, 0.03, "sine"));
      stops.push(noise(ac, { duration: d, gain: 0.018, freq: 450, q: 2, wobble: 3 }));
      break;
    case "steam":
      stops.push(noise(ac, { duration: d, gain: 0.03, type: "highpass", freq: 3500, q: 0.5, fadeIn: 0.25 }));
      break;
    case "pour":
      stops.push(noise(ac, { duration: d, gain: 0.03, freq: 1600, q: 1.4, wobble: 9 }));
      break;
    case "vend":
      stops.push(hum(ac, 140, Math.min(d, 1.2), 0.03, "square"));
      tone(ac, 120, Math.min(d, 1.2), 0.25, "sine", 0.09);
      break;
    case "rinse":
      stops.push(noise(ac, { duration: d, gain: 0.03, freq: 900, q: 0.6, wobble: 5, fadeIn: 0.3 }));
      break;
    case "hum":
      stops.push(hum(ac, 110, d, 0.015, "sine"));
      break;
  }
  return () => stops.forEach((s) => s());
}
