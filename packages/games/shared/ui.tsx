import type { BaseState } from '../../core/src/game.ts';
export interface BoardProps<S extends BaseState, M> {
  state: S;
  disabled: boolean;
  onMove: (move: M) => void;
  t: (key: string) => string;
}
export function Disc({ owner, king = false }: { owner: 0 | 1; king?: boolean }) {
  return (
    <span aria-hidden="true" className={`board-disc disc-${owner} ${king ? 'king' : ''}`}>
      {king ? '♛' : ''}
    </span>
  );
}
