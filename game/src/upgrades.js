// The level-up draft: roll three different upgrades the player can still take,
// and apply the one they pick. Choices are weighted so a build never dead-ends
// on three maxed-out cards, and Second Wind is only ever offered once.

import { UPGRADES } from './config.js';

/** How many stacks of each upgrade the player already holds. */
export function countStacks(taken) {
  const counts = {};
  for (const id of taken) counts[id] = (counts[id] ?? 0) + 1;
  return counts;
}

/** Roll three distinct, still-available upgrades for the draft. */
export function rollChoices(taken, random) {
  const counts = countStacks(taken);
  const available = UPGRADES.filter((u) => (counts[u.id] ?? 0) < u.max);
  const pool = available.length > 0 ? available : UPGRADES.filter((u) => u.id !== 'secondwind');
  const choices = [];
  const bag = [...pool];
  while (choices.length < 3 && bag.length > 0) {
    const index = Math.floor(random() * bag.length);
    choices.push(bag.splice(index, 1)[0]);
  }
  // A short pool (late game) still shows three cards: repeat the cheapest ones.
  while (choices.length < 3) choices.push(pool[choices.length % pool.length]);
  return choices;
}

/** Apply one upgrade's effect to the player's stats object. */
export function applyUpgrade(stats, upgrade) {
  if (upgrade.fireRate) stats.fireRate *= 1 - upgrade.fireRate;
  if (upgrade.damage) stats.damage *= 1 + upgrade.damage;
  if (upgrade.projectiles) stats.projectiles += upgrade.projectiles;
  if (upgrade.speed) stats.speed *= 1 + upgrade.speed;
  if (upgrade.maxHp) {
    stats.maxHp += upgrade.maxHp;
    stats.hp = Math.min(stats.maxHp, stats.hp + (upgrade.heal ?? 0));
  }
  if (upgrade.dashCooldown) stats.dashCooldown *= 1 - upgrade.dashCooldown;
  if (upgrade.pickup) stats.pickupRadius *= 1 + upgrade.pickup;
  if (upgrade.pierce) stats.pierce += upgrade.pierce;
  if (upgrade.nova) stats.nova += upgrade.nova;
  if (upgrade.secondWind) stats.secondWind = true;
}
