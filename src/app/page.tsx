'use client';

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import GomokuBoard from "@/components/gomoku/Board";
import { useGameStore, SKILL_DEFINITIONS, type SkillId } from "@/store/gomoku";
import { RotateCcw, RefreshCcw, Settings, Wand2, XCircle, Volume2, VolumeX } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

export default function Page() {
  const {
    currentPlayer,
    winner,
    moves,
    board,
    permBlock,
    boardSize,
    undo,
    reset,
    setBoardSize,
    aiEnabled,
    aiPlayer,
    setAiEnabled,
    setAiPlayer,
    makeAiMove,
    skillCooldowns,
    triggerSkill,
    pendingSkill,
    cancelSkill,
    frozenTurns,
    extraTurns,
    usedMountainBreakerSinceLastRebirth,
    draw,
  } = useGameStore();
  const [open, setOpen] = React.useState(false);
  const [sizeDraft, setSizeDraft] = React.useState(boardSize);
  const [modeDraft, setModeDraft] = React.useState<'pvp' | 'pve'>(aiEnabled ? 'pve' : 'pvp');
  const [aiPlayerDraft, setAiPlayerDraft] = React.useState(aiPlayer);
const [bgmEnabled, setBgmEnabled] = React.useState(true);
const bgmRef = React.useRef<HTMLAudioElement | null>(null);
const interactionPlayRef = React.useRef<(() => void) | undefined>(undefined);
React.useEffect(() => {
  if (!bgmRef.current) {
    const a = new Audio('skill-gomoku.mp3');
    a.loop = true;
    a.volume = 0.15;
    a.preload = 'auto';
    a.muted = true; // 初始静音以满足自动播放策略
    bgmRef.current = a;
  }
  return () => {
    bgmRef.current?.pause();
    bgmRef.current = null;
  };
}, []);

React.useEffect(() => {
  const audio = bgmRef.current;
  if (!audio) return;

  const events: Array<keyof DocumentEventMap> = ['pointerdown', 'click', 'keydown', 'touchstart'];

  const detach = () => {
    const h = interactionPlayRef.current as EventListener | undefined;
    if (h) {
      events.forEach((e) => document.removeEventListener(e, h));
      interactionPlayRef.current = undefined;
    }
  };

  const attachOnce = () => {
    const handler = () => {
      if (!bgmEnabled || !bgmRef.current) return;
      const a = bgmRef.current;
      a.muted = false;
      a.play().catch(() => {});
      detach();
    };
    detach();
    interactionPlayRef.current = handler as unknown as (() => void);
    events.forEach((e) => document.addEventListener(e, handler as EventListener, { once: true }));
  };

  if (bgmEnabled) {
    audio.play().catch(() => {
      // 预热：尝试静音播放以满足部分浏览器的自动播放策略
      audio.muted = true;
      audio.play().catch(() => {});
      // 在首次交互时取消静音并真正开始播放
      attachOnce();
    });
  } else {
    audio.pause();
    detach();
  }

  return () => {
    detach();
  };
}, [bgmEnabled]);
React.useEffect(() => {
  return () => {
    bgmRef.current?.pause();
    bgmRef.current = null;
  };
}, []);

  React.useEffect(() => {
    if (aiEnabled && currentPlayer === aiPlayer && !winner && !draw) {
      const t = setTimeout(() => {
        makeAiMove();
      }, 220);
      return () => clearTimeout(t);
    }
  }, [aiEnabled, aiPlayer, currentPlayer, winner, draw, moves.length, makeAiMove]);

  const playerLabel = winner ? (winner === 'black' ? '黑子胜' : '白子胜') : (draw ? '和棋' : (currentPlayer === 'black' ? '黑子' : '白子'));
  const opponent: 'black' | 'white' = currentPlayer === 'black' ? 'white' : 'black';

  const SkillButton = ({ id }: { id: SkillId }) => {
    const def = SKILL_DEFINITIONS[id];
    const cd = skillCooldowns[currentPlayer][id] || 0;
    const validMyCount = board.reduce((acc, rowArr, r) => acc + rowArr.reduce((acc2, cell, c) => acc2 + (cell === currentPlayer && !permBlock[`${r},${c}`] ? 1 : 0), 0), 0);
    const hasDestroyed = Object.keys(permBlock).length > 0;
    const rebirthInvalid = id === 'rebirth' && (!hasDestroyed || validMyCount < 2);
    const mbLockedByRule = id === 'mountainBreaker' && usedMountainBreakerSinceLastRebirth[currentPlayer];
    const disabled = !!winner || draw || cd > 0 || !!pendingSkill || (aiEnabled && currentPlayer === aiPlayer) || rebirthInvalid || mbLockedByRule;
    return (
      <Button
        variant={cd > 0 ? 'secondary' : 'default'}
        size="sm"
        disabled={disabled}
        onClick={() => triggerSkill(id)}
        className={`w-full justify-between gap-2 ${disabled ? 'pointer-events-none' : ''}`}
      >
        <span className="inline-flex items-center gap-2">
          <Wand2 className="h-3.5 w-3.5" />
          <span className="truncate">{def.name}</span>
        </span>
        <span className="text-xs whitespace-nowrap text-neutral-600 dark:text-neutral-400">{cd > 0 ? `冷却 ${cd}` : '就绪'}</span>
      </Button>
    );
  };

  return (
    <div className="min-h-screen w-full bg-linear-to-b from-zinc-50 to-zinc-100 dark:from-black dark:to-neutral-900">
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Card className="relative">
          <CardHeader className="flex items-start justify-between">
            <div>
              <CardTitle>技能五子棋 - Skill Gomoku</CardTitle>
              <CardDescription>
                技能五子棋，就是在传统的五子棋，加入技能，好好玩！要爆了！
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label={bgmEnabled ? '关闭背景音乐' : '开启背景音乐'}
              aria-pressed={bgmEnabled}
              onClick={() => setBgmEnabled((prev) => !prev)}
              title={bgmEnabled ? '关闭背景音乐' : '开启背景音乐'}
            >
              {bgmEnabled ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4" />
              )}
            </Button>
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
                        className={(winner || draw)
                          ? 'text-amber-600 dark:text-amber-400'
                          : currentPlayer === 'black'
                            ? 'text-black dark:text-white'
                            : 'text-neutral-900 dark:text-neutral-100'}
                      >
                        {playerLabel}{aiEnabled && !winner && !draw && currentPlayer === aiPlayer ? '（AI）' : ''}
                      </span>
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full ring-1 ring-neutral-300 dark:ring-neutral-700"
                        style={{ background: (winner || draw) ? '#f59e0b' : currentPlayer === 'black' ? '#000' : '#fff' }}
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
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <span className="text-neutral-600 dark:text-neutral-400">对方冻结剩余</span>
                    <span className="font-medium text-right">{frozenTurns[opponent] ?? 0}</span>
                    <span className="text-neutral-600 dark:text-neutral-400">我方额外回合</span>
                    <span className="font-medium text-right">{extraTurns[currentPlayer] ?? 0}</span>
                  </div>
                </div>

                {/* 技能栏 */}
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/70 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">技能栏</span>
                    {pendingSkill && (
                      <Button variant="ghost" size="sm" onClick={cancelSkill}>
                        <XCircle className="mr-1.5 h-4 w-4" /> 取消技能
                      </Button>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <TooltipProvider delayDuration={50}>
                      {(['sandstorm','stillwater','mountainBreaker','rebirth','shift'] as SkillId[]).map((id) => {
                        const def = SKILL_DEFINITIONS[id];
                        const cd = skillCooldowns[currentPlayer][id] || 0;
                        const validMyCount = board.reduce((acc, rowArr, r) => acc + rowArr.reduce((acc2, cell, c) => acc2 + (cell === currentPlayer && !permBlock[`${r},${c}`] ? 1 : 0), 0), 0);
                        const hasDestroyed = Object.keys(permBlock).length > 0;
                        const mbLockedByRule = id === 'mountainBreaker' && usedMountainBreakerSinceLastRebirth[currentPlayer];
                        const targetLabel = id === 'rebirth'
                          ? (!hasDestroyed
                              ? '需有摧毁区域方可使用'
                              : (validMyCount > 2
                                  ? '选择两枚我方棋子（摧毁区中的棋子不可选）'
                                  : '我方仅剩两枚时自动生效'))
                          : id === 'mountainBreaker'
                            ? (mbLockedByRule
                                ? '本方已摧毁过区域，需东山再起并冷却结束后再用'
                                : '点击棋子或交叉点，摧毁其周边 6×6 区域（每方仅可选择一片）')
                            : def.target === 'none'
                              ? '无需选点，点击即生效'
                              : def.target === 'stone'
                                ? '在棋盘上点击敌方棋子'
                                : def.target === 'point'
                                  ? '在棋盘上点击一个交叉点'
                                  : '先点击敌子，再点击目标交叉点';
                        return (
                          <Tooltip key={id}>
                            <TooltipTrigger asChild>
                              <span className="inline-block">
                                <SkillButton id={id} />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" align="center" sideOffset={8} className="max-w-[240px] rounded-md border border-neutral-200 bg-white/90 p-2 text-neutral-800 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/90 dark:text-neutral-100">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-medium truncate">{def.name}</span>
                                <span className="text-[11px] whitespace-nowrap text-neutral-600 dark:text-neutral-400">{cd > 0 ? `冷却剩余：${cd}` : `冷却：${def.cooldown}`}</span>
                              </div>
                              <p className="mt-1 text-[11px]">{def.description}</p>
                              <p className="mt-1 text-[11px] text-neutral-600 dark:text-neutral-400">用法：{targetLabel}</p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </TooltipProvider>
                  </div>
                  <p className="mt-3 text-xs text-neutral-600 dark:text-neutral-400">
                    说明：鼠标悬停技能按钮查看详细说明；部分技能需在棋盘上选点或选子。被封锁区域不可落子。
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button variant="secondary" onClick={undo} disabled={moves.length === 0 || !!winner || draw}>
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
            <p className="text-xs text-neutral-500 dark:text-neutral-400">提示：点击交叉点下子；人机模式下 AI 会自动落子；技能：选中按钮后在棋盘上选子/选点。</p>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
