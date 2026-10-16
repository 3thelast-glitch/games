# NAQLA Phase 5 — Android/iOS release readiness

**Status (16 October 2026): Internal Android release workflow prepared; store submissions NOT performed.**
This is a release engineering checklist, not a statement that NAQLA is production-ready.

## 1. Internal Android AAB workflow

GitHub Actions: **Android Signed AAB — Internal Testing** (`.github/workflows/android-release.yml`).

- Manual `workflow_dispatch` only. No automatic Google Play upload and no public GitHub release.
- Requires an approved GitHub Environment named `android-internal-release`, preferably with required reviewers and restricted protected branches.
- Repository environment secrets (never commit these or share them in chat):
  - `NAQLA_UPLOAD_KEYSTORE_BASE64` — existing dedicated upload keystore base64-encoded; preserve the original safely offline
  - `NAQLA_UPLOAD_KEY_ALIAS`
  - `NAQLA_UPLOAD_STORE_PASSWORD`
  - `NAQLA_UPLOAD_KEY_PASSWORD`
- Required manual inputs:
  - `server_url`: real, accessible `https://` origin with valid TLS; not localhost or an example hostname
  - `app_id`: exact confirmed `appId` in `capacitor.config.ts`
  - `version_code`: new positive monotonic integer unique in Play Console
- Version name comes from `package.json`. The workflow builds an ephemeral Android native project, applies a temporary Gradle signing block, creates `app-release.aab`, verifies the JAR signature, and uploads only the AAB and SHA-256 checksum. Signing inputs are environment variables rather than literals in the generated Gradle file.
- Workflow artifacts expire after 7 days; the temporary runner keystore is removed in the cleanup step.
- **Important:** The signed AAB is for internal testing only. Valid signing and CI do not prove network compatibility, Play Console acceptance or store policy compliance. The workflow has no credentials or operations for store upload.

### Exact GitHub UI sequence

1. Repository **Settings → Environments → New environment**, name it `android-internal-release`. Restrict branches and require human approval.
2. Add the four secrets above under this environment. Generate or preserve the *upload* key with your organization's secure key management process. Never use the debug key.
3. Verify your permanent Android application ID. Currently the repo uses `com.boardarena.app` throughout Capacitor, Android Java LAN plugin/package paths, iOS URL handlers and OAuth redirects. **This is an existing technical identifier, not proof that a final store identity was approved.** If choosing a new ID, change and test *all* linked native/OAuth identifiers together before shipping; editing Capacitor alone is insufficient.
4. Provision a staging/production HTTPS/WSS backend according to [deployment](DEPLOYMENT.md) and [network acceptance](NETWORK_PHASE2.md). Validate on real phones.
5. GitHub **Actions → Android Signed AAB — Internal Testing → Run workflow**, enter exact server URL/app ID and the next unused version code.
6. After successful checks, download `NAQLA-signed-internal-AAB`, verify its checksum and use Google Play Console **Internal testing** only, after setting up Play App Signing and any required account/policy declarations.

The latest debug APK workflow remains available for local/AI/LAN testing without a public backend; an internal signed AAB **requires** a real HTTPS endpoint.

## 2. Mandatory mobile quality gates

| Test | Evidence required | Status |
| --- | --- | --- |
| Unit/typecheck/build/security | Green Validate NAQLA run for exact commit | CI-supported |
| Android debug + iOS simulator | Green build workflow runs for exact commit | CI-supported |
| Signed internal AAB | Signed artifact, signature check, SHA-256, consistent app ID/version | Requires keystore and manually dispatched workflow |
| Android physical devices | Install, startup, Arabic/English, RTL/LTR, rotate, performance, back button, screen reader | Not recorded |
| LAN | Two phones same Wi-Fi: Reversi discovery, IP join, ready, resign, rematch, reconnect | Not recorded |
| Online | Two independent accounts on distinct networks; TLS/WSS, quick/private matchmaking, reconnect/resume, timeout, Elo | Needs deployed server |
| Authentication | Actual Google/Apple accounts, OAuth redirect cold/warm returns, session revoke | Not recorded |
| Hidden information | Dominoes/Digital Game/Naval Battle projected state in all resume/network flows | Server tests present; device and adversarial review pending |
| Data/operations | Migration strategy, backup/restore, monitoring, account deletion/reset, privacy review | Open #90/#91/#92 |
| Play Console internal track | Bundle accepted, Play App Signing checked, install via test track | Not performed |
| Store production | Privacy policy, data safety, content rating, screenshots, support contact, staged rollout | Not approved |

## 3. iOS distribution

The existing `Build iOS` workflow compiles for an iOS **simulator without code signing**. That is not an IPA for TestFlight. Before distributing to TestFlight, the project owner must provide a stable Bundle ID, Apple Developer Team, provisioning profiles/certificates and App Store Connect configuration. Run a signed `xcodebuild archive` / export in an authorized macOS environment and test physical devices. No automatic Apple publication is configured.

## 4. Store listing and privacy declaration checklist

Do not invent legal or contact details. Obtain and verify:
- Actual legal entity/developer name and support email/URL
- Published privacy policy and terms of use, including account retention/deletion, analytics and connected OAuth providers
- Platform-correct data safety / App Privacy declarations based on the *deployed* implementation
- Screenshots and short/long descriptions in Arabic and English, accurate supported mode claims (LAN currently Reversi only)
- 1024px brand art, launcher icons, verified package identity, Play integrity/upload key ownership, content rating and target audience
- Accessibility and security reports, tested rollback and crash monitoring
- Product choice whether to publish all 12 games initially or use an internal staged release

**Release decision:** Not ready for public production store release. Completing the internal AAB workflow improves repeatability without silently bypassing the operational or regulatory gates.
