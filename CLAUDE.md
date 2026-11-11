c;# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JavaScript Tetris on HTML5 Canvas: `index.html` + `style.css` + `game.js`. No dependencies, no `package.json`, no build step, no test suite, no linter. User-facing text (UI labels, overlay messages, README) is in Spanish; keep it that way.

## Running

Open `index.html` directly in a browser, or serve the folder statically (preferred):

```bash
python -m http.server 8000   # then open http://localhost:8000
npx serve .
```

Verification is manual: load the page and play.

## Architecture (`game.js`)

Everything lives in one script with module-level mutable state (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, `animId`, …). There are no classes or modules; functions read and write these globals directly. `init()` resets all state and is also the restart-button handler.

- **Board**: `ROWS × COLS` matrix; `0` = empty, `1–7` = piece type, which also indexes `COLORS`. `PIECES[type]` matrices store the type number in their filled cells, so merged board cells carry their color automatically.
- **Pieces**: `{ type, shape, x, y }`. Rotation is `rotateCW` (matrix transpose + reverse); `tryRotate` applies simple horizontal wall kicks `[0, -1, 1, -2, 2]` (no SRS).
- **Collision**: `collide(shape, ox, oy)` is the single source of truth for all movement, rotation, ghost projection (`ghostY`), and the game-over check in `spawn()`. Cells with `y < 0` are allowed (above the board).
- **Lock cycle**: `lockPiece()` → `merge()` → `clearLines()` (updates lines/score/level/`dropInterval`) → `spawn()` (promotes `next` to `current`; collision on spawn → `endGame()`).
- **Loop**: `requestAnimationFrame` loop accumulates `dt` into `dropAccum` and drops one row when it exceeds `dropInterval`. Pause/game over work by cancelling `animId`; resuming resets `lastTime` and `dropAccum` and calls `loop` directly.
- **Pause menu** (`// ---- Menú de pausa ----` section): `P`/`Escape` → `togglePause()`, which shows/hides `#pause-menu` (separate from `#overlay`, which is only for game over). While `paused`, keydown only handles `P`/`Escape`/`T` and arrow navigation between menu items (`handlePauseMenuKey`); game inputs are blocked. `hidePauseMenu()` blurs any focused menu control so Space/arrows don't re-trigger it. Menu "Reiniciar" calls `init()`, which also hides the menu.
- **Rendering**: `draw()` redraws the entire board each frame (`clearCanvas` → grid → locked cells → ghost at `alpha 0.2` → current piece). `drawNext()` is called from `spawn()` and when theme/skin change. The HUD (`updateHUD`) is DOM-based, not canvas.
- **Skins** (`// ---- Skins ----` section): `SKINS = { retro, neon, pastel, pixel }`, each with `name` (Spanish label, used to populate `#skin-select`), `colors` (per-skin palette indexed like `COLORS`; `COLORS` is now only the Retro palette), optional `boardBg` (painted by `clearCanvas`; otherwise the canvas stays transparent so CSS `--board-bg` shows — Neon forces black in both themes), optional `grid` (fallback CSS `--grid`), and `drawBlock(context, x, y, colorIndex, size, alpha)`. The global `drawBlock` keeps its signature, delegates to the active `skin` and wraps the call in `save()/restore()` so `shadowBlur`/`globalAlpha` never leak. `setSkin(id)` validates (invalid → `retro`), persists to `localStorage` key `tetris-skin` and redraws if `current && next`. The select's own `keydown` stops propagation so focused-select keys don't drive the game.
- **Scoring**: `LINE_SCORES[cleared] * level`; soft drop +1/row, hard drop +2/row. Level = `max(gameStartLevel, floor(lines / 10) + 1)`; `dropInterval = intervalForLevel(level)` = `max(100, 1000 − (level − 1) × 90)`. `startLevel` (1–10) is chosen in the pause menu, persisted in `localStorage` (`tetris-start-level`), and snapshotted by `init()` into `gameStartLevel` (`level = gameStartLevel`, `lines = 0`), so changing it mid-game only takes effect on the next game.

## Gotchas

- Canvas size in `index.html` (`300×600`, and `120×120` for `#next-canvas`) is hardcoded and must match `COLS × BLOCK` / `ROWS × BLOCK` if those constants change.
- `startLevel` / `intervalForLevel` are declared in the pause-menu section, below `init()`/`clearLines()`; that's fine because they are only used at call time, but `init()` must stay the last statement of the file.
- `endGame()` can fire inside `loop()` (via `lockPiece`), after which cancelling `animId` is not enough; `loop` checks `gameOver` before scheduling the next frame so it stops.
