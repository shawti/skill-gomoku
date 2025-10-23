'use client';

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import GomokuBoard from "@/components/gomoku/Board";
import { useGameStore } from "@/store/gomoku";
import { RotateCcw, RefreshCcw, Settings } from "lucide-react";

export default function Page() {
  const { currentPlayer, winner, moves, boardSize, undo, reset, setBoardSize, aiEnabled, aiPlayer, setAiEnabled, setAiPlayer, makeAiMove } = useGameStore();
  const [open, setOpen] = React.useState(false);
  const [sizeDraft, setSizeDraft] = React.useState(boardSize);
  const [modeDraft, setModeDraft] = React.useState<'pvp' | 'pve'>(aiEnabled ? 'pve' : 'pvp');
  const [aiPlayerDraft, setAiPlayerDraft] = React.useState(aiPlayer);

  React.useEffect(() => {
    if (aiEnabled && currentPlayer === aiPlayer && !winner) {
      const t = setTimeout(() => {
        makeAiMove();
      }, 220);
      return () => clearTimeout(t);
    }
  }, [aiEnabled, aiPlayer, currentPlayer, winner, moves.length, makeAiMove]);

  const playerLabel = winner ? (winner === 'black' ? '黑子胜' : '白子胜') : (currentPlayer === 'black' ? '黑子' : '白子');

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-zinc-50 to-zinc-100 dark:from-black dark:to-neutral-900">
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Card>
          <CardHeader>
            <CardTitle>五子棋 Gomoku</CardTitle>
            <CardDescription>Zustand 管理状态，shadcn 风格组件，Tailwind v4 样式</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-[1fr_320px]">
              <GomokuBoard />
              <div className="flex flex-col gap-4">
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/70 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-600 dark:text-neutral-400">当前执子</span>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <span
                        className={winner
                          ? 'text-amber-600 dark:text-amber-400'
                          : currentPlayer === 'black'
                            ? 'text-black dark:text-white'
                            : 'text-neutral-900 dark:text-neutral-100'}
                      >
                        {playerLabel}{aiEnabled && !winner && currentPlayer === aiPlayer ? '（AI）' : ''}
                      </span>
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full ring-1 ring-neutral-300 dark:ring-neutral-700"
                        style={{ background: winner ? '#f59e0b' : currentPlayer === 'black' ? '#000' : '#fff' }}
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-neutral-600 dark:text-neutral-400">步数</span>
                    <span className="font-medium">{moves.length}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-neutral-600 dark:text-neutral-400">棋盘大小</span>
                    <span className="font-medium">{boardSize} × {boardSize}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-neutral-600 dark:text-neutral-400">模式</span>
                    <span className="font-medium">{aiEnabled ? '人机对战' : '双人对战'}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button variant="secondary" onClick={undo} disabled={moves.length === 0 || !!winner}>
                    <RotateCcw className="mr-2 h-4 w-4" /> 悔棋
                  </Button>
                  <Button variant="outline" onClick={() => reset()}>
                    <RefreshCcw className="mr-2 h-4 w-4" /> 重开
                  </Button>
                  <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                      <Button variant="ghost">
                        <Settings className="mr-2 h-4 w-4" /> 设置
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>棋盘设置</DialogTitle>
                        <DialogDescription>选择棋盘与对战模式</DialogDescription>
                      </DialogHeader>
                      <div className="mt-4 space-y-3">
                        <label className="text-sm text-neutral-700 dark:text-neutral-300">尺寸</label>
                        <select
                          className="w-full rounded-md border border-neutral-300 bg-white p-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                          value={sizeDraft}
                          onChange={(e) => setSizeDraft(Number(e.target.value))}
                        >
                          {[13, 15, 19].map((n) => (
                            <option key={n} value={n}>{n} × {n}</option>
                          ))}
                        </select>
                      </div>
                      <div className="mt-4 space-y-3">
                        <label className="text-sm text-neutral-700 dark:text-neutral-300">模式</label>
                        <select
                          className="w-full rounded-md border border-neutral-300 bg-white p-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                          value={modeDraft}
                          onChange={(e) => setModeDraft(e.target.value as 'pvp' | 'pve')}
                        >
                          <option value="pvp">双人对战</option>
                          <option value="pve">人机对战</option>
                        </select>
                      </div>
                      {modeDraft === 'pve' && (
                        <div className="mt-2 space-y-3">
                          <label className="text-sm text-neutral-700 dark:text-neutral-300">AI 执子</label>
                          <select
                            className="w-full rounded-md border border-neutral-300 bg-white p-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                            value={aiPlayerDraft}
                            onChange={(e) => setAiPlayerDraft(e.target.value as 'black' | 'white')}
                          >
                            <option value="black">黑子</option>
                            <option value="white">白子</option>
                          </select>
                        </div>
                      )}
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="ghost">取消</Button>
                        </DialogClose>
                        <Button
                          onClick={() => {
                            setBoardSize(sizeDraft);
                            reset(sizeDraft);
                            const enabled = modeDraft === 'pve';
                            setAiEnabled(enabled);
                            setAiPlayer(aiPlayerDraft);
                            setOpen(false);
                          }}
                        >
                          应用
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">提示：点击交叉点下子；人机模式下 AI 会自动落子。</p>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
