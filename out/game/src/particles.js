// Particles, shockwave rings and floating score text. One fixed pool, allocated
// once at boot: spawning never allocates during play, so a busy fight cannot
// stutter the frame.

export function createParticles() {
  const MAX = 420;
  const items = [];
  for (let i = 0; i < MAX; i += 1) {
    items.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#fff', drag: 0 });
  }
  const rings = [];
  for (let i = 0; i < 24; i += 1) {
    rings.push({ active: false, x: 0, y: 0, radius: 0, maxRadius: 60, life: 0, maxLife: 0.4, color: '#fff', width: 3 });
  }
  const texts = [];
  for (let i = 0; i < 32; i += 1) {
    texts.push({ active: false, x: 0, y: 0, vy: 0, life: 0, maxLife: 0.9, text: '', color: '#fff', size: 16 });
  }

  function spawnParticle(x, y, vx, vy, life, size, color, drag) {
    for (let i = 0; i < MAX; i += 1) {
      const p = items[i];
      if (p.active) continue;
      p.active = true;
      p.x = x; p.y = y; p.vx = vx; p.vy = vy;
      p.life = life; p.maxLife = life; p.size = size; p.color = color; p.drag = drag;
      return;
    }
  }

  return {
    /** A burst of sparks flying out in every direction. */
    burst(x, y, color, count, speed, life = 0.6, size = 3) {
      for (let i = 0; i < count; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const v = speed * (0.3 + Math.random() * 0.7);
        spawnParticle(x, y, Math.cos(angle) * v, Math.sin(angle) * v, life * (0.6 + Math.random() * 0.6), size * (0.7 + Math.random() * 0.6), color, 2.2);
      }
    },
    /** A directed spray (muzzle flash, engine trail). */
    spray(x, y, angle, spread, color, count, speed, life = 0.35, size = 2.5) {
      for (let i = 0; i < count; i += 1) {
        const a = angle + (Math.random() - 0.5) * spread;
        const v = speed * (0.5 + Math.random() * 0.5);
        spawnParticle(x, y, Math.cos(a) * v, Math.sin(a) * v, life, size, color, 3);
      }
    },
    ring(x, y, color, maxRadius = 70, life = 0.4, width = 3) {
      for (let i = 0; i < rings.length; i += 1) {
        const r = rings[i];
        if (r.active) continue;
        r.active = true;
        r.x = x; r.y = y; r.radius = 6; r.maxRadius = maxRadius;
        r.life = life; r.maxLife = life; r.color = color; r.width = width;
        return;
      }
    },
    text(x, y, value, color = '#fff', size = 16) {
      for (let i = 0; i < texts.length; i += 1) {
        const t = texts[i];
        if (t.active) continue;
        t.active = true;
        t.x = x; t.y = y; t.vy = -46; t.life = t.maxLife = 0.9;
        t.text = String(value); t.color = color; t.size = size;
        return;
      }
    },
    step(dt) {
      for (let i = 0; i < MAX; i += 1) {
        const p = items[i];
        if (!p.active) continue;
        p.life -= dt;
        if (p.life <= 0) { p.active = false; continue; }
        const drag = Math.max(0, 1 - p.drag * dt);
        p.vx *= drag; p.vy *= drag;
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
      for (let i = 0; i < rings.length; i += 1) {
        const r = rings[i];
        if (!r.active) continue;
        r.life -= dt;
        if (r.life <= 0) { r.active = false; continue; }
        const t = 1 - r.life / r.maxLife;
        r.radius = 6 + (r.maxRadius - 6) * (1 - (1 - t) * (1 - t));
      }
      for (let i = 0; i < texts.length; i += 1) {
        const t = texts[i];
        if (!t.active) continue;
        t.life -= dt;
        if (t.life <= 0) { t.active = false; continue; }
        t.y += t.vy * dt;
        t.vy *= 1 - 1.4 * dt;
      }
    },
    get particles() { return items; },
    get rings() { return rings; },
    get texts() { return texts; },
    /** Screenshot hook: a deep copy of every live particle, ring and text. */
    snapshot() {
      return structuredClone({ items, rings, texts });
    },
    /** Screenshot hook: put back a snapshot taken earlier. */
    restore(snap) {
      for (let i = 0; i < MAX; i += 1) Object.assign(items[i], snap.items[i]);
      for (let i = 0; i < rings.length; i += 1) Object.assign(rings[i], snap.rings[i]);
      for (let i = 0; i < texts.length; i += 1) Object.assign(texts[i], snap.texts[i]);
    },
    clear() {
      for (const p of items) p.active = false;
      for (const r of rings) r.active = false;
      for (const t of texts) t.active = false;
    },
  };
}
