# Sudoku — A little space to think

A complete, minimal, ad-free and **offline-first** Sudoku game for the web and Android. No runtime framework, no CDN, no analytics, no ads, no telemetry, no login, and no API calls. The Android app packages every asset into its APK and deliberately requests **no INTERNET permission**.

## What's included

- Four difficulty levels: **Easy, Medium, Hard, Expert**, each with eight distinct prevalidated, unique-solution templates. Every new game uses Sudoku-preserving transformations to provide many variations without intensive runtime puzzle generation.
- Mistake indicators, 3×3 and matching-number highlights, pencil notes with auto-clearing, undo/redo, logic-aware hints and fallback reveals, quick erase, pause/resume, elapsed playtime, keyboard and touch controls.
- Automatic saved games, local solve count and best times per difficulty, settings, responsive desktop/mobile layout and system/light/dark themes.
- Installable progressive web app with versioned service-worker precache. No connection needed **after the first successful online visit** to the web version.
- Native Android WebView shell loading the local bundled game, with offline storage, Android safe-area handling and synchronized system bar colors.

## Play on the web

Requirements: Node.js 18+ (development only). **No `npm install` is necessary.**

```sh
npm start
```

Open **http://localhost:4173**. To deploy, publish the **`www/`** directory using any static HTTPS host, such as GitHub Pages, Cloudflare Pages or your existing website. Web players need to visit once while online so the service worker can install all assets; subsequent loads work offline. You may also host `www/` on a local intranet with no public network.

## Android app

Requirements: Android Studio with Android SDK Platform 36, JDK 17+, Gradle 8.13. Android Studio can provision the SDK and Gradle for you.

1. Run `npm run sync:android` from this repository root after editing any web asset. This refreshes `android/app/src/main/assets/web/`.
2. Open the **`android/`** directory as a project in Android Studio.
3. Sync Gradle using **Gradle 8.13** (the project includes `gradle/wrapper/gradle-wrapper.properties`). If Android Studio requires a wrapper JAR, use a locally installed Gradle to run `gradle wrapper --gradle-version 8.13` once, or configure Android Studio to use a local Gradle installation.
4. Run on a physical Android device or emulator. Min SDK 24 (Android 7.0); target SDK 36.
5. For a locally installable debug APK, from `android/` run `gradle :app:assembleDebug` with Gradle 8.13 on PATH. The APK appears at `app/build/outputs/apk/debug/app-debug.apk`.
6. For Play Store release, configure your **own signing key**, unique application ID and developer listing; then build a signed Android App Bundle (`:app:bundleRelease`) in Android Studio. **Never commit a signing key**.

The repository includes a GitHub Actions workflow that compiles a debug APK and uploads it as a CI artifact. This is a convenient build path without a local Android SDK.

**Android security:** The manifest declares no permissions. `WebView` blocks network loads and any navigation away from its bundled local assets, JavaScript cannot access arbitrary content or file URLs, backups are disabled, and users' saves remain on-device.

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Select square | Arrow keys | Tap square |
| Enter number | 1–9 | Digit row |
| Erase | Backspace / Delete / 0 | Erase |
| Pencil notes | N | Notes |
| Hint | H | Hint |
| Undo / redo | Ctrl+Z / Ctrl+Y | Undo / Redo |
| Pause / resume | Pause button | Pause button |

Closing or backgrounding the game pauses the timer; after reopening the player explicitly resumes. Time represents time spent actively playing, not time spent away from the app.

## Architecture

```
www/index.html           Semantic game UI and dialogs
www/css/styles.css       Material-inspired adaptive visuals
www/js/engine.js         Sudoku logic, validation, hint selection, transforms
www/js/puzzles.js        32 validated authored templates, local-only
www/js/app.js            Controls, rendering, persistence and statistics
www/sw.js                Cache-first web PWA service worker
scripts/generate_bank.py Offline puzzle generator + human-technique rating
scripts/sync-android.mjs Copy web assets into Android package
android/                 Native zero-dependency Java WebView Android project
```

Unlike a device-side puzzle generator, the original templates are produced offline, uniqueness-checked, and classified using naked/hidden singles and search complexity. Digit, row, column, band, stack, and transpose permutations maintain each puzzle's solution structure and its effective difficulty.

## Tests

```sh
npm test                # Puzzle uniqueness, transform safety and offline checks
npm run check           # Above + Android web asset synchronization
```

## Privacy

No data collected, no third-party services, no advertising SDKs, no analytics, no network requests. Saved games, settings, total solved and best times are stored in `localStorage` on the device. Clearing browser/app data resets them. No cloud syncing.

## CI and release process

This source is intended for **`trishul-developers/sudoku`**. The repository is not automatically created by the ZIP: create an **empty** GitHub organization repository and push the project contents to its `main` branch. Keep the repository free of GitHub-generated README/LICENSE files on creation, so the first push is simple. If your local machine has the GitHub CLI (`gh`) and organization repository-creation privileges, you can create and push in one command instead:

```powershell
# In PowerShell, from the extracted project root. Choose public OR private.
.\scripts\publish-repo.ps1 -Visibility public
```

Or run `bash scripts/publish-repo.sh public` on Linux/macOS/Git Bash. Both scripts require explicit public/private selection and refuse to replace an existing repo. They commit with **your own configured Git author identity**. Public visibility is appropriate for distributing free game binaries to everyone; choose private if you intend to prepare/testing the release internally first.

### CI on main and pull requests

`.github/workflows/verify.yml` runs Node.js tests (including unique puzzle verification and release invariants), checks that the Android-bundled web assets exactly match `www/`, produces a preview offline PWA ZIP, compiles an Android debug APK with JDK 17 + Gradle 8.13 + API 36, and checks for unintended Android permissions. Both downloadable CI artifacts expire after 14 days. All checks must pass before merging; protect `main` with a required `Verify` check in GitHub settings if desired. **CI debug APKs are not signed for distribution.**

### One-time Android signing setup

Create and safeguard an upload signing key **locally**. Never put the keystore or its passwords into a commit, issue, or chat. Choose your real credentials and a secure backup location:

```sh
keytool -genkeypair -v -keystore sudoku-upload.jks -alias sudoku-upload \
  -keyalg RSA -keysize 3072 -validity 10000
```

Create these four **GitHub Actions repository secrets** under Settings → Secrets and variables → Actions:

| Secret | Contents |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | Base64-encoded complete `.jks` file, without line breaks |
| `ANDROID_KEYSTORE_PASSWORD` | Store password |
| `ANDROID_KEY_ALIAS` | Signing key alias, e.g. `sudoku-upload` |
| `ANDROID_KEY_PASSWORD` | Key password |

To encode the keystore, use `base64 -w0 sudoku-upload.jks` on Linux or `[Convert]::ToBase64String([IO.File]::ReadAllBytes('sudoku-upload.jks'))` in PowerShell. Store the result **only in the GitHub secret field**. Keep a secure, offline backup of the original keystore; losing your signing key can prevent future app upgrades in distribution channels not using Play App Signing.

The release workflow refuses to publish if any signing secret is absent. It reconstructs the key in a temporary runner file and uses Gradle's release signing configuration to sign both APK and AAB.

### Publish a release

The first `v0.1.0` release is requested by `.github/release-request.json` on `main`. The release workflow creates its tag after tests, signing, and artifact validation; it refuses to reuse an existing tag. Later releases use versioned tags as below.


`package.json` controls the web and Android `versionName`; Android `versionCode` is derived monotonically from `MAJOR * 1000000 + MINOR * 1000 + PATCH` (minor and patch each ≤999). Change the version using:

```sh
npm run version:set -- 0.1.1
npm run check
npm run package:pwa
# Review changes, commit, merge into main; then:
git tag v0.1.1
git push origin v0.1.1
```

`vX.Y.Z` tags must match `package.json` **exactly** and refer to commits on `main`. `.github/workflows/release.yml` reruns tests and asset synchronization, checks the signing secrets, builds optimized signed `assembleRelease` APK and `bundleRelease` AAB, verifies APK alignment and signature / AAB signature, ensures the Android application still declares no permissions, validates bundled offline assets, creates a versioned PWA ZIP, and publishes GitHub Release assets:

- `sudoku-vX.Y.Z.apk` — signed Android sideload installer.
- `sudoku-vX.Y.Z.aab` — signed Google Play upload bundle (not directly installable).
- `sudoku-pwa-vX.Y.Z.zip` — publish contents to any HTTPS static host (entrypoint at ZIP root).
- `SHA256SUMS.txt` — checksums for all three binaries.

The workflow needs GitHub Actions enabled and permission to create Releases (`contents: write` is declared). It never silently substitutes a debug or unsigned build when credentials are missing. APK and AAB signing cannot be validated until the actual GitHub runner builds a tagged release with your secrets.

### Platform release checks

Before making a public release, verify on actual Android hardware (different OS/screen sizes), browser and PWA install/update behavior, TalkBack/keyboard accessibility, handling of OS process death, and APK/AAB acceptance by your store's internal testing track. Confirm the finalized app ID (`com.trishul.sudoku`) **before** publishing: changing it after release changes Android application identity. Complete store listing, screenshots, privacy and distribution declarations. The project never requests Internet permission and does not include ad/analytics SDKs.

## Security and privacy

The Android build packages its own local WebView assets and blocks remote requests. There is no login, analytics, ads or external runtime dependency. Data is stored locally and Android backup is disabled. Release signing credentials are injected at build time via GitHub Actions secrets and are excluded from the repository.

MIT licensed. Third-party runtime dependencies: **none**.
