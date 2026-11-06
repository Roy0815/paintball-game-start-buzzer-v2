// Inter is bundled instead of loaded from Google Fonts so the app keeps its
// typeface offline. Only the latin subset: it covers German including umlauts.
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import './style.css';
import '@phosphor-icons/web/regular';
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
const LICENSES_URL = `${import.meta.env.BASE_URL}third-party-licenses.txt`;
const MAX_LOG = 30;
// The first three slots arrive through the Media Session on every remote; the
// rest are folded away behind "weitere Tasten".
const PRIMARY_COUNT = 3;
const SLOT_ICONS = {
  playpause: 'ph-play-pause',
  nexttrack: 'ph-skip-forward',
  previoustrack: 'ph-skip-back',
  seekforward: 'ph-fast-forward',
  seekbackward: 'ph-rewind',
  volumeup: 'ph-speaker-high',
  volumedown: 'ph-speaker-low',
};
const TABS = [
  { id: 'buzzer', label: 'Buzzer', icon: 'ph-power' },
  { id: 'sounds', label: 'Sounds', icon: 'ph-music-notes' },
  { id: 'settings', label: 'Einstellungen', icon: 'ph-gear-six' },
];

const state = {
  sounds: [],
  mapping: {},
  options: { repress: 'stop', volume: 1 },
  engine: engine.getState(),
  log: [],
  usage: null,
  persisted: null,
  updateReady: null,
  // UI only
  tab: 'buzzer',
  moreSlots: false,
  logOpen: false,
  soundMenu: null,
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

const icon = (name) => `<i class="ph ${name}" aria-hidden="true"></i>`;

// ---------- status ----------

function statusInfo() {
  const { armed, keepAlivePlaying } = state.engine;
  if (!armed)
    return {
      cls: 'off',
      tag: 'Inaktiv',
      head: 'Bereit zum Aktivieren',
      sub: 'Tasten der Fernbedienung werden noch nicht empfangen.',
      action: 'arm',
      label: 'Aktivieren',
    };
  if (!keepAlivePlaying)
    return {
      cls: 'warn',
      tag: 'Unterbrochen',
      head: 'Unterbrochen',
      sub: 'Das System hat die Wiedergabe angehalten – z. B. durch einen Anruf oder eine andere App.',
      action: 'arm',
      label: 'Wieder verbinden',
    };
  return {
    cls: 'on',
    tag: 'Aktiv',
    head: 'Aktiv',
    sub: 'Handy kann jetzt gesperrt werden.',
    action: 'disarm',
    label: 'Deaktivieren',
  };
}

function renderTag(info) {
  return `<span class="tag status-tag ${info.cls}"><span class="dot"></span>${esc(info.tag)}</span>`;
}

// ---------- buzzer tab ----------

function renderNowPlaying() {
  const { playing } = state.engine;
  if (!playing) return '';
  return `
    <div class="now-playing">
      ${icon('ph-speaker-high')}
      <span>${esc(soundName(playing.soundId))}</span>
      <button class="btn btn-secondary" data-action="stop">Stopp</button>
    </div>`;
}

function renderBuzzer() {
  const info = statusInfo();
  const unsupported = !('mediaSession' in navigator)
    ? `<div class="notice warn">${icon('ph-warning')}<p>Dieser Browser unterstützt die Media Session API nicht. Die Fernbedienung funktioniert hier nicht.</p></div>`
    : '';
  const tiles = SLOTS.slice(0, PRIMARY_COUNT)
    .map((slot) => {
      const id = state.mapping[slot.id];
      return `
        <button class="tile" data-action="test" data-slot="${slot.id}" ${id ? '' : 'disabled'} aria-label="${esc(slot.label)} testen">
          ${icon(SLOT_ICONS[slot.id])}
          <span class="${id ? '' : 'muted'}">${id ? esc(soundName(id)) : 'Nicht belegt'}</span>
        </button>`;
    })
    .join('');
  return `
    <div class="buzzer ${info.cls}">
      ${renderTag(info)}
      <div class="buzzer-text">
        <h1>${esc(info.head)}</h1>
        <p class="muted">${esc(info.sub)}</p>
      </div>
      ${unsupported}
      <div class="buzzer-stage">
        <button class="buzzer-button" data-action="${info.action}">
          ${icon('ph-power')}
          <span>${esc(info.label)}</span>
        </button>
      </div>
      ${info.cls === 'warn' ? '<button class="btn btn-ghost" data-action="disarm">Deaktivieren</button>' : ''}
      ${renderNowPlaying()}
      <div class="tiles">${tiles}</div>
    </div>`;
}

// ---------- sounds tab ----------

function renderSlotRow(slot) {
  const selected = state.mapping[slot.id] ?? '';
  const options = ['<option value="">– keine –</option>']
    .concat(
      state.sounds.map(
        (s) =>
          `<option value="${esc(s.id)}" ${s.id === selected ? 'selected' : ''}>${esc(s.name)}</option>`,
      ),
    )
    .join('');
  const sub = slot.background
    ? `<small class="muted">${esc(slot.hint)}</small>`
    : '<small class="warn-text">Nur bei offener App</small>';
  return `
    <div class="row slot">
      <div class="slot-label"><strong>${esc(slot.label)}</strong>${sub}</div>
      <select class="input" data-slot="${slot.id}" aria-label="Sound für ${esc(slot.label)}">${options}</select>
    </div>`;
}

function renderSounds() {
  const primary = SLOTS.slice(0, PRIMARY_COUNT).map(renderSlotRow).join('');
  const extra = SLOTS.slice(PRIMARY_COUNT);
  const extraMapped = extra.filter((s) => state.mapping[s.id]).length;
  const moreLabel = state.moreSlots
    ? 'Weniger anzeigen'
    : `${extra.length} weitere Tasten${extraMapped ? ` · ${extraMapped} belegt` : ''}`;
  const extraHtml = state.moreSlots
    ? `${extra.map(renderSlotRow).join('')}
       <p class="muted small pad">Lautstärketasten regeln bei gesperrtem Handy immer die Systemlautstärke. Eine Web-App kann sie dann nicht abfangen.</p>`
    : '';

  const list = state.sounds
    .map((s) => {
      const menuOpen = state.soundMenu === s.id;
      const actions = menuOpen
        ? `<button class="btn btn-icon" data-action="rename" data-id="${esc(s.id)}" aria-label="Umbenennen">${icon('ph-pencil-simple')}</button>
           <button class="btn btn-icon danger" data-action="delete" data-id="${esc(s.id)}" aria-label="Löschen">${icon('ph-trash')}</button>`
        : `<button class="btn btn-icon" data-action="sound-menu" data-id="${esc(s.id)}" aria-label="Mehr">${icon('ph-dots-three')}</button>`;
      return `
        <li class="row">
          <button class="btn btn-icon round" data-action="preview" data-id="${esc(s.id)}" aria-label="Anhören">${icon('ph-play')}</button>
          <div class="sound-meta">
            <strong>${esc(s.name)}</strong>
            <small class="muted">${formatDuration(s.duration)} · ${formatBytes(s.size)}</small>
          </div>
          ${actions}
        </li>`;
    })
    .join('');

  const usage = state.usage ? `${formatBytes(state.usage.usage)} · ` : '';
  return `
    <div class="section-head"><h6>Tastenbelegung</h6></div>
    <div class="card list">
      ${state.sounds.length === 0 ? '<p class="muted small pad">Lade zuerst unten einen oder mehrere Sounds hoch.</p>' : ''}
      ${primary}
      <button class="row more" data-action="toggle-more">
        <span>${esc(moreLabel)}</span>${icon(state.moreSlots ? 'ph-caret-up' : 'ph-caret-down')}
      </button>
      ${extraHtml}
    </div>

    <div class="section-head"><h6>Bibliothek</h6><small class="muted">${esc(usage)}nur auf diesem Gerät</small></div>
    <div class="card list">
      ${list ? `<ul class="sounds">${list}</ul>` : '<p class="muted small pad">Noch keine Sounds gespeichert.</p>'}
      <label class="row add">
        ${icon('ph-plus')} Audio hinzufügen
        <input type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg,.aac" multiple data-action="upload" hidden />
      </label>
    </div>`;
}

// ---------- settings tab ----------

function renderHints() {
  const hints = [];
  if (!isStandalone()) {
    hints.push({
      title: 'App installieren',
      text: isIOS()
        ? 'Über „Teilen → Zum Home-Bildschirm“. Dann bleiben die Sounds dauerhaft gespeichert.'
        : 'Über das Browser-Menü „App installieren“. Dann bleiben die Sounds dauerhaft gespeichert.',
    });
  } else if (state.persisted === false) {
    hints.push({
      title: 'Speicher nicht dauerhaft',
      text: 'Der Browser hat dauerhaften Speicher nicht zugesagt. Sounds könnten gelöscht werden.',
    });
  }
  if (isIOS()) {
    hints.push({
      title: 'iOS',
      text: 'Funktioniert nur eingeschränkt. Wenn die Tasten bei gesperrtem Handy nicht ankommen, App offen und Bildschirm an lassen.',
    });
  }
  return hints
    .map(
      (h) =>
        `<div class="notice warn">${icon('ph-info')}<p><strong>${esc(h.title)}</strong><br><span class="muted">${esc(h.text)}</span></p></div>`,
    )
    .join('');
}

function renderSettings() {
  const { repress, volume } = state.options;
  const seg = [
    ['stop', 'Stoppt den Sound'],
    ['restart', 'Startet neuen Sound'],
  ]
    .map(
      ([value, label]) => `
      <label class="seg-opt">
        <input type="radio" name="repress" value="${value}" data-option="repress" ${repress === value ? 'checked' : ''} />
        ${label}
      </label>`,
    )
    .join('');
  const items = state.log
    .map(
      (e) =>
        `<li><time>${e.at.toLocaleTimeString('de-DE')}</time> ${esc(e.message)}</li>`,
    )
    .join('');
  return `
    <div class="card settings">
      <div class="field">
        <label>Tastendruck während ein Sound läuft</label>
        <div class="seg">${seg}</div>
      </div>
      <div class="field">
        <label class="split"><span>App-Lautstärke</span><span id="volume-label">${Math.round(volume * 100)} %</span></label>
        <input type="range" min="0" max="1" step="0.05" value="${volume}" data-option="volume" aria-label="App-Lautstärke" />
      </div>
    </div>
    ${renderHints()}
    <div class="card list">
      <button class="row link" data-action="toggle-log">
        ${icon('ph-list-bullets')}<span>Ereignisse</span>${icon(state.logOpen ? 'ph-caret-up' : 'ph-caret-down')}
      </button>
      ${
        state.logOpen
          ? items
            ? `<ul class="log">${items}</ul>`
            : '<p class="muted small pad">Noch keine Ereignisse.</p>'
          : ''
      }
      <a class="row link" href="${DOCS_URL}">
        ${icon('ph-question')}<span>Hilfe &amp; Anleitung</span>${icon('ph-arrow-up-right')}
      </a>
      <a class="row link" href="${LICENSES_URL}" target="_blank" rel="noopener">
        ${icon('ph-file-text')}<span>Lizenzen</span>${icon('ph-arrow-up-right')}
      </a>
    </div>`;
}

// ---------- shell ----------

function renderUpdate() {
  if (!state.updateReady) return '';
  return `
    <div class="update-banner">
      <span>Neue Version verfügbar.</span>
      <button class="btn btn-primary" data-action="update">Neu laden</button>
    </div>`;
}

function render() {
  const tab = TABS.find((t) => t.id === state.tab);
  const header =
    state.tab === 'buzzer'
      ? ''
      : `<header class="app-header"><h2>${esc(tab.label)}</h2>${renderTag(statusInfo())}</header>`;
  const body =
    state.tab === 'buzzer'
      ? renderBuzzer()
      : state.tab === 'sounds'
        ? renderSounds()
        : renderSettings();
  const tabs = TABS.map(
    (t) => `
      <button class="tab ${t.id === state.tab ? 'active' : ''}" data-action="tab" data-tab="${t.id}" ${t.id === state.tab ? 'aria-current="page"' : ''}>
        ${icon(t.icon)}<span>${t.label}</span>
      </button>`,
  ).join('');
  app.innerHTML = `
    ${renderUpdate()}
    ${header}
    <main class="tab-${state.tab}">${body}</main>
    <nav class="tabbar">${tabs}</nav>`;
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
    case 'tab':
      state.tab = target.dataset.tab;
      state.soundMenu = null;
      render();
      window.scrollTo(0, 0);
      break;
    case 'toggle-more':
      state.moreSlots = !state.moreSlots;
      render();
      break;
    case 'toggle-log':
      state.logOpen = !state.logOpen;
      render();
      break;
    case 'sound-menu':
      state.soundMenu = id;
      render();
      break;
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
      state.soundMenu = null;
      await refreshSounds();
      render();
      break;
    }
    case 'delete': {
      const sound = state.sounds.find((s) => s.id === id);
      if (!confirm(`„${sound?.name}“ löschen?`)) return;
      await deleteSound(id);
      engine.forgetBuffer(id);
      state.soundMenu = null;
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
    const label = app.querySelector('#volume-label');
    if (label) label.textContent = `${Math.round(el.value * 100)} %`;
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
  // Don't rebuild the DOM under an open <select> on the Sounds tab.
  if (event.type === 'log' && state.tab === 'sounds') return;
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
  // Nothing set up yet: start where the setup happens.
  if (state.sounds.length === 0) state.tab = 'sounds';
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
