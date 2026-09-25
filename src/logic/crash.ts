/** v0.7.5 (#106): the text the error overlay shows, for a bug report: the version, the message and the first lines of the stack. */
export const CRASH_STACK_LINES = 6;

export function crashReport(error: unknown, version: string): string {
  const e = error instanceof Error ? error : null;
  const message = e ? `${e.name}: ${e.message}` : String(error);
  const stack = e?.stack?.split('\n').filter((l) => l.trim() && !l.includes(e.message)).slice(0, CRASH_STACK_LINES).map((l) => l.trim()) ?? [];
  return [`Last Bastion v${version}`, message, ...stack].join('\n');
}
