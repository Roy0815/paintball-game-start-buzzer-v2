# Paintball Buzzer (PWA)

Installierbare Web-App: Eine Bluetooth-Medienfernbedienung löst auf Tastendruck
eigene Sounds aus, die über einen Bluetooth-Lautsprecher abgespielt werden –
auch bei gesperrtem Handy. Nachfolger des ESP32-basierten
[paintball-game-start-buzzer](https://github.com/Roy0815/paintball-game-start-buzzer).

- **App:** https://roy0815.github.io/paintball-game-start-buzzer-v2/
- **Doku:** https://roy0815.github.io/paintball-game-start-buzzer-v2/docs/

## Schnellstart (Entwicklung)

```bash
npm ci
npm run dev        # App auf :5173
npm run docs:dev   # Doku auf :5174
npm run build      # App + Doku nach dist/
```

Am einfachsten in GitHub Codespaces (Devcontainer mit Claude Code ist
vorkonfiguriert). Details: [docs-src/technical/development.md](docs-src/technical/development.md).
