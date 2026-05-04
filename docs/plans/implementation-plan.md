# Implementation Plan

## Goal

Build a deterministic three-puzzle chess tactics campaign with full legal move validation, browser hooks, and scripted verification.

## Milestones

1. Preserve the tested board representation and rules engine from the template.
2. Replace the two-player clock duel with a puzzle queue, scripted opponent replies, and solve-bonus scoring.
3. Rework the UI copy and layout around puzzle progression, hints, pause/reset, and restart.
4. Script a deterministic solve route for tests and Playwright capture artifacts.
5. Publish through the required git, GitHub, verification, and deployment flow.

## Scripted Solve Route

- Puzzle 1: `Qh5xf7#`
- Puzzle 2: `Qd8-h4#`
- Puzzle 3: `Nc3-d5#`

## Final Controls

- `Enter`: start the active puzzle or restart the cleared gauntlet
- Click: select a legal piece, then land the mating move
- `P`: pause or resume the solve clock
- `R`: reset the three-board session
