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
- Sprites face **right**; the game flips them. The cell leaves room for the swing trail; where a pose still reaches past it (a wide swing, a fallen body, a burst of fire),
  the sheet grows the cell on that side and moves the anchor with it, so no frame is cut off (#167, `tests/v8-cell-clip.test.ts`). `anchor` is the ground point between the feet;
  `tall` is the figure's height.

## Animations

| Animation | Frames | Time per frame |
|---|---|---|
| idle | 4 | about 200 ms: breathing, the cape and plume sway |
| walk | 8 | about 100 ms; the game matches the cycle to the speed |
| attack | 5-6: ready, wind-up, swing with its trail, impact (held longest), recovery | set per frame |
| hurt | 1-3 | short: knocked back, head snaps back (the Viking, #247: takes the blow and keeps going) |
| death | 4-6 | the last frame held |

- `impact` is the attack frame where the weapon connects: the game shows it at the moment the hit lands and squeezes the other frames
  to fit the attack speed.
- Wind-ups read big: lean back, weapon high. The impact frame leans into the blow with the feet planted.
- **Trails** (the swing smear, `outline: false`, flat) take the colour of the damage type: holy gold-white (`glow` + `smear`, the
  Paladin), physical pale steel, fire orange, shadow purple, poison green, frost pale blue. Add the ramp if it is missing.

## UI

The menus' new look (v0.9, #184, #185): Kingdom Rush and Survivor.io chunky, in the game's night palette. Frames and buttons are CSS
(`src/ui/kit.css`), icons come from the rig's atlas (`tools/art/ui/icons.ts`), and screens build their markup with the helpers in
`src/ui/kit.ts` (`button`, `ribbon`, `frame`, `parch`, `rarityIcon`, `pill`, `row`, `tabs` with `wireTabs`, `toggle`, `slider`,
`closeButton`, `icon`). `docs/review/0.9.0/kit-sheet.png` shows every piece (`node scripts/ui-previews.mjs` after a build).

**Palette tokens** (`:root` in kit.css):

| Token | Colour | Used for |
|---|---|---|
| `--kit-wood` / `--kit-wood-dark` / `--kit-wood-edge` | `#4a2e1a` / `#24150b` / `#120a05` | frames, wood buttons, the tab bar, their dark outer edge |
| `--kit-brass` / `--kit-brass-light` / `--kit-brass-dark` | `#d9a93a` / `#fbe38a` / `#6b3b12` | the inner line, rivets, knobs, focus rings, pill rims |
| `--kit-parch` / `--kit-parch-dark` | `#ecdcb0` / `#cfb57a` | parchment and list rows |
| `--kit-ink` | `#2a1d10` | text on parchment |
| `--kit-light` | `#f7eed2` | text on wood and on green |

Gold and green buttons and the ribbon draw their gradients mostly from the rig's `gold`/`glow`, `venom` and `red` ramps, so the menus and
the sprites share one palette. A new colour goes in as a token or a ramp, never loose in a screen.

**Type.** Cinzel (`--kit-num`) at **800** for buttons, tabs, pills and row titles, **900** for big buttons and ribbons, with numbers in
lining, tabular figures. Alegreya Sans (`--body`) for anything you read. The blackletter (`--title`) only on the title. No new font files.

**Frame anatomy.** `.kit-frame`: dark wood with a fine vertical grain, a 3 px `--kit-wood-edge` border, a 2 px brass line inset 5 px, a
brass rivet in each corner, and a drop shadow. Anything you read sits on `.kit-parch` inside it. No flat rectangles.

**Button anatomy.** `.kit-btn`: a 2 px dark border, a light top edge and a dark bottom edge for the bevel, and a solid lip under it for
depth. Pressed (`:active` or `.pressed`), it sinks 4 px onto its lip. Disabled, it goes grey and stays put. Sizes: `.big` for the screen's
main action, normal, `.small` inside panels and rows. On touch every button is at least 44 px.

**Which button.**
- **gold** (`kind: 'gold'`): the one main action of the screen. **One main button per screen**: if two things want gold, one of
  them isn't the main action.
- **go** (green): a go, start or take that isn't the main action (Daily Trial, Take on a relic row, PLAY next to Loadout).
- **wood** (the default): everything else: menus, Loadout, Back, Settings.
- **`closeButton`** (a round wood disc with a brass rim): close (×) or back (←) in a panel's corner, never a text button for that.

**Rarity colours.** Every relic icon sits in a `.kit-rarity` frame of its rarity: **common** stone `#9b917d`, **rare** blue `#6f9fe0`,
**legendary** orange `#f0913a` with a glow, **class** green `#6fc26b`, **signature** gold `#f6d97a` with a glow. The atlas has a gem per
rarity (`i-common` ... `i-signature`) for labels and filters.

**The rest.** `.kit-ribbon`: a red band with notched tails for a name or heading. `.kit-pill`: a currency, its icon overlapping the left
end. `.kit-tabs`: the tab bar (`MAIN_TABS`: Map, Champion, Keep, Relics, Deeds); the open tab is gold and lifts. `.kit-row`: a list row or
card on parchment with a leading icon and a trailing button or number; `.on` picked, `.locked` greyed. `.kit-toggle` and `.kit-slider`:
Settings, brass knobs on dark wood, green when on.

**Icons.** 20 px cells, drawn like the sprites (same light, ramps and outlines), one row in `public/sprites/ui-icons.png`, a class each
(`kit-icon i-<id>`) in the generated `src/ui/icons.css`; `--s` scales them, and whole steps stay crisp. New icons go at the end of
`ICONS`, and `ICON_IDS` in kit.ts lists them in the same order (a test checks it). Nothing may touch its cell's edge.
