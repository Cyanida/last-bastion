/**
 * #155: renders every rigged sprite.   npm run art
 * Each tools/art/sprites/<id>.ts exports `sprite` and becomes public/sprites/<id>.png (the sheet: a row per animation, a column
 * per frame) and src/render/sheets/<id>.json (its frame data). One file per sprite in and out, no shared index: the game finds
 * the sheets by globbing src/render/sheets. The same definition always gives the same bytes; tests/v8-art-sheets.test.ts
 * fails when a committed sheet is out of date.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { buildProps, propPaths } from './props';
import { buildSheet, loadDefs, sheetJson, sheetPaths } from './sheet';
import { buildIcons, iconPaths } from './ui/icons';
import { buildKeep, keepPaths } from './ui/keep';
import { buildWorld, worldPaths } from './ui/world';

mkdirSync('public/sprites', { recursive: true });
mkdirSync('src/render/sheets', { recursive: true });
for (const def of await loadDefs()) {
  const { png, data } = buildSheet(def);
  const p = sheetPaths(def.id);
  writeFileSync(p.png, png);
  writeFileSync(p.json, sheetJson(data));
  console.log(`${def.id}: ${p.png} (${png.length} bytes), ${p.json}`);
}
const props = buildProps(); // #159: the arenas' props, one atlas
writeFileSync(propPaths.png, props.png);
writeFileSync(propPaths.json, sheetJson(props.data));
console.log(`props: ${propPaths.png} (${props.png.length} bytes), ${propPaths.json}`);
const icons = buildIcons(); // #184: the menus' icon atlas and its CSS
writeFileSync(iconPaths.png, icons.png);
writeFileSync(iconPaths.css, icons.css);
console.log(`icons: ${iconPaths.png} (${icons.png.length} bytes), ${iconPaths.css}`);
const keep = buildKeep(); // #67: the Keep's castle courtyard and its buildings, and their CSS
writeFileSync(keepPaths.castle, keep.castle);
writeFileSync(keepPaths.yard, keep.yard);
writeFileSync(keepPaths.css, keep.css);
console.log(`keep: ${keepPaths.castle} (${keep.castle.length} bytes), ${keepPaths.yard} (${keep.yard.length} bytes), ${keepPaths.css}`);
const world = buildWorld(); // #198: the world map and the clouds over each realm, and their CSS
writeFileSync(worldPaths.map, world.map);
writeFileSync(worldPaths.clouds, world.clouds);
writeFileSync(worldPaths.css, world.css);
console.log(`world: ${worldPaths.map} (${world.map.length} bytes), ${worldPaths.clouds} (${world.clouds.length} bytes), ${worldPaths.css}`);
