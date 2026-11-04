# Fernbedienung & Tasten

## Welche Tasten funktionieren?

| Taste auf der Fernbedienung | Gesperrtes Handy | App im Vordergrund | Hinweis                                                         |
| --------------------------- | ---------------- | ------------------ | --------------------------------------------------------------- |
| Play / Pause                | ✅               | ✅                 | Ein Knopf, egal ob die Fernbedienung „Play“ oder „Pause“ sendet |
| Vorwärts (nächster Titel)   | ✅               | ✅                 |                                                                 |
| Zurück (vorheriger Titel)   | ✅               | ✅                 |                                                                 |
| Vor- / Zurückspulen         | ✅               | ✅                 | Nur wenn die Fernbedienung das sendet (oft langes Drücken)      |
| Lauter / Leiser             | ❌               | ⚠️                 | Siehe unten                                                     |

## Warum gehen die Lautstärketasten nicht?

Die Fernbedienung schickt Lautstärkebefehle über Bluetooth (AVRCP) direkt an
das Betriebssystem. Android und iOS stellen damit die Systemlautstärke ein und
reichen die Taste **nicht** an Apps weiter – an Web-Apps schon gar nicht. Daran
kann eine PWA nichts ändern.

Ausnahme: Manche Fernbedienungen melden sich zusätzlich als Tastatur. Dann
kommen Lauter/Leiser als Tastendruck an, aber **nur solange die App offen und
der Bildschirm an ist**. Die Belegung „Lauter/Leiser“ ist dafür gedacht und
schadet nicht, wenn sie nicht funktioniert.

::: tip Lautstärketasten sinnvoll nutzen
Lass die Lautstärketasten einfach die Lautstärke regeln – auf dem Feld ist das
praktisch.
:::

## Herausfinden, was deine Fernbedienung sendet

Fernbedienungen unterscheiden sich stark. Öffne in der App ganz unten
**Ereignisse**, aktiviere die Fernbedienung und drück nacheinander alle Tasten.
Jede empfangene Taste erscheint dort, z. B. `Taste empfangen: nexttrack`.

- Erscheint nichts: Die Taste kommt bei der App nicht an (siehe
  [Fehlerbehebung](./troubleshooting)).
- `play` und `pause` gehören beide zur Belegung **Play / Pause**.
- `seekforward` / `seekbackward` → Belegungen **Vorspulen** / **Zurückspulen**.

## Android vs. iOS

**Android (Chrome):** Funktioniert zuverlässig auch bei gesperrtem Bildschirm.
In der Benachrichtigungsleiste erscheint „Buzzer bereit“ als Medienwiedergabe –
das ist gewollt.

**iOS (Safari / Home-Bildschirm-App):** Die Media Session API wird unterstützt,
aber iOS beendet Hintergrund-Audio von Web-Apps unzuverlässiger. Je nach
iOS-Version kommen die Tasten im Sperrbildschirm an oder nicht. Wenn es nicht
klappt: App im Vordergrund lassen und Display-Sperre in den Einstellungen
(„Automatische Sperre“) verlängern.

## Akku

Solange die Fernbedienung aktiv ist, läuft im Hintergrund ein stummes Audio.
Das kostet etwas Akku (ähnlich wie Musik hören bei sehr geringer Last) und hält
die Bluetooth-Verbindung zum Lautsprecher offen. Vorteil: Viele Lautsprecher
schneiden sonst den Anfang eines Sounds ab, weil sie erst „aufwachen“ müssen.
Nach dem Spiel auf **Deaktivieren** tippen.
