const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = path.resolve(__dirname, '..');
const content = p => fs.readFileSync(path.join(base, p), 'utf8');

test('release workflow builds all three artifacts and only publishes after signature checks', () => {
  const yml = content('.github/workflows/release.yml');
  assert.match(yml, /:app:assembleRelease :app:bundleRelease/);
  assert.match(yml, /scripts\/package-pwa\.sh/);
  assert.match(yml, /apksigner.*verify/);
  assert.match(yml, /jarsigner -verify/);
  assert.match(yml, /ANDROID_KEYSTORE_BASE64/);
  assert.match(yml, /Missing Android signing secrets/);
  assert.match(yml, /gh release create/);
  assert.match(yml, /--verify-tag/);
  assert.match(yml, /SHA256SUMS.txt/);
  assert.match(yml, /grep -q 'uses-permission'/);
  assert.match(yml, /merge-base --is-ancestor/);
});

test('git excludes signing keys, locally generated ZIPs, and SDK build outputs', () => {
  const ignore = content('.gitignore');
  for (const value of ['*.jks', '*.keystore', 'dist/', '**/build/', 'android/local.properties']) {
    assert.ok(ignore.includes(value), `missing gitignore rule for ${value}`);
  }
});
