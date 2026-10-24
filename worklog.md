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
