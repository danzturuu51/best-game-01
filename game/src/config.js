// VOIDPULSE — every tuning number, colour and definition in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Seconds between waves, while the breather banner shows. */
export const WAVE_BREATHER = 3;

export const PLAYER = {
  radius: 16,
  speed: 320,
  maxHp: 100,
  fireInterval: 0.22,
  bulletSpeed: 720,
  bulletDamage: 10,
  bulletRadius: 5,
  dashSpeed: 980,
  dashTime: 0.16,
  dashCooldown: 2.4,
  invulnerable: 0.9,
  pickupRadius: 90,
};

export const BULLET = { max: 240 };

/** Enemy kinds, keyed by id. hp/speed/score grow a little with the wave (see enemies.js). */
export const ENEMIES = {
  mote: {
    name: 'Mote', radius: 14, hp: 12, speed: 115, damage: 10, score: 10, xp: 1,
    color: '#ff5d8f', behavior: 'chase',
  },
  dart: {
    name: 'Dart', radius: 11, hp: 9, speed: 210, damage: 8, score: 15, xp: 1,
    color: '#ffb020', behavior: 'dart',
  },
  spitter: {
    name: 'Spitter', radius: 16, hp: 20, speed: 80, damage: 12, score: 25, xp: 2,
    color: '#b06bff', behavior: 'spit', range: 340, shotInterval: 2.1, shotSpeed: 230,
  },
  splitter: {
    name: 'Splitter', radius: 22, hp: 30, speed: 85, damage: 14, score: 30, xp: 2,
    color: '#3ddc97', behavior: 'chase', splitsInto: 'mote', splitCount: 3,
  },
  bulwark: {
    name: 'Bulwark', radius: 34, hp: 85, speed: 50, damage: 24, score: 60, xp: 4,
    color: '#ff4d4d', behavior: 'chase',
  },
};

/** Wave composition: how many of each kind the wave's spawn budget buys, and the
 *  gap between spawns. Later waves add kinds and shrink the gap. */
export const WAVES = [
  { mote: 8, gap: 1.0 },
  { mote: 10, dart: 4, gap: 0.86 },
  { mote: 10, dart: 6, spitter: 3, gap: 0.77 },
  { mote: 12, dart: 8, spitter: 4, splitter: 2, gap: 0.68 },
  { mote: 12, dart: 8, spitter: 5, splitter: 3, bulwark: 1, gap: 0.59 },
  { mote: 14, dart: 10, spitter: 6, splitter: 4, bulwark: 2, gap: 0.52 },
];
/** After the table ends, each wave repeats the last shape and grows it. */
export const WAVE_GROWTH = { extraPerWave: 3, gapFloor: 0.34, hpPerWave: 0.06, speedPerWave: 0.02 };

/** XP needed for level n (level 1 needs 5 shards, then it grows). */
export function xpForLevel(level) {
  return 5 + (level - 1) * 4 + Math.floor((level - 1) * (level - 1) * 0.6);
}

/**
 * The level-up draft. Each entry: id, name, one-line description, icon (a glyph
 * drawn on the card), max stacks, and the effect applied to the player.
 */
export const UPGRADES = [
  { id: 'overclock', name: 'Overclock', desc: '+20% fire rate', icon: '»', max: 5, fireRate: 0.2 },
  { id: 'heavy', name: 'Heavy Rounds', desc: '+30% bullet damage', icon: '◆', max: 5, damage: 0.3 },
  { id: 'split', name: 'Split Shot', desc: '+1 projectile per shot', icon: '∴', max: 3, projectiles: 1 },
  { id: 'thrusters', name: 'Ion Thrusters', desc: '+12% move speed', icon: '»', max: 4, speed: 0.12 },
  { id: 'plating', name: 'Aegis Plating', desc: '+25 max HP, heal 25', icon: '▣', max: 5, maxHp: 25, heal: 25 },
  { id: 'swift', name: 'Swift Dash', desc: 'Dash recharges 30% faster', icon: '↯', max: 3, dashCooldown: 0.3 },
  { id: 'tractor', name: 'Tractor Field', desc: '+50% shard pickup radius', icon: '◎', max: 3, pickup: 0.5 },
  { id: 'pierce', name: 'Piercing Rounds', desc: 'Bullets pierce +1 enemy', icon: '→', max: 3, pierce: 1 },
  { id: 'nova', name: 'Nova Rounds', desc: 'Bullets burst on impact', icon: '✹', max: 2, nova: 1 },
  { id: 'secondwind', name: 'Second Wind', desc: 'Revive once at 50% HP', icon: '♥', max: 1, secondWind: 1 },
];

export const COMBO = { window: 4, maxMultiplier: 5 };

export const PALETTE = {
  backdrop: '#070a18',
  arena: '#0b1030',
  grid: '#182050',
  nebulaA: '#1b2a6b',
  nebulaB: '#4b1b6b',
  player: '#3ee6ff',
  playerCore: '#eafcff',
  bullet: '#7df3ff',
  enemyBullet: '#ff7ad9',
  shard: '#ffe45e',
  panel: '#12172e',
  panelEdge: '#2c3a6e',
  text: '#eef2ff',
  muted: '#93a0c8',
  danger: '#ff5d5d',
  gold: '#ffd166',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'voidpulse.best';
