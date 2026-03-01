---
allowed-tools: Bash
---

# /screencast - Chrome Screen Recording via OBS

You are controlling OBS Studio screen recording through the `obs-controller.mjs` script.

## Finding the Script

Run this to locate the controller script:

```bash
SCRIPT="$(find ~ -maxdepth 5 -name obs-controller.mjs -path '*/screencast/*' -print -quit 2>/dev/null)"
```

If `SCREENCAST_DIR` is set, use that instead:
```bash
SCRIPT="${SCREENCAST_DIR}/scripts/obs-controller.mjs"
```

## Commands

The user invoked `/screencast` with these possible arguments:

- **start** - Start recording Chrome screen
- **stop** - Stop recording and get the MP4 file path
- **status** - Check OBS connection and recording state
- **setup** - Create OBS scene for Chrome capture and set MP4 format
- **dir [path]** - Get or set the recording output directory

## How to Execute

Run the controller script with the appropriate subcommand:

```bash
node "$SCRIPT" <command> [args]
```

Suppress stderr to avoid noisy library output: append `2>/dev/null`

The script outputs JSON. Parse the JSON and present results in a human-readable format.

## Handling Results

### On success (`ok: true`):
- **status**: Report connection state, whether recording is active, current scene, timecode
- **start**: Confirm recording has started
- **stop**: Report the output MP4 file path so the user can find their recording
- **setup**: Confirm scene creation and source configuration
- **dir**: Show current or newly set recording directory

### On error (`ok: false`):
- Show the error message to the user
- Common issues:
  - "ECONNREFUSED" → OBS is not running or WebSocket server not enabled
  - "already recording" → Recording is in progress, need to stop first
  - "not recording" → No active recording to stop
  - Auth failure → Check OBS WebSocket password settings

## First-Time Setup Flow

If the user hasn't set up yet, guide them:
1. Run `bash <plugin-dir>/scripts/setup.sh` to install npm dependencies
2. Open OBS and enable WebSocket Server (Tools > WebSocket Server Settings)
3. Run the `setup` subcommand to create the Chrome Recording scene
