# Project Duck — Worklog

---
Task ID: 1
Agent: main (Z.ai)
Task: Phase 1 — inspect repo/reference image, choose engine; Phases 2-9 — build Project Duck V0

Work Log:
- Inspected repo: empty (no engine present); inspected supplied reference image (low-poly white duck on a swing, dark green gradient bg) at /home/z/my-project/upload/pasted_image_1792868182553.png
- Verified: no Godot runtime in sandbox (cannot run/verify Godot project); Node v24 + Next.js scaffold available
- Asked user 6 clarifying questions; answers: Web 2.5D (Three.js) playable, sunny meadow palette, bead eyes + catchlight, left/right button touch UI, tiny synth SFX, respawn at start
- Initialized fullstack env, installed three@0.186 + @types/three
- Built engine modules: Physics.ts (substepped AABB axis-separated controller), Input.ts, Sfx.ts (WebAudio synth), Duck.ts (procedural reference-matched duck + animation), Swing.ts (pendulum + rounded-box helper), Background.ts (sky/hills/clouds), Level.ts (8 platforms, obstacle, decor, flag), Game.ts (fixed-timestep loop, controller, camera, swing logic, debug hook), GameCanvas.tsx (touch UI with pointer capture), rewrote page.tsx/layout.tsx/globals.css
- Fixed lint issues (react-hooks/refs, immutability) via game-instance state + toggleMute()
- Browser verification loop (agent-browser): idle/run/jump screenshots + state assertions via window.__duck debug hook
- Fixed PCFSoftShadowMap deprecation, grey clouds (Basic material, fog off), duck proportions (bigger head/plumper body/longer beak for reference match)
- Swing tuning: aligned-direction pumping (torque x1 when pushing with motion), pump 4.2, max omega 4.2, +1.0 forward kick on release, momentum-preserving air control (no accel clamp above max speed when moving same direction), landing platform placed at 3.9m gap (requires the swing; verified crossing: released theta 0.74 omega 3.2 -> landed x 44.17 onGround)
- Verified victory flag trigger + celebration overlay; mobile portrait 390x844 layout; kill-plane respawn; console clean; ESLint clean
- Exported reusable duck asset to download/duck.glb (FileReader shim for bun GLTFExporter)
- Wrote README.md (run instructions, engine choice, Android/Capacitor path, features, tests, remaining issues)

Stage Summary:
- Deliverable: playable 2.5D duck platformer at / (Next.js + Three.js), all V0 phases implemented
- Key artifacts: src/components/game/engine/* (8 modules), GameCanvas.tsx, download/duck.glb, download/screens/*.png (11 verification shots), scripts/export-duck.ts, README.md
- Decisions: Three.js over Godot (verifiability in sandbox), custom kinematic controller over physics lib (deterministic, tunable), momentum-preserving air movement so swing releases feel right

---
Task ID: 2
Agent: main (Z.ai)
Task: Project Duck V0.2 — swing-first gameplay, character redesign, level reconstruction

Work Log:
- Inspected V0 code + screenshots; diagnosed: duck too small/short-necked, platform green merged into hills at same depth, lollipop trees, swing froze after release, running dominated gameplay
- Rebuilt Duck.ts: smooth lathe torso (pear profile), custom tapered-tube neck (long/elegant), lathe beak halves (big friendly scoop), MeshPhysicalMaterial + clearcoat, teardrop wings on side pivots, webbed feet from extruded shapes; root scale 1.14 so the duck is the star; normalized normals for clean GLB export
- Animation: neck counter-sway, wing flaps (air/hold-rope/celebrate), pendulum leg lag, pump rocking, landing head-nod spring, curiosity tilts, victory squint, wind streaks, grab sparkles
- Rebuilt Swing.ts: A-frame playground legs (readable side silhouette), thicker ropes, plank-groove seat, pulsing grab-range ring, seat bump on grab, breeze sway while idle; fixed the V0 bug where the swing froze mid-air after release (settle now actually called)
- Rebuilt Level.ts: 3 floating meadow islands (two-tone grass cap + lit rim + earth body + hanging cone bottom + dark inverted-hull outlines), 2 swings (L 3.1 / 3.35), sandy mound, arrow sign, flag, decor behind play plane; removed old 8-platform layout
- Rebuilt Background.ts: 3 hill rings (progressively paler), soft sun with parallax, cloud sea below gaps, toneMapped:false for crisp whites, tuned fog
- Game.ts: multi-swing nearest-grabbable selection, 2.1u grab magnet, checkpoint system (fresh landings), swing-aware camera (pull-back + down-range look), portrait camera fit, teaching tips callback
- Physics.ts fixes: (1) ground probe ate landing events — now snaps+emits landed; (2) corner forgiveness in x-collision — no more permanent jams on ledge corners (verified mound pass)
- Verified in headless browser: grab A (omega 2.6 on catch), pump to 4.4, release crosses 5.2m gap, land x 17.2; swing B cross; checkpoint updates (16/27.5/32.4) + respawn-at-checkpoint verified; full continuous playthrough grab A -> cross -> grab B -> cross -> mound -> flag -> won; grab ring + LET GO UI verified; mobile 390x844 verified; console clean; lint clean
- Re-exported download/duck.glb (210 KB); updated README.md to V0.2
- Iterated duck proportions via 4 zoomed screenshot rounds (beak size, wing placement, neck slimming, head scale)

Stage Summary:
- Deliverable: swing-first V0.2 at / — run/jump are supporting moves, the two-swing rhythm (grab/pump/release/fly/land) is the core loop, both crossings + flag verified end-to-end
- Key fixes: landing-event eating (physics), swing freeze after release, ledge-corner jams, hills swallowing platforms (layered depth + outlines + color separation)
- Artifacts: download/screens/v2-*.png (14 verification shots), download/duck.glb, README.md V0.2
