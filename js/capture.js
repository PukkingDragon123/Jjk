// Capture the camera + VFX into a stylized "cursed photo" and post/share it.

function drawCover(ctx, video, W, H, mirror) {
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh) return;
  const scale = Math.max(W / vw, H / vh);
  const dw = vw * scale, dh = vh * scale;
  const dx = (W - dw) / 2, dy = (H - dh) / 2;
  ctx.save();
  if (mirror) { ctx.translate(W, 0); ctx.scale(-1, 1); }
  ctx.drawImage(video, dx, dy, dw, dh);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function composeShot({ video, fxCanvas, character, techName, mirror, artImg }) {
  const W = fxCanvas.width, H = fxCanvas.height;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");

  drawCover(ctx, video, W, H, mirror);
  ctx.drawImage(fxCanvas, 0, 0, W, H);

  // vignette
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,.55)");
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

  const pad = Math.round(W * 0.03);
  const accent = character.accent;

  // neon border
  ctx.strokeStyle = accent; ctx.lineWidth = Math.max(3, W * 0.006);
  ctx.shadowColor = accent; ctx.shadowBlur = 24;
  roundRect(ctx, pad, pad, W - pad * 2, H - pad * 2, W * 0.03);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // character avatar/glyph + name (top-left), styled like a taped sticker
  const gsize = Math.round(W * 0.13);
  const ax = pad * 1.6, ay = pad * 1.4;
  ctx.textBaseline = "top";
  if (artImg) {
    ctx.save();
    ctx.fillStyle = "#fff"; ctx.shadowColor = "rgba(0,0,0,.5)"; ctx.shadowBlur = 14;
    roundRect(ctx, ax - 4, ay - 4, gsize + 8, gsize + 8, 12); ctx.fill();
    ctx.shadowBlur = 0;
    roundRect(ctx, ax, ay, gsize, gsize, 9); ctx.clip();
    const s = Math.max(gsize / artImg.width, gsize / artImg.height);
    const iw = artImg.width * s, ih = artImg.height * s;
    ctx.drawImage(artImg, ax + (gsize - iw) / 2, ay + (gsize - ih) / 2, iw, ih);
    ctx.restore();
  } else {
    ctx.fillStyle = accent; ctx.strokeStyle = "rgba(0,0,0,.4)"; ctx.lineWidth = 3;
    roundRect(ctx, ax, ay, gsize, gsize, 12); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = `700 ${gsize * 0.6}px "Oswald", sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(character.initial, ax + gsize / 2, ay + gsize / 2);
    ctx.textAlign = "left"; ctx.textBaseline = "top";
  }
  ctx.font = `800 ${Math.round(W * 0.038)}px "Oswald","Rajdhani",sans-serif`;
  ctx.fillStyle = "#fff"; ctx.shadowColor = "#000"; ctx.shadowBlur = 6;
  ctx.fillText(character.name, ax + gsize * 1.18, ay + gsize * 0.08);
  ctx.font = `600 ${Math.round(W * 0.024)}px "Rajdhani", sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,.78)";
  ctx.fillText(character.title, ax + gsize * 1.18, ay + gsize * 0.5);
  ctx.shadowBlur = 0;

  // technique caption (bottom)
  if (techName) {
    ctx.textBaseline = "bottom";
    ctx.font = `900 ${Math.round(W * 0.05)}px "Noto Sans JP", sans-serif`;
    ctx.fillStyle = "#fff"; ctx.shadowColor = accent; ctx.shadowBlur = 18;
    ctx.fillText(techName, pad * 1.6, H - pad * 1.6);
    ctx.shadowBlur = 0;
  }

  // watermark (bottom-right)
  ctx.textAlign = "right"; ctx.textBaseline = "bottom";
  ctx.font = `700 ${Math.round(W * 0.026)}px "Oswald", sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,.75)";
  ctx.fillText("JUJUTSU WEB", W - pad * 1.6, H - pad * 1.6);
  ctx.textAlign = "left";

  return c.toDataURL("image/jpeg", 0.92);
}

async function dataURLtoFile(dataURL, name) {
  const res = await fetch(dataURL);
  const blob = await res.blob();
  return new File([blob], name, { type: blob.type });
}

export async function postShot(dataURL, caption = "My cursed technique ⚡ #JujutsuWeb") {
  try {
    const file = await dataURLtoFile(dataURL, "jujutsu-web.jpg");
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text: caption, title: "Jujutsu Web" });
      return "shared";
    }
  } catch (e) {
    if (e && e.name === "AbortError") return "cancelled";
  }
  // fallback: download
  const a = document.createElement("a");
  a.href = dataURL;
  a.download = "jujutsu-web-" + Date.now() + ".jpg";
  document.body.appendChild(a); a.click(); a.remove();
  return "downloaded";
}
