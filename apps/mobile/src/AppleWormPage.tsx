import { AppleWormScreenshotGame } from './AppleWormScreenshotGame.tsx';
import type { Settings } from './platform.ts';

/**
 * Apple Worm has ONE gameplay entry, ONE level selector (001–105),
 * and ONE approved stage source: the user's PDF.
 *
 * The former optional forty-stage game and its portal-based switch
 * were removed from the player's entry flow. All previously polished
 * premium art now belongs to the same 105-stage engine.
 */
export function AppleWormPage({onExit,settings}:{
  onExit:()=>void;
  settings:Settings;
  onToggleSound:()=>void;
}) {
  return <AppleWormScreenshotGame onExit={onExit} settings={settings}/>;
}
