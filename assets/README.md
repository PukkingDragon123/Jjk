# Character art (drop your fan-art here)

The app loads each sorcerer's art from this folder. It works **without** these
files (you'll see the sorcerer's initial as a placeholder), but to use your own
art, save the 4 images here with **exactly** these names:

| File                | Character        | Which image you sent |
|---------------------|------------------|----------------------|
| `assets/sukuna.jpg` | Ryomen Sukuna    | 1st photo            |
| `assets/yuji.jpg`   | Yuji Itadori     | 2nd photo            |
| `assets/gojo.jpg`   | Gojo Satoru      | 3rd photo            |
| `assets/megumi.jpg` | Megumi Fushiguro | 4th photo            |

Tips:
- `.jpg` is what the code loads. A plain background (like the art you sent)
  looks great; transparent `.png` also works if you rename it to `.jpg`'s slot
  in `js/characters.js`.
- Tall/portrait images work well — they're shown standing on the card.
- After adding the files, just refresh the page; they'll appear on the
  character-select stickers, the in-game HUD badge, and stamped on your
  captured photos.

## Optional cinematic menu background

Drop a wide image at **`assets/menu-bg.jpg`** and it appears behind the main menu
(darkened automatically for legibility). No file → the menu keeps its animated
gradient aura. A 16:9 cursed-energy key-visual (no characters / text) looks best.

## Animated technique VFX

Want generated cursed-energy clips (Higgsfield / Runway / Sora …) instead of the
built-in procedural effects? See [`vfx/README.md`](vfx/README.md) — drop
`<characterId>_<techniqueId>.webm` clips in `assets/vfx/` and they play
automatically, with the procedural VFX as a fallback.

## Using Higgsfield-generated assets in web sessions

Higgsfield stores results on a CDN (`*.cloudfront.net`). If you're running
Claude Code on the web, the sandbox can only download them when that host is in
your environment's **network egress allowlist**
([docs](https://code.claude.com/docs/en/claude-code-on-the-web)). Two ways to get
a generated asset into the repo:

1. **Allowlist the CDN** (`*.cloudfront.net`) in the environment's network
   settings, then I can fetch + optimise + wire it in automatically.
2. **Download it yourself** from the Higgsfield widget and save it here with the
   expected name (e.g. `menu-bg.jpg`, or a `vfx/<char>_<tech>.webm`).
