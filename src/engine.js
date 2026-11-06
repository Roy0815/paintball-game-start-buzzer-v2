import { SESSION_ACTION_TO_SLOT } from './slots.js';
import { getSound } from './storage.js';

/**
 * How the remote reaches us with the phone locked
 * ------------------------------------------------
 * A Bluetooth media remote sends AVRCP commands to the phone. The OS hands
 * them to whichever app owns the active media session, and a web page owns
 * one only while one of its <audio> elements is playing. So "arming" starts
 * a looping, silent audio element (the keep-alive) and registers Media
 * Session action handlers. From then on play/pause/next/previous end up in
 * our handlers, also on the lock screen.
 *
 * The sounds themselves are played through Web Audio, not by swapping the
 * keep-alive's `src`. That way the element that holds the media session never
 * stops, so the session can not get lost between two sounds, and a decoded
 * AudioBuffer starts without the load delay of a fresh media element. As a
 * side effect the Bluetooth link already carries a (silent) stream, so the
 * speaker does not swallow the first half second of a sound while waking up.
 */

const DEBOUNCE_MS = 250;

let ctx = null;
let gain = null;
let keepAlive = null;
let keepAliveUrl = null;
let armed = false;
let current = null; // { source, slot, soundId }
let mapping = {};
let options = { repress: 'stop', volume: 1 };
const buffers = new Map(); // soundId → Promise<AudioBuffer>
const lastTrigger = new Map(); // slot → timestamp
const listeners = new Set();

/** Subscribe to engine events: { type: 'state' | 'log' | 'playing', ... } */
export function onEngineEvent(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(event) {
  for (const fn of listeners) fn(event);
}

function log(message) {
  emit({ type: 'log', message, at: new Date() });
}

export function getState() {
  return {
    armed,
    keepAlivePlaying: !!keepAlive && !keepAlive.paused,
    contextState: ctx?.state ?? 'none',
    playing: current ? { slot: current.slot, soundId: current.soundId } : null,
  };
}

function emitState() {
  emit({ type: 'state', state: getState() });
}

function getContext() {
  if (!ctx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    ctx = new Ctx({ latencyHint: 'interactive' });
    gain = ctx.createGain();
    gain.gain.value = options.volume;
    gain.connect(ctx.destination);
    ctx.addEventListener('statechange', emitState);
  }
  return ctx;
}

async function ensureRunning() {
  const c = getContext();
  if (c.state !== 'running') {
    try {
      await c.resume();
    } catch (err) {
      log(`AudioContext konnte nicht gestartet werden: ${err.message}`);
    }
  }
  return c;
}

/**
 * 15 s keep-alive clip: 16-bit mono PCM with a very quiet 30 Hz tone.
 * Pure digital silence is detected as inaudible by Chrome/Android, which
 * pauses the element after a while in the background. The tone sits around
 * -66 dBFS: above Chrome's audibility threshold (~-72 dBFS), but far below
 * anything a speaker makes audible. 15 s * 30 Hz = whole cycles, so the
 * loop has no seam. Long enough that Chrome shows the media notification
 * (it ignores clips under ~5 s).
 */
const KEEPALIVE_AMPLITUDE = 24; // of 32767
const KEEPALIVE_FREQ = 30; // Hz

function createKeepAliveWavUrl(seconds = 15, rate = 8000) {
  const n = seconds * rate;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o, s) =>
    [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + n * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); // byte rate
  v.setUint16(32, 2, true); // block align
  v.setUint16(34, 16, true); // bits per sample
  str(36, 'data');
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const sample = Math.sin((2 * Math.PI * KEEPALIVE_FREQ * i) / rate);
    v.setInt16(44 + i * 2, Math.round(sample * KEEPALIVE_AMPLITUDE), true);
  }
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

/** Retries after the system paused the keep-alive, with growing delay. */
const RESUME_DELAYS_MS = [1000, 3000, 10000];
let resumeAttempt = 0;
let resumeTimer = null;

function scheduleAutoResume() {
  clearTimeout(resumeTimer);
  if (!armed || resumeAttempt >= RESUME_DELAYS_MS.length) return;
  const delay = RESUME_DELAYS_MS[resumeAttempt++];
  resumeTimer = setTimeout(() => {
    if (!armed || !keepAlive?.paused) return;
    keepAlive
      .play()
      .then(() =>
        log(
          `Hintergrund-Audio automatisch fortgesetzt (Versuch ${resumeAttempt}).`,
        ),
      )
      .catch((err) => {
        log(`Automatisches Fortsetzen fehlgeschlagen: ${err.message}`);
        scheduleAutoResume();
      });
  }, delay);
}

function getKeepAlive() {
  if (!keepAlive) {
    keepAliveUrl = createKeepAliveWavUrl();
    keepAlive = new Audio(keepAliveUrl);
    keepAlive.loop = true;
    keepAlive.preload = 'auto';
    // Not `muted` and not volume 0: browsers do not grant a media session to
    // muted media, and iOS ignores both anyway. The content is near-silent.
    keepAlive.addEventListener('pause', () => {
      if (armed) {
        log(
          'Hintergrund-Audio wurde vom System pausiert (z. B. Anruf oder andere App).',
        );
        setPlaybackState('paused');
        scheduleAutoResume();
      }
      emitState();
    });
    keepAlive.addEventListener('playing', () => {
      resumeAttempt = 0;
      clearTimeout(resumeTimer);
      if (armed) setPlaybackState('playing');
      emitState();
    });
  }
  return keepAlive;
}

function setPlaybackState(state) {
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = state;
}

function setMetadata() {
  if (!('mediaSession' in navigator) || !window.MediaMetadata) return;
  const base = import.meta.env.BASE_URL;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: 'Buzzer bereit',
    artist: 'Paintball Buzzer',
    album: 'Fernbedienung aktiv',
    artwork: [
      { src: `${base}icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
      { src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
    ],
  });
}

function safeSetHandler(action, handler) {
  try {
    navigator.mediaSession.setActionHandler(action, handler);
  } catch {
    // The browser does not know this action. Nothing to do.
  }
}

/**
 * Registers handlers only for slots that have a sound. An unregistered action
 * does nothing on the remote, and on iOS registering the seek actions would
 * replace the previous/next buttons on the lock screen with ±10 s buttons.
 * play/pause is always registered: left to the browser, a remote's pause
 * would pause the keep-alive and lose the session.
 */
function registerHandlers() {
  if (!('mediaSession' in navigator)) return;
  for (const [action, slot] of Object.entries(SESSION_ACTION_TO_SLOT)) {
    const wanted = armed && (slot === 'playpause' || mapping[slot]);
    safeSetHandler(
      action,
      wanted
        ? () => {
            log(`Taste empfangen: ${action}`);
            // A remote 'play' after the system paused us: get the session back.
            if (keepAlive?.paused) keepAlive.play().catch(() => {});
            setPlaybackState('playing');
            trigger(slot);
          }
        : null,
    );
  }
  safeSetHandler(
    'stop',
    armed
      ? () => {
          log('Taste empfangen: stop');
          stopSound();
        }
      : null,
  );
}

/**
 * Starts the keep-alive and takes over the media session. Has to be called
 * from a real tap: both the audio element and the AudioContext need a user
 * gesture to start, on iOS strictly so.
 */
export async function arm() {
  // iOS 16.4+: 'playback' keeps audio going with the silent switch on and in
  // the background, instead of the default 'auto' which may mix and duck.
  if (navigator.audioSession) {
    try {
      navigator.audioSession.type = 'playback';
    } catch {
      /* not supported */
    }
  }
  const el = getKeepAlive();
  // Start both in the same gesture before awaiting anything.
  const playPromise = el.play();
  const ctxPromise = ensureRunning();
  try {
    await playPromise;
  } catch (err) {
    log(`Hintergrund-Audio konnte nicht starten: ${err.message}`);
    emitState();
    throw err;
  }
  await ctxPromise;
  armed = true;
  setMetadata();
  setPlaybackState('playing');
  registerHandlers();
  log('Fernbedienung aktiviert.');
  emitState();
}

export function disarm() {
  armed = false;
  clearTimeout(resumeTimer);
  stopSound();
  keepAlive?.pause();
  registerHandlers();
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = null;
    setPlaybackState('none');
  }
  log('Fernbedienung deaktiviert.');
  emitState();
}

/** Re-acquire after the system paused us, e.g. when the app comes back. */
export async function resumeIfNeeded() {
  if (!armed) return;
  if (keepAlive?.paused) {
    try {
      await keepAlive.play();
      log('Hintergrund-Audio wieder aufgenommen.');
    } catch {
      /* needs a tap, the UI shows the state */
    }
  }
  await ensureRunning();
  emitState();
}

export function setMapping(next) {
  mapping = { ...next };
  registerHandlers();
  // Decode ahead of time, so a button press plays without delay.
  for (const id of Object.values(mapping))
    if (id) loadBuffer(id).catch(() => {});
}

export function setOptions(next) {
  options = { ...options, ...next };
  if (gain) gain.gain.value = options.volume;
}

export function forgetBuffer(soundId) {
  buffers.delete(soundId);
}

/** Decodes a blob, used for validation and duration on upload. */
export async function decodeBlob(blob) {
  const c = getContext();
  const data = await blob.arrayBuffer();
  // Callback form as well, older Safari has no promise-returning variant.
  return new Promise((resolve, reject) => {
    const p = c.decodeAudioData(data, resolve, reject);
    if (p?.then) p.then(resolve, reject);
  });
}

function loadBuffer(soundId) {
  if (!buffers.has(soundId)) {
    const promise = getSound(soundId).then((sound) => {
      if (!sound) throw new Error('Sound nicht gefunden');
      return decodeBlob(sound.blob);
    });
    promise.catch(() => buffers.delete(soundId));
    buffers.set(soundId, promise);
  }
  return buffers.get(soundId);
}

export function stopSound() {
  if (!current) return;
  const { source } = current;
  current = null;
  try {
    source.stop();
  } catch {
    /* already stopped */
  }
  emit({ type: 'playing', playing: null });
  emitState();
}

/** Plays a sound by id, regardless of any mapping (preview and buttons). */
export async function playSound(soundId, slot = null) {
  const c = await ensureRunning();
  let buffer;
  try {
    buffer = await loadBuffer(soundId);
  } catch (err) {
    log(`Sound kann nicht abgespielt werden: ${err.message}`);
    return;
  }
  stopSound();
  const source = c.createBufferSource();
  source.buffer = buffer;
  source.connect(gain);
  const entry = { source, slot, soundId };
  source.onended = () => {
    if (current === entry) {
      current = null;
      emit({ type: 'playing', playing: null });
      emitState();
    }
  };
  current = entry;
  source.start();
  emit({ type: 'playing', playing: { slot, soundId } });
  emitState();
}

/**
 * A button was pressed. With a sound still playing, the default is the
 * behaviour of the original ESP32 buzzer: the press only stops it.
 */
export function trigger(slot) {
  const now = performance.now();
  // Some remotes fire play and pause (or a key and its media action) in quick
  // succession for a single press.
  if (now - (lastTrigger.get(slot) ?? -Infinity) < DEBOUNCE_MS) return;
  lastTrigger.set(slot, now);

  if (current) {
    if (options.repress === 'stop') {
      stopSound();
      log('Wiedergabe gestoppt.');
      return;
    }
  }
  const soundId = mapping[slot];
  if (!soundId) {
    log(`Keine Belegung für „${slot}“.`);
    return;
  }
  playSound(soundId, slot);
}
