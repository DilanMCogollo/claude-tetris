'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - azul pálido
  '#ffb74d', // L - orange
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeBtn = document.getElementById('theme-toggle');

const THEME_KEY = 'tetris-theme';
let theme = 'dark';

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function setTheme(t) {
  theme = t === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  themeBtn.textContent = theme === 'light' ? '🌙 Modo oscuro' : '☀️ Modo claro';
  try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* almacenamiento no disponible */ }
  // Redibujar para reflejar el cambio también en pausa / game over
  if (current && next) { draw(); drawNext(); }
}

function toggleTheme() {
  setTheme(theme === 'light' ? 'dark' : 'light');
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  registerCombo(cleared);
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim() || '#22222e';
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
  onGameOverRecords();
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  if (gameOver || paused) return;
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  // endGame() pudo ocurrir dentro de este frame (vía lockPiece): no reprogramar el loop
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  onGameStartRecords();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (recordsKeyGuard(e)) return;
  if (e.code === 'KeyP') { togglePause(); return; }
  if (e.code === 'KeyT' && !e.repeat) { toggleTheme(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

// ---- Records ----
// Top 5 local en localStorage + estadísticas globales (mejor combo, líneas máximas en una partida).
const RECORDS_KEY = 'tetris-records';
const STATS_KEY = 'tetris-stats';
const MAX_RECORDS = 5;
const NAME_MAX = 12;
const DEFAULT_NAME = 'Jugador';

const startScreen = document.getElementById('start-screen');
const playBtn = document.getElementById('play-btn');
const startRecordsBody = document.getElementById('start-records-body');
const startStats = document.getElementById('start-stats');
const gameoverRecords = document.getElementById('gameover-records');
const gameoverRecordsBody = document.getElementById('gameover-records-body');
const gameoverStats = document.getElementById('gameover-stats');
const newRecordForm = document.getElementById('new-record-form');
const newRecordMsg = document.getElementById('new-record-msg');
const nameInput = document.getElementById('player-name');
const saveRecordBtn = document.getElementById('save-record-btn');
const resetRecordsBtns = document.querySelectorAll('.reset-records-btn');

let started = false;      // la partida no arranca hasta pulsar "Jugar" (o Enter)
let combo = 0;            // bloqueos consecutivos que limpian al menos una línea
let maxCombo = 0;         // mejor combo de la partida actual
let pendingRecord = null; // puntuación de la partida terminada que entra en el top, aún sin guardar
let highlightIndex = -1;  // fila a resaltar tras guardar

function toNonNegInt(v) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function sanitizeName(v) {
  const name = String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, NAME_MAX);
  return name || DEFAULT_NAME;
}

function loadRecords() {
  let data;
  try { data = JSON.parse(localStorage.getItem(RECORDS_KEY) || '[]'); } catch (e) { data = []; }
  if (!Array.isArray(data)) return [];
  return data
    .filter(r => r && typeof r === 'object' && Number.isFinite(Number(r.score)))
    .map(r => ({
      name: sanitizeName(r.name),
      score: toNonNegInt(r.score),
      lines: toNonNegInt(r.lines),
      level: Math.max(1, toNonNegInt(r.level)),
      date: typeof r.date === 'string' ? r.date.slice(0, 40) : '',
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RECORDS);
}

function saveRecords(records) {
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(records)); } catch (e) { /* almacenamiento no disponible */ }
}

function loadStats() {
  let data;
  try { data = JSON.parse(localStorage.getItem(STATS_KEY) || '{}'); } catch (e) { data = {}; }
  if (!data || typeof data !== 'object') data = {};
  return { bestCombo: toNonNegInt(data.bestCombo), maxLines: toNonNegInt(data.maxLines) };
}

function saveStats(stats) {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch (e) { /* almacenamiento no disponible */ }
}

function qualifiesForTop(s) {
  if (s <= 0) return false;
  const records = loadRecords();
  return records.length < MAX_RECORDS || s > records[records.length - 1].score;
}

// Hook desde clearLines(): actualiza el combo con cada bloqueo de pieza.
function registerCombo(cleared) {
  if (cleared > 0) {
    combo++;
    if (combo > maxCombo) maxCombo = combo;
  } else {
    combo = 0;
  }
}

function renderRecordsTable(tbody) {
  const records = loadRecords();
  tbody.replaceChildren();
  if (!records.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4;
    td.className = 'records-empty';
    td.textContent = 'Sin records todavía';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  records.forEach((r, i) => {
    const tr = document.createElement('tr');
    if (i === highlightIndex) tr.className = 'records-highlight';
    for (const text of [`${i + 1}`, r.name, r.score.toLocaleString(), `${r.lines}`]) {
      const td = document.createElement('td');
      td.textContent = text;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  });
}

function renderStats(el) {
  const stats = loadStats();
  el.textContent = `Mejor combo: ${stats.bestCombo} · Líneas máx.: ${stats.maxLines}`;
}

function renderRecords() {
  renderRecordsTable(startRecordsBody);
  renderRecordsTable(gameoverRecordsBody);
  renderStats(startStats);
  renderStats(gameoverStats);
}

function savePendingRecord() {
  if (!pendingRecord) return;
  const entry = { ...pendingRecord, name: sanitizeName(nameInput.value) };
  pendingRecord = null;
  const records = loadRecords();
  records.push(entry);
  // sort estable: ante empate, el record más antiguo queda primero
  records.sort((a, b) => b.score - a.score);
  const top = records.slice(0, MAX_RECORDS);
  saveRecords(top);
  highlightIndex = top.indexOf(entry);
  newRecordForm.classList.add('hidden');
  newRecordMsg.textContent = highlightIndex >= 0 ? `¡Record guardado! Puesto #${highlightIndex + 1}` : '';
  nameInput.blur();
  renderRecords();
}

// Hook desde endGame(): actualiza estadísticas y muestra la tabla / formulario de nombre.
function onGameOverRecords() {
  const stats = loadStats();
  saveStats({ bestCombo: Math.max(stats.bestCombo, maxCombo), maxLines: Math.max(stats.maxLines, lines) });
  highlightIndex = -1;
  if (qualifiesForTop(score)) {
    pendingRecord = { name: DEFAULT_NAME, score, lines, level, date: new Date().toISOString() };
    newRecordMsg.textContent = '¡Nuevo record! Entraste en el top 5';
    newRecordForm.classList.remove('hidden');
    nameInput.value = DEFAULT_NAME;
  } else {
    pendingRecord = null;
    newRecordMsg.textContent = '';
    newRecordForm.classList.add('hidden');
  }
  renderRecords();
  gameoverRecords.classList.remove('hidden');
  if (pendingRecord) { nameInput.focus(); nameInput.select(); }
}

// Hook desde init(): arranca la partida y oculta las pantallas de records.
function onGameStartRecords() {
  if (pendingRecord) savePendingRecord(); // reiniciar sin guardar conserva el record con el nombre escrito
  started = true;
  combo = 0;
  maxCombo = 0;
  highlightIndex = -1;
  startScreen.classList.add('hidden');
  gameoverRecords.classList.add('hidden');
}

// Hook desde el keydown global: devuelve true si la tecla no debe procesarse como tecla de juego.
function recordsKeyGuard(e) {
  if (e.target === nameInput) return true; // escribiendo el nombre: ni P, ni T, ni movimiento
  if (!started) {
    if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); init(); return true; }
    return e.code !== 'KeyT'; // antes de empezar solo se permite cambiar el tema
  }
  return false;
}

function resetRecords() {
  if (!confirm('¿Borrar todos los records y estadísticas?')) return;
  try {
    localStorage.removeItem(RECORDS_KEY);
    localStorage.removeItem(STATS_KEY);
  } catch (e) { /* almacenamiento no disponible */ }
  highlightIndex = -1;
  renderRecords();
}

playBtn.addEventListener('click', () => { playBtn.blur(); init(); });
saveRecordBtn.addEventListener('click', () => { savePendingRecord(); saveRecordBtn.blur(); });
nameInput.addEventListener('keydown', e => {
  if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); savePendingRecord(); }
});
resetRecordsBtns.forEach(btn => btn.addEventListener('click', () => { resetRecords(); btn.blur(); }));

restartBtn.addEventListener('click', init);
themeBtn.addEventListener('click', () => { toggleTheme(); themeBtn.blur(); });

let savedTheme = 'dark';
try { savedTheme = localStorage.getItem(THEME_KEY) || 'dark'; } catch (e) { /* ignorar */ }
setTheme(savedTheme);

// Pantalla de inicio: el juego no arranca (sin loop ni input) hasta pulsar "Jugar" o Enter
drawGrid();
renderRecords();
startScreen.classList.remove('hidden');
