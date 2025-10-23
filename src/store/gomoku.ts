import { create } from "zustand";

export type Player = "black" | "white";
export type Cell = Player | null;

export interface Move { row: number; col: number; player: Player }
export interface Position { row: number; col: number }

export type SkillId = "sandstorm" | "stillwater" | "mountainBreaker" | "rebirth" | "shift";
export const SKILL_DEFINITIONS: Record<SkillId, { id: SkillId; name: string; cooldown: number; description: string; target?: "none" | "stone" | "point" | "stone_then_point" }> = {
  sandstorm: { id: "sandstorm", name: "飞沙走石", cooldown: 4, description: "选中敌方棋子，使其消失，并封锁该位一回合。", target: "stone" },
  stillwater: { id: "stillwater", name: "静如止水", cooldown: 6, description: "冻结敌方一回合，自己连续下两手。", target: "none" },
  mountainBreaker: { id: "mountainBreaker", name: "力拔山兮", cooldown: 10, description: "选定 6x6 区域摧毁，无法落子。", target: "point" },
  rebirth: { id: "rebirth", name: "东山再起", cooldown: 6, description: "牺牲两枚己子，恢复全部摧毁区域。", target: "none" },
  shift: { id: "shift", name: "调呈离山", cooldown: 5, description: "移动敌方棋子到新位置并封锁原点一回合。", target: "stone_then_point" },
};

interface GameState {
  boardSize: number;
  board: Cell[][];
  moves: Move[];
  currentPlayer: Player;
  winner: Player | null;
  winningLine: Position[];
  aiEnabled: boolean;
  aiPlayer: Player;
  tempBlock: Record<string, number>; // key: "r,c"，剩余回合数（每回合-1）
  permBlock: Record<string, boolean>; // 永久封锁（摧毁区域）
  frozenTurns: Record<Player, number>; // 玩家被冻结的回合数
  extraTurns: Record<Player, number>; // 玩家额外回合数
  skillCooldowns: Record<Player, Record<SkillId, number>>;
  pendingSkill: { id: SkillId } | null;
  skillTargetBuffer: Position[];
  usedMountainBreakerSinceLastRebirth: Record<Player, boolean>;
  placeStone: (row: number, col: number) => void;
  reset: (size?: number) => void;
  undo: () => void;
  setBoardSize: (size: number) => void;
  setAiEnabled: (enabled: boolean) => void;
  setAiPlayer: (player: Player) => void;
  makeAiMove: () => void;
  isBlocked: (row: number, col: number) => boolean;
  triggerSkill: (id: SkillId) => void;
  cancelSkill: () => void;
  applySkillTarget: (row: number, col: number) => void;
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

function getCandidatePositions(board: Cell[][], isBlockedFn?: (r: number, c: number) => boolean): Position[] {
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
      if (isBlockedFn && isBlockedFn(r, c)) continue;
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
  isBlockedFn: (r: number, c: number) => boolean,
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
  const candidates = getCandidatePositions(board, isBlockedFn);
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
      const child = alphaBeta(nextBoard, depth - 1, alpha, beta, next(currentPlayer), ai, isBlockedFn, {
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
      const child = alphaBeta(nextBoard, depth - 1, alpha, beta, next(currentPlayer), ai, isBlockedFn, {
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

function findBestMoveAlphaBeta(board: Cell[][], ai: Player, isBlockedFn: (r: number, c: number) => boolean): Position | null {
  const n = board.length;
  const stones = countStones(board);
  const empties = getCandidatePositions(board, isBlockedFn);
  if (empties.length === 0) return null;
  // First move preference: center if available; otherwise closest non-blocked
  if (stones === 0) {
    const center = Math.floor(n / 2);
    if (!isBlockedFn(center, center)) return { row: center, col: center };
    let best: Position | null = null;
    let bestDist = Infinity;
    for (const p of empties) {
      const d = Math.abs(p.row - center) + Math.abs(p.col - center);
      if (d < bestDist) { bestDist = d; best = p; }
    }
    return best;
  }
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
    const val = alphaBeta(nextBoard, depth - 1, -Infinity, Infinity, opponent, ai, isBlockedFn, {
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
  tempBlock: {},
  permBlock: {},
  frozenTurns: { black: 0, white: 0 },
  extraTurns: { black: 0, white: 0 },
  skillCooldowns: { black: { sandstorm: 0, stillwater: 0, mountainBreaker: 0, rebirth: 0, shift: 0 }, white: { sandstorm: 0, stillwater: 0, mountainBreaker: 0, rebirth: 0, shift: 0 } },
  pendingSkill: null,
  skillTargetBuffer: [],
  usedMountainBreakerSinceLastRebirth: { black: false, white: false },
  isBlocked: (row, col) => {
    const key = `${row},${col}`;
    const { tempBlock, permBlock } = get();
    const t = tempBlock[key] || 0;
    return !!permBlock[key] || t > 0;
  },
  placeStone: (row, col) => {
    const { board, currentPlayer, winner, isBlocked, extraTurns, frozenTurns, skillCooldowns, tempBlock, pendingSkill } = get();
    if (winner || pendingSkill || board[row][col] !== null || isBlocked(row, col)) return;
    const nextBoard = board.map((rowArr) => rowArr.slice());
    nextBoard[row][col] = currentPlayer;
    // 在摧毁区上的棋子视为无效，进行胜利判断前清除
    const perm = get().permBlock;
    const maskedBoard = nextBoard.map((r) => r.slice());
    for (const k of Object.keys(perm)) {
      const [rs, cs] = k.split(",");
      const rr = Number(rs), cc = Number(cs);
      if (inBounds(maskedBoard.length, rr, cc)) maskedBoard[rr][cc] = null;
    }
    const res = checkWin(maskedBoard, row, col, currentPlayer);
    // 计算下一执子（考虑额外回合与冻结）
    const nextExtra = { ...extraTurns };
    const nextFrozen = { ...frozenTurns };
    let nextPlayer: Player = currentPlayer === "black" ? "white" : "black";
    if (nextExtra[currentPlayer] > 0) {
      nextExtra[currentPlayer] -= 1;
      nextPlayer = currentPlayer;
    } else if (nextFrozen[nextPlayer] > 0) {
      nextFrozen[nextPlayer] -= 1; // 跳过对方回合
      nextPlayer = currentPlayer;
    }
    // 冷却与临时封锁衰减：回合开始时执行
    const nextCooldowns = { black: { ...skillCooldowns.black }, white: { ...skillCooldowns.white } };
    for (const k of Object.keys(nextCooldowns[nextPlayer])) {
      const id = k as SkillId;
      nextCooldowns[nextPlayer][id] = Math.max(0, nextCooldowns[nextPlayer][id] - 1);
    }
    const nextTemp: Record<string, number> = { ...tempBlock };
    for (const k of Object.keys(nextTemp)) {
      const v = nextTemp[k];
      if (v <= 1) delete nextTemp[k]; else nextTemp[k] = v - 1;
    }
    set((state) => ({
      board: nextBoard,
      moves: [...state.moves, { row, col, player: currentPlayer }],
      currentPlayer: res.winner ? state.currentPlayer : nextPlayer,
      winner: res.winner,
      winningLine: res.line,
      extraTurns: nextExtra,
      frozenTurns: nextFrozen,
      skillCooldowns: nextCooldowns,
      tempBlock: nextTemp,
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
      tempBlock: {},
      permBlock: {},
      frozenTurns: { black: 0, white: 0 },
      extraTurns: { black: 0, white: 0 },
      skillCooldowns: { black: { sandstorm: 0, stillwater: 0, mountainBreaker: 0, rebirth: 0, shift: 0 }, white: { sandstorm: 0, stillwater: 0, mountainBreaker: 0, rebirth: 0, shift: 0 } },
      pendingSkill: null,
      skillTargetBuffer: [],
      usedMountainBreakerSinceLastRebirth: { black: false, white: false },
    });
  },
  setBoardSize: (size) => {
    const clamped = Math.max(10, Math.min(25, size));
    set({ boardSize: clamped });
  },
  setAiEnabled: (enabled) => set({ aiEnabled: enabled }),
  setAiPlayer: (player) => set({ aiPlayer: player }),
  triggerSkill: (id: SkillId) => {
    const { currentPlayer, skillCooldowns, pendingSkill, winner, aiEnabled, aiPlayer, board, permBlock } = get();
    if (winner) return;
    if (aiEnabled && currentPlayer === aiPlayer) return; // AI 回合不可用技能
    if (pendingSkill) return; // 已在选中状态
    if (skillCooldowns[currentPlayer][id] > 0) return; // 冷却中
    if (id === "mountainBreaker" && get().usedMountainBreakerSinceLastRebirth[currentPlayer]) return; // 本方已摧毁过区域，需重生后才可再次使用
    const def = SKILL_DEFINITIONS[id];

    // 特殊：东山再起需摧毁区且根据己子数量决定是否选子
    if (id === "rebirth") {
      const destroyedCount = Object.keys(permBlock).length;
      if (destroyedCount === 0) return; // 无摧毁区域，不能使用
      const myPositions: Position[] = [];
      for (let r = 0; r < board.length; r++) {
        for (let c = 0; c < board[r].length; c++) {
          const key = `${r},${c}`;
          if (board[r][c] === currentPlayer && !permBlock[key]) myPositions.push({ row: r, col: c });
        }
      }
      if (myPositions.length < 2) return; // 己子不足两枚，不能使用（摧毁区内棋子不计入）
      if (myPositions.length === 2) {
        const nextBoard = board.map((row) => row.slice());
        for (const p of myPositions) {
          nextBoard[p.row][p.col] = null;
        }
        set((s) => {
          const baseCooldowns = { black: { ...s.skillCooldowns.black }, white: { ...s.skillCooldowns.white } };
          baseCooldowns[currentPlayer].rebirth = SKILL_DEFINITIONS.rebirth.cooldown;
          const extra = { ...s.extraTurns };
          const frozen = { ...s.frozenTurns };
          let nextPlayer: Player = currentPlayer === "black" ? "white" : "black";
          if (extra[currentPlayer] > 0) {
            extra[currentPlayer] -= 1;
            nextPlayer = currentPlayer;
          } else if (frozen[nextPlayer] > 0) {
            frozen[nextPlayer] -= 1;
            nextPlayer = currentPlayer;
          }
          const nextCooldowns = { black: { ...baseCooldowns.black }, white: { ...baseCooldowns.white } };
          for (const k of Object.keys(nextCooldowns[nextPlayer])) {
            const kid = k as SkillId;
            nextCooldowns[nextPlayer][kid] = Math.max(0, nextCooldowns[nextPlayer][kid] - 1);
          }
          const nextTemp: Record<string, number> = { ...(s.tempBlock || {}) };
          for (const tk of Object.keys(nextTemp)) {
            const v = nextTemp[tk];
            if (v <= 1) delete nextTemp[tk]; else nextTemp[tk] = v - 1;
          }
          return {
            board: nextBoard,
            permBlock: {}, // 恢复摧毁区域
            skillCooldowns: nextCooldowns,
            tempBlock: nextTemp,
            extraTurns: extra,
            frozenTurns: frozen,
            usedMountainBreakerSinceLastRebirth: { ...s.usedMountainBreakerSinceLastRebirth, [currentPlayer]: false },
            currentPlayer: nextPlayer,
          };
        });
        return;
      } else {
        set({ pendingSkill: { id }, skillTargetBuffer: [] });
        return;
      }
    }

    // 目标型技能：进入选中模式
    if (def.target !== "none") {
      set({ pendingSkill: { id }, skillTargetBuffer: [] });
      return;
    }

    // 立即生效型技能并结束本回合
    if (id === "stillwater") {
      set((s) => {
        const opponent: Player = currentPlayer === "black" ? "white" : "black";
        const nextFrozen = { ...s.frozenTurns, [opponent]: (s.frozenTurns[opponent] || 0) + 1 };
        const nextExtra = { ...s.extraTurns, [currentPlayer]: (s.extraTurns[currentPlayer] || 0) + 1 };
        const baseCooldowns = { black: { ...s.skillCooldowns.black }, white: { ...s.skillCooldowns.white } };
        baseCooldowns[currentPlayer].stillwater = SKILL_DEFINITIONS.stillwater.cooldown;
        let nextPlayer: Player = currentPlayer === "black" ? "white" : "black";
        if (nextExtra[currentPlayer] > 0) {
          nextExtra[currentPlayer] -= 1;
          nextPlayer = currentPlayer;
        } else if (nextFrozen[nextPlayer] > 0) {
          nextFrozen[nextPlayer] -= 1;
          nextPlayer = currentPlayer;
        }
        const nextCooldowns = { black: { ...baseCooldowns.black }, white: { ...baseCooldowns.white } };
        for (const k of Object.keys(nextCooldowns[nextPlayer])) {
          const kid = k as SkillId;
          nextCooldowns[nextPlayer][kid] = Math.max(0, nextCooldowns[nextPlayer][kid] - 1);
        }
        const nextTemp: Record<string, number> = { ...(s.tempBlock || {}) };
        for (const tk of Object.keys(nextTemp)) {
          const v = nextTemp[tk];
          if (v <= 1) delete nextTemp[tk]; else nextTemp[tk] = v - 1;
        }
        return {
          frozenTurns: nextFrozen,
          extraTurns: nextExtra,
          skillCooldowns: nextCooldowns,
          tempBlock: nextTemp,
          currentPlayer: nextPlayer,
        };
      });
      return;
    }
  },
  cancelSkill: () => set({ pendingSkill: null, skillTargetBuffer: [] }),
  applySkillTarget: (row, col) => {
    const { pendingSkill, board, currentPlayer, skillTargetBuffer, winner } = get();
    if (winner) return;
    if (!pendingSkill) return;
    const id = pendingSkill.id;
    const def = SKILL_DEFINITIONS[id];
    const key = `${row},${col}`;
    if (id === "sandstorm") {
      const opponent: Player = currentPlayer === "black" ? "white" : "black";
      if (get().permBlock[key]) return;
      if (board[row][col] === opponent) {
        const nextBoard = board.map((r) => r.slice());
        nextBoard[row][col] = null;
        set((s) => {
          // 设置冷却与封锁
          const baseCooldowns = { black: { ...s.skillCooldowns.black }, white: { ...s.skillCooldowns.white } };
          baseCooldowns[currentPlayer].sandstorm = SKILL_DEFINITIONS.sandstorm.cooldown;
          const nextTemp = { ...s.tempBlock, [key]: 2 };
          // 推进到下一执子
          const extra = { ...s.extraTurns };
          const frozen = { ...s.frozenTurns };
          let nextPlayer: Player = currentPlayer === "black" ? "white" : "black";
          if (extra[currentPlayer] > 0) {
            extra[currentPlayer] -= 1;
            nextPlayer = currentPlayer;
          } else if (frozen[nextPlayer] > 0) {
            frozen[nextPlayer] -= 1;
            nextPlayer = currentPlayer;
          }
          const nextCooldowns = { black: { ...baseCooldowns.black }, white: { ...baseCooldowns.white } };
          for (const k of Object.keys(nextCooldowns[nextPlayer])) {
            const kid = k as SkillId;
            nextCooldowns[nextPlayer][kid] = Math.max(0, nextCooldowns[nextPlayer][kid] - 1);
          }
          // 临时封锁衰减
          for (const tk of Object.keys(nextTemp)) {
            const v = nextTemp[tk];
            if (v <= 1) delete nextTemp[tk]; else nextTemp[tk] = v - 1;
          }
          return {
            board: nextBoard,
            tempBlock: nextTemp,
            skillCooldowns: nextCooldowns,
            pendingSkill: null,
            skillTargetBuffer: [],
            extraTurns: extra,
            frozenTurns: frozen,
            currentPlayer: nextPlayer,
          };
        });
      }
    }
    if (id === "rebirth") {
      const { permBlock } = get();
      if (permBlock[key]) return; // 摧毁区中的棋子不可选
      if (board[row][col] !== currentPlayer) return;
      if (skillTargetBuffer.some((p) => p.row === row && p.col === col)) return;
      const nextBuf = [...skillTargetBuffer, { row, col }];
      if (nextBuf.length < 2) {
        set({ skillTargetBuffer: nextBuf });
        return;
      }
      const nextBoard = board.map((r) => r.slice());
      for (const p of nextBuf) {
        nextBoard[p.row][p.col] = null;
      }
      set((s) => {
        const baseCooldowns = { black: { ...s.skillCooldowns.black }, white: { ...s.skillCooldowns.white } };
        baseCooldowns[currentPlayer].rebirth = SKILL_DEFINITIONS.rebirth.cooldown;
        const extra = { ...s.extraTurns };
        const frozen = { ...s.frozenTurns };
        let nextPlayer: Player = currentPlayer === "black" ? "white" : "black";
        if (extra[currentPlayer] > 0) {
          extra[currentPlayer] -= 1;
          nextPlayer = currentPlayer;
        } else if (frozen[nextPlayer] > 0) {
          frozen[nextPlayer] -= 1;
          nextPlayer = currentPlayer;
        }
        const nextCooldowns = { black: { ...baseCooldowns.black }, white: { ...baseCooldowns.white } };
        for (const k of Object.keys(nextCooldowns[nextPlayer])) {
          const kid = k as SkillId;
          nextCooldowns[nextPlayer][kid] = Math.max(0, nextCooldowns[nextPlayer][kid] - 1);
        }
        const nextTemp: Record<string, number> = { ...(s.tempBlock || {}) };
        for (const tk of Object.keys(nextTemp)) {
          const v = nextTemp[tk];
          if (v <= 1) delete nextTemp[tk]; else nextTemp[tk] = v - 1;
        }
        return {
          board: nextBoard,
          permBlock: {}, // 恢复摧毁区域
          skillCooldowns: nextCooldowns,
          tempBlock: nextTemp,
          pendingSkill: null,
          skillTargetBuffer: [],
          extraTurns: extra,
          frozenTurns: frozen,
          usedMountainBreakerSinceLastRebirth: { ...s.usedMountainBreakerSinceLastRebirth, [currentPlayer]: false },
          currentPlayer: nextPlayer,
        };
      });
      return;
    }
    if (id === "mountainBreaker") {
      const n = get().boardSize;
      const halfH = 3, halfW = 3;
      const nextPerm = { ...get().permBlock };
      for (let dr = -halfH + 1; dr <= halfH; dr++) {
        for (let dc = -halfW + 1; dc <= halfW; dc++) {
          const rr = row + dr, cc = col + dc;
          if (inBounds(n, rr, cc)) nextPerm[`${rr},${cc}`] = true;
        }
      }
      set((s) => {
        const baseCooldowns = { black: { ...s.skillCooldowns.black }, white: { ...s.skillCooldowns.white } };
        baseCooldowns[currentPlayer].mountainBreaker = SKILL_DEFINITIONS.mountainBreaker.cooldown;
        const extra = { ...s.extraTurns };
        const frozen = { ...s.frozenTurns };
        let nextPlayer: Player = currentPlayer === "black" ? "white" : "black";
        if (extra[currentPlayer] > 0) {
          extra[currentPlayer] -= 1;
          nextPlayer = currentPlayer;
        } else if (frozen[nextPlayer] > 0) {
          frozen[nextPlayer] -= 1;
          nextPlayer = currentPlayer;
        }
        const nextCooldowns = { black: { ...baseCooldowns.black }, white: { ...baseCooldowns.white } };
        for (const k of Object.keys(nextCooldowns[nextPlayer])) {
          const kid = k as SkillId;
          nextCooldowns[nextPlayer][kid] = Math.max(0, nextCooldowns[nextPlayer][kid] - 1);
        }
        const nextTemp: Record<string, number> = { ...(s.tempBlock || {}) };
        for (const tk of Object.keys(nextTemp)) {
          const v = nextTemp[tk];
          if (v <= 1) delete nextTemp[tk]; else nextTemp[tk] = v - 1;
        }
        return {
          permBlock: nextPerm,
          pendingSkill: null,
          skillTargetBuffer: [],
          extraTurns: extra,
          frozenTurns: frozen,
          skillCooldowns: nextCooldowns,
          tempBlock: nextTemp,
          usedMountainBreakerSinceLastRebirth: { ...s.usedMountainBreakerSinceLastRebirth, [currentPlayer]: true },
          currentPlayer: nextPlayer,
        };
      });
    }
    if (id === "shift") {
      const buf = [...skillTargetBuffer];
      if (buf.length === 0) {
        const opponent: Player = currentPlayer === "black" ? "white" : "black";
        if (get().permBlock[key]) return;
        if (board[row][col] === opponent) {
          set({ skillTargetBuffer: [{ row, col }] });
        }
      } else if (buf.length === 1) {
        if (board[row][col] === null && !get().isBlocked(row, col)) {
          const from = buf[0];
          const nextBoard = board.map((r) => r.slice());
          const opponent: Player = currentPlayer === "black" ? "white" : "black";
          nextBoard[from.row][from.col] = null;
          nextBoard[row][col] = opponent;
          const fromKey = `${from.row},${from.col}`;
          set((s) => {
            const baseCooldowns = { black: { ...s.skillCooldowns.black }, white: { ...s.skillCooldowns.white } };
            baseCooldowns[currentPlayer].shift = SKILL_DEFINITIONS.shift.cooldown;
            const nextTemp = { ...s.tempBlock, [fromKey]: 2 };
            const extra = { ...s.extraTurns };
            const frozen = { ...s.frozenTurns };
            let nextPlayer: Player = currentPlayer === "black" ? "white" : "black";
            if (extra[currentPlayer] > 0) {
              extra[currentPlayer] -= 1;
              nextPlayer = currentPlayer;
            } else if (frozen[nextPlayer] > 0) {
              frozen[nextPlayer] -= 1;
              nextPlayer = currentPlayer;
            }
            const nextCooldowns = { black: { ...baseCooldowns.black }, white: { ...baseCooldowns.white } };
            for (const k of Object.keys(nextCooldowns[nextPlayer])) {
              const kid = k as SkillId;
              nextCooldowns[nextPlayer][kid] = Math.max(0, nextCooldowns[nextPlayer][kid] - 1);
            }
            for (const tk of Object.keys(nextTemp)) {
              const v = nextTemp[tk];
              if (v <= 1) delete nextTemp[tk]; else nextTemp[tk] = v - 1;
            }
            return {
              board: nextBoard,
              tempBlock: nextTemp,
              skillCooldowns: nextCooldowns,
              pendingSkill: null,
              skillTargetBuffer: [],
              extraTurns: extra,
              frozenTurns: frozen,
              currentPlayer: nextPlayer,
            };
          });
        }
      }
    }
  },
  makeAiMove: () => {
    const { aiEnabled, aiPlayer, currentPlayer, winner, board, isBlocked, frozenTurns } = get();
    if (!aiEnabled || winner || currentPlayer !== aiPlayer) return;
    if (frozenTurns[aiPlayer] > 0) return; // AI 被冻结，跳过回合
    const n = board.length;
    const empties = getEmptyPositions(board).filter((p) => !isBlocked(p.row, p.col));
    if (empties.length === 0) return;

    // First move: center
    if (countStones(board) === 0) {
      const center = Math.floor(n / 2);
      if (!isBlocked(center, center)) get().placeStone(center, center);
      else {
        // fallback to nearest non-blocked empty
        let best: Position | null = null;
        let bestDist = Infinity;
        for (const p of empties) {
          const d = Math.abs(p.row - center) + Math.abs(p.col - center);
          if (d < bestDist) { bestDist = d; best = p; }
        }
        if (best) get().placeStone(best.row, best.col);
      }
      return;
    }

    // 1) immediate win
    for (const { row, col } of empties) {
      const nextBoard = board.map((r) => r.slice());
      nextBoard[row][col] = aiPlayer;
      // 胜利判断使用有效棋盘（摧毁区的棋子无效）
      const perm = get().permBlock;
      const maskedBoard = nextBoard.map((r) => r.slice());
      for (const k of Object.keys(perm)) {
        const [rs, cs] = k.split(",");
        const rr = Number(rs), cc = Number(cs);
        if (inBounds(maskedBoard.length, rr, cc)) maskedBoard[rr][cc] = null;
      }
      const res = checkWin(maskedBoard, row, col, aiPlayer);
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
      const perm = get().permBlock;
      const maskedBoard = nextBoard.map((r) => r.slice());
      for (const k of Object.keys(perm)) {
        const [rs, cs] = k.split(",");
        const rr = Number(rs), cc = Number(cs);
        if (inBounds(maskedBoard.length, rr, cc)) maskedBoard[rr][cc] = null;
      }
      const res = checkWin(maskedBoard, row, col, opponent);
      if (res.winner === opponent) {
        get().placeStone(row, col);
        return;
      }
    }
    // 3) alpha-beta search fallback
    const perm = get().permBlock;
    const effectiveBoard = board.map((r) => r.slice());
    for (const k of Object.keys(perm)) {
      const [rs, cs] = k.split(",");
      const rr = Number(rs), cc = Number(cs);
      if (inBounds(effectiveBoard.length, rr, cc)) effectiveBoard[rr][cc] = null;
    }
    const best = findBestMoveAlphaBeta(effectiveBoard, aiPlayer, isBlocked);
    if (best && !isBlocked(best.row, best.col)) {
      get().placeStone(best.row, best.col);
    }
  },
}));