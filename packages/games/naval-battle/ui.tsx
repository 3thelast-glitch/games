import { useEffect, useMemo, useState, type CSSProperties, type KeyboardEvent } from 'react';
import type { Player } from '../../core/src/game.ts';
import {
  NAVAL_ABILITIES,
  NAVAL_BOARD_SIZE,
  NAVAL_SHIPS,
  navalShip,
  type NavalAbilityId,
  type NavalBattleMove,
  type NavalBattleState,
  type NavalCoordinate,
  type NavalOrientation,
  type NavalPlacement,
  type NavalShipId,
  type NavalShot,
} from './state.ts';
import {
  isCompleteNavalFleet,
  isNavalPlacementValid,
  navalCellKey,
  navalPlacementCells,
  navalPlacementInBounds,
  projectNavalState,
} from './rules.ts';

interface Props {
  state: NavalBattleState;
  disabled: boolean;
  onMove: (move: NavalBattleMove) => void;
  t: (key: string) => string;
  mode?: 'local' | 'ai' | 'online';
}

const letters = Array.from({ length: NAVAL_BOARD_SIZE }, (_, index) =>
  String.fromCharCode(65 + index),
);

const coordinateLabel = ({ row, col }: NavalCoordinate) => `${letters[col]}${row + 1}`;

function ShipGlyph({ shipId }: { shipId: NavalShipId }) {
  const paths: Record<NavalShipId, string> = {
    carrier:
      'M5 15 L18 7 L64 5 L80 9 L95 15 L80 21 L64 25 L18 23 Z M31 8 L58 8 L68 12 L33 12 Z',
    battleship:
      'M5 15 L18 7 L68 7 L92 15 L68 23 L18 23 Z M37 9 L62 9 L72 15 L62 21 L37 21 Z',
    cruiser:
      'M7 15 L23 8 L70 9 L92 15 L70 21 L23 22 Z M42 10 L63 10 L69 15 L63 20 L42 20 Z',
    submarine:
      'M6 15 C18 7 78 7 94 15 C78 23 18 23 6 15 Z M44 9 L58 9 L64 15 L58 21 L44 21 Z',
    destroyer:
      'M8 15 L27 9 L74 10 L92 15 L74 20 L27 21 Z M48 10 L62 11 L68 15 L62 19 L48 20 Z',
  };
  return (
    <svg className="naval-ship-glyph" viewBox="0 0 100 30" aria-hidden="true">
      <path d={paths[shipId]} />
      <line x1="18" y1="15" x2="82" y2="15" />
    </svg>
  );
}

function shotForCell(shots: readonly NavalShot[], row: number, col: number) {
  return [...shots].reverse().find((shot) => shot.row === row && shot.col === col && !shot.repaired);
}

function cellsSet(cells: readonly NavalCoordinate[] | undefined) {
  return new Set((cells ?? []).map(navalCellKey));
}

function ShipOverlay({
  placement,
  preview,
}: {
  placement: NavalPlacement;
  preview?: 'valid' | 'invalid';
}) {
  const length = navalShip(placement.shipId).length;
  const style = {
    '--ship-row': placement.row,
    '--ship-col': placement.col,
    '--ship-length': length,
  } as CSSProperties;
  return (
    <div
      className={`naval-ship-overlay ${placement.orientation} ${preview ? `preview ${preview}` : ''}`}
      style={style}
      aria-hidden="true"
    >
      <ShipGlyph shipId={placement.shipId} />
    </div>
  );
}

interface BoardProps {
  label: string;
  viewer: Player;
  ownFleet: NavalPlacement[];
  shots: NavalShot[];
  type: 'own' | 'target' | 'placement';
  interactive: boolean;
  selected?: NavalCoordinate | null;
  selectedMany?: NavalCoordinate[];
  preview?: NavalPlacement | null;
  previewValid?: boolean;
  lastShot?: { player: Player; row: number; col: number } | null;
  onSelect?: (cell: NavalCoordinate) => void;
  t: (key: string) => string;
}

function NavalBoard({
  label,
  viewer,
  ownFleet,
  shots,
  type,
  interactive,
  selected,
  selectedMany = [],
  preview,
  previewValid,
  lastShot,
  onSelect,
  t,
}: BoardProps) {
  const [focusIndex, setFocusIndex] = useState(0);
  const relevantShots = shots.filter((shot) =>
    type === 'target' ? shot.shooter === viewer : shot.shooter !== viewer,
  );
  const sunk = new Map<string, NavalShipId>();
  for (const shot of relevantShots)
    if (shot.sunkShipId)
      for (const cell of shot.sunkCells ?? []) sunk.set(navalCellKey(cell), shot.sunkShipId);

  const previewKeys = cellsSet(preview ? navalPlacementCells(preview) : undefined);
  const ownShipByCell = new Map<string, NavalShipId>();
  for (const placement of ownFleet)
    for (const cell of navalPlacementCells(placement))
      ownShipByCell.set(navalCellKey(cell), placement.shipId);

  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const row = Math.floor(index / NAVAL_BOARD_SIZE);
    const col = index % NAVAL_BOARD_SIZE;
    let next = index;
    if (event.key === 'ArrowLeft') next = row * NAVAL_BOARD_SIZE + Math.max(0, col - 1);
    else if (event.key === 'ArrowRight')
      next = row * NAVAL_BOARD_SIZE + Math.min(NAVAL_BOARD_SIZE - 1, col + 1);
    else if (event.key === 'ArrowUp') next = Math.max(0, row - 1) * NAVAL_BOARD_SIZE + col;
    else if (event.key === 'ArrowDown')
      next = Math.min(NAVAL_BOARD_SIZE - 1, row + 1) * NAVAL_BOARD_SIZE + col;
    else return;
    event.preventDefault();
    setFocusIndex(next);
    const board = event.currentTarget.closest('.naval-grid');
    (board?.querySelector(`[data-cell-index="${next}"]`) as HTMLButtonElement | null)?.focus();
  };

  return (
    <div className={`naval-board-frame ${type}`} dir="ltr">
      <div className="naval-column-labels" aria-hidden="true">
        {letters.map((letter) => (
          <span key={letter}>{letter}</span>
        ))}
      </div>
      <div className="naval-row-labels" aria-hidden="true">
        {Array.from({ length: NAVAL_BOARD_SIZE }, (_, index) => (
          <span key={index}>{index + 1}</span>
        ))}
      </div>
      <div className="naval-grid" role="grid" aria-label={label}>
        {Array.from({ length: NAVAL_BOARD_SIZE * NAVAL_BOARD_SIZE }, (_, index) => {
          const row = Math.floor(index / NAVAL_BOARD_SIZE);
          const col = index % NAVAL_BOARD_SIZE;
          const key = navalCellKey({ row, col });
          const shot = shotForCell(relevantShots, row, col);
          const sunkShip = sunk.get(key);
          const isSelected =
            (selected?.row === row && selected?.col === col) ||
            selectedMany.some((cell) => cell.row === row && cell.col === col);
          const isPreview = previewKeys.has(key);
          const ownShip = ownShipByCell.get(key);
          const isLast =
            !!lastShot &&
            lastShot.row === row &&
            lastShot.col === col &&
            (type === 'target' ? lastShot.player === viewer : lastShot.player !== viewer);
          const classes = [
            'naval-cell',
            shot?.outcome ?? 'unknown',
            sunkShip ? 'sunk' : '',
            isSelected ? 'selected' : '',
            isLast ? 'last-shot' : '',
            isPreview ? (previewValid ? 'preview-valid' : 'preview-invalid') : '',
            type !== 'target' && ownShip ? 'occupied' : '',
          ]
            .filter(Boolean)
            .join(' ');

          let status = t('navalUnknown');
          if (shot?.outcome === 'miss') status = t('navalMiss');
          if (shot?.outcome === 'hit') status = t('navalHit');
          if (sunkShip) status = `${t('navalSunk')}: ${t(`navalShip.${sunkShip}`)}`;
          if (type !== 'target' && ownShip)
            status = `${status}; ${t(`navalShip.${ownShip}`)}`;
          if (isSelected) status = `${status}; ${t('navalSelectedTarget')}`;
          if (isLast) status = `${status}; ${t('navalLastShot')}`;

          return (
            <button
              key={key}
              type="button"
              role="gridcell"
              data-cell-index={index}
              className={classes}
              tabIndex={focusIndex === index ? 0 : -1}
              disabled={!interactive || (type === 'target' && !!shot)}
              aria-label={`${coordinateLabel({ row, col })}: ${status}`}
              aria-pressed={isSelected || undefined}
              onFocus={() => setFocusIndex(index)}
              onKeyDown={(event) => moveFocus(event, index)}
              onClick={() => onSelect?.({ row, col })}
            >
              {shot?.outcome === 'miss' && <span className="naval-miss-mark" aria-hidden="true" />}
              {(shot?.outcome === 'hit' || shot?.outcome === 'sunk') && (
                <span className="naval-hit-mark" aria-hidden="true">
                  ×
                </span>
              )}
              {isLast && <span className="naval-last-reticle" aria-hidden="true" />}
            </button>
          );
        })}
        {type !== 'target' &&
          ownFleet.map((placement) => (
            <ShipOverlay key={placement.shipId} placement={placement} />
          ))}
        {type === 'placement' && preview && (
          <ShipOverlay
            placement={preview}
            preview={previewValid ? 'valid' : 'invalid'}
          />
        )}
      </div>
    </div>
  );
}

function FleetTray({
  fleet,
  selected,
  onSelect,
  t,
}: {
  fleet: NavalPlacement[];
  selected: NavalShipId;
  onSelect: (shipId: NavalShipId) => void;
  t: (key: string) => string;
}) {
  return (
    <div className="naval-fleet-tray" role="list" aria-label={t('navalFleet')}>
      {NAVAL_SHIPS.map((ship) => {
        const placed = fleet.some((placement) => placement.shipId === ship.id);
        return (
          <div className="naval-fleet-item" role="listitem" key={ship.id}>
            <button
              type="button"
              className={selected === ship.id ? 'selected' : ''}
              aria-pressed={selected === ship.id}
              onClick={() => onSelect(ship.id)}
            >
              <span className="naval-fleet-glyph">
                <ShipGlyph shipId={ship.id} />
              </span>
              <span>
                <strong>{t(`navalShip.${ship.id}`)}</strong>
                <small>
                  {t('navalLength')} {ship.length}
                </small>
              </span>
              <span className={`naval-placement-check ${placed ? 'placed' : ''}`}>
                {placed ? '✓' : '○'}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}


const abilitySymbols: Record<NavalAbilityId, string> = {
  sonarPulse: '◉',
  twinSalvo: 'Ⅱ',
  hunterProtocol: '⌖',
  emergencyRepair: '✚',
  signalJammer: '≈',
  silentReposition: '↝',
};

function AbilityCards({
  abilities,
  selected = [],
  used = [],
  interactive,
  onToggle,
  t,
}: {
  abilities: readonly NavalAbilityId[];
  selected?: readonly NavalAbilityId[];
  used?: readonly NavalAbilityId[];
  interactive: boolean;
  onToggle?: (ability: NavalAbilityId) => void;
  t: (key: string) => string;
}) {
  return (
    <div className="naval-ability-grid" role="list">
      {abilities.map((ability) => {
        const isSelected = selected.includes(ability);
        const isUsed = used.includes(ability);
        return (
          <div className="naval-ability-card-wrap" role="listitem" key={ability}>
            <button
              type="button"
              className={`naval-ability-card ${isSelected ? 'selected' : ''} ${isUsed ? 'used' : ''}`}
              data-ability={ability}
              aria-pressed={interactive ? isSelected : undefined}
              disabled={!interactive || isUsed}
              onClick={() => onToggle?.(ability)}
            >
              <span className="naval-ability-symbol" aria-hidden="true">{abilitySymbols[ability]}</span>
              <span className="naval-ability-copy">
                <strong>{t(`navalAbility.${ability}`)}</strong>
                <small>{t(`navalAbilityDesc.${ability}`)}</small>
              </span>
              <span className="naval-ability-state">
                {isUsed ? t('navalAbilityUsed') : isSelected ? '✓' : ''}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

function adjacent(a: NavalCoordinate, b: NavalCoordinate) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

export function NavalBattleBoard({ state, disabled, onMove, t, mode = 'online' }: Props) {
  const [revealedSeat, setRevealedSeat] = useState<Player | null>(null);
  const [selectedShip, setSelectedShip] = useState<NavalShipId>('carrier');
  const [orientation, setOrientation] = useState<NavalOrientation>('horizontal');
  const [previewCell, setPreviewCell] = useState<NavalCoordinate | null>(null);
  const [target, setTarget] = useState<NavalCoordinate | null>(null);
  const [ownTarget, setOwnTarget] = useState<NavalCoordinate | null>(null);
  const [abilityTargets, setAbilityTargets] = useState<NavalCoordinate[]>([]);
  const [selectedAbilities, setSelectedAbilities] = useState<NavalAbilityId[]>([]);
  const [activeAbility, setActiveAbility] = useState<NavalAbilityId | null>(null);
  const [repositionShip, setRepositionShip] = useState<NavalShipId>('destroyer');

  useEffect(() => {
    if (mode === 'local') setRevealedSeat(null);
    setTarget(null);
    setOwnTarget(null);
    setAbilityTargets([]);
    setActiveAbility(null);
    setPreviewCell(null);
  }, [mode, state.turn, state.phase]);

  const displayState = useMemo(() => {
    if (state.viewerSeat !== undefined) return state;
    if (mode === 'ai') return projectNavalState(state, 0);
    if (mode === 'local') return projectNavalState(state, revealedSeat);
    return state;
  }, [mode, revealedSeat, state]);

  const viewer =
    displayState.viewerSeat !== undefined && displayState.viewerSeat !== null
      ? displayState.viewerSeat
      : mode === 'ai'
        ? 0
        : state.turn;
  const rival = (viewer === 0 ? 1 : 0) as Player;
  const ownFleet = displayState.fleets[viewer];
  const ownLoadout = displayState.loadouts[viewer];
  const knownEnemyAbilities = displayState.loadouts[rival];
  const usedAbilities = displayState.usedAbilities[viewer];
  const complete = isCompleteNavalFleet(ownFleet);
  const selectedPlacement = ownFleet.find((placement) => placement.shipId === selectedShip);
  const canAct = !disabled && displayState.turn === viewer;

  useEffect(() => {
    if (displayState.phase !== 'placement') return;
    const nextMissing = NAVAL_SHIPS.find(
      (ship) => !ownFleet.some((placement) => placement.shipId === ship.id),
    );
    if (nextMissing && ownFleet.some((placement) => placement.shipId === selectedShip))
      setSelectedShip(nextMissing.id);
  }, [displayState.ply, displayState.phase, ownFleet, selectedShip]);

  useEffect(() => {
    const placement = ownFleet.find((candidate) => candidate.shipId === selectedShip);
    if (placement) setOrientation(placement.orientation);
  }, [selectedShip, ownFleet]);

  useEffect(() => {
    if (displayState.hunterWindow?.player === viewer) {
      setActiveAbility('hunterProtocol');
      setTarget(null);
      setAbilityTargets([]);
    }
  }, [displayState.hunterWindow, viewer]);

  const preview: NavalPlacement | null = previewCell
    ? { shipId: selectedShip, row: previewCell.row, col: previewCell.col, orientation }
    : selectedPlacement
      ? { ...selectedPlacement, orientation }
      : null;
  const previewInBounds = preview ? navalPlacementInBounds(preview) : false;
  const previewValid = preview ? isNavalPlacementValid(ownFleet, preview) : false;

  const lastFire =
    displayState.lastAction?.type === 'fire'
      ? {
          player: displayState.lastAction.player,
          row: displayState.lastAction.row,
          col: displayState.lastAction.col,
        }
      : null;

  if (mode === 'local' && revealedSeat !== state.turn) {
    return (
      <section className="naval-game naval-handoff">
        <div className="naval-sonar-mark" aria-hidden="true"><span /></div>
        <span className="eyebrow">{t('navalPrivacyHandoff')}</span>
        <h2>{t(state.turn === 0 ? 'player1' : 'player2')}</h2>
        <p>{t('navalHandoffDesc')}</p>
        <button
          type="button"
          className="button primary"
          onClick={() => setRevealedSeat(state.turn as Player)}
        >
          {t('navalRevealBoard')}
        </button>
      </section>
    );
  }

  if (displayState.phase === 'loadout') {
    const locked = ownLoadout.length === 3 || displayState.turn !== viewer;
    return (
      <section className="naval-game phase-loadout">
        <header className="naval-phase-header">
          <div>
            <span className="eyebrow">{t('navalLoadoutPhase')}</span>
            <h2>{t(locked ? 'navalLoadoutLocked' : 'navalChooseAbilities')}</h2>
            <p>{t(locked ? 'navalWaitingLoadout' : 'navalLoadoutHint')}</p>
          </div>
          <div className="naval-loadout-counter" aria-live="polite">
            <strong>{locked ? 3 : selectedAbilities.length}</strong><span>/ 3</span>
          </div>
        </header>
        <div className="naval-loadout-panel">
          <AbilityCards
            abilities={NAVAL_ABILITIES}
            selected={locked ? ownLoadout : selectedAbilities}
            interactive={canAct && !locked}
            onToggle={(ability) =>
              setSelectedAbilities((current) =>
                current.includes(ability)
                  ? current.filter((item) => item !== ability)
                  : current.length < 3
                    ? [...current, ability]
                    : current,
              )
            }
            t={t}
          />
          {!locked && (
            <button
              type="button"
              className="button primary naval-confirm-loadout"
              disabled={!canAct || selectedAbilities.length !== 3}
              onClick={() =>
                onMove({
                  type: 'selectAbilities',
                  abilities: selectedAbilities as [NavalAbilityId, NavalAbilityId, NavalAbilityId],
                })
              }
            >
              {t('navalConfirmLoadout')}
            </button>
          )}
        </div>
      </section>
    );
  }

  const waitingPlacement =
    displayState.phase === 'placement' && (displayState.ready[viewer] || displayState.turn !== viewer);

  const activateAbility = (ability: NavalAbilityId) => {
    if (!canAct || usedAbilities.includes(ability) || ability === 'hunterProtocol') return;
    setActiveAbility((current) => (current === ability ? null : ability));
    setTarget(null);
    setOwnTarget(null);
    setAbilityTargets([]);
  };

  const selectTarget = (cell: NavalCoordinate) => {
    if (activeAbility === 'hunterProtocol') {
      const origin = displayState.hunterWindow?.origin;
      if (origin && adjacent(origin, cell)) setTarget(cell);
      return;
    }
    if (activeAbility === 'twinSalvo') {
      setAbilityTargets((current) => {
        if (current.some((item) => navalCellKey(item) === navalCellKey(cell)))
          return current.filter((item) => navalCellKey(item) !== navalCellKey(cell));
        return current.length >= 2 ? [current[1], cell] : [...current, cell];
      });
      return;
    }
    setTarget(cell);
  };

  const finishAbility = () => {
    setActiveAbility(null);
    setTarget(null);
    setOwnTarget(null);
    setAbilityTargets([]);
  };

  const latestScan = [...displayState.sonarScans].reverse().find((scan) => scan.player === viewer);

  return (
    <section className={`naval-game phase-${displayState.phase}`}>
      <header className="naval-phase-header">
        <div>
          <span className="eyebrow">
            {t(displayState.phase === 'placement' ? 'navalPlacementPhase' : 'navalBattlePhase')}
          </span>
          <h2>
            {t(
              displayState.phase === 'placement'
                ? waitingPlacement
                  ? 'navalFleetReady'
                  : 'navalDeployFleet'
                : displayState.hunterWindow?.player === viewer
                  ? 'navalHunterDecision'
                  : canAct
                    ? 'yourTurn'
                    : mode === 'ai' && displayState.turn === 1
                      ? 'thinking'
                      : 'theirTurn',
            )}
          </h2>
          <p>
            {t(
              displayState.phase === 'placement'
                ? waitingPlacement
                  ? 'navalWaitingPlacement'
                  : 'navalPlacementHint'
                : displayState.hunterWindow?.player === viewer
                  ? 'navalHunterHint'
                  : 'navalBattleHint',
            )}
          </p>
        </div>
        <div className="naval-fleet-status" aria-label={t('navalShipsRemaining')}>
          <span>{t('you')} <strong>{displayState.remainingShips[viewer]}</strong></span>
          <span>{t('navalOpponent')} <strong>{displayState.remainingShips[rival]}</strong></span>
        </div>
      </header>

      {displayState.phase === 'placement' ? (
        <div className="naval-placement-layout">
          <aside className="naval-placement-panel">
            <div className="naval-selected-loadout compact">
              <span className="naval-section-label">{t('navalYourAbilities')}</span>
              <AbilityCards abilities={ownLoadout} used={usedAbilities} interactive={false} t={t} />
            </div>
            <FleetTray
              fleet={ownFleet}
              selected={selectedShip}
              onSelect={(shipId) => {
                setSelectedShip(shipId);
                const placement = ownFleet.find((candidate) => candidate.shipId === shipId);
                setPreviewCell(placement ? { row: placement.row, col: placement.col } : null);
              }}
              t={t}
            />
            {!waitingPlacement && (
              <div className="naval-placement-actions">
                <button
                  type="button"
                  className="button secondary naval-rotate"
                  onClick={() =>
                    setOrientation((value) => (value === 'horizontal' ? 'vertical' : 'horizontal'))
                  }
                  disabled={!canAct}
                >
                  <span aria-hidden="true">↻</span>
                  {t('navalRotate')} · {t(`navalOrientation.${orientation}`)}
                </button>
                <div
                  className={`naval-preview-status ${preview ? (previewValid ? 'valid' : 'invalid') : ''}`}
                  role="status"
                >
                  {preview
                    ? t(
                        previewInBounds
                          ? previewValid
                            ? 'navalPlacementValid'
                            : 'navalPlacementOverlap'
                          : 'navalPlacementOutOfBounds',
                      )
                    : t('navalSelectPlacement')}
                </div>
                <button
                  type="button"
                  className="button primary"
                  disabled={!canAct || !preview || !previewValid}
                  onClick={() => {
                    if (!preview || !previewValid) return;
                    onMove({ type: 'place', ...preview });
                    setPreviewCell(null);
                  }}
                >
                  {t('navalPlaceShip')}
                </button>
                <button
                  type="button"
                  className="button ghost"
                  disabled={!canAct || !complete}
                  onClick={() => onMove({ type: 'ready' })}
                >
                  {t('navalConfirmFleet')}
                </button>
              </div>
            )}
          </aside>

          <div className="naval-board-card primary">
            <div className="naval-board-title">
              <span>{t('navalOwnFleet')}</span>
              <strong>{ownFleet.length}/{NAVAL_SHIPS.length}</strong>
            </div>
            <NavalBoard
              label={t('navalPlacementBoard')}
              viewer={viewer}
              ownFleet={ownFleet}
              shots={displayState.shots}
              type="placement"
              interactive={canAct && !waitingPlacement}
              preview={previewCell ? preview : null}
              previewValid={previewValid}
              lastShot={lastFire}
              onSelect={(cell) => setPreviewCell(cell)}
              t={t}
            />
          </div>
        </div>
      ) : (
        <>
          <div className="naval-tactical-strip">
            <div className="naval-tactical-heading">
              <div>
                <span className="naval-section-label">{t('navalTacticalAbilities')}</span>
                <small>{t('navalAbilityOnce')}</small>
              </div>
              {knownEnemyAbilities.length > 0 && (
                <div className="naval-enemy-reveals">
                  <span>{t('navalEnemyRevealed')}</span>
                  {knownEnemyAbilities.map((ability) => (
                    <b key={ability}>{abilitySymbols[ability]} {t(`navalAbility.${ability}`)}</b>
                  ))}
                </div>
              )}
            </div>
            <AbilityCards
              abilities={ownLoadout}
              selected={activeAbility ? [activeAbility] : []}
              used={usedAbilities}
              interactive={canAct && !displayState.hunterWindow}
              onToggle={activateAbility}
              t={t}
            />
            {latestScan && (
              <div className={`naval-sonar-result ${latestScan.blocked ? 'blocked' : ''}`} role="status">
                <strong>{t(latestScan.blocked ? 'navalSonarBlocked' : 'navalSonarResult')}</strong>
                <span>
                  {latestScan.blocked
                    ? t('navalSonarBlockedDesc')
                    : `${coordinateLabel(latestScan)} · ${latestScan.count} ${t('navalDetectedCells')}`}
                </span>
              </div>
            )}
          </div>

          <div className="naval-battle-layout">
            <div className="naval-board-card target-board-card">
              <div className="naval-board-title">
                <span>{t('navalTargetGrid')}</span>
                <strong>
                  {activeAbility === 'twinSalvo'
                    ? `${abilityTargets.length}/2`
                    : target
                      ? coordinateLabel(target)
                      : t('navalSelectTarget')}
                </strong>
              </div>
              <NavalBoard
                label={t('navalTargetGrid')}
                viewer={viewer}
                ownFleet={ownFleet}
                shots={displayState.shots}
                type="target"
                interactive={canAct && !['emergencyRepair', 'signalJammer', 'silentReposition'].includes(activeAbility ?? '')}
                selected={target}
                selectedMany={abilityTargets}
                lastShot={lastFire}
                onSelect={selectTarget}
                t={t}
              />
              <div className="naval-fire-controls">
                <span className="naval-target-readout" aria-live="polite">
                  {activeAbility
                    ? t(`navalAbilityAction.${activeAbility}`)
                    : target
                      ? `${t('navalTarget')}: ${coordinateLabel(target)}`
                      : t('navalSelectTarget')}
                </span>

                {displayState.hunterWindow?.player === viewer ? (
                  <div className="naval-hunter-actions">
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => {
                        onMove({ type: 'skipHunter' });
                        finishAbility();
                      }}
                    >
                      {t('navalSkipHunter')}
                    </button>
                    <button
                      type="button"
                      className="button primary"
                      disabled={!target}
                      onClick={() => {
                        if (!target) return;
                        onMove({ type: 'useAbility', ability: 'hunterProtocol', ...target });
                        finishAbility();
                      }}
                    >
                      {t('navalUseHunter')}
                    </button>
                  </div>
                ) : activeAbility === 'sonarPulse' ? (
                  <button
                    type="button"
                    className="button primary"
                    disabled={!target || target.row === 0 || target.row === 9 || target.col === 0 || target.col === 9}
                    onClick={() => {
                      if (!target) return;
                      onMove({ type: 'useAbility', ability: 'sonarPulse', ...target });
                      finishAbility();
                    }}
                  >
                    {t('navalActivateSonar')}
                  </button>
                ) : activeAbility === 'twinSalvo' ? (
                  <button
                    type="button"
                    className="button primary"
                    disabled={abilityTargets.length !== 2}
                    onClick={() => {
                      if (abilityTargets.length !== 2) return;
                      onMove({
                        type: 'useAbility',
                        ability: 'twinSalvo',
                        targets: abilityTargets as [NavalCoordinate, NavalCoordinate],
                      });
                      finishAbility();
                    }}
                  >
                    {t('navalFireTwin')}
                  </button>
                ) : !activeAbility ? (
                  <button
                    type="button"
                    className="button primary naval-fire-button"
                    disabled={!canAct || !target}
                    onClick={() => {
                      if (!target) return;
                      onMove({ type: 'fire', row: target.row, col: target.col });
                      setTarget(null);
                    }}
                  >
                    <span className="naval-reticle-icon" aria-hidden="true" />
                    {t('navalFire')}
                  </button>
                ) : null}
              </div>
            </div>

            <aside className="naval-own-board-card">
              <div className="naval-board-title">
                <span>{t('navalOwnFleet')}</span>
                <strong>{displayState.remainingShips[viewer]}/{NAVAL_SHIPS.length}</strong>
              </div>

              {activeAbility === 'silentReposition' && (
                <div className="naval-reposition-controls">
                  <select
                    aria-label={t('navalRepositionShip')}
                    value={repositionShip}
                    onChange={(event) => setRepositionShip(event.target.value as NavalShipId)}
                  >
                    {NAVAL_SHIPS.map((ship) => (
                      <option key={ship.id} value={ship.id}>{t(`navalShip.${ship.id}`)}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() =>
                      setOrientation((value) => (value === 'horizontal' ? 'vertical' : 'horizontal'))
                    }
                  >
                    ↻ {t(`navalOrientation.${orientation}`)}
                  </button>
                </div>
              )}

              <NavalBoard
                label={t('navalOwnFleet')}
                viewer={viewer}
                ownFleet={ownFleet}
                shots={displayState.shots}
                type="own"
                interactive={canAct && ['emergencyRepair', 'signalJammer', 'silentReposition'].includes(activeAbility ?? '')}
                selected={ownTarget}
                lastShot={lastFire}
                onSelect={setOwnTarget}
                t={t}
              />

              {activeAbility === 'emergencyRepair' && (
                <button
                  type="button"
                  className="button primary naval-own-ability-button"
                  disabled={!ownTarget}
                  onClick={() => {
                    if (!ownTarget) return;
                    onMove({ type: 'useAbility', ability: 'emergencyRepair', ...ownTarget });
                    finishAbility();
                  }}
                >
                  {t('navalRepairCell')}
                </button>
              )}

              {activeAbility === 'signalJammer' && (
                <button
                  type="button"
                  className="button primary naval-own-ability-button"
                  disabled={!ownTarget || ownTarget.row === 0 || ownTarget.row === 9 || ownTarget.col === 0 || ownTarget.col === 9}
                  onClick={() => {
                    if (!ownTarget) return;
                    onMove({ type: 'useAbility', ability: 'signalJammer', ...ownTarget });
                    finishAbility();
                  }}
                >
                  {t('navalDeployJammer')}
                </button>
              )}

              {activeAbility === 'silentReposition' && (
                <button
                  type="button"
                  className="button primary naval-own-ability-button"
                  disabled={!ownTarget}
                  onClick={() => {
                    if (!ownTarget) return;
                    onMove({
                      type: 'useAbility',
                      ability: 'silentReposition',
                      shipId: repositionShip,
                      row: ownTarget.row,
                      col: ownTarget.col,
                      orientation,
                    });
                    finishAbility();
                  }}
                >
                  {t('navalReposition')}
                </button>
              )}

              <div className="naval-legend" aria-label={t('navalLegend')}>
                <span><i className="legend-miss" />{t('navalMiss')}</span>
                <span><i className="legend-hit" />{t('navalHit')}</span>
                <span><i className="legend-sunk" />{t('navalSunk')}</span>
              </div>
            </aside>
          </div>
        </>
      )}
    </section>
  );
}
