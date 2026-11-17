// VOIDPULSE renderer: every pixel the player sees. The arena is a fixed 1280x720
// logical field, scaled to the window with letterboxing. Glow is pre-rendered
// once into offscreen sprites, so a busy fight stays cheap to paint.

import { ENEMIES, FIELD, FONT, PALETTE, PLAYER } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

/** Make a radial glow sprite of one colour, reused for every glowing thing. */
function makeGlowSprite(color, inner = 'rgba(255,255,255,0.9)') {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(0.25, color);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const glowSprites = {};
  for (const color of ['#3ee6ff', '#7df3ff', '#ff5d8f', '#ffb020', '#b06bff', '#3ddc97', '#ff4d4d', '#ffe45e', '#ff7ad9', '#ffffff']) {
    glowSprites[color] = makeGlowSprite(color);
  }

  // The background is painted once: nebula blobs, starfield and grid on one
  // offscreen canvas, then blitted every frame.
  const background = document.createElement('canvas');
  background.width = FIELD.width;
  background.height = FIELD.height;
  (function paintBackground() {
    const b = background.getContext('2d');
    b.fillStyle = PALETTE.arena;
    b.fillRect(0, 0, FIELD.width, FIELD.height);
    const blobs = [
      { x: 240, y: 150, r: 340, color: 'rgba(27,42,107,0.55)' },
      { x: 1060, y: 560, r: 380, color: 'rgba(75,27,107,0.5)' },
      { x: 980, y: 110, r: 260, color: 'rgba(20,80,110,0.4)' },
      { x: 180, y: 600, r: 240, color: 'rgba(107,27,80,0.35)' },
    ];
    for (const blob of blobs) {
      const g = b.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, blob.r);
      g.addColorStop(0, blob.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      b.fillStyle = g;
      b.fillRect(blob.x - blob.r, blob.y - blob.r, blob.r * 2, blob.r * 2);
    }
    // Starfield: a fixed scatter of tiny stars.
    let seed = 1337;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 170; i += 1) {
      const x = rand() * FIELD.width;
      const y = rand() * FIELD.height;
      const r = 0.6 + rand() * 1.6;
      b.fillStyle = `rgba(255,255,255,${0.25 + rand() * 0.55})`;
      b.beginPath();
      b.arc(x, y, r, 0, Math.PI * 2);
      b.fill();
    }
    // Grid, faint, so the arena reads as a space.
    b.strokeStyle = PALETTE.grid;
    b.lineWidth = 1;
    b.globalAlpha = 0.5;
    for (let x = 0; x <= FIELD.width; x += 64) {
      b.beginPath(); b.moveTo(x, 0); b.lineTo(x, FIELD.height); b.stroke();
    }
    for (let y = 0; y <= FIELD.height; y += 64) {
      b.beginPath(); b.moveTo(0, y); b.lineTo(FIELD.width, y); b.stroke();
    }
    b.globalAlpha = 1;
    // Arena border.
    b.strokeStyle = '#2c3a6e';
    b.lineWidth = 2;
    b.strokeRect(1, 1, FIELD.width - 2, FIELD.height - 2);
  })();

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.floor(canvas.clientWidth * dpr);
    const height = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  function glow(color, x, y, size, alpha = 1) {
    const sprite = glowSprites[color] || glowSprites['#ffffff'];
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
    ctx.globalAlpha = 1;
  }

  function text(str, x, y, size, color, align = 'center', weight = 700) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
  }

  function bar(x, y, width, height, fraction, fill, edge) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x - 1, y - 1, width + 2, height + 2);
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, Math.max(0, width * Math.min(1, Math.max(0, fraction))), height);
    if (edge) {
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 1.5, y - 1.5, width + 3, height + 3);
    }
  }

  function drawShip(x, y, angle, radius, color, thrust, time, invulnerable) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    if (invulnerable && Math.floor(time * 12) % 2 === 0) {
      ctx.strokeStyle = 'rgba(62,230,255,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, radius + 10, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (thrust) {
      const flicker = 0.7 + Math.random() * 0.5;
      ctx.fillStyle = 'rgba(255,176,32,0.9)';
      ctx.beginPath();
      ctx.moveTo(-radius * 0.7, -7);
      ctx.lineTo(-radius * 0.7 - 18 * flicker, 0);
      ctx.lineTo(-radius * 0.7, 7);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(radius + 6, 0);
    ctx.lineTo(-radius * 0.8, -radius * 0.75);
    ctx.lineTo(-radius * 0.4, 0);
    ctx.lineTo(-radius * 0.8, radius * 0.75);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.playerCore;
    ctx.beginPath();
    ctx.arc(2, 0, radius * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawEnemyShape(enemy, time) {
    const def = ENEMIES[enemy.kind];
    const r = enemy.radius;
    const alpha = enemy.spawnT > 0 ? 1 - enemy.spawnT / 0.5 : 1;
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.globalAlpha = Math.max(0.15, alpha);
    glow(def.color, 0, 0, r * 4.4, 0.5 * alpha);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = def.color;
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 1.5;
    if (enemy.kind === 'mote') {
      ctx.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2 + time * 0.6;
        const rr = i % 2 === 0 ? r : r * 0.55;
        ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
    } else if (enemy.kind === 'dart') {
      ctx.rotate(enemy.angle);
      ctx.beginPath();
      ctx.moveTo(r + 4, 0);
      ctx.lineTo(-r, -r * 0.8);
      ctx.lineTo(-r * 0.4, 0);
      ctx.lineTo(-r, r * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (enemy.kind === 'spitter') {
      ctx.rotate(time * 0.8);
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2;
        ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = '#1a1030';
      ctx.fill();
    } else if (enemy.kind === 'splitter') {
      ctx.rotate(time * 0.5);
      ctx.beginPath();
      ctx.roundRect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7, 7);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = '#0c2418';
      ctx.fill();
    } else {
      // bulwark: heavy octagon with an armour ring.
      ctx.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    // Hit flash: a white overlay that fades in a tenth of a second.
    if (enemy.flash > 0) {
      ctx.globalAlpha = Math.min(1, enemy.flash / 0.1) * 0.85;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // Health bar, only once the enemy has taken damage.
    if (enemy.hp < enemy.maxHp && enemy.spawnT <= 0) {
      bar(enemy.x - r, enemy.y - r - 12, r * 2, 4, enemy.hp / enemy.maxHp, '#ff5d5d');
    }
  }

  function drawHud(state, best) {
    const player = state.player;
    const stats = player.stats;
    // Top-left: hull, level and XP.
    ctx.textAlign = 'left';
    text('HULL', 24, 24, 13, PALETTE.muted, 'left', 700);
    const hpFraction = Math.max(0, player.hp / stats.maxHp);
    bar(24, 34, 220, 16, hpFraction, hpFraction > 0.35 ? '#3ddc97' : '#ff5d5d', PALETTE.panelEdge);
    text(`${Math.ceil(Math.max(0, player.hp))} / ${stats.maxHp}`, 252, 42, 14, PALETTE.text, 'left', 600);
    text(`LEVEL ${state.level}`, 24, 66, 13, PALETTE.muted, 'left', 700);
    bar(24, 74, 220, 8, state.xp / (5 + (state.level - 1) * 4 + Math.floor((state.level - 1) * (state.level - 1) * 0.6)), '#b06bff', PALETTE.panelEdge);
    // Top-centre: wave and enemies left.
    const remaining = state.enemies.length + state.spawnQueue.length;
    text(`WAVE ${Math.max(1, state.wave)}`, FIELD.width / 2, 26, 22, PALETTE.text, 'center', 800);
    if (state.waveState === 'breather') {
      text(`NEXT WAVE IN ${Math.ceil(state.breatherT)}`, FIELD.width / 2, 52, 14, PALETTE.gold, 'center', 700);
    } else {
      text(remaining === 1 ? '1 HOSTILE LEFT' : `${remaining} HOSTILES LEFT`, FIELD.width / 2, 52, 14, PALETTE.muted, 'center', 600);
    }
    // Top-right: score, best, combo.
    text('SCORE', FIELD.width - 24, 24, 13, PALETTE.muted, 'right', 700);
    text(String(state.score), FIELD.width - 24, 46, 24, PALETTE.text, 'right', 800);
    text(`BEST ${best}`, FIELD.width - 24, 70, 13, PALETTE.muted, 'right', 600);
    if (state.multiplier > 1) {
      text(`COMBO x${state.multiplier}`, FIELD.width - 24, 94, 16, PALETTE.gold, 'right', 800);
    }
    // Bottom-centre: dash cooldown.
    const dashFraction = 1 - Math.max(0, player.dashCooldownT) / stats.dashCooldown;
    const dashReady = player.dashCooldownT <= 0;
    text(dashReady ? 'DASH READY  [SHIFT]' : 'DASH', FIELD.width / 2, FIELD.height - 34, 12, dashReady ? '#3ee6ff' : PALETTE.muted, 'center', 700);
    bar(FIELD.width / 2 - 60, FIELD.height - 22, 120, 6, dashFraction, dashReady ? '#3ee6ff' : '#2c3a6e');
    ctx.textAlign = 'center';
  }

  function drawUpgradeCards(choices, hoverIndex, time) {
    ctx.fillStyle = 'rgba(4,6,16,0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const pulse = 0.75 + Math.sin(time * 4) * 0.25;
    text('LEVEL UP', FIELD.width / 2, 118, 40, PALETTE.gold, 'center', 800);
    text('Choose one upgrade — press 1, 2, 3 or click a card', FIELD.width / 2, 158, 16, PALETTE.muted, 'center', 600);
    const cardW = 300;
    const cardH = 250;
    const gap = 28;
    const totalW = cardW * 3 + gap * 2;
    const startX = (FIELD.width - totalW) / 2;
    const y = 210;
    choices.forEach((choice, index) => {
      const x = startX + index * (cardW + gap);
      const hovered = hoverIndex === index;
      const lift = hovered ? -8 : 0;
      ctx.save();
      ctx.translate(0, lift);
      ctx.fillStyle = hovered ? '#1a2247' : PALETTE.panel;
      ctx.strokeStyle = hovered ? '#3ee6ff' : PALETTE.panelEdge;
      ctx.lineWidth = hovered ? 3 : 2;
      ctx.beginPath();
      ctx.roundRect(x, y, cardW, cardH, 14);
      ctx.fill();
      ctx.stroke();
      glow(choice.id === 'secondwind' ? '#ff5d8f' : '#3ee6ff', x + cardW / 2, y + 78, 130, hovered ? 0.8 : 0.5 * pulse);
      text(choice.icon, x + cardW / 2, y + 78, 54, '#ffffff', 'center', 800);
      text(choice.name.toUpperCase(), x + cardW / 2, y + 158, 22, PALETTE.text, 'center', 800);
      // Word-wrap the description across two lines at most.
      ctx.font = `600 15px ${FONT}`;
      ctx.fillStyle = PALETTE.muted;
      ctx.textAlign = 'center';
      const words = choice.desc.split(' ');
      let line = '';
      const lines = [];
      for (const word of words) {
        if ((line + ' ' + word).trim().length > 26) {
          lines.push(line.trim());
          line = word;
        } else line += ' ' + word;
      }
      lines.push(line.trim());
      lines.slice(0, 2).forEach((ln, li) => {
        ctx.fillText(ln, x + cardW / 2, y + 196 + li * 22);
      });
      text(`[${index + 1}]`, x + cardW / 2, y + cardH - 28, 15, hovered ? '#3ee6ff' : PALETTE.muted, 'center', 700);
      ctx.restore();
    });
  }

  function drawTitle(state, best, time, shot) {
    // The ambient arena (drifting enemies) is already drawn underneath.
    ctx.fillStyle = 'rgba(4,6,16,0.45)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const bob = Math.sin(time * 1.4) * 6;
    glow('#3ee6ff', FIELD.width / 2, 218 + bob, 420, 0.5);
    text('VOIDPULSE', FIELD.width / 2, 208 + bob, 92, '#eafcff', 'center', 900);
    text('NEON ARENA SURVIVAL', FIELD.width / 2, 268 + bob, 22, '#3ee6ff', 'center', 700);
    text('Survive the swarm. Collect shards. Draft upgrades. How long can you last?', FIELD.width / 2, 312, 17, PALETTE.text, 'center', 600);
    const controls = [
      ['MOVE', 'WASD / ARROWS'],
      ['AIM + FIRE', 'MOUSE — HOLD CLICK'],
      ['DASH', 'SHIFT / RIGHT CLICK'],
      ['PAUSE', 'P / ESC'],
      ['MUTE', 'M'],
    ];
    const boxW = 520;
    const boxX = (FIELD.width - boxW) / 2;
    const boxY = 348;
    ctx.fillStyle = 'rgba(18,23,46,0.85)';
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, controls.length * 34 + 24, 12);
    ctx.fill();
    ctx.stroke();
    controls.forEach(([label, keys], i) => {
      const y = boxY + 30 + i * 34;
      text(label, boxX + 24, y, 15, PALETTE.muted, 'left', 700);
      text(keys, boxX + boxW - 24, y, 15, PALETTE.text, 'right', 700);
    });
    const blink = Math.floor(time * 1.6) % 2 === 0;
    if (blink || shot) text('CLICK OR PRESS SPACE TO START', FIELD.width / 2, 596, 20, '#ffffff', 'center', 800);
    if (best > 0) text(`BEST SCORE  ${best}`, FIELD.width / 2, 636, 15, PALETTE.gold, 'center', 700);
    text('A complete game in your browser — no downloads, no sign-up.', FIELD.width / 2, 682, 13, PALETTE.muted, 'center', 600);
  }

  function drawGameOver(state, best, time, shot) {
    ctx.fillStyle = 'rgba(8,4,10,0.66)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const isBest = state.score >= best && state.score > 0;
    text('SIGNAL LOST', FIELD.width / 2, 168, 64, '#ff5d5d', 'center', 900);
    text(isBest ? 'NEW BEST SCORE!' : 'THE VOID CLAIMS ANOTHER PILOT', FIELD.width / 2, 222, 18, isBest ? PALETTE.gold : PALETTE.muted, 'center', 700);
    const rows = [
      ['FINAL SCORE', String(state.score)],
      ['WAVE REACHED', String(Math.max(1, state.wave))],
      ['HOSTILES DESTROYED', String(state.kills)],
      ['TIME SURVIVED', formatTime(state.time)],
      ['BEST SCORE', String(best)],
    ];
    const boxW = 460;
    const boxX = (FIELD.width - boxW) / 2;
    const boxY = 262;
    ctx.fillStyle = 'rgba(18,23,46,0.9)';
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, rows.length * 38 + 24, 12);
    ctx.fill();
    ctx.stroke();
    rows.forEach(([label, value], i) => {
      const y = boxY + 32 + i * 38;
      text(label, boxX + 26, y, 15, PALETTE.muted, 'left', 700);
      text(value, boxX + boxW - 26, y, 17, PALETTE.text, 'right', 800);
    });
    const blink = Math.floor(time * 1.6) % 2 === 0;
    if (blink || shot) text('PRESS R OR CLICK TO FLY AGAIN', FIELD.width / 2, 592, 20, '#ffffff', 'center', 800);
    text('Every run shuffles the swarm — your next build will be stronger.', FIELD.width / 2, 632, 14, PALETTE.muted, 'center', 600);
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(4,6,16,0.7)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    text('PAUSED', FIELD.width / 2, FIELD.height / 2 - 20, 56, PALETTE.text, 'center', 900);
    text('Press P or ESC to resume — M mutes the sound', FIELD.width / 2, FIELD.height / 2 + 34, 16, PALETTE.muted, 'center', 600);
  }

  /** Which upgrade card (0-2) a logical point falls on, or -1. Matches drawUpgradeCards. */
  function cardIndexAt(x, y, choices) {
    if (!choices) return -1;
    const cardW = 300;
    const cardH = 250;
    const gap = 28;
    const totalW = cardW * 3 + gap * 2;
    const startX = (FIELD.width - totalW) / 2;
    const top = 210;
    if (y < top || y > top + cardH) return -1;
    for (let i = 0; i < 3; i += 1) {
      const left = startX + i * (cardW + gap);
      if (x >= left && x <= left + cardW) return i;
    }
    return -1;
  }

  /** Paint one frame. `view` carries the screen, best score, draft choices and hover. */
  function draw(state, particles, view) {
    resize();
    const scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    const offsetX = (canvas.width - FIELD.width * scale) / 2;
    const offsetY = (canvas.height - FIELD.height * scale) / 2;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    // Screen shake: a decaying random offset.
    if (state.shake > 0.3) {
      ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
    }
    ctx.drawImage(background, 0, 0);
    const time = state.time;

    // Shards: pulsing gold diamonds.
    for (const shard of state.shards) {
      const pulse = 1 + Math.sin(time * 6 + shard.x) * 0.15;
      glow('#ffe45e', shard.x, shard.y, 34 * pulse, 0.7);
      ctx.save();
      ctx.translate(shard.x, shard.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#ffe45e';
      const s = 5 * pulse;
      ctx.fillRect(-s, -s, s * 2, s * 2);
      ctx.restore();
    }
    // Enemy bullets: magenta orbs.
    for (const bullet of state.enemyBullets) {
      glow('#ff7ad9', bullet.x, bullet.y, 30, 0.9);
      ctx.fillStyle = '#ff7ad9';
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    // Enemies.
    for (const enemy of state.enemies) drawEnemyShape(enemy, time);
    // Player bullets: glowing capsules.
    for (const bullet of state.bullets) {
      const angle = Math.atan2(bullet.vy, bullet.vx);
      glow('#7df3ff', bullet.x, bullet.y, 26, 0.8);
      ctx.save();
      ctx.translate(bullet.x, bullet.y);
      ctx.rotate(angle);
      ctx.fillStyle = '#bff6ff';
      ctx.beginPath();
      ctx.roundRect(-9, -2.5, 18, 5, 2.5);
      ctx.fill();
      ctx.restore();
    }
    // Player ship.
    const player = state.player;
    if (player.alive && view.screen !== SCREEN_TITLE) {
      glow('#3ee6ff', player.x, player.y, 110, 0.55);
      drawShip(player.x, player.y, player.angle, PLAYER.radius, PALETTE.player, player.thrust > 0, time, player.invulnT > 0);
    }
    // Particles, rings and floating text.
    for (const p of particles.particles) {
      if (!p.active) continue;
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    for (const r of particles.rings) {
      if (!r.active) continue;
      ctx.globalAlpha = Math.max(0, r.life / r.maxLife);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const t of particles.texts) {
      if (!t.active) continue;
      ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
      text(t.text, t.x, t.y, t.size, t.color, 'center', 800);
    }
    ctx.globalAlpha = 1;

    // Screens and HUD on top.
    if (view.screen === SCREEN_TITLE) {
      drawTitle(state, view.best, time, view.shot);
    } else {
      drawHud(state, view.best);
      if (view.screen === SCREEN_PAUSED) drawPaused();
      else if (view.screen === SCREEN_OVER) drawGameOver(state, view.best, time, view.shot);
      else if (view.choices) drawUpgradeCards(view.choices, view.hoverCard, time);
    }
    // Vignette: darken the corners so the centre reads at a glance.
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    const vignette = ctx.createRadialGradient(FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.45, FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.95);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(2,3,10,0.5)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  return { draw, resize, cardIndexAt };
}
