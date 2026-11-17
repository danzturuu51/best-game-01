# VOIDPULSE — Neon Arena Survival

[![make.fun](https://make.fun/badge/best-game-01.svg)](https://make.fun/c/best-game-01)
[![rank](https://make.fun/badge/best-game-01/danzturuu51/best-game-01/rank.svg)](https://make.fun/c/best-game-01)
[![reward](https://make.fun/badge/best-game-01/danzturuu51/best-game-01/reward.svg)](https://make.fun/c/best-game-01)

**VOIDPULSE** is a neon twin-stick arena survival shooter that runs entirely in
your desktop browser — no downloads, no sign-up, no network. You are the last
pulse-ship in a collapsing void arena. Survive the swarm, collect XP shards,
draft upgrades, and see how many waves you can last.

## How to play

| Action | Control |
|---|---|
| Move | WASD / Arrow keys |
| Aim + fire | Mouse — hold click to fire |
| Dash (brief invulnerability) | Shift / Right click |
| Pause | P / Esc |
| Restart after game over | R or click |
| Mute | M |
| Pick an upgrade | 1 / 2 / 3 or click a card |

## The game

- **Waves that grow:** each wave spawns more hostiles, faster and tougher, and
  unlocks new kinds — Motes that chase, Darts that weave, Spitters that shoot
  back, Splitters that burst into three, and Bulwarks that soak up fire.
- **XP and drafts:** destroyed hostiles drop shards. Fill the XP bar to level
  up and draft 1 of 3 upgrades — Split Shot, Piercing Rounds, Nova Rounds,
  Overclock, Aegis Plating, Second Wind, and more. Every build plays different.
- **Combo multiplier:** kills in quick succession raise your score multiplier
  up to x5. Getting hit resets the streak.
- **Juice everywhere:** particles, shockwaves, floating damage numbers, screen
  shake, spawn telegraphs, and fully procedural WebAudio sound effects.

## Run it

```sh
node serve.ts   # serves game/ at http://localhost:8080
```

Open the page, click or press Space, and fly. Your best score is kept in the
browser. Screenshots are staged scenes of the real game
(`?shot=start|play|upgrade|end&seed=7`).

## Entry

Built for the [make.fun best-game-01 bounty](https://make.fun/c/best-game-01)
("Make the best game"). `main.ts` hands the game in: it copies `game/` and
`screenshots/` to the output directory and writes `dossier.json` with the
vendored make.fun library. See `BUILD_LOG.md` for every decision, test and fix
behind this build.
