# NAQLA | نقلة

The approved identity combines a lavender N-shaped playing path with a mint counter at its destination. The empty socket marks the starting position. Arabic UI uses **نقلة** and English UI uses **NAQLA**.

## Approved artwork

- [Original app icon](brand/naqla-icon-master.png): unchanged approved artwork, 1254 × 1254 RGB PNG.
- [Arabic / English logo](brand/naqla-lockup.png): unchanged approved artwork, 1536 × 1024 RGB PNG.
- Background: `#0c1018`; lavender: `#a28aff`; mint: `#85ddbf`; text: `#eff0f6`.

The original images remain the source of truth. Exported PNGs only resize the approved icon or add a matching dark background for platform-safe padding; they do not redraw the emblem.

## Integration

| Surface               | Asset / behavior                                                    |
| --------------------- | ------------------------------------------------------------------- |
| App navigation        | `/brand/icon-192.png` with live, accessible Arabic or English name  |
| Browser tab           | `/brand/icon-32.png`                                                |
| Apple web shortcut    | `/brand/icon-180.png`                                               |
| Web app manifest      | 192 / 512 px icons and a separately padded maskable icon            |
| Android launcher      | 48 / 72 / 96 / 144 / 192 px raster icons and a padded adaptive icon |
| Android launch screen | Dark background and centered approved icon, including Android 12+   |
| Android app label     | NAQLA; نقلة for the Arabic device locale                            |
| iOS launcher          | Opaque 1024 px icon and NAQLA display name                          |
| iOS launch screen     | Dark 2732 px canvas with a centered icon                            |

`scripts/mobile.mjs` runs `applyBranding` from `scripts/branding.mjs` after each Capacitor sync. The checked-in exports under `native/branding` require no additional image tooling at build time. This also updates branding when Android or iOS projects already exist.

For an Android build, run `npm run mobile:android`, then build with Android Studio or Gradle. For iOS, run `npm run mobile:ios` on macOS and build with Xcode. Native projects are generated and intentionally not committed.

## Compatibility

The application ID `com.boardarena.app`, authentication URL scheme, LAN service identifiers, database filename and local-storage keys are intentionally unchanged. This is a display-name and artwork update, preserving existing installations, settings, authentication callbacks and network compatibility.

The web manifest supplies names and installation icons; it does not add a service worker or claim offline PWA caching.
