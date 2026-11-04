# Entwicklung

## GitHub Codespaces

Das Repo enthält eine Devcontainer-Konfiguration (`.devcontainer/devcontainer.json`):

- Node 26 (LTS), GitHub CLI
- **Claude Code** (CLI-Feature `ghcr.io/anthropics/devcontainer-features/claude-code`
  und VS-Code-Erweiterung `anthropic.claude-code`)
- Prettier, ESLint, GitHub Actions-Erweiterung
- `npm ci` und die Claude-Code-Vorbereitung laufen automatisch beim Erstellen (`.devcontainer/post-create.sh`)
- Ports 5173 (App), 5174 (Doku), 4173 (Preview) werden weitergeleitet

Codespace starten: auf GitHub **Code → Codespaces → Create codespace on main**.

### Claude Code ohne Login starten

Damit Claude Code im Codespace bereits angemeldet ist, einmalig ein Token
als Codespaces-Secret hinterlegen:

1. Lokal (oder in einem Codespace) `claude setup-token` ausführen und im
   Browser bestätigen. Das Token (`sk-ant-oat…`) ist ein Jahr gültig und
   nutzt dein Pro/Max-Abo.
2. GitHub → **Settings → Codespaces → Secrets → New secret**:
   Name `CLAUDE_CODE_OAUTH_TOKEN`, Wert = Token, Zugriff auf dieses Repo erlauben.
3. Codespace neu erstellen (oder **Rebuild Container**).

`.devcontainer/post-create.sh` markiert zusätzlich das Onboarding als
erledigt, damit `claude` direkt in eine Sitzung startet. Ohne Secret fragt
Claude Code beim ersten Start wie gewohnt nach dem Login.

::: tip Alternative: API-Key
Statt des Abo-Tokens funktioniert auch ein Secret `ANTHROPIC_API_KEY`
(Abrechnung dann nach API-Verbrauch).
:::

## Befehle

| Befehl                            | Zweck                                          |
| --------------------------------- | ---------------------------------------------- |
| `npm run dev`                     | App mit Hot Reload auf Port 5173               |
| `npm run docs:dev`                | Doku auf Port 5174                             |
| `npm run build`                   | App **und** Doku nach `dist/`                  |
| `npm run preview`                 | Gebaute App inkl. Service Worker auf Port 4173 |
| `npm run lint` / `npm run format` | ESLint / Prettier                              |
| `npm run icons`                   | Icons in `public/icons/` neu erzeugen          |

## Auf dem Handy testen

Media Session, Bluetooth und Sperrbildschirm lassen sich nur auf einem echten
Handy testen. Codespaces liefert dafür eine HTTPS-URL (nötig für Service
Worker):

1. `npm run dev` (oder `npm run build && npm run preview` für den Service Worker).
2. Im Tab **Ports** beim Port die Sichtbarkeit auf **Public** stellen
   (Rechtsklick → Port Visibility). Private Ports verlangen einen GitHub-Login,
   das stört auf dem Handy.
3. Die weitergeleitete URL (`https://<codespace>-5173.app.github.dev/paintball-game-start-buzzer-v2/`)
   auf dem Handy öffnen.

::: warning
Nach dem Testen den Port wieder auf **Private** stellen.
:::

## Deployment

`.github/workflows/deploy.yml` baut bei jedem Push auf `main` App und Doku und
veröffentlicht `dist/` auf GitHub Pages:

- App: `https://roy0815.github.io/paintball-game-start-buzzer-v2/`
- Doku: `https://roy0815.github.io/paintball-game-start-buzzer-v2/docs/`

Einmalig im Repo einstellen: **Settings → Pages → Source: GitHub Actions**.

::: tip Repo umbenennen?
Der Repo-Name steckt in `vite.config.js` (`REPO_NAME`) und
`docs-src/.vitepress/config.js` (`REPO`). Beide anpassen, sonst stimmen
Pfade, Manifest und Service-Worker-Scope nicht.
:::
