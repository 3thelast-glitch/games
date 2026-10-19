import { AppleWormScreenshotGame } from './AppleWormScreenshotGame.tsx';
import { defaults } from './platform.ts';

/**
 * Backwards-compatible entry for old deep links and cached desktop UI.
 * The reference-only gallery has been retired. The screenshot's actual
 * 105 PDF-based stages now render and play inside the ONE Apple Worm game.
 *
 * Do not resurrect "not playable" text or a second 40-level catalogue.
 */
export function AppleWormSourceGallery({lang,onClose}:{
  lang:'ar'|'en';
  onClose:()=>void;
}) {
  return <AppleWormScreenshotGame onExit={onClose}
    settings={{...defaults,lang}}/>;
}
