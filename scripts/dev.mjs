import { spawn } from 'node:child_process';

const children = ['dev:server', 'dev:app'].map((task) =>
  spawn('npm', ['run', task], { stdio: 'inherit', shell: true }),
);

const stop = () => children.forEach((child) => child.kill('SIGTERM'));

process.on('SIGINT', stop);
process.on('SIGTERM', stop);

children.forEach((child) =>
  child.on('exit', (code) => {
    if (code) {
      stop();
      process.exitCode = code;
    }
  }),
);