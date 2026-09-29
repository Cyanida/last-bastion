// tests/v8-preview-server.test.ts imports the plain-JS process-tree.mjs (it must stay runnable by `node` directly,
// with no build step, since play-test.mjs and perf-test.mjs are); this is its type declaration for that import.
import type { ChildProcess, SpawnOptions } from 'node:child_process';

export function spawnTree(command: string, args: readonly string[], opts?: SpawnOptions): ChildProcess;
export function killTree(child: ChildProcess | null | undefined): void;
export function waitForServer(url: string, port: number): Promise<void>;
