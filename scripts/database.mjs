import './setup.mjs';
import { spawn } from 'node:child_process';
const child = spawn(
  'docker',
  ['compose', '-f', 'compose.workbench.yml', 'up', '-d', '--wait', '--wait-timeout', '180'],
  { stdio: 'inherit', windowsHide: true },
);
child.on('exit', (code) => process.exit(code ?? 1));
