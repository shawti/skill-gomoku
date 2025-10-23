import * as React from "react";
import { useGameStore } from "@/store/gomoku";
import { twMerge } from "tailwind-merge";
import clsx from "clsx";

// SVG 棋盘：画线于格点，棋子落在交叉点
export function GomokuBoard() {
  const { board, boardSize, placeStone, winner, winningLine } = useGameStore();

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

  return (
    <div
      className={twMerge(
        clsx(
          "relative w-full max-w-[720px] aspect-square rounded-xl",
          "border border-amber-300/70 bg-gradient-to-br from-amber-100 to-amber-200",
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
            const fill = cell === "black" ? "#000" : "#fff";
            const radius = cell === "white" ? stoneRadiusBase * 0.98 : stoneRadiusBase; // 白子微调抵消视觉膨胀
            return (
              <g key={`stone-${r}-${c}`}>
                <circle
                  cx={x}
                  cy={y}
                  r={radius}
                  fill={fill}
                  stroke="#6b7280"
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
              </g>
            );
          })
        )}

        {/* 点击区域：仅为空位且未分出胜负时可点击 */}
        {board.map((rowArr, r) =>
          rowArr.map((cell, c) => {
            if (cell || winner) return null;
            const { x, y } = toCoord(r, c);
            // 以交叉点为中心的透明方形点击区，提升易点性
            const hitSize = steps * 0.75;
            return (
              <rect
                key={`hit-${r}-${c}`}
                x={x - hitSize / 2}
                y={y - hitSize / 2}
                width={hitSize}
                height={hitSize}
                fill="transparent"
                onClick={() => placeStone(r, c)}
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