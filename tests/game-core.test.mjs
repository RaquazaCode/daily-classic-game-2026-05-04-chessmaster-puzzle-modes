import test from "node:test";
import assert from "node:assert/strict";

import {
  STARTING_CLOCK_MS,
  advanceTime,
  clickSquare,
  createGame,
  makeMove,
  renderGameToText,
  startGame
} from "../src/game-core.js";

function freshGame() {
  const state = createGame(20260428);
  startGame(state);
  return state;
}

test("white pawn selection exposes the standard two-step opening", () => {
  const state = freshGame();

  const result = clickSquare(state, 6, 4);
  assert.equal(result.ok, true);
  assert.deepEqual(new Set(state.legalTargets), new Set(["5,4", "4,4"]));
});

test("scholar mate produces deterministic checkmate for white", () => {
  const state = freshGame();
  const sequence = [
    ["e2", "e4"],
    ["e7", "e5"],
    ["d1", "h5"],
    ["b8", "c6"],
    ["f1", "c4"],
    ["g8", "f6"],
    ["h5", "f7"]
  ];

  for (const [from, to] of sequence) {
    const result = makeMove(state, from, to);
    assert.equal(result.ok, true, `${from}-${to} should be legal`);
  }

  const payload = JSON.parse(renderGameToText(state));
  assert.equal(payload.phase, "gameover");
  assert.equal(payload.winner, "white");
  assert.equal(payload.winnerReason, "checkmate");
  assert.equal(payload.lastMove, "Qh5xf7#");
  assert.equal(payload.check, "black");
  assert.equal(payload.captured.white[0], "pawn");
});

test("en passant capture removes the pawn and awards material score", () => {
  const state = freshGame();
  const sequence = [
    ["e2", "e4"],
    ["a7", "a6"],
    ["e4", "e5"],
    ["d7", "d5"],
    ["e5", "d6"]
  ];

  for (const [from, to] of sequence) {
    const result = makeMove(state, from, to);
    assert.equal(result.ok, true);
  }

  const payload = JSON.parse(renderGameToText(state));
  assert.equal(payload.board[2][3], "wP");
  assert.equal(payload.board[3][3], "__");
  assert.equal(payload.score.white, 100);
  assert.equal(payload.lastMove, "exd6");
});

test("white can castle kingside after the lane is cleared", () => {
  const state = freshGame();
  const sequence = [
    ["e2", "e4"],
    ["a7", "a6"],
    ["g1", "f3"],
    ["a6", "a5"],
    ["f1", "e2"],
    ["a5", "a4"],
    ["e1", "g1"]
  ];

  for (const [from, to] of sequence) {
    const result = makeMove(state, from, to);
    assert.equal(result.ok, true);
  }

  const payload = JSON.parse(renderGameToText(state));
  assert.equal(payload.board[7][6], "wK");
  assert.equal(payload.board[7][5], "wR");
  assert.equal(payload.lastMove, "O-O");
});

test("the active side can lose on time", () => {
  const state = freshGame();

  advanceTime(state, STARTING_CLOCK_MS);

  const payload = JSON.parse(renderGameToText(state));
  assert.equal(payload.phase, "gameover");
  assert.equal(payload.winner, "black");
  assert.equal(payload.winnerReason, "flag");
  assert.equal(payload.clocks.white, 0);
});
