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

## Animated technique VFX

Want generated cursed-energy clips (Higgsfield / Runway / Sora …) instead of the
built-in procedural effects? See [`vfx/README.md`](vfx/README.md) — drop
`<characterId>_<techniqueId>.webm` clips in `assets/vfx/` and they play
automatically, with the procedural VFX as a fallback.
