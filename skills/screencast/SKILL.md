---
description: Record any application screen as MP4 using OBS Studio
allowed-tools: Bash
triggers:
  - record screen
  - start recording
  - stop recording
  - capture screen
  - record a demo
  - screen recording
  - record my screen
  - record the browser
  - record this
  - screencast
---

# Screencast Skill

Record any application's screen as MP4 video using OBS Studio's WebSocket API.

## Finding the Controller Script

```bash
SCRIPT="$(find ~ -maxdepth 5 -name obs-controller.mjs -path '*/screencast/*' -print -quit 2>/dev/null)"
```

Or if `SCREENCAST_DIR` env var is set:
```bash
SCRIPT="${SCREENCAST_DIR}/scripts/obs-controller.mjs"
```

## Available Commands

```bash
node "$SCRIPT" status              # Check connection, recording state, current app
node "$SCRIPT" start               # Start recording
node "$SCRIPT" stop                # Stop recording (returns MP4 path)
node "$SCRIPT" setup [bundle-id]   # Setup scene for app (default: Chrome)
node "$SCRIPT" app [bundle-id]     # Get or switch target application
node "$SCRIPT" mode [display|window|application]  # Switch capture mode
node "$SCRIPT" dir [path]          # Get/set recording directory
```

Suppress stderr: append `2>/dev/null`

## Switching Target Application

When the user wants to record a specific app, use the `app` command with the macOS bundle ID:

```bash
node "$SCRIPT" app com.google.Chrome        # Chrome
node "$SCRIPT" app com.apple.Safari         # Safari
node "$SCRIPT" app org.mozilla.firefox      # Firefox
node "$SCRIPT" app com.microsoft.VSCode     # VS Code
node "$SCRIPT" app com.figma.Desktop        # Figma
node "$SCRIPT" app com.apple.Terminal       # Terminal
node "$SCRIPT" app com.googlecode.iterm2    # iTerm2
node "$SCRIPT" app com.tinyspeck.slackmacgap # Slack
node "$SCRIPT" app com.hnc.Discord          # Discord
node "$SCRIPT" app us.zoom.xos              # Zoom
node "$SCRIPT" app com.apple.finder         # Finder
```

If unsure of a bundle ID, find it with:
```bash
osascript -e 'id of app "AppName"'
```

## Capture Modes

```bash
node "$SCRIPT" mode display       # Record entire screen
node "$SCRIPT" mode application   # Record specific app (default)
node "$SCRIPT" mode window        # Record specific window (requires OBS window selection)
```

- **display**: Records the full screen. Use when user says "record my screen" or "record the desktop".
- **application**: Records all windows of a specific app. Best for most use cases. Default mode.
- **window**: Records a single window. Requires manual window selection in OBS UI.

## Typical Workflow

1. User says what they want to record (e.g., "record Chrome", "record my terminal")
2. Determine the bundle ID for the requested app
3. Run `app <bundle-id>` to switch target (or `setup <bundle-id>` if first time)
4. Run `start` to begin recording
5. User performs their actions
6. Run `stop` to get the MP4 file path

## Error Recovery

- **OBS not connected**: Tell user to open OBS and enable WebSocket Server (Tools > WebSocket Server Settings, port 4455)
- **No scene configured**: Run `setup` command first
- **Already recording**: Use `stop` before starting a new recording
- **Screen permission denied**: Grant Screen Recording permission in macOS System Settings > Privacy & Security
- **Unknown app**: Use `osascript -e 'id of app "Name"'` to find the bundle ID
