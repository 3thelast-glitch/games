import { useEffect, useMemo, useState } from 'react';
import { ChessBoard } from '../../../packages/games/chess/ui.tsx';
import {
  CHESS_PUZZLES,
  type ChessPuzzle,
  type ChessPuzzleDifficulty,
  type ChessPuzzleTheme,
} from '../../../packages/games/chess/puzzles.ts';
import {
  chessFromFen,
  chessMoveFromUci,
  chessMoveToSan,
} from '../../../packages/games/chess/notation.ts';
import { applyChess } from '../../../packages/games/chess/rules.ts';
import { buildChessGuidance } from '../../../packages/games/chess/guidance.ts';
import type { ChessMove, ChessState } from '../../../packages/games/chess/state.ts';
import { Icon } from './components.tsx';
import { useI18n } from './i18n.tsx';
import { storage } from './platform.ts';

interface PuzzleAttempt {
  attempts: number;
  solved: boolean;
  firstTry: boolean;
  errors: number;
  hints: number;
  revealed: boolean;
}
export interface ChessTrainerProgress {
  version: 1;
  puzzles: Record<string, PuzzleAttempt>;
}
interface SavedTrainerSession {
  version: 1;
  puzzleId: string;
  moves: string[];
  hintStage: number;
  errors: number;
  revealed: boolean;
}

const EMPTY_PROGRESS: ChessTrainerProgress = { version: 1, puzzles: {} };
const themes: ChessPuzzleTheme[] = [
  'fork',
  'pin',
  'skewer',
  'discoveredAttack',
  'deflection',
  'mate1',
  'mate2',
  'mate3',
  'promotion',
  'endgame',
];
const difficulties: ChessPuzzleDifficulty[] = ['beginner', 'intermediate', 'advanced'];

const sameMove = (a: ChessMove, b: ChessMove) =>
  a.from === b.from &&
  a.to === b.to &&
  (a.promotion ?? null) === (b.promotion ?? null);

const moveToUci = (move: ChessMove) => {
  const files = 'abcdefgh';
  const square = (index: number) =>
    `${files[index % 8]}${8 - Math.floor(index / 8)}`;
  const promotion =
    move.promotion === 'queen'
      ? 'q'
      : move.promotion === 'rook'
        ? 'r'
        : move.promotion === 'bishop'
          ? 'b'
          : move.promotion === 'knight'
            ? 'n'
            : '';
  return `${square(move.from)}${square(move.to)}${promotion}`;
};

function reconstruct(puzzle: ChessPuzzle, moves: readonly string[]): ChessState {
  let state = chessFromFen(puzzle.fen);
  for (const encoded of moves) state = applyChess(state, chessMoveFromUci(encoded));
  return state;
}

function solutionSan(puzzle: ChessPuzzle): string[] {
  let state = chessFromFen(puzzle.fen);
  const result: string[] = [];
  for (const encoded of puzzle.solutionLines[0]) {
    const move = chessMoveFromUci(encoded);
    result.push(chessMoveToSan(state, move));
    state = applyChess(state, move);
  }
  return result;
}

export function ChessTrainerPage({ onBack }: { onBack: () => void }) {
  const { t, lang } = useI18n();
  const [theme, setTheme] = useState<'mixed' | ChessPuzzleTheme>('mixed');
  const [difficulty, setDifficulty] = useState<'all' | ChessPuzzleDifficulty>('all');
  const [puzzleId, setPuzzleId] = useState(CHESS_PUZZLES[0].id);
  const [moves, setMoves] = useState<string[]>([]);
  const [hintStage, setHintStage] = useState(0);
  const [errors, setErrors] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [solved, setSolved] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [progress, setProgress] = useState<ChessTrainerProgress>(EMPTY_PROGRESS);
  const [restored, setRestored] = useState(false);

  const puzzle =
    CHESS_PUZZLES.find((item) => item.id === puzzleId) ?? CHESS_PUZZLES[0];
  const eligible = useMemo(
    () =>
      CHESS_PUZZLES.filter(
        (item) =>
          (theme === 'mixed' || item.themes.includes(theme)) &&
          (difficulty === 'all' || item.difficulty === difficulty),
      ),
    [theme, difficulty],
  );
  const state = useMemo(() => reconstruct(puzzle, moves), [puzzle, moves]);
  const mainLine = puzzle.solutionLines[0];
  const expected = mainLine[moves.length] ? chessMoveFromUci(mainLine[moves.length]) : null;
  const hintGuidance =
    expected && state.turn === puzzle.sideToMove
      ? buildChessGuidance(state, expected)
      : null;
  const revealMode = hintStage >= 3 ? 'move' : hintStage >= 2 ? 'piece' : 'cue';

  useEffect(() => {
    void Promise.all([
      storage.get<ChessTrainerProgress>('chess-trainer-progress-v1', EMPTY_PROGRESS),
      storage.get<SavedTrainerSession | null>('chess-trainer-session-v1', null),
    ]).then(([savedProgress, session]) => {
      setProgress(savedProgress);
      if (session?.version === 1 && CHESS_PUZZLES.some((item) => item.id === session.puzzleId)) {
        try {
          const target = CHESS_PUZZLES.find((item) => item.id === session.puzzleId)!;
          reconstruct(target, session.moves);
          setPuzzleId(session.puzzleId);
          setMoves(session.moves);
          setHintStage(Math.max(0, Math.min(3, session.hintStage)));
          setErrors(Math.max(0, session.errors));
          setRevealed(!!session.revealed);
        } catch {}
      }
      setRestored(true);
    });
  }, []);

  useEffect(() => {
    if (!restored || solved) return;
    void storage.set('chess-trainer-session-v1', {
      version: 1,
      puzzleId: puzzle.id,
      moves,
      hintStage,
      errors,
      revealed,
    } satisfies SavedTrainerSession);
  }, [restored, solved, puzzle.id, moves, hintStage, errors, revealed]);

  const recordProgress = (didSolve: boolean, usedReveal = revealed) => {
    setProgress((previous) => {
      const old = previous.puzzles[puzzle.id] ?? {
        attempts: 0,
        solved: false,
        firstTry: false,
        errors: 0,
        hints: 0,
        revealed: false,
      };
      const next: ChessTrainerProgress = {
        version: 1,
        puzzles: {
          ...previous.puzzles,
          [puzzle.id]: {
            attempts: old.attempts + (old.solved ? 0 : 1),
            solved: old.solved || didSolve,
            firstTry: old.firstTry || (didSolve && errors === 0 && hintStage === 0 && !usedReveal),
            errors: old.errors + errors,
            hints: old.hints + hintStage,
            revealed: old.revealed || usedReveal,
          },
        },
      };
      void storage.set('chess-trainer-progress-v1', next);
      return next;
    });
  };

  const finishSolved = () => {
    setSolved(true);
    setFeedback(t('chessTrainerSolved'));
    recordProgress(true);
    void storage.remove('chess-trainer-session-v1');
  };

  useEffect(() => {
    if (
      solved ||
      revealed ||
      state.turn === puzzle.sideToMove ||
      moves.length >= mainLine.length
    )
      return;
    const encoded = mainLine[moves.length];
    if (!encoded) return;
    const timeout = setTimeout(() => {
      try {
        const reply = chessMoveFromUci(encoded);
        const next = applyChess(state, reply);
        const nextMoves = [...moves, encoded];
        setMoves(nextMoves);
        setFeedback(t('chessTrainerDefenderReply'));
        if (nextMoves.length >= mainLine.length || next.winner !== null) finishSolved();
      } catch {
        setFeedback(t('chessTrainerContentError'));
      }
    }, 360);
    return () => clearTimeout(timeout);
  }, [state, puzzle.id, puzzle.sideToMove, moves, mainLine, solved, revealed]);

  const onMove = (move: ChessMove) => {
    if (solved || revealed || state.turn !== puzzle.sideToMove || !expected) return;
    if (!sameMove(move, expected)) {
      setErrors((value) => value + 1);
      setFeedback(t('chessTrainerWrongMove'));
      return;
    }
    const encoded = moveToUci(move);
    const next = applyChess(state, move);
    const nextMoves = [...moves, encoded];
    setMoves(nextMoves);
    setFeedback(t('chessTrainerCorrectMove'));
    if (nextMoves.length >= mainLine.length || next.winner !== null) finishSolved();
  };

  const resetPuzzle = (target = puzzle) => {
    setPuzzleId(target.id);
    setMoves([]);
    setHintStage(0);
    setErrors(0);
    setRevealed(false);
    setSolved(false);
    setFeedback('');
  };

  const nextPuzzle = () => {
    const pool = eligible.length ? eligible : CHESS_PUZZLES;
    const index = pool.findIndex((item) => item.id === puzzle.id);
    resetPuzzle(pool[(index + 1 + pool.length) % pool.length]);
  };

  const revealSolution = () => {
    recordProgress(false, true);
    setRevealed(true);
    setSolved(false);
    setMoves([]);
    setHintStage(3);
    setFeedback(t('chessTrainerSolutionMode'));
  };

  const stepSolution = () => {
    if (!revealed) return;
    const encoded = mainLine[moves.length];
    if (!encoded) return;
    const nextMoves = [...moves, encoded];
    setMoves(nextMoves);
    if (nextMoves.length >= mainLine.length) setFeedback(t('chessTrainerSolutionComplete'));
  };

  const solvedCount = Object.values(progress.puzzles).filter((item) => item.solved).length;
  const firstTryCount = Object.values(progress.puzzles).filter((item) => item.firstTry).length;
  const totalHints = Object.values(progress.puzzles).reduce((sum, item) => sum + item.hints, 0);
  const trainingScore = Math.max(800, 1000 + firstTryCount * 8 + (solvedCount - firstTryCount) * 3 - totalHints);

  return (
    <div className="page-enter chess-trainer-page">
      <header className="page-heading chess-trainer-heading">
        <button className="icon-button" aria-label={t('back')} onClick={onBack}>
          <Icon name="back" />
        </button>
        <div>
          <span className="eyebrow">{t('chessTacticalTrainer')}</span>
          <h1>{t('chessTrainerTitle')}</h1>
          <p>{t('chessTrainerDesc')}</p>
        </div>
      </header>

      <section className="panel chess-trainer-controls">
        <div>
          <label>{t('chessTrainerTheme')}</label>
          <select value={theme} onChange={(event) => setTheme(event.target.value as typeof theme)}>
            <option value="mixed">{t('chessTrainerMixed')}</option>
            {themes.map((item) => (
              <option key={item} value={item}>{t(`chessPuzzleTheme_${item}`)}</option>
            ))}
          </select>
        </div>
        <div>
          <label>{t('difficulty')}</label>
          <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as typeof difficulty)}>
            <option value="all">{t('all')}</option>
            {difficulties.map((item) => (
              <option key={item} value={item}>{t(`chessPuzzleDifficulty_${item}`)}</option>
            ))}
          </select>
        </div>
        <div className="chess-trainer-score">
          <span>{t('chessTrainerLocalScore')}</span>
          <strong>{trainingScore}</strong>
          <small>{t('chessTrainerNotOfficialRating')}</small>
        </div>
      </section>

      <div className="chess-trainer-layout">
        <section className="chess-trainer-board">
          <div className="chess-puzzle-task panel">
            <span className="eyebrow">
              {puzzle.sideToMove === 0 ? t('chessWhiteToMove') : t('chessBlackToMove')}
            </span>
            <h2>{lang === 'ar' ? puzzle.titleAr : puzzle.titleEn}</h2>
            <p>{lang === 'ar' ? puzzle.objectiveAr : puzzle.objectiveEn}</p>
            <span className="outline-pill">{t(`chessPuzzleTheme_${puzzle.themes[0]}`)}</span>
          </div>
          <ChessBoard
            state={state}
            disabled={solved || (state.turn !== puzzle.sideToMove && !revealed)}
            onMove={onMove}
            t={t}
            mode="ai"
            guidance={hintGuidance}
            guidanceReveal={revealMode}
          />
          {feedback && <div className="inline-notice" role="status">{feedback}</div>}
        </section>

        <aside className="chess-trainer-side">
          <section className="panel">
            <span className="eyebrow">{t('chessTrainerHint')}</span>
            {hintStage === 0 ? (
              <p>{t('chessTrainerHintPrompt')}</p>
            ) : (
              <p>{(lang === 'ar' ? puzzle.hintsAr : puzzle.hintsEn)[Math.min(2, hintStage - 1)]}</p>
            )}
            <button
              className="button secondary full"
              disabled={hintStage >= 3 || revealed || solved}
              onClick={() => setHintStage((value) => Math.min(3, value + 1))}
            >
              {hintStage === 0 ? t('chessTrainerHintIdea') : hintStage === 1 ? t('chessTrainerHintPiece') : t('chessTrainerHintMove')}
            </button>
          </section>

          <section className="panel">
            <span className="eyebrow">{t('chessTrainerActions')}</span>
            <div className="chess-trainer-actions">
              <button className="button ghost" onClick={() => resetPuzzle()}>{t('retry')}</button>
              {!revealed ? (
                <button className="button secondary" onClick={revealSolution}>{t('chessTrainerReveal')}</button>
              ) : (
                <button
                  className="button secondary"
                  disabled={moves.length >= mainLine.length}
                  onClick={stepSolution}
                >
                  {t('chessTrainerStepSolution')}
                </button>
              )}
              <button className="button primary" onClick={nextPuzzle}>{t('chessTrainerNext')}</button>
            </div>
          </section>

          {(solved || revealed) && (
            <section className="panel chess-trainer-explanation">
              <span className="eyebrow">{t('chessTrainerExplanation')}</span>
              <p>{lang === 'ar' ? puzzle.explanationAr : puzzle.explanationEn}</p>
              <div className="chess-solution-line" dir="ltr">
                {solutionSan(puzzle).map((san, index) => <span key={index}>{san}</span>)}
              </div>
            </section>
          )}

          <section className="panel chess-trainer-progress">
            <strong>{t('chessTrainerProgress')}</strong>
            <span>{t('chessTrainerSolvedCount')}: {solvedCount}/{CHESS_PUZZLES.length}</span>
            <span>{t('chessTrainerFirstTry')}: {firstTryCount}</span>
          </section>
        </aside>
      </div>
    </div>
  );
}
