# BUILD LOG — best-game-01 / VOIDPULSE (target: rank 1, $400)

Target: not just a valid entry — beat the starter (Block Dodger) and the house games
on every judge criterion. Every iteration is recorded here: what was tried, what
the checks said, what failed and why, what was fixed.

## 0. Setup & rules (17 Nov 2026, ~12:55 WIB)

- Competition: best-game-01 "Make the best game". Prize $1,000 total, FULLY ESCROWED
  on-chain (1st $400, 2nd $200, 3rd $120, 4th–10th $40). No entry fee.
- Deadline: entries close 2026-11-18T18:00:00Z = 19 Nov 2026 01:00 WIB.
  Build started 17 Nov ~12:55 WIB — about 12 hours of runway.
- Kit: ~/workspace/makefun/best-game-01-kit/ — RULES.txt (412 lines) + competition.yaml
  read in full. Starter studied (Block Dodger: dodge-and-collect, title/score/lives/
  levels/game-over/restart, flat colours, no sound).
- Session began after the opening (2026-11-15T18:00:00Z), so thinking_in_window is fine.
- Repo: ~/workspace/makefun/best-game-01/ (local git only; parent handles GitHub
  repo + upload + submit). LICENSE + vendor/makefun-game.ts copied from starter
  (kit library, required unchanged; starter lines are excluded from the transcript
  gate's counted lines). main.ts and serve.ts are written by hand here (authored).
- Node v24.22.1. Brave headless HANGS on this VM — screenshots via
  chrome-headless-shell from the Playwright cache (lesson from token-radar-01).

## 1. Game choice — VOIDPULSE, a neon twin-stick arena survival shooter

Why this genre, against the judge's five criteria:
1. Complete game: goal (survive waves, score), rules, responsive controls
   (WASD + mouse aim + fire + dash), win/lose/score (waves cleared, score,
   game over), start + restart, HUD (HP, XP, wave, score, dash) — all visible
   in the 4 screenshots (title / combat / level-up choice / game over).
2. Fun and depth: wave escalation, 5 enemy types with different behaviour,
   XP shards + level-up choices (10 upgrades, 3-card draft), kill-streak
   multiplier, dash as a skill move. A core loop worth repeating.
3. Feel and polish: fixed 1/60 s simulation, particles, screen shake, floating
   damage numbers, hit flashes, spawn telegraphs, procedural WebAudio SFX
   (no asset files), pause, mute, best-score persistence.
4. Look and originality: original neon-void art direction (deep indigo field,
   cyan/magenta/amber palette, pre-rendered glow sprites, starfield + nebula),
   original name and enemy names. Nothing copied from a commercial game.
5. Structure: one file per job (config, random, audio, input, particles,
   enemies, upgrades, world, render, shots, main), functions named for what
   they do — the source outline is most of what the judge reads of the code.

Rejected alternatives:
- Tower defence: too much UI chrome; screenshots read badly when shrunk.
- Platformer: level authoring + physics tuning would eat the 12-hour budget.
- Puzzle: hard to make visually loud and hard to show "a whole loop" in 4 shots.
- A Breakout/Pong clone: too close to the starter's simplicity; would lose to
  any house game with more depth.

## 2. Files (game/src/, one job each)

- config.js — all tuning numbers, palette, enemy definitions, upgrade definitions.
- random.js — seeded mulberry32 RNG (repeatable screenshots).
- audio.js — WebAudio synth SFX, lazy init on first gesture, mute toggle.
- input.js — keyboard + mouse state, one-shot action flags, card keys.
- particles.js — pooled particles, shockwave rings, floating texts.
- enemies.js — per-wave spawn table, per-type steering and attacks.
- upgrades.js — upgrade pool, 3-card draft rolls, apply effects.
- world.js — simulation: player, bullets, enemy bullets, shards, waves,
  collisions, XP/level, score/combo, events.
- render.js — canvas drawing: arena, entities, HUD, upgrade cards, screens.
- shots.js — staged screenshot scenes (?shot=start|play|upgrade|end) with a
  simple autopilot playing the real rules forward, so each frame is a real
  game state and the same seed always gives the same frame.
- main.js — boot, fixed-step loop, screen state machine, best score, shots.

## 3. Screenshot plan (4, cover first by name)

- 1-play.png — mid-combat, wave 3, HUD full, bullets + particles (the cover).
- 2-title.png — title screen over a live ambient arena.
- 3-upgrade.png — level-up 3-card draft overlay (shows choices/depth).
- 4-gameover.png — results screen: score, wave, kills, time, best, restart.
Each 1280x720 JPEG, <=256 KiB, taken from the game's own code in the browser
via chrome-headless-shell (?shot=...&seed=7), never edited or composited.

## 4. Verification plan

- Serve game/ with serve.ts, drive it headless with a small CDP script
  (Node WebSocket client): collect console errors, simulate keys/mouse,
  screenshot all four ?shot scenes, confirm window.__shotReady.
- Playtest the loop end-to-end (title -> play -> level-up -> wave clear ->
  game over -> restart) via the same CDP driver.
- Run main.ts into out/ and the kit check (node cli/makefun.mjs check
  --worktree); fix everything except transcripts_present (parent's job).

## 5. Iterations

### Iteration 1 — first full write (in progress)
- Writing all source files from scratch (authored lines for the transcript gate).

### Iteration 2 — verification session (~13:00 WIB, after the first full write)

#### Tooling
- Served with `node serve.ts --port 8080`. Screenshots/playtests via a small CDP
  driver written for this session (`/tmp/vp-drive.mjs`, NOT in the repo): launches
  `chrome-headless-shell` from the Playwright cache with `--remote-debugging-port`,
  navigates, dispatches real CDP keyboard/mouse input, waits for
  `window.__shotReady`, captures 1280×720 JPEG, prints every console message and
  page error. Brave headless hangs on this VM — confirmed again, not used.
- A debug handle was added for the playtests only: `window.__voidpulse = { world,
  screen, best }` in `runGame()` (3 lines, harmless in production).

#### Bug found by playtesting — audio warning flood (FIXED)
- The first `?shot=play` run printed thousands of
  "The AudioContext was not allowed to start" warnings: `ensure()` created/resumed
  an AudioContext on EVERY sfx call, and a screenshot run has no user gesture.
- Fix (`audio.js`): no AudioContext is created until `unlock()` (first gesture)
  sets an `unlocked` flag; before that every sfx call is a silent no-op. After
  the fix all screenshot runs print zero console messages.

#### Bug found by looking — blink prompts invisible in stills (FIXED)
- Title "CLICK OR PRESS SPACE TO START" and game-over "PRESS R OR CLICK TO FLY
  AGAIN" blink on a timer, so a staged frame could catch them off. Fix: `runShot`
  passes `shot: true` into the renderer and both prompts draw solid in shot mode.
  Verified visible in the final 2-title.jpg and 4-gameover.jpg.

#### Balance/density tuning (from watching the frames)
- First play frame (26 s sim) showed the GAME OVER screen: the autopilot dies by
  wave 5 without ever drafting upgrades (the sim never applied choices). Fix:
  the staging sim now auto-drafts upgrades with a seeded pick
  (`createRandom(seed + 999)`), so the pilot fights like a player who drafts.
- Play frames were still sparse: the pilot clears waves faster than they spawn,
  so any single moment has few enemies alive. Two changes:
  1. Enemy speeds up a little (mote 95→115, spitter 70→80, splitter 70→85,
     bulwark 42→50) and wave gaps ×0.9 — livelier convergence for real players too.
  2. The play scene now simulates 90 s, keeps the step with the most hostiles
     alive, and restores exactly that frame (see below).
- `world.snapshotState()` / `restoreState()` (structuredClone) and
  `particles.snapshot()` / `restore()` were added for this; the play scene
  restores both, so sparks and floating text match the frame. Final cover:
  wave 4, 9 hostiles left, score 1640, combo x3, 4 enemy types visible.
- False alarm, recorded so nobody re-chases it: I first thought
  `particles.step()` was never called (grep for "update" found nothing) — wrong,
  `world.step()` already calls `particles.step(dt)`; the juice works in live play
  and in the sim. No change needed.

#### Live end-to-end playtest (real CDP input, seed 7) — ALL PASS
- Title → Space → play. 15 s of WASD movement + held mouse fire: score 20,
  2 kills, 6 enemies, 4 bullets in flight.
- P → screen `paused`; P again → `play`.
- `debugGrantXp(50)` → draft of 3 cards (level 5); pressing 1 applied a card
  and queued the next draft (50 XP = several pending levels — correct behaviour,
  not a bug: the first test misread it as "pick didn't work").
- Focused retest: 5× key 1 cleared all drafts (`taken: [nova, swift, swift]`),
  then an enemy teleported onto the player at 5 HP → screen `over`,
  `alive: false`; R → fresh run (`play`, wave 1, hp 100, score 0, kills 0).
- Zero console errors across every run.

#### Final screenshots (screenshots/, 1280×720 JPEG, 52–72 KiB each)
- `1-play.jpg` (cover) — wave 4 mid-fight, combo x3. `2-title.jpg` — title +
  controls + start prompt. `3-upgrade.jpg` — LEVEL UP draft, middle card hovered.
  `4-gameover.jpg` — SIGNAL LOST stats + restart prompt. All taken from the final
  code with `?shot=play|start|upgrade|end&seed=7`.

#### Kit check — `node ../best-game-01-kit/cli/makefun.mjs check --worktree`
- PASS: competition_open, snapshot (40 files, 1,121,587 bytes), license_osi (MIT),
  entrypoint (main.ts, node22).
- FAIL (expected, parent's job): transcripts_present — no transcripts uploaded.
- Skipped/at-submission (parent's job): repo_public, repo_owner (.makefun/owner.json),
  repo_created_after_open, commit_in_repo, duplicate_snapshot.
- Extra verification done by hand: `diff -r game out/game` identical; main.ts run
  twice into out/ and out2/ produced byte-identical dossier.json (the grader runs
  it twice and both runs must match); game/ is 12 files, ~80 KB (caps: 993 / 48 MiB).
