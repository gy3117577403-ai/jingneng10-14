import { spawn } from 'node:child_process';
const children = [
  spawn(process.execPath, ['--import', 'tsx', '--watch', 'backend/src/server.ts'], {
    stdio: 'inherit',
    windowsHide: true,
  }),
  spawn(
    process.execPath,
    ['node_modules/vite/bin/vite.js', '--config', 'frontend/vite.config.ts', 'frontend'],
    { stdio: 'inherit', windowsHide: true },
  ),
];
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    children.forEach((c) => c.kill());
    process.exit();
  });
