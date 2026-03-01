#!/usr/bin/env node

import OBSWebSocket from "obs-websocket-js";

const OBS_WS_URL = "ws://127.0.0.1:4455";
const OBS_PASSWORD = process.env.OBS_WS_PASSWORD || undefined;
const SCENE_NAME = "Chrome Recording";
const SOURCE_NAME = "Chrome Window Capture";
const DEFAULT_RECORD_DIR = "/tmp/obs-recordings";

class ControllerError extends Error {
  constructor(message) {
    super(message);
    this.name = "ControllerError";
  }
}

async function connect() {
  const obs = new OBSWebSocket();
  try {
    await obs.connect(OBS_WS_URL, OBS_PASSWORD);
  } catch (err) {
    const msg = err.message || String(err);
    if (err.code === "ECONNREFUSED" || msg.includes("ECONNREFUSED")) {
      throw new ControllerError(
        "Cannot connect to OBS WebSocket at " +
          OBS_WS_URL +
          ". Make sure OBS is running and WebSocket Server is enabled (Tools > WebSocket Server Settings)."
      );
    }
    if (
      err.code === "AUTH_FAILED" ||
      err.code === 4009 ||
      msg.includes("auth") ||
      msg.includes("Authentication")
    ) {
      throw new ControllerError(
        "OBS WebSocket authentication failed. Set OBS_WS_PASSWORD env var, or disable authentication in Tools > WebSocket Server Settings."
      );
    }
    throw new ControllerError("Failed to connect to OBS: " + msg);
  }
  return obs;
}

async function cmdStatus() {
  const obs = await connect();
  try {
    const recordStatus = await obs.call("GetRecordStatus");
    const sceneList = await obs.call("GetSceneList");
    const currentScene = sceneList.currentProgramSceneName;
    const hasRecordingScene = sceneList.scenes.some(
      (s) => s.sceneName === SCENE_NAME
    );

    let recordDir = null;
    try {
      const dirResp = await obs.call("GetRecordDirectory");
      recordDir = dirResp.recordDirectory;
    } catch (_) {
      // older OBS versions may not support this
    }

    return {
      ok: true,
      connected: true,
      recording: recordStatus.outputActive,
      paused: recordStatus.outputPaused,
      timecode: recordStatus.outputTimecode || null,
      bytes: recordStatus.outputBytes || 0,
      currentScene,
      hasRecordingScene,
      recordDirectory: recordDir,
    };
  } finally {
    obs.disconnect();
  }
}

async function cmdStart() {
  const obs = await connect();
  try {
    const recordStatus = await obs.call("GetRecordStatus");
    if (recordStatus.outputActive) {
      throw new ControllerError(
        "OBS is already recording. Use 'stop' to stop the current recording first."
      );
    }

    await obs.call("StartRecord");
    await new Promise((r) => setTimeout(r, 500));
    const status = await obs.call("GetRecordStatus");

    return {
      ok: true,
      action: "started",
      recording: status.outputActive,
    };
  } finally {
    obs.disconnect();
  }
}

async function cmdStop() {
  const obs = await connect();
  try {
    const recordStatus = await obs.call("GetRecordStatus");
    if (!recordStatus.outputActive) {
      throw new ControllerError(
        "OBS is not currently recording. Nothing to stop."
      );
    }

    const result = await obs.call("StopRecord");

    return {
      ok: true,
      action: "stopped",
      outputPath: result.outputPath || null,
    };
  } finally {
    obs.disconnect();
  }
}

async function cmdSetup() {
  const obs = await connect();
  try {
    // 1. Set recording format to MP4 (both Simple and Advanced mode)
    for (const [cat, name] of [
      ["SimpleOutput", "RecFormat"],
      ["SimpleOutput", "RecFormat2"],
      ["Output", "RecFormat2"],
    ]) {
      try {
        await obs.call("SetProfileParameter", {
          parameterCategory: cat,
          parameterName: name,
          parameterValue: "mp4",
        });
      } catch (_) {}
    }

    // 2. Set record directory
    try {
      await obs.call("SetRecordDirectory", {
        recordDirectory: DEFAULT_RECORD_DIR,
      });
    } catch (_) {}

    // 3. Create the Chrome Recording scene if it doesn't exist
    const sceneList = await obs.call("GetSceneList");
    const sceneExists = sceneList.scenes.some(
      (s) => s.sceneName === SCENE_NAME
    );

    if (!sceneExists) {
      await obs.call("CreateScene", { sceneName: SCENE_NAME });
    }

    // 4. Switch to the Chrome Recording scene
    await obs.call("SetCurrentProgramScene", { sceneName: SCENE_NAME });

    // 5. Add screen capture source if not already present
    let sourceExists = false;
    try {
      const items = await obs.call("GetSceneItemList", {
        sceneName: SCENE_NAME,
      });
      sourceExists = items.sceneItems.some(
        (item) => item.sourceName === SOURCE_NAME
      );
    } catch (_) {}

    if (!sourceExists) {
      try {
        await obs.call("CreateInput", {
          sceneName: SCENE_NAME,
          inputName: SOURCE_NAME,
          inputKind: "screen_capture",
          inputSettings: {
            show_cursor: true,
            type: 2, // 0=display, 1=window, 2=application
            application: "com.google.Chrome",
          },
          sceneItemEnabled: true,
        });
      } catch (_createErr) {
        try {
          await obs.call("CreateInput", {
            sceneName: SCENE_NAME,
            inputName: SOURCE_NAME,
            inputKind: "macos_screen_capture",
            inputSettings: {
              show_cursor: true,
              type: 2,
              application: "com.google.Chrome",
            },
            sceneItemEnabled: true,
          });
        } catch (_) {
          return {
            ok: true,
            action: "setup",
            scene: SCENE_NAME,
            sourceAdded: false,
            sourceWarning:
              "Could not auto-create screen capture source. Please add a Screen Capture source manually in OBS for Chrome.",
            recordDirectory: DEFAULT_RECORD_DIR,
            format: "mp4",
          };
        }
      }
    }

    return {
      ok: true,
      action: "setup",
      scene: SCENE_NAME,
      source: SOURCE_NAME,
      sourceAdded: !sourceExists,
      recordDirectory: DEFAULT_RECORD_DIR,
      format: "mp4",
    };
  } finally {
    obs.disconnect();
  }
}

async function cmdDir(path) {
  const obs = await connect();
  try {
    if (path) {
      await obs.call("SetRecordDirectory", { recordDirectory: path });
      return {
        ok: true,
        action: "set_directory",
        recordDirectory: path,
      };
    } else {
      const resp = await obs.call("GetRecordDirectory");
      return {
        ok: true,
        recordDirectory: resp.recordDirectory,
      };
    }
  } finally {
    obs.disconnect();
  }
}

// Main
const [cmd, ...args] = process.argv.slice(2);

async function main() {
  try {
    let result;
    switch (cmd) {
      case "status":
        result = await cmdStatus();
        break;
      case "start":
        result = await cmdStart();
        break;
      case "stop":
        result = await cmdStop();
        break;
      case "setup":
        result = await cmdSetup();
        break;
      case "dir":
        result = await cmdDir(args[0]);
        break;
      default:
        console.log(
          JSON.stringify({
            ok: false,
            error: `Unknown command: ${cmd}. Valid commands: status, start, stop, setup, dir [path]`,
          })
        );
        process.exit(1);
    }
    console.log(JSON.stringify(result));
  } catch (err) {
    if (err instanceof ControllerError) {
      console.log(JSON.stringify({ ok: false, error: err.message }));
    } else {
      console.log(
        JSON.stringify({ ok: false, error: "Unexpected error: " + err.message })
      );
    }
    process.exit(1);
  }
}

await main();
