// AI hand tracking via MediaPipe Tasks Vision, with a pointer fallback so the
// app is always usable even if the model/CDN is unavailable.

const VISION_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
const WASM_URL = VISION_URL + "/wasm";
const HAND_MODEL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export class Tracker {
  constructor() {
    this.mode = "loading"; // 'hands' | 'pointer'
    this.landmarker = null;
    this.lastVideoTime = -1;
    this.result = { hands: [] };
  }

  async init(onProgress = () => {}) {
    // never let a slow/blocked CDN hang startup
    const timeout = new Promise((res) => setTimeout(() => res("timeout"), 12000));
    const result = await Promise.race([this._initModel(onProgress), timeout]);
    if (result === "timeout" && this.mode === "loading") {
      console.warn("[tracking] model load timed out, using pointer fallback");
      this.mode = "pointer";
    }
    return this.mode;
  }

  async _initModel(onProgress) {
    try {
      onProgress(0.2, "Loading vision engine…");
      const vision = await import(VISION_URL);
      const { HandLandmarker, FilesetResolver } = vision;
      onProgress(0.45, "Fetching cursed sight model…");
      const resolver = await FilesetResolver.forVisionTasks(WASM_URL);
      const opts = (delegate) => ({
        baseOptions: { modelAssetPath: HAND_MODEL, delegate },
        runningMode: "VIDEO",
        numHands: 2,
      });
      try {
        this.landmarker = await HandLandmarker.createFromOptions(resolver, opts("GPU"));
      } catch (e) {
        this.landmarker = await HandLandmarker.createFromOptions(resolver, opts("CPU"));
      }
      onProgress(0.9, "Cursed sight online.");
      this.mode = "hands";
    } catch (err) {
      console.warn("[tracking] hand model unavailable, using pointer fallback:", err);
      this.mode = "pointer";
    }
    return this.mode;
  }

  // returns { hands: [ { points:[{x,y,z}x21], handedness:'Left'|'Right' } ] } normalized 0..1
  detect(video, timeMs) {
    if (this.mode !== "hands" || !this.landmarker) return this.result;
    if (video.currentTime === this.lastVideoTime) return this.result;
    this.lastVideoTime = video.currentTime;
    let res;
    try {
      res = this.landmarker.detectForVideo(video, timeMs);
    } catch (e) {
      return this.result;
    }
    const hands = [];
    if (res && res.landmarks) {
      for (let i = 0; i < res.landmarks.length; i++) {
        hands.push({
          points: res.landmarks[i],
          handedness: res.handedness?.[i]?.[0]?.categoryName || "Right",
        });
      }
    }
    this.result = { hands };
    return this.result;
  }
}

// MediaPipe hand landmark indices
export const LM = {
  WRIST: 0,
  THUMB_CMC: 1, THUMB_MCP: 2, THUMB_IP: 3, THUMB_TIP: 4,
  INDEX_MCP: 5, INDEX_PIP: 6, INDEX_DIP: 7, INDEX_TIP: 8,
  MIDDLE_MCP: 9, MIDDLE_PIP: 10, MIDDLE_DIP: 11, MIDDLE_TIP: 12,
  RING_MCP: 13, RING_PIP: 14, RING_DIP: 15, RING_TIP: 16,
  PINKY_MCP: 17, PINKY_PIP: 18, PINKY_DIP: 19, PINKY_TIP: 20,
};
