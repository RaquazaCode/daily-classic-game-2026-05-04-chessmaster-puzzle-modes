import {
  PUZZLE_CLEAR_BASE,
  TRANSITION_MS,
  advanceTime,
  createGame,
  makeMove,
  renderGameToText,
  startGame
} from "../src/game-core.js";

const state = createGame(20260504);
startGame(state);

const route = [
  ["h5", "f7", 1_400],
  ["d8", "h4", 900],
  ["c3", "d5", 1_800]
];

for (let index = 0; index < route.length; index += 1) {
  const [from, to, deltaMs] = route[index];
  advanceTime(state, deltaMs);
  const result = makeMove(state, from, to);
  if (!result.ok) {
    throw new Error(`self-check failed on move ${from}-${to}`);
  }
  if (index < route.length - 1) {
    advanceTime(state, TRANSITION_MS);
  }
}

const payload = JSON.parse(renderGameToText(state));

if (payload.phase !== "gameover") {
  throw new Error(`self-check failed: expected gameover, got ${payload.phase}`);
}
if (payload.winner !== "player" || payload.winnerReason !== "all-puzzles-cleared") {
  throw new Error(
    `self-check failed: expected player/all-puzzles-cleared, got ${payload.winner}/${payload.winnerReason}`
  );
}
if (payload.solvedCount !== 3) {
  throw new Error(`self-check failed: expected 3 solved puzzles, got ${payload.solvedCount}`);
}
if (payload.lastMove !== "Nc3-d5#") {
  throw new Error(`self-check failed: expected Nc3-d5#, got ${payload.lastMove}`);
}
if (payload.totalMistakes !== 0) {
  throw new Error(`self-check failed: expected 0 mistakes, got ${payload.totalMistakes}`);
}
if (payload.totalScore <= PUZZLE_CLEAR_BASE * 3) {
  throw new Error(`self-check failed: expected time bonus score, got ${payload.totalScore}`);
}

console.log("self-check complete");
