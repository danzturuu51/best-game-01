// The screenshot scenes behind ?shot=start|play|upgrade|end. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by a
// simple autopilot (aim at the nearest hostile, fire, keep clear of crowds, chase
// shards when it is safe), so the frame is what a real game looks like and the
// same seed always gives the same frame.

import { FIELD, STEP } from './config.js';
import { createRandom } from './random.js';
import { EVENT_LEVELUP, EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

/** A scripted stand-in for the real input, driven by the autopilot each step. */
function scriptedInput() {
  const input = {
    move: { x: 0, y: 0 },
    mouse: { x: FIELD.width / 2, y: FIELD.height / 2 - 200 },
    firing: false,
    dashQueued: false,
    moveVector() {
      return this.move;
    },
    takeDash() {
      const taken = this.dashQueued;
      this.dashQueued = false;
      return taken;
    },
  };
  return input;
}

/**
 * Steer the ship for one step. `reckless` plays like a hurried player: it
 * charges the nearest hostile and never dashes, so it is caught out once the
 * swarm grows — that is what the end scene needs.
 */
function autopilot(state, input, reckless) {
  const player = state.player;
  if (!player.alive) return;
  let nearest = null;
  let nearestDist = Infinity;
  for (const enemy of state.enemies) {
    if (enemy.dead || enemy.spawnT > 0) continue;
    const d = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (d < nearestDist) { nearestDist = d; nearest = enemy; }
  }
  let nearestShard = null;
  let shardDist = Infinity;
  for (const shard of state.shards) {
    if (shard.dead) continue;
    const d = Math.hypot(shard.x - player.x, shard.y - player.y);
    if (d < shardDist) { shardDist = d; nearestShard = shard; }
  }
  // Aim at the nearest hostile and keep firing: ammo is free, and a busy
  // frame reads better in a screenshot.
  if (nearest) {
    input.mouse.x = nearest.x;
    input.mouse.y = nearest.y;
    input.firing = nearestDist < 620;
  } else {
    input.firing = false;
  }
  // Move: away from a crowd, toward shards when safe, else toward the fight.
  let tx = FIELD.width / 2;
  let ty = FIELD.height / 2;
  let crowded = 0;
  for (const enemy of state.enemies) {
    if (enemy.dead || enemy.spawnT > 0) continue;
    if (Math.hypot(enemy.x - player.x, enemy.y - player.y) < 150) crowded += 1;
  }
  if (reckless) {
    if (nearest) { tx = nearest.x; ty = nearest.y; }
  } else if (crowded >= 3) {
    // Flee from the crowd's centre, and dash out of it.
    let cx = 0;
    let cy = 0;
    let n = 0;
    for (const enemy of state.enemies) {
      if (enemy.dead || enemy.spawnT > 0) continue;
      if (Math.hypot(enemy.x - player.x, enemy.y - player.y) < 200) {
        cx += enemy.x; cy += enemy.y; n += 1;
      }
    }
    if (n > 0) {
      tx = player.x + (player.x - cx / n);
      ty = player.y + (player.y - cy / n);
    }
    if (player.dashCooldownT <= 0) input.dashQueued = true;
  } else if (nearestShard && shardDist < 320) {
    tx = nearestShard.x;
    ty = nearestShard.y;
  } else if (nearest) {
    // Hold a firing distance: close in when far, back off when point blank —
    // and drift toward the arena centre, so the fight (and the screenshot
    // frame) stays where the swarm converges instead of at an edge.
    const dx = nearest.x - player.x;
    const dy = nearest.y - player.y;
    const d = Math.hypot(dx, dy) || 1;
    const want = 260;
    tx = player.x + (dx / d) * (d - want);
    ty = player.y + (dy / d) * (d - want);
    tx = tx * 0.55 + (FIELD.width / 2) * 0.45;
    ty = ty * 0.55 + (FIELD.height / 2) * 0.45;
  }
  const mx = tx - player.x;
  const my = ty - player.y;
  const len = Math.hypot(mx, my);
  input.move.x = len > 8 ? mx / len : 0;
  input.move.y = len > 8 ? my / len : 0;
}

/**
 * Set `world` to the named scene (start, play, upgrade or end; any other name is
 * start) and return the screen to draw over it, the best score to show, and any
 * draft choices to overlay.
 */
export function stageShot(name, world, seed = 7, particles = null) {
  const input = scriptedInput();
  // The pilot drafts upgrades as it earns them (a fixed seed, so the same
  // seed always gives the same frame): a pilot that never drafts would fight
  // wave 4+ on base stats and die before the scene gets busy.
  const pickRandom = createRandom(seed + 999);
  if (name !== 'play' && name !== 'upgrade' && name !== 'end') {
    world.seedAmbient();
    return { screen: SCREEN_TITLE, best: 0, choices: null };
  }
  world.beginRun();
  const reckless = name === 'end';
  // Play is the busiest real moment of a fight: simulate forward and keep a
  // snapshot of the step with the most hostiles alive, then restore exactly
  // that frame. Upgrade gets longer so the pilot can earn its first draft;
  // end plays until the pilot dies.
  if (name === 'play') {
    const maxSteps = 90 / STEP;
    let bestSnapshot = null;
    let bestParticles = null;
    let bestCount = -1;
    for (let index = 0; index < maxSteps; index += 1) {
      autopilot(world.state, input, false);
      const events = world.step(STEP, input);
      if (world.state.choices) {
        world.applyChoice(Math.floor(pickRandom() * world.state.choices.length));
      }
      if (!world.state.player.alive) break;
      const alive = world.state.enemies.length;
      if (world.state.time > 20 && alive > bestCount) {
        bestCount = alive;
        bestSnapshot = world.snapshotState();
        if (particles) bestParticles = particles.snapshot();
      }
      if (events & EVENT_OVER) break;
    }
    if (bestSnapshot) {
      world.restoreState(bestSnapshot);
      if (particles && bestParticles) particles.restore(bestParticles);
    }
    return { screen: SCREEN_PLAY, best: world.state.score, choices: null };
  }
  const limit = name === 'end' ? 600 : 150;
  for (let index = 0; index < limit / STEP; index += 1) {
    autopilot(world.state, input, reckless);
    const events = world.step(STEP, input);
    if (name === 'upgrade' && (events & EVENT_LEVELUP)) {
      return { screen: SCREEN_PLAY, best: world.state.score, choices: world.state.choices };
    }
    if (world.state.choices) {
      world.applyChoice(Math.floor(pickRandom() * world.state.choices.length));
    }
    if ((events & EVENT_OVER) || !world.state.player.alive) break;
  }
  if (name === 'upgrade') {
    // The pilot never levelled in the time allowed: grant the XP directly so
    // the draft still shows over the fight as it stands.
    world.debugGrantXp(99);
    return { screen: SCREEN_PLAY, best: world.state.score, choices: world.state.choices };
  }
  const over = !world.state.player.alive;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score, choices: null };
}
