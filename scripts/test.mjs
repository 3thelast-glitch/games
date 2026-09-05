import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const files = readdirSync('tests')
  .filter((file) => /\.test\.tsx?$/.test(file))
  .map((file) => `tests/${file}`);
const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...files], {
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
