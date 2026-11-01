/* Sudoku core: no dependencies, no network, deterministic puzzle validation. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SudokuEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const SIZE = 81;
  const peers = Array.from({ length: SIZE }, (_, i) => {
    const r = Math.floor(i / 9), c = i % 9;
    const set = new Set();
    for (let k = 0; k < 9; k++) { set.add(r * 9 + k); set.add(k * 9 + c); }
    const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
    for (let y = br; y < br + 3; y++) for (let x = bc; x < bc + 3; x++) set.add(y * 9 + x);
    set.delete(i);
    return [...set];
  });
  const units = [];
  for (let k = 0; k < 9; k++) {
    units.push(Array.from({length: 9}, (_, j) => k * 9 + j));
    units.push(Array.from({length: 9}, (_, j) => j * 9 + k));
  }
  for (let br = 0; br < 3; br++) for (let bc = 0; bc < 3; bc++)
    units.push(Array.from({length: 9}, (_, j) => (br * 3 + Math.floor(j / 3)) * 9 + bc * 3 + j % 3));
  function digits(str) { return typeof str === 'string' && /^[0-9]{81}$/.test(str); }
  function candidates(board, index) {
    if (board[index] !== 0) return [];
    const seen = new Set(peers[index].map(i => board[i]));
    const result = [];
    for (let n = 1; n <= 9; n++) if (!seen.has(n)) result.push(n);
    return result;
  }
  function countSolutions(board, limit = 2) {
    if (!Array.isArray(board) || board.length !== 81 || board.some(v => !Number.isInteger(v) || v < 0 || v > 9)) return 0;
    const b = board.slice();
    // Reject duplicate givens before search.
    for (let i = 0; i < SIZE; i++) if (b[i] && peers[i].some(j => b[j] === b[i])) return 0;
    let count = 0;
    function solve() {
      if (count >= limit) return;
      let pick = -1, moves = null;
      for (let i = 0; i < SIZE; i++) {
        if (b[i]) continue;
        const opts = candidates(b, i);
        if (opts.length === 0) return;
        if (moves === null || opts.length < moves.length) { pick = i; moves = opts; if (moves.length === 1) break; }
      }
      if (pick < 0) { count++; return; }
      for (const n of moves) { b[pick] = n; solve(); b[pick] = 0; if (count >= limit) break; }
    }
    solve();
    return count;
  }
  function firstLogicalHint(board) {
    for (let i = 0; i < SIZE; i++) {
      if (board[i]) continue;
      const opts = candidates(board, i);
      if (opts.length === 1) return { index: i, value: opts[0], technique: 'Single candidate' };
    }
    for (const unit of units) for (let n = 1; n <= 9; n++) {
      if (unit.some(i => board[i] === n)) continue;
      const positions = unit.filter(i => !board[i] && candidates(board, i).includes(n));
      if (positions.length === 1) return { index: positions[0], value: n, technique: 'Only place in a row, column or box' };
    }
    return null;
  }
  function isComplete(board, solution) { return board.every((v, i) => v === solution[i]); }
  function validPuzzle(puzzle, solution) {
    if (!digits(puzzle) || !digits(solution) || solution.includes('0')) return false;
    const p = [...puzzle].map(Number), s = [...solution].map(Number);
    if (p.some((n, i) => n && n !== s[i])) return false;
    for (const unit of units) if (new Set(unit.map(i => s[i])).size !== 9) return false;
    return countSolutions(p, 2) === 1;
  }
  function shuffled(items, random = Math.random) {
    const result = items.slice();
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  function randomSource() {
    const array = new Uint32Array(1);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) return () => { crypto.getRandomValues(array); return array[0] / 4294967296; };
    return Math.random;
  }
  function transform(puzzle, solution, random = randomSource()) {
    // All permutations preserve Sudoku topology and the puzzle's difficulty profile.
    const digitOrder = shuffled([1,2,3,4,5,6,7,8,9], random);
    const map = [0, ...digitOrder];
    const groupRows = shuffled([0,1,2], random), groupCols = shuffled([0,1,2], random);
    const rows = groupRows.flatMap(g => shuffled([0,1,2], random).map(i => g * 3 + i));
    const cols = groupCols.flatMap(g => shuffled([0,1,2], random).map(i => g * 3 + i));
    const transpose = random() < .5;
    function apply(str) {
      let out = '';
      for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) {
        const index = transpose ? rows[x] * 9 + cols[y] : rows[y] * 9 + cols[x];
        out += map[Number(str[index])];
      }
      return out;
    }
    return { puzzle: apply(puzzle), solution: apply(solution) };
  }
  function pickPuzzle(bank, difficulty, random = randomSource()) {
    if (!bank || !Array.isArray(bank[difficulty]) || !bank[difficulty].length) throw Error('Puzzle bank is unavailable');
    const items = bank[difficulty];
    const chosen = items[Math.floor(random() * items.length)];
    return transform(chosen.puzzle, chosen.solution, random);
  }
  function conflicts(board, index) {
    const number = board[index];
    return number ? peers[index].filter(i => board[i] === number) : [];
  }
  return { peers, units, candidates, countSolutions, firstLogicalHint, isComplete, validPuzzle, transform, pickPuzzle, conflicts };
});
