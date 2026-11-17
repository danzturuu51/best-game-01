// VOIDPULSE simulation: the player, bullets, enemies, shards, waves, collisions,
// XP and levels, score and combo. Pure logic — no drawing here. The renderer
// paints whatever this state holds, and the audio/particles objects are called
// here so every action has feedback at once.

import { COMBO, ENEMIES, FIELD, PLAYER, STEP, WAVE_BREATHER, xpForLevel } from './config.js';
import { buildWaveQueue, spawnEnemy, splitChildren, steerEnemy, waveGap } from './enemies.js';
import { applyUpgrade, rollChoices } from './upgrades.js';

export const EVENT_NONE = 0;
export const EVENT_HIT = 1;
export const EVENT_OVER = 2;
export const EVENT_LEVELUP = 4;
export const EVENT_WAVECLEAR = 8;

function freshStats() {
  return {
    fireRate: PLAYER.fireInterval,
    damage: PLAYER.bulletDamage,
    projectiles: 1,
    speed: PLAYER.speed,
    maxHp: PLAYER.maxHp,
    dashCooldown: PLAYER.dashCooldown,
    pickupRadius: PLAYER.pickupRadius,
    pierce: 0,
    nova: 0,
    secondWind: false,
  };
}

export function createWorld(random, audio, particles) {
  const state = {
    time: 0,
    wave: 0,
    score: 0,
    kills: 0,
    level: 1,
    xp: 0,
    combo: 0,
    comboT: 0,
    multiplier: 1,
    shake: 0,
    waveState: 'idle', // idle | spawning | fighting | breather
    breatherT: 0,
    spawnQueue: [],
    spawnT: 0,
    pendingLevels: 0,
    choices: null,
    secondWindUsed: false,
    takenUpgrades: [],
    player: null,
    enemies: [],
    bullets: [],
    enemyBullets: [],
    shards: [],
  };

  function resetPlayer() {
    state.player = {
      x: FIELD.width / 2,
      y: FIELD.height / 2,
      vx: 0, vy: 0,
      angle: -Math.PI / 2,
      hp: PLAYER.maxHp,
      stats: freshStats(),
      fireT: 0,
      dashT: 0,
      dashCooldownT: 0,
      invulnT: 0,
      thrust: 0,
      alive: true,
    };
  }

  function reset() {
    state.time = 0;
    state.wave = 0;
    state.score = 0;
    state.kills = 0;
    state.level = 1;
    state.xp = 0;
    state.combo = 0;
    state.comboT = 0;
    state.multiplier = 1;
    state.shake = 0;
    state.waveState = 'idle';
    state.breatherT = 0;
    state.spawnQueue = [];
    state.spawnT = 0;
    state.pendingLevels = 0;
    state.choices = null;
    state.secondWindUsed = false;
    state.takenUpgrades = [];
    state.enemies = [];
    state.bullets = [];
    state.enemyBullets = [];
    state.shards = [];
    resetPlayer();
    particles.clear();
  }

  function startWave() {
    state.wave += 1;
    state.spawnQueue = buildWaveQueue(state.wave, random);
    state.spawnT = 0.4;
    state.waveState = 'spawning';
  }

  function beginRun() {
    reset();
    startWave();
  }

  function dropShards(x, y, value) {
    for (let i = 0; i < value; i += 1) {
      const angle = random() * Math.PI * 2;
      state.shards.push({
        x, y,
        vx: Math.cos(angle) * (40 + random() * 90),
        vy: Math.sin(angle) * (40 + random() * 90),
        value: 1,
        dead: false,
      });
    }
  }

  function killEnemy(enemy, awardScore) {
    enemy.dead = true;
    state.kills += 1;
    state.combo += 1;
    state.comboT = COMBO.window;
    state.multiplier = Math.min(COMBO.maxMultiplier, 1 + Math.floor(state.combo / 8));
    if (awardScore) {
      const gained = enemy.score * state.multiplier;
      state.score += gained;
      particles.text(enemy.x, enemy.y - 10, `+${gained}`, '#ffd166', 15);
    }
    particles.burst(enemy.x, enemy.y, enemy.color, enemy.radius > 24 ? 26 : 14, 260, 0.7, 3.5);
    particles.ring(enemy.x, enemy.y, enemy.color, enemy.radius * 3, 0.35, 3);
    if (enemy.radius >= 30) audio.bigExplode();
    else audio.explode();
    state.shake = Math.min(14, state.shake + (enemy.radius >= 30 ? 9 : 4));
    dropShards(enemy.x, enemy.y, enemy.xp);
    for (const child of splitChildren(enemy, random)) state.enemies.push(child);
  }

  function damagePlayer(amount, fromX, fromY) {
    const player = state.player;
    if (!player.alive || player.invulnT > 0 || player.dashT > 0) return false;
    player.hp -= amount;
    player.invulnT = PLAYER.invulnerable;
    audio.hurt();
    particles.burst(player.x, player.y, '#ff5d5d', 16, 300, 0.5, 3);
    state.shake = Math.min(16, state.shake + 7);
    const dx = player.x - fromX;
    const dy = player.y - fromY;
    const len = Math.hypot(dx, dy) || 1;
    player.vx += (dx / len) * 320;
    player.vy += (dy / len) * 320;
    if (player.hp <= 0) {
      if (player.stats.secondWind && !state.secondWindUsed) {
        state.secondWindUsed = true;
        player.hp = Math.floor(player.stats.maxHp / 2);
        player.invulnT = 2;
        particles.ring(player.x, player.y, '#3ee6ff', 180, 0.7, 5);
        particles.text(player.x, player.y - 30, 'SECOND WIND!', '#3ee6ff', 22);
        audio.levelUp();
        return false;
      }
      player.alive = false;
      particles.burst(player.x, player.y, '#3ee6ff', 40, 380, 1, 4);
      particles.ring(player.x, player.y, '#3ee6ff', 220, 0.8, 5);
      audio.bigExplode();
      audio.gameOver();
      return true;
    }
    return false;
  }

  function fireBullet() {
    const player = state.player;
    const stats = player.stats;
    const spread = 0.14;
    const count = stats.projectiles;
    for (let i = 0; i < count; i += 1) {
      const offset = (i - (count - 1) / 2) * spread;
      const angle = player.angle + offset;
      state.bullets.push({
        x: player.x + Math.cos(angle) * 22,
        y: player.y + Math.sin(angle) * 22,
        vx: Math.cos(angle) * PLAYER.bulletSpeed,
        vy: Math.sin(angle) * PLAYER.bulletSpeed,
        damage: stats.damage,
        pierce: stats.pierce,
        nova: stats.nova,
        radius: PLAYER.bulletRadius,
        hit: new Set(),
        dead: false,
      });
    }
    particles.spray(player.x + Math.cos(player.angle) * 24, player.y + Math.sin(player.angle) * 24, player.angle, 0.5, '#7df3ff', 3, 120, 0.2, 2);
    audio.shoot();
  }

  function explodeNova(x, y, damage) {
    particles.ring(x, y, '#ffb020', 80, 0.35, 4);
    particles.burst(x, y, '#ffb020', 10, 200, 0.4, 3);
    for (const enemy of state.enemies) {
      if (enemy.dead || enemy.spawnT > 0) continue;
      if (Math.hypot(enemy.x - x, enemy.y - y) < 80 + enemy.radius) {
        enemy.hp -= damage;
        enemy.flash = 0.12;
        if (enemy.hp <= 0) killEnemy(enemy, true);
      }
    }
  }

  function gainXp(amount) {
    state.xp += amount;
    while (state.xp >= xpForLevel(state.level)) {
      state.xp -= xpForLevel(state.level);
      state.level += 1;
      state.pendingLevels += 1;
    }
    if (state.pendingLevels > 0 && !state.choices) {
      state.choices = rollChoices(state.takenUpgrades, random);
      audio.levelUp();
      return true;
    }
    return false;
  }

  function applyChoice(index) {
    if (!state.choices || index < 0 || index >= state.choices.length) return false;
    const upgrade = state.choices[index];
    applyUpgrade(state.player.stats, upgrade);
    state.takenUpgrades.push(upgrade.id);
    if (upgrade.id === 'plating') {
      particles.text(state.player.x, state.player.y - 28, `+${upgrade.heal} HP`, '#3ddc97', 16);
    }
    state.pendingLevels -= 1;
    state.choices = state.pendingLevels > 0 ? rollChoices(state.takenUpgrades, random) : null;
    audio.click();
    return true;
  }

  /**
   * Advance the simulation one fixed step. `input` is the object from input.js
   * (or a scripted stand-in for screenshots). Returns an event bitmask.
   */
  function step(dt, input) {
    const player = state.player;
    state.time += dt;
    state.shake = Math.max(0, state.shake - dt * 30);
    if (state.comboT > 0) {
      state.comboT -= dt;
      if (state.comboT <= 0) {
        state.combo = 0;
        state.multiplier = 1;
      }
    }

    // --- wave flow -------------------------------------------------------
    if (state.waveState === 'spawning') {
      state.spawnT -= dt;
      if (state.spawnT <= 0) {
        if (state.spawnQueue.length > 0) {
          const kind = state.spawnQueue.shift();
          state.enemies.push(spawnEnemy(kind, state.wave, random, player.x, player.y));
          state.spawnT = waveGap(state.wave);
        } else {
          state.waveState = 'fighting';
        }
      }
    } else if (state.waveState === 'fighting') {
      if (state.enemies.length === 0 && state.enemyBullets.length === 0) {
        const bonus = 50 * state.wave;
        state.score += bonus;
        particles.text(FIELD.width / 2, FIELD.height / 2 - 60, `WAVE ${state.wave} CLEAR  +${bonus}`, '#ffd166', 26);
        audio.waveClear();
        state.waveState = 'breather';
        state.breatherT = WAVE_BREATHER;
        return EVENT_WAVECLEAR;
      }
    } else if (state.waveState === 'breather') {
      state.breatherT -= dt;
      if (state.breatherT <= 0) startWave();
    }

    // --- player ----------------------------------------------------------
    if (player.alive) {
      const move = input.moveVector();
      const mouse = input.mouse;
      player.angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
      if (player.dashCooldownT > 0) player.dashCooldownT -= dt;
      if (player.invulnT > 0) player.invulnT -= dt;

      const wantDash = input.takeDash();
      if (wantDash && player.dashCooldownT <= 0 && player.dashT <= 0) {
        player.dashT = PLAYER.dashTime;
        player.dashCooldownT = player.stats.dashCooldown;
        audio.dash();
        particles.ring(player.x, player.y, '#3ee6ff', 60, 0.3, 3);
      }
      if (player.dashT > 0) {
        player.dashT -= dt;
        const dx = Math.cos(player.angle);
        const dy = Math.sin(player.angle);
        // Dash toward the aim when moving, else toward the mouse.
        const mx = move.x !== 0 || move.y !== 0 ? move.x : dx;
        const my = move.x !== 0 || move.y !== 0 ? move.y : dy;
        player.vx = mx * PLAYER.dashSpeed;
        player.vy = my * PLAYER.dashSpeed;
        particles.spray(player.x, player.y, Math.atan2(player.vy, player.vx) + Math.PI, 0.6, '#3ee6ff', 2, 90, 0.25, 2.5);
      } else {
        const target = player.stats.speed;
        player.vx += (move.x * target - player.vx) * Math.min(1, dt * 12);
        player.vy += (move.y * target - player.vy) * Math.min(1, dt * 12);
      }
      player.x = Math.max(PLAYER.radius, Math.min(FIELD.width - PLAYER.radius, player.x + player.vx * dt));
      player.y = Math.max(PLAYER.radius, Math.min(FIELD.height - PLAYER.radius, player.y + player.vy * dt));
      player.thrust = Math.hypot(move.x, move.y) > 0 ? 1 : 0;

      player.fireT -= dt;
      if (input.firing && player.fireT <= 0) {
        fireBullet();
        player.fireT = player.stats.fireRate;
      }
    }

    // --- enemies ---------------------------------------------------------
    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      if (enemy.spawnT > 0) {
        enemy.spawnT -= dt;
        continue;
      }
      if (enemy.flash > 0) enemy.flash -= dt;
      const shot = steerEnemy(enemy, player, dt, random);
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      enemy.x = Math.max(-80, Math.min(FIELD.width + 80, enemy.x));
      enemy.y = Math.max(-80, Math.min(FIELD.height + 80, enemy.y));
      if (shot) {
        state.enemyBullets.push({
          x: enemy.x, y: enemy.y,
          vx: shot.x * shot.speed, vy: shot.y * shot.speed,
          radius: 7, damage: ENEMIES.spitter.damage, dead: false,
        });
        audio.hit();
      }
    }
    // Enemies shove each other apart so they never stack into one blob.
    for (let i = 0; i < state.enemies.length; i += 1) {
      const a = state.enemies[i];
      if (a.dead || a.spawnT > 0) continue;
      for (let j = i + 1; j < state.enemies.length; j += 1) {
        const b = state.enemies[j];
        if (b.dead || b.spawnT > 0) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const min = a.radius + b.radius;
        if (dist > 0 && dist < min) {
          const push = (min - dist) / 2;
          const nx = dx / dist;
          const ny = dy / dist;
          a.x -= nx * push; a.y -= ny * push;
          b.x += nx * push; b.y += ny * push;
        }
      }
    }

    // --- player bullets --------------------------------------------------
    for (const bullet of state.bullets) {
      if (bullet.dead) continue;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      if (bullet.x < -20 || bullet.x > FIELD.width + 20 || bullet.y < -20 || bullet.y > FIELD.height + 20) {
        bullet.dead = true;
        if (bullet.nova > 0) explodeNova(bullet.x, bullet.y, bullet.damage * 0.5);
        continue;
      }
      for (const enemy of state.enemies) {
        if (enemy.dead || enemy.spawnT > 0 || bullet.hit.has(enemy)) continue;
        const dx = enemy.x - bullet.x;
        const dy = enemy.y - bullet.y;
        if (dx * dx + dy * dy < (enemy.radius + bullet.radius) * (enemy.radius + bullet.radius)) {
          bullet.hit.add(enemy);
          enemy.hp -= bullet.damage;
          enemy.flash = 0.1;
          particles.text(enemy.x, enemy.y - enemy.radius - 6, Math.round(bullet.damage), '#eef2ff', 13);
          particles.burst(bullet.x, bullet.y, enemy.color, 4, 160, 0.3, 2.5);
          audio.hit();
          if (enemy.hp <= 0) killEnemy(enemy, true);
          if (bullet.nova > 0) explodeNova(bullet.x, bullet.y, bullet.damage * 0.5);
          if (bullet.pierce > 0) {
            bullet.pierce -= 1;
          } else {
            bullet.dead = true;
          }
          break;
        }
      }
    }

    // --- enemy bullets ---------------------------------------------------
    let died = false;
    for (const bullet of state.enemyBullets) {
      if (bullet.dead) continue;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      if (bullet.x < -20 || bullet.x > FIELD.width + 20 || bullet.y < -20 || bullet.y > FIELD.height + 20) {
        bullet.dead = true;
        continue;
      }
      if (player.alive) {
        const dx = player.x - bullet.x;
        const dy = player.y - bullet.y;
        if (dx * dx + dy * dy < (PLAYER.radius + bullet.radius) * (PLAYER.radius + bullet.radius)) {
          bullet.dead = true;
          if (damagePlayer(bullet.damage, bullet.x - bullet.vx * 0.01, bullet.y - bullet.vy * 0.01)) died = true;
        }
      }
    }

    // --- contact damage --------------------------------------------------
    if (player.alive) {
      for (const enemy of state.enemies) {
        if (enemy.dead || enemy.spawnT > 0) continue;
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const min = PLAYER.radius + enemy.radius;
        if (dx * dx + dy * dy < min * min) {
          if (damagePlayer(enemy.damage, enemy.x, enemy.y)) died = true;
          // The enemy bounces off the player instead of sitting on them.
          const len = Math.hypot(dx, dy) || 1;
          enemy.x -= (dx / len) * 6;
          enemy.y -= (dy / len) * 6;
          break;
        }
      }
    }

    // --- shards ----------------------------------------------------------
    let leveled = false;
    for (const shard of state.shards) {
      if (shard.dead) continue;
      const dx = player.x - shard.x;
      const dy = player.y - shard.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (player.alive && dist < player.stats.pickupRadius) {
        shard.vx += (dx / dist) * 900 * dt;
        shard.vy += (dy / dist) * 900 * dt;
      } else {
        shard.vx *= 1 - 2 * dt;
        shard.vy *= 1 - 2 * dt;
      }
      shard.x += shard.vx * dt;
      shard.y += shard.vy * dt;
      if (player.alive && dist < PLAYER.radius + 12) {
        shard.dead = true;
        audio.pickup(state.combo);
        if (gainXp(shard.value)) leveled = true;
      }
    }

    // --- sweep dead objects ----------------------------------------------
    state.enemies = state.enemies.filter((e) => !e.dead);
    state.bullets = state.bullets.filter((b) => !b.dead);
    state.enemyBullets = state.enemyBullets.filter((b) => !b.dead);
    state.shards = state.shards.filter((s) => !s.dead);
    particles.step(dt);

    let events = EVENT_NONE;
    if (died || !player.alive) events |= EVENT_OVER;
    if (leveled) events |= EVENT_LEVELUP;
    return events;
  }

  /** A quiet ambient drift behind the title screen: enemies wander the arena
   *  with no player, no bullets and no damage. */
  function stepAmbient(dt) {
    state.time += dt;
    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      if (enemy.spawnT > 0) { enemy.spawnT -= dt; continue; }
      enemy.wobble += dt * 0.8;
      enemy.x += Math.cos(enemy.wobble) * enemy.speed * 0.4 * dt;
      enemy.y += Math.sin(enemy.wobble * 0.7) * enemy.speed * 0.4 * dt;
      if (enemy.x < -60) enemy.x = FIELD.width + 50;
      if (enemy.x > FIELD.width + 60) enemy.x = -50;
      if (enemy.y < -60) enemy.y = FIELD.height + 50;
      if (enemy.y > FIELD.height + 60) enemy.y = -50;
    }
    particles.step(dt);
  }

  /** Seed the ambient scene with a few drifting enemies. */
  function seedAmbient() {
    reset();
    state.waveState = 'idle';
    const kinds = ['mote', 'dart', 'spitter', 'splitter', 'bulwark'];
    for (let i = 0; i < 7; i += 1) {
      const kind = kinds[i % kinds.length];
      const enemy = spawnEnemy(kind, 1, random, FIELD.width / 2, FIELD.height / 2);
      enemy.x = 120 + random() * (FIELD.width - 240);
      enemy.y = 100 + random() * (FIELD.height - 200);
      enemy.spawnT = 0;
      state.enemies.push(enemy);
    }
  }

  /** Test and screenshot hook: grant XP directly (used to stage the draft). */
  function debugGrantXp(amount) {
    gainXp(amount);
  }

  /** Screenshot hook: a deep copy of the whole simulation state. */
  function snapshotState() {
    return structuredClone(state);
  }

  /** Screenshot hook: replace the simulation state with a snapshot. */
  function restoreState(snapshot) {
    for (const key of Object.keys(snapshot)) state[key] = snapshot[key];
  }

  return {
    state,
    reset,
    beginRun,
    step,
    stepAmbient,
    seedAmbient,
    applyChoice,
    debugGrantXp,
    snapshotState,
    restoreState,
    get choices() { return state.choices; },
  };
}
