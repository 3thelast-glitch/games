# Deployment and native builds

## Web/server

Use Node.js 24+, a persistent filesystem and one server process. Copy `.env.example` to `.env`, then configure the values for your deployment. Secrets belong in your host's environment or secret manager; never in `VITE_` variables.

| Variable                                   | Meaning                                                                                        |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `PORT`, `HOST`                             | Listen address; defaults 8787 and 0.0.0.0                                                      |
| `DATABASE_PATH`                            | SQLite file, default `data/board-arena.db`                                                     |
| `MATCH_CLOCK_MS`                           | Initial time for each player, default 600000                                                   |
| `RECONNECT_GRACE_MS`                       | Reconnect allowance, default 60000                                                             |
| `ALLOWED_ORIGINS`                          | Comma-separated browser/native origins allowed to access the server                            |
| `PUBLIC_SERVER_URL`                        | Public server origin, for example `https://arena.example.com`                                  |
| `APP_URL`                                  | Public web app origin used for OAuth return                                                    |
| `VITE_SERVER_URL`                          | Compile-time server origin for a separately hosted or native client; empty for same-origin web |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth web client credentials                                                            |
| `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET`   | Apple Services ID and signed client-secret JWT                                                 |

Use origins without trailing slashes or path prefixes. Native builds reject a non-HTTPS `VITE_SERVER_URL`. For native apps include `https://localhost` (Android) and `capacitor://localhost` (iOS) in `ALLOWED_ORIGINS`, along with your public web origin. Rebuild the frontend after changing `VITE_SERVER_URL`.

```sh
npm ci
npm test
npm run build
npm start
```

Alternatively, the supplied Dockerfile builds/tests the project and runs under a non-root user:

```sh
docker compose up --build -d
```

The compose file binds port 8787 to host loopback and retains SQLite in a named volume. Put an HTTPS reverse proxy in front of it and forward both HTTP routes and WebSocket upgrades for `/ws`. Set a WebSocket idle timeout longer than the heartbeat interval. A Caddy example, after replacing the example domain:

```caddyfile
arena.example.com {
  reverse_proxy 127.0.0.1:8787
}
```

The service trusts the socket IP, not arbitrary forwarded headers. Its built-in rate limits therefore share the proxy IP when deployed behind a proxy. For a larger public installation, implement a trusted-proxy boundary and per-client limits before raising traffic. This template does not claim load-tested capacity.

Back up SQLite with its online backup mechanism or stop the server before copying the database. Do not copy only the main database file while WAL writes are active. Retain the database across deployments; deleting it deletes users, sessions, ratings and matches. A schema migration system beyond initial table creation is not included yet.

## Google sign-in

Create a Google OAuth web client and configure its callback as:

```text
https://YOUR-SERVER/api/auth/oauth/google/callback
```

Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `PUBLIC_SERVER_URL` and `APP_URL` on the server. Restart it. The app reads `/api/auth/providers` and enables Google only when these values are present.

The implementation redirects to Google's authorization endpoint with state, nonce and PKCE, exchanges the authorization code server-side, and verifies the signed identity token using Google's keys. It then returns a short-lived single-use code to the app. The app must present its original verifier to exchange that code for a session. See [Google OpenID Connect documentation](https://developers.google.com/identity/openid-connect/openid-connect).

## Apple sign-in

Configure Sign in with Apple and a Services ID associated with your app. Register and verify your HTTPS domain and callback:

```text
https://YOUR-SERVER/api/auth/oauth/apple/callback
```

Set the Services ID as `APPLE_CLIENT_ID`. Generate a signed client-secret JWT using your Apple developer key and supply it as `APPLE_CLIENT_SECRET`; renew it before its expiry. Also set `PUBLIC_SERVER_URL` and `APP_URL`. The callback accepts Apple's form POST and validates signed identity claims, issuer, audience, nonce and state. See [Apple's token validation documentation](https://developer.apple.com/documentation/signinwithapplerestapi/generate-and-validate-tokens).

Neither provider has been exercised with real credentials in this delivery. Complete provider consent/domain configuration and test both web returns and native cold/warm app returns before release. Unconfigured sign-in methods are disabled rather than simulating authentication.

## Android

The project uses Capacitor 8. Native configuration is generated from `capacitor.config.ts` and `scripts/mobile.mjs`. Use Java 21 and Android SDK/platform tools compatible with the generated SDK 36 project. Consult [Capacitor environment setup](https://capacitorjs.com/docs/getting-started/environment-setup) when installing Android Studio.

```sh
npm ci
npm run mobile:android
npx cap open android
```

Build with Android Studio, or from the generated project:

```sh
cd android
./gradlew assembleDebug
```

The debug APK is at `android/app/build/outputs/apk/debug/app-debug.apk`. On Windows use `gradlew.bat`. Release signing and Play Store upload are separate steps using your signing identity.

<<<<<<< HEAD
After pushing the repository, the manual **Build Android APK** GitHub Actions workflow can compile and upload a debug APK artifact. Its `server_url` input is optional; leaving it empty produces an app for local/AI testing. The workflow has been authored, but has not run on GitHub because the destination repository is not yet selected.
=======
After pushing the repository, the manual **Build Android APK** GitHub Actions workflow can compile and upload a debug APK artifact. Its `server_url` input is optional; leaving it empty produces an app for local/AI testing. The workflow is supplied in `3thelast-glitch/games`; an Android build must be started manually from Actions.
>>>>>>> 86095ba4b22459c5703fc305861ae0c76432fe97

## iOS

Use a Mac and a compatible Xcode installation as described in [Capacitor environment setup](https://capacitorjs.com/docs/getting-started/environment-setup). The generated project uses Swift Package Manager.

```sh
npm ci
npm run mobile:ios
npx cap open ios
```

Choose your developer team and signing settings in Xcode, then build on a simulator/device or archive for distribution. The setup script adds the `com.boardarena.app://auth` return scheme, Arabic/English localizations, dark appearance and the Preferences API privacy reason manifest. Your actual app privacy disclosures and store metadata still need to reflect the deployed service.

Change the temporary app ID consistently in the Capacitor config, native generation script and OAuth callback validation before release if adopting another bundle ID. Native generated folders are not committed by default; persist additional native customization in the generator or deliberately adopt checked-in native projects.

## Verification before launch

<<<<<<< HEAD
Run the automated suite and production build, then test with two real devices through your HTTPS endpoint: room join, both games, forced network loss/reconnect, clock expiry, rematch and ranked settlement. Test OAuth deep links with the app both running and closed. Check narrow screens, Arabic layouts, touch wall placement, audio unlock, haptics and reduced motion on actual devices.
=======
Run the automated suite and production build, then test with two real devices through your HTTPS endpoint: room join, all six games, forced network loss/reconnect, clock expiry, rematch and ranked settlement. Test OAuth deep links with the app both running and closed. Check narrow screens, Arabic layouts, touch wall placement, compulsory capture chains, mill captures, Gomoku placement confirmation, automatic draws, audio unlock, haptics and reduced motion on actual devices.
>>>>>>> 86095ba4b22459c5703fc305861ae0c76432fe97

The web production build and generated native configurations have been verified here. Native binaries, Docker execution, public TLS/WebSocket routing and provider sign-in have not been validated in this environment. Further outstanding items are listed in [delivery status](STATUS.md).
