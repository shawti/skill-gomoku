import { create } from "zustand";

export type Player = "black" | "white";
export type Cell = Player | null;

export interface Move { row: number; col: number; player: Player }
export interface Position { row: number; col: number }

interface GameState {
  boardSize: number;
  board: Cell[][];
  moves: Move[];
  currentPlayer: Player;
  winner: Player | null;
  winningLine: Position[];
  aiEnabled: boolean;
  aiPlayer: Player;
  placeStone: (row: number, col: number) => void;
  reset: (size?: number) => void;
  undo: () => void;
  setBoardSize: (size: number) => void;
  setAiEnabled: (enabled: boolean) => void;
  setAiPlayer: (player: Player) => void;
  makeAiMove: () => void;
}

const createEmptyBoard = (n: number): Cell[][] =>
  Array.from({ length: n }, () => Array<Cell>(n).fill(null));

function inBounds(n: number, r: number, c: number) {
  return r >= 0 && c >= 0 && r < n && c < n;
}

function checkWin(board: Cell[][], row: number, col: number, player: Player) {
  const n = board.length;
  const dirs: Array<[number, number]> = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];
  for (const [dr, dc] of dirs) {
    let count = 1;
    const positions: Position[] = [{ row, col }];
    // forward
    let r = row + dr;
    let c = col + dc;
    while (inBounds(n, r, c) && board[r][c] === player) {
      positions.push({ row: r, col: c });
      count++;
      r += dr;
      c += dc;
    }
    // backward
    r = row - dr;
    c = col - dc;
    while (inBounds(n, r, c) && board[r][c] === player) {
      positions.unshift({ row: r, col: c });
      count++;
      r -= dr;
      c -= dc;
    }
    if (count >= 5) {
      return { winner: player as Player, line: positions };
    }
  }
  return { winner: null as Player | null, line: [] as Position[] };
}

function getEmptyPositions(board: Cell[][]): Position[] {
  const n = board.length;
  const res: Position[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (board[r][c] === null) res.push({ row: r, col: c });
    }
  }
  return res;
}

function longestLineIfPlaced(board: Cell[][], row: number, col: number, player: Player) {
  const n = board.length;
  const dirs: Array<[number, number]> = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];
  let best = 1;
  for (const [dr, dc] of dirs) {
    let count = 1;
    // forward
    let r = row + dr;
    let c = col + dc;
    while (inBounds(n, r, c) && ((r === row && c === col) || board[r][c] === player)) {
      if (!(r === row && c === col)) count++;
      r += dr;
      c += dc;
    }
    // backward
    r = row - dr;
    c = col - dc;
    while (inBounds(n, r, c) && ((r === row && c === col) || board[r][c] === player)) {
      if (!(r === row && c === col)) count++;
      r -= dr;
      c -= dc;
    }
    if (count > best) best = count;
  }
  return best;
}

function evaluateBoard(board: Cell[][], ai: Player): number {
  const n = board.length;
  const toChar = (cell: Cell) => (cell === null ? "." : cell === ai ? "X" : "O");
  function scoreLine(s: string): number {
    let sc = 0;
    const posPatterns: Array<[string, number]> = [
      ["XXXXX", 1000000],
      [".XXXX.", 120000],
      ["XXXX.", 50000],
      [".XXXX", 50000],
      [".XXX.", 6000],
      ["XXX..", 1500],
      ["..XXX", 1500],
      [".XX.", 600],
      ["XX..", 180],
      ["..XX", 180],
    ];
    for (const [pat, w] of posPatterns) {
      for (let i = 0; i <= s.length - pat.length; i++) {
        if (s.substring(i, i + pat.length) === pat) sc += w;
      }
    }
    const negPatterns: Array<[string, number]> = [
      ["OOOOO", 1000000],
      [".OOOO.", 100000],
      ["OOOO.", 40000],
      [".OOOO", 40000],
      [".OOO.", 3500],
      ["OOO..", 900],
      ["..OOO", 900],
      [".OO.", 300],
      ["OO..", 100],
      ["..OO", 100],
    ];
    for (const [pat, w] of negPatterns) {
      for (let i = 0; i <= s.length - pat.length; i++) {
        if (s.substring(i, i + pat.length) === pat) sc -= w;
      }
    }
    return sc;
  }
  let total = 0;
  // rows
  for (let r = 0; r < n; r++) {
    let s = "";
    for (let c = 0; c < n; c++) s += toChar(board[r][c]);
    total += scoreLine(s);
  }
  // cols
  for (let c = 0; c < n; c++) {
    let s = "";
    for (let r = 0; r < n; r++) s += toChar(board[r][c]);
    total += scoreLine(s);
  }
  // diag ↘ and ↙
  for (let k = 0; k < n; k++) {
    // start at (k,0) ↘
    let s1 = "";
    for (let r = k, c = 0; r < n && c < n; r++, c++) s1 += toChar(board[r][c]);
    if (s1.length >= 5) total += scoreLine(s1);
    if (k > 0) {
      let s2 = "";
      for (let r = 0, c = k; r < n && c < n; r++, c++) s2 += toChar(board[r][c]);
      if (s2.length >= 5) total += scoreLine(s2);
    }
    // start at (k,n-1) ↙
    let s3 = "";
    for (let r = k, c = n - 1; r < n && c >= 0; r++, c--) s3 += toChar(board[r][c]);
    if (s3.length >= 5) total += scoreLine(s3);
    if (k < n - 1) {
      let s4 = "";
      for (let r = 0, c = n - 1 - k; r < n && c >= 0; r++, c--) s4 += toChar(board[r][c]);
      if (s4.length >= 5) total += scoreLine(s4);
    }
  }
  return total;
}

function getCandidatePositions(board: Cell[][]): Position[] {
  const n = board.length;
  const res: Position[] = [];
  let hasStone = false;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (board[r][c] !== null) { hasStone = true; break; }
    }
    if (hasStone) break;
  }
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (board[r][c] !== null) continue;
      if (!hasStone) { res.push({ row: r, col: c }); continue; }
      let near = false;
      for (let dr = -2; dr <= 2 && !near; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          if (dr === 0 && dc === 0) continue;
          const rr = r + dr, cc = c + dc;
          if (inBounds(n, rr, cc) && board[rr][cc] !== null) { near = true; break; }
        }
      }
      if (near) res.push({ row: r, col: c });
    }
  }
  return res;
}

function countStones(board: Cell[][]): number {
  const n = board.length;
  let s = 0;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (board[r][c] !== null) s++;
    }
  }
  return s;
}

function alphaBeta(
  board: Cell[][],
  depth: number,
  alpha: number,
  beta: number,
  currentPlayer: Player,
  ai: Player,
  lastMove?: { row: number; col: number; player: Player }
): number {
  if (lastMove) {
    const res = checkWin(board, lastMove.row, lastMove.col, lastMove.player);
    if (res.winner) {
      return res.winner === ai ? 1000000 - (100 - depth) : -1000000 + (100 - depth);
    }
  }
  if (depth === 0) {
    return evaluateBoard(board, ai);
  }
  const n = board.length;
  const candidates = getCandidatePositions(board);
  const center = (n - 1) / 2;
  const stones = countStones(board);
  const maxCandidates = stones < 8 ? 30 : stones < 20 ? 24 : 18;
  const ordered = candidates.slice().sort((a, b) => {
    const ca = longestLineIfPlaced(board, a.row, a.col, currentPlayer);
    const cb = longestLineIfPlaced(board, b.row, b.col, currentPlayer);
    const ma = Math.abs(a.row - center) + Math.abs(a.col - center);
    const mb = Math.abs(b.row - center) + Math.abs(b.col - center);
    return (cb * 200 - mb * 2) - (ca * 200 - ma * 2);
  });
  const list = ordered.slice(0, maxCandidates);
  const next = (p: Player): Player => (p === "black" ? "white" : "black");
  if (currentPlayer === ai) {
    let value = -Infinity;
    for (const pos of list) {
      const nextBoard = board.map((r) => r.slice());
      nextBoard[pos.row][pos.col] = currentPlayer;
      const child = alphaBeta(nextBoard, depth - 1, alpha, beta, next(currentPlayer), ai, {
        row: pos.row,
        col: pos.col,
        player: currentPlayer,
      });
      if (child > value) value = child;
      if (value > alpha) alpha = value;
      if (alpha >= beta) break;
    }
    return value;
  } else {
    let value = Infinity;
    for (const pos of list) {
      const nextBoard = board.map((r) => r.slice());
      nextBoard[pos.row][pos.col] = currentPlayer;
      const child = alphaBeta(nextBoard, depth - 1, alpha, beta, next(currentPlayer), ai, {
        row: pos.row,
        col: pos.col,
        player: currentPlayer,
      });
      if (child < value) value = child;
      if (value < beta) beta = value;
      if (alpha >= beta) break;
    }
    return value;
  }
}

function findBestMoveAlphaBeta(board: Cell[][], ai: Player): Position | null {
  const n = board.length;
  const stones = countStones(board);
  if (stones === 0) return { row: Math.floor(n / 2), col: Math.floor(n / 2) };
  const empties = getCandidatePositions(board);
  if (empties.length === 0) return null;
  let depth = 2;
  if (n <= 15) {
    depth = stones < 10 ? 3 : 2;
  } else {
    depth = 2;
  }
  let bestVal = -Infinity;
  let bestPos: Position | null = null;
  const center = (n - 1) / 2;
  const ordered = empties.slice().sort((a, b) => {
    const ca = longestLineIfPlaced(board, a.row, a.col, ai);
    const cb = longestLineIfPlaced(board, b.row, b.col, ai);
    const ma = Math.abs(a.row - center) + Math.abs(a.col - center);
    const mb = Math.abs(b.row - center) + Math.abs(b.col - center);
    return (cb * 200 - mb * 2) - (ca * 200 - ma * 2);
  });
  const opponent: Player = ai === "black" ? "white" : "black";
  const maxRoot = stones < 8 ? 40 : stones < 20 ? 26 : 20;
  for (const pos of ordered.slice(0, maxRoot)) {
    const nextBoard = board.map((r) => r.slice());
    nextBoard[pos.row][pos.col] = ai;
    const res = checkWin(nextBoard, pos.row, pos.col, ai);
    if (res.winner === ai) return pos;
    const val = alphaBeta(nextBoard, depth - 1, -Infinity, Infinity, opponent, ai, {
      row: pos.row,
      col: pos.col,
      player: ai,
    });
    if (val > bestVal) {
      bestVal = val;
      bestPos = pos;
    }
  }
  return bestPos;
}

export const useGameStore = create<GameState>((set, get) => ({
  boardSize: 15,
  board: createEmptyBoard(15),
  moves: [],
  currentPlayer: "black",
  winner: null,
  winningLine: [],
  aiEnabled: true,
  aiPlayer: "white",
  placeStone: (row, col) => {
    const { board, currentPlayer, winner } = get();
    if (winner || board[row][col] !== null) return;
    const nextBoard = board.map((rowArr) => rowArr.slice());
    nextBoard[row][col] = currentPlayer;
    const res = checkWin(nextBoard, row, col, currentPlayer);
    set((state) => ({
      board: nextBoard,
      moves: [...state.moves, { row, col, player: currentPlayer }],
      currentPlayer: currentPlayer === "black" ? "white" : "black",
      winner: res.winner,
      winningLine: res.line,
    }));
  },
  undo: () => {
    const { moves, board } = get();
    if (moves.length === 0) return;
    const nextBoard = board.map((rowArr) => rowArr.slice());
    const last = moves[moves.length - 1];
    nextBoard[last.row][last.col] = null;
    set({
      board: nextBoard,
      moves: moves.slice(0, -1),
      currentPlayer: last.player,
      winner: null,
      winningLine: [],
    });
  },
  reset: (size) => {
    const n = size ?? get().boardSize;
    set({
      boardSize: n,
      board: createEmptyBoard(n),
      moves: [],
      currentPlayer: "black",
      winner: null,
      winningLine: [],
    });
  },
  setBoardSize: (size) => {
    const clamped = Math.max(10, Math.min(25, size));
    set({ boardSize: clamped });
  },
  setAiEnabled: (enabled) => set({ aiEnabled: enabled }),
  setAiPlayer: (player) => set({ aiPlayer: player }),
  makeAiMove: () => {
    const { aiEnabled, aiPlayer, currentPlayer, winner, board } = get();
    if (!aiEnabled || winner || currentPlayer !== aiPlayer) return;
    const n = board.length;
    const empties = getEmptyPositions(board);
    if (empties.length === 0) return;

    // First move: center
    if (empties.length === n * n) {
      const center = Math.floor(n / 2);
      get().placeStone(center, center);
      return;
    }

    // 1) immediate win
    for (const { row, col } of empties) {
      const nextBoard = board.map((r) => r.slice());
      nextBoard[row][col] = aiPlayer;
      const res = checkWin(nextBoard, row, col, aiPlayer);
      if (res.winner === aiPlayer) {
        get().placeStone(row, col);
        return;
      }
    }
    // 2) block opponent immediate win
    const opponent: Player = aiPlayer === "black" ? "white" : "black";
    for (const { row, col } of empties) {
      const nextBoard = board.map((r) => r.slice());
      nextBoard[row][col] = opponent;
      const res = checkWin(nextBoard, row, col, opponent);
      if (res.winner === opponent) {
        get().placeStone(row, col);
        return;
      }
    }
    // 3) alpha-beta search fallback
    const best = findBestMoveAlphaBeta(board, aiPlayer);
    if (best) {
      get().placeStone(best.row, best.col);
    }
  },
}));