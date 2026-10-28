# DUCK ADVENTURE — V2 Final Report

Scope delivered: a reconstructed duck character matching the supplied reference photo, plus one new
fully-built and verified region (Region E — "Starlit Hollow", level index 5). **This is not the full
12–20 stage target** — see §5 and §10 for exactly what shipped and why.

---

## 1. Initial project assessment

Before any changes, the V1.0-RC handoff was audited and a genuine baseline was established:

- `npm install` (853 packages; `bun install` failed in this sandbox — 403s resolving
  `registry.npmjs.com` through the proxy, a dead TLD, so `npm` was used instead).
- `node scripts/rc-runner.mjs` → **20/20** (14 V0.8 scenarios + 6 V0.9 scenarios), run fresh against
  the live dev server, not reused from the handoff's own claims.
- `node scripts/journey.mjs` → **19/19** (full UI-driven player journey).
- `node scripts/robustness.mjs` → **3/3**.
- Read `HANDOFF.md`, `worklog.md`, `README.md` in full, and the entire engine source
  (`Duck.ts`, `Game.ts`, `Physics.ts`, `Swing.ts`, `Level.ts`, `LevelKit.ts`, `levels.ts`,
  `Background.ts`) to understand the architecture before touching anything.
- Two of the project's own test-runner scripts had a hardcoded path from the original dev
  machine (`/home/z/...`) that doesn't exist in this sandbox; fixed via `sed` substitution so the
  project's own regression suite could actually run, exactly as `HANDOFF.md` instructs.

Conclusion at this stage: the codebase was in the state it claimed to be in, the test suites were
real and runnable, and the "never fake a test result" rule could be followed with actual tooling,
not assumptions.

## 2. Reference-image analysis and character changes

Two reference images were supplied: a photo of a white duck ornament on a fabric-strap swing, and a
low-poly stylized render of a duck on a swing. The low-poly image was confirmed (by direct
comparison against files already in the project) to be the **old** reference baked into prior dev
work — not new guidance. The photo is the new reference and the one the rebuild targets.

Comparing the photo against the existing in-game model (procedural geometry in `Duck.ts`, no
imported mesh):

| Feature | Old model | Reference photo | Change made |
|---|---|---|---|
| Torso | Elongated, pronounced rear lift (flight-ready posture) | Compact, rounded, level | Torso x-scale 1.38→1.16, z-scale 0.92→0.96, rear lift 0.34→0.12 |
| Neck | Long, slender S-curve | Short, thick | Shortened/thickened the tapered-tube control points; neck group pulled in and down |
| Head | Smaller, set high on the neck | Large relative to body, set low/forward | Head position dropped (y 0.63→0.37), skull radius 0.24→0.26 |
| Beak | Smaller | Noticeably larger, blunter | Upper/lower beak scales and offsets increased ~10–30% |
| Eyes | Set back, smaller offset | Forward, slightly larger | Offset increased from (0.115, 0.05) to (0.14, 0.08) |
| Wings | Larger, swept, angular | Small, rounded, tucked | Wing shape redrawn smaller/rounder; extrude depth 0.05→0.026; repositioned tighter to the body |
| Tail | Larger, more raised | Small, low, tucked | Lathe profile shrunk, repositioned, rotation reduced |
| Material | Slightly glossier, warmer white | Flatter, cooler-white ceramic/plastic look | Roughness 0.58→0.68, clearcoat 0.26→0.14, wing tint lightened |

Every change was made directly in the procedural geometry builder — there is no mesh asset to swap,
so "rebuild" here means editing the lathe/extrude/tapered-tube parameters that generate the mesh at
runtime. Collision (a simple AABB, fully decoupled from the visual mesh), swing attachment, and all
animation poses were left untouched and re-verified after the change (see §7, §8).

## 3. Final model and asset file paths

- `src/components/game/engine/Duck.ts` — the character itself (all reconstruction edits live here;
  no external model file).
- `scripts/export-duck.ts` — exports the current procedural duck to a standalone glTF for reference/
  external use. Had a dead hardcoded output path from the original dev machine; fixed to resolve
  relative to the script itself. Regenerated: `download/duck.glb` (430.8 KB, reflects the new
  proportions).
- `src/components/game/engine/LevelKit.ts`, `Level.ts`, `levels.ts`, `Background.ts`,
  `GameCanvas.tsx` — the new level/region system described in §4–§6.
- `scripts/game-tests-v11.js` — new committed regression scenarios for the new level (§8).
- `download/screens/v2-duck/` — in-game duck screenshots (idle, run, jump, swing-sit,
  swing-pumped) from the earlier validation pass.
- `download/screens/v2-region-e/` — new QA screenshots of Region E (opening theme, S1 swing, the
  wisp hazard, the stepping-stone, the finale chain area, the flag).

## 4. Gameplay systems improved

- **Hazard system generalized.** The only hazard type before V2 was `thornBurr` — a stationary prop
  with a sinusoidal 1D "patrol" sweep. Added `wispSwarm` (new `OrbitHazardDef`: x, y, radiusX,
  radiusY, speed, phase) as a second, genuinely different hazard archetype — a 2D elliptical orbit —
  built on the same `HazardRT` interface so the existing collision check in `Game.ts`
  (`checkHazards()`, unchanged) handles it for free. `Level.ts` now merges both hazard kinds from a
  level definition's `hazards` and new `wisps` arrays.
- **Theme system extended.** Added a `'hollow'` theme, wired through all three places a theme has to
  be registered for it to actually render correctly end-to-end: `LevelKit.THEMES` (material
  palette), `Background.PALETTES` (sky/hills/clouds), and `GameCanvas.REGION_ACCENT` (HUD accent
  color). Missing any one of these would have produced a visually broken or mismatched region —
  verified all three are present and correct via the screenshots in §3.
- **Everything else reused, not reinvented**, per the brief's instruction to extend the existing
  data-driven architecture rather than add one-off code: platforms, swings (both `frame` and
  `hanging` types), the moving-platform/carrier system, mid-air swing chains, checkpoints, and stars
  all use the exact same `LevelDef`/`LevelKit`/`Level.ts` machinery as L1–L4.

## 5. Levels completed and playable

- **L1–L4 (existing regions): unchanged, still fully verified** — 14/14 scenarios pass, including
  the L4 expert shortcut.
- **L5 — "Starlit Hollow" (Region E): new, fully built and verified playable end-to-end.**
  9 platforms, 6 swings (3 frame + 3 hanging, including two optional mid-air chains), 1 moving
  stepping-stone platform, 3 checkpoints, 8 stars, 1 new hazard (orbiting wisp swarm), full themed
  decor (lanterns, crystals, mushrooms, trees, a flower, a ring gate, a rope bridge, floating rocks).

**Honest scope note:** the brief's planning target was ~12–20 stages, with explicit permission to
"deliver a smaller but fully playable set first" if full scope wasn't achievable. **One new region
was completed and fully verified** — five levels total, not twelve to twenty. This was a deliberate
choice to ship one genuinely new, thoroughly tested, bug-fixed region rather than several shallow or
unverified ones. See §10–§11 for what a next pass would add.

## 6. New mechanics and progression systems implemented

- **Orbiting hazard (wisp swarm).** Unlike the existing patrol hazard (which moves back and forth
  along a line and is dodged by timing a walk), the wisp swarm sweeps a 2D ellipse with a ~6.3-second
  period. The level's own hint text ("time your jump through the gap in its loop") reflects the
  actual intended mechanic: there are phases of the orbit where the ground path underneath it is
  safe, and phases where it isn't. Verified both halves of that claim directly (§8).
- **Optional mid-air swing chains with a safe-route fallback.** Two points in L5 (after S3 and after
  S5) let a skilled release chain directly into the next swing without landing; a player who doesn't
  chain lands on a normal catch-isle platform and picks up the next swing from solid ground instead.
  This mirrors L4's proven pattern (reused, not reinvented) but is new content specific to L5's
  layout and swing geometry.
- **Stepping-stone crossing over the hazard zone** — the moving platform's timing interacts with the
  wisp's orbit (the player has to clear the hazard on foot, then time boarding the stone), tying the
  new hazard and the existing mover system together as one obstacle rather than two unrelated ones.

## 7. Before-and-after comparisons for important changes

**Character.** See the proportion table in §2. Net effect: the in-game duck went from a slim,
flight-postured bird silhouette to a compact, round, ceramic-ornament silhouette, matching the
photo. Confirmed visually in `download/screens/v2-duck/` and again inside the new region in
`download/screens/v2-region-e/01-opening-theme.png` and `02-s1-swing.png`.

**Regression (before V2 work → after V2 work, same suites, both genuinely run this session):**

| Suite | Before | After |
|---|---|---|
| `rc-runner.mjs` (sim scenarios) | 20/20 (14 V0.8 + 6 V0.9) | **23/23** (14 V0.8 + 6 V0.9 + 3 new L5) |
| `journey.mjs` (UI-driven journey) | 19/19 | 19/19 (unchanged, re-verified) |
| `robustness.mjs` | 3/3 | 3/3 (unchanged, re-verified) |
| **Total** | **42/42** | **45/45** |

**Performance (desktop 1280×720 "high" quality tier), draw calls / triangles per level:**

| | L1 | L2 | L3 | L4 | L5 (new) |
|---|---|---|---|---|---|
| High | 121dc/25.6k | 110dc/24.9k | 132dc/25.5k | 122dc/25.5k | 123dc/25.9k |
| Balanced (mobile 390×844) | 95dc/23.8k | 95dc/23.7k | 109dc/23.9k | 101dc/23.9k | 103dc/24.3k |
| Battery (mobile 390×844) | 67dc/14.7k | 67dc/14.6k | 80dc/14.8k | 82dc/15.2k | 82dc/15.4k |

L5 sits squarely within the range of the existing levels at every quality tier — the new region and
hazard do not introduce a performance outlier. JS heap was flat at 23.4MB before and after 40 level
transitions (unchanged from V1.0's own result), i.e. no leak introduced.

## 8. Tests actually performed and their results

All of the following were run against the live dev server in this sandbox this session, via
headless Playwright (pre-installed Chromium), using the project's own debug API
(`window.__duck`). Nothing below is reused or assumed from the original handoff's claims.

- **Baseline (before any change):** `rc-runner.mjs` 20/20, `journey.mjs` 19/19, `robustness.mjs`
  3/3.
- **Duck reconstruction validation:** in-game screenshots across 5 poses (idle, run, jump,
  swing-sit, swing-pumped), full regression re-run after the geometry change — 20/20 / 19/19 / 3/3,
  confirming zero collision/animation regression from a purely cosmetic geometry edit.
- **L5 build and debugging — five real bugs found and fixed via iterative scripted walkthroughs**
  (not guessed at, found by running a Playwright bot through the level and reading exactly where it
  failed):
  1. Teaching-hop gap was 3.0 units (at the edge of max jump range) → tightened to 2.4 units,
     matching L4's proven teaching-hop gap.
  2. The first finale design made a genuinely tight, expert-only release window the *only* path
     forward (discovered by reading L4's own test comments, which flag that exact kind of window as
     expert-only there) → redesigned around L4's proven double-chain pattern with a safe-route
     fallback, keeping the tight window as an optional bonus shortcut instead of mandatory.
  3. My own verification script (not the game) had a bug — it never released the `right` key after
     boarding the moving platform, so the bot walked off under its own power instead of riding it.
  4. A platform's height (`top: 0.15`) was close enough to the moving platform's height that the
     "am I on the mover" check produced a false positive while still standing on solid ground —
     diagnosed with a custom per-step trace script, fixed by matching L4's exact value (`0.1`).
  5. A checkpoint's activation margin was missed by 0.14 units because the platform's left edge was
     too far right for the bot's actual landing spot — fixed by widening the platform's collision
     box (not moving the landing spot).
- **Hazard verification:** confirmed the wisp swarm is a *real* hazard, not cosmetic — standing
  directly under its orbit center for one full period produces a hit (duck snaps back to the active
  checkpoint, exactly matching `Game.ts`'s `respawn(true)` behavior), while standing outside its
  orbit's horizontal reach for a full period is untouched.
- **Star placement audit — one real content bug found and fixed after the level was otherwise
  "done."** Running the full walkthrough honestly reported 7/8 stars, not 8/8. Rather than accept
  that, traced the actual swing+flight path of the S1 swing (the arc the two nearby stars were meant
  to sit on) and found one star placed 7.9 units from its swing's pivot — nearly 2.5× the swing's own
  arm length, i.e. nowhere near anywhere the duck can actually be — and a second star with only a
  0.1-unit collection margin (too tight to rely on). Both were repositioned onto the traced,
  verified-reachable path. Re-ran the full suite after the fix: still 23/23, now with 8/8 stars
  confirmed collected by the committed test.
- **Final committed regression (this session's last run, after all fixes):**
  `rc-runner.mjs` → **23/23**, `journey.mjs` → **19/19**, `robustness.mjs` → **3/3**. The new L5
  scenarios (`l5_full`, `l5_checkpoint`, `l5_hazard`) are now part of `scripts/game-tests-v11.js`,
  wired into `rc-runner.mjs`'s own suite — so this is no longer "my scratch scripts said it worked,"
  it's "the project's own regression suite covers it," per the architecture's own stated requirement
  that a new level needs its own automated scenario.
- **What was *not* independently re-verified:** L1–L4's own star placements were not re-audited
  (they were untouched V1.0 content, already passing their own tests, and out of scope for this
  pass).

## 9. Android build status and performance findings

- The Capacitor 8 wrapper (`android-build/`) is present and committed, exactly as the handoff
  describes.
- A JDK 21 is available in this sandbox, but the Android SDK is not, and **this sandbox's network
  egress allowlist refuses `dl.google.com`** (confirmed by a direct attempt — `CONNECT tunnel failed,
  response 403`, the proxy's own refusal message). This is a sandbox constraint, not a project
  problem: the exact documented command in `HANDOFF.md` (`curl ... commandlinetools-linux-...zip`)
  would work in an environment with that domain reachable.
- **The APK was not rebuilt this session.** What *was* done: refreshed the static web export that
  the Capacitor wrapper packages (`NEXT_EXPORT=1 npx next build`, copied into `android-build/www/`),
  so it reflects the V2 duck and the new region, instead of shipping a build that's two days stale.
  Once the SDK is available (locally, or in a different environment), `cd android-build/android &&
  ./gradlew assembleDebug` builds the actual APK from this already-current web bundle — no further
  web-side work is needed first.
- Performance findings are in §7's table. In short: no regression, L5 is in line with the existing
  levels at every quality tier, and the heap is stable across repeated level transitions.
- **Real-device Android testing was not done** (no hardware in this sandbox) — this was already true
  of V1.0-RC and remains true here; it is not a new gap introduced by V2.

## 10. Remaining bugs and limitations

- **Scope:** one new region (L5) shipped, not the 12–20 stage planning target. The brief explicitly
  permits this ("deliver a smaller but fully playable set first... clearly indicate what has been
  implemented versus what remains") — this report is that distinction.
- **Mechanic novelty:** the new hazard type (orbiting swarm) and new theme are genuinely new; the
  underlying traversal mechanics in L5 (platforms, swings, chains, a mover) are reused/extended from
  L1–L4 rather than being a third, fundamentally new mechanic. The brief asked for "genuine new
  content/mechanics, not just padding" — one new mechanic (the hazard) was delivered; a second
  distinct mechanic type was not attempted in this pass.
- **APK not rebuilt** this session (sandbox network constraint, not a code defect) — see §9.
- **No real-device testing** (pre-existing limitation, not new to V2).
- **L1–L4 content (stars, decor, etc.) was not re-audited** for the same class of placement bug found
  and fixed in L5 — they were untouched and already passing their own tests, but that is "tests
  still pass," not "re-audited against this session's standard."

## 11. Recommended next steps

1. Build additional regions toward the 12–20 stage target, reusing the now-proven pattern from L5
   (data-driven `LevelDef` + a genuinely new hazard or mechanic per region, verified with a scripted
   walkthrough *before* declaring it done, the way the star-placement bug was caught here).
2. Add at least one more genuinely new mechanic type (not another hazard/swing/mover variant) — e.g.
   a timed object the duck can push or ride that isn't sinusoidal, or a player ability that changes
   with context — to meet the brief's "genuine new mechanics" bar more fully.
3. Get the APK actually built and sanity-checked (the web bundle is current and ready; this just
   needs an environment with reachable `dl.google.com`) and get at least one real-device smoke test.
4. If more regions are added, extend `scripts/game-tests-v11.js` (or a new versioned file following
   the same convention) with their own `l{n}_full` / `l{n}_checkpoint` / `l{n}_hazard` scenarios and
   wire them into `rc-runner.mjs`, the same way L5 was — so "is it reachable" and "does the hazard
   actually hurt you" stay committed, automated facts rather than one-off claims.
