import { spawn } from 'node:child_process';
<<<<<<< HEAD

const children = ['dev:server', 'dev:app'].map((task) =>
  spawn('npm', ['run', task], { stdio: 'inherit', shell: true }),
);

const stop = () => children.forEach((child) => child.kill('SIGTERM'));

process.on('SIGINT', stop);
process.on('SIGTERM', stop);

=======
const children = ['dev:server', 'dev:app'].map((task) =>
  spawn('npm', ['run', task], { stdio: 'inherit' }),
);
const stop = () => children.forEach((child) => child.kill('SIGTERM'));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
>>>>>>> 86095ba4b22459c5703fc305861ae0c76432fe97
children.forEach((child) =>
  child.on('exit', (code) => {
    if (code) {
      stop();
      process.exitCode = code;
    }
  }),
<<<<<<< HEAD
);
=======
);
>>>>>>> 86095ba4b22459c5703fc305861ae0c76432fe97
