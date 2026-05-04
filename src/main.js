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

function pieceMaterialText(color) {
  const labels = state.captured[color].map((type) => PIECE_LABELS[type]);
  return labels.length > 0 ? labels.join(" ") : "None";
}

function gameResultText() {
  if (state.phase !== "gameover") {
    return `${capitalize(state.turn)} to move`;
  }
  if (!state.winner) {
    return "Draw by stalemate";
  }
  if (state.winnerReason === "flag") {
    return `${capitalize(state.winner)} wins on time`;
  }
  return `${capitalize(state.winner)} wins by checkmate`;
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

function renderStatus() {
  const whiteDanger = state.clocks.white <= 10_000 ? " danger" : "";
  const blackDanger = state.clocks.black <= 10_000 ? " danger" : "";
  const whiteLeader = state.winner === "white" ? " safe" : "";
  const blackLeader = state.winner === "black" ? " safe" : "";

  statusEl.innerHTML = `
    <h2>Match State</h2>
    <div class="status-grid">
      <div class="status-pill${whiteDanger}${whiteLeader}">
        <strong>White Clock</strong>
        <span>${formatClock(state.clocks.white)}</span>
      </div>
      <div class="status-pill${blackDanger}${blackLeader}">
        <strong>Black Clock</strong>
        <span>${formatClock(state.clocks.black)}</span>
      </div>
      <div class="status-pill">
        <strong>White Score</strong>
        <span>${state.score.white}</span>
      </div>
      <div class="status-pill">
        <strong>Black Score</strong>
        <span>${state.score.black}</span>
      </div>
    </div>
    <p class="line"><strong>Result</strong><span>${gameResultText()}</span></p>
    <p class="line"><strong>Twist</strong><span>Each move adds 1 second; captures add 2.5 more.</span></p>
    <p class="line"><strong>White Captures</strong><span>${pieceMaterialText("white")}</span></p>
    <p class="line"><strong>Black Captures</strong><span>${pieceMaterialText("black")}</span></p>
    <p class="line"><strong>Status</strong><span>${state.status}</span></p>
  `;
}

function groupedMoveRows() {
  const rows = [];

  for (const move of state.moveHistory) {
    const existing = rows[rows.length - 1];
    if (move.color === "white" || !existing || existing.black) {
      rows.push({
        moveNumber: move.moveNumber,
        white: move.color === "white" ? move.notation : "…",
        black: move.color === "black" ? move.notation : ""
      });
    } else {
      existing.black = move.notation;
    }
  }

  return rows;
}

function renderMoves() {
  if (state.moveHistory.length === 0) {
    movesEl.innerHTML = `
      <h2>Move Sheet</h2>
      <p>Open with <code>e2-e4</code>, race the clock, and watch the move list fill in live.</p>
    `;
    return;
  }

  const items = groupedMoveRows()
    .map(
      (row) => `
        <li>
          <strong>${row.moveNumber}.</strong>
          ${row.white || "…"}
          ${row.black ? ` / ${row.black}` : ""}
        </li>
      `
    )
    .join("");

  movesEl.innerHTML = `
    <h2>Move Sheet</h2>
    <ol class="move-list">${items}</ol>
  `;
}

function render() {
  renderBoard();
  renderStatus();
  renderMoves();
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
      renderStatus();
      if (state.phase === "gameover") {
        renderMoves();
      }
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
window.__TIME_ATTACK_CHESS__ = state;
