/* ==========================================================
   level5.js — Nivel 5 · Zona de Rescate (5° grado)
   ----------------------------------------------------------
   Objetivo: área vs. perímetro. Con una cuerda de largo fijo
   (perímetro) el jugador forma un rectángulo en un geoplano de
   9×9 puntos y descubre que el cuadrado es la figura que
   encierra más cuadraditos (área máxima). Si lo logra, aterriza
   el helicóptero de rescate.

   Modelo: rectángulo { x, y, w, h } en coordenadas de grilla
   (0..8) con w + h = P/2 siempre. Al arrastrar un vértice, el
   vértice opuesto queda fijo y se elige el ancho entero válido
   cuyo vértice queda más cerca del puntero (snap + proyección
   sobre la restricción de largo fijo).

   3 rondas: P = 16 (máx. 4×4 = 16), P = 12 (3×3 = 9), P = 20 (5×5 = 25).
   ========================================================== */

import { h, fromHTML, clamp } from '../core/utils.js';

/* ---------- Geoplano ---------- */
const GRID = 8;          // celdas por lado → 9×9 puntos (0..8)
const OX = 36;           // margen del viewBox 360×360
const OY = 36;
const ST = 36;           // lado de una celda en unidades del viewBox
const WIN_DELAY = 1500;  // ms hasta pasar a la ronda siguiente
const LAND_MS = 1000;
const TAKEOFF_MS = 700;

const ROUNDS = [
  { perimeter: 16, start: { w: 1, h: 7 } }, // spec: máximo 4×4 = 16
  { perimeter: 12, start: { w: 5, h: 1 } }, // máximo 3×3 = 9
  { perimeter: 20, start: { w: 2, h: 8 } }, // máximo 5×5 = 25
];

/* Vértices: key → posición relativa al rectángulo y vértice opuesto */
const CORNERS = {
  tl: { opp: 'br', right: false, bottom: false, label: 'arriba a la izquierda' },
  tr: { opp: 'bl', right: true, bottom: false, label: 'arriba a la derecha' },
  bl: { opp: 'tr', right: false, bottom: true, label: 'abajo a la izquierda' },
  br: { opp: 'tl', right: true, bottom: true, label: 'abajo a la derecha' },
};

/* ---------- Escena (helicóptero) ---------- */
const SCENE_W = 360;
const SCENE_H = 128;
const HELI_S = 0.62;                 // escala del helicóptero (caja 120×80)
const HELI_CX = 180;                 // centro horizontal sobre la helipista
const HOVER_Y = 6;                   // y (arriba) en vuelo estacionario
const LAND_Y = 112 - 74 * HELI_S;    // y (arriba) cuando apoya los patines
const PAD_Y = 114;

/* Helicóptero (caja 120×80, mira hacia la izquierda). Sin <defs>/ids. */
const HELI_BODY = `
  <g class="l5-heli__rotor" data-rotor>
    <rect x="6" y="7" width="108" height="6" rx="3" fill="#23405A" opacity=".5"/>
  </g>
  <rect x="55" y="12" width="10" height="11" rx="4" fill="#1F82BD"/>
  <path d="M82 34 112 28a5 5 0 0 1 5 5v7a5 5 0 0 1-5 5L82 47z" fill="#EB5757"/>
  <path d="M106 26l9-12 4 3v22z" fill="#C93F3F"/>
  <circle cx="113" cy="33" r="8" fill="none" stroke="#23405A" stroke-width="2.5" opacity=".28"/>
  <ellipse cx="58" cy="42" rx="38" ry="23" fill="#EB5757"/>
  <path d="M22 46a38 23 0 0 0 72 4 38 23 0 0 1-72-4z" fill="#C93F3F" opacity=".5"/>
  <path d="M28 40c0-11 8-18 19-18h7v23H28z" fill="#DCEFFB"/>
  <path d="M33 38c0-6 4-11 10-12" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>
  <rect x="62" y="30" width="22" height="22" rx="6" fill="#fff" opacity=".92"/>
  <path d="M73 34v14M66 41h14" stroke="#EB5757" stroke-width="5" stroke-linecap="round"/>
  <path d="M42 66h58" stroke="#23405A" stroke-width="5" stroke-linecap="round" opacity=".6"/>
  <path d="M52 62v6M86 62v6" stroke="#23405A" stroke-width="4" stroke-linecap="round" opacity=".6"/>
`;

/* ---------- Estado de módulo (para limpiar en unmount) ---------- */
let cleanup = null;

const ESCALA = (n) => (n === 1 ? 'cuadradito' : 'cuadraditos');
const fmtShape = (a, b) => `${Math.min(a, b)} × ${Math.max(a, b)}`;
const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

/** Ancho entero (1..S-1) que deja el rectángulo dentro de la grilla. */
function widthRange(S) {
  return { lo: Math.max(1, S - GRID), hi: Math.min(S - 1, GRID) };
}

/** Rectángulo resultante de fijar el vértice opuesto (ax, ay) y estirar el vértice `key` a ancho w. */
function rectFromAnchor(key, ax, ay, w, S) {
  const c = CORNERS[key];
  const hh = S - w;
  const vx = ax + (c.right ? w : -w);
  const vy = ay + (c.bottom ? hh : -hh);
  return { x: Math.min(ax, vx), y: Math.min(ay, vy), w, h: hh, vx, vy };
}

const inGrid = (r) => r.w >= 1 && r.h >= 1 && r.x >= 0 && r.y >= 0 && r.x + r.w <= GRID && r.y + r.h <= GRID;

function cornerPos(key, r) {
  const c = CORNERS[key];
  return { x: r.x + (c.right ? r.w : 0), y: r.y + (c.bottom ? r.h : 0) };
}

export default {
  id: 5,
  grade: '5°',
  title: 'Zona de Rescate',
  subtitle: 'Área y perímetro con la cuerda mágica',
  available: true,

  icon() {
    // Mini geoplano con la cuerda y el helicóptero encima.
    const dots = [];
    for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) dots.push(`<circle cx="${19 + i * 16}" cy="${50 + j * 13}" r="2.2" fill="#9DB4C6"/>`);
    return `
<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Helicóptero sobre el geoplano">
  <rect x="6" y="40" width="108" height="56" rx="16" fill="#DCEFFB"/>
  <rect x="35" y="50" width="48" height="26" rx="3" fill="#27AE60" opacity=".3"/>
  ${dots.join('')}
  <path d="M35 50h48v26H35z" fill="none" stroke="#F2C94C" stroke-width="5" stroke-linejoin="round"/>
  <path d="M35 50h48v26H35z" fill="none" stroke="#9A7410" stroke-width="1.6" stroke-dasharray="2 5" stroke-linecap="round" opacity=".7"/>
  <circle cx="35" cy="50" r="5" fill="#fff" stroke="#D9A91F" stroke-width="2.5"/>
  <circle cx="83" cy="76" r="5" fill="#fff" stroke="#D9A91F" stroke-width="2.5"/>
  <g transform="translate(34 -2) scale(.5)">${HELI_BODY}</g>
</svg>`;
  },

  mount(root, ctx) {
    cleanup?.();
    cleanup = null;

    const { renderer } = ctx;
    const reduced = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let alive = true;
    const timers = new Set();
    const later = (fn, ms) => {
      const id = setTimeout(() => { timers.delete(id); if (alive) fn(); }, ms);
      timers.add(id);
      return id;
    };

    /* ---------- Estado ---------- */
    let roundIdx = 0;
    let P = 16;              // perímetro (largo de la cuerda)
    let S = 8;               // semiperímetro = ancho + alto
    let rect = { x: 0, y: 0, w: 1, h: 7 };
    let busy = false;
    let touched = false;     // ya movió algo (apaga el pulso de ayuda)
    let drag = null;
    let attempts = new Map();     // 'min×max' → { a, b, area }
    let lastCommit = null;        // última figura registrada (evita duplicar el aviso)
    let lastFail = null;          // clave de la última figura fallida (evita contar repetidos)

    const maxArea = () => Math.floor(S / 2) * Math.ceil(S / 2);
    const areaOf = (r = rect) => r.w * r.h;
    const keyOf = (r = rect) => `${Math.min(r.w, r.h)}x${Math.max(r.w, r.h)}`;

    /* ==========================================================
       DOM — cabecera
       ========================================================== */
    const roundLabel = h('span', { class: 'l5-round__label' });
    const dots = h('span', { class: 'l5-dots', 'aria-hidden': 'true' },
      ROUNDS.map(() => h('span', { class: 'l5-dot' })));
    const hintBtn = h('button', {
      type: 'button',
      class: 'btn btn--accent btn--sm l5-hint',
      'aria-label': 'Pista: ver una idea para encontrar la mejor figura',
      onClick: () => onHint(),
    }, 'Pista');

    const top = h('div', { class: 'l5-top' },
      h('div', { class: 'l5-round' }, roundLabel, dots),
      hintBtn);

    const instruction = h('p', { class: 'l5-instruction' },
      'La cuerda siempre mide lo mismo. Arrastrá sus esquinas para encerrar el lugar más grande y que aterrice el helicóptero.');

    /* ==========================================================
       DOM — escena con helicóptero
       ========================================================== */
    const sceneSvg = fromHTML(`
<svg class="l5-scene__svg" viewBox="0 0 ${SCENE_W} ${SCENE_H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Montaña nevada con una helipista y el helicóptero de rescate">
  <circle cx="318" cy="30" r="17" fill="#F2C94C" opacity=".85"/>
  <circle cx="318" cy="30" r="26" fill="#F2C94C" opacity=".2"/>
  <g class="l5-cloud l5-cloud--a" fill="#fff" opacity=".9"><ellipse cx="58" cy="30" rx="26" ry="9"/><ellipse cx="74" cy="24" rx="16" ry="9"/></g>
  <g class="l5-cloud l5-cloud--b" fill="#fff" opacity=".75"><ellipse cx="262" cy="52" rx="22" ry="7"/><ellipse cx="248" cy="48" rx="12" ry="7"/></g>
  <path d="M-10 118 60 52l32 36 36-52 52 62 40-34 60 48 60-44 40 50v16H-10z" fill="#BFD9EC"/>
  <path d="M60 52 41 72l12-5 10 10 10-9 8 11-9-13-8 4zM128 36l-22 28 14-6 10 9 12-9 16 14z" fill="#fff" opacity=".9"/>
  <path d="M-10 128V104l50-30 36 28 34-22 64 46 58-40 48 34 54-26v34z" fill="#9DB4C6"/>
  <path d="M40 74 22 90l12-3 8 7 8-9 8 8-8-18zM228 82l-18 15 12-3 8 7 8-8z" fill="#fff" opacity=".95"/>
  <path d="M-10 128v-12c40-8 70-6 110-2s90 4 150-2 90-4 120 4v12z" fill="#F7FCFF"/>
  <ellipse cx="${HELI_CX}" cy="${PAD_Y}" rx="50" ry="9" fill="#DCEFFB"/>
  <ellipse cx="${HELI_CX}" cy="${PAD_Y}" rx="38" ry="6.5" fill="none" stroke="#2D9CDB" stroke-width="2" opacity=".55"/>
  <text x="${HELI_CX}" y="${PAD_Y + 2.5}" text-anchor="middle" font-family="Fredoka One, sans-serif" font-size="14" fill="#2D9CDB" opacity=".7" transform="translate(0 ${PAD_Y * 0.55}) scale(1 .55) translate(0 ${-PAD_Y * 0.55})">H</text>
  <ellipse data-shadow cx="${HELI_CX}" cy="${PAD_Y}" rx="14" ry="3" fill="#23405A" opacity=".12"/>
  <g data-heli>${HELI_BODY}</g>
</svg>`);
    const heliG = sceneSvg.querySelector('[data-heli]');
    const rotorG = sceneSvg.querySelector('[data-rotor]');
    const shadowEl = sceneSvg.querySelector('[data-shadow]');
    const scene = h('div', { class: 'l5-scene' }, sceneSvg);

    /* ==========================================================
       DOM — geoplano (SVG interactivo)
       ========================================================== */
    const NS = 'http://www.w3.org/2000/svg';
    const svgEl = (tag, attrs = {}, ...kids) => {
      const el = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      kids.forEach((kid) => kid && el.append(kid));
      return el;
    };
    const px = (i) => OX + i * ST;
    const py = (j) => OY + j * ST;

    const board = svgEl('svg', {
      class: 'l5-board',
      viewBox: '0 0 360 360',
      role: 'group',
      'aria-label': 'Geoplano: una cuadrícula de 9 por 9 puntos con la cuerda',
    });

    board.append(svgEl('rect', { x: 3, y: 3, width: 354, height: 354, rx: 30, class: 'l5-board__bg' }));

    // Cuadraditos de fondo (8×8) y números para contar
    const cells = [];
    const cellsG = svgEl('g', { class: 'l5-cells' });
    const numsG = svgEl('g', { class: 'l5-nums', 'aria-hidden': 'true' });
    for (let j = 0; j < GRID; j++) {
      for (let i = 0; i < GRID; i++) {
        const cell = svgEl('rect', {
          x: px(i) + 1.5, y: py(j) + 1.5, width: ST - 3, height: ST - 3, rx: 6,
          class: `l5-cell ${(i + j) % 2 ? 'is-alt' : ''}`,
        });
        const num = svgEl('text', { x: px(i) + ST / 2, y: py(j) + ST / 2 + 4.5, 'text-anchor': 'middle', class: 'l5-num' });
        cellsG.append(cell);
        numsG.append(num);
        cells.push({ cell, num, i, j, on: false });
      }
    }
    board.append(cellsG, numsG);

    // Puntos del geoplano (9×9)
    const dotsG = svgEl('g', { class: 'l5-pegs', 'aria-hidden': 'true' });
    for (let j = 0; j <= GRID; j++) {
      for (let i = 0; i <= GRID; i++) dotsG.append(svgEl('circle', { cx: px(i), cy: py(j), r: 2.8 }));
    }
    board.append(dotsG);

    // Cuerda (relleno translúcido + trenzado)
    const ropeFill = svgEl('polygon', { class: 'l5-rope__fill' });
    const ropeBase = svgEl('polygon', { class: 'l5-rope__base' });
    const ropeTwist = svgEl('polygon', { class: 'l5-rope__twist' });
    board.append(ropeFill, ropeBase, ropeTwist);

    // Etiquetas de ancho y alto sobre los lados
    const wText = svgEl('text', { class: 'l5-edge__text', 'text-anchor': 'middle' });
    const hText = svgEl('text', { class: 'l5-edge__text', 'text-anchor': 'middle' });
    const wPill = svgEl('rect', { class: 'l5-edge__pill', width: 26, height: 18, rx: 9 });
    const hPill = svgEl('rect', { class: 'l5-edge__pill', width: 26, height: 18, rx: 9 });
    const edgeG = svgEl('g', { 'aria-hidden': 'true', class: 'l5-edges' }, wPill, wText, hPill, hText);
    board.append(edgeG);

    // Vértices arrastrables
    const verts = {};
    Object.keys(CORNERS).forEach((key) => {
      const body = svgEl('g', { class: 'l5-vertex__body' },
        svgEl('circle', { class: 'l5-vertex__pulse', r: 14 }),
        svgEl('circle', { class: 'l5-vertex__disc', r: 12 }),
        svgEl('circle', { class: 'l5-vertex__core', r: 4.5 }));
      const el = svgEl('g', {
        class: 'l5-vertex',
        tabindex: '0',
        role: 'button',
        'aria-roledescription': 'esquina de la cuerda',
        'data-corner': key,
      },
        svgEl('circle', { class: 'l5-vertex__ring', r: 21 }),
        body,
        svgEl('circle', { class: 'l5-vertex__hit', r: 18 }));
      verts[key] = { key, el };
      board.append(el);
    });

    const boardWrap = h('div', { class: 'l5-boardwrap' }, board);

    /* ==========================================================
       DOM — panel lateral
       ========================================================== */
    const periEl = h('p', { class: 'l5-stat l5-stat--peri' });
    const dimsEl = h('p', { class: 'l5-stat l5-stat--dims' });
    const areaEl = h('p', { class: 'l5-stat l5-stat--area' });
    const stats = h('div', { class: 'l5-stats' }, periEl, dimsEl, areaEl);

    const range = h('input', {
      type: 'range', step: '1', class: 'l5-range', id: 'l5-range',
    });
    const minusBtn = h('button', {
      type: 'button', class: 'l5-step', 'aria-label': 'Hacer la cuerda más angosta',
      onClick: () => stepWidth(-1),
    }, '−');
    const plusBtn = h('button', {
      type: 'button', class: 'l5-step', 'aria-label': 'Hacer la cuerda más ancha',
      onClick: () => stepWidth(1),
    }, '+');
    const rangeVal = h('output', { class: 'l5-controls__value', for: 'l5-range' });
    const controls = h('div', { class: 'l5-controls', role: 'group', 'aria-label': 'Ancho de la cuerda, sin usar el arrastre' },
      h('label', { class: 'l5-controls__label', for: 'l5-range' }, 'Ancho de la cuerda', rangeVal),
      h('div', { class: 'l5-controls__row' }, minusBtn, range, plusBtn));

    const callBtn = h('button', {
      type: 'button',
      class: 'btn btn--secondary btn--lg l5-call',
      onClick: () => onCall(),
    }, '¡Llamar al helicóptero!');

    const msg = h('div', { class: 'l5-msg', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });

    const logList = h('ul', { class: 'l5-log__list' });
    const log = h('section', { class: 'l5-log', 'aria-label': 'Lo que fuiste probando' },
      h('h2', { class: 'l5-log__title' }, 'Lo que fuiste probando'),
      logList);

    const side = h('div', { class: 'l5-side' }, stats, controls, callBtn, msg, log);
    const main = h('div', { class: 'l5-main' }, scene, boardWrap);

    root.append(h('div', { class: 'l5' }, top, instruction, h('div', { class: 'l5-layout' }, main, side)));

    /* ==========================================================
       Mensajes
       ========================================================== */
    function say(tone, text) {
      msg.className = `l5-msg l5-msg--${tone}`;
      msg.replaceChildren(h('span', { class: 'l5-msg__text' }, text));
    }
    function clearMsg() {
      msg.className = 'l5-msg';
      msg.replaceChildren();
    }

    /* ==========================================================
       Helicóptero (animado con ctx.onTick)
       ========================================================== */
    const heli = { y: 0, anim: null, spin: 1, phase: 0, wob: 0 };

    function applyHeli(now) {
      const hover = 1 - heli.y;
      const bob = reduced ? 0 : Math.sin(now / 420) * 3 * hover;
      const sway = reduced ? 0 : Math.sin(now / 900) * 2 * hover;
      const ty = HOVER_Y + (LAND_Y - HOVER_Y) * heli.y + bob;
      const tx = HELI_CX - 60 * HELI_S + sway;
      const rot = reduced ? 0 : heli.wob * Math.sin(now / 70) * 5;
      heliG.setAttribute('transform', `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${HELI_S}) rotate(${rot.toFixed(2)} 60 40)`);
      const sx = reduced ? 1 : 0.14 + 0.86 * Math.abs(Math.cos(heli.phase));
      rotorG.setAttribute('transform', `translate(60 10) scale(${sx.toFixed(3)} 1) translate(-60 -10)`);
      shadowEl.setAttribute('rx', (13 + 24 * heli.y).toFixed(1));
      shadowEl.setAttribute('opacity', (0.08 + 0.2 * heli.y).toFixed(2));
    }

    function moveHeli(to, ms, onDone) {
      if (reduced) {
        heli.y = to;
        heli.anim = null;
        applyHeli(performance.now());
        onDone?.();
        return;
      }
      heli.anim = { from: heli.y, to, ms, t: 0, onDone };
    }

    const offTick = ctx.onTick((dt, now) => {
      if (!alive) return;
      const a = heli.anim;
      if (a) {
        a.t += dt * 1000;
        const k = clamp(a.t / a.ms, 0, 1);
        heli.y = a.from + (a.to - a.from) * easeInOut(k);
        if (k >= 1) {
          heli.anim = null;
          a.onDone?.();
        }
      }
      const settled = heli.y >= 1 && !heli.anim;
      heli.spin += ((settled ? 0.12 : 1) - heli.spin) * Math.min(1, dt * 3);
      heli.phase += dt * 38 * heli.spin;
      heli.wob = Math.max(0, heli.wob - dt * 1.8);
      applyHeli(now);
    });

    /* ==========================================================
       Render del geoplano y del panel
       ========================================================== */
    function render() {
      const { x, y, w, h: hh } = rect;
      const area = w * hh;
      const x0 = px(x), y0 = py(y), x1 = px(x + w), y1 = py(y + hh);
      const pts = `${x0},${y0} ${x1},${y0} ${x1},${y1} ${x0},${y1}`;
      ropeFill.setAttribute('points', pts);
      ropeBase.setAttribute('points', pts);
      ropeTwist.setAttribute('points', pts);

      // Cuadraditos pintados (en cascada diagonal) y numerados
      cells.forEach((c) => {
        const inside = c.i >= x && c.i < x + w && c.j >= y && c.j < y + hh;
        if (inside) {
          const n = (c.j - y) * w + (c.i - x) + 1;
          c.cell.style.transitionDelay = `${((c.i - x) + (c.j - y)) * 22}ms`;
          if (c.num.textContent !== String(n)) c.num.textContent = String(n);
        } else {
          c.cell.style.transitionDelay = '0ms';
        }
        if (inside !== c.on) {
          c.on = inside;
          c.cell.classList.toggle('is-in', inside);
          c.num.classList.toggle('is-in', inside);
        }
      });

      // Etiquetas de lado
      wText.textContent = String(w);
      hText.textContent = String(hh);
      const wcx = (x0 + x1) / 2, wcy = y0 - 23;
      const hcx = x0 - 23, hcy = (y0 + y1) / 2;
      wPill.setAttribute('x', wcx - 13); wPill.setAttribute('y', wcy - 9);
      wText.setAttribute('x', wcx); wText.setAttribute('y', wcy + 5);
      hPill.setAttribute('x', hcx - 13); hPill.setAttribute('y', hcy - 9);
      hText.setAttribute('x', hcx); hText.setAttribute('y', hcy + 5);

      // Vértices (área táctil más grande cuando los vecinos están lejos)
      const hitR = Math.min(w, hh) >= 2 ? 26 : 18;
      const summary = `Ancho ${w}, alto ${hh}, área ${area}`;
      Object.values(verts).forEach(({ key, el }) => {
        el.querySelector('.l5-vertex__hit').setAttribute('r', hitR);
        const p = cornerPos(key, rect);
        el.setAttribute('transform', `translate(${px(p.x)} ${py(p.y)})`);
        el.setAttribute('aria-label',
          `Esquina ${CORNERS[key].label} de la cuerda. ${summary}. Con las flechas la estirás.`);
      });

      // Panel
      periEl.replaceChildren('Perímetro: ', h('strong', {}, `${P} unidades`), h('span', { class: 'l5-stat__note' }, ' (la cuerda no cambia)'));
      dimsEl.replaceChildren('Ancho ', h('strong', {}, String(w)), ' × Alto ', h('strong', {}, String(hh)));
      areaEl.replaceChildren('Área = ', h('strong', { class: 'l5-stat__big' }, String(area)), ` ${ESCALA(area)}`);

      // Control accesible
      const { lo, hi } = widthRange(S);
      range.min = String(lo);
      range.max = String(hi);
      range.value = String(w);
      range.setAttribute('aria-valuetext', summary);
      rangeVal.textContent = `${w} (alto ${hh})`;
      minusBtn.disabled = busy || w <= lo;
      plusBtn.disabled = busy || w >= hi;
    }

    function bumpArea() {
      renderer.pop(areaEl);
    }

    function renderLog(newKey = null) {
      const best = Math.max(0, ...[...attempts.values()].map((t) => t.area));
      const rows = [...attempts.values()].sort((a, b) => a.area - b.area);
      logList.replaceChildren(...rows.map((t) => {
        const isBest = t.area === best && rows.length > 1;
        return h('li', {
          class: `l5-try${isBest ? ' is-best' : ''}${t.key === newKey ? ' is-new' : ''}`,
        },
          h('span', { class: 'l5-try__eq' }, `${t.a} × ${t.b} = ${t.area}`),
          h('span', { class: 'l5-try__bar', 'aria-hidden': 'true' },
            h('i', { style: { '--w': `${Math.round((t.area / maxArea()) * 100)}%` } })),
          isBest
            ? h('span', { class: 'l5-try__star', role: 'img', 'aria-label': 'la que más cuadraditos encierra hasta ahora' },
              h('span', { 'aria-hidden': 'true' }, '⭐'))
            : h('span', { class: 'l5-try__star', 'aria-hidden': 'true' }));
      }));
    }

    /* ==========================================================
       Cambios de figura
       ========================================================== */
    /** Estira el vértice `key` a ancho w con el opuesto fijo. Devuelve true si cambió. */
    function stretchCorner(key, w) {
      const anchor = cornerPos(CORNERS[key].opp, rect);
      const next = rectFromAnchor(key, anchor.x, anchor.y, w, S);
      if (!inGrid(next)) return false;
      if (next.x === rect.x && next.y === rect.y && next.w === rect.w) return false;
      rect = { x: next.x, y: next.y, w: next.w, h: next.h };
      return true;
    }

    /** Elige el ancho válido cuyo vértice queda más cerca del puntero (en unidades de grilla). */
    function bestWidth(key, tx, ty) {
      const anchor = cornerPos(CORNERS[key].opp, rect);
      const { lo, hi } = widthRange(S);
      let best = null;
      for (let w = lo; w <= hi; w++) {
        const cand = rectFromAnchor(key, anchor.x, anchor.y, w, S);
        if (!inGrid(cand)) continue;
        const d = Math.hypot(cand.vx - tx, cand.vy - ty);
        if (!best || d < best.d - 1e-9 || (Math.abs(d - best.d) < 1e-9 && Math.abs(w - rect.w) < Math.abs(best.w - rect.w))) {
          best = { w, d };
        }
      }
      return best ? best.w : null;
    }

    /** Cambia el ancho conservando el centro (control accesible / ± ). */
    function setWidthCentered(w) {
      const { lo, hi } = widthRange(S);
      w = clamp(w, lo, hi);
      if (w === rect.w) return false;
      const cx = rect.x + rect.w / 2;
      const cy = rect.y + rect.h / 2;
      const hh = S - w;
      rect = {
        w,
        h: hh,
        x: clamp(Math.round(cx - w / 2), 0, GRID - w),
        y: clamp(Math.round(cy - hh / 2), 0, GRID - hh),
      };
      return true;
    }

    function markTouched() {
      if (touched) return;
      touched = true;
      board.classList.add('is-touched');
    }

    /** Registra la figura actual en "Lo que fuiste probando" y comenta. */
    function commit({ silent = false } = {}) {
      const key = keyOf();
      const sig = `${rect.x},${rect.y},${rect.w},${rect.h}`;
      if (!silent && sig === lastCommit) return;
      lastCommit = sig;
      const a = Math.min(rect.w, rect.h);
      const b = Math.max(rect.w, rect.h);
      const area = areaOf();
      const isNew = !attempts.has(key);
      const prevBest = Math.max(0, ...[...attempts.values()].map((t) => t.area));
      if (isNew) attempts.set(key, { key, a, b, area });
      renderLog(isNew ? key : null);
      if (silent) return;

      if (!isNew) {
        say('info', `Esa figura ya la probaste: ${area} ${ESCALA(area)}.`);
      } else if (area > prevBest) {
        say('good', `¡Más lugar! Ahora encerrás ${area} ${ESCALA(area)}.`);
      } else {
        say('info', `Con ${a} × ${b} encerrás ${area} ${ESCALA(area)}. Antes lograste ${prevBest}.`);
      }
    }

    function stepWidth(delta) {
      if (busy) return;
      if (setWidthCentered(rect.w + delta)) {
        markTouched();
        render();
        bumpArea();
        commit();
      }
    }

    /* ---------- Rango (alternativa sin arrastre) ---------- */
    range.addEventListener('input', () => {
      if (busy) return;
      if (setWidthCentered(Number(range.value))) {
        markTouched();
        render();
      }
    });
    range.addEventListener('change', () => {
      if (busy) return;
      commit();
      bumpArea();
    });

    /* ==========================================================
       Arrastre con Pointer Events (mouse y táctil)
       ========================================================== */
    function toGrid(e) {
      const m = board.getScreenCTM();
      if (!m) return null;
      const pt = board.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const p = pt.matrixTransform(m.inverse());
      return { x: (p.x - OX) / ST, y: (p.y - OY) / ST };
    }

    function onDown(e, key) {
      if (busy || drag) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const g = toGrid(e);
      if (!g) return;
      e.preventDefault();
      const el = verts[key].el;
      try { el.setPointerCapture(e.pointerId); } catch { /* algunos navegadores no capturan */ }
      el.focus({ preventScroll: true });
      const pos = cornerPos(key, rect);
      drag = { key, id: e.pointerId, ox: g.x - pos.x, oy: g.y - pos.y, moved: false };
      el.classList.add('is-active');
      board.classList.add('is-dragging');
    }

    function onMove(e, key) {
      if (!drag || drag.id !== e.pointerId || drag.key !== key) return;
      e.preventDefault();
      const g = toGrid(e);
      if (!g) return;
      const w = bestWidth(key, g.x - drag.ox, g.y - drag.oy);
      if (w !== null && stretchCorner(key, w)) {
        drag.moved = true;
        markTouched();
        render();
      }
    }

    function onUp(e, key) {
      if (!drag || drag.id !== e.pointerId || drag.key !== key) return;
      const el = verts[key].el;
      try { el.releasePointerCapture(e.pointerId); } catch { /* ya liberado */ }
      el.classList.remove('is-active');
      board.classList.remove('is-dragging');
      const moved = drag.moved;
      drag = null;
      if (moved) {
        commit();
        bumpArea();
      }
    }

    function onKey(e, key) {
      if (busy) return;
      const c = CORNERS[key];
      let dw;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        // Mover el vértice a la derecha agranda el ancho si el vértice está a la derecha.
        dw = (e.key === 'ArrowRight' ? 1 : -1) * (c.right ? 1 : -1);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        // Alto +1 ⇔ ancho −1 (el largo de la cuerda no cambia).
        const dh = (e.key === 'ArrowDown' ? 1 : -1) * (c.bottom ? 1 : -1);
        dw = -dh;
      } else return;
      e.preventDefault();
      const { lo, hi } = widthRange(S);
      if (stretchCorner(key, clamp(rect.w + dw, lo, hi))) {
        markTouched();
        render();
        bumpArea();
        commit();
      }
    }

    Object.values(verts).forEach(({ key, el }) => {
      el.addEventListener('pointerdown', (e) => onDown(e, key));
      el.addEventListener('pointermove', (e) => onMove(e, key));
      el.addEventListener('pointerup', (e) => onUp(e, key));
      el.addEventListener('pointercancel', (e) => onUp(e, key));
      el.addEventListener('lostpointercapture', (e) => onUp(e, key));
      el.addEventListener('keydown', (e) => onKey(e, key));
      // Evita que el navegador haga scroll mientras se arrastra un vértice en pantallas táctiles.
      el.addEventListener('touchmove', (e) => { if (drag) e.preventDefault(); }, { passive: false });
    });

    /* ==========================================================
       Rondas
       ========================================================== */
    function setBusy(value) {
      busy = value;
      [callBtn, hintBtn, range].forEach((el) => { el.disabled = value; });
      board.classList.toggle('is-locked', value);
      Object.values(verts).forEach(({ el }) => el.setAttribute('tabindex', value ? '-1' : '0'));
      render();
    }

    function loadRound() {
      const r = ROUNDS[roundIdx];
      P = r.perimeter;
      S = P / 2;
      rect = {
        w: r.start.w,
        h: r.start.h,
        x: Math.floor((GRID - r.start.w) / 2),
        y: Math.floor((GRID - r.start.h) / 2),
      };
      attempts = new Map();
      lastFail = null;
      lastCommit = null;
      drag = null;
      touched = false;
      board.classList.remove('is-touched', 'is-dragging');
      scene.classList.remove('is-landed');
      boardWrap.classList.remove('is-won');

      roundLabel.textContent = `Rescate ${roundIdx + 1} de ${ROUNDS.length}`;
      [...dots.children].forEach((dot, i) => {
        dot.classList.toggle('is-done', i < roundIdx);
        dot.classList.toggle('is-current', i === roundIdx);
      });

      cells.forEach((c) => { c.cell.style.transitionDelay = '0ms'; });
      setBusy(false);
      commit({ silent: true });
      say('info', roundIdx === 0
        ? 'Arrastrá las esquinas de la cuerda y mirá cuántos cuadraditos encierra.'
        : `Ahora la cuerda mide ${P} unidades. ¡Buscá la figura que encierre más cuadraditos!`);

      if (roundIdx > 0) {
        moveHeli(0, TAKEOFF_MS);
        renderer.pop(boardWrap);
      }
    }

    /* ==========================================================
       Acciones
       ========================================================== */
    function onHint() {
      if (busy) return;
      // La pista NO cuenta como falla: no se llama a ctx.fail().
      const text = 'Probá hacer los lados lo más parecidos posible.';
      ctx.hint(text);
      say('info', `Pista: ${text}`);
    }

    function onCall() {
      if (busy) return;
      const area = areaOf();

      if (area === maxArea()) {
        win();
        return;
      }

      // Misma figura que ya falló y no la tocó: no es un intento nuevo.
      if (lastFail === `${rect.x},${rect.y},${rect.w},${rect.h}`) {
        say('warm', 'Es la misma figura de recién. Estirá la cuerda y volvé a llamar al helicóptero.');
        return;
      }
      lastFail = `${rect.x},${rect.y},${rect.w},${rect.h}`;
      ctx.fail();
      heli.wob = 1;
      say('warm', 'Con esa cuerda el helicóptero necesita más lugar. ¿Podés lograr más cuadraditos sin cambiar el largo de la cuerda?');
    }

    function win() {
      const { w } = rect;
      const area = areaOf();
      const isLast = roundIdx === ROUNDS.length - 1;

      commit({ silent: true });
      setBusy(true);
      boardWrap.classList.add('is-won');
      renderer.pop(areaEl);
      say('good', `¡Aterrizó! Un cuadrado de ${w} × ${w} encierra ${area} cuadraditos: ¡el máximo con esta cuerda!`);

      moveHeli(1, LAND_MS, () => {
        scene.classList.add('is-landed');
        renderer.pop(scene);
        renderer.confetti(scene, 26);
      });

      later(() => {
        if (isLast) {
          ctx.success({
            message: '¡Rescate cumplido! Con la misma cuerda, el cuadrado es la figura que encierra más lugar: así aterrizó el helicóptero.',
          });
        } else {
          roundIdx += 1;
          loadRound();
        }
      }, WIN_DELAY);
    }

    loadRound();
    applyHeli(performance.now());

    cleanup = () => {
      alive = false;
      timers.forEach((id) => clearTimeout(id));
      timers.clear();
      offTick?.();
      drag = null;
    };
  },

  unmount() {
    cleanup?.();
    cleanup = null;
  },
};
