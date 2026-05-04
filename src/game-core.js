export const BOARD_SIZE = 8;
export const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
export const PIECE_LABELS = {
  pawn: "P",
  knight: "N",
  bishop: "B",
  rook: "R",
  queen: "Q",
  king: "K"
};

export const SOLVE_BONUS_PER_SECOND = 18;
export const PUZZLE_CLEAR_BASE = 240;
export const MISTAKE_PENALTY = 90;
export const TRANSITION_MS = 1_000;

const BACK_RANK = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"];

const PUZZLES = [
  {
    id: "scholar-finish",
    title: "Scholar Finish",
    objective: "White to move and mate in one.",
    hint: "The queen-bishop battery is already aimed at f7.",
    playerColor: "white",
    solveWindowMs: 32_000,
    setupMoves: [
      ["e2", "e4"],
      ["e7", "e5"],
      ["d1", "h5"],
      ["b8", "c6"],
      ["f1", "c4"],
      ["g8", "f6"]
    ],
    solution: ["h5", "f7"]
  },
  {
    id: "fools-net",
    title: "Fool's Net",
    objective: "Black to move and mate in one.",
    hint: "The dark-square diagonal to h4 is wide open.",
    playerColor: "black",
    solveWindowMs: 24_000,
    setupMoves: [
      ["f2", "f3"],
      ["e7", "e5"],
      ["g2", "g4"]
    ],
    solution: ["d8", "h4"]
  },
  {
    id: "legalls-snap",
    title: "Legall's Snap",
    objective: "White to move and finish the queen sacrifice with mate in one.",
    hint: "The knight jump ends the attack before the stolen queen can matter.",
    playerColor: "white",
    solveWindowMs: 38_000,
    setupMoves: [
      ["e2", "e4"],
      ["e7", "e5"],
      ["g1", "f3"],
      ["b8", "c6"],
      ["f1", "c4"],
      ["d7", "d6"],
      ["b1", "c3"],
      ["c8", "g4"],
      ["h2", "h3"],
      ["g4", "h5"],
      ["f3", "e5"],
      ["h5", "d1"],
      ["c4", "f7"],
      ["e8", "e7"]
    ],
    solution: ["c3", "d5"]
  }
];

function makePiece(color, type) {
  return { color, type };
}

function createInitialBoard() {
  const board = Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => null));

  for (let col = 0; col < BOARD_SIZE; col += 1) {
    board[0][col] = makePiece("black", BACK_RANK[col]);
    board[1][col] = makePiece("black", "pawn");
    board[6][col] = makePiece("white", "pawn");
    board[7][col] = makePiece("white", BACK_RANK[col]);
  }

  return board;
}

function cloneBoard(board) {
  return board.map((row) => row.map((piece) => (piece ? { ...piece } : null)));
}

function cloneCastlingRights(rights) {
  return {
    white: { ...rights.white },
    black: { ...rights.black }
  };
}

function cloneMoveHistory(moveHistory) {
  return moveHistory.map((move) => ({ ...move }));
}

function cloneLastMove(lastMove) {
  if (!lastMove) {
    return null;
  }
  return {
    ...lastMove,
    from: { ...lastMove.from },
    to: { ...lastMove.to }
  };
}

function inBounds(row, col) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function squareKey(row, col) {
  return `${row},${col}`;
}

function keyToCoord(key) {
  const [row, col] = key.split(",").map((value) => Number.parseInt(value, 10));
  return { row, col };
}

function capitalize(value) {
  return `${value[0].toUpperCase()}${value.slice(1)}`;
}

function homeRow(color) {
  return color === "white" ? 7 : 0;
}

function opponent(color) {
  return color === "white" ? "black" : "white";
}

export function coordToAlgebraic(row, col) {
  return `${FILES[col]}${BOARD_SIZE - row}`;
}

export function algebraicToCoord(square) {
  if (typeof square !== "string" || square.length < 2) {
    return null;
  }
  const file = square[0].toLowerCase();
  const rank = Number.parseInt(square.slice(1), 10);
  const col = FILES.indexOf(file);
  const row = BOARD_SIZE - rank;
  if (col < 0 || Number.isNaN(rank) || !inBounds(row, col)) {
    return null;
  }
  return { row, col };
}

export function getPieceToken(piece) {
  if (!piece) {
    return "__";
  }
  return `${piece.color[0]}${PIECE_LABELS[piece.type]}`;
}

function boardAsRows(board) {
  return board.map((row) => row.map((piece) => getPieceToken(piece)));
}

function listMaterial(captured) {
  if (captured.length === 0) {
    return "None";
  }
  return captured.map((type) => PIECE_LABELS[type]).join(" ");
}

function createBoardState(seed) {
  return {
    seed,
    phase: "title",
    board: createInitialBoard(),
    turn: "white",
    selected: null,
    legalTargets: [],
    castlingRights: {
      white: { kingSide: true, queenSide: true },
      black: { kingSide: true, queenSide: true }
    },
    enPassant: null,
    check: null,
    winner: null,
    winnerReason: null,
    status: "",
    moveHistory: [],
    lastMove: null,
    fullmoveNumber: 1,
    captured: {
      white: [],
      black: []
    },
    currentPuzzleIndex: 0,
    pendingPuzzleIndex: null,
    transitionMs: 0,
    solveClockMs: 0,
    totalScore: 0,
    totalMistakes: 0,
    solvedPuzzles: []
  };
}

function snapshotBoardState(state) {
  return {
    board: cloneBoard(state.board),
    turn: state.turn,
    castlingRights: cloneCastlingRights(state.castlingRights),
    enPassant: state.enPassant ? { ...state.enPassant } : null,
    check: state.check,
    lastMove: cloneLastMove(state.lastMove),
    moveHistory: cloneMoveHistory(state.moveHistory),
    fullmoveNumber: state.fullmoveNumber,
    captured: {
      white: [...state.captured.white],
      black: [...state.captured.black]
    }
  };
}

function restoreBoardState(state, snapshot) {
  state.board = cloneBoard(snapshot.board);
  state.turn = snapshot.turn;
  state.castlingRights = cloneCastlingRights(snapshot.castlingRights);
  state.enPassant = snapshot.enPassant ? { ...snapshot.enPassant } : null;
  state.check = snapshot.check;
  state.lastMove = cloneLastMove(snapshot.lastMove);
  state.moveHistory = cloneMoveHistory(snapshot.moveHistory);
  state.fullmoveNumber = snapshot.fullmoveNumber;
  state.captured = {
    white: [...snapshot.captured.white],
    black: [...snapshot.captured.black]
  };
  clearSelection(state);
  state.winner = null;
  state.winnerReason = null;
}

function clearSelection(state) {
  state.selected = null;
  state.legalTargets = [];
}

function currentTurnStatus(state) {
  if (state.check === state.turn) {
    return `${capitalize(state.turn)} to move under check.`;
  }
  return `${capitalize(state.turn)} to move.`;
}

function findKing(board, color) {
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const piece = board[row][col];
      if (piece && piece.color === color && piece.type === "king") {
        return { row, col };
      }
    }
  }
  return null;
}

function isSquareAttacked(board, targetRow, targetCol, byColor) {
  const pawnRow = targetRow + (byColor === "white" ? 1 : -1);
  for (const dc of [-1, 1]) {
    const pawnCol = targetCol + dc;
    if (inBounds(pawnRow, pawnCol)) {
      const pawn = board[pawnRow][pawnCol];
      if (pawn && pawn.color === byColor && pawn.type === "pawn") {
        return true;
      }
    }
  }

  const knightOffsets = [
    [-2, -1],
    [-2, 1],
    [-1, -2],
    [-1, 2],
    [1, -2],
    [1, 2],
    [2, -1],
    [2, 1]
  ];
  for (const [dr, dc] of knightOffsets) {
    const row = targetRow + dr;
    const col = targetCol + dc;
    if (!inBounds(row, col)) {
      continue;
    }
    const piece = board[row][col];
    if (piece && piece.color === byColor && piece.type === "knight") {
      return true;
    }
  }

  const kingOffsets = [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1]
  ];
  for (const [dr, dc] of kingOffsets) {
    const row = targetRow + dr;
    const col = targetCol + dc;
    if (!inBounds(row, col)) {
      continue;
    }
    const piece = board[row][col];
    if (piece && piece.color === byColor && piece.type === "king") {
      return true;
    }
  }

  const bishopDirs = [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1]
  ];
  for (const [dr, dc] of bishopDirs) {
    let row = targetRow + dr;
    let col = targetCol + dc;
    while (inBounds(row, col)) {
      const piece = board[row][col];
      if (piece) {
        if (piece.color === byColor && (piece.type === "bishop" || piece.type === "queen")) {
          return true;
        }
        break;
      }
      row += dr;
      col += dc;
    }
  }

  const rookDirs = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1]
  ];
  for (const [dr, dc] of rookDirs) {
    let row = targetRow + dr;
    let col = targetCol + dc;
    while (inBounds(row, col)) {
      const piece = board[row][col];
      if (piece) {
        if (piece.color === byColor && (piece.type === "rook" || piece.type === "queen")) {
          return true;
        }
        break;
      }
      row += dr;
      col += dc;
    }
  }

  return false;
}

function isColorInCheckOnBoard(board, color) {
  const king = findKing(board, color);
  if (!king) {
    return true;
  }
  return isSquareAttacked(board, king.row, king.col, opponent(color));
}

function revokeRookRightsAtSquare(castlingRights, color, row, col) {
  const backRow = homeRow(color);
  if (row !== backRow) {
    return;
  }
  if (col === 0) {
    castlingRights[color].queenSide = false;
  } else if (col === 7) {
    castlingRights[color].kingSide = false;
  }
}

function canCastle(state, color, side) {
  const backRow = homeRow(color);
  const rights = state.castlingRights[color];
  const king = state.board[backRow][4];
  const rookCol = side === "king" ? 7 : 0;
  const rook = state.board[backRow][rookCol];

  if (!rights[side === "king" ? "kingSide" : "queenSide"]) {
    return false;
  }
  if (!king || king.color !== color || king.type !== "king") {
    return false;
  }
  if (!rook || rook.color !== color || rook.type !== "rook") {
    return false;
  }
  if (isColorInCheckOnBoard(state.board, color)) {
    return false;
  }

  const emptyCols = side === "king" ? [5, 6] : [1, 2, 3];
  for (const col of emptyCols) {
    if (state.board[backRow][col]) {
      return false;
    }
  }

  const safeCols = side === "king" ? [5, 6] : [3, 2];
  for (const col of safeCols) {
    if (isSquareAttacked(state.board, backRow, col, opponent(color))) {
      return false;
    }
  }

  return true;
}

function makeMoveObject(fromRow, fromCol, toRow, toCol, piece, extra = {}) {
  return {
    from: { row: fromRow, col: fromCol },
    to: { row: toRow, col: toCol },
    color: piece.color,
    pieceType: piece.type,
    captureSquare: null,
    promotion: null,
    castle: null,
    doubleStep: false,
    ...extra
  };
}

function pushSlidingMoves(moves, state, row, col, piece, directions) {
  for (const [dr, dc] of directions) {
    let targetRow = row + dr;
    let targetCol = col + dc;
    while (inBounds(targetRow, targetCol)) {
      const occupant = state.board[targetRow][targetCol];
      if (!occupant) {
        moves.push(makeMoveObject(row, col, targetRow, targetCol, piece));
      } else {
        if (occupant.color !== piece.color && occupant.type !== "king") {
          moves.push(
            makeMoveObject(row, col, targetRow, targetCol, piece, {
              captureSquare: { row: targetRow, col: targetCol }
            })
          );
        }
        break;
      }
      targetRow += dr;
      targetCol += dc;
    }
  }
}

function generatePseudoMoves(state, row, col, piece) {
  const moves = [];

  if (piece.type === "pawn") {
    const direction = piece.color === "white" ? -1 : 1;
    const startRow = piece.color === "white" ? 6 : 1;
    const promotionRow = piece.color === "white" ? 0 : 7;
    const oneRow = row + direction;

    if (inBounds(oneRow, col) && !state.board[oneRow][col]) {
      moves.push(
        makeMoveObject(row, col, oneRow, col, piece, {
          promotion: oneRow === promotionRow ? "queen" : null
        })
      );

      const twoRow = row + direction * 2;
      if (row === startRow && !state.board[twoRow][col]) {
        moves.push(
          makeMoveObject(row, col, twoRow, col, piece, {
            doubleStep: true
          })
        );
      }
    }

    for (const dc of [-1, 1]) {
      const targetRow = row + direction;
      const targetCol = col + dc;
      if (!inBounds(targetRow, targetCol)) {
        continue;
      }
      const occupant = state.board[targetRow][targetCol];
      if (occupant && occupant.color !== piece.color && occupant.type !== "king") {
        moves.push(
          makeMoveObject(row, col, targetRow, targetCol, piece, {
            captureSquare: { row: targetRow, col: targetCol },
            promotion: targetRow === promotionRow ? "queen" : null
          })
        );
      }
      if (
        state.enPassant &&
        state.enPassant.row === targetRow &&
        state.enPassant.col === targetCol
      ) {
        moves.push(
          makeMoveObject(row, col, targetRow, targetCol, piece, {
            captureSquare: { row, col: targetCol }
          })
        );
      }
    }

    return moves;
  }

  if (piece.type === "knight") {
    const offsets = [
      [-2, -1],
      [-2, 1],
      [-1, -2],
      [-1, 2],
      [1, -2],
      [1, 2],
      [2, -1],
      [2, 1]
    ];
    for (const [dr, dc] of offsets) {
      const targetRow = row + dr;
      const targetCol = col + dc;
      if (!inBounds(targetRow, targetCol)) {
        continue;
      }
      const occupant = state.board[targetRow][targetCol];
      if (!occupant) {
        moves.push(makeMoveObject(row, col, targetRow, targetCol, piece));
      } else if (occupant.color !== piece.color && occupant.type !== "king") {
        moves.push(
          makeMoveObject(row, col, targetRow, targetCol, piece, {
            captureSquare: { row: targetRow, col: targetCol }
          })
        );
      }
    }
    return moves;
  }

  if (piece.type === "bishop") {
    pushSlidingMoves(moves, state, row, col, piece, [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1]
    ]);
    return moves;
  }

  if (piece.type === "rook") {
    pushSlidingMoves(moves, state, row, col, piece, [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1]
    ]);
    return moves;
  }

  if (piece.type === "queen") {
    pushSlidingMoves(moves, state, row, col, piece, [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1]
    ]);
    return moves;
  }

  const kingOffsets = [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1]
  ];
  for (const [dr, dc] of kingOffsets) {
    const targetRow = row + dr;
    const targetCol = col + dc;
    if (!inBounds(targetRow, targetCol)) {
      continue;
    }
    const occupant = state.board[targetRow][targetCol];
    if (!occupant) {
      moves.push(makeMoveObject(row, col, targetRow, targetCol, piece));
    } else if (occupant.color !== piece.color && occupant.type !== "king") {
      moves.push(
        makeMoveObject(row, col, targetRow, targetCol, piece, {
          captureSquare: { row: targetRow, col: targetCol }
        })
      );
    }
  }

  if (canCastle(state, piece.color, "king")) {
    moves.push(
      makeMoveObject(row, col, row, 6, piece, {
        castle: "king"
      })
    );
  }
  if (canCastle(state, piece.color, "queen")) {
    moves.push(
      makeMoveObject(row, col, row, 2, piece, {
        castle: "queen"
      })
    );
  }

  return moves;
}

function simulateMove(state, move) {
  const board = cloneBoard(state.board);
  const castlingRights = cloneCastlingRights(state.castlingRights);
  const movingPiece = board[move.from.row][move.from.col]
    ? { ...board[move.from.row][move.from.col] }
    : null;

  if (!movingPiece) {
    return null;
  }

  let capturedPiece = null;
  board[move.from.row][move.from.col] = null;

  if (move.captureSquare) {
    capturedPiece = board[move.captureSquare.row][move.captureSquare.col];
    board[move.captureSquare.row][move.captureSquare.col] = null;
    if (capturedPiece) {
      revokeRookRightsAtSquare(
        castlingRights,
        capturedPiece.color,
        move.captureSquare.row,
        move.captureSquare.col
      );
    }
  }

  if (movingPiece.type === "king") {
    castlingRights[movingPiece.color].kingSide = false;
    castlingRights[movingPiece.color].queenSide = false;
  }
  if (movingPiece.type === "rook") {
    revokeRookRightsAtSquare(castlingRights, movingPiece.color, move.from.row, move.from.col);
  }

  if (move.castle) {
    board[move.to.row][move.to.col] = movingPiece;
    if (move.castle === "king") {
      const rook = board[move.from.row][7];
      board[move.from.row][7] = null;
      board[move.from.row][5] = rook;
    } else {
      const rook = board[move.from.row][0];
      board[move.from.row][0] = null;
      board[move.from.row][3] = rook;
    }
  } else {
    board[move.to.row][move.to.col] = movingPiece;
  }

  if (move.promotion) {
    board[move.to.row][move.to.col].type = move.promotion;
  }

  let enPassant = null;
  if (movingPiece.type === "pawn" && move.doubleStep) {
    enPassant = {
      row: (move.from.row + move.to.row) / 2,
      col: move.from.col
    };
  }

  return {
    board,
    castlingRights,
    enPassant,
    capturedPiece: capturedPiece ? { ...capturedPiece } : null
  };
}

function isLegalMove(state, move) {
  const snapshot = simulateMove(state, move);
  if (!snapshot) {
    return false;
  }
  return !isColorInCheckOnBoard(snapshot.board, move.color);
}

function generateLegalMoveMap(state, color) {
  const map = new Map();

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const piece = state.board[row][col];
      if (!piece || piece.color !== color) {
        continue;
      }
      const legal = generatePseudoMoves(state, row, col, piece).filter((move) => isLegalMove(state, move));
      if (legal.length > 0) {
        map.set(squareKey(row, col), legal);
      }
    }
  }

  return map;
}

function endGame(state, winner, reason) {
  state.phase = "gameover";
  state.winner = winner;
  state.winnerReason = reason;
  clearSelection(state);

  if (!winner) {
    state.status = "Stalemate. The attack runs out of squares.";
    return;
  }

  if (reason === "checkmate") {
    state.status = `${capitalize(winner)} delivers checkmate.`;
    return;
  }

  state.status = `${capitalize(winner)} wins on the solve clock.`;
}

function buildNotation(move, flags) {
  if (move.castle === "king") {
    return `O-O${flags.checkmate ? "#" : flags.check ? "+" : ""}`;
  }
  if (move.castle === "queen") {
    return `O-O-O${flags.checkmate ? "#" : flags.check ? "+" : ""}`;
  }

  const from = coordToAlgebraic(move.from.row, move.from.col);
  const to = coordToAlgebraic(move.to.row, move.to.col);
  const pieceLead = move.pieceType === "pawn" ? "" : PIECE_LABELS[move.pieceType];
  const action = move.captureSquare ? "x" : "-";
  const promotion = move.promotion ? `=${PIECE_LABELS[move.promotion]}` : "";
  const suffix = flags.checkmate ? "#" : flags.check ? "+" : "";
  const origin = move.pieceType === "pawn" && move.captureSquare ? FILES[move.from.col] : from;

  return `${pieceLead}${origin}${action}${to}${promotion}${suffix}`;
}

function applyEngineMove(state, move) {
  const beforeMoveNumber = state.fullmoveNumber;
  const mover = move.color;
  const nextTurn = opponent(mover);
  const snapshot = simulateMove(state, move);
  const capturedPiece = snapshot.capturedPiece;

  state.board = snapshot.board;
  state.castlingRights = snapshot.castlingRights;
  state.enPassant = snapshot.enPassant;
  state.lastMove = {
    from: { ...move.from },
    to: { ...move.to },
    color: mover
  };

  if (capturedPiece) {
    state.captured[mover].push(capturedPiece.type);
  }

  state.turn = nextTurn;
  state.check = isColorInCheckOnBoard(state.board, state.turn) ? state.turn : null;

  const legalMap = generateLegalMoveMap(state, state.turn);
  const hasLegalMoves = legalMap.size > 0;
  const flags = {
    check: state.check === state.turn,
    checkmate: state.check === state.turn && !hasLegalMoves
  };
  const stalemate = state.check !== state.turn && !hasLegalMoves;

  const notation = buildNotation(move, flags);
  state.lastMove.notation = notation;
  state.moveHistory.push({
    moveNumber: beforeMoveNumber,
    color: mover,
    notation,
    from: coordToAlgebraic(move.from.row, move.from.col),
    to: coordToAlgebraic(move.to.row, move.to.col),
    capture: Boolean(move.captureSquare)
  });

  if (mover === "black") {
    state.fullmoveNumber += 1;
  }

  if (flags.checkmate) {
    endGame(state, mover, "checkmate");
  } else if (stalemate) {
    endGame(state, null, "stalemate");
  } else {
    state.status = flags.check
      ? `${capitalize(state.turn)} is in check.`
      : currentTurnStatus(state);
  }

  clearSelection(state);

  return {
    ok: true,
    reason: "move-made",
    notation
  };
}

function resolveMoveByCoords(state, fromRow, fromCol, toRow, toCol) {
  const legalMap = generateLegalMoveMap(state, state.turn);
  const options = legalMap.get(squareKey(fromRow, fromCol)) ?? [];
  return options.find((move) => move.to.row === toRow && move.to.col === toCol) ?? null;
}

function cloneSolvedPuzzles(entries) {
  return entries.map((entry) => ({ ...entry }));
}

function createPuzzleMessage(puzzle) {
  return `Puzzle ${puzzle.index + 1}/${PREPARED_PUZZLES.length}: ${puzzle.title}. ${capitalize(
    puzzle.playerColor
  )} to move and mate in one.`;
}

function loadPuzzle(state, index, activate) {
  const puzzle = PREPARED_PUZZLES[index];
  restoreBoardState(state, puzzle.snapshot);
  state.lastMove = null;
  state.moveHistory = [];
  state.captured = {
    white: [],
    black: []
  };
  state.currentPuzzleIndex = index;
  state.pendingPuzzleIndex = null;
  state.transitionMs = 0;
  state.solveClockMs = puzzle.solveWindowMs;
  state.phase = activate ? "running" : "title";
  state.status = activate
    ? createPuzzleMessage(puzzle)
    : `Press Enter to begin Puzzle ${index + 1}: ${puzzle.title}.`;
}

function createSessionState(seed) {
  const state = createBoardState(seed);
  state.totalScore = 0;
  state.totalMistakes = 0;
  state.solvedPuzzles = [];
  loadPuzzle(state, 0, false);
  return state;
}

function getCurrentPuzzle(state) {
  return PREPARED_PUZZLES[state.currentPuzzleIndex];
}

function resetCurrentPuzzle(state, reason) {
  const puzzle = getCurrentPuzzle(state);
  state.totalMistakes += 1;
  state.totalScore = Math.max(0, state.totalScore - MISTAKE_PENALTY);
  restoreBoardState(state, puzzle.snapshot);
  state.lastMove = null;
  state.moveHistory = [];
  state.captured = {
    white: [],
    black: []
  };
  state.phase = "running";
  state.pendingPuzzleIndex = null;
  state.transitionMs = 0;
  state.solveClockMs = puzzle.solveWindowMs;
  state.status = `${reason} Puzzle reset with a ${MISTAKE_PENALTY}-point penalty.`;
}

function markPuzzleSolved(state, notation) {
  const puzzle = getCurrentPuzzle(state);
  const bonus = PUZZLE_CLEAR_BASE + Math.floor(state.solveClockMs / 1_000) * SOLVE_BONUS_PER_SECOND;
  state.totalScore += bonus;
  state.solvedPuzzles.push({
    id: puzzle.id,
    title: puzzle.title,
    notation,
    bonus,
    playerColor: puzzle.playerColor,
    solveClockMs: Math.round(state.solveClockMs)
  });
  clearSelection(state);

  if (state.currentPuzzleIndex === PREPARED_PUZZLES.length - 1) {
    state.phase = "gameover";
    state.winner = "player";
    state.winnerReason = "all-puzzles-cleared";
    state.status = `Gauntlet cleared. ${puzzle.title} ended with ${notation}. Final score ${state.totalScore}.`;
    return {
      ok: true,
      reason: "gauntlet-cleared",
      notation,
      bonus
    };
  }

  state.phase = "transition";
  state.winner = null;
  state.winnerReason = null;
  state.pendingPuzzleIndex = state.currentPuzzleIndex + 1;
  state.transitionMs = TRANSITION_MS;
  state.status = `${puzzle.title} solved with ${notation}. Loading Puzzle ${state.pendingPuzzleIndex + 1}.`;
  return {
    ok: true,
    reason: "puzzle-solved",
    notation,
    bonus
  };
}

function commitPlayerMove(state, move) {
  const puzzle = getCurrentPuzzle(state);
  const result = applyEngineMove(state, move);

  if (
    state.phase === "gameover" &&
    state.winner === puzzle.playerColor &&
    state.winnerReason === "checkmate"
  ) {
    return markPuzzleSolved(state, result.notation);
  }

  resetCurrentPuzzle(state, `${result.notation} was legal but missed the forced mate.`);
  return {
    ok: false,
    reason: "missed-mate",
    notation: result.notation
  };
}

function preparePuzzle(rawPuzzle, index) {
  const state = createBoardState(20260504 + index);
  state.phase = "running";
  state.status = "Preparing puzzle.";

  for (const [from, to] of rawPuzzle.setupMoves) {
    const fromCoord = algebraicToCoord(from);
    const toCoord = algebraicToCoord(to);
    const move = resolveMoveByCoords(state, fromCoord.row, fromCoord.col, toCoord.row, toCoord.col);
    if (!move) {
      throw new Error(`Invalid setup move for ${rawPuzzle.id}: ${from}-${to}`);
    }
    applyEngineMove(state, move);
    if (state.phase === "gameover") {
      throw new Error(`Setup line unexpectedly ended the game for ${rawPuzzle.id}`);
    }
  }

  if (state.turn !== rawPuzzle.playerColor) {
    throw new Error(
      `Puzzle ${rawPuzzle.id} expected ${rawPuzzle.playerColor} to move, found ${state.turn}`
    );
  }

  const [solutionFrom, solutionTo] = rawPuzzle.solution;
  const fromCoord = algebraicToCoord(solutionFrom);
  const toCoord = algebraicToCoord(solutionTo);
  const solutionMove = resolveMoveByCoords(state, fromCoord.row, fromCoord.col, toCoord.row, toCoord.col);
  if (!solutionMove) {
    throw new Error(`Puzzle ${rawPuzzle.id} has an illegal solution move ${solutionFrom}-${solutionTo}`);
  }

  const probe = createBoardState(9090 + index);
  restoreBoardState(probe, snapshotBoardState(state));
  probe.phase = "running";
  const outcome = applyEngineMove(probe, solutionMove);
  if (
    probe.phase !== "gameover" ||
    probe.winner !== rawPuzzle.playerColor ||
    probe.winnerReason !== "checkmate"
  ) {
    throw new Error(`Puzzle ${rawPuzzle.id} solution does not end in checkmate`);
  }

  return {
    ...rawPuzzle,
    index,
    snapshot: snapshotBoardState(state),
    solutionNotation: outcome.notation
  };
}

const PREPARED_PUZZLES = PUZZLES.map((puzzle, index) => preparePuzzle(puzzle, index));

export function createGame(seed = 20260504) {
  return createSessionState(seed);
}

export function resetGame(state, seed = state.seed, autoStart = false) {
  Object.assign(state, createSessionState(seed));
  if (autoStart) {
    startGame(state);
  }
}

export function startGame(state) {
  if (state.phase === "gameover") {
    resetGame(state, state.seed, true);
    return true;
  }
  if (state.phase === "paused") {
    state.phase = "running";
    state.status = createPuzzleMessage(getCurrentPuzzle(state));
    return true;
  }
  if (state.phase === "title") {
    state.phase = "running";
    state.status = createPuzzleMessage(getCurrentPuzzle(state));
    return true;
  }
  return false;
}

export function togglePause(state) {
  if (state.phase === "running") {
    state.phase = "paused";
    clearSelection(state);
    state.status = "Puzzle timer paused. Press P to resume.";
    return true;
  }
  if (state.phase === "paused") {
    state.phase = "running";
    state.status = createPuzzleMessage(getCurrentPuzzle(state));
    return true;
  }
  return false;
}

export function makeMove(state, fromSquare, toSquare) {
  if (state.phase !== "running") {
    state.status = "Start the current puzzle before moving pieces.";
    return { ok: false, reason: "not-running" };
  }

  const from = typeof fromSquare === "string" ? algebraicToCoord(fromSquare) : fromSquare;
  const to = typeof toSquare === "string" ? algebraicToCoord(toSquare) : toSquare;
  if (!from || !to || !inBounds(from.row, from.col) || !inBounds(to.row, to.col)) {
    state.status = "Invalid square coordinates.";
    return { ok: false, reason: "invalid-square" };
  }

  const move = resolveMoveByCoords(state, from.row, from.col, to.row, to.col);
  if (!move) {
    state.status = `Illegal move from ${coordToAlgebraic(from.row, from.col)} to ${coordToAlgebraic(
      to.row,
      to.col
    )}.`;
    return { ok: false, reason: "illegal-move" };
  }

  return commitPlayerMove(state, move);
}

export function clickSquare(state, row, col) {
  if (!inBounds(row, col)) {
    return { ok: false, reason: "out-of-bounds" };
  }
  if (state.phase !== "running") {
    state.status = "Press Enter to activate the current puzzle.";
    return { ok: false, reason: "not-running" };
  }

  const selectedKey = state.selected;
  const targetKey = squareKey(row, col);
  const legalMap = generateLegalMoveMap(state, state.turn);

  if (selectedKey) {
    const selectedCoord = keyToCoord(selectedKey);
    const move = (legalMap.get(selectedKey) ?? []).find(
      (candidate) => candidate.to.row === row && candidate.to.col === col
    );
    if (move) {
      return commitPlayerMove(state, move);
    }
    if (selectedCoord.row === row && selectedCoord.col === col) {
      clearSelection(state);
      state.status = `${capitalize(state.turn)} cleared the selection.`;
      return { ok: true, reason: "selection-cleared" };
    }
  }

  const piece = state.board[row][col];
  if (!piece || piece.color !== state.turn) {
    clearSelection(state);
    state.status = `Choose a ${state.turn} piece that can deliver the finish.`;
    return { ok: false, reason: "wrong-piece" };
  }

  const options = legalMap.get(targetKey) ?? [];
  if (options.length === 0) {
    clearSelection(state);
    state.status = `${capitalize(state.turn)} ${piece.type} on ${coordToAlgebraic(
      row,
      col
    )} has no legal move.`;
    return { ok: false, reason: "no-legal-move" };
  }

  state.selected = targetKey;
  state.legalTargets = options.map((move) => squareKey(move.to.row, move.to.col));
  state.status = `${capitalize(state.turn)} selected ${piece.type} on ${coordToAlgebraic(row, col)}.`;
  return { ok: true, reason: "selected" };
}

export function advanceTime(state, ms) {
  if (ms <= 0) {
    return false;
  }

  if (state.phase === "running") {
    state.solveClockMs = Math.max(0, state.solveClockMs - ms);
    if (state.solveClockMs === 0) {
      resetCurrentPuzzle(state, "Solve clock expired.");
    }
    return true;
  }

  if (state.phase === "transition") {
    state.transitionMs = Math.max(0, state.transitionMs - ms);
    if (state.transitionMs === 0 && state.pendingPuzzleIndex != null) {
      loadPuzzle(state, state.pendingPuzzleIndex, true);
    }
    return true;
  }

  return false;
}

export function renderGameToText(state) {
  const selectedCoord = state.selected ? keyToCoord(state.selected) : null;
  const puzzle = getCurrentPuzzle(state);
  const payload = {
    phase: state.phase,
    puzzleIndex: state.currentPuzzleIndex + 1,
    puzzleCount: PREPARED_PUZZLES.length,
    puzzleId: puzzle.id,
    puzzleTitle: puzzle.title,
    objective: puzzle.objective,
    hint: puzzle.hint,
    playerColor: puzzle.playerColor,
    turn: state.turn,
    winner: state.winner,
    winnerReason: state.winnerReason,
    check: state.check,
    selected: selectedCoord ? coordToAlgebraic(selectedCoord.row, selectedCoord.col) : null,
    legalTargets: state.legalTargets.map((key) => {
      const coord = keyToCoord(key);
      return coordToAlgebraic(coord.row, coord.col);
    }),
    solveClockMs: Math.round(state.solveClockMs),
    transitionMs: Math.round(state.transitionMs),
    totalScore: state.totalScore,
    totalMistakes: state.totalMistakes,
    solvedCount: state.solvedPuzzles.length,
    solvedPuzzles: cloneSolvedPuzzles(state.solvedPuzzles),
    lastMove: state.lastMove?.notation ?? null,
    moveHistory: state.moveHistory.map((move) => ({
      moveNumber: move.moveNumber,
      color: move.color,
      notation: move.notation
    })),
    board: boardAsRows(state.board),
    materialText: {
      white: listMaterial(state.captured.white),
      black: listMaterial(state.captured.black)
    },
    status: state.status
  };

  return JSON.stringify(payload);
}
