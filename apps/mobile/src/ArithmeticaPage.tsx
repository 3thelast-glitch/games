import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  answerMathRun, beginMathRun, defaultMathRecord,
  MAX_TIME_MS, pauseMathRun, readMathRecord, recordMathMilestone,
  SAVE_KEY, startMathRun, summarizeMathRun, tickMathRun,
  type MathRecord, type MathRun,
} from '../../../packages/games/arithmetica/engine.ts';
import { feedback, storage, type Settings } from './platform.ts';
import { enterFullscreenOnlyGame, leaveFullscreenOnlyGame } from './immersive-game.ts';
import { useI18n } from './i18n.tsx';

type MathScreen = 'home' | 'game';
const STAGES_PER_PAGE = 15;
const formatTime = (ms: number) => (Math.max(0, ms) / 1000).toFixed(1);
const keys = new Map([['1',0],['2',1],['arrowleft',0],['arrowright',1],['a',0],['d',1]]);

export function ArithmeticaPage({ onExit, settings }: { onExit: () => void; settings: Settings }) {
  const { t, lang } = useI18n();
  const run = useRef<MathRun>(startMathRun());
  const record = useRef<MathRecord>(defaultMathRecord());
  const [loaded, setLoaded] = useState(false);
  const [screen, setScreen] = useState<MathScreen>('home');
  const [view, setView] = useState<MathRun>(run.current);
  const [stats, setStats] = useState<MathRecord>(record.current);
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [levelPage, setLevelPage] = useState(0);
  const [showLevels, setShowLevels] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const processed = useRef(false);
  const inputLockedUntil = useRef(0);
  const lastUpdate = useRef(0);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  const sync = useCallback(() => {
    setView(run.current);
    setStats({ ...record.current });
  }, []);

  // Serialize saves: a slower previous write must never overwrite a newer milestone.
  const saveRecord = useCallback(() => {
    const snapshot = { ...record.current };
    saveQueue.current = saveQueue.current.then(() => storage.set(SAVE_KEY, snapshot)).catch(() => {});
  }, []);

  const complete = useCallback(() => {
    if (run.current.phase !== 'gameover' || processed.current) return;
    processed.current = true;
    record.current = summarizeMathRun(record.current, run.current);
    saveRecord();
    sync();
    feedback(settingsRef.current, 'win');
  }, [saveRecord, sync]);

  useEffect(() => {
    enterFullscreenOnlyGame('arithmetica');
    return () => { void leaveFullscreenOnlyGame(); };
  }, []);

  useEffect(() => {
    let active = true;
    void storage.get<unknown>(SAVE_KEY, null).then(saved => {
      if (!active) return;
      record.current = readMathRecord(saved);
      setSelectedLevel(record.current.bestLevel);
      setLevelPage(Math.floor((record.current.bestLevel - 1) / STAGES_PER_PAGE));
      setLoaded(true);
      sync();
    }).catch(() => {
      if (active) { setLoaded(true); sync(); }
    });
    return () => { active = false; };
  }, [sync]);

  // Stop counting time on the start screen, after leaving the game, or on hidden tabs.
  useEffect(() => {
    if (!loaded || screen !== 'game') return;
    let frame = 0, last = 0, carry = 0;
    const animate = (now: number) => {
      if (last === 0) last = now;
      const raw = Math.max(0, now - last);
      last = now;
      if (document.visibilityState === 'visible' && run.current.phase === 'playing') {
        if (raw > 2000) {
          carry = 0;
          run.current = pauseMathRun(run.current);
          sync();
        } else {
          carry += raw;
          if (carry >= 30) {
            let remaining = carry;
            carry = 0;
            while (remaining > 0 && run.current.phase === 'playing') {
              const step = Math.min(1000, remaining);
              run.current = tickMathRun(run.current, step);
              remaining -= step;
            }
            if (now - lastUpdate.current > 50 || run.current.phase === 'gameover') {
              lastUpdate.current = now;
              sync();
            }
            if (run.current.phase === 'gameover') complete();
          }
        }
      } else carry = 0;
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    const visibility = () => {
      last = 0;
      carry = 0;
      if (document.visibilityState === 'hidden' && run.current.phase === 'playing') {
        run.current = pauseMathRun(run.current);
        sync();
      }
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [loaded, screen, sync, complete]);

  const startGame = useCallback(() => {
    if (!loaded) return;
    // Only a previously earned level may be selected.
    const level = Math.max(1, Math.min(selectedLevel, record.current.bestLevel));
    run.current = beginMathRun(startMathRun(Date.now(), level));
    processed.current = false;
    inputLockedUntil.current = 0;
    setAnnouncement('');
    setShowHelp(false);
    setScreen('game');
    sync();
  }, [loaded, selectedLevel, sync]);

  const answer = useCallback((index: number) => {
    if (!loaded || screen !== 'game' || run.current.phase !== 'playing'
        || performance.now() < inputLockedUntil.current) return;
    inputLockedUntil.current = performance.now() + 140;
    const correct = run.current.question.correctIndex === index;
    run.current = answerMathRun(run.current, index);
    const improved = recordMathMilestone(record.current, run.current);
    if (improved !== record.current) {
      record.current = improved;
      setSelectedLevel(improved.bestLevel);
      saveRecord(); // Save immediately, even if the player exits before time expires.
      setAnnouncement(t('arithmeticaNewLevel') + ': ' + improved.bestLevel);
    } else {
      setAnnouncement(t(correct ? 'arithmeticaAnswerCorrect' : 'arithmeticaAnswerWrong')
        + ' · ' + t('arithmeticaScore') + ': ' + run.current.score);
    }
    if (correct) feedback(settingsRef.current, 'move');
    sync();
    if (run.current.phase === 'gameover') complete();
  }, [loaded, screen, saveRecord, sync, complete, t]);

  const toHome = useCallback(() => {
    if (run.current.phase === 'playing') run.current = pauseMathRun(run.current);
    setSelectedLevel(record.current.bestLevel);
    setLevelPage(Math.floor((record.current.bestLevel - 1) / STAGES_PER_PAGE));
    setScreen('home');
    sync();
  }, [sync]);

  const togglePause = useCallback(() => {
    run.current = pauseMathRun(run.current);
    sync();
  }, [sync]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
      if ((e.target as HTMLElement | null)?.closest('input,textarea,select,[contenteditable="true"]')) return;
      if (screen === 'home') return;
      const index = keys.get(e.key.toLowerCase());
      if (index !== undefined && run.current.phase === 'playing') {
        e.preventDefault();
        answer(index);
      } else if (e.key === 'Escape' && ['playing', 'paused'].includes(run.current.phase)) {
        e.preventDefault();
        togglePause();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, answer, togglePause]);

  if (!loaded) return createPortal(
    <main className="arithmetica-immersive arithmetica-page" role="status">{t('loading')}</main>,
    document.body,
  );

  const timePercent = Math.max(0, view.timeMs / MAX_TIME_MS * 100);
  const ended = view.phase === 'gameover', paused = view.phase === 'paused';
  const accuracy = view.answered > 0 ? Math.round(view.correct / view.answered * 100) + '%' : '—';
  const totalPages = Math.max(1, Math.ceil(stats.bestLevel / STAGES_PER_PAGE));
  const visibleLevels = Array.from({ length: STAGES_PER_PAGE },
    (_, i) => levelPage * STAGES_PER_PAGE + i + 1);
  const stars = Array.from({ length: 5 }, (_, i) => i < view.stars);

  return createPortal(
    <main className={'arithmetica-page arithmetica-immersive page-enter'
      + (screen === 'home' ? ' arithmetica-home' : ' arithmetica-playing')}
      data-arithmetica-screen={screen} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {screen === 'home' ? (
        <section className="arithmetica-start-screen">
          <header className="arithmetica-start-header">
            <span className="arithmetica-start-brand">NAQLA · MENTAL MATH</span>
            <button type="button" className="arithmetica-exit" onClick={onExit}>
              {t('arithmeticaBack')}
            </button>
          </header>
          <div className="arithmetica-start-panel">
            <div className="arithmetica-start-drawing" aria-hidden="true">
              <span>8 + 5 = ?</span><span className="arithmetica-start-drawing-stars">☆ ★ ☆ ★ ☆</span>
            </div>
            <h1>{t('arithmetica')}</h1>
            <p>{t('arithmeticaStartDesc')}</p>
            <div className="arithmetica-start-stats">
              <span>{t('arithmeticaBestLevel')}<strong data-arithmetica-best-level>{stats.bestLevel}</strong></span>
              <span>{t('arithmeticaBest')}<strong>{stats.bestScore}</strong></span>
            </div>
            <div className="arithmetica-start-current">
              <span>{t('arithmeticaSelectedLevel')}</span>
              <strong data-arithmetica-selected-level>{selectedLevel}</strong>
            </div>
            <button type="button" className="arithmetica-start-button" onClick={startGame}>
              {t('arithmeticaStart')} <span aria-hidden="true">▶</span>
            </button>
            <button type="button" className="arithmetica-levels-toggle"
              aria-expanded={showLevels} onClick={() => setShowLevels(v => !v)}>
              {t('arithmeticaChooseLevel')} {showLevels ? '▴' : '▾'}
            </button>
            {showLevels && <div className="arithmetica-level-picker">
              <div className="arithmetica-level-picker-nav">
                <button type="button" onClick={() => setLevelPage(v => Math.max(0, v - 1))}
                  disabled={levelPage === 0} aria-label={t('arithmeticaPreviousLevels')}>‹</button>
                <span>{levelPage + 1} / {totalPages}</span>
                <button type="button" onClick={() => setLevelPage(v => Math.min(totalPages - 1, v + 1))}
                  disabled={levelPage === totalPages - 1} aria-label={t('arithmeticaNextLevels')}>›</button>
              </div>
              <div className="arithmetica-stage-grid">
                {visibleLevels.map(level => (
                  <button type="button" key={level}
                    className={'arithmetica-stage ' + (level < stats.bestLevel ? 'cleared ' : '')
                      + (level === selectedLevel ? 'selected ' : '')}
                    disabled={level > stats.bestLevel}
                    aria-pressed={level === selectedLevel}
                    aria-label={t('arithmeticaLevel') + ' ' + level
                      + (level < stats.bestLevel ? ' · ' + t('arithmeticaCompleted') : '')}
                    onClick={() => setSelectedLevel(level)}>
                    <span>{String(level).padStart(2, '0')}</span>
                    <small>{level < stats.bestLevel ? '✓' : level === stats.bestLevel ? '★' : '🔒'}</small>
                  </button>
                ))}
              </div>
              <p>{t('arithmeticaUnlockedNote')}</p>
            </div>}
            <p className="arithmetica-offline">{t('arithmeticaOffline')}</p>
          </div>
        </section>
      ) : (
        <>
          <header className="arithmetica-heading">
            <div><span className="eyebrow">NAQLA · MENTAL MATH</span>
              <h1>{t('arithmetica')}</h1></div>
            <button className="button secondary" type="button" onClick={toHome}>
              {t('arithmeticaMenu')}
            </button>
          </header>
          <section className="arithmetica-layout">
            <div className="arithmetica-wood" dir="ltr">
              <div className="arithmetica-blackboard" aria-label={t('arithmeticaBoard')}>
                <div className="arithmetica-chalk-noise" aria-hidden="true" />
                <div className="arithmetica-board-header">
                  <strong className="arithmetica-level">{t('arithmeticaLevel')} {view.level}</strong>
                  <div className="arithmetica-timer-controls">
                    <div className={'arithmetica-time' +
                      (view.timeMs <= 8000 && view.phase === 'playing' ? ' urgent' : '')}
                      role="progressbar" aria-label={t('arithmeticaTime')}
                      aria-valuemin={0} aria-valuemax={MAX_TIME_MS}
                      aria-valuenow={Math.round(view.timeMs)}
                      aria-valuetext={formatTime(view.timeMs) + ' s'}>
                      <div className="arithmetica-time-fill" style={{ width: timePercent + '%' }} />
                    </div>
                    <button className="arithmetica-board-pause" type="button"
                      onClick={togglePause} disabled={view.phase !== 'playing'}
                      aria-label={t('arithmeticaPause')} title={t('arithmeticaPause')}>Ⅱ</button>
                  </div>
                </div>
                <div className="arithmetica-stars" aria-label={view.stars + ' / 5'}>
                  {stars.map((filled, i) => <span key={i} className={filled ? 'earned' : ''}
                    aria-hidden="true">{filled ? '★' : '☆'}</span>)}
                </div>
                <div key={'question-' + view.question.id}
                  className={'arithmetica-question ' + (view.feedback ?? '')} aria-live="polite">
                  <span>{view.question.left}</span>
                  <span className="arithmetica-operation">{view.question.op}</span>
                  <span>{view.question.right}</span><span>=</span><span>?</span>
                </div>
                <div className="arithmetica-answer-grid">
                  {view.question.choices.map((value, index) =>
                    <button type="button" key={view.question.id + '-' + index}
                      onClick={() => answer(index)} disabled={view.phase !== 'playing'}
                      className="arithmetica-answer" aria-label={String(value)}>{value}</button>)}
                </div>
                <p className="arithmetica-announcement" aria-live="polite"
                  aria-atomic="true">{announcement}</p>
                <div className="arithmetica-chalk-footer">
                  <span>{t('arithmeticaScore')}: <b>{view.score}</b></span>
                  <span>{formatTime(view.timeMs)}s</span>
                </div>
                {(paused || ended) && <div className="arithmetica-overlay" role="status">
                  <span className="arithmetica-overlay-icon" aria-hidden="true">{ended ? '✩' : 'Ⅱ'}</span>
                  <h2>{t(ended ? 'arithmeticaGameOver' : 'arithmeticaPaused')}</h2>
                  <p>{t(ended ? 'arithmeticaOverDesc' : 'arithmeticaPauseDesc')}</p>
                  {ended && <div className="arithmetica-result-stats">
                    <span>{t('arithmeticaScore')}<b>{view.score}</b></span>
                    <span>{t('arithmeticaCorrect')}<b>{view.correct}</b></span>
                    <span>{t('arithmeticaBestLevel')}<b>{stats.bestLevel}</b></span>
                  </div>}
                  <button type="button" onClick={ended ? startGame : togglePause}>
                    {t(ended ? 'arithmeticaRetry' : 'arithmeticaResume')}
                  </button>
                  <button type="button" className="arithmetica-overlay-menu" onClick={toHome}>
                    {t('arithmeticaMenu')}
                  </button>
                </div>}
              </div>
            </div>
            <aside className="arithmetica-sidebar">
              <div className="arithmetica-info">
                <strong>{t('arithmeticaHow')}</strong>
                <p>{t('arithmeticaHelp')}</p>
              </div>
              <div className="arithmetica-stats">
                <span>{t('arithmeticaBest')}<b>{stats.bestScore}</b></span>
                <span>{t('arithmeticaBestLevel')}<b data-arithmetica-best-level>{stats.bestLevel}</b></span>
                <span>{t('arithmeticaSolved')}<b>{stats.totalSolved}</b></span>
                <span>{t('arithmeticaStreak')}<b>{view.streak}</b></span>
                <span>{t('arithmeticaAccuracy')}<b>{accuracy}</b></span>
              </div>
              <div className="arithmetica-actions">
                <button type="button" onClick={togglePause}
                  disabled={view.phase === 'ready' || ended}>
                  {t(paused ? 'arithmeticaResume' : 'arithmeticaPause')}
                </button>
                <button type="button" onClick={startGame}>{t('arithmeticaRetry')}</button>
                <button type="button" onClick={() => setShowHelp(v => !v)}
                  aria-expanded={showHelp}>{t('arithmeticaHow')}</button>
                <button type="button" onClick={toHome}>{t('arithmeticaMenu')}</button>
              </div>
              {showHelp && <p className="arithmetica-help-expanded">{t('arithmeticaRules')}</p>}
              <p className="arithmetica-offline">{t('arithmeticaOffline')}</p>
            </aside>
          </section>
        </>
      )}
    </main>, document.body,
  );
}
