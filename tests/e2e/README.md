# Board Arena Playwright responsive matrix

This suite validates the seven playable games across mobile, landscape, tablet and desktop layouts in both English/LTR and Arabic/RTL.

## Games

- Abalone
- Quoridor
- Checkers / English Draughts
- Gomoku
- Nine Men's Morris
- Connect Four
- Digital Game

## What is asserted

The layout matrix checks:

- no global/body horizontal overflow;
- intentional local scrolling for dense boards/racks only;
- no overlap between match header, board column and side controls;
- center-point hit testing so controls are not covered by transparent/fixed layers;
- minimum shared-control dimensions;
- RTL/LTR document direction;
- coarse pointer exposure in touch contexts;
- board geometry (square boards, circular Connect Four slots, Abalone aspect ratio);
- runtime page/console errors.

The touch/geometry suite additionally interacts with every game at a representative 390x844 mobile viewport and verifies edge targets, board nodes, rack reachability and real `tap()` behavior.

## Viewports

Full Chromium coverage contains 21 viewport cases:

- portrait mobile: 320x568, 360x640, 375x667, 390x844, 412x915, 430x932, 480x854;
- mobile landscape: 568x320, 667x375, 844x390, 932x430;
- tablets: 600x960, 768x1024, 820x1180, 1024x1366;
- desktop: 1024x768, 1280x720, 1366x768, 1440x900, 1920x1080, 2560x1440.

Smoke coverage uses 320x568, 390x844, 844x390 and 1366x768.

WebKit/Firefox scheduled coverage uses 320x568, 390x844, 844x390, 768x1024, 1366x768 and 1920x1080.

## Matrix modes

The test definitions use `PW_MATRIX`:

```bash
PW_MATRIX=smoke npx playwright test --project=chromium
PW_MATRIX=full npx playwright test --project=chromium tests/e2e/layout/responsive-matrix.spec.ts
PW_MATRIX=cross-browser npx playwright test --project=webkit tests/e2e/layout/responsive-matrix.spec.ts
```

Playwright is intentionally installed with `--no-save --no-package-lock` inside the dedicated GitHub Actions workflows so the existing application dependency lockfile and `npm ci` gate remain untouched.

For a local run after `npm ci`:

```bash
npm install --no-save --no-package-lock @playwright/test@1.55.0
npx playwright install chromium
PW_MATRIX=smoke npx playwright test --project=chromium
```

## CI

- `.github/workflows/playwright-responsive.yml` runs the smoke gate on pull requests.
- `.github/workflows/playwright-responsive-full.yml` runs the full Chromium matrix plus representative WebKit/Firefox coverage nightly and on manual dispatch.

Failure artifacts include the HTML report, traces, screenshots on failure and retained videos on failure.
