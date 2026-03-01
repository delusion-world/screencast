#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RECORD_DIR="/tmp/obs-recordings"

echo "=== Screencast Setup ==="
echo

# 1. Check Node.js
if command -v node &>/dev/null; then
  echo "[OK] Node.js found: $(node --version)"
else
  echo "[ERROR] Node.js is not installed."
  echo "  Install with: brew install node"
  exit 1
fi

# 2. Check OBS
if [ -d "/Applications/OBS.app" ] || command -v obs &>/dev/null; then
  echo "[OK] OBS Studio found"
else
  echo "[WARN] OBS Studio not found."
  echo "  Install with: brew install --cask obs"
  echo "  Then re-run this setup."
  exit 1
fi

# 3. Install npm dependencies
echo
echo "Installing npm dependencies..."
cd "$SCRIPT_DIR"
npm install --production
echo "[OK] Dependencies installed"

# 4. Create recording directory
mkdir -p "$RECORD_DIR"
echo "[OK] Recording directory: $RECORD_DIR"

# 5. Make obs-controller executable
chmod +x "$SCRIPT_DIR/obs-controller.mjs"
echo "[OK] obs-controller.mjs is executable"

echo
echo "=== Setup Complete ==="
echo
echo "Next steps:"
echo "  1. Open OBS Studio"
echo "  2. Enable WebSocket Server: Tools > WebSocket Server Settings"
echo "     - Check 'Enable WebSocket server'"
echo "     - Uncheck 'Enable Authentication' (or note the password)"
echo "     - Port: 4455 (default)"
echo "  3. Grant Screen Recording permission in System Settings > Privacy & Security"
echo "  4. Run: /screen-record setup   (creates OBS scene for Chrome)"
echo "  5. Run: /screen-record start   (begins recording)"
