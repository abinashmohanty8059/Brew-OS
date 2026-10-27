/* Synthesized UI sounds via the Web Audio API. Original tones only — no
   audio files. Callers must check the user's sound setting; it is off by
   default and the simulation never depends on audio. */

export type SoundName = "tap" | "brew" | "dispense" | "complete" | "clean" | "error";

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

function noise(ac: AudioContext, duration: number, gain = 0.02, filterFreq = 1200) {
  const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * duration), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ac.createBufferSource();
  const filter = ac.createBiquadFilter();
  const amp = ac.createGain();
  filter.type = "bandpass";
  filter.frequency.value = filterFreq;
  amp.gain.value = gain;
  src.buffer = buffer;
  src.connect(filter).connect(amp).connect(ac.destination);
  src.start();
}

export function playSound(name: SoundName): void {
  const ac = context();
  if (!ac) return;
  switch (name) {
    case "tap":
      tone(ac, 880, 0, 0.07, "triangle", 0.04);
      break;
    case "brew":
      tone(ac, 196, 0, 0.5, "sine", 0.05);
      noise(ac, 0.6, 0.015, 900);
      break;
    case "dispense":
      noise(ac, 0.8, 0.02, 2400);
      break;
    case "complete":
      tone(ac, 659.25, 0, 0.18, "sine", 0.06);
      tone(ac, 880, 0.12, 0.22, "sine", 0.06);
      tone(ac, 1318.5, 0.26, 0.4, "sine", 0.045);
      break;
    case "clean":
      tone(ac, 523.25, 0, 0.2, "triangle", 0.05);
      tone(ac, 783.99, 0.16, 0.35, "triangle", 0.05);
      break;
    case "error":
      tone(ac, 220, 0, 0.18, "square", 0.03);
      tone(ac, 196, 0.16, 0.25, "square", 0.03);
      break;
  }
}
