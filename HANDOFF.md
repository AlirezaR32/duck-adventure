# HANDOFF — Duck Adventure V1.0 Release Candidate

Read this first. You are receiving a **working, verified release candidate** — please keep
it that way. This file tells you how to run it, how to verify your own changes, and what
is genuinely left to do.

## What this project is

A cute 2.5D physics platformer (Three.js 0.186 + custom 2D-plane physics on Next.js) where
a collectible-toy white duck runs, jumps and **swings** across four fantasy regions
(Enchanted Meadow / Floating Isles / Crystal Canyon / Cloud Garden). Web-first, Android
packaged via Capacitor. Full details, test tables and honest limitations: `README.md`.

## Current state (as shipped in this zip)

| Check | Result |
|---|---|
| 20-scenario deterministic sim suite (gameplay + release shell) | **20/20 PASS** |
| 19-step player journey via real UI buttons + storage reload | **19/19 PASS** |
| Robustness (corrupt save/settings, PWA assets, boot requests) | **3/3 PASS** |
| Android APK | **BUILT** — debug (installable) + release-unsigned, aapt-verified |
| Real-device testing | **NOT DONE** (no hardware in the build sandbox) |
| Improved duck model | **NOT DELIVERED** — procedural v4 is integrated; keep it as fallback |

Physics/jump/swing constants are **byte-identical across V0.7→V1.0** — every level's
reachability was verified against them. Do not "tune" them casually.

## Run it

```bash
bun install          # (or npm install)
bun run dev          # dev server on :3000
bun run build        # production standalone build
bun run start        # serve the production build
```

Desktop keys for development: ← → / A D run · Space/↑/W jump · E/Enter grab-release · R retry.

## Verify your changes (ALWAYS run these before claiming anything)

```bash
# 1) 20-scenario engine suite  (needs the server running on :3000)
node scripts/rc-runner.mjs                 # → exit 0, prints 20/20
# 2) full player journey (touch viewport, real buttons, save persistence)
node scripts/journey.mjs                   # → exit 0, prints 19/19
# 3) robustness probes
node scripts/robustness.mjs                # → exit 0, prints 3/3
# 4) perf snapshot (draw calls / tris / heap drift)
node scripts/perf-snapshot.mjs
```

How it works: the game exposes a `window.__duck` debug hook (`press/tap/warp/sim/
releaseWhen/loadLevel/setPaused/state`…) built for deterministic headless testing; the
harnesses in `scripts/game-tests-v6/v8/v9.js` (`window.__T`) drive it. The runners use
**global playwright** (`/home/z/.npm-global/lib/node_modules/playwright`) — install
playwright locally if that path doesn't exist on your machine and adjust the require path
at the top of the runner scripts.

**Rules of this repo (established over V0→V1.0):**
- Never fake a test result. If something wasn't run, say so.
- Fix root causes, not symptoms; small verifiable steps; run the suite after each change.
- Don't redesign the duck (reference-faithful v4: long neck, orange bill, bead eyes) or
  remove the swing mechanic — it is the core of the game.
- If a replacement duck model arrives, validate format/scale/orientation/animation compat
  BEFORE swapping, and keep v4 as fallback.

## Rebuild the Android APK

`android-build/` holds the Capacitor 8 wrapper (committed). The SDK/JDK are machine-local
(not in the zip) — install them once, then:

```bash
# one-time toolchain (Linux): Android cmdline-tools + platform 36 + build-tools 35,
# and a FULL JDK 21 (a JRE is not enough — no javac)
curl -o cmdtools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip cmdtools.zip && mkdir -p toolchain/android-sdk/cmdline-tools && mv cmdline-tools toolchain/android-sdk/latest
yes | toolchain/android-sdk/cmdline-tools/latest/bin/sdkmanager --licenses
toolchain/android-sdk/cmdline-tools/latest/bin/sdkmanager "platform-tools" "platforms;android-36" "build-tools;35.0.0"

# refresh the web shell from the game
NEXT_EXPORT=1 npx next build && rm -rf android-build/www && cp -r out android-build/www

# build
cd android-build/android
echo "sdk.dir=$PWD/../../toolchain/android-sdk" > local.properties
export ANDROID_HOME=$PWD/../../toolchain/android-sdk JAVA_HOME=$PWD/../../toolchain/jdk21
./gradlew assembleDebug      # → app/build/outputs/apk/debug/app-debug.apk
./gradlew assembleRelease    # → app-release-unsigned.apk
```

App id `com.duckadventure.game`, versionCode 1 / versionName 1.0, minSdk 24 / target 36,
INTERNET-only permissions. Duck launcher icons: `node scripts/gen-android-icons.mjs`.

## What to do next (priority order)

1. **Real-device validation** — sideload `download/DuckAdventure-v1.0-rc-debug.apk`;
   check fps on a mid-range phone, touch latency, notch/safe-area, backgrounding.
2. **Signing + store prep** — keystore, `signingConfigs.release`, version bump policy.
3. If the improved duck GLB arrives → validate → integrate behind the existing procedural
   controller → re-run the full suite (animation events & collision shape unchanged).
4. Optional polish (documented in README limitations): per-region music themes, confetti
   InstancedMesh pooling, 390px "BEST" chip crowding.

## Repo map

```
src/components/game/GameCanvas.tsx    React shell: menu/pause/settings/picker/completion, touch UI
src/components/game/engine/           Game.ts (orchestrator+debug hook), Physics.ts, Swing.ts,
                                      Duck.ts (procedural v4), Level.ts, LevelKit.ts, levels.ts,
                                      Background.ts, Sfx.ts, Music.ts, Input.ts
public/                               PWA manifest + icons
scripts/game-tests-v6/v8/v9.js        deterministic test harnesses (window.__T)
scripts/rc-runner.mjs                 suite runner · journey.mjs · robustness.mjs ·
                                      perf-snapshot.mjs · gen-icons.mjs · gen-android-icons.mjs
android-build/                        Capacitor wrapper (appId com.duckadventure.game)
download/                             APKs, duck.glb export, screenshots per version
worklog.md                            full version-by-version engineering history (read it)
.git/                                 complete commit history V0 → V1.0-RC
```

Excluded from this zip (machine-local or rebuildable): `node_modules/`, `.next/`, `out/`,
`toolchain/` (Android SDK + JDK), build intermediates.
