import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {resolve, relative, join} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const read=(p)=>readFileSync(join(root,p),'utf8');
const pkg=JSON.parse(read('package.json'));
const manifest=JSON.parse(read('www/manifest.webmanifest'));
function files(folder){
 const out=[];
 const visit=(dir)=>{for(const n of readdirSync(dir)){
  const p=join(dir,n); if(statSync(p).isDirectory())visit(p);else out.push(relative(folder,p));
 }};visit(folder);return out.sort();
}

test('Web assets and Android assets are byte-for-byte identical',()=>{
 const a=resolve(root,'www'),b=resolve(root,'android/app/src/main/assets');
 assert.deepEqual(files(a),files(b));
 for(const f of files(a))assert.deepEqual(readFileSync(join(a,f)),readFileSync(join(b,f)),f);
});

test('Offline PWA is installable with local icon assets and service worker',()=>{
 assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
 assert.equal(manifest.display,'standalone');
 assert.ok(manifest.icons.some(x=>x.sizes==='192x192'));
 assert.ok(manifest.icons.some(x=>x.sizes==='512x512'));
 const page=read('www/index.html');
 assert.match(page,/rel="manifest"/);
 assert.match(page,/serviceWorker\.register\('\.\/sw\.js'\)/);
 assert.ok(read('www/sw.js').includes(`'pure-sudoku-v${pkg.version}'`));
});

test('Android retains app identity and enforces no network permission',()=>{
 const gradle=read('android/app/build.gradle.kts');
 const mf=read('android/app/src/main/AndroidManifest.xml').replace(/<!--[\s\S]*?-->/g,'');
 const activity=read('android/app/src/main/java/com/puresudoku/material/MainActivity.kt');
 assert.match(gradle,/applicationId = "com\.trishul\.sudoku"/);
 assert.match(gradle,/targetSdk = 36/);
 assert.match(gradle,/versionCode = appVersionCode/);
 assert.match(gradle,/rootProject.file\("\.\.\/package\.json"\)/);
 assert.doesNotMatch(mf,/<uses-permission/);
 assert.match(mf,/android:allowBackup="false"/);
 assert.match(activity,/blockNetworkLoads = true/);
 assert.match(activity,/loadUrl\("file:\/\/\/android_asset\/index\.html"\)/);
});

test('Publish workflow requires signing secrets and tags',()=>{
 const yaml=read('.github/workflows/release.yml');
 for(const name of ['ANDROID_KEYSTORE_BASE64','ANDROID_KEYSTORE_PASSWORD','ANDROID_KEY_ALIAS','ANDROID_KEY_PASSWORD'])assert.ok(yaml.includes(name));
 assert.match(yaml,/gh release create/);
 assert.match(yaml,/assembleRelease :app:bundleRelease/);
});


test('Android edge-to-edge, Back dispatch, and lifecycle safety are wired',()=>{
 const activity=read('android/app/src/main/java/com/puresudoku/material/MainActivity.kt');
 for(const feature of ['WindowInsets.Type.systemBars()', 'WindowInsets.Type.displayCutout()',
   'setOnApplyWindowInsetsListener', 'OnBackInvokedDispatcher', 'pureSudokuHandleBack',
   'pureSudokuOnBackground', 'pauseTimers()', 'resumeTimers()']) {
   assert.ok(activity.includes(feature), feature);
 }
 const html=read('www/index.html');
 for(const feature of ['id="modal-confirm"', 'requestNewGame(', 'aria-checked',
   'fitBoardToViewport()', 'window.pureSudokuOnBackground', 'window.pureSudokuHandleBack',
   'Check Mistakes Immediately', 'id="toggle-haptics"']) {
   assert.ok(html.includes(feature), feature);
 }
});
