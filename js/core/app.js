/* ==========================================================
   app.js — Router principal, inyección de DOM y game loop
   ----------------------------------------------------------
   Contrato de cada nivel (js/levels/levelN.js):

     export default {
       id: 1,                       // 1..7
       grade: '1°',                 // etiqueta de grado
       title: 'Campamento Base',
       subtitle: 'Sumas hasta 100',
       available: true,             // false → "Próximamente"
       icon() { return '<svg…>'; }, // string SVG para el mapa
       mount(root, ctx) { … },      // dibuja el minijuego dentro de root
       unmount() { … },             // (opcional) limpieza
     };

   ctx (lo provee app.js):
     ctx.level            → definición del nivel
     ctx.renderer         → Renderer (Assets, shake, toast, modales…)
     ctx.utils            → helpers de utils.js
     ctx.state            → State
     ctx.success({points?, stars?, message?})  → victoria
     ctx.fail()           → error amable: shake + cuenta el intento fallido
     ctx.hint(texto)      → toast cálido
     ctx.onTick(fn)       → registra fn(dt, now) en el game loop; devuelve off()
     ctx.goMap()          → vuelve al mapa
   ========================================================== */

import State, { TOTAL_LEVELS } from './state.js';
import * as Utils from './utils.js';
import Renderer from '../ui/renderer.js';

import level1 from '../levels/level1.js';
import level2 from '../levels/level2.js';
import level3 from '../levels/level3.js';
import level4 from '../levels/level4.js';
import level5 from '../levels/level5.js';
import level6 from '../levels/level6.js';
import level7 from '../levels/level7.js';

const { h, fromHTML } = Utils;
const { Assets } = Renderer;

export const LEVELS = [level1, level2, level3, level4, level5, level6, level7];
const getLevel = (id) => LEVELS.find((l) => l.id === id);

/* ==========================================================
   GAME LOOP — un único requestAnimationFrame para los niveles
   que necesiten animar (balanza, helicóptero, etc.).
   Solo corre cuando hay tickers registrados.
   ========================================================== */
const tickers = new Set();
let rafId = null;
let lastTime = 0;

function loop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000); // segundos, con tope
  lastTime = now;
  tickers.forEach((fn) => fn(dt, now));
  rafId = tickers.size ? requestAnimationFrame(loop) : null;
}

function addTicker(fn) {
  tickers.add(fn);
  if (rafId === null) {
    lastTime = performance.now();
    rafId = requestAnimationFrame(loop);
  }
  return () => tickers.delete(fn);
}

/* ==========================================================
   SESIÓN DE NIVEL ACTIVO
   ========================================================== */
let session = null;

function endSession() {
  if (!session) return;
  try { session.level.unmount?.(); } catch (err) { console.error(err); }
  session.tickerOffs.forEach((off) => off());
  session = null;
  Renderer.closeModal();
}

function createContext(level, stage) {
  const current = { level, stage, mistakes: 0, finished: false, tickerOffs: [] };
  session = current;

  const starsFor = (mistakes) => (mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1);

  const ctx = {
    level,
    renderer: Renderer,
    utils: Utils,
    state: State,

    fail() {
      current.mistakes += 1;
      Renderer.shake(stage);
    },

    hint(text) {
      Renderer.toast(text, { tone: 'warm' });
    },

    onTick(fn) {
      const off = addTicker(fn);
      current.tickerOffs.push(off);
      return off;
    },

    goMap() {
      navigate('/map');
    },

    success({ stars, points, message } = {}) {
      if (current.finished || session !== current) return;
      current.finished = true;

      const earned = stars ?? starsFor(current.mistakes);
      const pts = points ?? earned * 100;
      State.completeLevel(level.id, { stars: earned, points: pts });

      const summit = State.completedCount() === TOTAL_LEVELS;
      const next = getLevel(level.id + 1);
      const actions = [];
      if (summit && level.id === TOTAL_LEVELS) {
        actions.push({ label: 'Ver la cumbre', variant: 'accent', onClick: () => navigate('/map') });
      } else if (next?.available) {
        actions.push({ label: 'Siguiente nivel', variant: 'secondary', onClick: () => navigate(`/level/${next.id}`) });
      }
      if (!(summit && level.id === TOTAL_LEVELS)) {
        actions.push({ label: 'Volver al mapa', variant: actions.length ? 'ghost' : 'primary', onClick: () => navigate('/map') });
      }
      actions.push({ label: 'Jugar de nuevo', variant: 'ghost', onClick: () => navigate(`/level/${level.id}`) });

      const reachedTop = summit && level.id === TOTAL_LEVELS;
      Renderer.showModal({
        icon: Assets.flag(),
        title: reachedTop ? '¡Hiciste cumbre!' : '¡Lo lograste!',
        message: reachedTop
          ? `Completaste los ${TOTAL_LEVELS} niveles y llegaste a la cima del Aconcagua. Juntaste ${State.totalStars()} de ${TOTAL_LEVELS * 3} estrellas.`
          : message || `Completaste "${level.title}". ¡Seguí así, montañista!`,
        stars: earned,
        tone: 'success',
        confetti: true,
        actions,
      });
    },
  };

  return ctx;
}

/* ==========================================================
   PANTALLAS
   ========================================================== */
function updateHud(label = '') {
  Renderer.renderHud({
    score: State.score,
    stars: State.totalStars(),
    label,
    onHome: () => navigate('/map'),
  });
}

async function showTitle() {
  endSession();
  Renderer.hideHud();

  const isNew = State.isNewPlayer();
  const done = State.completedCount();

  const actions = h('div', { class: 'title-screen__actions' },
    h('button', {
      type: 'button',
      class: 'btn btn--primary btn--lg',
      onClick: () => {
        State.markStarted();
        navigate(isNew ? '/level/1' : '/map');
      },
    }, isNew ? '¡Empezar la aventura!' : 'Continuar'),
    !isNew && h('button', {
      type: 'button',
      class: 'btn btn--ghost',
      onClick: () => {
        Renderer.showModal({
          icon: Assets.backpack({ fill: '#EB5757' }),
          title: '¿Empezar de cero?',
          message: 'Vas a borrar tus estrellas y puntos. Esto no se puede deshacer.',
          tone: 'info',
          dismissible: true,
          actions: [
            { label: 'Sí, empezar de cero', variant: 'danger', onClick: () => { State.reset(); showTitle(); } },
            { label: 'Mejor no', variant: 'ghost' },
          ],
        });
      },
    }, 'Empezar de nuevo')
  );

  await Renderer.mountScreen([
    h('div', { class: 'title-screen__art', html: Assets.mountain() }),
    h('h1', { class: 'title-screen__title' }, 'Expedición ', h('span', {}, 'Aconcagua')),
    h('p', { class: 'title-screen__tagline' },
      'Armá tu mochila, comprá provisiones y resolvé desafíos de matemática para llegar a la cumbre más alta de América.'),
    actions,
    !isNew && h('p', { class: 'title-screen__progress' },
      `Progreso: ${done} de ${TOTAL_LEVELS} niveles · ${State.totalStars()} ⭐ · ${State.score} puntos`),
  ], { className: 'title-screen' });
}

async function showMap() {
  endSession();
  updateHud();

  const cards = LEVELS.map((level) => {
    const unlocked = State.isUnlocked(level.id);
    const playable = unlocked && level.available;
    const result = State.getResult(level.id);
    const isCurrent = playable && !result && level.id === State.unlockedLevel;

    const stateClass = !level.available ? 'is-soon' : !unlocked ? 'is-locked' : result ? 'is-done' : isCurrent ? 'is-current' : '';
    const label = !level.available ? 'Próximamente' : !unlocked ? 'Bloqueado' : result ? 'Jugar de nuevo' : 'Jugar';

    return h('li', {},
      h('article', { class: `level-card ${stateClass}` },
        h('span', { class: 'level-card__grade' }, `${level.grade} grado`),
        h('div', { class: 'level-card__art', html: unlocked && level.available ? level.icon() : Assets.lock() }),
        h('h2', { class: 'level-card__title' }, level.title),
        h('p', { class: 'level-card__subtitle' }, level.subtitle),
        h('div', { class: 'level-card__stars', 'aria-label': `${result?.stars ?? 0} de 3 estrellas` },
          [1, 2, 3].map((n) => fromHTML(Assets.star({ filled: n <= (result?.stars ?? 0) })))),
        h('button', {
          type: 'button',
          class: `btn btn--sm level-card__cta ${result ? 'btn--secondary' : 'btn--primary'}`,
          disabled: !playable,
          onClick: () => navigate(`/level/${level.id}`),
        }, label)
      )
    );
  });

  const atSummit = State.completedCount() === TOTAL_LEVELS;
  const summitBanner = atSummit && h('div', { class: 'summit-banner', role: 'status' },
    h('div', { class: 'summit-banner__art', html: Assets.flag() }),
    h('div', { class: 'summit-banner__text' },
      h('strong', {}, '¡Hiciste cumbre en el Aconcagua!'),
      h('span', {}, `${State.totalStars()} de ${TOTAL_LEVELS * 3} estrellas · ${State.score} puntos. Podés repetir cualquier nivel para conseguir más estrellas.`)));

  await Renderer.mountScreen([
    h('div', { class: 'map-screen__head' },
      h('h1', {}, 'La ruta a la cumbre'),
      h('p', {}, 'Cada nivel te acerca un paso más al Aconcagua.')),
    summitBanner,
    h('ul', { class: 'level-grid' }, cards),
  ], { className: 'map-screen' });
}

async function showLevel(id) {
  const level = getLevel(id);
  if (!level || !level.available || !State.isUnlocked(id)) {
    if (level && !level.available) Renderer.toast('Este nivel llega pronto. ¡Seguí explorando!', { tone: 'warm' });
    return navigate('/map', { replace: true });
  }

  endSession();
  updateHud(`${level.grade} grado`);

  const stage = h('div', { class: 'level-stage', id: 'level-stage' });
  const screen = await Renderer.mountScreen([
    h('header', { class: 'level-header' },
      h('div', { class: 'level-header__grade', 'aria-hidden': 'true' }, level.grade),
      h('div', { class: 'level-header__text' },
        h('h1', { class: 'level-header__title' }, level.title),
        h('p', { class: 'level-header__subtitle' }, level.subtitle))),
    stage,
  ], { className: 'level-screen' });
  if (!screen) return; // otra navegación pisó esta

  const ctx = createContext(level, stage);
  try {
    level.mount(stage, ctx);
  } catch (err) {
    console.error(`Error al montar el nivel ${id}`, err);
    stage.replaceChildren(h('p', { class: 'text-center' }, 'Ups, algo salió mal con este nivel. Volvé al mapa e intentá de nuevo.'));
  }
}

/* ==========================================================
   ROUTER (hash simple): # · #map · #level-N
   ========================================================== */
/** '/map' → '#map' · '/level/2' → '#level-2' · '/' → '#' (hashes simples, sin barras). */
function toHash(path) {
  const [, section, param] = path.split('/');
  if (section === 'map') return '#map';
  if (section === 'level' && param) return `#level-${param}`;
  return '#';
}

export function navigate(path, { replace = false } = {}) {
  const target = toHash(path);
  if ((location.hash || '#') === target) {
    handleRoute(); // misma ruta: re-render (p. ej. "Jugar de nuevo")
    return;
  }
  if (replace) location.replace(target);
  else location.hash = target;
}

function parseRoute() {
  const raw = location.hash.replace(/^#/, '');
  if (raw === 'map') return { name: 'map' };
  const match = raw.match(/^level-(\d+)$/);
  if (match) return { name: 'level', id: Number(match[1]) };
  return { name: 'title' };
}

function handleRoute() {
  const route = parseRoute();
  if (route.name === 'map') return showMap();
  if (route.name === 'level') return showLevel(route.id);
  return showTitle();
}

/* ==========================================================
   INIT — lee localStorage y arranca en el título
   ========================================================== */
function init() {
  State.subscribe(() => {
    if (!document.getElementById('hud').hidden) {
      updateHud(session ? `${session.level.grade} grado` : '');
    }
  });

  window.addEventListener('hashchange', handleRoute);

  // Siempre se arranca en el título (nuevos y recurrentes), sin importar el hash inicial.
  // Si hay que cambiar el hash, el evento hashchange dispara el render.
  if (location.hash && location.hash !== '#') {
    location.replace('#');
    return;
  }
  handleRoute();
}

init();
