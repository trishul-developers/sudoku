# Pure Sudoku — Material 3, offline and ad-free

This repository uses the **Gemini-supplied Sudoku game** (`sudoku_android_project.zip`) as its canonical application. The original game HTML/CSS/JavaScript, difficulty modes, statistics, and Material 3 interface are preserved; only Android/PWA packaging, versioning, security settings and release automation have been adapted.

> **Release status:** `v0.1.0` is the previous game and remains available as a historic release. This source is the replacement planned for **`v0.2.0`**. Do not publish a new release until the Android build and device testing have passed.

## Game features

- Easy, Medium, Hard, Expert and deterministic Daily Challenge
- Unique-solution Sudoku generator, pencil notes, hints, Undo/Redo, quick input, restart, statistics, settings, light/dark palettes and haptics
- No ad SDKs, accounts, analytics, CDNs or network requests required at runtime
- PWA pre-cached for use offline after first online installation; Android bundle contains all assets
- Native Kotlin WebView wrapper and haptic/theme bridge, with **no Android permissions**

## Run the web app

No `npm install` required. Node.js 20+ for development and tests:

```sh
npm test
npm start
```

Open `http://127.0.0.1:4173`. Upload the contents of `www/` to HTTPS static hosting, or use the PWA artifact built by CI.

```sh
npm run package:pwa
```

The `www/index.html` game is self-contained (inlined styles/gameplay JS); the small external PWA manifest, service worker and icons provide installability and offline caching. `www/` is canonical. Run `npm run sync:android` after changes to copy its assets into Android.

## Android

- Android package ID: **`com.trishul.sudoku`** — retained from `v0.1.0` for install/upgrade continuity.
- Android `versionCode`: derived from `package.json` SemVer (`major*1000000 + minor*1000 + patch`): `v0.2.0` => `2000`; previous `v0.1.0` => `1000`.
- `targetSdk` and `compileSdk`: **36**; minimum Android API **24**.
- Kotlin Android wrapper from the Gemini project; Gradle **8.13**, AGP **8.13.2**, Java **17**.
- Old game state is **not migrated**: the new game uses a different local-storage schema. Existing saved game progress/stats will reset on upgrade; app identity and signing identity are preserved.

Run `npm run sync:android`, open `android/` in Android Studio, or use Gradle 8.13 from `android/`:

```sh
# In android/
gradle :app:assembleDebug
```

The project includes Gradle wrapper version configuration, but not the executable wrapper JAR. GitHub Actions provisions Gradle automatically.

## CI and release

`.github/workflows/verify.yml` checks Sudoku generation/uniqueness, web assets, versioning, PWA packaging, builds an Android debug APK and checks Android's packaged permissions. GitHub Actions artifacts are retained for 14 days.

`.github/workflows/release.yml` runs on `vX.Y.Z` tags pointing to `main`. It tests, verifies the signing keystore, builds signed APK and AAB, verifies signatures and offline bundled assets, packages the offline PWA, computes SHA-256 checksums, and publishes all artifacts as a GitHub Release.

The four previously configured repository secrets are reused:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Never commit keystores or secrets. The release workflow refuses to publish if any signing credential is missing. Tag **`v0.2.0` only after the replacement passes CI and device testing**.

### Repository update

To replace the old game while keeping `LICENSE` and Git history, the PowerShell helper copies **this complete replacement project** to a new review branch in `trishul-developers/sudoku` and opens a pull request:

```powershell
# From the extracted ZIP's root, after gh auth login:
.\scripts\push-replacement.ps1
```

The project ZIP is the actual new source. `git rm` is used on the temporary checkout so old implementation files are **removed**, not left beside Gemini's implementation. The script does not force-push, move existing tags or publish a release.

## Privacy and limitations

The native Android app has no internet permission and `blockNetworkLoads = true`. The web version necessarily needs an initial HTTPS visit to install its offline cache. Stats and saves are local to the device. Device testing, Android APK compilation and Play Store acceptance must still be validated in GitHub CI/Android Studio; offline gameplay was smoke-tested in Chromium.

**License:** MIT (the existing GitHub repository license is preserved). No external web runtime libraries.
