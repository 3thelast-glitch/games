import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import {
  addStroke, clamp, COURT_HEIGHT, COURT_WIDTH, INK_CAP, makeRound,
  remainingInk, remainingPencils, STEP_SECONDS, strokeLength, stepRound, validateProgress,
  type BasketRound, type Vec,
} from '../../../packages/games/basketball-line/engine.ts';
import { paintBasketScene } from './BasketballLineArt.tsx';
import { storage, feedback, type Settings } from './platform.ts';
import { useI18n } from './i18n.tsx';

const SAVE_KEY = 'basketball-line-v1';
type Progress = { round: number; best: number; gems: number };
type Snapshot = {
  round: number; best: number; gems: number;
  phase: BasketRound['phase']; pencils: number; ink: number; collected: boolean;
  basketballs: number; message: BasketRound['message'];
};
const snapshot = (game: BasketRound, progress: Progress): Snapshot => ({
  round: game.round, best: progress.best, gems: progress.gems,
  phase: game.phase, pencils: remainingPencils(game), ink: remainingInk(game),
  collected: game.gemCollected,
  basketballs: game.balls.filter(ball => ball.kind === 'basketball').length,
  message: game.message,
});
const fresh = () => makeRound(1);

export function BasketballLinePage({ onExit, settings }: {
  onExit: () => void; settings: Settings;
}) {
  const { t } = useI18n();
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<BasketRound>(fresh());
  const drawing = useRef<Vec[] | null>(null);
  const pointer = useRef<number | null>(null);
  const progress = useRef<Progress>({ round: 1, best: 0, gems: 0 });
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<Snapshot>(() => snapshot(game.current, progress.current));
  const sync = useCallback(() => setView(snapshot(game.current, progress.current)), []);
  useEffect(() => {
    let active = true;
    void storage.get<unknown>(SAVE_KEY, null).then((saved) => {
      if (!active) return;
      progress.current = validateProgress(saved);
      game.current = makeRound(progress.current.round);
      sync();
      setLoaded(true);
    });
    return () => { active = false; };
  }, [sync]);
  useEffect(() => {
    if (!loaded || !canvas.current) return;
    const element = canvas.current;
    const context = element.getContext('2d');
    if (!context) return;
    const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
    element.width = COURT_WIDTH * pixelRatio;
    element.height = COURT_HEIGHT * pixelRatio;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    let frame = 0;
    let last = 0;
    let accumulator = 0;
    const tick = (now: number) => {
      if (last === 0) last = now;
      const frameDt = Math.min(.05, Math.max(0, (now - last) / 1000));
      last = now;
      accumulator = Math.min(.06, accumulator + frameDt);
      const round = game.current;
      let remainingSteps = 8;
      if (round.phase === 'running') {
        while (accumulator >= STEP_SECONDS && remainingSteps-- > 0 && round.phase === 'running') {
          const before = round.phase;
          const after = stepRound(round);
          accumulator -= STEP_SECONDS;
          if (after !== before) {
            if (after === 'won') {
              progress.current.best = Math.max(progress.current.best, round.round);
              progress.current.gems += round.gemCollected ? 1 : 0;
              progress.current.round = Math.min(9999, round.round + 1);
              feedback(settingsRef.current, 'win');
              void storage.set(SAVE_KEY, progress.current);
            } else if (after === 'lost') {
              void storage.set(SAVE_KEY, progress.current);
            }
            sync();
          }
        }
      } else {
        accumulator = 0;
      }
      paintBasketScene(context, game.current, drawing.current, settingsRef.current.reduceMotion);
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [loaded, sync]);
  const toPoint = (event: PointerEvent<HTMLCanvasElement>): Vec => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: clamp((event.clientX - rect.left) / Math.max(1, rect.width) * COURT_WIDTH, 0, COURT_WIDTH),
      y: clamp((event.clientY - rect.top) / Math.max(1, rect.height) * COURT_HEIGHT, 0, COURT_HEIGHT),
    };
  };
  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const round = game.current;
    if (!loaded || pointer.current !== null || (event.pointerType === 'mouse' && event.button !== 0) ||
        !['ready', 'running'].includes(round.phase) ||
        remainingPencils(round) === 0 || remainingInk(round) < 14) return;
    event.preventDefault();
    pointer.current = event.pointerId;
    drawing.current = [toPoint(event)];
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (pointer.current !== event.pointerId || !drawing.current) return;
    event.preventDefault();
    const point = toPoint(event);
    const lastPoint = drawing.current.at(-1)!;
    if (Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) < 1.8) return;
    const budget = remainingInk(game.current);
    const left = Math.max(0, budget - strokeLength(drawing.current));
    if (left < 1) return;
    const dx = point.x - lastPoint.x, dy = point.y - lastPoint.y;
    const distance = Math.hypot(dx, dy);
    drawing.current.push(distance > left ?
      { x: lastPoint.x + dx / distance * left, y: lastPoint.y + dy / distance * left } : point);
  };
  const finishStroke = (event: PointerEvent<HTMLCanvasElement>, cancel = false) => {
    if (pointer.current !== event.pointerId) return;
    const points = drawing.current;
    pointer.current = null;
    drawing.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (!cancel && points && addStroke(game.current, points)) {
      sync();
      feedback(settingsRef.current, 'move');
    }
  };
  const reset = () => {
    game.current = makeRound(game.current.round);
    drawing.current = null;
    pointer.current = null;
    sync();
  };
  const next = () => {
    game.current = makeRound(progress.current.round);
    drawing.current = null;
    pointer.current = null;
    sync();
  };
  const erase = () => {
    const round = game.current;
    if (!round.strokes.length || (round.phase !== 'ready' && round.phase !== 'running')) return;
    const last = round.strokes.pop()!;
    round.inkUsed = Math.max(0, round.inkUsed - last.length);
    sync();
  };
  if (!loaded) return <main className="basketball-page"><p>{t('loading')}</p></main>;
  return (
    <main className="basketball-page page-enter" dir="ltr">
      <header className="basketball-heading">
        <div>
          <span className="eyebrow">NAQLA · ARCADE</span>
          <h1>{t('basketballLine')}</h1>
          <p>{t('basketballLineDesc')}</p>
        </div>
        <button type="button" className="button secondary" onClick={onExit}>{t('basketballLineBack')}</button>
      </header>
      <section className="basketball-layout">
        <div className="basketball-machine">
          <div className="basketball-hud" aria-live="polite">
            <div className="basketball-gems"><span aria-hidden="true">◆</span> {view.gems}</div>
            <div className="basketball-hud-middle">
              <strong>{view.round}</strong>
              <span aria-label={t('basketballLinePencils')}>
                {Array.from({ length: game.current.pencils }, (_, index) =>
                  <span key={index} aria-hidden="true"
                    className={index < view.pencils ? 'pencil-live' : 'pencil-spent'}>✎</span>)}
              </span>
            </div>
            <div className="basketball-best">{t('basketballLineBest')}: {view.best}</div>
          </div>
          <div className="basketball-canvas-wrap">
            <canvas ref={canvas} className="basketball-canvas"
              aria-label={t('basketballLineBoard')}
              onPointerDown={onPointerDown} onPointerMove={onPointerMove}
              onPointerUp={(e) => finishStroke(e)}
              onPointerCancel={(e) => finishStroke(e, true)}
              onLostPointerCapture={(e) => {
                if (pointer.current === e.pointerId) {
                  pointer.current = null;
                  drawing.current = null;
                }
              }}
              role="img" />
            {view.phase === 'ready' && <div className="basketball-instructions" aria-hidden="true">
              <span className="basketball-instruction-icon">✎</span>
              {t('basketballLineDraw')}
            </div>}
            {(view.phase === 'won' || view.phase === 'lost') && (
              <div className={'basketball-result ' + view.phase} role="status">
                <span className="basketball-result-icon" aria-hidden="true">
                  {view.phase === 'won' ? '🏀' : '✎'}
                </span>
                <h2>{t(view.phase === 'won' ? 'basketballLineScored' : 'basketballLineMiss')}</h2>
                <p>{t(view.phase === 'won' ?
                  'basketballLineWinDesc' :
                  view.message === 'bomb' ? 'basketballLineBomb' :
                    view.message === 'time' ? 'basketballLineTimeout' : 'basketballLineFailDesc')}</p>
                <button type="button" onClick={view.phase === 'won' ? next : reset}>
                  {t(view.phase === 'won' ? 'basketballLineNext' : 'basketballLineRetry')}
                </button>
              </div>
            )}
          </div>
          <div className="basketball-ink-row">
            <span>{t('basketballLineInk')}</span>
            <div className="basketball-ink-meter"
              role="progressbar" aria-valuemin={0} aria-valuemax={INK_CAP}
              aria-valuenow={view.ink} aria-label={t('basketballLineInk')}>
              <span style={{ width: (view.ink / INK_CAP * 100) + '%' }}/>
            </div>
            <b>{view.pencils} ✎</b>
          </div>
        </div>
        <aside className="basketball-panel" dir={undefined}>
          <div className="basketball-panel-head">
            <span aria-hidden="true">🏀</span>
            <div><strong>{t('basketballLineGoal')}</strong><p>{t('basketballLineHelp')}</p></div>
          </div>
          <div className="basketball-facts">
            <span>{t('basketballLineRound')} <b>{view.round}</b></span>
            <span>{t('basketballLineBalls')} <b>{view.basketballs}</b></span>
            <span>{t('basketballLineBombs')} <b>{game.current.balls.filter(b=>b.kind==='bomb').length}</b></span>
          </div>
          <div className="basketball-buttons">
            <button type="button" onClick={reset}>{t('basketballLineRetry')}</button>
            <button type="button" onClick={erase} disabled={!game.current.strokes.length ||
              (view.phase !== 'ready' && view.phase !== 'running')}>{t('basketballLineErase')}</button>
          </div>
          <p className="basketball-panel-note">{t('basketballLineOffline')}</p>
        </aside>
      </section>
    </main>
  );
}
