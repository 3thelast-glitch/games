import { useEffect, useMemo, useRef, useState } from 'react';
import { legalDominoMoves, projectDominoState } from './rules.ts';
import { dominoTile, type DominoSide, type DominoesMove, type DominoesState } from './state.ts';

interface Props {
  state: DominoesState;
  disabled: boolean;
  onMove: (move: DominoesMove) => void;
  t: (key: string) => string;
  mode?: 'local' | 'ai' | 'online';
}

const PIP_SLOTS: Record<number, number[]> = {
  0: [],
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};

function DominoHalf({ value }: { value: number }) {
  return (
    <span className="domino-half">
      {PIP_SLOTS[value].map((slot) => {
        const row = Math.ceil(slot / 3);
        const col = ((slot - 1) % 3) + 1;
        return <span key={slot} className="domino-pip" style={{ gridRow: row, gridColumn: col }} />;
      })}
    </span>
  );
}

function DominoFace({ id, oriented }: { id: string; oriented?: [number, number] }) {
  const tile = dominoTile(id),
    values = oriented ?? [tile.a, tile.b];
  return (
    <span className={`domino-tile ${values[0] === values[1] ? 'double' : ''}`} aria-hidden="true">
      <DominoHalf value={values[0]} />
      <i className="domino-divider" />
      <DominoHalf value={values[1]} />
    </span>
  );
}

function tileLabel(id: string, t: (key: string) => string, legal = false) {
  const { a, b } = dominoTile(id);
  return `${t('dominoTile')} ${a}–${b}${legal ? ` · ${t('dominoPlayable')}` : ''}`;
}

export function DominoesBoard({ state, disabled, onMove, t, mode = 'online' }: Props) {
  const [selected, setSelected] = useState<string | null>(null),
    [revealedSeat, setRevealedSeat] = useState<0 | 1 | null>(null);
  const chainShell = useRef<HTMLDivElement>(null);

  useEffect(() => setSelected(null), [state.ply, state.turn]);
  useEffect(() => {
    if (mode === 'local') setRevealedSeat(null);
  }, [mode, state.turn]);

  const displayState = useMemo(() => {
    if (state.viewerSeat !== undefined) return state;
    if (mode === 'ai') return projectDominoState(state, 0);
    if (mode === 'local') return projectDominoState(state, revealedSeat);
    return state;
  }, [mode, revealedSeat, state]);
  const handoff =
    mode === 'local' &&
    state.viewerSeat === undefined &&
    revealedSeat !== state.turn &&
    !state.winner &&
    !state.drawReason;
  const moves = useMemo(() => legalDominoMoves(displayState), [displayState]);
  const playMoves = moves.filter(
    (move): move is Extract<DominoesMove, { type: 'play' }> => move.type === 'play',
  );
  const byTile = new Map<string, DominoSide[]>();
  for (const move of playMoves)
    byTile.set(move.tileId, [...(byTile.get(move.tileId) ?? []), move.side]);
  const viewer = displayState.viewerSeat ?? displayState.turn,
    hand = viewer === null ? [] : displayState.hands[viewer],
    opponent = viewer === null ? null : viewer === 0 ? 1 : 0,
    selectedSides = selected ? byTile.get(selected) ?? [] : [],
    openEnds = displayState.chain.length
      ? [
          displayState.chain[0].leftValue,
          displayState.chain[displayState.chain.length - 1].rightValue,
        ]
      : null;

  const play = (tileId: string) => {
    const sides = byTile.get(tileId) ?? [];
    if (disabled || handoff || !sides.length) return;
    if (sides.length === 1) onMove({ type: 'play', tileId, side: sides[0] });
    else setSelected(tileId);
  };

  const chooseSide = (side: DominoSide) => {
    if (!selected || disabled || !selectedSides.includes(side)) return;
    onMove({ type: 'play', tileId: selected, side });
  };

  const moveViewport = (side: DominoSide) => {
    const element = chainShell.current;
    if (!element) return;
    element.scrollLeft = side === 'left' ? 0 : element.scrollWidth;
  };

  return (
    <section className="dominoes-game" aria-label={t('dominoes')}>
      <div className="dominoes-summary">
        <span>
          <i className="domino-summary-icon boneyard" aria-hidden="true" />
          <strong>{displayState.boneyardCount}</strong> {t('dominoBoneyard')}
        </span>
        {opponent !== null && (
          <span>
            <i className="domino-summary-icon opponent" aria-hidden="true" />
            <strong>{displayState.handCounts[opponent]}</strong> {t('dominoOpponentTiles')}
          </span>
        )}
      </div>

      <div className="domino-chain-header">
        <span>{t('dominoChain')}</span>
        <div className="domino-chain-nav" role="group" aria-label={t('dominoChain')}>
          <button type="button" onClick={() => moveViewport('left')} aria-label={t('dominoLeft')}>
            <span aria-hidden="true">←</span>
          </button>
          <button type="button" onClick={() => moveViewport('right')} aria-label={t('dominoRight')}>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>

      <div className="domino-chain-shell" dir="ltr" ref={chainShell}>
        <div className="domino-chain" role="list" aria-label={t('dominoChain')}>
          {selected && selectedSides.includes('left') && openEnds && (
            <button
              type="button"
              className="domino-end-target left"
              onClick={() => chooseSide('left')}
              aria-label={`${t('dominoChooseSide')}: ${t('dominoLeft')} · ${openEnds[0]}`}
            >
              <span aria-hidden="true">←</span>
              <strong>{openEnds[0]}</strong>
            </button>
          )}
          {displayState.chain.length ? (
            displayState.chain.map((placed, index) => {
              const last =
                displayState.lastAction?.type === 'play' &&
                displayState.lastAction.tileId === placed.tileId;
              return (
                <div
                  className={`domino-chain-item ${placed.leftValue === placed.rightValue ? 'double' : ''} ${last ? 'last-placed' : ''}`}
                  key={`${placed.tileId}-${index}`}
                  role="listitem"
                  aria-label={`${t('dominoTile')} ${placed.leftValue}–${placed.rightValue}`}
                >
                  <DominoFace id={placed.tileId} oriented={[placed.leftValue, placed.rightValue]} />
                </div>
              );
            })
          ) : (
            <span className="domino-chain-empty">{t('dominoOpeningWaiting')}</span>
          )}
          {selected && selectedSides.includes('right') && openEnds && (
            <button
              type="button"
              className="domino-end-target right"
              onClick={() => chooseSide('right')}
              aria-label={`${t('dominoChooseSide')}: ${t('dominoRight')} · ${openEnds[1]}`}
            >
              <strong>{openEnds[1]}</strong>
              <span aria-hidden="true">→</span>
            </button>
          )}
        </div>
      </div>

      {selected && selectedSides.length > 1 && (
        <div className="domino-side-choice" role="status">
          <span>{t('dominoChooseSide')}</span>
          <DominoFace id={selected} />
          <button type="button" className="button ghost" onClick={() => setSelected(null)}>
            {t('cancel')}
          </button>
        </div>
      )}

      {handoff ? (
        <div className="domino-handoff">
          <span className="domino-handoff-icon" aria-hidden="true">◫</span>
          <strong>{t('dominoHandoff')}</strong>
          <button className="button primary" onClick={() => setRevealedSeat(state.turn)}>
            {t('dominoShowHand')}
          </button>
        </div>
      ) : (
        <>
          <div className="domino-hand-wrap">
            <div className="domino-hand-heading">
              <strong>{t('dominoYourHand')}</strong>
              <span>{hand.length}</span>
            </div>
            <div className="domino-hand" role="list" aria-label={t('dominoYourHand')}>
              {hand.map((tileId) => {
                const legal = byTile.has(tileId),
                  isSelected = selected === tileId;
                return (
                  <div className="domino-hand-item" role="listitem" key={tileId}>
                    <button
                      type="button"
                      className={`domino-hand-tile ${legal ? 'legal' : ''} ${isSelected ? 'selected' : ''}`}
                      disabled={disabled || !legal}
                      onClick={() => play(tileId)}
                      aria-pressed={isSelected}
                      aria-label={tileLabel(tileId, t, legal)}
                    >
                      <DominoFace id={tileId} />
                      {legal && (
                        <span className="domino-legal-mark" aria-hidden="true">
                          ✓
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="domino-actions">
            {moves.some((move) => move.type === 'draw') && (
              <button
                className="button primary"
                disabled={disabled}
                onClick={() => onMove({ type: 'draw' })}
              >
                {t('dominoDraw')}
              </button>
            )}
            {moves.some((move) => move.type === 'pass') && (
              <button
                className="button secondary"
                disabled={disabled}
                onClick={() => onMove({ type: 'pass' })}
              >
                {t('dominoPass')}
              </button>
            )}
          </div>
          {displayState.openingPending && (
            <p className="domino-rule-note">{t('dominoOpeningHint')}</p>
          )}
        </>
      )}
    </section>
  );
}
