// VOIDPULSE boot and the one loop: input is read every frame, the world
// advances in fixed 1/60 s steps (several in a slow frame, none in a fast one),
// and the renderer paints what is there. The game moves between four screens:
// title, play, paused and game over, with a level-up draft overlaid on play.
//
// ?seed=N fixes the random pattern. ?shot=start|play|upgrade|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { createParticles } from './particles.js';
import { EVENT_LEVELUP, EVENT_OVER, createWorld } from './world.js';
import {
  ACTION_CARD_1, ACTION_CARD_2, ACTION_CARD_3, ACTION_CONFIRM,
  ACTION_DASH, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput,
} from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const particles = createParticles();
const world = createWorld(createRandom(seed), audio, particles);
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world, seed, particles);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, particles, {
      screen: scene.screen,
      best: scene.best,
      choices: scene.choices,
      hoverCard: scene.choices ? 1 : -1,
      shot: true,
    });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let hoverCard = -1;

  // Screen readers (and anyone watching the page's text) hear the screen
  // changes and the big moments.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.beginRun();
    screen = SCREEN_PLAY;
    announce('Playing. Survive the swarm.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Game over. Score ${world.state.score}. Best ${best}. Press R to play again.`);
  }

  function pickCard(index) {
    if (world.applyChoice(index)) {
      announce(`Upgrade taken. Wave ${world.state.wave} continues.`);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound muted.' : 'Sound on.');
    }
    if (actions & ACTION_DASH) input.requestDash();
    if (world.choices) {
      if (actions & ACTION_CARD_1) pickCard(0);
      else if (actions & ACTION_CARD_2) pickCard(1);
      else if (actions & ACTION_CARD_3) pickCard(2);
      else if (actions & ACTION_CONFIRM) {
        const index = renderer.cardIndexAt(input.mouse.x, input.mouse.y, world.choices);
        if (index >= 0) pickCard(index);
      }
      return;
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) {
      audio.unlock();
      startGame();
    } else if (actions & ACTION_RESTART && screen === SCREEN_OVER) {
      audio.unlock();
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.stepAmbient(STEP);
      return;
    }
    if (world.choices) return; // The draft pauses the simulation.
    const events = world.step(STEP, input);
    if (events & EVENT_OVER) endGame();
    else if (events & EVENT_LEVELUP) announce(`Level ${world.state.level}! Choose an upgrade.`);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    hoverCard = world.choices ? renderer.cardIndexAt(input.mouse.x, input.mouse.y, world.choices) : -1;
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, particles, {
      screen,
      best,
      choices: world.choices,
      hoverCard,
    });
  }

  // Leaving the tab pauses a running game rather than letting the swarm in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY && !world.choices) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });
  // Audio needs a gesture first: unlock it on any press or click.
  window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
  window.addEventListener('keydown', () => audio.unlock(), { once: true });

  world.seedAmbient();
  announce('Voidpulse. Press Space or click to start.');
  // Debug handle for automated playtests (harmless in production).
  window.__voidpulse = { world, get screen() { return screen; }, get best() { return best; } };
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
