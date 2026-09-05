import { CheckersBoard } from '../../../packages/games/checkers/ui.tsx';
import type { CheckersState } from '../../../packages/games/checkers/state.ts';
import { GomokuBoard } from '../../../packages/games/gomoku/ui.tsx';
import type { GomokuState } from '../../../packages/games/gomoku/state.ts';
import { ConnectFourBoard } from '../../../packages/games/connect-four/ui.tsx';
import type { ConnectFourState } from '../../../packages/games/connect-four/state.ts';
import { MorrisBoard } from '../../../packages/games/nine-mens-morris/ui.tsx';
import type { MorrisState } from '../../../packages/games/nine-mens-morris/state.ts';
import { DigitalGameBoard } from '../../../packages/games/digital-game/ui.tsx';
import type { DigitalGameState } from '../../../packages/games/digital-game/state.ts';
import type { BaseState, Seat } from '../../../packages/core/src/game.ts';
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
  nineMensMorris: (props) => <MorrisBoard {...props} state={props.state as MorrisState} />,
  connectFour: (props) => <ConnectFourBoard {...props} state={props.state as ConnectFourState} />,
  gomoku: (props) => <GomokuBoard {...props} state={props.state as GomokuState} />,
  checkers: (props) => <CheckersBoard {...props} state={props.state as CheckersState} />,
  digitalGame: (props) => <DigitalGameBoard {...props} state={props.state as DigitalGameState} />,
  abalone: (props) => <AbaloneBoard {...props} state={props.state as AbaloneState} />,
  quoridor: (props) => <QuoridorBoard {...props} state={props.state as QuoridorState} />,
};
export const gameInfo = [
  ...[
    { id: 'checkers', duration: '10–20', icon: '◉' },
    { id: 'gomoku', duration: '5–15', icon: '✣' },
    { id: 'nineMensMorris', duration: '10–20', icon: '▣' },
    { id: 'connectFour', duration: '5–10', icon: '⠿' },
  ].map((game) => ({ ...game, tag: `${game.id}Tag`, description: `${game.id}Desc` })),
  {
    id: 'digitalGame',
    duration: '15–40',
    tag: 'digitalGameTag',
    description: 'digitalGameDesc',
    icon: '▥',
  },
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
export const upcoming = ['chess', 'reversi', 'mancala'];
const resources: Record<
  string,
  (state: BaseState, player: Seat) => { value: string; label: string }
> = {
  abalone: (state, player) => ({
    value: `${(state as AbaloneState).captured[player as 0 | 1]}/6`,
    label: 'captured',
  }),
  quoridor: (state, player) => ({
    value: String((state as QuoridorState).remaining[player as 0 | 1]),
    label: 'walls',
  }),
  digitalGame: (state, player) => ({
    value: String((state as DigitalGameState).rackCounts[player]),
    label: 'digitalTilesLeft',
  }),
};
export function gameResource(state: BaseState, player: Seat): { value: string; label: string } {
  if (resources[state.gameId]) return resources[state.gameId](state, player);
  const board = (state as CheckersState | GomokuState | MorrisState | ConnectFourState).board;
  const count = board.filter((piece) =>
    typeof piece === 'object' && piece !== null ? piece.owner === player : piece === player,
  ).length;
  return { value: String(count), label: state.gameId === 'gomoku' ? 'stones' : 'pieces' };
}
