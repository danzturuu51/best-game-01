// Enemies: what each wave spawns, and how each kind moves and attacks.
// Spawn positions are picked on the arena edge, away from the player, with a
// short telegraph (the enemy fades in) so nothing ever appears on top of you.

import { ENEMIES, FIELD, WAVE_GROWTH, WAVES } from './config.js';
import { pick, randomAngle } from './random.js';

/** The spawn queue for a wave: an ordered list of kinds, shuffled. */
export function buildWaveQueue(wave, random) {
  const table = WAVES[Math.min(wave - 1, WAVES.length - 1)];
  const queue = [];
  for (const [kind, count] of Object.entries(table)) {
    if (kind === 'gap') continue;
    for (let i = 0; i < count; i += 1) queue.push(kind);
  }
  if (wave > WAVES.length) {
    const extra = (wave - WAVES.length) * WAVE_GROWTH.extraPerWave;
    const kinds = ['mote', 'dart', 'spitter', 'splitter', 'bulwark'];
    for (let i = 0; i < extra; i += 1) queue.push(kinds[Math.floor(random() * kinds.length)]);
  }
  // Shuffle so the wave never arrives in one predictable clump.
  for (let i = queue.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  return queue;
}

export function waveGap(wave) {
  const table = WAVES[Math.min(wave - 1, WAVES.length - 1)];
  return Math.max(WAVE_GROWTH.gapFloor, table.gap - (wave - 1) * 0.02);
}

/** Wave scaling: later waves are tougher and a touch faster. */
export function waveScale(wave) {
  return {
    hp: 1 + (wave - 1) * WAVE_GROWTH.hpPerWave,
    speed: 1 + (wave - 1) * WAVE_GROWTH.speedPerWave,
  };
}

/** A fresh enemy of the given kind, placed on the arena edge. */
export function spawnEnemy(kind, wave, random, playerX, playerY) {
  const def = ENEMIES[kind];
  const scale = waveScale(wave);
  const margin = 60;
  let x;
  let y;
  // Pick an edge point at least 260px from the player.
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const side = Math.floor(random() * 4);
    if (side === 0) { x = random() * FIELD.width; y = -margin; }
    else if (side === 1) { x = FIELD.width + margin; y = random() * FIELD.height; }
    else if (side === 2) { x = random() * FIELD.width; y = FIELD.height + margin; }
    else { x = -margin; y = random() * FIELD.height; }
    if (Math.hypot(x - playerX, y - playerY) > 260) break;
  }
  return {
    kind,
    x, y,
    vx: 0, vy: 0,
    radius: def.radius,
    hp: def.hp * scale.hp,
    maxHp: def.hp * scale.hp,
    speed: def.speed * scale.speed * (0.9 + random() * 0.2),
    damage: def.damage,
    score: def.score,
    xp: def.xp,
    color: def.color,
    behavior: def.behavior,
    angle: randomAngle(random),
    // Telegraph: the enemy fades in and cannot be hit or hit you yet.
    spawnT: 0.5,
    shootT: 1 + random() * 1.5,
    wobble: random() * Math.PI * 2,
    flash: 0,
    dead: false,
  };
}

/**
 * Steer one enemy for a step. Returns 'shoot' when a spitter should fire, plus
 * the shot's direction; the world turns that into an enemy bullet.
 */
export function steerEnemy(enemy, player, dt, random) {
  const def = ENEMIES[enemy.kind];
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = dx / dist;
  const ny = dy / dist;

  if (enemy.behavior === 'chase') {
    enemy.vx = nx * enemy.speed;
    enemy.vy = ny * enemy.speed;
  } else if (enemy.behavior === 'dart') {
    // Darts weave: they chase, but wobble sideways on a sine, so their path
    // is hard to lead and they never sit still in your crosshair.
    enemy.wobble += dt * 6;
    const weave = Math.sin(enemy.wobble) * 0.7;
    const px = -ny * weave;
    const py = nx * weave;
    enemy.vx = (nx + px) * enemy.speed;
    enemy.vy = (ny + py) * enemy.speed;
  } else if (enemy.behavior === 'spit') {
    // Spitters hold their distance: close in when far, back off when near,
    // and strafe sideways so they are a moving target.
    enemy.wobble += dt * 1.4;
    let mx = 0;
    let my = 0;
    if (dist > def.range) { mx = nx; my = ny; }
    else if (dist < def.range * 0.6) { mx = -nx; my = -ny; }
    const strafe = Math.sin(enemy.wobble) > 0 ? 1 : -1;
    mx += -ny * strafe * 0.6;
    my += nx * strafe * 0.6;
    const len = Math.hypot(mx, my) || 1;
    enemy.vx = (mx / len) * enemy.speed;
    enemy.vy = (my / len) * enemy.speed;
    enemy.shootT -= dt;
    if (enemy.shootT <= 0 && dist < def.range + 120) {
      enemy.shootT = def.shotInterval * (0.85 + random() * 0.3);
      return { shoot: true, x: nx, y: ny, speed: def.shotSpeed };
    }
  }
  enemy.angle = Math.atan2(enemy.vy, enemy.vx);
  return null;
}

/** What a splitter leaves behind when it dies. */
export function splitChildren(enemy, random) {
  const def = ENEMIES[enemy.kind];
  if (!def.splitsInto) return [];
  const children = [];
  for (let i = 0; i < def.splitCount; i += 1) {
    const angle = randomAngle(random) + (i * Math.PI * 2) / def.splitCount;
    children.push({
      kind: def.splitsInto,
      x: enemy.x + Math.cos(angle) * 18,
      y: enemy.y + Math.sin(angle) * 18,
      vx: Math.cos(angle) * 140,
      vy: Math.sin(angle) * 140,
      radius: ENEMIES[def.splitsInto].radius,
      hp: ENEMIES[def.splitsInto].hp,
      maxHp: ENEMIES[def.splitsInto].hp,
      speed: ENEMIES[def.splitsInto].speed,
      damage: ENEMIES[def.splitsInto].damage,
      score: ENEMIES[def.splitsInto].score,
      xp: ENEMIES[def.splitsInto].xp,
      color: ENEMIES[def.splitsInto].color,
      behavior: ENEMIES[def.splitsInto].behavior,
      angle,
      spawnT: 0.15,
      shootT: 1,
      wobble: random() * Math.PI * 2,
      flash: 0,
      dead: false,
    });
  }
  return children;
}
