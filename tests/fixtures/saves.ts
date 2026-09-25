import { readdirSync, readFileSync } from 'node:fs';

/** #115: the frozen saves in tests/fixtures/saves, one per save format (and per release that wrote a format differently). */
const DIR = new URL('./saves/', import.meta.url);
export const SAVE_FIXTURES = readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();
export const readFixture = (f: string) => JSON.parse(readFileSync(new URL(f, DIR), 'utf8')) as Record<string, unknown>;
/** The save a release wrote, for example oldSave('v0.3.1'). */
export const oldSave = (release: string) => readFixture(SAVE_FIXTURES.find((f) => f.endsWith(`-${release}.json`))!);
