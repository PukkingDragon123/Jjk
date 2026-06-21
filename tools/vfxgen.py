#!/usr/bin/env python3
"""Procedurally render cursed-energy VFX clips (energy-on-black, screen-blend ready).
Outputs assets/vfx/<charId>_<techId>.webm. Preview mode dumps PNGs for tuning."""
import numpy as np, imageio.v2 as imageio, os, math, sys

W, H = 864, 480
FPS = 30
CX, CY = W / 2, H * 0.52
OUT = os.environ.get("VFX_OUT", os.path.join(os.path.dirname(__file__), "..", "assets", "vfx"))
PREVIEW = os.path.join(os.path.dirname(__file__), "preview")

def hx(h):
    h = h.lstrip("#"); return np.array([int(h[0:2],16),int(h[2:4],16),int(h[4:6],16)],np.float32)

YY, XX = np.mgrid[0:H, 0:W]; XX = XX.astype(np.float32); YY = YY.astype(np.float32)

def stroke_field(pts, thick):
    """glowing brightness field around a polyline (min-distance), for blade arcs."""
    d2 = np.full((H, W), 1e12, np.float32)
    for px, py in pts:
        np.minimum(d2, (XX-px)**2 + (YY-py)**2, out=d2)
    return np.exp(-d2/(2*thick*thick))

def bezier(p0, p1, p2, s):
    s = np.asarray(s)[:, None]; return (1-s)**2*p0 + 2*(1-s)*s*p1 + s*s*p2

# ---------- fast separable box blur (energy-preserving avg) ----------
def _blur1d(a, r, axis):
    n = a.shape[axis]
    cs = np.cumsum(a, axis=axis)
    pad = list(a.shape); pad[axis] = 1
    csp = np.concatenate([np.zeros(pad, a.dtype), cs], axis=axis)
    hi = np.clip(np.arange(n)+r+1, 0, n)
    lo = np.clip(np.arange(n)-r, 0, n)
    win = (hi-lo).astype(np.float32)
    sh = [1,1,1]; sh[axis] = n
    s = np.take(csp, hi, axis=axis) - np.take(csp, lo, axis=axis)
    return s / win.reshape(sh)

def blur(a, r, passes=2):
    if r < 1: return a
    for _ in range(passes):
        a = _blur1d(a, r, 0); a = _blur1d(a, r, 1)
    return a

# ---------- value noise (bilinear-upsampled random grid) ----------
def vnoise(scale, seed, h=H, w=W):
    rng = np.random.default_rng(seed)
    gh, gw = max(2,int(h/scale)+2), max(2,int(w/scale)+2)
    g = rng.random((gh, gw)).astype(np.float32)
    yi = np.linspace(0, gh-1.001, h); xi = np.linspace(0, gw-1.001, w)
    y0 = yi.astype(int); x0 = xi.astype(int); fy = (yi-y0)[:,None]; fx = (xi-x0)[None,:]
    a = g[y0][:,x0]; b = g[y0][:,x0+1]; c = g[y0+1][:,x0]; d = g[y0+1][:,x0+1]
    return (a*(1-fx)+b*fx)*(1-fy) + (c*(1-fx)+d*fx)*fy

# ---------- point splatting with motion blur ----------
def splat(buf, xs, ys, cols, inten, vx=None, vy=None, trail=0):
    samples = [(0,1.0)]
    if trail and vx is not None:
        samples = [(0,1.0),(0.5,0.55),(1.0,0.3),(1.6,0.16)]
    for off, w in samples:
        px = xs - (vx*off if vx is not None else 0)
        py = ys - (vy*off if vy is not None else 0)
        m = (px>=0)&(px<W)&(py>=0)&(py<H)
        if not m.any(): continue
        xi = px[m].astype(np.int32); yi = py[m].astype(np.int32)
        c = cols[m] * (inten[m]*w)[:,None]
        np.add.at(buf, (yi, xi), c)

def ring(buf, cx, cy, rad, thick, col, inten):
    yy, xx = np.ogrid[0:H,0:W]
    d = np.sqrt((xx-cx)**2 + (yy-cy)**2)
    band = np.exp(-((d-rad)**2)/(2*thick*thick))
    for k in range(3): buf[:,:,k] += band*col[k]*inten

def beam_col(buf, cx, w, col, inten, y0=0, y1=H):
    yy, xx = np.ogrid[0:H,0:W]
    prof = np.exp(-((xx-cx)**2)/(2*w*w)).astype(np.float32)
    mask = ((yy>=y0)&(yy<y1)).astype(np.float32)
    prof = prof*mask
    for k in range(3): buf[:,:,k] += prof*col[k]*inten

def disc(buf, cx, cy, rad, col, inten):
    yy, xx = np.ogrid[0:H,0:W]
    d = np.sqrt((xx-cx)**2+(yy-cy)**2)
    g = np.clip(1-d/rad,0,1)**1.8
    for k in range(3): buf[:,:,k] += g*col[k]*inten

# ---------- bolt (recursive-ish jagged polyline drawn as splats) ----------
def bolt(buf, x0,y0,x1,y1,col,inten,seg=18,jit=26,rng=None):
    rng = rng or np.random.default_rng()
    xs=np.linspace(x0,x1,seg); ys=np.linspace(y0,y1,seg)
    nx=-(y1-y0); ny=(x1-x0); L=math.hypot(nx,ny)+1e-6; nx/=L; ny/=L
    off=rng.normal(0,jit,seg); off[0]=off[-1]=0
    xs=xs+nx*off; ys=ys+ny*off
    px=np.concatenate([np.linspace(xs[i],xs[i+1],10) for i in range(seg-1)])
    py=np.concatenate([np.linspace(ys[i],ys[i+1],10) for i in range(seg-1)])
    cols=np.tile(col,(px.size,1)); it=np.full(px.size,inten,np.float32)
    splat(buf,px,py,cols,it)

# ---------- filmic tonemap + bloom compositing ----------
def finalize(buf, exposure=1.45, bloom=(0.55,0.45,0.32), chroma=2):
    g4 = blur(buf, 5); g8 = blur(buf, 14); g16 = blur(buf, 34)
    hdr = buf + g4*bloom[0]*5 + g8*bloom[1]*9 + g16*bloom[2]*16
    if chroma:  # subtle lens fringing on the wide bloom only (cores stay aligned)
        hdr[:,:,0] += np.roll(g16[:,:,0], chroma, axis=1)*bloom[2]*8
        hdr[:,:,2] += np.roll(g16[:,:,2], -chroma, axis=1)*bloom[2]*8
    x = hdr*exposure/255.0
    out = 1.0 - np.exp(-x)            # filmic, pushes hot cores to white
    return (np.clip(out,0,1)*255).astype(np.uint8)

def env(t, a=0.12, d=0.85):
    """attack/decay envelope 0..1 over normalized clip time t."""
    if t < a: return (t/a)**0.6
    if t > d: return max(0.0,(1-t)/(1-d))
    return 1.0

# ===================== ARCHETYPES =====================
def render(cfg):
    kind = cfg["kind"]; N = cfg.get("frames",36)
    C = {k:hx(v) for k,v in cfg["cols"].items()}
    frames=[]; rng=np.random.default_rng(cfg.get("seed",7))
    # persistent particle state for some archetypes
    P = {}
    for f in range(N):
        t = f/(N-1); e = env(t, cfg.get("atk",0.12), cfg.get("dec",0.82))
        buf = np.zeros((H,W,3),np.float32)
        if kind=="implode": _implode(buf,t,e,C,rng,cfg,P)
        elif kind=="burst": _burst(buf,t,e,C,rng,cfg,P)
        elif kind=="flame": _flame(buf,t,e,C,rng,cfg,P)
        elif kind=="beam": _beam(buf,t,e,C,rng,cfg,P)
        elif kind=="slash": _slash(buf,t,e,C,rng,cfg,P)
        elif kind=="flash": _flash(buf,t,e,C,rng,cfg,P)
        elif kind=="beast": _beast(buf,t,e,C,rng,cfg,P)
        elif kind=="domain": _domain(buf,t,e,C,rng,cfg,P)
        frames.append(finalize(buf, cfg.get("exposure",1.45)))
    return frames

def _ptcl_field(P, key, make):
    if key not in P: P[key]=make()
    return P[key]

def _implode(buf,t,e,C,rng,cfg,P):
    n=900
    pf=_ptcl_field(P,"p",lambda:{
        "a":rng.uniform(0,2*math.pi,n),"r0":rng.uniform(160,330,n),
        "sp":rng.uniform(0.8,1.3,n),"col":rng.random(n)})
    conv=min(1.0,t/0.72)
    r=pf["r0"]*(1-conv)**1.6 + 4
    ang=pf["a"]+conv*2.2*pf["sp"]   # spiral as it collapses
    x=CX+np.cos(ang)*r*1.4; y=CY+np.sin(ang)*r
    vx=(CX-x)*0.18 - np.sin(ang)*r*0.05; vy=(CY-y)*0.18 + np.cos(ang)*r*0.05
    mix=pf["col"][:,None]
    col=C["a"]*(1-mix)+C["b"]*mix
    inten=np.full(n, 0.7+0.6*conv, np.float32)
    splat(buf,x,y,col,inten,vx,vy,trail=1)
    # core flash on arrival
    flash=max(0,(conv-0.55)/0.45)
    disc(buf,CX,CY,40+120*flash,C["core"],2.5*flash*e)
    disc(buf,CX,CY,16,C["core"],1.6*conv*e)
    if conv>0.6:
        s=(conv-0.6)/0.4; ring(buf,CX,CY,20+s*260,6+s*8,C["a"],1.4*(1-s)*e)

def _burst(buf,t,e,C,rng,cfg,P):
    n=1100
    pf=_ptcl_field(P,"p",lambda:{
        "a":rng.uniform(0,2*math.pi,n),"sp":rng.uniform(2,16,n)**1.05,
        "g":rng.uniform(0.0,0.25,n),"col":rng.random(n),"life":rng.uniform(0.6,1.0,n)})
    age=t
    r=pf["sp"]*age*22*(1-0.4*age)
    x=CX+np.cos(pf["a"])*r*1.5; y=CY+np.sin(pf["a"])*r + pf["g"]*(age*age*260)
    vx=np.cos(pf["a"])*pf["sp"]*1.2; vy=np.sin(pf["a"])*pf["sp"]*1.2
    mix=pf["col"][:,None]; col=C["a"]*(1-mix)+C["b"]*mix
    alive=(age<pf["life"]).astype(np.float32)
    inten=alive*(1.1-age)*0.9
    splat(buf,x,y,col,inten,vx,vy,trail=1)
    disc(buf,CX,CY,30+200*min(1,t*3),C["core"],2.6*max(0,1-t*2.6))
    s=min(1,t/0.8); ring(buf,CX,CY,10+s*330,7+s*6,C["a"],1.5*(1-s)*e)
    if cfg.get("dbl"):  # divergent / double impact
        s2=max(0,(t-0.35)/0.6);
        if s2>0: ring(buf,CX,CY,10+s2*300,8,C["b"],1.3*(1-s2))

def _flame(buf,t,e,C,rng,cfg,P):
    base_y=CY+86; Hf=250
    fy=(base_y-YY)/Hf                      # 0 at base -> up
    nz=vnoise(46, cfg.get("seed",1)+int(t*10))
    nz2=vnoise(20, cfg.get("seed",1)+100+int(t*16))
    flick=nz*0.6+nz2*0.4
    width=46*(1-np.clip(fy,0,1)*0.62)+1
    sway=(flick-0.5)*64*np.clip(fy,0,1)
    horiz=np.exp(-((XX-CX-sway)**2)/(2*width**2))
    body=horiz*np.clip(1-fy,0,1)*np.clip(flick*1.7-fy*0.55,0,1)*(YY<base_y)
    hot=np.clip(1-fy*2.2,0,1); mid=np.clip(1-np.abs(fy-0.4)*2.2,0,1); top=np.clip(fy-0.2,0,1)
    for k in range(3):
        buf[:,:,k]+=body*e*(C["core"][k]*hot*1.5 + C["a"][k]*mid + C["b"][k]*top*0.6)
    disc(buf,CX,base_y,72,C["a"],0.9*e); disc(buf,CX,base_y,30,C["core"],1.4*e)
    n=520; ph=(rng.random(n)+t*1.5)%1
    ex=CX+rng.normal(0,32,n)*(0.4+ph); ey=base_y-ph*Hf*1.12
    splat(buf,ex,ey,np.tile(C["core"],(n,1)),(1-ph)*0.5*e,np.zeros(n),np.full(n,-7.0),trail=1)

def _beam(buf,t,e,C,rng,cfg,P):
    big=cfg.get("big",False)
    base=H-26
    charge=min(1,t/0.30); fire=max(0,(t-0.30)/0.70)
    w=(6+charge*8)*(1.0 if not big else 1.45)   # slim shaft
    # charge ball at base
    disc(buf,CX,base,22+charge*46,C["a"],1.5*charge*(1-fire*0.6))
    disc(buf,CX,base,14,C["core"],1.7*charge)
    if fire>0:
        ftop=base-fire*(base+30)                # shoots from base up past the top
        pulse=1+0.12*math.sin(t*40)
        y0=int(max(0,ftop)); y1=int(base+6)
        beam_col(buf,CX,w*2.6,C["b"],0.55*e,y0,y1)
        beam_col(buf,CX,w*1.25*pulse,C["a"],1.5*e,y0,y1)
        beam_col(buf,CX,w*0.5,C["core"],2.3*e,y0,y1)
        # streaking energy inside the shaft
        n=420; yy=rng.uniform(max(0,ftop),base,n); xx=rng.normal(CX,w*1.1,n)
        splat(buf,xx,yy,np.tile(C["core"],(n,1)),np.full(n,0.45*e),np.zeros(n),np.full(n,26.0),trail=1)
        if cfg.get("bolts",True):
            for _ in range(3):
                bolt(buf,CX+rng.uniform(-w,w),base,CX+rng.uniform(-w,w),max(0,ftop),C["core"],0.45*e,seg=16,jit=w*1.4,rng=rng)
        # muzzle + leading tip
        disc(buf,CX,base,40+50*fire,C["core"],1.9*(1-fire*0.5))
        disc(buf,CX,max(0,ftop),34,C["core"],1.8*(1-fire)); disc(buf,CX,max(0,ftop),70,C["a"],0.9*(1-fire))
        ring(buf,CX,base,24+fire*110,7,C["a"],1.1*(1-fire))

def _slash(buf,t,e,C,rng,cfg,P):
    # strokes: list of (angle_deg, length, bow, delay)
    strokes=cfg.get("strokes",[(35,760,150,0.0)])
    for i,(adeg,Ln,bow,delay) in enumerate(strokes):
        lt=(t-delay)/0.16            # sweep reveals fast
        if lt<0: continue
        reveal=min(1.0,lt); life=(t-delay)/0.5
        fade=max(0.0,1.0-max(0.0,life)**1.3)
        if fade<=0.01: continue
        ang=math.radians(adeg); dx,dy=math.cos(ang),math.sin(ang)
        ox=(i-(len(strokes)-1)/2)*46
        mx,my=CX+ox, CY+ox*0.2
        p0=np.array([mx-dx*Ln/2, my-dy*Ln/2]); p2=np.array([mx+dx*Ln/2, my+dy*Ln/2])
        p1=np.array([mx-dy*bow, my+dx*bow])
        s=np.linspace(0,reveal,46); pts=bezier(p0,p1,p2,s)
        glow=stroke_field(pts,12.0); core=stroke_field(pts,3.2)
        for k in range(3):
            buf[:,:,k]+=glow*C["a"][k]*1.5*fade + core*C["core"][k]*2.6*fade
        # leading tip + sparks
        hx_,hy=pts[-1]
        disc(buf,hx_,hy,30,C["core"],2.2*fade); disc(buf,hx_,hy,64,C["a"],0.9*fade)
        ns=90; sp=rng.uniform(0,reveal,ns); spt=bezier(p0,p1,p2,sp)
        svx=(-dy)*rng.uniform(-14,14,ns); svy=(dx)*rng.uniform(-14,14,ns)
        splat(buf,spt[:,0]+rng.normal(0,6,ns),spt[:,1]+rng.normal(0,6,ns),
              np.tile(C["core"],(ns,1)),np.full(ns,0.8*fade),svx,svy,trail=1)
    if t<0.12: disc(buf,CX,CY,120*(1-t*8),C["core"],1.4*(1-t*8))

def _flash(buf,t,e,C,rng,cfg,P):
    hits=cfg.get("hits",[0.0])
    for hi,d in enumerate(hits):
        lt=(t-d)/0.30
        if lt<0 or lt>1.25: continue
        cx=CX+(rng.uniform(-110,110) if len(hits)>1 else 0)
        cy=CY+(rng.uniform(-60,60) if len(hits)>1 else 0)
        pk=max(0,1-lt); flarepk=max(0,1-lt*2.2)
        seedr=np.random.default_rng(hi*13+7)
        # sharp red space-distortion cracks (bright, thick, jagged) radiating out
        for k in range(11):
            ang=k/11*2*math.pi+seedr.uniform(-0.25,0.25)
            ln=200+seedr.uniform(0,90)
            bolt(buf,cx,cy,cx+math.cos(ang)*ln,cy+math.sin(ang)*ln,C["core"],2.0*pk,seg=11,jit=34,rng=seedr)
            bolt(buf,cx,cy,cx+math.cos(ang)*ln*0.8,cy+math.sin(ang)*ln*0.8,C["a"],1.4*pk,seg=8,jit=22,rng=seedr)
        # red shock ring + distortion ring
        ring(buf,cx,cy,18+lt*250,6,C["a"],1.8*pk)
        ring(buf,cx,cy,40+lt*150,12,C["b"],0.9*pk)
        # cross-flare impact (lens spikes) + compact white core
        for ang in (0,math.pi/2,math.pi,3*math.pi/2):
            xs=np.linspace(cx,cx+math.cos(ang)*220,80); ys=np.linspace(cy,cy+math.sin(ang)*220,80)
            splat(buf,xs,ys,np.tile(C["core"],(80,1)),np.linspace(1,0,80)*1.4*flarepk)
        disc(buf,cx,cy,40+70*min(1,lt*4),C["core"],2.6*flarepk)
        disc(buf,cx,cy,18,C["core"],3.0*flarepk)
        disc(buf,cx,cy,150*min(1,lt*2),C["b"],0.8*pk)

def _beast(buf,t,e,C,rng,cfg,P):
    serpent=cfg.get("serpent",False)
    if serpent:
        # S-curve trail sweeping across
        ts=np.linspace(0,1,260)
        head=min(1,t/0.8)
        ph=ts*head
        x=80+ph*(W-160); y=CY+np.sin(ph*math.pi*2.2)*120
        fade=np.clip((ph/head if head>0 else ph),0,1)
        cols=C["a"][None,:]*np.ones((ts.size,1))
        for dy in (-7,-3,0,3,7):          # give the body thickness
            splat(buf,x,y+dy,cols,np.clip(fade*1.0,0,2)*(1-abs(dy)/10),trail=0)
        splat(buf,x,y,np.tile(C["core"],(ts.size,1)),np.clip(fade*0.7,0,2),trail=0)
        hxp=80+head*(W-160); hyp=CY+math.sin(head*math.pi*2.2)*120
        disc(buf,hxp,hyp,34,C["core"],2.0*e)
        disc(buf,hxp,hyp,60,C["a"],1.0*e)
    else:
        # two dashes from a shadow pool
        for s,delay,yo in [(1,0.0,-40),(-1,0.12,40)]:
            lt=(t-delay)/0.7
            if lt<0: continue
            prog=min(1.2,lt)
            x0=CX-s*60; x=x0+s*prog*420
            y=CY+yo - math.sin(prog*math.pi)*60
            # streak trail
            tn=120; tx=np.linspace(x-s*120,x,tn); ty=np.linspace(y+10,y,tn)
            splat(buf,tx,ty,np.tile(C["a"],(tn,1)),np.linspace(0,1,tn)*(1.3-lt)*0.9,trail=0)
            disc(buf,x,y,30,C["core"],1.8*max(0,1.2-lt)*e)
            disc(buf,x,y,60,C["a"],0.9*max(0,1.2-lt)*e)
        disc(buf,CX,CY+60,90,C["b"],0.6*e)
    # bolts for nue
    if cfg.get("bolts"):
        for _ in range(2):
            bolt(buf,CX+rng.uniform(-150,150),CY-120,CX+rng.uniform(-150,150),CY+80,C["core"],0.7*e,seg=12,jit=30,rng=rng)

def _domain(buf,t,e,C,rng,cfg,P):
    style=cfg.get("style","void")
    grow=min(1,t/0.5)
    # faint enveloping haze (kept low so rings/sigil read against dark space)
    disc(buf,CX,CY,60+grow*W*0.55,C["a"],0.10*grow*e)
    # turbulent energy texture, only where it's positive -> filaments, not a flood
    nz=vnoise(60, cfg.get("seed",3)+int(t*6))
    fil=np.clip(nz-0.62,0,1)*2.4
    for k in range(3): buf[:,:,k]+=fil*C["a"][k]*0.22*grow*e
    # rotating rays (sparse, additive lines)
    rot=t*1.3; nrays=12 if style!="shrine" else 8
    for k in range(nrays):
        ang=rot+k/nrays*2*math.pi
        xs=np.linspace(CX,CX+math.cos(ang)*W,150); ys=np.linspace(CY,CY+math.sin(ang)*W,150)
        col = C["b"] if style=="shrine" else C["a"]
        splat(buf,xs,ys,np.tile(col,(150,1)),np.linspace(0.7,0,150)*0.35*e)
    # concentric shock rings expanding outward
    for ri in range(4):
        rr=(grow*1.15 - ri*0.16)
        if rr<=0: continue
        ring(buf,CX,CY,rr*W*0.55,4.5,C["core"] if ri==0 else C["a"],0.85*(1-ri*0.18)*e)
    # central sigil
    disc(buf,CX,CY,20+grow*22,C["core"],1.4*e)
    ring(buf,CX,CY,62,3.5,C["core"],1.1*e); ring(buf,CX,CY,104,3,C["a"],0.9*e)
    ring(buf,CX,CY,150,2.5,C["a"],0.6*e)
    if style=="shrine":
        for k in range(8):
            ang=k/8*2*math.pi+0.2
            bolt(buf,CX,CY,CX+math.cos(ang)*270,CY+math.sin(ang)*270,C["b"],0.7*e,seg=6,jit=10,rng=rng)
    if style=="shadow":
        sa=rng.uniform(0,2*math.pi,500); sr=rng.uniform(0,W*0.42,500)*grow
        sx=CX+np.cos(sa+t*3)*sr; sy=CY+np.sin(sa+t*3)*sr*0.6
        splat(buf,sx,sy,np.tile(C["a"],(500,1)),np.full(500,0.4*e),trail=0)
    if t<0.22: disc(buf,CX,CY,W*0.55,C["core"],1.1*(1-t/0.22))   # brief expand flash

# ===================== TECH TABLE =====================
def P(core,a,b): return {"core":core,"a":a,"b":b}
TECHS = {
 "gojo_blue":   dict(kind="implode", cols=P("#eaf4ff","#39a0ff","#7c5cff"), seed=11),
 "gojo_red":    dict(kind="burst",   cols=P("#fff0e6","#ff5a3c","#ff2436"), seed=12),
 "gojo_flame":  dict(kind="flame",   cols=P("#e6f4ff","#39a8ff","#1f4cff"), seed=13),
 "gojo_purple": dict(kind="beam",    cols=P("#f2e9ff","#b14bff","#6a2cff"), big=True, seed=14),
 "gojo_void":   dict(kind="domain",  cols=P("#eaf6ff","#5aa0ff","#bfe3ff"), style="void", frames=46, exposure=1.15, seed=15),

 "sukuna_dismantle": dict(kind="slash", cols=P("#ffe9e6","#ff5a4e","#ff2436"), frames=16, atk=0.05, strokes=[(38,820,120,0.0)], seed=21),
 "sukuna_cleave":    dict(kind="slash", cols=P("#ffece6","#ff6a4e","#ff2436"), frames=18, atk=0.05, strokes=[(28,900,200,0.0)], seed=22),
 "sukuna_spiderweb": dict(kind="slash", cols=P("#ffe9e6","#ff5a4e","#ff2436"), frames=24, atk=0.05, strokes=[(60,780,120,0.0),(-30,780,120,0.10),(8,820,40,0.20)], seed=23),
 "sukuna_fire":      dict(kind="beam",  cols=P("#fff1d6","#ff8a3b","#ff2e2e"), big=True, seed=24),
 "sukuna_shrine":    dict(kind="domain",cols=P("#ffe1d6","#ff5a4e","#ff2436"), style="shrine", frames=46, exposure=1.15, seed=25),

 "yuji_jab":        dict(kind="burst", cols=P("#fff2f2","#ff8a8a","#ff4a4a"), frames=22, seed=31),
 "yuji_divergent":  dict(kind="burst", cols=P("#fff2f2","#ff7a7a","#ff3a3a"), frames=28, dbl=True, seed=32),
 "yuji_manji":      dict(kind="burst", cols=P("#fff0f0","#ff6a6a","#ff2436"), frames=24, seed=33),
 "yuji_blackflash": dict(kind="flash", cols=P("#ffffff","#ff2436","#7a0a14"), frames=16, hits=[0.0], seed=34),
 "yuji_barrage":    dict(kind="flash", cols=P("#ffffff","#ff2436","#7a0a14"), hits=[0.0,0.18,0.38,0.58], frames=40, seed=35),

 "megumi_dogs":     dict(kind="beast", cols=P("#eef2ff","#7c8bff","#3a44a0"), seed=41),
 "megumi_nue":      dict(kind="beast", cols=P("#eef3ff","#8a9bff","#3a44a0"), bolts=True, seed=42),
 "megumi_serpent":  dict(kind="beast", cols=P("#eef2ff","#7c8bff","#3a44a0"), serpent=True, seed=43),
 "megumi_elephant": dict(kind="beam",  cols=P("#eaf4ff","#7fb0ff","#3a6aff"), big=True, seed=44),
 "megumi_garden":   dict(kind="domain",cols=P("#e6ebff","#7c8bff","#5a6bff"), style="shadow", frames=46, exposure=1.15, seed=45),
}

def encode(name, frames):
    os.makedirs(OUT, exist_ok=True)
    path=os.path.join(OUT, name+".webm")
    w=imageio.get_writer(path, fps=FPS, codec="libvpx-vp9", macro_block_size=1,
        output_params=["-pix_fmt","yuv420p","-b:v","0","-crf","36","-row-mt","1","-deadline","good","-cpu-used","2"])
    for fr in frames: w.append_data(fr)
    w.close()
    return path, os.path.getsize(path)

if __name__=="__main__":
    mode = sys.argv[1] if len(sys.argv)>1 else "all"
    if mode=="preview":
        os.makedirs(PREVIEW, exist_ok=True)
        names = sys.argv[2:] or ["gojo_blue","gojo_purple","sukuna_cleave","yuji_blackflash","megumi_garden","gojo_void"]
        for nm in names:
            fr=render(TECHS[nm]); n=len(fr)
            picks=[fr[int(n*f)] for f in (0.12,0.3,0.5,0.7,0.9)]
            sheet=np.concatenate([np.concatenate([p,np.zeros((H,4,3),np.uint8)],axis=1) for p in picks],axis=1)
            sheet=sheet[::2,::2]   # halve for a compact contact sheet
            imageio.imwrite(os.path.join(PREVIEW,nm+".png"), sheet)
            print("preview", nm)
    else:
        names = sys.argv[2:] if mode=="some" else list(TECHS)
        if mode=="some": names=sys.argv[2:]
        tot=0
        for nm in (names if names else TECHS):
            fr=render(TECHS[nm]); path,sz=encode(nm,fr); tot+=sz
            print(f"{nm:22s} {sz//1024:5d} KB  ({len(fr)} f)")
        print(f"TOTAL {tot//1024} KB")
