import { spawn } from 'node:child_process';
import http from 'node:http';

const VITE_PORT = 5173;
const VITE_URL = `http://localhost:${VITE_PORT}`;

function run(command, args, options = {}) {
  return spawn(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });
}

function runOnce(command, args) {
  return new Promise((resolve, reject) => {
    const child = run(command, args);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
      }
    });
  });
}

function killProcessTree(child) {
  if (!child || child.killed || child.pid === undefined) {
    return;
  }
  if (process.platform === 'win32') {
    // child was spawned with { shell: true } on Windows, so child.kill() only
    // terminates the cmd.exe wrapper — the real vite/electron process it spawned
    // keeps running orphaned. taskkill /T kills the whole process tree instead.
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F']);
  } else {
    child.kill();
  }
}

function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const request = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      request.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }
        setTimeout(check, 300);
      });
    };
    check();
  });
}

async function main() {
  console.log('[dev] Compiling Electron main/preload...');
  await runOnce('npx', ['tsc', '-p', 'electron/tsconfig.json']);

  console.log('[dev] Starting Vite dev server...');
  const vite = run('npx', ['vite', '--port', String(VITE_PORT), '--strictPort']);

  await waitForServer(VITE_URL);
  console.log('[dev] Vite ready. Launching Electron...');

  const electronProcess = run('npx', ['electron', '.'], {
    env: { ...process.env, ELECTRON_RENDERER_URL: VITE_URL },
  });

  const shutdown = (exitCode = 0) => {
    killProcessTree(vite);
    killProcessTree(electronProcess);
    process.exit(exitCode);
  };

  electronProcess.on('exit', (code) => shutdown(code ?? 0));
  vite.on('exit', (code) => {
    if (code !== null && code !== 0) {
      shutdown(code);
    }
  });

  process.on('SIGINT', () => shutdown(0));
  process.on('SIGTERM', () => shutdown(0));
}

main().catch((error) => {
  console.error('[dev] Failed:', error);
  process.exit(1);
});
