import { useCallback, useEffect, useRef, useState } from "react";
import Menu from "./components/Menu";
import LetterReveal from "./components/LetterReveal";
import Tutorial, { tutorialDone } from "./components/Tutorial";
import AchievementToast from "./components/AchievementToast";
import { ACH_UNLOCK_EVENT, checkAchievements, isFlawlessRound, isPerfectRound, noteRound, type Achievement } from "./lib/achievements";
import Game, { type RoundAnswer } from "./components/Game";
import Results from "./components/Results";
import Online from "./components/Online";
import TenChallenge from "./components/TenChallenge";
import BlitzGame from "./components/BlitzGame";
import ChainGame from "./components/ChainGame";
import ScrambleGame from "./components/ScrambleGame";
import { randomLetter } from "./data/lexicon";
import { saveScore, loadName, saveName, loadMuted, saveMuted, pushHistory, bumpStats } from "./lib/storage";
import { earn, earnGems, claimGemMilestone } from "./lib/wallet";
import { submitRecord } from "./lib/globalBoard";
import { readProfile } from "./lib/profile";
import { sfx } from "./lib/sound";
import { fx } from "./lib/fx";
import { createBots, type BotResult } from "./lib/bots";
import { dailyLetter, dailyCategory, completeDaily, isDailyAvailable, DAILY_REWARD, DAILY_PERFECT_BONUS } from "./lib/daily";
import type { CatKey } from "./data/lexicon";

type Phase = "menu" | "reveal" | "play" | "results" | "online" | "tutorial" | "ten" | "blitz" | "chain" | "scramble";

interface RoundSummary {
  answers: RoundAnswer[];
  roundScore: number;
  bonus: number;
  stopped: boolean;
  rank: number;
  bots: BotResult[] | null;
  beatBots: boolean;
  dailyReward: number;
  dailyStreak: number;
}

export default function App() {
  const [phase, setPhase] = useState<Phase>("menu");
  const [name, setName] = useState(() => loadName());
  const [total, setTotal] = useState(0);
  const [rounds, setRounds] = useState(0);
  const [letter, setLetter] = useState(() => randomLetter());
  const [muted, setMuted] = useState(() => loadMuted());
  const [round, setRound] = useState<RoundSummary | null>(null);
  const [roundKey, setRoundKey] = useState(0);
  const [bots, setBots] = useState<ReturnType<typeof createBots>>(() => []);
  const [isDaily, setIsDaily] = useState(false);
  const [dailyCat, setDailyCat] = useState<CatKey | null>(null);
  const [achToast, setAchToast] = useState<Achievement[]>([]);
  const isDailyRef = useRef(false);
  isDailyRef.current = isDaily;
  const letterRef = useRef(letter);
  letterRef.current = letter;

  const sessionRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const totalRef = useRef(0);
  const roundsRef = useRef(0);
  totalRef.current = total;
  roundsRef.current = rounds;

  useEffect(() => { sfx.enabled = !muted; }, [muted]);
  useEffect(() => { if (canvasRef.current) fx.init(canvasRef.current); }, []);
  useEffect(() => {
    const onUnlock = (event: Event) => {
      const fresh = (event as CustomEvent<Achievement[]>).detail;
      if (Array.isArray(fresh) && fresh.length > 0) setAchToast(fresh);
    };
    window.addEventListener(ACH_UNLOCK_EVENT, onUnlock);
    // يلتقط إنجازات اللاعبين القدامى المبنية على إحصائيات محفوظة بالفعل.
    checkAchievements();
    return () => window.removeEventListener(ACH_UNLOCK_EVENT, onUnlock);
  }, []);

  const toggleMute = () => {
    setMuted((m) => { saveMuted(!m); sfx.enabled = !m; return !m; });
  };

  const startSession = (playerName: string) => {
    sfx.ensure();
    saveName(playerName);
    setName(playerName);
    setTotal(0);
    setRounds(0);
    setIsDaily(false);
    setDailyCat(null);
    sessionRef.current = Date.now();
    const l = randomLetter();
    setLetter(l);
    setBots(createBots(l));
    setRoundKey((k) => k + 1);
    setPhase(tutorialDone() ? "reveal" : "tutorial");
  };

  /** التحدي اليومي: فئة واحدة وحرف واحد، ومحاولة واحدة فقط */
  const startDaily = () => {
    if (!isDailyAvailable()) return;
    sfx.ensure();
    setTotal(0);
    setRounds(0);
    setIsDaily(true);
    sessionRef.current = Date.now();
    const l = dailyLetter();
    setLetter(l);
    setDailyCat(dailyCategory().key);
    setBots([]);
    setRoundKey((k) => k + 1);
    setPhase("reveal");
  };

  const handleFinish = useCallback((answers: RoundAnswer[], roundScore: number, bonus: number, stopped: boolean, botResults?: BotResult[]) => {
    const newTotal = totalRef.current + roundScore + bonus;
    const newRounds = roundsRef.current + 1;
    setTotal(newTotal);
    earn(roundScore + bonus);
    setRounds(newRounds);
    const botsList = botResults ?? null;
    let beatBots = false;
    if (botsList && botsList.length > 0) {
      const playerRound = roundScore + bonus;
      beatBots = playerRound > Math.max(...botsList.map((b) => b.total));
      if (beatBots) earn(20); // جايزة الفوز على البوتات
    }
    // جوايز التحدي اليومي
    let dailyReward = 0;
    let dailyStreak = 0;
    if (isDailyRef.current) {
      const filled = answers.filter((a) => a.verdict && a.verdict.t !== "bad").length;
      dailyReward = DAILY_REWARD + (filled === answers.length ? DAILY_PERFECT_BONUS : 0);
      earn(dailyReward);
      dailyStreak = completeDaily(roundScore + bonus).streak;
      // مستويات سلسلة الأيام الجوهرية — تمنح مرة واحدة لكل مستوى (صعب الوصول ليها)
      for (const [level, gems] of [[7, 3], [15, 6], [30, 10]] as const) {
        if (dailyStreak === level && claimGemMilestone(level)) {
          earnGems(gems);
          checkAchievements(); // تحديث أيقونة الجواهر
        }
      }
    }
    let rank = -1;
    if (newTotal > 0) {
      const res = saveScore(name || "النجم", newTotal, newRounds, sessionRef.current);
      rank = res.rank;
    }
    try {
      pushHistory({ d: Date.now(), letter, score: roundScore + bonus, mode: isDailyRef.current ? "daily" : "solo" });
      const wordCount = answers.filter((a) => a.verdict && a.verdict.t !== "bad").length;
      bumpStats({ score: roundScore + bonus, words: wordCount, won: beatBots });
      const attempted = answers.filter((a) => (a.text ?? "").trim().length > 0).length;
      // سؤال التحدي اليومي لا يحسب ضمن سلسلة الجولات ولا يكسرها.
      const flawlessRound = answers.length === 9 && wordCount === 9;
      if (!isDailyRef.current) {
        const flawless = isFlawlessRound(attempted, wordCount);
        noteRound({ flawless, perfect: isPerfectRound(answers.length, wordCount) });
        // جوهرة الجولة الكاملة: كل الفئات التسع صحيحة — أصعب منح فردي
        if (flawlessRound) earnGems(1);
      }
      checkAchievements();
      const prof = readProfile();
      submitRecord({
        name: prof.name || name || "النجم",
        avatar: prof.avatar,
        score: roundScore + bonus,
        mode: isDailyRef.current ? "daily" : "solo",
      });
    } catch { /* اتجاهل */ }
    setRound({ answers, roundScore, bonus, stopped, rank, bots: botsList, beatBots, dailyReward, dailyStreak });
    setPhase("results");
  }, [name]);

  const nextRound = () => {
    const l = randomLetter(letterRef.current);
    setLetter(l);
    setBots(createBots(l));
    setRoundKey((k) => k + 1);
    setPhase("reveal");
  };

  const restartAll = () => {
    setTotal(0);
    setRounds(0);
    sessionRef.current = Date.now();
    const l = randomLetter();
    setLetter(l);
    setBots(createBots(l));
    setRoundKey((k) => k + 1);
    setPhase("reveal");
  };

  return (
    <>
      <div className="scene" />
      <div className="orb orb-a" />
      <div className="orb orb-b" />
      <canvas ref={canvasRef} className="fixed inset-0 z-[90] pointer-events-none" />

      {phase === "menu" && (
        <Menu
          initialName={name}
          onStart={startSession}
          onOnline={() => { sfx.ensure(); setPhase("online"); }}
          onDaily={startDaily}
          onTen={() => { sfx.ensure(); setPhase("ten"); }}
          onBlitz={() => { sfx.ensure(); setRoundKey((k) => k + 1); setPhase("blitz"); }}
          onChain={() => { sfx.ensure(); setRoundKey((k) => k + 1); setPhase("chain"); }}
          onScramble={() => { sfx.ensure(); setRoundKey((k) => k + 1); setPhase("scramble"); }}
        />
      )}

      {phase === "scramble" && (
        <ScrambleGame key={`scr-${roundKey}`} onExit={() => { setRoundKey((k) => k + 1); setPhase("menu"); }} />
      )}

      {phase === "chain" && (
        <ChainGame key={`chain-${roundKey}`} onExit={() => { setRoundKey((k) => k + 1); setPhase("menu"); }} />
      )}

      {phase === "blitz" && (
        <BlitzGame key={`blitz-${roundKey}`} onExit={() => { setRoundKey((k) => k + 1); setPhase("menu"); }} />
      )}

      {phase === "ten" && (
        <TenChallenge key={`ten-${roundKey}`} onExit={() => { setRoundKey((k) => k + 1); setPhase("menu"); }} />
      )}

      {phase === "online" && (
        <Online
          initialName={name}
          muted={muted}
          onToggleMute={toggleMute}
          onNameUsed={(n) => { setName(n); saveName(n); }}
          onExit={() => setPhase("menu")}
        />
      )}

      <AchievementToast items={achToast} onDone={() => setAchToast([])} />

      {phase === "tutorial" && (
        <Tutorial onDone={() => setPhase("reveal")} />
      )}

      {phase === "reveal" && (
        <LetterReveal key={`reveal-${roundKey}`} letter={letter} onDone={() => setPhase("play")} />
      )}

      {phase === "play" && (
        <Game
          key={`game-${roundKey}`}
          letter={letter}
          baseScore={total}
          muted={muted}
          onToggleMute={toggleMute}
          onFinish={handleFinish}
          onQuit={() => setPhase("menu")}
          bots={bots}
          activeCategory={isDaily ? dailyCat ?? undefined : undefined}
          durationMs={isDaily ? 25_000 : undefined}
        />
      )}

      {phase === "results" && round && (
        <Results
          letter={letter}
          answers={round.answers}
          roundScore={round.roundScore}
          bonus={round.bonus}
          stopped={round.stopped}
          sessionTotal={total}
          rounds={rounds}
          savedRank={round.rank}
          bots={round.bots}
          beatBots={round.beatBots}
          isDaily={isDaily}
          dailyReward={round.dailyReward}
          dailyStreak={round.dailyStreak}
          onNext={nextRound}
          onRestart={restartAll}
          onMenu={() => setPhase("menu")}
        />
      )}
    </>
  );
}
