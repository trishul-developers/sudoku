const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const E = require('../www/js/engine.js');
const ctx = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../www/js/puzzles.js'),'utf8'),ctx);
const bank = JSON.parse(JSON.stringify(ctx.window.SUDOKU_PUZZLES));
const levels = ['easy','medium','hard','expert'];

test('32 original puzzles are valid, distinct, and have exactly one solution', () => {
  const keys = new Set();
  assert.deepEqual(Object.keys(bank), levels);
  for (const level of levels) {
    assert.equal(bank[level].length, 8);
    for (const {puzzle,solution} of bank[level]) {
      assert.equal(puzzle.length,81); assert.equal(solution.length,81);
      assert.ok(E.validPuzzle(puzzle,solution), `invalid ${level}: ${puzzle}`);
      assert.equal(E.countSolutions([...puzzle].map(Number),2),1);
      assert.ok(!keys.has(puzzle), 'duplicate template'); keys.add(puzzle);
    }
  }
});

test('difficulty targets have distinct givens', () => {
  const ranges = { easy:[43,47], medium:[36,41], hard:[30,35], expert:[24,29] };
  for (const level of levels) for (const {puzzle} of bank[level]) {
    const n = [...puzzle].filter(x => x !== '0').length;
    const [min,max] = ranges[level];
    assert.ok(n >= min && n <= max, `${level} unexpectedly has ${n} givens`);
  }
});

test('randomized transforms preserve givens, unique solutions and correctness', () => {
  for (const level of levels) for (let i=0;i<20;i++) {
    const {puzzle,solution} = E.pickPuzzle(bank,level);
    assert.ok(E.validPuzzle(puzzle,solution), `${level} transform invalid`);
    const originals = bank[level][0].puzzle.replace(/0/g,'').length;
    assert.equal(puzzle.replace(/0/g,'').length, originals);
  }
});

test('solution checker, input candidates, conflicts and logical hints', () => {
  const item = bank.easy[0];
  const board = [...item.puzzle].map(Number);
  assert.equal(E.isComplete(board,[...item.solution].map(Number)),false);
  const i = board.indexOf(0);
  assert.ok(E.candidates(board,i).includes(Number(item.solution[i])));
  const hint = E.firstLogicalHint(board);
  assert.ok(hint);
  assert.equal(hint.value,Number(item.solution[hint.index]));
  assert.equal(E.isComplete([...item.solution].map(Number),[...item.solution].map(Number)),true);
  const j = E.peers[i].find(j => Number(item.solution[j]) !== Number(item.solution[i]));
  const conflicting = [...item.solution].map(Number);
  conflicting[i] = conflicting[j];
  assert.ok(E.conflicts(conflicting,i).includes(j));
});

test('validator rejects broken board givens, false solution, ambiguous puzzle', () => {
  const original=bank.easy[0];
  assert.equal(E.validPuzzle('0'.repeat(81), original.solution),false);
  assert.equal(E.validPuzzle(original.puzzle, original.solution.slice(0,80)+'0'),false);
  const board=[...original.puzzle].map(Number);
  const i=board.findIndex(n => n!==0);
  const j=E.peers[i].find(j => board[j]===0);
  board[j]=board[i];
  assert.equal(E.countSolutions(board),0);
});

test('offline application assets referenced by service worker are present', () => {
  const sw=fs.readFileSync(path.join(__dirname,'../www/sw.js'),'utf8');
  const assetList=[...sw.matchAll(/'\.\/([^']+)'/g)].map(x=>x[1]);
  for (const asset of assetList.filter(x=>x)) {
    assert.ok(fs.existsSync(path.join(__dirname,'../www',asset)), `missing ${asset}`);
  }
});

test('Android manifest has zero permissions, especially no Internet access', () => {
  const manifest=fs.readFileSync(path.join(__dirname,'../android/app/src/main/AndroidManifest.xml'),'utf8');
  assert.doesNotMatch(manifest,/<uses-permission\b/);
  assert.match(manifest,/android:allowBackup="false"/);
  const java=fs.readFileSync(path.join(__dirname,'../android/app/src/main/java/com/trishul/sudoku/MainActivity.java'),'utf8');
  assert.match(java,/setBlockNetworkLoads\(true\)/);
});

test('release version stays in sync across PWA cache and Android Gradle', () => {
  const project = path.join(__dirname, '..');
  const version = require('../package.json').version;
  const sw = fs.readFileSync(path.join(project, 'www/sw.js'), 'utf8');
  const gradle = fs.readFileSync(path.join(project, 'android/app/build.gradle'), 'utf8');
  assert.match(sw, new RegExp('sudoku-offline-v' + version.replaceAll('.', '\\.')));
  assert.match(gradle, /parse\(file\('\.\.\/\.\.\/package\.json'\)\)/);
  assert.match(gradle, /hasReleaseSigning/);
  assert.match(gradle, /signingConfig signingConfigs\.release/);
});
