# Duck Adventure — V0.9

A charming, **level-based 2.5D fantasy adventure** starring a smooth, collectible-toy white
duck, built for mobile (Android-first) play in the browser. The duck matches the supplied
ornament reference: long elegant neck rising from the chest with a gentle S-sweep, softly
rounded head, a properly sculpted orange bill, glossy bead eyes with catchlight, folded
wings that hug the flank, a perky lifted tail blended into the silhouette, and stubby orange
legs with webbed feet.

**V0.9 is the release-readiness pass**: the game now has a complete session shell — main
menu → play → pause → settings → level picker → completion — generative ambient **music**,
a **settings screen where every control actually works** (SFX/music volume, vibration,
graphics tier — all persisted), hardened **save integrity** (corrupt data can never crash
the game), Android-grade **touch robustness** (multi-finger-safe buttons, no stuck inputs,
safe-area-aware HUD, backgrounding auto-pause), a **PWA manifest + generated launcher
icons** for the Android packaging path, a graceful **WebGL fallback**, and targeted
performance work (zero per-frame allocations in the swing renderer, shared-particle
materials, live graphics tiers). The duck model, animation, physics constants, all four
regions and their verified reachability are preserved untouched.

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
scripts/game-tests-v9.js     NEW: pause/resume, respawn-while-paused, quality tiers,
                             level-switch leak loop, multi-touch buttons, stuck-tap guard
scripts/gen-icons.mjs        NEW: sharp-based launcher icon generation
scripts/export-duck.ts       exports the duck to download/duck.glb
download/screens/v9/         V0.9 verification screenshots
```

## Android packaging

### TWA (recommended — no engine wrapper needed)
The game is a PWA, so the Android app is a Trusted Web Activity generated from the manifest:

```bash
bunx @bubblewrap/cli init --manifest https://YOUR-HOST/manifest.webmanifest
# prompts: application id (e.g. com.duckadventure.app), version code/name (1 / 1.0.0),
# display mode standalone, theme color #fff2d2 — then:
bunx @bubblewrap/cli build          # produces app-release-signed.apk (+ .aab via --skipPwaValidation)
bunx @bubblewrap/cli install        # adb install to a connected device
```

Notes: `display: standalone`, `orientation: any` (portrait verified), icons 192/512 +
maskable, **no permissions**, `theme_color`/`background_color` #fff2d2. Version
code/versionName live in the Bubblewrap `twa-manifest.json` per release. Debug builds:
`bunx @bubblewrap/cli build --skipPwaValidation --manifest ... ` with the debug keystore.

### Capacitor (alternative)
```bash
bun add -d @capacitor/cli && bun add @capacitor/core @capacitor/android
npx cap init "Duck Adventure" com.duckadventure.app --web-dir=.next/static
bun run build && npx cap add android
npx cap open android   # Build > Generate Signed APK/AAB
```

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

- Headless sandbox rendering is **software-rasterized** (SwiftShader): measured ~4 fps at
  1280×720 — fill-rate-bound CPU rendering, **not representative of any real device GPU**;
  no real-device measurement was possible in this sandbox.
- Scene budget at the mobile viewport 390×844 (Balanced): **L1 94 / L4 101 draw calls**,
  ~22.6–22.7k triangles, 1024² shadow map, DPR ≤ 1.75, particles ≤ 60. High tier adds a
  2048² shadow map and DPR ≤ 2. Battery tier: shadows off, DPR ≤ 1, particles ≤ 40,
  **−19 draw calls** measured.
- Draw-call deltas vs V0.8 at the same viewport: **slightly better** (101 vs 104 on L4),
  confirming the shell additions cost nothing in the scene.

## Remaining issues / known limitations

- **No Android device testing was performed** (no device/SDK in the sandbox — `gradle`,
  `sdkmanager` and `ANDROID_HOME` are absent; only `java` exists). The TWA commands above
  are documented but **unexecuted**; no APK was produced or claimed. Real-device fps,
  touch feel and notch behavior remain unverified on hardware.
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
