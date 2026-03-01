# Screencast for Claude Code

Record your Chrome browser screen as MP4 using OBS Studio, controlled directly from Claude Code.

## Prerequisites

- **macOS** (uses ScreenCaptureKit for screen capture)
- **OBS Studio** - `brew install --cask obs`
- **Node.js** >= 18 - `brew install node`
- **Claude Code** CLI installed

## Installation

### 1. Clone the repo

```bash
git clone https://github.com/delusion-world/screencast.git ~/.claude/plugins/screencast
```

Or clone anywhere you prefer — the plugin auto-discovers its script location.

### 2. Install dependencies

```bash
cd ~/.claude/plugins/screencast
bash scripts/setup.sh
```

### 3. Add to Claude Code

Copy the slash command and skill into your project or global Claude Code config:

**Option A: Project-level** (per-project)

```bash
# From your project root:
mkdir -p .claude/commands .claude/skills

# Copy slash command
cp ~/.claude/plugins/screencast/commands/screencast.md.example .claude/commands/

# Copy skill
cp -r ~/.claude/plugins/screencast/skills/screencast .claude/skills/
```

**Option B: Global** (all projects)

```bash
# Copy to global Claude Code config
cp ~/.claude/plugins/screencast/commands/screencast.md.example ~/.claude/commands/
cp -r ~/.claude/plugins/screencast/skills/screencast ~/.claude/skills/
```

### 4. Configure OBS

1. Open **OBS Studio**
2. Go to **Tools > WebSocket Server Settings**
   - Check **Enable WebSocket server**
   - Set port to **4455** (default)
   - Uncheck **Enable Authentication** (or set `OBS_WS_PASSWORD` env var)
3. Grant **Screen Recording** permission to OBS in **System Settings > Privacy & Security**

### 5. First-time setup

In Claude Code, run:

```
/screencast setup
```

This creates a "Chrome Recording" scene in OBS with a screen capture source targeting Chrome.

## Usage

```
/screencast start    # Start recording Chrome
/screencast stop     # Stop recording, get MP4 path
/screencast status   # Check connection & recording state
/screencast setup    # Create OBS scene for Chrome capture
/screencast dir /path/to/output  # Set output directory
```

Or just say "record my screen" and the skill triggers automatically.

## How It Works

This plugin uses OBS Studio's WebSocket API (v5) to control recording:

1. **Setup** creates a dedicated "Chrome Recording" scene in OBS with a macOS ScreenCaptureKit source targeting Chrome
2. **Start** begins OBS recording in MP4 format
3. **Stop** ends recording and returns the file path

The controller script (`scripts/obs-controller.mjs`) communicates with OBS via `obs-websocket-js` and outputs JSON for Claude to parse.

## Recordings

By default, recordings are saved to `/tmp/obs-recordings/`. Change with:

```
/screencast dir /path/to/your/preferred/directory
```

## Configuration

### OBS WebSocket Password

If you have authentication enabled on OBS WebSocket Server, set the password:

```bash
export OBS_WS_PASSWORD="your-password-here"
```

Add to your `~/.zshrc` or `~/.bashrc` to persist.

### Custom Install Path

If you cloned the repo to a non-standard location, set:

```bash
export SCREENCAST_DIR="/path/to/screencast"
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "ECONNREFUSED" | Open OBS and enable WebSocket Server |
| Auth failure | Disable authentication in OBS WebSocket settings |
| No screen capture | Grant Screen Recording permission in System Settings |
| Source creation failed | Manually add a Screen Capture source in OBS |

## License

MIT
