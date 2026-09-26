# Last Bastion art style

Every character, foe, boss and siege piece is drawn the same way: by the rig in this folder, never by hand. The Paladin
(`sprites/paladin.ts`) is the approved reference; when in doubt, match him.

## How a sprite is made

- One file per sprite: `tools/art/sprites/<id>.ts` exports `sprite: SpriteDef` (see `sheet.ts`). `<id>` is the game's sprite id
  (`SPRITES` in `src/render/sprites.ts`), so the sheet replaces that letter grid by itself.
- A sprite is a `Figure` of parts on bones (`rig.ts`). A part is a polygon in its bone's local space, with a material and a depth `z`
  (higher is in front). A pose function places the bones from a few numbers (hip offset, lean, feet, fist, weapon angle); arms and
  legs reach their targets with `ik()`, and `limb()` points a bone from one joint to the next.
- Every frame is rendered from scratch from its pose. Never nudge pixels in a frame, and never edit a PNG: change the pose or the parts.
- `npm run art` writes `public/sprites/<id>.png` (a row per animation, a column per frame) and `src/render/sheets/<id>.json`. Commit
  both. The same definition always gives the same bytes; `tests/v8-art-sheets.test.ts` fails when a committed sheet is out of date.
- Check your work in the game: Settings, test mode (`?dev=1`), **Sprite gallery** plays every sheet's animations side by side.

## Light and colour

- The light comes from the **top left**, towards the viewer. Each part is shaded as a rounded form (`profile: 'round'`); use
  `'flat'` only for thin things like cloth edges and trails.
- Every material has a **7-tone ramp** in `RAMPS`: outline, deep shadow, shadow, mid, light, highlight, glint. Shadows lean **cool**,
  highlights **warm**. Metals (steel, dark steel, gold) get glints where the light reflects straight back. Add a material by adding a
  ramp in the same shape; don't draw a colour that isn't in a ramp.
- **Outline:** 1 px around the silhouette, in the darkest tone of the part next to it (never pure black).
- **Far-side limbs** are one tone darker (`dim: 1`); a part in front casts a 1 px shadow down and right onto the part behind.
- **Surface detail** comes from the part options, not from hand pixels: `folds` for cloth, `mail` for chainmail, `trim` for an edge
  band in another material, `details` for single pixels such as rivets, eye slits and emblems.

## Size and framing

- 1 art pixel = 1 world pixel. **People are about 6 heads tall and 50-58 px** (the Paladin: 55).
- Bigger bodies get a target size when their issue draws them: riders and beasts, siege engines and bosses each get a height written in
  their definition file's comment, measured against the Paladin.
- Sprites face **right**; the game flips them. The cell leaves room for the swing trail. `anchor` is the ground point between the feet;
  `tall` is the figure's height.

## Animations

| Animation | Frames | Time per frame |
|---|---|---|
| idle | 4 | about 200 ms: breathing, the cape and plume sway |
| walk | 8 | about 100 ms; the game matches the cycle to the speed |
| attack | 5-6: ready, wind-up, swing with its trail, impact (held longest), recovery | set per frame |
| hurt | 1-2 | short: knocked back, head snaps back |
| death | 4-6 | the last frame held |

- `impact` is the attack frame where the weapon connects: the game shows it at the moment the hit lands and squeezes the other frames
  to fit the attack speed.
- Wind-ups read big: lean back, weapon high. The impact frame leans into the blow with the feet planted.
- **Trails** (the swing smear, `outline: false`, flat) take the colour of the damage type: holy gold-white (`glow` + `smear`, the
  Paladin), physical pale steel, fire orange, shadow purple, poison green, frost pale blue. Add the ramp if it is missing.
