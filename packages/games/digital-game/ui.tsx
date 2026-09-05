import { useEffect, useMemo, useState } from 'react';
import { validateDigital, validateMeld, validateTable } from './rules.ts';
import { nextPlayer, type DigitalGameMove, type DigitalGameState, type DigitalMeld } from './state.ts';

export interface DigitalGameBoardProps {
  state: DigitalGameState;
  disabled: boolean;
  onMove: (move: DigitalGameMove) => void;
  t: (key: string) => string;
}

const cloneTable = (table: DigitalMeld[]) =>
  table.map((meld) => ({ id: meld.id, type: meld.type, tiles: [...meld.tiles] }));

function tableFingerprint(table: DigitalMeld[]) {
  return JSON.stringify(table.map((meld) => ({ id: meld.id, tiles: meld.tiles })));
}

export function DigitalGameBoard({ state, disabled, onMove, t }: DigitalGameBoardProps) {
  const currentRackVisible = state.racks[state.turn].every((id) => !!state.tiles[id]);
  const visibleSeat = currentRackVisible ? state.turn : nextPlayer(state.turn);
  const canEdit = !disabled && visibleSeat === state.turn;
  const [workingTable, setWorkingTable] = useState<DigitalMeld[]>(() => cloneTable(state.table));
  const [workingRack, setWorkingRack] = useState<string[]>(() => [...state.racks[visibleSeat]]);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    const rackVisible = state.racks[state.turn].every((id) => !!state.tiles[id]);
    const seat = rackVisible ? state.turn : nextPlayer(state.turn);
    setWorkingTable(cloneTable(state.table));
    setWorkingRack([...state.racks[seat]]);
    setSelected([]);
  }, [state.ply, state.turn, state.racks, state.table]);

  const startRack = useMemo(
    () => new Set(state.racks[visibleSeat].filter((id) => !!state.tiles[id])),
    [state.ply, visibleSeat, state.racks, state.tiles],
  );
  const oldTableIds = useMemo(
    () => new Set(state.table.flatMap((meld) => meld.tiles)),
    [state.ply, state.table],
  );
  const move: DigitalGameMove = useMemo(
    () => ({
      type: 'commit',
      table: workingTable.map((meld) => ({ id: meld.id, tiles: meld.tiles })),
    }),
    [workingTable],
  );
  const validation = useMemo(
    () => (canEdit ? validateDigital(state, move) : ({ ok: false, code: 'not-your-turn' } as const)),
    [canEdit, move, state],
  );
  const tableValidation = useMemo(
    () => validateTable(state, workingTable),
    [state.tiles, workingTable],
  );
  const changed = tableFingerprint(workingTable) !== tableFingerprint(state.table);

  const initialScore = useMemo(() => {
    if (state.hasCompletedInitialMeld[visibleSeat]) return null;
    let score = 0;
    for (const meld of workingTable) {
      if (meld.tiles.some((id) => oldTableIds.has(id))) continue;
      const tiles = meld.tiles.map((id) => state.tiles[id]).filter(Boolean);
      const result = validateMeld(tiles);
      if (result.ok) score += result.score;
    }
    return score;
  }, [workingTable, visibleSeat, state.hasCompletedInitialMeld, state.tiles, oldTableIds]);

  const toggle = (id: string) => {
    if (!canEdit) return;
    if (oldTableIds.has(id) && !state.hasCompletedInitialMeld[visibleSeat]) return;
    setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  };

  const detach = (ids: string[]) => {
    const set = new Set(ids);
    setWorkingRack((rack) => rack.filter((id) => !set.has(id)));
    setWorkingTable((table) =>
      table
        .map((meld) => ({ ...meld, tiles: meld.tiles.filter((id) => !set.has(id)) }))
        .filter((meld) => meld.tiles.length),
    );
  };

  const newMeld = () => {
    if (!selected.length) return;
    detach(selected);
    const id = `draft-${state.ply}-${Date.now()}-${workingTable.length}`;
    setWorkingTable((table) => [...table, { id, type: 'group', tiles: [...selected] }]);
    setSelected([]);
  };

  const addToMeld = (meldId: string) => {
    if (!selected.length) return;
    const ids = [...selected];
    detach(ids);
    setWorkingTable((table) =>
      table.map((meld) => (meld.id === meldId ? { ...meld, tiles: [...meld.tiles, ...ids] } : meld)),
    );
    setSelected([]);
  };

  const returnToRack = () => {
    if (!selected.length || selected.some((id) => !startRack.has(id))) return;
    const ids = [...selected];
    const set = new Set(ids);
    setWorkingTable((table) =>
      table
        .map((meld) => ({ ...meld, tiles: meld.tiles.filter((id) => !set.has(id)) }))
        .filter((meld) => meld.tiles.length),
    );
    setWorkingRack((rack) => [...rack, ...ids.filter((id) => !rack.includes(id))]);
    setSelected([]);
  };

  const shiftSelected = (offset: -1 | 1) => {
    if (selected.length !== 1) return;
    const id = selected[0];
    setWorkingTable((table) =>
      table.map((meld) => {
        const index = meld.tiles.indexOf(id);
        if (index < 0) return meld;
        const next = index + offset;
        if (next < 0 || next >= meld.tiles.length) return meld;
        const tiles = [...meld.tiles];
        [tiles[index], tiles[next]] = [tiles[next], tiles[index]];
        return { ...meld, tiles };
      }),
    );
  };

  const sortRack = (mode: 'number' | 'color') => {
    const colors = ['red', 'blue', 'orange', 'black'];
    setWorkingRack((rack) =>
      [...rack].sort((a, b) => {
        const left = state.tiles[a], right = state.tiles[b];
        if (!left || !right) return 0;
        if (left.isJoker !== right.isJoker) return left.isJoker ? 1 : -1;
        if (mode === 'number') return (left.value ?? 99) - (right.value ?? 99) || colors.indexOf(left.color ?? '') - colors.indexOf(right.color ?? '');
        return colors.indexOf(left.color ?? '') - colors.indexOf(right.color ?? '') || (left.value ?? 99) - (right.value ?? 99);
      }),
    );
  };

  const reset = () => {
    setWorkingTable(cloneTable(state.table));
    setWorkingRack([...state.racks[visibleSeat]]);
    setSelected([]);
  };

  const renderTile = (id: string, location: 'rack' | 'table') => {
    const tile = state.tiles[id];
    if (!tile) return null;
    const active = selected.includes(id);
    return (
      <button
        key={id}
        className={`digital-tile ${tile.isJoker ? 'joker' : tile.color ?? ''} ${active ? 'selected' : ''}`}
        onClick={() => toggle(id)}
        disabled={!canEdit}
        aria-pressed={active}
        aria-label={tile.isJoker ? t('digitalJoker') : `${tile.value} ${t(`digitalColor.${tile.color}`)}`}
        data-location={location}
      >
        <span>{tile.isJoker ? '✦' : tile.value}</span>
        <small>{tile.isJoker ? t('digitalJoker') : tile.color?.slice(0, 1).toUpperCase()}</small>
      </button>
    );
  };

  return (
    <div className="digital-game" dir={document.documentElement.dir || 'ltr'}>
      <div className="digital-status-row">
        <span>{t('digitalPool')}: <b>{state.drawPool.length}</b></span>
        <span>{t('digitalRack')}: <b>{state.rackCounts[visibleSeat]}</b></span>
        {initialScore !== null && (
          <span className={initialScore >= 30 ? 'ready' : ''}>
            {t('digitalInitialMeld')}: <b>{initialScore}/30</b>
          </span>
        )}
      </div>

      <div className="digital-table" aria-label={t('digitalTable')}>
        {!workingTable.length && <p className="digital-empty">{t('digitalEmptyTable')}</p>}
        {workingTable.map((meld, index) => {
          const tiles = meld.tiles.map((id) => state.tiles[id]).filter(Boolean);
          const meldValidation = validateMeld(tiles);
          return (
            <section key={meld.id} className={`digital-meld ${meldValidation.ok ? 'valid' : 'invalid'}`}>
              <header>
                <span>{t('digitalMeld')} {index + 1}</span>
                <span>{meldValidation.ok ? t(`digital${meldValidation.type === 'run' ? 'Run' : 'Group'}`) : t(meldValidation.code)}</span>
              </header>
              <div className="digital-meld-tiles">{meld.tiles.map((id) => renderTile(id, 'table'))}</div>
              {canEdit && (
                <button className="digital-mini" disabled={!selected.length} onClick={() => addToMeld(meld.id)}>
                  + {t('digitalAddSelected')}
                </button>
              )}
            </section>
          );
        })}
      </div>

      <div className="digital-selection-bar">
        <span>{t('digitalSelected')}: {selected.length}</span>
        <button disabled={!canEdit || !selected.length} onClick={newMeld}>{t('digitalNewMeld')}</button>
        <button disabled={!canEdit || !selected.length || selected.some((id) => !startRack.has(id))} onClick={returnToRack}>{t('digitalReturnRack')}</button>
        <button disabled={!canEdit || selected.length !== 1} onClick={() => shiftSelected(-1)}>◀</button>
        <button disabled={!canEdit || selected.length !== 1} onClick={() => shiftSelected(1)}>▶</button>
        <button disabled={!selected.length} onClick={() => setSelected([])}>{t('clear')}</button>
      </div>

      <div className="digital-rack-wrap">
        <div className="digital-rack-head">
          <strong>{canEdit ? t('yourTurn') : t('digitalYourRack')}</strong>
          <span>
            <button onClick={() => sortRack('number')}>{t('digitalSortNumber')}</button>
            <button onClick={() => sortRack('color')}>{t('digitalSortColor')}</button>
          </span>
        </div>
        <div className="digital-rack">{workingRack.map((id) => renderTile(id, 'rack'))}</div>
      </div>

      <div className="digital-actions">
        <button className="digital-draw" disabled={!canEdit || changed} onClick={() => onMove({ type: 'draw' })}>
          {t('digitalDraw')}
        </button>
        <button disabled={!changed} onClick={reset}>{t('digitalReset')}</button>
        <button
          className="digital-commit"
          disabled={!canEdit || !changed || !tableValidation.ok || !validation.ok}
          onClick={() => onMove(move)}
        >
          {t('digitalCommit')}
        </button>
      </div>
      {changed && !validation.ok && <p className="digital-error" role="status">{t(validation.code)}</p>}
      {!tableValidation.ok && <p className="digital-error" role="status">{t(tableValidation.code)}</p>}
    </div>
  );
}
