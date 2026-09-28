// #179: the play and perf tests' preview server left its own child (vite, spawned by npx) running on Linux once the
// script exited, because killing only the direct child never reached its grandchild. This proves the shared helper
// (scripts/lib/process-tree.mjs) kills a whole spawned tree, the way the preview server's npx -> vite tree needs.
import { describe, expect, it } from 'vitest';
import { spawnTree, killTree } from '../scripts/lib/process-tree.mjs';

const alive = (pid: number) => {
  try {
    process.kill(pid, 0); // signal 0: no-op, throws if the pid is gone
    return true;
  } catch {
    return false;
  }
};

describe('process-tree (#179)', () => {
  it('kills a spawned process and the child it spawns, like npx spawning vite', async () => {
    // a small parent that spawns its own long-running child and reports both pids, mirroring npx -> vite
    const script = `
      const { spawn } = require('node:child_process');
      const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
      process.stdout.write(JSON.stringify({ parent: process.pid, child: child.pid }));
      setInterval(() => {}, 1000);
    `;
    const proc = spawnTree(process.execPath, ['-e', script], { stdio: ['ignore', 'pipe', 'ignore'] });
    const pids = await new Promise<{ parent: number; child: number }>((resolve, reject) => {
      let out = '';
      proc.stdout!.on('data', (d: Buffer) => (out += d));
      proc.on('error', reject);
      const timer = setInterval(() => {
        const m = out.match(/\{.*\}/);
        if (m) {
          clearInterval(timer);
          resolve(JSON.parse(m[0]));
        }
      }, 20);
      setTimeout(() => {
        clearInterval(timer);
        reject(new Error(`grandchild never reported its pid (got: ${out})`));
      }, 5000);
    });

    expect(alive(pids.parent)).toBe(true);
    expect(alive(pids.child)).toBe(true);

    killTree(proc);
    await new Promise((r) => setTimeout(r, 500)); // taskkill / signal delivery is not instant

    expect(alive(pids.parent)).toBe(false);
    expect(alive(pids.child)).toBe(false); // the part that broke on Linux: the grandchild used to survive
  });

  it('does nothing when the process already exited', async () => {
    const proc = spawnTree(process.execPath, ['-e', 'process.exit(0)'], { stdio: 'ignore' });
    await new Promise((resolve) => proc.on('exit', resolve));
    expect(() => killTree(proc)).not.toThrow();
  });
});
