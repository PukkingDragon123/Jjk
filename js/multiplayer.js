// Peer-to-peer versus over WebRTC (PeerJS). Thin transport layer:
// - a reliable data channel for combat events (attacks / hp / char)
// - a media call so each fighter sees the other's camera.

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PREFIX = "jjkw-";

function randCode(n = 4) {
  let s = "";
  for (let i = 0; i < n; i++) s += CODE_CHARS[(Math.random() * CODE_CHARS.length) | 0];
  return s;
}

function loadPeerJS() {
  if (window.Peer) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = window.__peerSrc || "https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js";
    s.onload = res;
    s.onerror = () => rej(new Error("Could not load PeerJS (network blocked?)"));
    document.head.appendChild(s);
  });
}

export class Versus {
  constructor(handlers = {}) {
    this.h = handlers; // { onStatus, onData, onConnected, onRemoteStream, onClose }
    this.peer = null;
    this.conn = null;
    this.localStream = null;
    this.connected = false;
  }

  status(msg) { this.h.onStatus?.(msg); }

  async _newPeer(id) {
    await loadPeerJS();
    return new Promise((resolve, reject) => {
      const peer = id ? new window.Peer(id) : new window.Peer();
      const to = setTimeout(() => reject(new Error("Connection timed out")), 12000);
      peer.on("open", () => { clearTimeout(to); resolve(peer); });
      peer.on("error", (err) => {
        clearTimeout(to);
        if (err.type === "peer-unavailable") this.status("Room not found. Check the code.");
        else if (err.type === "unavailable-id") reject(new Error("retry-id"));
        else { this.status("Network error: " + err.type); this.h.onClose?.(); }
        reject(err);
      });
      peer.on("disconnected", () => this.status("Disconnected — reconnecting…"));
    });
  }

  _wireConn(conn) {
    this.conn = conn;
    conn.on("open", () => { this.connected = true; this.h.onConnected?.(); });
    conn.on("data", (d) => this.h.onData?.(d));
    conn.on("close", () => { this.connected = false; this.h.onClose?.(); });
    conn.on("error", () => {});
  }

  _wireMedia(peer) {
    peer.on("call", (call) => {
      call.answer(this.localStream || undefined);
      call.on("stream", (rs) => this.h.onRemoteStream?.(rs));
    });
  }

  async host(localStream) {
    this.localStream = localStream;
    let code, peer;
    for (let attempt = 0; attempt < 5; attempt++) {
      code = randCode();
      try { peer = await this._newPeer(PREFIX + code); break; }
      catch (e) { if (e.message !== "retry-id") throw e; }
    }
    this.peer = peer;
    this._wireMedia(peer);
    peer.on("connection", (conn) => {
      this._wireConn(conn);
      // host calls guest once they connect (guest answers)
      conn.on("open", () => { if (this.localStream) peer.call(conn.peer, this.localStream); });
    });
    this.status("Waiting for opponent…");
    return code;
  }

  async join(code, localStream) {
    this.localStream = localStream;
    const peer = await this._newPeer();
    this.peer = peer;
    this._wireMedia(peer);
    const hostId = PREFIX + code.toUpperCase();
    const conn = peer.connect(hostId, { reliable: true });
    this._wireConn(conn);
    // also place a media call so host sees us
    setTimeout(() => { if (this.localStream) { const c = peer.call(hostId, this.localStream); c?.on("stream", (rs) => this.h.onRemoteStream?.(rs)); } }, 600);
    this.status("Connecting…");
  }

  // ---- Ranked / cross-play quick match (serverless rendezvous) ----
  async quickMatch(localStream) {
    this.localStream = localStream;
    await loadPeerJS();
    const id = PREFIX + "ranked-q";
    this.status("Scanning for a sorcerer to fight…");
    if (await this._joinRanked(id)) return "guest";
    const hosted = await this._hostRanked(id);
    if (hosted === "claimed") { this.status("Waiting for a challenger… (cross-play)"); return "host"; }
    if (await this._joinRanked(id)) return "guest";
    this.status("Queue busy — tap again in a moment.");
    return null;
  }

  _joinRanked(id) {
    return new Promise(async (resolve) => {
      let peer;
      try { peer = await this._newPeer(); } catch (e) { return resolve(false); }
      let done = false;
      const conn = peer.connect(id, { reliable: true });
      const to = setTimeout(() => { if (!done) { done = true; try { peer.destroy(); } catch (e) {} resolve(false); } }, 5000);
      conn.on("open", () => {
        if (done) return; done = true; clearTimeout(to);
        // conn is already open here, so wire data/close directly and announce
        this.peer = peer; this.conn = conn; this.connected = true;
        this._wireMedia(peer);
        conn.on("data", (d) => this.h.onData?.(d));
        conn.on("close", () => { this.connected = false; this.h.onClose?.(); });
        setTimeout(() => { const c = peer.call(id, this.localStream); c?.on("stream", (rs) => this.h.onRemoteStream?.(rs)); }, 500);
        this.h.onConnected?.();
        resolve(true);
      });
      peer.on("error", (e) => { if (e.type === "peer-unavailable" && !done) { done = true; clearTimeout(to); try { peer.destroy(); } catch (e) {} resolve(false); } });
    });
  }

  _hostRanked(id) {
    return new Promise((resolve) => {
      let peer;
      try { peer = new window.Peer(id); } catch (e) { return resolve("taken"); }
      let settled = false;
      const to = setTimeout(() => { if (!settled) { settled = true; try { peer.destroy(); } catch (e) {} resolve("taken"); } }, 7000);
      peer.on("open", () => {
        if (settled) return; settled = true; clearTimeout(to);
        this.peer = peer; this._wireMedia(peer);
        peer.on("connection", (conn) => {
          if (this.conn) { try { conn.close(); } catch (e) {} return; }
          this._wireConn(conn);
          conn.on("open", () => { if (this.localStream) peer.call(conn.peer, this.localStream); });
        });
        resolve("claimed");
      });
      peer.on("error", (e) => { if (!settled && e.type === "unavailable-id") { settled = true; clearTimeout(to); try { peer.destroy(); } catch (e) {} resolve("taken"); } });
    });
  }

  send(obj) {
    if (this.conn && this.connected) { try { this.conn.send(obj); } catch (e) {} }
  }

  close() {
    try { this.conn?.close(); } catch (e) {}
    try { this.peer?.destroy(); } catch (e) {}
    this.peer = this.conn = null; this.connected = false;
  }
}
