const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function boot(existing = new Map()) {
  const elements = new Map(), callbacks = new Map();
  function element(tag = 'div') {
    const attrs = new Map(), handlers = {};
    const classes = new Set();
    const el = {
      tagName:tag.toUpperCase(), children:[], dataset:{}, style:{}, textContent:'', className:'', disabled:false, hidden:false,
      checked:false, open:false, tabIndex:0, title:'',
      classList:{ add(...items){items.forEach(x => classes.add(x));}, toggle(k,v){if(v) classes.add(k); else classes.delete(k);}, contains(k){return classes.has(k);} },
      setAttribute(n,v){attrs.set(n,String(v));}, getAttribute(n){return attrs.get(n)},
      appendChild(child){this.children.push(child);return child},
      replaceChildren(...kids){this.children=kids},
      addEventListener(n,cb){(handlers[n] ||= []).push(cb)},
      fire(n,e={}){(handlers[n] || []).forEach(fn => fn(e))},
      click(){this.fire('click',{preventDefault(){}})},
      focus(){this.fire('focus')}, querySelector(){return {setAttribute(){}}},
      showModal(){this.open=true}, close(){this.open=false},
      closest(){return null}
    };
    return el;
  }
  function get(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)}
  get('new-form').elements = { difficulty:{value:'easy'} };
  get('win-dialog').tagName = 'DIALOG';
  const document = {
    getElementById:get, createElement:element, documentElement:{dataset:{}},
    querySelectorAll(){return []}, querySelector(q){return q==='dialog[open]' && [...elements.values()].some(x=>x.open) ? [...elements.values()].find(x=>x.open) : null},
    addEventListener(n,fn){(callbacks[n] ||= []).push(fn)}, hidden:false
  };
  const storage={getItem(k){return existing.get(k)||null},setItem(k,v){existing.set(k,v)}};
  const sandbox = {
    document, localStorage:storage, performance:{now:()=>1000}, crypto:{getRandomValues(a){a[0]=987654321}},
    location:{protocol:'file:',hostname:''}, navigator:{},
    getComputedStyle:()=>({colorScheme:'light'}),
    setInterval(){}, setTimeout(){return 1}, clearTimeout(){},
    addEventListener(){}, matchMedia(){return {addEventListener(){}}},
  };
  sandbox.globalThis=sandbox; sandbox.window=sandbox;
  vm.createContext(sandbox);
  const files=['engine.js','puzzles.js','app.js'];
  for (const name of files) vm.runInContext(fs.readFileSync(path.join(__dirname,'../www/js',name),'utf8'),sandbox,{filename:name});
  return {get,storage,existing,sandbox,callbacks};
}
function gameState(env){return JSON.parse(env.storage.getItem('quiet-sudoku-game-v2'))}

test('game boots, renders 81 cells and 9 keypad digits, stores session',()=>{
  const env=boot();
  assert.equal(env.get('board').children.length,81);
  assert.equal(env.get('number-pad').children.length,9);
  const game=gameState(env);
  assert.equal(game.difficulty,'easy');
  assert.equal(game.board.length,81);
  assert.equal(game.paused,false);
  assert.equal(env.get('difficulty-pill').textContent,'Easy');
});

test('number input, mistake highlight, undo/redo, pencil notes, hint',()=>{
  const env=boot();let s=gameState(env);
  const empty=s.board.indexOf(0), correct=Number(s.solution[empty]), wrong=correct===1?2:1;
  env.get('board').children[empty].click();
  env.get('number-pad').children[wrong-1].click();
  s=gameState(env);
  assert.equal(s.board[empty],wrong); assert.equal(s.mistakes,1);
  assert.equal(env.get('board').children[empty].classList.contains('error'),true);
  env.get('undo-button').click(); assert.equal(gameState(env).board[empty],0);
  env.get('redo-button').click(); assert.equal(gameState(env).board[empty],wrong);
  env.get('erase-button').click(); assert.equal(gameState(env).board[empty],0);
  env.get('notes-button').click(); assert.equal(gameState(env).notesMode,true);
  env.get('number-pad').children[correct-1].click();
  assert.ok(gameState(env).notes[empty] & (1 << (correct - 1)));
  env.get('notes-button').click();
  env.get('hint-button').click();
  assert.equal(gameState(env).hints,1);
});

test('pause protects the game, resume continues, new game changes difficulty',()=>{
  const env=boot(); const before=gameState(env);
  env.get('pause-button').click(); assert.equal(gameState(env).paused,true);
  const empty=before.board.indexOf(0);
  env.get('number-pad').children[0].click(); assert.equal(gameState(env).board[empty],0);
  env.get('resume-button').click(); assert.equal(gameState(env).paused,false);
  env.get('new-button').click(); assert.equal(env.get('new-dialog').open,true);
  assert.equal(gameState(env).paused,true);
  env.get('new-form').elements.difficulty.value='expert';
  env.get('new-form').fire('submit',{preventDefault(){}});
  assert.equal(gameState(env).difficulty,'expert'); assert.equal(gameState(env).paused,false);
});

test('session restores as paused and settings survive restart',()=>{
  const memory=new Map(), a=boot(memory);
  a.get('errors-toggle').checked=false; a.get('errors-toggle').fire('change',{target:{checked:false}});
  const initial=gameState(a);
  a.get('pause-button').click();
  const b=boot(memory);
  const restored=gameState(b);
  assert.equal(b.get('pause-cover').hidden,false);
  assert.equal(restored.paused,true);
  assert.equal(restored.puzzle,initial.puzzle);
  assert.equal(b.get('errors-toggle').checked,false);
});

test('solving puzzle updates win dialog and lifetime stats only once',()=>{
  const env=boot();
  const original=gameState(env);
  for(let i=0;i<81;i++) if(original.board[i]===0){
    env.get('board').children[i].click();
    env.get('number-pad').children[Number(original.solution[i])-1].click();
  }
  const result=gameState(env);
  assert.equal(result.won,true);
  assert.equal(env.get('win-dialog').open,true);
  assert.equal(env.get('progress-label').textContent,'81 / 81');
  assert.equal(JSON.parse(env.storage.getItem('quiet-sudoku-stats-v2')).solved,1);
  env.get('hint-button').click();
  assert.equal(JSON.parse(env.storage.getItem('quiet-sudoku-stats-v2')).solved,1);
});
