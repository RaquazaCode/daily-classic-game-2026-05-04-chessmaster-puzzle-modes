import {
  BOARD_SIZE,
  PIECE_LABELS,
  advanceTime,
  clickSquare,
  createGame,
  renderGameToText,
  resetGame,
  startGame,
  togglePause
} from "./game-core.js";

const boardEl = document.querySelector("#board");
const boardNoteEl = document.querySelector("#board-note");
const statusEl = document.querySelector("#status");
const movesEl = document.querySelector("#moves");

const params = new URLSearchParams(window.location.search);
const manualMode = params.get("manual") === "1";
const autoStart = params.get("autostart") === "1";

const state = createGame();
if (autoStart) {
  startGame(state);
}

const squares = [];

function squareKey(row, col) {
  return `${row},${col}`;
}

function capitalize(value) {
  return `${value[0].toUpperCase()}${value.slice(1)}`;
}

function formatClock(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function phaseLabel(view) {
  if (view.phase === "title") {
    return "Ready";
  }
  if (view.phase === "paused") {
    return "Paused";
  }
  if (view.phase === "transition") {
    return "Solved";
  }
  if (view.phase === "gameover") {
    return "Cleared";
  }
  return "Live";
}

function buildBoard() {
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `square ${(row + col) % 2 === 0 ? "light" : "dark"}`;
      button.setAttribute("aria-label", `Square ${String.fromCharCode(97 + col)}${8 - row}`);
      button.addEventListener("click", () => {
        clickSquare(state, row, col);
        render();
      });

      const pieceEl = document.createElement("span");
      pieceEl.className = "piece hidden";
      button.append(pieceEl);

      const coordsEl = document.createElement("span");
      coordsEl.className = "coords";
      coordsEl.textContent = `${String.fromCharCode(97 + col)}${8 - row}`;
      button.append(coordsEl);

      boardEl.append(button);
      squares.push({ row, col, button, pieceEl });
    }
  }
}

function renderBoard() {
  const selected = state.selected;
  const legalTargets = new Set(state.legalTargets);
  const lastFrom = state.lastMove ? squareKey(state.lastMove.from.row, state.lastMove.from.col) : null;
  const lastTo = state.lastMove ? squareKey(state.lastMove.to.row, state.lastMove.to.col) : null;

  for (const square of squares) {
    const { row, col, button, pieceEl } = square;
    const key = squareKey(row, col);
    const piece = state.board[row][col];

    button.className = `square ${(row + col) % 2 === 0 ? "light" : "dark"}`;
    if (selected === key) {
      button.classList.add("selected");
    }
    if (legalTargets.has(key)) {
      button.classList.add("legal");
    }
    if (lastFrom === key) {
      button.classList.add("last-from");
    }
    if (lastTo === key) {
      button.classList.add("last-to");
    }
    if (piece && piece.type === "king" && piece.color === state.check) {
      button.classList.add("in-check");
    }

    if (piece) {
      pieceEl.className = `piece ${piece.color}`;
      pieceEl.textContent = PIECE_LABELS[piece.type];
      pieceEl.setAttribute("aria-label", `${piece.color} ${piece.type}`);
    } else {
      pieceEl.className = "piece hidden";
      pieceEl.textContent = "";
      pieceEl.removeAttribute("aria-label");
    }
  }
}

function renderBoardNote(view) {
  boardNoteEl.innerHTML = `
    <strong>${view.puzzleTitle}</strong>
    <span>${capitalize(view.playerColor)} to move</span>
  `;
}

function renderStatus(view) {
  const solvedText = `${view.solvedCount} / ${view.puzzleCount}`;
  const timerClass = view.solveClockMs <= 10_000 ? " urgent" : "";
  const phase = phaseLabel(view);

  statusEl.innerHTML = `
    <h2>Study Board</h2>
    <div class="status-grid">
      <div class="status-pill${timerClass}">
        <strong>Solve Clock</strong>
        <span>${formatClock(view.solveClockMs)}</span>
      </div>
      <div class="status-pill">
        <strong>Total Score</strong>
        <span>${view.totalScore}</span>
      </div>
      <div class="status-pill">
        <strong>Boards Cleared</strong>
        <span>${solvedText}</span>
      </div>
      <div class="status-pill">
        <strong>Mistakes</strong>
        <span>${view.totalMistakes}</span>
      </div>
    </div>
    <p class="line"><strong>Phase</strong><span>${phase}</span></p>
    <p class="line"><strong>Objective</strong><span>${view.objective}</span></p>
    <p class="line"><strong>Hint</strong><span>${view.hint}</span></p>
    <p class="line"><strong>Status</strong><span>${view.status}</span></p>
  `;
}

function renderLedger(view) {
  const solvedItems = view.solvedPuzzles
    .map(
      (entry) => `
        <li class="ledger-item">
          <strong>${entry.title}</strong>
          <span>${entry.notation} · +${entry.bonus}</span>
        </li>
      `
    )
    .join("");

  const recentMove = view.lastMove
    ? `<p class="line"><strong>Latest Finish</strong><span>${view.lastMove}</span></p>`
    : "";

  movesEl.innerHTML = `
    <h2>Puzzle Sheet</h2>
    <p class="sheet-copy">Each board wants a single clean mating move. Any legal miss snaps the board back to the study start.</p>
    <p class="line"><strong>Current Board</strong><span>${view.puzzleIndex} of ${view.puzzleCount}</span></p>
    <p class="line"><strong>Side to Move</strong><span>${capitalize(view.playerColor)}</span></p>
    ${recentMove}
    <h3>Solved Boards</h3>
    ${
      solvedItems
        ? `<ol class="ledger-list">${solvedItems}</ol>`
        : `<p class="sheet-copy muted">No studies cleared yet. The gauntlet opens with ${view.puzzleTitle}.</p>`
    }
  `;
}

function render() {
  const view = JSON.parse(renderGameToText(state));
  renderBoard();
  renderBoardNote(view);
  renderStatus(view);
  renderLedger(view);
}

buildBoard();
render();

document.addEventListener("keydown", (event) => {
  if (event.code === "Enter") {
    startGame(state);
    render();
  } else if (event.code === "KeyP") {
    togglePause(state);
    render();
  } else if (event.code === "KeyR") {
    resetGame(state, state.seed, autoStart);
    render();
  }
});

if (!manualMode) {
  let lastTimestamp = performance.now();

  const tick = (timestamp) => {
    const delta = timestamp - lastTimestamp;
    lastTimestamp = timestamp;
    if (advanceTime(state, delta)) {
      render();
    }
    window.requestAnimationFrame(tick);
  };

  window.requestAnimationFrame(tick);
}

window.advanceTime = (ms) => {
  advanceTime(state, ms);
  render();
};

window.render_game_to_text = () => renderGameToText(state);
window.__CHESSMASTER_PUZZLE_MODES__ = state;
