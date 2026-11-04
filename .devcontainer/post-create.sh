#!/usr/bin/env bash
set -euo pipefail

npm ci

# Claude Code: with CLAUDE_CODE_OAUTH_TOKEN provided as a Codespaces secret the
# CLI is already authenticated, but the first start would still run the
# interactive onboarding (theme, login method). Mark it as done so `claude`
# starts straight into a session. Merges into an existing ~/.claude.json.
node -e '
const fs = require("fs");
const path = require("os").homedir() + "/.claude.json";
let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(path, "utf8")); } catch {}
cfg.hasCompletedOnboarding = true;
fs.writeFileSync(path, JSON.stringify(cfg, null, 2));
'

if [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ] && [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo "Hinweis: Kein CLAUDE_CODE_OAUTH_TOKEN-Secret gefunden. Claude Code fragt beim ersten Start nach dem Login."
fi
