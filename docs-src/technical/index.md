# Architektur

Reine Client-Anwendung ohne Backend: Vite + Vanilla JS, als PWA über
`vite-plugin-pwa`, gehostet auf GitHub Pages. Die Doku (VitePress) wird in
dasselbe Pages-Artefakt unter `/docs/` gebaut.

```text
src/
  main.js      UI, Rendering, Event-Handling, Service-Worker-Registrierung
  engine.js    Audio + Media Session (Kern)
  slots.js     Tasten-Definitionen und Zuordnung Media-Session-Aktion → Taste
  storage.js   IndexedDB (Sounds als Blob, Einstellungen)
  style.css
public/icons/  generiert von scripts/generate-icons.mjs (Vorlage: assets/buzzer-icon.png)
docs-src/      VitePress
```

## Wie kommen Tasten bei gesperrtem Handy an?

```text
Fernbedienung ──AVRCP──▶ Android/iOS ──▶ aktive Media Session ──▶ setActionHandler(...)
```

Das Betriebssystem leitet Medientasten an die App mit der aktiven
**Media Session** weiter. Eine Webseite besitzt eine solche Session nur,
solange eines ihrer `<audio>`-Elemente abspielt. Deshalb startet
**Aktivieren**:

1. ein **Keep-Alive**: ein `<audio>`-Element, das in Schleife ein 15 s langes,
   zur Laufzeit erzeugtes WAV abspielt (16 bit, 30-Hz-Sinus bei ca. −66 dBFS).
   Nicht `muted` und nicht Lautstärke 0 – stumme Medien bekommen keine Session.
   Auch reine digitale Stille reicht nicht: Chrome auf Android stuft sie als
   unhörbar ein und pausiert das Element im Hintergrund nach ca. 1,5 min.
   Der Ton liegt knapp über Chromes Hörbarkeits-Schwelle (ca. −72 dBFS),
   ist aber praktisch nicht zu hören. 15 s × 30 Hz ergibt ganze Perioden,
   die Schleife hat also keinen Knacks.
2. einen `AudioContext` für die eigentlichen Sounds.
3. Action-Handler für `play`, `pause`, `nexttrack`, `previoustrack`,
   `seekforward`, `seekbackward`, `stop`.

`play` und `pause` landen beide auf der Belegung _Play/Pause_. Der
`pause`-Handler pausiert das Keep-Alive bewusst **nicht**, `playbackState`
bleibt `playing` – sonst würde das System die Session nach einer Weile beenden.

Handler werden nur für belegte Tasten registriert (außer Play/Pause, das immer
abgefangen wird, damit die Fernbedienung das Keep-Alive nicht pausiert). Auf
iOS würden registrierte Seek-Handler sonst die Vor/Zurück-Buttons im
Sperrbildschirm durch ±10 s ersetzen.

### Automatisches Fortsetzen

Pausiert das System das Keep-Alive trotzdem (`pause`-Event bei aktivierter
Fernbedienung), versucht `engine.js` nach 1 s, 3 s und 10 s erneut `play()`.
Jeder Versuch landet im Ereignis-Log. Sobald das Element wieder `playing`
meldet, wird der Zähler zurückgesetzt. Danach greift nur noch
`resumeIfNeeded()` beim Zurückkehren in die App.

## Warum Web Audio für die Sounds?

Würde man die Sounds über das Keep-Alive-Element abspielen (`src` tauschen),
gäbe es zwischen zwei Sounds Momente ohne Wiedergabe, in denen das System die
Session abgeben kann, und jedes Tauschen braucht einen neuen `play()`-Aufruf –
im Hintergrund nicht immer erlaubt. Stattdessen:

- Sounds werden beim Belegen vorab zu `AudioBuffer` dekodiert (Cache in `engine.js`).
- Ein Tastendruck startet nur eine `AudioBufferSourceNode` → praktisch keine Latenz.
- Das Keep-Alive läuft ununterbrochen weiter.

Nebeneffekt: Die Bluetooth-Strecke zum Lautsprecher ist ständig aktiv, der
Anfang eines Sounds wird nicht abgeschnitten.

## Lautstärketasten

AVRCP-Lautstärke verarbeitet das Betriebssystem selbst, es gibt keine
Media-Session-Aktion dafür. `main.js` hört zusätzlich auf
`keydown` mit `AudioVolumeUp` / `AudioVolumeDown` für Fernbedienungen, die
sich als HID-Tastatur melden – nur im Vordergrund.

## Speicherung

IndexedDB (`paintball-buzzer`, über [`idb`](https://github.com/jakearchibald/idb)):

| Store      | Schlüssel | Inhalt                                                        |
| ---------- | --------- | ------------------------------------------------------------- |
| `sounds`   | `id`      | `{ id, name, type, size, duration, blob, addedAt }`           |
| `settings` | `key`     | `mapping` (Taste → Sound-ID), `options` (`repress`, `volume`) |

`localStorage` wäre für MP3s zu klein (≈5 MB, nur Strings). Nach dem ersten
Upload wird `navigator.storage.persist()` angefragt.

## Service Worker & Updates

`registerType: 'prompt'`: Ein neuer Service Worker wartet, bis der Nutzer auf
**Neu laden** tippt. Ein automatischer Reload würde mitten im Spiel die Media
Session beenden. Die Doku unter `/docs/` ist per `globIgnores` und
`navigateFallbackDenylist` vom Precache ausgenommen.