/**
 * Spawn and kill a whole process tree, not just the direct child. #179: `npx vite preview` starts vite as its own
 * child process (not merged into npx), so on Linux killing only the npx PID left the vite server running. On
 * Windows the same risk exists whenever `shell: true` puts a cmd.exe between us and the real process.
 *
 * POSIX: `detached: true` makes the child the leader of a new process group; any process it spawns inherits that
 * group, so `process.kill(-pid)` (a negative pid means "the whole group") reaches every descendant in one signal.
 * Windows has no process groups; `taskkill /T` walks the tree it does track, which already covered this case.
 */
import { spawn, spawnSync } from 'node:child_process';

export function spawnTree(command, args, opts = {}) {
  return spawn(command, args, { ...opts, detached: process.platform !== 'win32' });
}

/** Kills `child` and everything it spawned. Safe to call more than once, and after the child already exited. */
export function killTree(child) {
  if (!child || child.exitCode !== null) return;
  try {
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    else process.kill(-child.pid, 'SIGKILL');
  } catch {
    // already gone
  }
}

/** Waits until `url` answers, up to PLAY_SERVER_WAIT_MS (default 60 s, a busy PC starts vite slowly); exits with an error if it never does. */
export async function waitForServer(url, port) {
  const limit = Number(process.env.PLAY_SERVER_WAIT_MS ?? 60000);
  const start = Date.now();
  while (Date.now() - start < limit) {
    if (await fetch(url).then(() => true, () => false)) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  console.error(`preview server didn't start on port ${port} within ${Math.round(limit / 1000)} s`);
  process.exit(1);
}
