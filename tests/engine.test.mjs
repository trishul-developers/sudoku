import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('../www/index.html', import.meta.url),'utf8');
const start=html.indexOf('      const ALL_MASK = 0x1FF;');
const end=html.indexOf('      let audioCtx = null;',start);
assert.ok(start>0 && end>start, 'Embedded Gemini generator must remain intact');
const context={Int32Array,Uint8Array,Date,Math,console};
vm.runInNewContext(html.slice(start,end)+`\nglobalThis.puzzleApi = {countSolutions,generatePuzzle,createRNG};`,context,{timeout:1000});
const {countSolutions,generatePuzzle}=context.puzzleApi;

function isValidSudoku(grid){
 assert.equal(grid.length,81);
 const groups=[];
 for(let i=0;i<9;i++) {
  groups.push(Array.from({length:9},(_,j)=>grid[i*9+j]));
  groups.push(Array.from({length:9},(_,j)=>grid[j*9+i]));
  const r=Math.floor(i/3)*3,c=(i%3)*3;
  groups.push(Array.from({length:9},(_,j)=>grid[(r+Math.floor(j/3))*9+c+j%3]));
 }
 for(const g of groups)assert.deepEqual([...g].sort(),[1,2,3,4,5,6,7,8,9]);
}

test('Gemini generator produces valid unique puzzles across all modes', {timeout:30000},()=>{
 for(const diff of ['easy','medium','hard','expert','daily']){
  const {puzzle,solution}=generatePuzzle(diff);
  isValidSudoku(solution);
  assert.equal(puzzle.length,81);
  assert.ok(puzzle.some(d=>d===0));
  for(let i=0;i<81;i++)if(puzzle[i])assert.equal(puzzle[i],solution[i]);
  assert.equal(countSolutions(Int32Array.from(puzzle),2),1,`${diff} uniqueness`);
 }
});

test('Daily Challenge is deterministic on the same local calendar date',()=>{
 const a=generatePuzzle('daily');
 const b=generatePuzzle('daily');
 assert.deepEqual(a.puzzle,b.puzzle);
 assert.deepEqual(a.solution,b.solution);
});

test('Invalid Sudoku board is rejected',()=>{
 const invalid=new Int32Array(81);
 invalid[0]=5; invalid[1]=5;
 assert.equal(countSolutions(invalid,2),0);
});

test('Inline application JavaScript parses without syntax errors',()=>{
 for(const [,script] of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(script);
});
