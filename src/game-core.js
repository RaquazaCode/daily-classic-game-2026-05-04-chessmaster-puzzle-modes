export const BOARD_SIZE = 8;
export const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
export const STARTING_CLOCK_MS = 90_000;
export const MOVE_INCREMENT_MS = 1_000;
export const CAPTURE_BONUS_MS = 2_500;
export const PIECE_LABELS = {
  pawn: "P",
  knight: "N",
  bishop: "B",
  rook: "R",
  queen: "Q",
  king: "K"
};

const BACK_RANK = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"];
const PIECE_VALUES = {
  pawn: 100,
  knight: 320,
  bishop: 330,
  rook: 500,
  queen: 900,
  king: 0
};
const CHECK_BONUS = 35;
const CHECKMATE_BONUS = 600;
const FLAG_BONUS = 320;
const TIME_BONUS_PER_SECOND = 10;

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

function createState(seed) {
  return {
    seed,
    phase: "title",
    board: createInitialBoard(),
    turn: "white",
    selected: null,
    legalTargets: [],
    clocks: {
      white: STARTING_CLOCK_MS,
      black: STARTING_CLOCK_MS
    },
    score: {
      white: 0,
      black: 0
    },
    captured: {
      white: [],
      black: []
    },
    castlingRights: {
      white: { kingSide: true, queenSide: true },
      black: { kingSide: true, queenSide: true }
    },
    enPassant: null,
    check: null,
    winner: null,
    winnerReason: null,
    status: "Press Enter to start. White moves first.",
    moveHistory: [],
    lastMove: null,
    fullmoveNumber: 1,
    incrementMs: MOVE_INCREMENT_MS,
    captureBonusMs: CAPTURE_BONUS_MS
  };
}

export function createGame(seed = 20260428) {
  return createState(seed);
}

export function resetGame(state, seed = state.seed, autoStart = false) {
  Object.assign(state, createState(seed));
  if (autoStart) {
    startGame(state);
  }
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

export function startGame(state) {
  if (state.phase === "gameover") {
    resetGame(state, state.seed, true);
    return true;
  }
  if (state.phase === "paused") {
    state.phase = "running";
    state.status = currentTurnStatus(state);
    return true;
  }
  if (state.phase === "title") {
    state.phase = "running";
    state.status = currentTurnStatus(state);
    return true;
  }
  return false;
}

export function togglePause(state) {
  if (state.phase === "running") {
    state.phase = "paused";
    clearSelection(state);
    state.status = "Clocks paused. Press P to resume.";
    return true;
  }
  if (state.phase === "paused") {
    state.phase = "running";
    state.status = currentTurnStatus(state);
    return true;
  }
  return false;
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
    state.status = "Stalemate. No legal moves remain for either attack to continue.";
    return;
  }

  const timeBonus = Math.floor(state.clocks[winner] / 1_000) * TIME_BONUS_PER_SECOND;
  state.score[winner] += timeBonus;

  if (reason === "checkmate") {
    state.score[winner] += CHECKMATE_BONUS;
    state.status = `Checkmate. ${capitalize(winner)} wins the board and banks ${timeBonus} clock points.`;
    return;
  }

  state.score[winner] += FLAG_BONUS;
  state.status = `${capitalize(winner)} wins on time and banks ${timeBonus} clock points.`;
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

function applyResolvedMove(state, move) {
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
    state.score[mover] += PIECE_VALUES[capturedPiece.type];
  }

  state.clocks[mover] += state.incrementMs;
  if (capturedPiece) {
    state.clocks[mover] += state.captureBonusMs;
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

  if (flags.check) {
    state.score[mover] += CHECK_BONUS;
  }

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

export function makeMove(state, fromSquare, toSquare) {
  if (state.phase !== "running") {
    state.status = "Start the match before moving pieces.";
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

  return applyResolvedMove(state, move);
}

export function clickSquare(state, row, col) {
  if (!inBounds(row, col)) {
    return { ok: false, reason: "out-of-bounds" };
  }
  if (state.phase !== "running") {
    state.status = "Press Enter to start the clocks first.";
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
      return applyResolvedMove(state, move);
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
    state.status = `Choose a ${state.turn} piece with a legal move.`;
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
  if (state.phase !== "running" || ms <= 0) {
    return false;
  }

  state.clocks[state.turn] = Math.max(0, state.clocks[state.turn] - ms);
  if (state.clocks[state.turn] === 0) {
    endGame(state, opponent(state.turn), "flag");
  }
  return true;
}

export function renderGameToText(state) {
  const selectedCoord = state.selected ? keyToCoord(state.selected) : null;
  const payload = {
    phase: state.phase,
    turn: state.turn,
    winner: state.winner,
    winnerReason: state.winnerReason,
    check: state.check,
    selected: selectedCoord ? coordToAlgebraic(selectedCoord.row, selectedCoord.col) : null,
    legalTargets: state.legalTargets.map((key) => {
      const coord = keyToCoord(key);
      return coordToAlgebraic(coord.row, coord.col);
    }),
    clocks: {
      white: Math.round(state.clocks.white),
      black: Math.round(state.clocks.black)
    },
    score: { ...state.score },
    captured: {
      white: [...state.captured.white],
      black: [...state.captured.black]
    },
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
