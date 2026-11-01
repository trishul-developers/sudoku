// Copies the full static offline web application into the Android APK assets.
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destination = resolve(root, 'android/app/src/main/assets/web');
rmSync(destination, {recursive:true, force:true});
mkdirSync(destination, {recursive:true});
cpSync(resolve(root,'www'),destination,{recursive:true});
console.log('Synced offline web assets into Android app.');
