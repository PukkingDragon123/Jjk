# Technique VFX clips

This folder ships with a full set of **20 pre-generated cursed-energy clips** —
one per technique. The game plays them **on top of the camera** the moment a
technique fires (screen-blended, so energy-on-black comps cleanly). The app
probes for each file on character select and uses it automatically; if a clip is
missing, the built-in **procedural VFX falls back in** seamlessly.

## How these were made (and how to regenerate / replace them)

The bundled clips are rendered **procedurally** by [`tools/vfxgen.py`](../../tools/vfxgen.py)
— a numpy renderer (additive particles, filmic tone-map, multi-scale bloom,
motion blur, chromatic fringing) encoded to VP9 webm. To rebuild them:

```bash
pip install numpy imageio imageio-ffmpeg
python3 tools/vfxgen.py all          # writes all 20 into assets/vfx/
python3 tools/vfxgen.py preview      # dump contact-sheet PNGs to tune by eye
```

Prefer **AI-generated** clips (Higgsfield / Runway / Sora / Kling …)? Just drop a
`.webm` with the matching filename here and it overrides the bundled one — no
code change. Generation guidance is below.

## How the clips are composited

Clips are layered with `mix-blend-mode: screen` (see `.vfxclip` in
`css/style.css`). That means:

- **Energy on a pure-black background works perfectly** — black becomes
  transparent, only the glow/fire/lightning shows over the player. This is the
  easiest thing to generate, so prefer it.
- Clips **with a real alpha channel** (VP9/VP8 + alpha) also work and look even
  cleaner for solid shapes (shadow beasts, shrine, water).
- Avoid bright/white full-frame backgrounds — `screen` blend will wash the
  camera out.

## File format

| Property     | Recommended                                                        |
|--------------|--------------------------------------------------------------------|
| Container    | `.webm` (VP9 preferred; VP8 fine)                                  |
| Background   | pure black `#000000`, **or** transparent alpha                     |
| Length       | ~1–2 s, action front-loaded (it hides itself when the clip `ended`) |
| Resolution   | ~1024×1024 or 1280×720, square reads well centered                 |
| Frame rate   | 24–30 fps                                                          |
| Audio        | none (muted on playback anyway)                                    |
| File size    | keep under ~2–3 MB each so they load fast over githack             |

> If your generator only exports `.mp4`, transcode to webm, e.g.
> `ffmpeg -i in.mp4 -c:v libvpx-vp9 -b:v 0 -crf 32 -an out.webm`
> (for alpha: add `-pix_fmt yuva420p` and use a transparent export).

## Exact filenames

Name each file `<characterId>_<techniqueId>.webm`. The full set the game looks
for (24 in total — add as many or as few as you like):

### Gojo Satoru — `gojo_*`
| File                  | Technique             | Look to generate                                   |
|-----------------------|-----------------------|----------------------------------------------------|
| `gojo_blue.webm`      | Cursed Technique: Blue| imploding sphere of cyan-blue energy sucking inward |
| `gojo_red.webm`       | Reversal: Red         | violent outward shove of red-orange energy          |
| `gojo_flame.webm`     | Cursed Flame          | roaring blue flame column                            |
| `gojo_purple.webm`    | Hollow Purple (ULT)   | huge violet beam, blue+red halos merging into it    |
| `gojo_void.webm`      | Unlimited Void (DOMAIN)| endless blue-white space, rings, infinite tunnel    |

### Ryomen Sukuna — `sukuna_*`
| File                   | Technique            | Look to generate                                  |
|------------------------|----------------------|---------------------------------------------------|
| `sukuna_dismantle.webm`| Dismantle            | single crisp crimson slash arc                     |
| `sukuna_cleave.webm`   | Cleave               | one heavy wide crimson cleave with sparks          |
| `sukuna_spiderweb.webm`| Spiderweb            | a fan of crimson slashes crisscrossing             |
| `sukuna_fire.webm`     | Fire Arrow (ULT)     | a lance of crimson-orange fire shooting forward    |
| `sukuna_shrine.webm`   | Malevolent Shrine (DOMAIN)| skeletal torii / shrine forming in red gloom  |

### Yuji Itadori — `yuji_*`
| File                   | Technique            | Look to generate                                  |
|------------------------|----------------------|---------------------------------------------------|
| `yuji_jab.webm`        | Cursed Jab           | sharp white impact flash + shock ring              |
| `yuji_divergent.webm`  | Divergent Fist       | impact, then a second delayed energy burst         |
| `yuji_manji.webm`      | Manji Kick           | heavy ground-shaking impact, dust + sparks         |
| `yuji_blackflash.webm` | Black Flash (ULT)    | black-red distorted lightning crack on impact      |
| `yuji_barrage.webm`    | Black Flash Barrage (DOMAIN)| rapid chain of black-red flashes          |

### Megumi Fushiguro — `megumi_*`
| File                    | Technique           | Look to generate                                  |
|-------------------------|---------------------|---------------------------------------------------|
| `megumi_dogs.webm`      | Divine Dogs         | two shadow-beasts lunging from a dark pool         |
| `megumi_nue.webm`       | Nue                 | shadowy winged shikigami, crackling indigo sparks  |
| `megumi_serpent.webm`   | Great Serpent       | long shadow serpent striking forward               |
| `megumi_elephant.webm`  | Max Elephant (ULT)  | enormous torrent of water blasting outward         |
| `megumi_garden.webm`    | Chimera Shadow Garden (DOMAIN)| spreading liquid-shadow field, hands rising |

## Prompt cheat-sheet (paste into Higgsfield etc.)

**Base style prefix** — start every prompt with this so the set stays consistent:

> *MAPPA-style anime cursed-energy VFX, 2D cel shading with crisp linework,
> dramatic rim light, motion smears and impact frames, particles and embers,
> volumetric smoke, on a **pure black background**, energy element only — no
> character, no text, no logo — centered, loopable ~1.5s, 4K detailed.*

Then append the per-technique look from the tables above, e.g.:

> `…energy element only… ` **+** `imploding sphere of cyan-blue cursed energy spiraling and crushing inward, bright core, thin blue arcs.`

Tips for a cohesive set:
- Lock the palette per character (Gojo cyan/violet, Sukuna crimson/orange,
  Yuji white→black-red, Megumi indigo/shadow).
- Ask for **"energy on black, no background, no character"** explicitly — that
  keeps the screen-blend clean.
- Keep the action centered and front-loaded; the game centers the clip and
  auto-hides it when it ends.

Everything here is original VFX direction for this fan project — generate your
own assets; don't reuse copyrighted frames or official logos.
