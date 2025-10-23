import * as React from "react";
import { useGameStore } from "@/store/gomoku";
import { twMerge } from "tailwind-merge";
import clsx from "clsx";

// SVG 棋盘：画线于格点，棋子落在交叉点
export function GomokuBoard() {
  const {
    board,
    boardSize,
    placeStone,
    winner,
    winningLine,
    isBlocked,
    pendingSkill,
    applySkillTarget,
    skillTargetBuffer,
    currentPlayer,
    permBlock,
  } = useGameStore();

  // 计算高亮连线集合
  const winningSet = React.useMemo(() => {
    const s = new Set<string>();
    winningLine.forEach((p) => s.add(`${p.row}:${p.col}`));
    return s;
  }, [winningLine]);

  // 视图坐标系设置
  const SIZE = 100; // SVG 视图尺寸
  const PADDING = 6; // 棋盘边距
  const steps = boardSize > 1 ? (SIZE - 2 * PADDING) / (boardSize - 1) : 0;

  // 星位（常见于 15x15）：左上/右上/左下/右下/中心
  const starPoints = React.useMemo(() => {
    const n = boardSize;
    const mk = (r: number, c: number) => ({ r, c });
    const base = [mk(3, 3), mk(3, n - 4), mk(n - 4, 3), mk(n - 4, n - 4)];
    if (n % 2 === 1) base.push(mk(Math.floor(n / 2), Math.floor(n / 2)));
    return base.filter((p) => p.r >= 0 && p.c >= 0 && p.r < n && p.c < n);
  }, [boardSize]);

  // 将行列转为 SVG 坐标
  const toCoord = (r: number, c: number) => ({
    x: PADDING + c * steps,
    y: PADDING + r * steps,
  });

  const stoneRadiusBase = steps * 0.42; // 相对格距的半径基础值
  const starRadius = Math.min(steps * 0.12, 1.2);

  // 技能状态与便捷判断
  const pendingId = pendingSkill?.id;
  const opponent: 'black' | 'white' = currentPlayer === 'black' ? 'white' : 'black';

  return (
    <div
      className={twMerge(
        clsx(
          "relative w-full max-w-[720px] aspect-square rounded-xl",
          "border border-amber-300/70 bg-linear-to-br from-amber-100 to-amber-200",
          "dark:border-neutral-700 dark:from-neutral-800/40 dark:to-neutral-700/40 shadow-inner"
        )
      )}
    >
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="absolute inset-2 h-[calc(100%-16px)] w-[calc(100%-16px)]"
      >
        {/* 棋盘外框 */}
        <rect
          x={PADDING}
          y={PADDING}
          width={SIZE - 2 * PADDING}
          height={SIZE - 2 * PADDING}
          rx={2}
          className="fill-none stroke-amber-500/70 dark:stroke-neutral-500"
          strokeWidth={0.6}
        />

        {/* 横竖网格线 */}
        {Array.from({ length: boardSize }).map((_, i) => {
          const pos = PADDING + i * steps;
          return (
            <g key={`line-${i}`}>
              {/* 横线 */}
              <line
                x1={PADDING}
                y1={pos}
                x2={SIZE - PADDING}
                y2={pos}
                className="stroke-amber-600/70 dark:stroke-neutral-500"
                strokeWidth={0.5}
              />
              {/* 竖线 */}
              <line
                x1={pos}
                y1={PADDING}
                x2={pos}
                y2={SIZE - PADDING}
                className="stroke-amber-600/70 dark:stroke-neutral-500"
                strokeWidth={0.5}
              />
            </g>
          );
        })}

        {/* 星位标记 */}
        {starPoints.map((p, idx) => {
          const { x, y } = toCoord(p.r, p.c);
          return (
            <circle
              key={`star-${idx}`}
              cx={x}
              cy={y}
              r={starRadius}
              className="fill-amber-700/70 dark:fill-neutral-400"
            />
          );
        })}

        {/* 已落子棋子（落在交叉点） */}
        {board.map((rowArr, r) =>
          rowArr.map((cell, c) => {
            if (!cell) return null;
            const { x, y } = toCoord(r, c);
            const isWinning = winningSet.has(`${r}:${c}`);
            const key = `${r},${c}`;
            const isDestroyed = !!permBlock[key];
            const fill = cell === "black" ? (isDestroyed ? "#6b7280" : "#000") : (isDestroyed ? "#e5e7eb" : "#fff");
            const radius = cell === "white" ? stoneRadiusBase * 0.98 : stoneRadiusBase; // 白子微调抵消视觉膨胀
            const strokeColor = isDestroyed ? "#9ca3af" : "#6b7280";
            const canClickStone = !!pendingId && !winner && (
              (pendingId === 'sandstorm' || pendingId === 'shift') ? (cell === opponent && !isDestroyed) :
              (pendingId === 'rebirth' ? (cell === currentPlayer && !isDestroyed) :
              (pendingId === 'mountainBreaker' ? (cell !== null && !isDestroyed) : false))
            );
            const selected = skillTargetBuffer.length === 1 && skillTargetBuffer[0].row === r && skillTargetBuffer[0].col === c;
            return (
              <g key={`stone-${r}-${c}`}>
                <circle
                  cx={x}
                  cy={y}
                  r={radius}
                  fill={fill}
                  fillOpacity={isDestroyed ? 0.9 : 1}
                  stroke={strokeColor}
                  strokeWidth={Math.max(0.35, steps * 0.03)}
                />
                {isWinning && (
                  <circle
                    cx={x}
                    cy={y}
                    r={radius + steps * 0.04}
                    className="fill-none"
                    stroke="#f59e0b"
                    strokeWidth={Math.max(0.5, steps * 0.06)}
                  />
                )}
                {selected && (
                  <circle
                    cx={x}
                    cy={y}
                    r={radius + steps * 0.08}
                    className="fill-none"
                    stroke="#3b82f6"
                    strokeWidth={Math.max(0.5, steps * 0.06)}
                  />
                )}
                {canClickStone && (
                  // 增加点击命中区（透明），用于技能选择敌子/己子
                  <rect
                    x={x - steps * 0.45}
                    y={y - steps * 0.45}
                    width={steps * 0.9}
                    height={steps * 0.9}
                    fill="transparent"
                    onClick={() => applySkillTarget(r, c)}
                    style={{ cursor: "pointer" }}
                  />
                )}
              </g>
            );
          })
        )}

        {/* 封锁区渲染（临时与永久） */}
        {board.map((rowArr, r) =>
          rowArr.map((_, c) => {
            if (!isBlocked(r, c)) return null;
            const { x, y } = toCoord(r, c);
            const size = steps * 0.6;
            const sx = x - size / 2;
            const sy = y - size / 2;
            return (
              <g key={`block-${r}-${c}`}>
                <rect
                  x={sx}
                  y={sy}
                  width={size}
                  height={size}
                  className="fill-red-500/18 stroke-red-500/55 dark:fill-red-500/12 dark:stroke-red-400/60"
                  strokeWidth={Math.max(0.4, steps * 0.04)}
                />
                <line x1={sx} y1={sy} x2={sx + size} y2={sy + size} className="stroke-red-600/70 dark:stroke-red-400" strokeWidth={Math.max(0.35, steps * 0.04)} />
                <line x1={sx + size} y1={sy} x2={sx} y2={sy + size} className="stroke-red-600/70 dark:stroke-red-400" strokeWidth={Math.max(0.35, steps * 0.04)} />
              </g>
            );
          })
        )}

        {/* 点击区域：仅为空位且未封锁、未分出胜负时可点击 */}
        {board.map((rowArr, r) =>
          rowArr.map((cell, c) => {
            if (cell || winner || isBlocked(r, c)) return null;
            const { x, y } = toCoord(r, c);
            // 以交叉点为中心的透明方形点击区，提升易点性
            const hitSize = steps * 0.75;
            const onClick = () => {
              if (pendingId) {
                applySkillTarget(r, c);
              } else {
                placeStone(r, c);
              }
            };
            return (
              <rect
                key={`hit-${r}-${c}`}
                x={x - hitSize / 2}
                y={y - hitSize / 2}
                width={hitSize}
                height={hitSize}
                fill="transparent"
                onClick={onClick}
                style={{ cursor: "pointer" }}
              />
            );
          })
        )}
      </svg>
    </div>
  );
}

export default GomokuBoard;