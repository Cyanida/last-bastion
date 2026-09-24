/**
 * v0.7.1 What's new: the top entry of CHANGELOG.md reduced to its main points. Pure; vite.config.ts runs it at build time and bakes the
 * result in as __WHATS_NEW__. The points are the entry's top-level bullets that open with a bold name, each cut to that name and its
 * first clause (up to the first full stop, colon or semicolon); a name with `code` in it is a developer line and is left out. ponytail: "main points" = the first MAX_POINTS in the
 * changelog's own order, so whoever writes the entry decides what leads.
 */
export interface WhatsNew {
  version: string; // "0.7.1", no v
  title: string; // the entry's theme, after the dash
  intro: string; // the first sentence of its opening paragraph
  points: { name: string; text: string }[];
  more: number; // points left off the screen
}

export const MAX_POINTS = 10;

const plain = (s: string) => s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\*\*|`/g, '').replace(/\*([^*]+)\*/g, '$1').trim();
const firstSentence = (s: string) => (s.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? s).trim();
const firstClause = (s: string) => firstSentence(s).replace(/[:;]\s.*$/, '').replace(/[.!?]$/, '');

export function whatsNew(changelog: string): WhatsNew | null {
  const lines = changelog.split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith('## '));
  const head = lines[start]?.match(/^## v?(\d+\.\d+\.\d+\S*)(?:\s+[—–-]\s+(.+))?\s*$/);
  if (!head) return null;
  const end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
  const entry = lines.slice(start + 1, end < 0 ? undefined : end);
  const intro = entry.find((l) => l.trim() && !/^\s*([-*#]|\d+\.)/.test(l)) ?? '';
  const points = entry.flatMap((l) => {
    const m = l.match(/^[-*] \*\*(.+?)\*\*[:.]?\s*(.*)$/);
    return m && !m[1].includes('`') ? [{ name: plain(m[1]), text: firstClause(plain(m[2])) }] : [];
  });
  return { version: head[1], title: head[2] ?? '', intro: firstSentence(plain(intro)), points: points.slice(0, MAX_POINTS), more: Math.max(0, points.length - MAX_POINTS) };
}

/**
 * Open What's new on this start? Once per version, and only when the build's entry is this version. A first start ever (nothing seen,
 * nothing played) has nothing to compare with: it only marks the version seen.
 */
export const showWhatsNewNow = (seen: string | null, entry: string | undefined, app: string, played: boolean): boolean =>
  entry === app && seen !== app && (seen !== null || played);
