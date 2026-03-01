---
description: Record Chrome browser screen as MP4 using OBS Studio
allowed-tools: Bash
triggers:
  - record screen
  - start recording
  - stop recording
  - capture Chrome
  - record a demo
  - screen recording
  - record my screen
  - record the browser
  - record this
---

# Chrome Screen Recording Skill

This skill records Chrome browser screen as MP4 video using OBS Studio's WebSocket API.

## Finding the Controller Script

Locate the script with:
```bash
SCRIPT="$(find ~/. -maxdepth 5 -name obs-controller.mjs -path '*/screencast/*' -print -quit 2>/dev/null)"
```

Or if `SCREENCAST_DIR` env var is set:
```bash
SCRIPT="${SCREENCAST_DIR}/scripts/obs-controller.mjs"
```

## Available Commands

```bash
node "$SCRIPT" status    # Check OBS connection and recording status
node "$SCRIPT" start     # Start recording
node "$SCRIPT" stop      # Stop recording (returns MP4 path)
node "$SCRIPT" setup     # First-time setup (create scene, set MP4 format)
node "$SCRIPT" dir [path] # Get/set recording directory
```

Suppress stderr: append `2>/dev/null`

All commands output JSON with `ok: true/false`.

## Typical Workflow

1. **Check status** first to verify OBS is connected
2. **Start recording** when ready
3. Perform the browser actions to record
4. **Stop recording** to get the MP4 file path

## Error Recovery

- **OBS not connected**: Tell user to open OBS and enable WebSocket Server (Tools > WebSocket Server Settings, port 4455)
- **No scene configured**: Run `setup` command first
- **Already recording**: Use `stop` before starting a new recording
- **Screen permission denied**: User needs to grant Screen Recording permission in macOS System Settings > Privacy & Security
