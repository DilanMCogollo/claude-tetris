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
- **Loop**: `requestAnimationFrame` loop accumulates `dt` into `dropAccum` and drops one row when it exceeds `dropInterval`. Pause/game over work by cancelling `animId`; resuming resets `lastTime` and calls `loop` directly.
- **Rendering**: `draw()` redraws the entire board each frame (grid → locked cells → ghost at `alpha 0.2` → current piece). `drawNext()` is only called from `spawn()`. The HUD (`updateHUD`) is DOM-based, not canvas.
- **Scoring**: `LINE_SCORES[cleared] * level`; soft drop +1/row, hard drop +2/row. Level = `floor(lines / 10) + 1`; `dropInterval = max(100, 1000 − (level − 1) × 90)`.

## Gotchas

- Canvas size in `index.html` (`300×600`, and `120×120` for `#next-canvas`) is hardcoded and must match `COLS × BLOCK` / `ROWS × BLOCK` if those constants change.
- `togglePause()` shows the overlay when pausing but does not hide it when resuming.
- `endGame()` can fire inside `loop()` (via `lockPiece`), after which cancelling `animId` is not enough; `loop` checks `gameOver` before scheduling the next frame so it stops.
