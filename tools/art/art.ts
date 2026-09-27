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
