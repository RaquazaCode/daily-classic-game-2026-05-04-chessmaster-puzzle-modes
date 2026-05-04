# Design

- Source game: Chessmaster (Chess)
- Twist: puzzle modes
- Theme: warm paper notes pinned beside a green tournament board instead of a cold digital clock wall.
- Core loop: load a deterministic study, find the legal mating move, bank the remaining solve-clock bonus, and roll into the next board.
- Puzzle set:
  - Scholar Finish for White
  - Fool's Net for Black
  - Legall's Snap for White
- Failure rule: any legal non-mating move or solve-clock expiry resets the current board with a fixed score penalty.
- Verification path: scripted mouse route clears the three boards with `Qh5xf7#`, `Qd8-h4#`, and `Nc3-d5#`.
