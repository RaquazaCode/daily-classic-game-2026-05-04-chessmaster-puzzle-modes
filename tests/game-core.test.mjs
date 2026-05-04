import test from "node:test";
import assert from "node:assert/strict";

import {
  TRANSITION_MS,
  advanceTime,
  clickSquare,
  createGame,
  makeMove,
  renderGameToText,
  startGame
} from "../src/game-core.js";

function payload(state) {
  return JSON.parse(renderGameToText(state));
}

function freshGame() {
  const state = createGame(20260504);
  startGame(state);
  return state;
}

function solveFirstPuzzle(state) {
  const result = makeMove(state, "h5", "f7");
  assert.equal(result.ok, true);
  assert.equal(result.reason, "puzzle-solved");
}

test("opening puzzle exposes f7 as a legal queen target", () => {
  const state = freshGame();

  const result = clickSquare(state, 3, 7);
  assert.equal(result.ok, true);
  assert.equal(result.reason, "selected");
  assert.equal(new Set(state.legalTargets).has("1,5"), true);
});

test("first puzzle solve enters the transition phase", () => {
  const state = freshGame();

  solveFirstPuzzle(state);

  const view = payload(state);
  assert.equal(view.phase, "transition");
  assert.equal(view.solvedCount, 1);
  assert.equal(view.lastMove, "Qh5xf7#");
  assert.equal(view.totalScore > 0, true);
});

test("transition loads the second puzzle with black to move", () => {
  const state = freshGame();

  solveFirstPuzzle(state);
  advanceTime(state, TRANSITION_MS);

  const view = payload(state);
  assert.equal(view.phase, "running");
  assert.equal(view.puzzleIndex, 2);
  assert.equal(view.playerColor, "black");
  assert.equal(view.turn, "black");
});

test("a legal miss resets the puzzle and counts a mistake", () => {
  const state = freshGame();

  solveFirstPuzzle(state);
  advanceTime(state, TRANSITION_MS);
  const scoreBeforeMiss = payload(state).totalScore;

  const miss = makeMove(state, "b8", "c6");
  assert.equal(miss.ok, false);
  assert.equal(miss.reason, "missed-mate");

  const view = payload(state);
  assert.equal(view.phase, "running");
  assert.equal(view.puzzleIndex, 2);
  assert.equal(view.turn, "black");
  assert.equal(view.totalMistakes, 1);
  assert.equal(view.totalScore < scoreBeforeMiss, true);
  assert.equal(view.moveHistory.length, 0);
  assert.equal(view.lastMove, null);
});

test("the full solve route clears the gauntlet", () => {
  const state = freshGame();

  advanceTime(state, 1_200);
  assert.equal(makeMove(state, "h5", "f7").ok, true);
  advanceTime(state, TRANSITION_MS);
  advanceTime(state, 900);
  assert.equal(makeMove(state, "d8", "h4").ok, true);
  advanceTime(state, TRANSITION_MS);
  advanceTime(state, 1_700);
  assert.equal(makeMove(state, "c3", "d5").ok, true);

  const view = payload(state);
  assert.equal(view.phase, "gameover");
  assert.equal(view.winner, "player");
  assert.equal(view.winnerReason, "all-puzzles-cleared");
  assert.equal(view.solvedCount, 3);
  assert.equal(view.lastMove, "Nc3-d5#");
  assert.equal(view.totalMistakes, 0);
});
