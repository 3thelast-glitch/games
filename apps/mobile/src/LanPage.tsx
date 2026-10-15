import { useEffect, useRef, useState } from 'react';
import { ReversiBoard } from '../../../packages/games/reversi/ui.tsx';
import type { ReversiState } from '../../../packages/games/reversi/state.ts';
import { remainingTimeMs } from '../../../packages/core/src/timing.ts';
import type { TurnTimerSeconds } from '../../../packages/core/src/timing.ts';
import { lan, type LanView } from './lan.ts';
import { manualLanTarget } from './lan-native.ts';
import { useI18n } from './i18n.tsx';
import { formatTime } from './components.tsx';
import './lan.css';

type Props = {
  playerName: string;
  turnSeconds: TurnTimerSeconds | null;
  onExit: () => void;
};

export function LanPage({ playerName, turnSeconds, onExit }: Props) {
  const { t } = useI18n();
  const [view, setView] = useState<LanView>(() => lan.current);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const pendingRevision = useRef<string | null>(null);
  const [error, setError] = useState('');
  const [roomName, setRoomName] = useState('NAQLA Reversi');
  const [address, setAddress] = useState('');
  const [roomId, setRoomId] = useState('');
  const [now, setNow] = useState(Date.now());
  useEffect(() => lan.subscribe(setView), []);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const revisionKey = `${view.snapshot?.matchId ?? 'none'}:${view.snapshot?.revision ?? -1}`;
  useEffect(() => {
    if (pendingRevision.current && (
      revisionKey !== pendingRevision.current ||
      view.error || view.status === 'reconnecting' || view.status === 'error'
    )) {
      pendingRevision.current = null;
      setPending(false);
    }
  }, [revisionKey, view.error, view.status]);

  const run = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };
  const leave = () => void run(async () => {
    await lan.leave();
    onExit();
  });
  const copy = (value: string) => void run(async () => {
    await navigator.clipboard.writeText(value);
  });
  const move = ({ row, col }: { row: number; col: number }) => {
    if (pending || view.status === 'reconnecting' || view.status === 'error') return;
    pendingRevision.current = revisionKey;
    setPending(true);
    setError('');
    void lan.move({ row, col }).catch((e: unknown) => {
      pendingRevision.current = null;
      setPending(false);
      setError(e instanceof Error ? e.message : String(e));
    });
  };

  const snapshot = view.snapshot;
  const me = view.self;
  const opponent = snapshot?.players.find((person) => person.seat !== me);
  const own = snapshot?.players.find((person) => person.seat === me);
  const started = snapshot?.status === 'playing' || snapshot?.status === 'finished' || snapshot?.status === 'interrupted';
  const playable = snapshot?.status === 'playing' && !!snapshot.state && me === snapshot.state.turn &&
    opponent?.connected && view.status !== 'reconnecting' && view.status !== 'error' && !pending;
  const winner = snapshot?.result?.winner;
  const seconds = (seat: number) => snapshot && snapshot.turnStartedAt !== null && snapshot.state
    ? remainingTimeMs(snapshot.timeControl, snapshot.clockMs, snapshot.state.turn, seat, snapshot.turnStartedAt, now)
    : 0;

  return (
    <div className="lan-page page-enter">
      <header className="page-heading lan-header">
        <button type="button" className="button secondary" onClick={leave} disabled={busy}>
          {t('lanLeave')}
        </button>
        <div>
          <span className="eyebrow">NAQLA · LAN</span>
          <h1>{t('lan')}</h1>
          <p>{t('lanIntro')}</p>
        </div>
      </header>
      {!lan.available ? (
        <section className="panel" role="status">
          <strong>{t('lanNativeOnlyTitle')}</strong>
          <p>{t('lanNativeOnlyDesc')}</p>
        </section>
      ) : (
        <>
          {view.status === 'idle' || view.status === 'closed' || view.status === 'error' ? (
            <div className="lan-lobby-grid">
              <section className="panel lan-card">
                <h2>{t('lanCreateRoom')}</h2>
                <label>{t('lanRoomName')}
                  <input maxLength={32} value={roomName} onChange={(e) => setRoomName(e.target.value)} />
                </label>
                <button className="button primary" disabled={busy || !roomName.trim()} onClick={() =>
                  void run(() => lan.createHost({ name: playerName, roomName: roomName.trim(), turnSeconds }))
                }>{t('lanHost')}</button>
              </section>
              <section className="panel lan-card">
                <h2>{t('lanFindRooms')}</h2>
                <p>{t('lanSameWifi')}</p>
                <button className="button secondary" disabled={busy} onClick={() => void run(() => lan.discover())}>
                  {t('lanScan')}
                </button>
              </section>
            </div>
          ) : null}
          {view.status === 'discovering' && (
            <section className="panel lan-card">
              <h2>{t('lanFindRooms')}</h2>
              <p>{t('lanSameWifi')}</p>
              <div className="lan-room-list">
                {view.rooms.filter((room) => room.gameId === 'reversi' && room.occupancy === 1).map((room) => (
                  <button key={room.roomId} className="button secondary" disabled={busy}
                    onClick={() => void run(() => lan.joinDiscovered(room, playerName))}>
                    {room.roomName} · {room.occupancy}/2
                  </button>
                ))}
                {!view.rooms.some((room) => room.gameId === 'reversi' && room.occupancy === 1) && (
                  <p>{t('lanNoRooms')}</p>
                )}
              </div>
              <div className="lan-manual">
                <h3>{t('lanManualJoin')}</h3>
                <label>{t('lanAddress')}
                  <input dir="ltr" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="192.168.1.10:8765" />
                </label>
                <label>{t('lanRoomId')}
                  <input dir="ltr" value={roomId} onChange={(e) => setRoomId(e.target.value)} placeholder="Room ID" />
                </label>
                <button className="button secondary" disabled={busy || !address.trim() || !roomId.trim()} onClick={() =>
                  void run(() => lan.joinManual(manualLanTarget(address), roomId.trim(), playerName))
                }>{t('lanJoin')}</button>
              </div>
              <button className="button ghost" disabled={busy} onClick={() => void run(() => lan.stopDiscovery())}>
                {t('lanStopScan')}
              </button>
            </section>
          )}
          {snapshot && snapshot.status === 'lobby' && (
            <section className="panel lan-card">
              <h2>{snapshot.roomName}</h2>
              {view.role === 'host' && (
                <div className="lan-share">
                  <div><span>{t('lanAddress')}</span><code dir="ltr">{view.endpoint ?? '—'}</code>
                    <button className="button ghost" onClick={() => copy(view.endpoint ?? '')}>{t('copy')}</button></div>
                  <div><span>{t('lanRoomId')}</span><code dir="ltr">{snapshot.roomId}</code>
                    <button className="button ghost" onClick={() => copy(snapshot.roomId)}>{t('copy')}</button></div>
                </div>
              )}
              <div className="lan-players">
                {snapshot.players.map((player) =>
                  <div key={player.id}>
                    <strong>{player.name} {player.seat === me ? `(${t('lanYou')})` : ''}</strong>
                    <span>{t(player.ready ? 'lanReady' : 'lanNotReady')}</span>
                  </div>
                )}
              </div>
              <p role="status">{snapshot.players.length < 2 ? t('lanWaitingGuest') : t('lanBothReady')}</p>
              <button className="button primary" disabled={busy || !own || view.status === 'reconnecting'}
                onClick={() => void run(() => lan.setReady(!own!.ready))}>
                {t(own?.ready ? 'lanCancelReady' : 'lanMarkReady')}
              </button>
            </section>
          )}
          {started && snapshot?.state && (
            <section className="lan-match">
              <div className="lan-match-meta panel">
                <strong>{t('reversi')} · {t('lan')}</strong>
                <span role="status">{snapshot.status === 'playing'
                  ? t(playable ? 'yourTurn' : 'theirTurn')
                  : t('game-over')}</span>
                <div className="lan-players">
                  {snapshot.players.map((player) => <div key={player.id}>
                    <strong>{player.name}{player.seat === me ? ` (${t('lanYou')})` : ''}</strong>
                    <span>{player.connected ? t('connected') : t('opponentDisconnected')}</span>
                    <span dir="ltr">{formatTime(seconds(player.seat))}</span>
                  </div>)}
                </div>
                {view.status === 'reconnecting' && <p role="status">{t('reconnecting')}</p>}
                {opponent && !opponent.connected && snapshot.status === 'playing' &&
                  <p role="status">{t('opponentDisconnected')}</p>}
              </div>
              <div className="lan-board">
                <ReversiBoard state={snapshot.state as ReversiState}
                  disabled={!playable} onMove={move} t={t} />
              </div>
              {snapshot.result && (
                <section className="panel lan-result">
                  <h2>{winner === null ? t('drawResult') :
                    winner === me ? t('victory') : t('defeat')}</h2>
                  <p>{snapshot.result.reason === 'connection-lost' ? t('opponentDisconnected') : snapshot.result.reason}</p>
                  {snapshot.status === 'finished' && (
                    <button className="button primary" disabled={busy}
                      onClick={() => void run(() => lan.rematch())}>
                      {t('rematch')}
                    </button>
                  )}
                </section>
              )}
              {snapshot.status === 'finished' && snapshot.rematchVotes.length > 0 &&
                <p role="status">{t('rematchWaiting')}</p>}
              {snapshot.status === 'playing' && (
                <button className="button secondary" disabled={busy || view.status === 'reconnecting'}
                  onClick={() => void run(() => lan.resign())}>{t('resign')}</button>
              )}
            </section>
          )}
          {(error || view.error) && <p className="inline-notice" role="alert">{t(error || view.error || '')}</p>}
          {view.status === 'connecting' && <p role="status">{t('connecting')}</p>}
          {view.status === 'reconnecting' && <p role="status">{t('reconnecting')}</p>}
        </>
      )}
    </div>
  );
}
