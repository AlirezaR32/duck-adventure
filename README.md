# Duck Adventure — V1.0 Release Candidate

A charming, **level-based 2.5D fantasy adventure** starring a smooth, collectible-toy white
duck, built for mobile (Android-first) play in the browser. The duck matches the supplied
ornament reference: long elegant neck rising from the chest with a gentle S-sweep, softly
rounded head, a properly sculpted orange bill, glossy bead eyes with catchlight, folded
wings that hug the flank, a perky lifted tail blended into the silhouette, and stubby orange
legs with webbed feet.

**V1.0 is the release candidate**: the full game was audited, the complete 12-step player
journey was verified end-to-end (launch → menu → play → run/jump → swing → momentum release →
land → collect → checkpoint → recover → complete → menu → relaunch with saved data), and the
**Android APK was actually built** (Capacitor 8 + Android SDK 36: debug APK + unsigned
release APK in `download/`). No gameplay code needed changing — the V0.9 baseline passed
every suite first try, so the RC is deliberately a stabilization and packaging release,
not a feature cycle.

![screenshots](download/screens/v8/v8-l4-ferry-ring.png)

## Engine

Same as V0: **Three.js (real 3D) + a custom 2D-plane physics controller** on Next.js/TypeScript —
instantly playable in any browser, deterministic fixed-timestep sim (1/60) that can be tested
headlessly, and the duck exports to **`download/duck.glb`** for future Godot/Unity/Blender use.
The Android packaging path (TWA/Bubblewrap or Capacitor) is documented at the bottom.

## Run it

```bash
bun install
bun run dev        # dev server (the sandbox runs this automatically on port 3000)
bun run build      # production build (verified: compiles + serves, statics 200)
```

Desktop keyboard works for development: **← → / A D** run · **Space / ↑ / W** jump ·
**E / Enter** grab & let go · **R** quick retry (respawn at checkpoint).

Touch: ← → buttons bottom-left · big **JUMP** bottom-right · contextual **GRAB / LET GO**
button appears near swings. All buttons are **multi-finger-safe** (a second finger landing
on the same button can no longer drop the input when the first lifts) and inputs are
force-released on pause, unmount, and app backgrounding.

## The loop (complete session)

**Main menu → (continue / pick region) → region intro → run → jump → grab → pump → release →
fly → collect → hazard dodge → checkpoint → … → finish → result screen → next region / replay
/ menu.** Pause any time (button or app backgrounding); the pause menu offers resume,
restart, settings and main menu. Progress (unlocked regions, per-region best stars & time)
persists in localStorage (`duck-save-v2`); settings in `duck-settings-v1`. No accounts,
offline-friendly. Corrupt or partial save data is normalized or discarded — never a crash.
Replaying a completed region never duplicates rewards — records are best-value merges.

## The four regions

| # | Region | Theme | Teaching / challenge | Content |
|---|--------|-------|----------------------|---------|
| A | **Enchanted Meadow** (Meadow Swing) | sunny meadow | teach run, jump, grab, pump, release | teaching hop, 2 A-frame swings, wide landings, 1 checkpoint, 5 stars |
| B | **Floating Islands** (Floating Isles) | airy mint isles | reward momentum & release timing | climb, long vine, **mid-air chain pair** (S3→S4), high/low routes, 2 checkpoints, 7 stars |
| C | **Crystal Canyon** (Crystal Canyon) | warm dusk canyon | demanding traversal + the first hazards | elevated swing, **moving ferry slab**, long vine, **thorn burr hazard**, checkpoint before the hardest climb, **vertical elevator**, background rope bridge, 2 checkpoints, 6 stars |
| D | **Cloud Garden** (Cloud Garden) | dusk-magic lavender sky, mint grass on cloud-rock | combine everything: momentum, chains, movers, precision landings | teaching hop, climb swing, long vine, **walk-on lily ferry through a ring gate**, chain zone (S3→S4), **double-vine grand finale (S5→S6 mid-air chain)** through a second ring gate, **optional expert shortcut isle**, thorn burr, 3 checkpoints, 10 stars |

Every platform, swing, mover, hazard and checkpoint transition in all four regions was
**reached and verified with the deterministic sim harness** (see Tests). Physics constants
are byte-identical to V0.7/V0.8 — reachability is untouched.

## What changed in V1.0 (release candidate)

### Audit result — zero gameplay changes required
The entire engine (11 modules, ~5.7k lines), the session shell and all four level defs
were re-read and the full 20-scenario sim suite ran **before any change**: 14/14 V0.8
gameplay + 6/6 V0.9 release-shell, **first try, zero console errors**. Physics, swing
mechanics, level reachability, checkpoints, hazards, saves and menus were therefore
**left byte-identical** — the RC freezes the feature set exactly as specified.

### New: Android artifacts actually produced
- Toolchain installed in-sandbox: Android cmdline-tools → SDK 36 + build-tools 35,
  Temurin JDK 21 (the preinstalled JRE has no `javac`).
- **Capacitor 8.5.3** wraps the static export of the game (`NEXT_EXPORT=1 next build`
  → `out/`, copied to `android-build/www`). App id `com.duckadventure.game`, name
  "Duck Adventure", versionCode 1 / versionName 1.0, minSdk 24 / target 36,
  **INTERNET is the only permission**.
- Stock Capacitor launcher icons replaced with the duck mascot (all densities,
  round + adaptive foreground/background, `scripts/gen-android-icons.mjs`).
- Built: `DuckAdventure-v1.0-rc-debug.apk` (4.7 MB) and
  `DuckAdventure-v1.0-rc-release-unsigned.apk` (3.7 MB) — both verified with
  `aapt dump badging` and confirmed to contain the game bundle + icons.
- The static export that ships **inside** the APK passed the full 19/19 player-journey
  suite served statically — the APK shell is the verified build, not a separate code path.

### New: end-to-end player-journey verification (19 steps)
`scripts/journey.mjs` (Playwright, 390×844 touch viewport) drives the real shell buttons:
launch, menu content, PLAY, **run+jump via the actual touch buttons**, swing attach →
pump to |ω|≥3 → release in the proven window (vx 9.6 at release), landing-zone check,
star collection, checkpoint activation, fall recovery to the checkpoint, level completion
through the second swing, win overlay, NEXT LEVEL, pause menu (Resume/Restart/Main Menu),
return to menu, and **relaunch persistence** (menu shows CONTINUE · LEVEL 2; changed SFX
volume survives reload; save payload sane). Plus 3 robustness probes: corrupt save →
boots to menu without crashing, corrupt settings → defaults without crashing, and all
PWA assets 200 with no 4xx/5xx during boot.

### Minor (non-gameplay)
- `next.config.ts`: optional static-export branch (`NEXT_EXPORT=1`) for the APK shell;
  the default standalone web build is unchanged. `src/app/api/route.ts` marked
  `force-static` (export compatibility only).
- New scripts: `rc-runner.mjs` (suite runner), `journey.mjs`, `robustness.mjs`,
  `perf-snapshot.mjs`, `gen-android-icons.mjs`.

## What changed in V0.9

### Session shell (all new)
- **Main menu** over the live world: Play / Continue (jumps straight to the highest
  unlocked region), Levels (with total-star counter), Settings. Keyboard is blocked on the
  menu; the world idles as a backdrop.
- **Pause menu** (button, plus auto-pause when the app is backgrounded): Resume · Restart
  Level · Settings · Main Menu. Pausing freezes the sim, drops held inputs, suspends audio;
  resuming requires the button (a user gesture, satisfying autoplay policies).
- **Settings** — every control is functional and persisted: **SFX volume**, **music
  volume**, **vibration** (haptic ticks for stars/checkpoints/pricks/grab prompts via
  `navigator.vibrate`, silently no-op where unsupported), **graphics tier** (Battery =
  DPR ≤ 1 + shadows off + 40-particle budget · Balanced = DPR ≤ 1.75 + 1024² shadows ·
  High = DPR ≤ 2 + 2048² shadows — all applied live; Battery drops ~19 draw calls).
- **Completion feedback**: victory screen now also announces a newly unlocked region
  ("Region D — Cloud Garden unlocked!").

### Audio (new)
- **Generative ambient music** (`Music.ts`): a calm C-pentatonic pluck melody over slow
  sine pads, two alternating sections, lookahead-scheduled (250 ms tick), zero per-frame
  cost, routed through a dedicated music bus (music volume + master mute both apply).
  Starts on the first user gesture; stops on pause/backgrounding. Synthesized SFX are
  unchanged from V0.8.

### Android robustness
- **Auto-pause on backgrounding** via `visibilitychange` (not just `blur`, which mobile
  browsers fire unreliably) — inputs cleared, audio suspended, pause menu on return.
- **Stuck-input fixes**: the contextual GRAB button can unmount mid-press (duck moves out
  of range) — the shell now force-clears `interact` so the next tap can't be silently
  eaten; per-button pointer-id sets make two-finger presses well-defined.
- **Safe-area-aware HUD** (`env(safe-area-inset-top/bottom)`) — nothing hides under notches
  or system bars; buttons keep ≥ 76 px touch targets.
- **WebGL fallback**: a friendly message instead of a white screen if context creation fails.

### Performance (targeted, visuals preserved)
- **Swing renderer now allocates zero objects per frame** — previously ~2k `Vector3`s/sec
  at 60 Hz (GC churn on mid-range Android); scratch vectors + per-swing anchor reuse.
- Confetti bursts share 5 materials instead of allocating one per particle; a live
  **particle budget** trims bursts per graphics tier.
- Quality tiers apply live (DPR cap, shadow resolution/disposal, particle cap).
- Measured at the mobile viewport (390×844, Balanced): **L1 94 dc / 22.6k tris, L4 101 dc /
  22.7k tris** — slightly *better* than V0.8's recorded 104/23.4k. Battery tier: −19 dc
  (shadows off). See Performance below for the honest fps caveat.

### Packaging (new)
- **PWA manifest** (`public/manifest.webmanifest`: standalone display, theme #fff2d2,
  orientation unlocked — portrait is the verified mobile layout, landscape works) +
  **generated launcher icons** (192/512/maskable/apple-touch via `scripts/gen-icons.mjs`,
  sharp-rasterized duck mascot). Verified: manifest, icons and apple-touch meta all serve
  200 and are wired in `<head>`.
- Android ships as a **TWA** (Bubblewrap) — commands below; Capacitor remains an
  alternative. No permissions are required (vibration works without a permission in
  TWA/WebView).

## Project structure

```
src/components/game/
  GameCanvas.tsx            React shell: menu / pause / settings / picker / completion,
                            multi-finger-safe touch UI, safe-area HUD, WebGL fallback,
                            haptics, save v2 + settings v1 persistence
  engine/
    Game.ts                 orchestrator: loop (pause-aware), controller, camera, swing
                            chain, movers, checkpoints, stars, hazards, confetti budget,
                            quality tiers, audio lifecycle, debug hook (+setPaused/
                            setQuality/quality/music state)
    Physics.ts              AABB world, substepped axis-separated collision, corner
                            forgiveness, moving-platform motions + carrier
    Input.ts                unified keyboard/touch input with edge-triggered presses
    Duck.ts                 sculpted collectible-figure duck (v4) + procedural animation
    Swing.ts                frame + hanging swings; zero-allocation rope placement
    Music.ts                NEW: generative ambient music (lookahead scheduler)
    Level.ts                buildLevelRuntime: def → scene, stars, checkpoints, hazards, flag
    LevelKit.ts             reusable builders + 4 themes + ring gates, puff plants, bridges,
                            thorn burr
    levels.ts               the four LevelDefs (pure data + decor placement)
    Background.ts           sky, sun, layered hills, cloud sea — themeable per level
    Sfx.ts                  WebAudio synth SFX + per-bus volumes, suspend/resume, mute
public/manifest.webmanifest  PWA manifest (NEW)
public/icon-*.png et al      generated launcher icons (NEW)
scripts/game-tests-v6.js     deterministic L1–L3 harness (window.__T, sim-based)
scripts/game-tests-v8.js     L4 scenarios + crossLevel4 (extends T.all)
scripts/game-tests-v9.js     pause/resume, respawn-while-paused, quality tiers,
                             level-switch leak loop, multi-touch buttons, stuck-tap guard
scripts/rc-runner.mjs        NEW: playwright runner for the 20-scenario sim suite
scripts/journey.mjs          NEW: 12-step player-journey verification (19 checks)
scripts/robustness.mjs       NEW: corrupt-save/settings + asset-availability probes
scripts/perf-snapshot.mjs    NEW: per-tier draw-call/triangle/heap snapshot
scripts/gen-icons.mjs        sharp-based launcher icon generation
scripts/gen-android-icons.mjs NEW: APK mipmap duck icons (all densities)
scripts/export-duck.ts       exports the duck to download/duck.glb
download/screens/v10/        V1.0 journey screenshots
download/DuckAdventure-*.apk NEW: built Android artifacts (debug + unsigned release)
```

## Android packaging (PROVEN — artifacts built in this repo)

The RC ships a **Capacitor 8** wrapper; both APKs were built by the exact commands below
(`android-build/` is committed; the SDK/JDK live under `toolchain/`, not in git).

### Rebuild the APK from scratch
```bash
# 0) one-time toolchain (already done in this sandbox: toolchain/android-sdk + toolchain/jdk21)
curl -o cmdtools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip cmdtools.zip && mkdir -p toolchain/android-sdk/cmdline-tools && mv cmdline-tools toolchain/android-sdk/latest
yes | toolchain/android-sdk/cmdline-tools/latest/bin/sdkmanager --licenses
toolchain/android-sdk/cmdline-tools/latest/bin/sdkmanager "platform-tools" "platforms;android-36" "build-tools;35.0.0"

# 1) static export of the game (the APK web shell)
NEXT_EXPORT=1 npx next build && rm -rf android-build/www && cp -r out android-build/www

# 2) sync + build (JAVA_HOME must be a full JDK — the sandbox JRE has no javac)
cd android-build/android
echo "sdk.dir=$PWD/../../toolchain/android-sdk" > local.properties
export ANDROID_HOME=$PWD/../../toolchain/android-sdk JAVA_HOME=$PWD/../../toolchain/jdk21
./gradlew assembleDebug          # → app/build/outputs/apk/debug/app-debug.apk
./gradlew assembleRelease        # → app-release-unsigned.apk (needs a keystore + signing config to ship)
```

### Configuration as built
| Item | Value |
|---|---|
| applicationId | `com.duckadventure.game` |
| App name | Duck Adventure |
| versionCode / versionName | 1 / 1.0 |
| minSdk / target / compile | 24 (Android 7.0+) / 36 / 36 |
| Permissions | `INTERNET` only (+ a self-scoped dynamic-receiver permission Capacitor generates) |
| Orientation | unrestricted (`android:screenOrientation` unset — the game adapts; portrait 390×844 is the verified layout) |
| Launcher icon | duck mascot, all densities (ic_launcher / round / adaptive foreground+background) |
| Offline | fully playable offline (assets local; only the hello-world `/api` stub exists) |

To sign for distribution: generate a keystore, add a `signingConfigs.release` block to
`android-build/android/app/build.gradle`, and set the version bump there. Store upload
was **not** performed (no authorization, per the RC brief). A Bubblewrap/TWA route also
remains possible from the hosted PWA, but Capacitor is the path that was actually built.

Without any wrapper the game is fully playable in mobile Chrome/Firefox; "Add to Home
Screen" gives the fullscreen app-like experience (manifest-driven).

## Actual tests performed (headless browser, agent-driven, deterministic `sim()` harness)

`scripts/game-tests-v6.js` + `game-tests-v8.js` (14 scenarios, V0.8 baseline) and the new
`game-tests-v9.js` (6 release-shell scenarios) injected into the running page.

**V0.8 gameplay suite — two consecutive full runs after the V0.9 changes: ALL GREEN (14/14).**

| # | Scenario | Result |
|---|----------|--------|
| 1 | **L1 full**: teaching hop → S1 → wide landing → checkpoint → S2 → flag | PASS — won, **5/5 stars** |
| 2 | **L1 checkpoint**: fall after P2 → respawn exactly at the post | PASS |
| 3 | **L2 full**: S1 climb → S2 vine → S3 → S4 → S5 climb → flag | PASS — won, 3/7 stars |
| 4 | **L2 mid-air chain**: hard S3 release → grab S4 while airborne → land P5 | PASS — chained |
| 5 | **L3 movers**: ferry M1 (edge wait → board → **carried** → hop off) | PASS — landed P3 |
| 6 | **L3 checkpoint**: fall off P5 → respawn at the pre-finale post | PASS |
| 7 | **L3 full**: S1 → M1 → **burr hop** → S2 → S3 → checkpoint → M2 elevator → S4 finale → flag | PASS — **won**, 3/6 stars |
| 8 | **L4 part 1**: teaching hop → S1 climb (CP1) → long vine S2 → burr island | PASS — landed 34.7, safe of the burr |
| 9 | **L4 full**: hop → walk-on ferry → S3 → **mid-air chain S4** → S5 → **mid-air chain S6** → grand garden → flag | PASS — **won**, 6/10 stars, cp 2, both chains true |
| 10 | **L4 hazard**: safe standstill untouched for a full patrol; walking into the burr pricks + respawns at CP1 | PASS |
| 11 | **L4 checkpoint**: fall after CP3 → respawn at the post | PASS |
| 12 | **L4 shortcut**: expert early release lands the high isle (83.0–85.2) | PASS — via the release-window sweep |
| 13 | **crossLevel4**: win L1 → L4 pristine (hazards=1, swings=6) → back → reload ×2 | PASS — no stale state |
| 14 | **Reset loop**: 6× (grab/release cycles + fullReset) | PASS — bounded, no NaN |

**V0.9 release-shell suite: 6/6 PASS.**

| Scenario | Verifies | Result |
|----------|----------|--------|
| `v9_pauseSwing` | pause flag set/cleared; pendulum state survives a pause cycle intact (omega 2.41 preserved); still rideable after | PASS |
| `v9_pauseRespawn` | respawn while paused keeps the pause flag, lands cleanly at spawn | PASS |
| `v9_quality` | Battery = shadows off; tiers ordered by DPR cap; live switch | PASS |
| `v9_levelLoop` | 8 level hops (incl. repeat loads): correct swing counts (2/5/4/6), no cp/star leaks, no NaN | PASS |
| `v9_multiTouch` | two synthetic pointers on one button: lifting one keeps the input (vx −4.2 held), lifting both releases (vx 0) | PASS |
| `v9_hudPrompt` | abrupt input clear mid-press cannot eat the next grab (the old stuck-tap bug) | PASS |

**Manual UI probes (real CDP clicks/taps, fresh page loads):**
- Menu → PLAY/CONTINUE → HUD + JUMP render, input unblocked (duck runs at 4.2 u/s) ✓
- Pause → overlay + engine paused + touch buttons hidden → RESUME → unpaused ✓
- Restart Level → back to spawn, cp −1, stars 0 ✓ · Main Menu → menu shown ✓
- Settings: SFX slider (native value setter) → persisted; **Battery tier applies live
  (shadows:false in the same frame)**; settings survive reload and re-apply at boot ✓
- **Save integrity**: corrupted `duck-save-v2` → game boots to menu, no crash; partial save
  (missing level records) → normalized with empty records, unlocked preserved ✓
- **Music lifecycle**: starts on PLAY (user gesture), suspends on pause, resumes on resume ✓
- **Auto-pause on backgrounding**: switching tabs fires the handler → engine paused +
  pause overlay on return → RESUME works ✓
- PWA: manifest/icons/apple-touch/theme-color present and 200 on dev **and** production
  standalone server (`bun run build` + `server.js` smoke test) ✓
- Mobile 390×844 screenshots: menu / playing / pause / settings (download/screens/v9/) ✓
- Fresh reload console clean; ESLint clean on all touched files; `tsc` clean for the game
  (repo-scaffold files in `examples/`/`skills/` have pre-existing errors outside the build).

### Game bugs found and fixed this round
- **Stuck GRAB button** (mobile, pre-existing): the contextual button could unmount while
  pressed (duck swings out of range) leaving `interact` held — the *next* tap produced no
  edge and was silently dropped. Fixed in the shell (force-clear on prompt hide) and made
  structural (pointer-id sets + guard).
- **Prompt lingering under the win overlay** (cosmetic, pre-existing): the contextual
  GRAB/LET GO button stayed visible after crossing the flag — now cleared on victory.
- **`Swing.place()` per-frame allocations** (perf, pre-existing): 2 `new Vector3` + 1
  `clone()` per rope per settle step ≈ 2k objects/sec — replaced with module scratch
  vectors; `seatAnchor()` reuses a per-swing scratch object.
- Two V0.9 harness logic bugs caught by the harness itself (wrong L3 swing-count
  expectation; a scenario tapping during the release re-grab cooldown — a state the real
  GRAB button never shows) — fixed in the harness, no game changes.

## Performance measurement (honest numbers)

- Headless sandbox rendering is **software-rasterized** (SwiftShader): fill-rate-bound CPU
  rendering, **not representative of any real device GPU**; no real-device measurement was
  possible in this sandbox (no hardware).
- V1.0 snapshot (`scripts/perf-snapshot.mjs`, device-independent metrics):
  - **Desktop 1280×720, High:** L1–L4 = 110–132 draw calls, ~24k triangles
  - **Mobile 390×844, Balanced:** L1–L4 = 95–109 dc, ~22.6k tris (unchanged vs V0.9 budget)
  - **Mobile 390×844, Battery:** 67–82 dc, ~14k tris (shadows off — the big win on weak GPUs)
- **Memory:** `performance.memory.usedJSHeapSize` 23.4 MB → 23.4 MB across 40 level
  transitions (no detectable heap drift).

## Remaining issues / known limitations (V1.0-RC, honest)

- **The APKs were built but never run on real hardware** — the sandbox has no device, no
  `adb` target and no emulator. What IS verified: the APK badging (package/name/version/
  permissions/icon) and that the exact web bundle inside the APK passes the full 19/19
  player journey. What is NOT verified: real-GPU fps, touch latency, notch behavior,
  lifecycle under real Android memory pressure. The debug APK is the artifact to sideload
  for the first real-device check.
- **The improved duck model has NOT been delivered** — no replacement model arrived in
  this cycle (`upload/` contains only the original reference photo). The integrated
  character remains the procedural collectible-figure duck **v4** (also exported to
  `download/duck.glb` as fallback/reference). If a replacement model arrives, integrate it
  behind validation (format/scale/orientation/animation-compat) and keep v4 as the
  fallback until then.
- **Release APK is unsigned** — it needs a keystore + signing config before distribution;
  no store upload was performed (no authorization).
- Feel-tuning judgments are based on screenshots and sim review, **not human playtest
  sessions**.
- Music is a single gentle generative loop — no per-region themes or stingers (deliberate
  scope: one mood, zero asset weight).
- The L4 **expert shortcut** release window remains genuinely tight (expert-only, verified).
- On 390px-wide phones the "BEST" star tag can slightly crowd the level chip (cosmetic).
- Taps on the GRAB button during a re-grab cooldown are ignored by design (the button is
  hidden then); the sim harness must emulate that visibility (documented in the v9 harness).
- Confetti still uses individual meshes (shared geometry + shared materials); a pooled
  InstancedMesh would shave a few more draw calls during bursts (micro-optimization, not
  scheduled).
