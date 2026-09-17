import { useEffect, useMemo, useState } from 'react';
import { legalDominoMoves } from './rules.ts';
import { dominoTile, type DominoSide, type DominoesMove, type DominoesState } from './state.ts';

interface Props {
  state: DominoesState;
  disabled: boolean;
  onMove: (move: DominoesMove) => void;
  t: (key: string) => string;
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

export function DominoesBoard({ state, disabled, onMove, t }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => setSelected(null), [state.ply, state.turn]);
  const moves = useMemo(() => legalDominoMoves(state), [state]);
  const playMoves = moves.filter((move): move is Extract<DominoesMove, { type: 'play' }> => move.type === 'play');
  const byTile = new Map<string, DominoSide[]>();
  for (const move of playMoves) byTile.set(move.tileId, [...(byTile.get(move.tileId) ?? []), move.side]);
  const viewer = state.viewerSeat ?? state.turn,
    hand = viewer === null ? [] : state.hands[viewer],
    opponent = viewer === null ? null : viewer === 0 ? 1 : 0,
    selectedSides = selected ? byTile.get(selected) ?? [] : [];

  const play = (tileId: string) => {
    const sides = byTile.get(tileId) ?? [];
    if (disabled || !sides.length) return;
    if (sides.length === 1) onMove({ type: 'play', tileId, side: sides[0] });
    else setSelected(tileId);
  };

  return (
    <section className="dominoes-game" aria-label={t('dominoes')}>
      <div className="dominoes-summary">
        <span><strong>{state.boneyardCount}</strong> {t('dominoBoneyard')}</span>
        {opponent !== null && <span><strong>{state.handCounts[opponent]}</strong> {t('dominoOpponentTiles')}</span>}
      </div>

      <div className="domino-chain-shell" dir="ltr" aria-label={t('dominoChain')}>
        <div className="domino-chain">
          {state.chain.length ? (
            state.chain.map((placed, index) => (
              <div className="domino-chain-item" key={`${placed.tileId}-${index}`} aria-label={`${placed.leftValue}|${placed.rightValue}`}>
                <DominoFace id={placed.tileId} oriented={[placed.leftValue, placed.rightValue]} />
              </div>
            ))
          ) : (
            <span className="domino-chain-empty">{t('dominoOpeningWaiting')}</span>
          )}
        </div>
      </div>

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
      {state.openingPending && <p className="domino-rule-note">{t('dominoOpeningHint')}</p>}
    </section>
  );
}
