import { useEffect, useMemo, useState } from 'react';
import { legalDominoMoves, projectDominoState } from './rules.ts';
import { dominoTile, type DominoSide, type DominoesMove, type DominoesState } from './state.ts';

interface Props {
  state: DominoesState;
  disabled: boolean;
  onMove: (move: DominoesMove) => void;
  t: (key: string) => string;
  mode?: 'local' | 'ai' | 'online';
}

function DominoFace({ id, oriented }: { id: string; oriented?: [number, number] }) {
  const tile = dominoTile(id),
    values = oriented ?? [tile.a, tile.b];
  return (
    <span className={`domino-tile ${values[0] === values[1] ? 'double' : ''}`} aria-hidden="true">
      <span>{values[0]}</span>
      <i />
      <span>{values[1]}</span>
    </span>
  );
}

export function DominoesBoard({ state, disabled, onMove, t, mode = 'online' }: Props) {
  const [selected, setSelected] = useState<string | null>(null),
    [revealedSeat, setRevealedSeat] = useState<0 | 1 | null>(null);
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
  const handoff = mode === 'local' && state.viewerSeat === undefined && revealedSeat !== state.turn && !state.winner && !state.drawReason;
  const moves = useMemo(() => legalDominoMoves(displayState), [displayState]);
  const playMoves = moves.filter((move): move is Extract<DominoesMove, { type: 'play' }> => move.type === 'play');
  const byTile = new Map<string, DominoSide[]>();
  for (const move of playMoves) byTile.set(move.tileId, [...(byTile.get(move.tileId) ?? []), move.side]);
  const viewer = displayState.viewerSeat ?? displayState.turn,
    hand = viewer === null ? [] : displayState.hands[viewer],
    opponent = viewer === null ? null : viewer === 0 ? 1 : 0,
    selectedSides = selected ? byTile.get(selected) ?? [] : [];

  const play = (tileId: string) => {
    const sides = byTile.get(tileId) ?? [];
    if (disabled || handoff || !sides.length) return;
    if (sides.length === 1) onMove({ type: 'play', tileId, side: sides[0] });
    else setSelected(tileId);
  };

  return (
    <section className="dominoes-game" aria-label={t('dominoes')}>
      <div className="dominoes-summary">
        <span><strong>{displayState.boneyardCount}</strong> {t('dominoBoneyard')}</span>
        {opponent !== null && <span><strong>{displayState.handCounts[opponent]}</strong> {t('dominoOpponentTiles')}</span>}
      </div>

      <div className="domino-chain-shell" dir="ltr" aria-label={t('dominoChain')}>
        <div className="domino-chain">
          {displayState.chain.length ? (
            displayState.chain.map((placed, index) => (
              <div className="domino-chain-item" key={`${placed.tileId}-${index}`} aria-label={`${placed.leftValue}|${placed.rightValue}`}>
                <DominoFace id={placed.tileId} oriented={[placed.leftValue, placed.rightValue]} />
              </div>
            ))
          ) : (
            <span className="domino-chain-empty">{t('dominoOpeningWaiting')}</span>
          )}
        </div>
      </div>

      {handoff ? (
        <div className="domino-handoff">
          <strong>{t('dominoHandoff')}</strong>
          <button className="button primary" onClick={() => setRevealedSeat(state.turn)}>{t('dominoShowHand')}</button>
        </div>
      ) : (
        <>
          {selected && selectedSides.length > 1 && (
            <div className="domino-side-choice" role="group" aria-label={t('dominoChooseSide')}>
              <span>{t('dominoChooseSide')}</span>
              <button disabled={disabled} onClick={() => onMove({ type: 'play', tileId: selected, side: 'left' })}>{t('dominoLeft')}</button>
              <button disabled={disabled} onClick={() => onMove({ type: 'play', tileId: selected, side: 'right' })}>{t('dominoRight')}</button>
              <button onClick={() => setSelected(null)}>{t('cancel')}</button>
            </div>
          )}

          <div className="domino-hand-wrap">
            <div className="domino-hand-heading">
              <strong>{t('dominoYourHand')}</strong>
              <span>{hand.length}</span>
            </div>
            <div className="domino-hand" role="list" aria-label={t('dominoYourHand')}>
              {hand.map((tileId) => {
                const legal = byTile.has(tileId);
                return (
                  <button
                    role="listitem"
                    key={tileId}
                    className={`domino-hand-tile ${legal ? 'legal' : ''} ${selected === tileId ? 'selected' : ''}`}
                    disabled={disabled || !legal}
                    onClick={() => play(tileId)}
                    aria-label={`${t('dominoTile')} ${tileId}${legal ? ` · ${t('dominoPlayable')}` : ''}`}
                  >
                    <DominoFace id={tileId} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="domino-actions">
            {moves.some((move) => move.type === 'draw') && (
              <button className="button primary" disabled={disabled} onClick={() => onMove({ type: 'draw' })}>{t('dominoDraw')}</button>
            )}
            {moves.some((move) => move.type === 'pass') && (
              <button className="button secondary" disabled={disabled} onClick={() => onMove({ type: 'pass' })}>{t('dominoPass')}</button>
            )}
          </div>
          {displayState.openingPending && <p className="domino-rule-note">{t('dominoOpeningHint')}</p>}
        </>
      )}
    </section>
  );
}
