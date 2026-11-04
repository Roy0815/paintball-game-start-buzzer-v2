/**
 * The buttons a sound can be assigned to.
 *
 * `background: true` means the button arrives through the Media Session API,
 * which the OS feeds from the Bluetooth remote (AVRCP) even with the screen
 * locked. The volume buttons never reach a web page that way: Android and iOS
 * handle them in the system, so they can only work while the app is in the
 * foreground, and only on remotes that also send them as keyboard keys.
 */
export const SLOTS = [
  {
    id: 'playpause',
    label: 'Play / Pause',
    hint: 'Mittlere Taste',
    background: true,
  },
  {
    id: 'nexttrack',
    label: 'Vorwärts',
    hint: 'Nächster Titel',
    background: true,
  },
  {
    id: 'previoustrack',
    label: 'Zurück',
    hint: 'Vorheriger Titel',
    background: true,
  },
  {
    id: 'seekforward',
    label: 'Vorspulen',
    hint: 'Nur manche Fernbedienungen, meist langes Drücken',
    background: true,
  },
  {
    id: 'seekbackward',
    label: 'Zurückspulen',
    hint: 'Nur manche Fernbedienungen, meist langes Drücken',
    background: true,
  },
  {
    id: 'volumeup',
    label: 'Lauter',
    hint: 'Nur bei offener App und nicht mit jeder Fernbedienung',
    background: false,
  },
  {
    id: 'volumedown',
    label: 'Leiser',
    hint: 'Nur bei offener App und nicht mit jeder Fernbedienung',
    background: false,
  },
];

export const SLOT_BY_ID = Object.fromEntries(SLOTS.map((s) => [s.id, s]));

/**
 * Media Session action → slot. A remote's single play/pause button arrives as
 * `play` or `pause` depending on what the OS believes the state is, so both
 * land on the same slot.
 */
export const SESSION_ACTION_TO_SLOT = {
  play: 'playpause',
  pause: 'playpause',
  nexttrack: 'nexttrack',
  previoustrack: 'previoustrack',
  seekforward: 'seekforward',
  seekbackward: 'seekbackward',
};

/** KeyboardEvent.key → slot, for remotes that also act as a keyboard. */
export const KEY_TO_SLOT = {
  AudioVolumeUp: 'volumeup',
  AudioVolumeDown: 'volumedown',
};
