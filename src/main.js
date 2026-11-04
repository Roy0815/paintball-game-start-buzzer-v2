import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { SLOTS, SLOT_BY_ID, KEY_TO_SLOT } from './slots.js';
import {
  listSounds,
  getSound,
  putSound,
  deleteSound,
  getSetting,
  setSetting,
  requestPersistence,
  estimateUsage,
} from './storage.js';
import * as engine from './engine.js';

const DOCS_URL = `${import.meta.env.BASE_URL}docs/`;
const MAX_LOG = 30;

const state = {
  sounds: [],
  mapping: {},
  options: { repress: 'stop', volume: 1 },
  engine: engine.getState(),
  log: [],
  usage: null,
  persisted: null,
  updateReady: null,
};

const app = document.querySelector('#app');

// ---------- helpers ----------

function esc(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );
}

function formatBytes(bytes) {
  if (bytes == null) return '–';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '';
  const s = Math.round(seconds);
  return s >= 60
    ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
    : `${s} s`;
}

function soundName(id) {
  return state.sounds.find((s) => s.id === id)?.name ?? '–';
}

function newId() {
  return (
    crypto.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

function isIOS() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    navigator.standalone === true
  );
}

// ---------- rendering ----------

function renderStatus() {
  const { armed, keepAlivePlaying, playing } = state.engine;
  let statusClass = 'off';
  let statusText = 'Inaktiv – Tasten der Fernbedienung werden nicht empfangen.';
  if (armed && keepAlivePlaying) {
    statusClass = 'on';
    statusText = 'Aktiv – Handy kann jetzt gesperrt werden.';
  } else if (armed) {
    statusClass = 'warn';
    statusText =
      'Unterbrochen – das System hat die Wiedergabe angehalten. Tippe auf „Wieder verbinden“.';
  }
  const playingHtml = playing
    ? `<div class="now-playing">
         <span>▶ ${esc(soundName(playing.soundId))}</span>
         <button class="btn small" data-action="stop">Stopp</button>
       </div>`
    : '';
  return `
    <section class="card status ${statusClass}">
      <div class="status-line"><span class="dot"></span>${esc(statusText)}</div>
      <div class="row">
        ${
          !armed
            ? '<button class="btn primary big" data-action="arm">Fernbedienung aktivieren</button>'
            : `${!keepAlivePlaying ? '<button class="btn primary big" data-action="arm">Wieder verbinden</button>' : ''}
               <button class="btn big" data-action="disarm">Deaktivieren</button>`
        }
      </div>
      ${playingHtml}
    </section>`;
}

function renderMapping() {
  const options = (selected) =>
    ['<option value="">– keine –</option>']
      .concat(
        state.sounds.map(
          (s) =>
            `<option value="${esc(s.id)}" ${s.id === selected ? 'selected' : ''}>${esc(s.name)}</option>`,
        ),
      )
      .join('');
  const rows = SLOTS.map((slot) => {
    const selected = state.mapping[slot.id] ?? '';
    return `
      <div class="slot ${slot.background ? '' : 'foreground-only'}">
        <div class="slot-label">
          <strong>${esc(slot.label)}</strong>
          ${slot.background ? '<span class="badge">auch gesperrt</span>' : '<span class="badge muted">nur App offen</span>'}
          <small>${esc(slot.hint)}</small>
        </div>
        <div class="slot-controls">
          <select data-slot="${slot.id}" aria-label="Sound für ${esc(slot.label)}">${options(selected)}</select>
          <button class="btn icon" data-action="test" data-slot="${slot.id}" ${selected ? '' : 'disabled'} aria-label="${esc(slot.label)} testen">▶</button>
        </div>
      </div>`;
  }).join('');
  return `
    <section class="card">
      <h2>Tastenbelegung</h2>
      ${state.sounds.length === 0 ? '<p class="muted">Lade zuerst unten einen oder mehrere Sounds hoch.</p>' : ''}
      ${rows}
      <p class="muted small">
        Die Lautstärketasten der Fernbedienung regeln auf Android und iOS immer
        die Systemlautstärke. Eine Web-App kann sie bei gesperrtem Handy nicht
        abfangen.
      </p>
    </section>`;
}

function renderSounds() {
  const list = state.sounds
    .map(
      (s) => `
      <li>
        <div class="sound-meta">
          <strong>${esc(s.name)}</strong>
          <small>${formatDuration(s.duration)} · ${formatBytes(s.size)}</small>
        </div>
        <div class="sound-actions">
          <button class="btn icon" data-action="preview" data-id="${esc(s.id)}" aria-label="Anhören">▶</button>
          <button class="btn icon" data-action="rename" data-id="${esc(s.id)}" aria-label="Umbenennen">✎</button>
          <button class="btn icon danger" data-action="delete" data-id="${esc(s.id)}" aria-label="Löschen">🗑</button>
        </div>
      </li>`,
    )
    .join('');
  const usage = state.usage
    ? `Speicher: ${formatBytes(state.usage.usage)} von ca. ${formatBytes(state.usage.quota)} belegt.`
    : '';
  const persisted =
    state.persisted === false
      ? ' Der Browser hat dauerhaften Speicher nicht zugesagt – die App installieren hilft.'
      : '';
  return `
    <section class="card">
      <h2>Sounds</h2>
      <label class="btn primary upload">
        MP3 / Audio hinzufügen
        <input type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg,.aac" multiple data-action="upload" hidden />
      </label>
      ${list ? `<ul class="sounds">${list}</ul>` : '<p class="muted">Noch keine Sounds gespeichert.</p>'}
      <p class="muted small">Die Dateien bleiben nur auf diesem Gerät (IndexedDB) und werden nirgendwo hochgeladen. ${esc(usage)}${esc(persisted)}</p>
    </section>`;
}

function renderSettings() {
  const { repress, volume } = state.options;
  return `
    <section class="card">
      <h2>Einstellungen</h2>
      <label class="field">
        <span>Tastendruck während ein Sound läuft</span>
        <select data-option="repress">
          <option value="stop" ${repress === 'stop' ? 'selected' : ''}>stoppt den Sound</option>
          <option value="restart" ${repress === 'restart' ? 'selected' : ''}>startet den neuen Sound</option>
        </select>
      </label>
      <label class="field">
        <span>App-Lautstärke: ${Math.round(volume * 100)} %</span>
        <input type="range" min="0" max="1" step="0.05" value="${volume}" data-option="volume" />
      </label>
    </section>`;
}

function renderHints() {
  const hints = [];
  if (!('mediaSession' in navigator)) {
    hints.push(
      'Dieser Browser unterstützt die Media Session API nicht. Die Fernbedienung funktioniert hier nicht.',
    );
  }
  if (!isStandalone()) {
    hints.push(
      isIOS()
        ? 'Tipp: Über „Teilen → Zum Home-Bildschirm“ installieren. Dann bleiben die Sounds dauerhaft gespeichert.'
        : 'Tipp: Über das Browser-Menü „App installieren“ wählen.',
    );
  }
  if (isIOS()) {
    hints.push(
      'iOS: Funktioniert nur eingeschränkt. Wenn die Tasten bei gesperrtem Handy nicht ankommen, App offen und Bildschirm an lassen.',
    );
  }
  if (!hints.length) return '';
  return `<section class="card hints">${hints.map((h) => `<p>${esc(h)}</p>`).join('')}</section>`;
}

function renderLog() {
  const items = state.log
    .map(
      (e) =>
        `<li><time>${e.at.toLocaleTimeString('de-DE')}</time> ${esc(e.message)}</li>`,
    )
    .join('');
  return `
    <section class="card">
      <details>
        <summary>Ereignisse (zum Testen der Fernbedienung)</summary>
        ${items ? `<ul class="log">${items}</ul>` : '<p class="muted">Noch keine Ereignisse.</p>'}
      </details>
    </section>`;
}

function renderUpdate() {
  if (!state.updateReady) return '';
  return `
    <div class="update-banner">
      Neue Version verfügbar.
      <button class="btn small primary" data-action="update">Neu laden</button>
    </div>`;
}

function render() {
  // Keep the log's open state across re-renders.
  const logOpen = app.querySelector('details')?.open ?? false;
  app.innerHTML = `
    ${renderUpdate()}
    <header class="app-header">
      <img src="${import.meta.env.BASE_URL}icons/favicon.svg" alt="" width="36" height="36" />
      <h1>Paintball Buzzer</h1>
      <a href="${DOCS_URL}" class="docs-link">Hilfe</a>
    </header>
    <main>
      ${renderStatus()}
      ${renderHints()}
      ${renderMapping()}
      ${renderSounds()}
      ${renderSettings()}
      ${renderLog()}
    </main>`;
  const details = app.querySelector('details');
  if (details) details.open = logOpen;
}

// ---------- actions ----------

function addLog(message, at = new Date()) {
  state.log.unshift({ message, at });
  state.log.length = Math.min(state.log.length, MAX_LOG);
}

async function refreshSounds() {
  state.sounds = (await listSounds()).map(({ blob: _blob, ...meta }) => meta);
  // Drop mappings that point to deleted sounds.
  let changed = false;
  for (const [slot, id] of Object.entries(state.mapping)) {
    if (id && !state.sounds.some((s) => s.id === id)) {
      delete state.mapping[slot];
      changed = true;
    }
  }
  if (changed) await saveMapping();
  state.usage = await estimateUsage();
}

async function saveMapping() {
  await setSetting('mapping', state.mapping);
  engine.setMapping(state.mapping);
}

async function handleUpload(files) {
  for (const file of files) {
    try {
      const buffer = await engine.decodeBlob(file);
      await putSound({
        id: newId(),
        name: file.name.replace(/\.[^.]+$/, ''),
        type: file.type,
        size: file.size,
        duration: buffer.duration,
        blob: file,
        addedAt: Date.now(),
      });
      addLog(`Sound gespeichert: ${file.name}`);
    } catch (err) {
      addLog(
        `„${file.name}“ ist keine abspielbare Audiodatei (${err?.message ?? err}).`,
      );
      alert(`„${file.name}“ konnte nicht gelesen werden.`);
    }
  }
  state.persisted = await requestPersistence();
  await refreshSounds();
  render();
}

app.addEventListener('click', async (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const { action, id, slot } = target.dataset;

  switch (action) {
    case 'arm':
      try {
        await engine.arm();
      } catch {
        alert('Audio konnte nicht gestartet werden. Bitte erneut tippen.');
      }
      break;
    case 'disarm':
      engine.disarm();
      break;
    case 'stop':
      engine.stopSound();
      break;
    case 'test':
      engine.trigger(slot);
      break;
    case 'preview':
      engine.playSound(id);
      break;
    case 'rename': {
      const sound = state.sounds.find((s) => s.id === id);
      const name = prompt('Neuer Name', sound?.name ?? '');
      if (!name?.trim()) return;
      const full = await getSound(id);
      await putSound({ ...full, name: name.trim() });
      await refreshSounds();
      render();
      break;
    }
    case 'delete': {
      const sound = state.sounds.find((s) => s.id === id);
      if (!confirm(`„${sound?.name}“ löschen?`)) return;
      await deleteSound(id);
      engine.forgetBuffer(id);
      await refreshSounds();
      render();
      break;
    }
    case 'update':
      state.updateReady?.(true);
      break;
  }
});

app.addEventListener('change', async (event) => {
  const el = event.target;
  if (el.dataset.action === 'upload') {
    await handleUpload([...el.files]);
    return;
  }
  if (el.dataset.slot) {
    if (el.value) state.mapping[el.dataset.slot] = el.value;
    else delete state.mapping[el.dataset.slot];
    await saveMapping();
    render();
    return;
  }
  if (el.dataset.option) {
    const key = el.dataset.option;
    state.options[key] = key === 'volume' ? Number(el.value) : el.value;
    engine.setOptions(state.options);
    await setSetting('options', state.options);
    render();
  }
});

// Live label update while dragging the volume slider, without re-rendering.
app.addEventListener('input', (event) => {
  const el = event.target;
  if (el.dataset.option === 'volume') {
    engine.setOptions({ volume: Number(el.value) });
    el.previousElementSibling.textContent = `App-Lautstärke: ${Math.round(el.value * 100)} %`;
  }
});

// Remotes that additionally act as a keyboard (some send the volume keys this
// way). Only reaches us while the app is visible.
window.addEventListener('keydown', (event) => {
  const slot = KEY_TO_SLOT[event.key];
  if (!slot) return;
  addLog(`Taste empfangen: ${event.key}`);
  if (state.mapping[slot]) {
    event.preventDefault();
    engine.trigger(slot);
  }
  render();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') engine.resumeIfNeeded();
});

engine.onEngineEvent((event) => {
  if (event.type === 'log') addLog(event.message, event.at);
  if (event.type === 'state') state.engine = event.state;
  render();
});

// ---------- boot ----------

async function boot() {
  render();
  state.mapping = await getSetting('mapping', {});
  state.options = { ...state.options, ...(await getSetting('options', {})) };
  engine.setOptions(state.options);
  await refreshSounds();
  engine.setMapping(state.mapping);
  if (navigator.storage?.persisted)
    state.persisted = await navigator.storage.persisted();
  render();

  const updateSW = registerSW({
    onNeedRefresh() {
      state.updateReady = updateSW;
      render();
    },
  });
}

boot();

// Exposed for debugging from the console.
window.__buzzer = { engine, state, SLOT_BY_ID };
