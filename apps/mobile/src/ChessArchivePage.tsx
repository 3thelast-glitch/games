import { useEffect, useMemo, useState } from 'react';
import { ChessBoard } from '../../../packages/games/chess/ui.tsx';
import { reconstructChessJournal } from '../../../packages/games/chess/journal.ts';
import { exportChessPgn } from '../../../packages/games/chess/pgn.ts';
import { chessArchive, type ChessArchiveRecord } from './chessArchive.ts';
import { Icon } from './components.tsx';
import { useI18n } from './i18n.tsx';

function timeControlLabel(record: ChessArchiveRecord) {
  if (record.timeControl.mode === 'none') return '∞';
  if (record.timeControl.mode === 'turn') return `${Math.round(record.timeControl.turnMs / 1000)}s/move`;
  return `${Math.round(record.timeControl.initialMs / 60000)} min`;
}

function resultLabel(record: ChessArchiveRecord) {
  if (!record.result) return '*';
  return record.result.winner === 0 ? '1-0' : record.result.winner === 1 ? '0-1' : '½-½';
}

export function ChessArchivePage({ onBack }: { onBack: () => void }) {
  const { t, lang } = useI18n();
  const [records, setRecords] = useState<ChessArchiveRecord[]>([]);
  const [selected, setSelected] = useState<ChessArchiveRecord | null>(null);
  const [ply, setPly] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [notice, setNotice] = useState('');

  const reload = () =>
    void chessArchive
      .list()
      .then(setRecords)
      .catch(() => setNotice(t('chessArchiveUnavailable')));

  useEffect(() => {
    reload();
  }, []);

  useEffect(() => {
    if (!selected || !playing) return;
    if (ply >= selected.journal.entries.length) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setPly((value) => value + 1), 750);
    return () => clearTimeout(timer);
  }, [selected, playing, ply]);

  const replayState = useMemo(
    () => (selected ? reconstructChessJournal(selected.journal, ply) : null),
    [selected, ply],
  );

  const pgnFor = (record: ChessArchiveRecord) =>
    exportChessPgn(record.journal, {
      date: new Date(record.createdAt),
      white: record.whiteName,
      black: record.blackName,
      result: record.result,
      termination: record.result?.reason,
      timeControl:
        record.timeControl.mode === 'none'
          ? '-'
          : record.timeControl.mode === 'turn'
            ? String(Math.round(record.timeControl.turnMs / 1000))
            : String(Math.round(record.timeControl.initialMs / 1000)),
      opening: record.opening
        ? lang === 'ar'
          ? record.opening.nameAr
          : record.opening.nameEn
        : undefined,
      eco: record.opening?.eco,
      mode: record.mode,
      botStyle: record.bot?.style,
    });

  const exportPgn = (record: ChessArchiveRecord) => {
    const pgn = pgnFor(record);
    const blob = new Blob([pgn], { type: 'application/x-chess-pgn;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `naqla-${record.id}.pgn`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice(t('chessPgnExported'));
  };

  const share = async (record: ChessArchiveRecord) => {
    const pgn = pgnFor(record);
    const file = new File([pgn], `naqla-${record.id}.pgn`, {
      type: 'application/x-chess-pgn',
    });
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${record.whiteName} vs ${record.blackName}`,
          text: `${record.whiteName} ${resultLabel(record)} ${record.blackName}`,
          files: navigator.canShare?.({ files: [file] }) ? [file] : undefined,
        });
        return;
      }
      await navigator.clipboard.writeText(pgn);
      setNotice(t('chessPgnCopied'));
    } catch (error) {
      if ((error as Error).name !== 'AbortError') setNotice(t('chessShareFailed'));
    }
  };

  if (selected && replayState) {
    const total = selected.journal.entries.length;
    return (
      <div className="page-enter chess-replay-page">
        <header className="page-heading chess-replay-heading">
          <button
            className="icon-button"
            aria-label={t('back')}
            onClick={() => {
              setPlaying(false);
              setSelected(null);
            }}
          >
            <Icon name="back" />
          </button>
          <div>
            <span className="eyebrow">{t('chessReplay')}</span>
            <h1>{selected.whiteName} <bdi dir="ltr">{resultLabel(selected)}</bdi> {selected.blackName}</h1>
            <p>{selected.opening ? (lang === 'ar' ? selected.opening.nameAr : selected.opening.nameEn) : t('chessUnknownOpening')}</p>
          </div>
        </header>
        <div className="chess-replay-layout">
          <section className="chess-replay-board">
            <ChessBoard
              state={replayState}
              disabled
              onMove={() => {}}
              t={t}
            />
          </section>
          <aside className="panel chess-replay-controls">
            <div className="chess-replay-counter">
              <strong>{ply}/{total}</strong>
              <span>{t('chessReplayPly')}</span>
            </div>
            <input
              aria-label={t('chessReplayPly')}
              type="range"
              min={0}
              max={total}
              value={ply}
              onChange={(event) => {
                setPlaying(false);
                setPly(Number(event.target.value));
              }}
            />
            <div className="chess-replay-buttons">
              <button onClick={() => { setPlaying(false); setPly(0); }} aria-label={t('chessReplayStart')}>⏮</button>
              <button onClick={() => { setPlaying(false); setPly((v) => Math.max(0, v - 1)); }} aria-label={t('previous')}>◀</button>
              <button onClick={() => setPlaying((value) => !value)} aria-label={t(playing ? 'pause' : 'play')}>{playing ? '⏸' : '▶'}</button>
              <button onClick={() => { setPlaying(false); setPly((v) => Math.min(total, v + 1)); }} aria-label={t('next')}>▶</button>
              <button onClick={() => { setPlaying(false); setPly(total); }} aria-label={t('chessReplayEnd')}>⏭</button>
            </div>
            <div className="chess-replay-moves" dir="ltr">
              {selected.journal.entries.map((entry) => (
                <button
                  key={entry.id}
                  className={entry.ply === ply ? 'active' : ''}
                  onClick={() => {
                    setPlaying(false);
                    setPly(entry.ply);
                  }}
                >
                  {entry.player === 0 ? `${Math.ceil(entry.ply / 2)}. ` : ''}
                  {entry.san}
                </button>
              ))}
            </div>
            <button className="button secondary full" onClick={() => exportPgn(selected)}>
              {t('chessExportPgn')}
            </button>
            <button className="button secondary full" onClick={() => void share(selected)}>
              {t('share')}
            </button>
          </aside>
        </div>
        {notice && <div className="inline-notice" role="status">{notice}</div>}
      </div>
    );
  }

  return (
    <div className="page-enter chess-archive-page">
      <header className="page-heading chess-archive-heading">
        <button className="icon-button" aria-label={t('back')} onClick={onBack}>
          <Icon name="back" />
        </button>
        <div>
          <span className="eyebrow">{t('chessSavedGames')}</span>
          <h1>{t('chessArchiveTitle')}</h1>
          <p>{t('chessArchiveDesc')}</p>
        </div>
      </header>
      {records.length ? (
        <section className="chess-archive-list">
          {records.map((record) => (
            <article className="panel chess-archive-card" key={record.id}>
              <div className="chess-archive-result">
                <strong>{record.whiteName}</strong>
                <bdi dir="ltr">{resultLabel(record)}</bdi>
                <strong>{record.blackName}</strong>
              </div>
              <div className="chess-archive-meta">
                <span>{new Date(record.updatedAt).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US')}</span>
                <span>{timeControlLabel(record)}</span>
                <span>{record.opening ? `${record.opening.eco} · ${lang === 'ar' ? record.opening.nameAr : record.opening.nameEn}` : t('chessUnknownOpening')}</span>
                <span>{t(`chessAnalysisStatus_${record.analysisStatus}`)}</span>
              </div>
              <div className="chess-archive-actions">
                <button className="button primary" onClick={() => { setSelected(record); setPly(0); }}>
                  {t('chessOpenReplay')}
                </button>
                <button className="button secondary" onClick={() => exportPgn(record)}>
                  {t('chessExportPgn')}
                </button>
                <button className="button ghost" onClick={() => void share(record)}>
                  {t('share')}
                </button>
                <button
                  className="text-button"
                  onClick={() =>
                    void chessArchive.delete(record.id).then(() => {
                      if (selected?.id === record.id) setSelected(null);
                      reload();
                    })
                  }
                >
                  {t('delete')}
                </button>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="panel chess-archive-empty">
          <Icon name="clock" size={28} />
          <h2>{t('chessArchiveEmpty')}</h2>
          <p>{t('chessArchiveEmptyDesc')}</p>
        </section>
      )}
      {notice && <div className="inline-notice" role="status">{notice}</div>}
    </div>
  );
}
