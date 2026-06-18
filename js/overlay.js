// Optional AR head-gear: BlazeFace face detection -> draw character hair/hat.
// Fails gracefully (overlay just stays off) if the model/CDN is unavailable.
const VISION_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
const WASM_URL = VISION_URL + "/wasm";
const FACE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

export class FaceTracker {
  constructor() { this.mode = "off"; this.detector = null; this.lastT = -1; this.result = null; }
  async init() {
    try {
      const vision = await import(VISION_URL);
      const { FaceDetector, FilesetResolver } = vision;
      const resolver = await FilesetResolver.forVisionTasks(WASM_URL);
      const opts = (d) => ({ baseOptions: { modelAssetPath: FACE_MODEL, delegate: d }, runningMode: "VIDEO" });
      try { this.detector = await FaceDetector.createFromOptions(resolver, opts("GPU")); }
      catch (e) { this.detector = await FaceDetector.createFromOptions(resolver, opts("CPU")); }
      this.mode = "face";
    } catch (e) { console.warn("[overlay] face model unavailable:", e); this.mode = "off"; }
    return this.mode;
  }
  detect(video, t) {
    if (this.mode !== "face" || !this.detector) return null;
    if (video.currentTime === this.lastT) return this.result;
    this.lastT = video.currentTime;
    try {
      const r = this.detector.detectForVideo(video, t);
      const d = r && r.detections && r.detections[0];
      this.result = d && d.keypoints ? { keypoints: d.keypoints } : null;
    } catch (e) { /* keep last */ }
    return this.result;
  }
}

const TAU = Math.PI * 2;

// eyesR / eyesL: {x,y} in canvas px (already mapped + mirrored by caller)
export function drawLook(ctx, eyeR, eyeL, look) {
  const cx = (eyeR.x + eyeL.x) / 2, cy = (eyeR.y + eyeL.y) / 2;
  const dx = eyeL.x - eyeR.x, dy = eyeL.y - eyeR.y;
  const dist = Math.hypot(dx, dy) || 1;
  const ang = Math.atan2(dy, dx);
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(ang); ctx.scale(dist, dist);
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  const ink = "#0d0d14";

  const hairMass = (col, col2) => {
    const g = ctx.createLinearGradient(0, -2.4, 0, 0.2);
    g.addColorStop(0, col); g.addColorStop(1, col2 || col);
    ctx.fillStyle = g; ctx.strokeStyle = ink; ctx.lineWidth = 0.07;
    ctx.beginPath();
    ctx.moveTo(-1.25, 0.1);
    ctx.bezierCurveTo(-1.5, -1.2, -1.1, -2.3, 0, -2.45);
    ctx.bezierCurveTo(1.1, -2.3, 1.5, -1.2, 1.25, 0.1);
    ctx.bezierCurveTo(1.0, -0.5, 0.7, -0.7, 0.55, -0.2);   // right side fall
    ctx.lineTo(0.35, -0.85);
    ctx.lineTo(0.05, -0.25); ctx.lineTo(-0.05, -0.25);     // center bang
    ctx.lineTo(-0.35, -0.85);
    ctx.lineTo(-0.55, -0.2);
    ctx.bezierCurveTo(-0.7, -0.7, -1.0, -0.5, -1.25, 0.1);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  };
  const spikes = (col, col2) => {
    ctx.lineJoin = "round"; ctx.strokeStyle = ink; ctx.lineWidth = 0.07;
    // rounded hair base hugging the head
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(-1.22, 0.12);
    ctx.bezierCurveTo(-1.46, -1.05, -1.05, -1.9, 0, -2.0);
    ctx.bezierCurveTo(1.05, -1.9, 1.46, -1.05, 1.22, 0.12);
    ctx.bezierCurveTo(0.7, -0.45, -0.7, -0.45, -1.22, 0.12);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // layered spiky tufts (lighter)
    ctx.fillStyle = col2 || col;
    for (const [tx, ty, w] of [[-0.95, -2.05, 0.55], [-0.48, -2.45, 0.5], [-0.02, -2.6, 0.54], [0.46, -2.45, 0.5], [0.92, -2.08, 0.55]]) {
      ctx.beginPath(); ctx.moveTo(tx - w * 0.5, -1.25); ctx.lineTo(tx + 0.06, ty); ctx.lineTo(tx + w * 0.5, -1.25); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // front fringe falling over the brow
    ctx.fillStyle = col;
    for (const bx of [-0.6, -0.2, 0.22, 0.62]) {
      ctx.beginPath(); ctx.moveTo(bx - 0.17, -0.35); ctx.lineTo(bx + 0.06, -1.0); ctx.lineTo(bx + 0.17, -0.35); ctx.closePath(); ctx.fill();
    }
  };

  if (look.style === "gojo") {
    hairMass(look.hair, look.hair2);
    // blindfold band across the eyes
    ctx.fillStyle = look.band; ctx.strokeStyle = ink; ctx.lineWidth = 0.05;
    ctx.beginPath(); ctx.moveTo(-1.35, -0.34); ctx.lineTo(1.35, -0.42);
    ctx.lineTo(1.4, 0.36); ctx.lineTo(-1.4, 0.32); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,.18)"; ctx.lineWidth = 0.04;
    ctx.beginPath(); ctx.moveTo(-1.3, 0.02); ctx.lineTo(1.32, -0.04); ctx.stroke();
  } else if (look.style === "spiky") {
    spikes(look.hair, look.hair2);
  } else if (look.style === "cap") {
    // pink fringe peeking out
    ctx.fillStyle = look.hair; ctx.strokeStyle = ink; ctx.lineWidth = 0.05;
    for (let i = -4; i <= 4; i++) { const x = i * 0.26; ctx.beginPath(); ctx.moveTo(x - 0.17, -0.5); ctx.lineTo(x, -1.0); ctx.lineTo(x + 0.17, -0.5); ctx.closePath(); ctx.fill(); }
    // cap dome + brim
    const g = ctx.createLinearGradient(0, -2.4, 0, -0.6); g.addColorStop(0, look.cap); g.addColorStop(1, "#9c1f2f");
    ctx.fillStyle = g; ctx.strokeStyle = ink; ctx.lineWidth = 0.07;
    ctx.beginPath(); ctx.ellipse(0, -1.05, 1.32, 1.25, 0, Math.PI, TAU); ctx.lineTo(1.32, -1.0); ctx.lineTo(-1.32, -1.0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-1.2, -1.0); ctx.quadraticCurveTo(0, -0.62, 1.55, -0.95); ctx.quadraticCurveTo(0.2, -1.2, -1.2, -1.0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0, -1.55, 0.16, 0, TAU); ctx.fill();
  } else if (look.style === "sukuna") {
    hairMass(look.hair, look.hair2);
    // crimson cursed markings on the face
    ctx.strokeStyle = look.marks; ctx.lineWidth = 0.08; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-1.1, -0.55); ctx.lineTo(1.1, -0.55); ctx.stroke();   // forehead line
    ctx.beginPath(); ctx.moveTo(-1.05, -0.2); ctx.lineTo(1.05, -0.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-0.9, 0.45); ctx.lineTo(-0.35, 0.45); ctx.stroke();    // cheek marks
    ctx.beginPath(); ctx.moveTo(0.35, 0.45); ctx.lineTo(0.9, 0.45); ctx.stroke();
    ctx.lineWidth = 0.06;
    ctx.beginPath(); ctx.moveTo(-0.5, -0.78); ctx.lineTo(-0.5, -0.62); ctx.stroke();   // extra eye hints
    ctx.beginPath(); ctx.moveTo(0.5, -0.78); ctx.lineTo(0.5, -0.62); ctx.stroke();
  }
  ctx.restore();
}
