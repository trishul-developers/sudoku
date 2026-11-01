import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(root, 'android/app/src/main/assets');
rmSync(target, {recursive: true, force: true});
mkdirSync(target, {recursive: true});
cpSync(resolve(root, 'www'), target, {recursive: true});
console.log('Synchronized Pure Sudoku PWA into Android assets.');
