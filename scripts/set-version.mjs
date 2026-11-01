// Usage: npm run version:set -- 1.0.1
// Keeps PWA SW cache, package and native version (derived from package) in sync.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const version = process.argv[2];
if (!version || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
  console.error('Usage: npm run version:set -- MAJOR.MINOR.PATCH');
  process.exitCode = 1;
} else {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const packageFile = resolve(root, 'package.json');
  const swFile = resolve(root, 'www/sw.js');
  const pkg = JSON.parse(readFileSync(packageFile, 'utf8'));
  const sw = readFileSync(swFile, 'utf8');
  if (!/const VERSION = 'sudoku-offline-v\d+\.\d+\.\d+';/.test(sw)) {
    throw new Error('Unexpected service worker version declaration; version unchanged');
  }
  pkg.version = version;
  writeFileSync(packageFile, JSON.stringify(pkg, null, 2) + '\n');
  writeFileSync(swFile, sw.replace(/const VERSION = 'sudoku-offline-v\d+\.\d+\.\d+';/, `const VERSION = 'sudoku-offline-v${version}';`));
  console.log(`Updated package and service-worker version to ${version}. Run npm run check.`);
}
