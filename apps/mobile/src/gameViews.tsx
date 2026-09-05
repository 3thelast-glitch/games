import type { BaseState } from '../../../packages/core/src/game.ts';
import { AbaloneBoard } from '../../../packages/games/abalone/ui.tsx';
import type { AbaloneState } from '../../../packages/games/abalone/state.ts';
import { QuoridorBoard } from '../../../packages/games/quoridor/ui.tsx';
import type { QuoridorState } from '../../../packages/games/quoridor/state.ts';
interface Props {
  state: BaseState;
  disabled: boolean;
  onMove: (move: unknown) => void;
  t: (key: string) => string;
}
export const gameViews: Record<string, (props: Props) => React.ReactNode> = {
  abalone: (props) => <AbaloneBoard {...props} state={props.state as AbaloneState} />,
  quoridor: (props) => <QuoridorBoard {...props} state={props.state as QuoridorState} />,
};
export const gameInfo = [
  {
    id: 'abalone',
    duration: '15–25',
    tag: 'abaloneTag',
    description: 'abaloneDesc',
    icon: '⬡',
  },
  {
    id: 'quoridor',
    duration: '10–20',
    tag: 'quoridorTag',
    description: 'quoridorDesc',
    icon: '▦',
  },
];
export const upcoming = [
  'chess',
  'checkers',
  'connectFour',
  'reversi',
  'nineMensMorris',
  'gomoku',
  'mancala',
];
const resources: Record<
  string,
  (state: BaseState, player: 0 | 1) => { value: string; label: string }
> = {
  abalone: (state, player) => ({
    value: `${(state as AbaloneState).captured[player]}/6`,
    label: 'captured',
  }),
  quoridor: (state, player) => ({
    value: String((state as QuoridorState).remaining[player]),
    label: 'walls',
  }),
};
export function gameResource(state: BaseState, player: 0 | 1): { value: string; label: string } {
  return resources[state.gameId](state, player);
}
