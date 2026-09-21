// npm run dev:electron — Vite dev server + the Electron shell pointed at it (hot reload works as in the browser).
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'vite';

const server = await createServer({ server: { port: 5199, strictPort: false } });
await server.listen();
const url = server.resolvedUrls?.local[0] ?? 'http://localhost:5199/';
const electron = createRequire(import.meta.url)('electron'); // path to the binary
const child = spawn(electron, ['.'], { stdio: 'inherit', env: { ...process.env, LB_DEV_URL: url } });
child.on('exit', async () => {
  await server.close();
  process.exit(0);
});
