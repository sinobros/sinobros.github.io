import * as THREE from "three";

// Every sound here is synthesized with WebAudio at load time -- no audio
// files, matching Decision #2's "no external asset dependency" spirit.
// Positional one-shots are attached to whichever Object3D triggered them
// (a card, a chip stack, the table) via THREE.PositionalAudio; the ambient
// bed is non-positional (THREE.Audio). Nothing plays before resumeContext()
// is called from a real user gesture / XR session start, per the browser
// autoplay policy.

function envelopeAt(i, length, attackSamples, releaseSamples) {
  if (i < attackSamples) return i / attackSamples;
  if (i > length - releaseSamples) return Math.max(0, (length - i) / releaseSamples);
  return 1;
}

function synthNoiseSwoosh(ctx, durationSec, smoothing) {
  const length = Math.floor(ctx.sampleRate * durationSec);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  const attack = Math.floor(length * 0.15);
  const release = Math.floor(length * 0.55);
  let prev = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    prev += smoothing * (white - prev);
    data[i] = prev * envelopeAt(i, length, attack, release);
  }
  return buffer;
}

function synthClick(ctx, durationSec, freq) {
  const length = Math.floor(ctx.sampleRate * durationSec);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    const t = i / ctx.sampleRate;
    data[i] = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 65);
  }
  return buffer;
}

function synthTone(ctx, durationSec, freq) {
  const length = Math.floor(ctx.sampleRate * durationSec);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    const t = i / ctx.sampleRate;
    const env = Math.min(1, t * 40) * Math.exp(-t * 3.2);
    data[i] = Math.sin(2 * Math.PI * freq * t) * env;
  }
  return buffer;
}

function synthArpeggio(ctx, freqs, noteDurationSec) {
  const noteLength = Math.floor(ctx.sampleRate * noteDurationSec);
  const buffer = ctx.createBuffer(1, noteLength * freqs.length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  freqs.forEach((freq, n) => {
    for (let i = 0; i < noteLength; i++) {
      const t = i / ctx.sampleRate;
      const env = Math.min(1, t * 50) * Math.exp(-t * 7);
      data[n * noteLength + i] = Math.sin(2 * Math.PI * freq * t) * env * 0.6;
    }
  });
  return buffer;
}

function synthAmbientBed(ctx, durationSec) {
  const length = Math.floor(ctx.sampleRate * durationSec);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  const fade = Math.floor(ctx.sampleRate * 0.5);
  let prev = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    prev = prev + 0.015 * (white - prev);
    let sample = prev * 0.7;
    if (i < fade) sample *= i / fade;
    if (i > length - fade) sample *= Math.max(0, (length - i) / fade);
    data[i] = sample;
  }
  return buffer;
}

export function createAudioSystem(camera) {
  const listener = new THREE.AudioListener();
  camera.add(listener);
  const ctx = listener.context;

  const buffers = {
    cardSlide: synthNoiseSwoosh(ctx, 0.28, 0.35),
    cardFlip: synthClick(ctx, 0.06, 950),
    chipPlace: synthClick(ctx, 0.05, 1500),
    loseThud: synthTone(ctx, 0.24, 90),
    tieTone: synthTone(ctx, 0.3, 320),
    winChime: synthArpeggio(ctx, [523.25, 659.25, 783.99, 1046.5], 0.12),
    payoutCascade: synthArpeggio(ctx, [660, 740, 830, 990, 1180], 0.09),
  };

  const ambient = new THREE.Audio(listener);
  ambient.setBuffer(synthAmbientBed(ctx, 4));
  ambient.setLoop(true);
  ambient.setVolume(0.05);

  let muted = false;
  let resumed = false;

  function resumeContext() {
    if (resumed) return;
    resumed = true;
    if (ctx.state === "suspended") ctx.resume();
    if (!muted) ambient.play();
  }

  function playAt(object3D, bufferKey, { volume = 0.5, refDistance = 0.4 } = {}) {
    if (muted || !resumed) return;
    const buffer = buffers[bufferKey];
    if (!buffer) return;
    const sound = new THREE.PositionalAudio(listener);
    sound.setBuffer(buffer);
    sound.setRefDistance(refDistance);
    sound.setVolume(volume);
    object3D.add(sound);
    sound.onEnded = () => {
      object3D.remove(sound);
    };
    sound.play();
  }

  function setMuted(value) {
    muted = value;
    if (muted) {
      if (ambient.isPlaying) ambient.pause();
    } else if (resumed && !ambient.isPlaying) {
      ambient.play();
    }
  }

  function toggleMute() {
    setMuted(!muted);
    return muted;
  }

  return { listener, resumeContext, playAt, setMuted, toggleMute, isMuted: () => muted };
}
