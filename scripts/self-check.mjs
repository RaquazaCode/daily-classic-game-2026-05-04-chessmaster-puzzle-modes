import {
  advanceTime,
  createGame,
  makeMove,
  renderGameToText,
  startGame
} from "../src/game-core.js";

const state = createGame(20260428);
startGame(state);

const route = [
  ["e2", "e4", 1400],
  ["e7", "e5", 1200],
  ["d1", "h5", 800],
  ["b8", "c6", 900],
  ["f1", "c4", 900],
  ["g8", "f6", 900],
  ["h5", "f7", 700]
];

for (const [from, to, deltaMs] of route) {
  advanceTime(state, deltaMs);
  const result = makeMove(state, from, to);
  if (!result.ok) {
    throw new Error(`self-check failed on move ${from}-${to}`);
  }
}

const payload = JSON.parse(renderGameToText(state));

if (payload.phase !== "gameover") {
  throw new Error(`self-check failed: expected gameover, got ${payload.phase}`);
}
if (payload.winner !== "white" || payload.winnerReason !== "checkmate") {
  throw new Error(
    `self-check failed: expected white checkmate, got ${payload.winner}/${payload.winnerReason}`
  );
}
if (payload.lastMove !== "Qh5xf7#") {
  throw new Error(`self-check failed: expected Qh5xf7#, got ${payload.lastMove}`);
}
if (payload.clocks.white >= 95_000 || payload.clocks.black >= 95_000) {
  throw new Error("self-check failed: clocks did not advance through the route");
}

console.log("self-check complete");
