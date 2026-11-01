/* Sudoku UI. Classic scripts also work inside Android's fully offline WebView. */
(function () {
  'use strict';
  const engine = globalThis.SudokuEngine;
  const bank = globalThis.SUDOKU_PUZZLES;
  const GAME_KEY = 'quiet-sudoku-game-v2', PREF_KEY = 'quiet-sudoku-prefs-v2', STATS_KEY = 'quiet-sudoku-stats-v2';
  const $ = id => document.getElementById(id);
  const cells = [];
  const digits = [];
  const difficultyNames = { easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert' };
  const defaults = { theme: 'system', highlightMatches: true, showErrors: true, autoClearNotes: true };
  let prefs = { ...defaults, ...readJSON(PREF_KEY, {}) };
  let stats = readJSON(STATS_KEY, { solved: 0, best: {} });
  let game = null;
  let tickStartedAt = null, lastDisplayedTime = -1, toastTimeout = null;
  const temporaryPause = new WeakMap();

  function readJSON(key, fallback) {
    try { const value = JSON.parse(localStorage.getItem(key)); return value && typeof value === 'object' ? value : fallback; }
    catch { return fallback; }
  }
  function writeJSON(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Full or disabled storage: play still works. */ } }
  function isValidGame(s) {
    if (!s || s.version !== 2 || !difficultyNames[s.difficulty] || typeof s.puzzle !== 'string' ||
        typeof s.solution !== 'string' || !engine.validPuzzle(s.puzzle, s.solution) ||
        !Array.isArray(s.board) || s.board.length !== 81 || s.board.some((v,i) => !Number.isInteger(v) || v < 0 || v > 9 || (s.puzzle[i] !== '0' && v !== Number(s.puzzle[i]))) ||
        !Array.isArray(s.notes) || s.notes.length !== 81 || s.notes.some(n => !Number.isInteger(n) || n < 0 || n > 511) ||
        !Number.isInteger(s.elapsedSec) || s.elapsedSec < 0 || !Number.isInteger(s.mistakes) || s.mistakes < 0 ||
        !Number.isInteger(s.hints) || s.hints < 0) return false;
    if (!Array.isArray(s.history) || !Array.isArray(s.future) || s.history.length > 120 || s.future.length > 120) return false;
    const goodSnapshot = snap => snap && Array.isArray(snap.board) && snap.board.length === 81 &&
      snap.board.every((v,i) => Number.isInteger(v) && v >= 0 && v <= 9 && (s.puzzle[i] === '0' || v === Number(s.puzzle[i]))) &&
      Array.isArray(snap.notes) && snap.notes.length === 81 && snap.notes.every(n => Number.isInteger(n) && n >= 0 && n <= 511);
    return s.history.every(goodSnapshot) && s.future.every(goodSnapshot);
  }
  function newGame(difficulty) {
    if (!difficultyNames[difficulty]) difficulty = 'easy';
    const { puzzle, solution } = engine.pickPuzzle(bank, difficulty);
    const board = [...puzzle].map(Number);
    game = { version: 2, difficulty, puzzle, solution, board, notes: Array(81).fill(0),
      selected: board.indexOf(0), notesMode: false, paused: false, elapsedSec: 0,
      mistakes: 0, hints: 0, won: false, history: [], future: [] };
    tickStartedAt = performance.now();
    lastDisplayedTime = -1;
    persist(); render();
  }
  function elapsed() { return game.elapsedSec + (tickStartedAt === null ? 0 : Math.floor((performance.now() - tickStartedAt) / 1000)); }
  function formatTime(total) {
    const h = Math.floor(total / 3600), m = Math.floor(total / 60) % 60, s = total % 60;
    const tw = n => String(n).padStart(2,'0');
    return h ? `${h}:${tw(m)}:${tw(s)}` : `${tw(Math.floor(total / 60))}:${tw(s)}`;
  }
  function renderTimer() {
    const seconds = elapsed();
    if (seconds === lastDisplayedTime) return;
    lastDisplayedTime = seconds;
    $('timer').textContent = formatTime(seconds);
    $('timer').setAttribute('aria-label', `${seconds} seconds elapsed`);
  }
  function persist() {
    if (!game) return;
    // Save active elapsed seconds without advancing the timer origin.
    writeJSON(GAME_KEY, { ...game, elapsedSec: elapsed() });
  }
  function pause(shouldSave = true) {
    if (!game || game.paused || game.won) return;
    game.elapsedSec = elapsed(); tickStartedAt = null; game.paused = true;
    if (shouldSave) persist(); render();
  }
  function resume() {
    if (!game || !game.paused || game.won) return;
    game.paused = false; tickStartedAt = performance.now();
    persist(); render();
  }
  function snapshot() { return { board: game.board.slice(), notes: game.notes.slice() }; }
  function remember() {
    game.history.push(snapshot()); if (game.history.length > 100) game.history.shift();
    game.future = [];
  }
  function restore(s) { game.board = s.board.slice(); game.notes = s.notes.slice(); persist(); render(); }
  function undo() {
    if (game.paused || game.won || !game.history.length) return;
    game.future.push(snapshot()); restore(game.history.pop());
  }
  function redo() {
    if (game.paused || game.won || !game.future.length) return;
    game.history.push(snapshot()); restore(game.future.pop());
  }
  function isGiven(i) { return game.puzzle[i] !== '0'; }
  function select(i, focus = false) {
    if (!game || game.paused || game.won || i < 0 || i >= 81) return;
    game.selected = i; renderBoard();
    if (focus) cells[i].focus({ preventScroll: true });
  }
  function input(n) {
    if (!game || game.paused || game.won) return;
    const i = game.selected;
    if (!Number.isInteger(i) || i < 0 || i >= 81) return;
    if (isGiven(i)) { notify('Given numbers cannot be changed.'); return; }
    if (game.notesMode && n > 0) {
      if (game.board[i] !== 0) return;
      remember(); game.notes[i] ^= (1 << (n - 1));
    } else {
      if (game.board[i] === n && game.notes[i] === 0) return;
      remember(); game.board[i] = n; game.notes[i] = 0;
      if (n && n !== Number(game.solution[i])) game.mistakes++;
      if (n && n === Number(game.solution[i]) && prefs.autoClearNotes) {
        for (const peer of engine.peers[i]) game.notes[peer] &= ~(1 << (n - 1));
      }
    }
    persist(); render(); checkWin();
  }
  function hint() {
    if (!game || game.paused || game.won) return;
    // Use correct entries only: wrong guesses must not contaminate logical analysis.
    const safe = game.board.map((n,i) => n === Number(game.solution[i]) ? n : 0);
    const move = engine.firstLogicalHint(safe);
    const i = move ? move.index : game.board.findIndex((n,j) => n !== Number(game.solution[j]));
    if (i < 0) return;
    const answer = Number(game.solution[i]);
    remember(); game.selected = i; game.board[i] = answer; game.notes[i] = 0; game.hints++;
    if (prefs.autoClearNotes) for (const peer of engine.peers[i]) game.notes[peer] &= ~(1 << (answer - 1));
    persist(); render();
    notify(move ? `${move.technique} · ${answer} goes in row ${Math.floor(i/9)+1}, column ${i%9+1}` : `Revealed a square: row ${Math.floor(i/9)+1}, column ${i%9+1}`);
    checkWin();
  }
  function checkWin() {
    if (!engine.isComplete(game.board, [...game.solution].map(Number))) return;
    game.elapsedSec = elapsed(); tickStartedAt = null; game.won = true;
    stats.solved = Math.max(0, Number(stats.solved) || 0) + 1;
    if (!stats.best || typeof stats.best !== 'object') stats.best = {};
    const previous = stats.best[game.difficulty];
    if (!Number.isInteger(previous) || game.elapsedSec < previous) stats.best[game.difficulty] = game.elapsedSec;
    writeJSON(STATS_KEY, stats); persist(); render();
    $('win-time').textContent = formatTime(game.elapsedSec);
    $('win-level').textContent = difficultyNames[game.difficulty];
    $('win-mistakes').textContent = String(game.mistakes);
    $('win-dialog').showModal();
  }
  function renderBoard() {
    if (!game) return;
    const selected = game.selected, selectionVal = game.board[selected];
    const sr = Math.floor(selected / 9), sc = selected % 9;
    for (let i = 0; i < 81; i++) {
      const cell = cells[i], n = game.board[i], row = Math.floor(i/9), col = i%9;
      const related = row === sr || col === sc || (Math.floor(row/3) === Math.floor(sr/3) && Math.floor(col/3) === Math.floor(sc/3));
      const matching = prefs.highlightMatches && selectionVal && n && n === selectionVal;
      const error = prefs.showErrors && n && n !== Number(game.solution[i]) && !isGiven(i);
      cell.classList.toggle('related', related && i !== selected);
      cell.classList.toggle('matching', Boolean(matching) && i !== selected);
      cell.classList.toggle('selected', i === selected);
      cell.classList.toggle('error', Boolean(error));
      cell.tabIndex = i === selected && !game.paused ? 0 : -1;
      cell.setAttribute('aria-pressed', String(i === selected));
      const label = `Row ${row+1}, column ${col+1}: ${n || 'empty'}${isGiven(i) ? ', given' : ''}${error ? ', incorrect' : ''}`;
      cell.setAttribute('aria-label', label);
      if (n) {
        if (cell.dataset.content !== `n${n}`) { cell.textContent = String(n); cell.dataset.content = `n${n}`; }
      } else if (game.notes[i]) {
        const key = `m${game.notes[i]}`;
        if (cell.dataset.content !== key) {
          cell.replaceChildren(); const grid = document.createElement('span'); grid.className = 'notes-grid';
          for (let d = 1; d <= 9; d++) { const note = document.createElement('span'); note.textContent = (game.notes[i] & (1 << (d-1))) ? String(d) : ''; grid.appendChild(note); }
          cell.appendChild(grid); cell.dataset.content = key;
        }
        cell.setAttribute('aria-label', label + ', notes ' + [...Array(9).keys()].filter(k => game.notes[i] & (1 << k)).map(k=>k+1).join(', '));
      } else if (cell.dataset.content !== '') { cell.textContent = ''; cell.dataset.content = ''; }
    }
  }
  function render() {
    if (!game) return;
    renderBoard(); renderTimer();
    const correct = game.board.filter((v,i) => v === Number(game.solution[i])).length;
    $('difficulty-pill').textContent = difficultyNames[game.difficulty];
    $('game-status').textContent = game.won ? 'Puzzle complete' : game.paused ? 'Paused' : game.notesMode ? 'Pencil mode on' : 'Enjoy the puzzle';
    $('pause-cover').hidden = !game.paused || game.won;
    $('pause-button').disabled = game.won;
    $('pause-button').setAttribute('aria-label', game.paused ? 'Resume game' : 'Pause game');
    $('pause-button').title = game.paused ? 'Resume game' : 'Pause game';
    $('pause-button').querySelector('use').setAttribute('href', game.paused ? '#i-play' : '#i-pause');
    $('notes-button').setAttribute('aria-pressed', String(game.notesMode));
    const inactive = game.paused || game.won;
    $('undo-button').disabled = inactive || !game.history.length;
    $('redo-button').disabled = inactive || !game.future.length;
    $('erase-button').disabled = inactive || isGiven(game.selected);
    $('notes-button').disabled = inactive;
    $('hint-button').disabled = inactive;
    digits.forEach(btn => { btn.disabled = inactive; });
    $('board').setAttribute('aria-disabled', String(inactive));
    $('progress-label').textContent = `${correct} / 81`;
    $('progress-percent').textContent = `${Math.round(correct/81*100)}%`;
    $('progress-fill').style.width = `${correct/81*100}%`;
    $('progress-track').setAttribute('aria-valuenow', String(correct));
    $('mistakes-label').textContent = String(game.mistakes);
    $('hints-label').textContent = String(game.hints);
    $('solved-label').textContent = String(stats.solved || 0);
    $('best-label').textContent = Number.isInteger(stats.best && stats.best[game.difficulty]) ? formatTime(stats.best[game.difficulty]) : '—';
  }
  function notify(message) {
    const toast = $('toast'); toast.textContent = message; toast.classList.add('show');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove('show'), 3600);
  }
  function changeTheme(theme) {
    prefs.theme = ['system','light','dark'].includes(theme) ? theme : 'system';
    document.documentElement.dataset.theme = prefs.theme;
    $('theme-select').value = prefs.theme;
    writeJSON(PREF_KEY, prefs);
    syncSystemBars();
  }
  function syncSystemBars() {
    if (globalThis.SudokuAndroid && typeof globalThis.SudokuAndroid.setDarkTheme === 'function') {
      const scheme = getComputedStyle(document.documentElement).colorScheme;
      globalThis.SudokuAndroid.setDarkTheme(scheme.includes('dark') ? 'dark' : 'light');
    }
  }
  function openDialog(dialog) {
    const wasPlaying = game && !game.paused && !game.won;
    if (wasPlaying) pause();
    temporaryPause.set(dialog, wasPlaying);
    dialog.showModal();
  }
  function closeDialog(dialog, shouldResume = true) {
    dialog.close();
    const wasPlaying = temporaryPause.get(dialog);
    temporaryPause.delete(dialog);
    if (wasPlaying && shouldResume && !game.won) resume();
  }
  function setupBoard() {
    for (let i = 0; i < 81; i++) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'cell'; button.dataset.content = '__init__';
      if (i%9 === 2 || i%9 === 5) button.classList.add('box-end');
      if (Math.floor(i/9) === 2 || Math.floor(i/9) === 5) button.classList.add('band-end');
      button.addEventListener('click', () => select(i));
      button.addEventListener('focus', () => { if (game && !game.paused && game.selected !== i) select(i); });
      cells.push(button); $('board').appendChild(button);
    }
    for (let n = 1; n <= 9; n++) {
      const button = document.createElement('button'); button.type = 'button';
      button.className = 'number-button'; button.textContent = String(n);
      button.setAttribute('aria-label', `Enter ${n}`);
      button.addEventListener('click', () => input(n));
      digits.push(button); $('number-pad').appendChild(button);
    }
  }
  function setupEvents() {
    $('new-button').addEventListener('click', () => { $('new-form').elements.difficulty.value = game.difficulty; openDialog($('new-dialog')); });
    $('new-form').addEventListener('submit', e => {
      e.preventDefault();
      const difficulty = $('new-form').elements.difficulty.value;
      closeDialog($('new-dialog'), false);
      newGame(difficulty);
    });
    $('pause-button').addEventListener('click', () => game.paused ? resume() : pause());
    $('resume-button').addEventListener('click', resume);
    $('undo-button').addEventListener('click', undo);
    $('redo-button').addEventListener('click', redo);
    $('erase-button').addEventListener('click', () => input(0));
    $('notes-button').addEventListener('click', () => { if (game.paused || game.won) return; game.notesMode = !game.notesMode; persist(); render(); });
    $('hint-button').addEventListener('click', hint);
    $('settings-button').addEventListener('click', () => openDialog($('settings-dialog')));
    $('settings-done').addEventListener('click', () => closeDialog($('settings-dialog')));
    document.querySelectorAll('.close-dialog').forEach(btn => btn.addEventListener('click', () => closeDialog(btn.closest('dialog'))));
    ['new-dialog','settings-dialog'].forEach(id => $(id).addEventListener('cancel', e => { e.preventDefault(); closeDialog($(id)); }));
    $('win-new').addEventListener('click', () => { $('win-dialog').close(); $('new-form').elements.difficulty.value = game.difficulty; openDialog($('new-dialog')); });
    $('win-close').addEventListener('click', () => $('win-dialog').close());
    $('win-dialog').addEventListener('cancel', e => { e.preventDefault(); $('win-dialog').close(); });
    $('theme-button').addEventListener('click', () => changeTheme(getComputedStyle(document.documentElement).colorScheme === 'dark' ? 'light' : 'dark'));
    $('theme-select').addEventListener('change', e => changeTheme(e.target.value));
    [['highlight-toggle','highlightMatches'],['errors-toggle','showErrors'],['autonotes-toggle','autoClearNotes']].forEach(([id,key]) => {
      $(id).checked = prefs[key] !== false;
      $(id).addEventListener('change', e => { prefs[key] = e.target.checked; writeJSON(PREF_KEY, prefs); render(); });
    });
    document.addEventListener('keydown', event => {
      if (document.querySelector('dialog[open]')) return;
      const tag = event.target && event.target.tagName;
      if (['INPUT','SELECT','TEXTAREA'].includes(tag)) return;
      if (event.ctrlKey || event.metaKey) {
        if (event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); }
        if (event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
        return;
      }
      if (event.altKey) return;
      if ('123456789'.includes(event.key) && event.key.length === 1) { event.preventDefault(); input(Number(event.key)); return; }
      if (event.key === 'Backspace' || event.key === 'Delete' || event.key === '0') { event.preventDefault(); input(0); return; }
      if (event.key.toLowerCase() === 'n') { event.preventDefault(); $('notes-button').click(); return; }
      if (event.key.toLowerCase() === 'h') { event.preventDefault(); hint(); return; }
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key) && !game.paused && !game.won) {
        event.preventDefault();
        const row = Math.floor(game.selected / 9), col = game.selected % 9;
        const dr = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
        const dc = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
        select(((row+dr+9)%9)*9+(col+dc+9)%9, true);
      }
    });
    // Pause when app is backgrounded. A timer should represent time spent playing.
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
    window.addEventListener('pagehide', persist);
    setInterval(() => { if (game && !game.paused && !game.won) { renderTimer(); if (elapsed() % 15 === 0) persist(); } }, 1000);
  }
  function init() {
    setupBoard(); setupEvents(); changeTheme(prefs.theme);
    if (typeof matchMedia === 'function') matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncSystemBars);
    const saved = readJSON(GAME_KEY, null);
    if (isValidGame(saved)) {
      game = saved;
      game.selected = Number.isInteger(saved.selected) && saved.selected >= 0 && saved.selected <= 80 ? saved.selected : saved.board.indexOf(0);
      if (game.selected < 0) game.selected = 0;
      game.notesMode = Boolean(saved.notesMode);
      // A restored session always waits for a deliberate resume, unless already won.
      game.paused = !game.won;
      tickStartedAt = null;
      render();
    } else newGame('easy');
    // File URLs are offline in Android. HTTP(S) gets full PWA caching.
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
    }
  }
  init();
})();
