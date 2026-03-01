#!/usr/bin/env node

import OBSWebSocket from "obs-websocket-js";

const OBS_WS_URL = "ws://127.0.0.1:4455";
const OBS_PASSWORD = process.env.OBS_WS_PASSWORD || undefined;
const SCENE_NAME = "Screencast";
const SOURCE_NAME = "Screencast Capture";
const DEFAULT_RECORD_DIR = "/tmp/obs-recordings";
const DEFAULT_APP = "com.google.Chrome";

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

async function adaptCanvas(obs) {
  try {
    const items = await obs.call("GetSceneItemList", {
      sceneName: SCENE_NAME,
    });
    const item = items.sceneItems.find((i) => i.sourceName === SOURCE_NAME);
    if (!item) return;

    // Wait briefly for source to initialize after app switch
    await new Promise((r) => setTimeout(r, 300));

    const t = await obs.call("GetSceneItemTransform", {
      sceneName: SCENE_NAME,
      sceneItemId: item.sceneItemId,
    });

    const srcW = t.sceneItemTransform.sourceWidth;
    const srcH = t.sceneItemTransform.sourceHeight;
    if (!srcW || !srcH) return;

    // Set canvas and output to match source
    await obs.call("SetVideoSettings", {
      baseWidth: srcW,
      baseHeight: srcH,
      outputWidth: srcW,
      outputHeight: srcH,
      fpsNumerator: 30,
      fpsDenominator: 1,
    });

    // Reset transform to 1:1
    await obs.call("SetSceneItemTransform", {
      sceneName: SCENE_NAME,
      sceneItemId: item.sceneItemId,
      sceneItemTransform: {
        boundsType: "OBS_BOUNDS_NONE",
        scaleX: 1,
        scaleY: 1,
        positionX: 0,
        positionY: 0,
      },
    });
  } catch (_) {}
}

async function cmdStatus() {
  const obs = await connect();
  try {
    const recordStatus = await obs.call("GetRecordStatus");
    const sceneList = await obs.call("GetSceneList");
    const currentScene = sceneList.currentProgramSceneName;
    const hasScene = sceneList.scenes.some((s) => s.sceneName === SCENE_NAME);

    let recordDir = null;
    try {
      const dirResp = await obs.call("GetRecordDirectory");
      recordDir = dirResp.recordDirectory;
    } catch (_) {}

    // Get current app target
    let currentApp = null;
    try {
      const settings = await obs.call("GetInputSettings", {
        inputName: SOURCE_NAME,
      });
      currentApp = settings.inputSettings.application || null;
    } catch (_) {}

    return {
      ok: true,
      connected: true,
      recording: recordStatus.outputActive,
      paused: recordStatus.outputPaused,
      timecode: recordStatus.outputTimecode || null,
      bytes: recordStatus.outputBytes || 0,
      currentScene,
      hasScene,
      currentApp,
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

    await adaptCanvas(obs);
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

async function cmdApp(bundleId) {
  const obs = await connect();
  try {
    if (!bundleId) {
      // Get current app
      try {
        const settings = await obs.call("GetInputSettings", {
          inputName: SOURCE_NAME,
        });
        const typeNames = { 0: "display", 1: "window", 2: "application" };
        return {
          ok: true,
          application: settings.inputSettings.application || null,
          type: settings.inputSettings.type,
          mode: typeNames[settings.inputSettings.type] || "unknown",
        };
      } catch (_) {
        throw new ControllerError("Source not found. Run 'setup' first.");
      }
    }

    // Change target app
    await obs.call("SetInputSettings", {
      inputName: SOURCE_NAME,
      inputSettings: {
        type: 2,
        application: bundleId,
      },
      overlay: true,
    });

    await adaptCanvas(obs);

    return {
      ok: true,
      action: "set_app",
      application: bundleId,
    };
  } finally {
    obs.disconnect();
  }
}

async function cmdMode(mode) {
  const obs = await connect();
  try {
    const modeMap = { display: 0, window: 1, application: 2, app: 2 };
    const typeNames = { 0: "display", 1: "window", 2: "application" };

    if (!mode) {
      try {
        const settings = await obs.call("GetInputSettings", {
          inputName: SOURCE_NAME,
        });
        return {
          ok: true,
          type: settings.inputSettings.type,
          mode: typeNames[settings.inputSettings.type] || "unknown",
          application: settings.inputSettings.application || null,
        };
      } catch (_) {
        throw new ControllerError("Source not found. Run 'setup' first.");
      }
    }

    const typeVal = modeMap[mode.toLowerCase()];
    if (typeVal === undefined) {
      throw new ControllerError(
        `Unknown mode: ${mode}. Valid modes: display, window, application`
      );
    }

    await obs.call("SetInputSettings", {
      inputName: SOURCE_NAME,
      inputSettings: { type: typeVal },
      overlay: true,
    });

    await adaptCanvas(obs);

    return {
      ok: true,
      action: "set_mode",
      mode: typeNames[typeVal],
      type: typeVal,
    };
  } finally {
    obs.disconnect();
  }
}

async function cmdWindow(query) {
  const obs = await connect();
  try {
    // Get all available windows
    const props = await obs.call("GetInputPropertiesListPropertyItems", {
      inputName: SOURCE_NAME,
      propertyName: "window",
    });
    const windows = props.propertyItems;

    if (!query) {
      // List all windows
      return {
        ok: true,
        action: "list_windows",
        windows: windows.map((w) => ({
          id: w.itemValue,
          name: w.itemName,
        })),
      };
    }

    // Search for matching window (case-insensitive)
    const q = query.toLowerCase();
    const match = windows.find((w) => w.itemName.toLowerCase().includes(q));

    if (!match) {
      throw new ControllerError(
        `No window matching "${query}". Use 'window' with no args to list all.`
      );
    }

    // Switch to window mode and select the window
    await obs.call("SetInputSettings", {
      inputName: SOURCE_NAME,
      inputSettings: {
        type: 1,
        window: match.itemValue,
      },
      overlay: true,
    });

    await adaptCanvas(obs);

    return {
      ok: true,
      action: "set_window",
      windowId: match.itemValue,
      windowName: match.itemName,
    };
  } finally {
    obs.disconnect();
  }
}

async function cmdSetup(bundleId) {
  const app = bundleId || DEFAULT_APP;
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

    // 3. Create scene if it doesn't exist
    const sceneList = await obs.call("GetSceneList");
    const sceneExists = sceneList.scenes.some(
      (s) => s.sceneName === SCENE_NAME
    );

    if (!sceneExists) {
      await obs.call("CreateScene", { sceneName: SCENE_NAME });
    }

    // 4. Switch to scene
    await obs.call("SetCurrentProgramScene", { sceneName: SCENE_NAME });

    // 5. Add or update screen capture source
    let sourceExists = false;
    try {
      const items = await obs.call("GetSceneItemList", {
        sceneName: SCENE_NAME,
      });
      sourceExists = items.sceneItems.some(
        (item) => item.sourceName === SOURCE_NAME
      );
    } catch (_) {}

    if (sourceExists) {
      // Update existing source to target the requested app
      await obs.call("SetInputSettings", {
        inputName: SOURCE_NAME,
        inputSettings: {
          type: 2,
          application: app,
          show_cursor: true,
        },
        overlay: true,
      });
    } else {
      try {
        await obs.call("CreateInput", {
          sceneName: SCENE_NAME,
          inputName: SOURCE_NAME,
          inputKind: "screen_capture",
          inputSettings: {
            show_cursor: true,
            type: 2,
            application: app,
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
              application: app,
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
              "Could not auto-create screen capture source. Add manually in OBS.",
            recordDirectory: DEFAULT_RECORD_DIR,
            format: "mp4",
          };
        }
      }
    }

    await adaptCanvas(obs);

    return {
      ok: true,
      action: "setup",
      scene: SCENE_NAME,
      source: SOURCE_NAME,
      application: app,
      sourceAdded: !sourceExists,
      sourceUpdated: sourceExists,
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
        result = await cmdSetup(args[0]);
        break;
      case "app":
        result = await cmdApp(args[0]);
        break;
      case "mode":
        result = await cmdMode(args[0]);
        break;
      case "window":
        result = await cmdWindow(args[0]);
        break;
      case "dir":
        result = await cmdDir(args[0]);
        break;
      default:
        console.log(
          JSON.stringify({
            ok: false,
            error: `Unknown command: ${cmd}. Valid commands: status, start, stop, setup [bundle-id], app [bundle-id], mode [display|window|application], window [search], dir [path]`,
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
        JSON.stringify({
          ok: false,
          error: "Unexpected error: " + err.message,
        })
      );
    }
    process.exit(1);
  }
}

await main();
