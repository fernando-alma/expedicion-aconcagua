/* ==========================================================
   level7.js — Nivel 7 · El Puente del Equilibrio (7° grado)
   ----------------------------------------------------------
   Objetivo: ecuaciones de primer grado con el modelo de la
   balanza. Platillo izquierdo = 2 cajas "X" + 5 kg; platillo
   derecho = 15 kg. El jugador aplica operaciones SIMÉTRICAS
   (quitar kilos / dividir a ambos lados) hasta dejar una sola
   caja X sola; las ASIMÉTRICAS desequilibran la balanza (se
   inclina con un resorte animado por ctx.onTick) y cuentan un
   intento fallido, pero se corrigen con "Deshacer".

   Modelo: cada platillo = { x: cajas X, k: kilos sueltos } con
   fracciones exactas (sin error de coma flotante). El valor de
   X es oculto: el ángulo de la viga sale del peso REAL.
   3 rondas: la 1 es siempre 2X + 5 = 15; las otras dos varían
   con randInt manteniendo soluciones enteras.
   ========================================================== */

import { h, fromHTML, clear, randInt, clamp, gcd, formatNumber } from '../core/utils.js';

const WIN_DELAY = 1400;
const MAX_STEPS_SHOWN = 5;

/* ---------- Estado de módulo (para limpiar en unmount) ---------- */
const timers = new Set();
let disposed = false;

function later(fn, ms) {
  const id = setTimeout(() => {
    timers.delete(id);
    if (!disposed) fn();
  }, ms);
  timers.add(id);
  return id;
}

/* ==========================================================
   FRACCIONES EXACTAS  { n, d }  (d > 0, reducidas)
   ========================================================== */
const F = (n, d = 1) => {
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
};
const fAdd = (a, b) => F(a.n * b.d + b.n * a.d, a.d * b.d);
const fSub = (a, b) => F(a.n * b.d - b.n * a.d, a.d * b.d);
const fMul = (a, b) => F(a.n * b.n, a.d * b.d);
const fDiv = (a, b) => F(a.n * b.d, a.d * b.n);
const fEq = (a, b) => a.n === b.n && a.d === b.d;
const fIsZero = (a) => a.n === 0;
const fPos = (a) => a.n > 0;
const fNum = (a) => a.n / a.d;
const ONE = F(1);
const ZERO = F(0);

/** "7,5" · "5" · "2/3" (si el decimal no termina). */
function fmt(f) {
  if (f.d === 1) return formatNumber(f.n);
  let d = f.d;
  while (d % 2 === 0) d /= 2;
  while (d % 5 === 0) d /= 5;
  return d === 1 ? formatNumber(f.n / f.d) : `${f.n}/${f.d}`;
}
const kg = (f) => `${fmt(f)} kg`;
const kilosSpeak = (f) => (fEq(f, ONE) ? '1 kilo' : `${fmt(f)} kilos`);

/* ==========================================================
   MODELO DE LA BALANZA
   ========================================================== */
const sideText = (p) => {
  const parts = [];
  if (!fIsZero(p.x)) parts.push(`${fEq(p.x, ONE) ? '' : fmt(p.x)}x`);
  if (!fIsZero(p.k)) parts.push(fmt(p.k));
  return parts.length ? parts.join(' + ') : '0';
};

const weightOf = (p, FX) => fAdd(fMul(p.x, FX), p.k);
const diffOf = (eq, FX) => fSub(weightOf(eq.A, FX), weightOf(eq.B, FX));
const isBalanced = (eq, FX) => fIsZero(diffOf(eq, FX));
const eqText = (eq, FX) =>
  `${sideText(eq.A)} ${isBalanced(eq, FX) ? '=' : '≠'} ${sideText(eq.B)}`;
const eqSpeak = (eq, FX) =>
  `${sideText(eq.A).replace(/\+/g, 'más')} ${isBalanced(eq, FX) ? 'igual a' : 'distinto de'} ${sideText(eq.B).replace(/\+/g, 'más')}`;

function sideSpeak(p) {
  const parts = [];
  if (fPos(p.x)) parts.push(`${fmt(p.x)} ${fEq(p.x, ONE) ? 'caja X' : 'cajas X'}`);
  if (fPos(p.k)) parts.push(kilosSpeak(p.k));
  return parts.length ? parts.join(' y ') : 'nada';
}

function describe(eq, FX) {
  const d = diffOf(eq, FX);
  const state = fIsZero(d)
    ? 'La balanza está equilibrada.'
    : `La balanza está desequilibrada: baja el lado ${d.n > 0 ? 'izquierdo' : 'derecho'}.`;
  return `A la izquierda: ${sideSpeak(eq.A)}. A la derecha: ${sideSpeak(eq.B)}. ${state}`;
}

/* Operaciones (puras: devuelven una ecuación nueva) */
const opRemoveBoth = (eq) => {
  const n = eq.A.k;
  return { A: { x: eq.A.x, k: fSub(eq.A.k, n) }, B: { x: eq.B.x, k: fSub(eq.B.k, n) } };
};
const opDivide = (eq) => {
  const m = eq.A.x;
  const div = (p) => ({ x: fDiv(p.x, m), k: fDiv(p.k, m) });
  return { A: div(eq.A), B: div(eq.B) };
};
const opRemoveLeft = (eq) => ({ A: { x: eq.A.x, k: ZERO }, B: eq.B });
const opRemoveRight = (eq) => ({ A: eq.A, B: { x: eq.B.x, k: fSub(eq.B.k, eq.A.k) } });

const isSolved = (eq, FX) =>
  isBalanced(eq, FX) && fEq(eq.A.x, ONE) && fIsZero(eq.A.k) && fIsZero(eq.B.x);

/* ---------- Rondas: a·X + k = a·X + k (X entero, oculto) ---------- */
function buildRounds() {
  const r2 = { a: 3, k: randInt(1, 6), X: randInt(3, 8) };
  const r3 = { a: 4, k: randInt(2, 9), X: randInt(3, 8) };
  return [{ a: 2, k: 5, X: 5 }, r2, r3];
}

/* ==========================================================
   DIBUJO SVG
   ========================================================== */
const PIVOT_X = 180;
const PIVOT_Y = 58;
const HOOK = 118;       // distancia del pivote al gancho de cada platillo
const DISH_TOP = 118;   // y del borde superior del plato (relativo al gancho)
const CRATE = 30;
const GAP = 4;
const WEIGHT_H = 28;
const MAX_ANGLE = 20;

const BEAM_SVG = `
<svg class="l7-svg" viewBox="0 4 360 286" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">
  <ellipse cx="180" cy="279" rx="126" ry="9" fill="#2D9CDB" opacity=".14"/>
  <rect x="104" y="250" width="152" height="26" rx="13" fill="#2D9CDB"/>
  <rect x="104" y="250" width="152" height="10" rx="5" fill="#fff" opacity=".24"/>
  <rect x="166" y="60" width="28" height="196" rx="14" fill="#1F82BD"/>
  <rect x="166" y="60" width="9" height="196" rx="4.5" fill="#fff" opacity=".16"/>
  <g class="l7-beam" transform="translate(${PIVOT_X} ${PIVOT_Y})">
    <rect x="-126" y="-9" width="252" height="18" rx="9" fill="#F2C94C"/>
    <rect x="-126" y="-9" width="252" height="7" rx="3.5" fill="#fff" opacity=".38"/>
    <circle cx="-${HOOK}" cy="0" r="5" fill="#D9A91F"/>
    <circle cx="${HOOK}" cy="0" r="5" fill="#D9A91F"/>
  </g>
  <circle cx="${PIVOT_X}" cy="${PIVOT_Y}" r="16" fill="#D9A91F"/>
  <circle cx="${PIVOT_X}" cy="${PIVOT_Y}" r="8" fill="#FDF3CF"/>
  ${['a', 'b'].map((side) => `
  <g class="l7-pan l7-pan--${side}" transform="translate(${PIVOT_X} ${PIVOT_Y})">
    <g class="l7-pan__sway">
      <path d="M0 0 L-54 ${DISH_TOP} M0 0 L54 ${DISH_TOP}" stroke="#9DB4C6" stroke-width="3" stroke-linecap="round" fill="none"/>
      <circle cx="0" cy="0" r="6" fill="#D9A91F"/>
      <path d="M-58 ${DISH_TOP} H58 Q58 ${DISH_TOP + 26} 34 ${DISH_TOP + 26} H-34 Q-58 ${DISH_TOP + 26} -58 ${DISH_TOP} Z" fill="${side === 'a' ? '#8CCBF0' : '#8FDBAF'}"/>
      <path d="M-58 ${DISH_TOP} H58 V${DISH_TOP + 5} H-58 Z" fill="#fff" opacity=".4"/>
      <g class="l7-items"></g>
    </g>
  </g>`).join('')}
</svg>`;

const item = (x, y, inner, cls) =>
  `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><g class="l7-item${cls}">${inner}</g></g>`;

function crateMarkup(x, y, frac, cls) {
  const w = Math.max(10, CRATE * frac);
  return item(x, y, `
    <rect width="${w}" height="${CRATE}" rx="8" fill="#F2C94C"/>
    <rect y="22" width="${w}" height="8" rx="6" fill="#D9A91F" opacity=".45"/>
    <rect width="${w}" height="9" rx="6" fill="#fff" opacity=".3"/>
    ${frac >= 0.5 ? `<text class="l7-crate__x" x="${w / 2}" y="24" text-anchor="middle">X</text>` : ''}`, cls);
}

function weightMarkup(x, y, w, label, cls, isResult) {
  const body = isResult ? '#27AE60' : '#2D9CDB';
  return item(x, y, `
    <rect width="${w}" height="${WEIGHT_H}" rx="10" fill="${body}"/>
    <rect width="${w}" height="11" rx="8" fill="#fff" opacity=".2"/>
    <text class="l7-weight__t" x="${w / 2}" y="19.5" text-anchor="middle">${label}</text>`, cls);
}

/** Caja que se "abre" y muestra el valor real de X. */
function openCrateMarkup(y, value) {
  const label = `${value} kg`;
  const sparks = [[-34, -6], [34, -14], [0, -34], [-26, -30], [28, -34]]
    .map(([sx, sy], i) => `<g transform="translate(${sx} ${sy})"><path class="l7-spark" style="--i:${i}" d="M0 -6 L1.7 -1.7 L6 0 L1.7 1.7 L0 6 L-1.7 1.7 L-6 0 L-1.7 -1.7Z" fill="#F2C94C"/></g>`)
    .join('');
  return `
  <g transform="translate(0 ${y})">
    ${sparks}
    <g transform="translate(-23 0)">
      <g class="l7-lid"><rect x="2" y="-5" width="44" height="9" rx="4.5" fill="#D9A91F"/></g>
      <rect width="46" height="42" rx="11" fill="#F2C94C"/>
      <rect x="3" y="0" width="40" height="7" rx="3.5" fill="#B98A12" opacity=".5"/>
      <rect y="32" width="46" height="10" rx="7" fill="#D9A91F" opacity=".45"/>
      <rect x="4" y="6" width="38" height="26" rx="9" fill="#fff" opacity=".92"/>
      <text class="l7-crate__v" x="23" y="25" text-anchor="middle">${label}</text>
    </g>
  </g>`;
}

/** Contenido de un platillo: pesa grande abajo, cajas apiladas arriba. */
function panMarkup(p, { solved = false, resultSide = false, value = '' } = {}, animate = false) {
  const cls = animate ? ' l7-item--new' : '';
  let y = DISH_TOP - 1;
  let out = '';

  if (fPos(p.k)) {
    const label = kg(p.k);
    const w = clamp(Math.round(20 + label.length * 9.2), 60, 100);
    y -= WEIGHT_H;
    out += weightMarkup(-w / 2, y, w, label, cls, solved && resultSide);
    y -= 1;
  }

  const xs = fNum(p.x);
  if (xs > 0) {
    if (solved && fEq(p.x, ONE)) {
      y -= 42;
      out += openCrateMarkup(y, value);
    } else {
      const full = Math.floor(xs + 1e-9);
      const part = xs - full;
      const total = full + (part > 1e-9 ? 1 : 0);
      const rows = Math.ceil(total / 3);
      const perRow = Math.ceil(total / rows);
      let idx = 0;
      for (let r = 0; r < rows; r++) {
        const m = Math.min(perRow, total - idx);
        const width = m * CRATE + (m - 1) * GAP;
        y -= CRATE;
        for (let c = 0; c < m; c++) {
          const frac = idx + 1 > full ? part : 1;
          out += crateMarkup(-width / 2 + c * (CRATE + GAP), y, frac, cls);
          idx++;
        }
        y -= GAP;
      }
    }
  }
  return out;
}

/* ---------- Glifo de cada botón de operación ---------- */
function glyph(kind) {
  const on = 'l7-glyph__dot l7-glyph__dot--on';
  const off = 'l7-glyph__dot';
  const l = kind === 'right' ? off : on;
  const r = kind === 'left' ? off : on;
  return `
<svg viewBox="0 0 44 30" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">
  <path d="M8 10H36M22 6V26" stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none"/>
  <circle class="${l}" cx="8" cy="20" r="6"/>
  <circle class="${r}" cx="36" cy="20" r="6"/>
</svg>`;
}

/* ==========================================================
   NIVEL
   ========================================================== */
export default {
  id: 7,
  grade: '7°',
  title: 'El Puente del Equilibrio',
  subtitle: 'Despejá la X con la balanza',
  available: true,

  icon() {
    return `
<svg viewBox="0 0 96 80" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Balanza de platillos">
  <ellipse cx="48" cy="77" rx="26" ry="3" fill="#2D9CDB" opacity=".16"/>
  <rect x="26" y="67" width="44" height="10" rx="5" fill="#2D9CDB"/>
  <rect x="26" y="67" width="44" height="4" rx="2" fill="#fff" opacity=".25"/>
  <rect x="43" y="18" width="10" height="52" rx="5" fill="#1F82BD"/>
  <g transform="rotate(-8 48 18)">
    <rect x="14" y="15" width="68" height="6" rx="3" fill="#F2C94C"/>
    <rect x="14" y="15" width="68" height="2.4" rx="1.2" fill="#fff" opacity=".4"/>
  </g>
  <path d="M14.3 22.7 3 48M14.3 22.7 25.6 48" stroke="#9DB4C6" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M81.7 13.3 70.4 38.6M81.7 13.3 93 38.6" stroke="#9DB4C6" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M3 48h22.6q0 7-6 7H9q-6 0-6-7z" fill="#8CCBF0"/>
  <path d="M70.4 38.6H93q0 7-6 7H76.4q-6 0-6-7z" fill="#8FDBAF"/>
  <rect x="7.5" y="35" width="14" height="13" rx="3.5" fill="#F2C94C"/>
  <path d="M11.2 38.5l6.6 6.2m0-6.2-6.6 6.2" stroke="#7A5C08" stroke-width="1.8" stroke-linecap="round"/>
  <rect x="74.5" y="29.4" width="14" height="9.2" rx="3.4" fill="#2D9CDB"/>
  <circle cx="48" cy="18" r="6.5" fill="#D9A91F"/>
  <circle cx="48" cy="18" r="3" fill="#FDF3CF"/>
</svg>`;
  },

  mount(root, ctx) {
    disposed = false;
    timers.clear();

    const rounds = buildRounds();
    const reduceMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const st = {
      round: 0,
      FX: ZERO,
      X: 0,
      init: null,
      eq: null,
      history: [],
      busy: false,
      solved: false,
      sig: { a: '', b: '' },
    };
    const anim = { angle: 0, vel: 0, target: 0, settled: true };

    /* ---------- Cabecera: ronda + pista ---------- */
    const roundLabel = h('span', { class: 'l7-round__label' });
    const dots = h('span', { class: 'l7-dots', 'aria-hidden': 'true' },
      rounds.map(() => h('span', { class: 'l7-dot' })));
    const hintBtn = h('button', {
      type: 'button',
      class: 'btn btn--accent btn--sm l7-hint',
      'aria-label': 'Pista: qué operación conviene hacer ahora',
      onClick: () => onHint(),
    }, 'Pista');

    const top = h('div', { class: 'l7-top' },
      h('div', { class: 'l7-round' }, roundLabel, dots),
      hintBtn);

    const instruction = h('p', { class: 'l7-instruction' },
      'Dejá una sola caja X sola en un platillo para descubrir cuánto pesa. ',
      h('strong', {}, 'Lo que hacés de un lado, hacelo también del otro.'));

    /* ---------- Balanza ---------- */
    const svg = fromHTML(BEAM_SVG);
    const beamEl = svg.querySelector('.l7-beam');
    const pans = {
      a: svg.querySelector('.l7-pan--a'),
      b: svg.querySelector('.l7-pan--b'),
    };
    const swayEls = { a: pans.a.querySelector('.l7-pan__sway'), b: pans.b.querySelector('.l7-pan__sway') };
    const itemsEls = { a: pans.a.querySelector('.l7-items'), b: pans.b.querySelector('.l7-items') };

    const svgWrap = h('div', { class: 'l7-svgwrap', role: 'img' }, svg);
    const statusDot = h('span', { class: 'l7-status__dot', 'aria-hidden': 'true' });
    const statusText = h('span', { class: 'l7-status__text' });
    const status = h('div', { class: 'l7-status', 'aria-hidden': 'true' }, statusDot, statusText);

    const scaleCard = h('div', { class: 'l7-scale' }, svgWrap, status);

    const equation = h('div', { class: 'l7-equation', role: 'img' });
    const live = h('p', { class: 'sr-only', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
    const feedback = h('div', { class: 'l7-feedback', role: 'status', 'aria-live': 'polite' });

    const left = h('section', { class: 'l7-left', 'aria-label': 'Balanza y ecuación' },
      scaleCard, equation, feedback, live);

    /* ---------- Controles ---------- */
    const makeOp = (kind, extraClass, onClick) => {
      const label = h('span', { class: 'l7-op__label' });
      const sub = h('span', { class: 'l7-op__sub' });
      const btn = h('button', { type: 'button', class: `l7-op ${extraClass}`, onClick },
        h('span', { class: 'l7-op__glyph', 'aria-hidden': 'true', html: glyph(kind) }),
        h('span', { class: 'l7-op__text' }, label, sub));
      return { btn, label, sub };
    };

    const ops = {
      both: makeOp('both', 'l7-op--sym', () => doOp('both')),
      divide: makeOp('both', 'l7-op--sym l7-op--divide', () => doOp('divide')),
      left: makeOp('left', 'l7-op--asym', () => doOp('left')),
      right: makeOp('right', 'l7-op--asym', () => doOp('right')),
    };

    const undoBtn = h('button', {
      type: 'button',
      class: 'btn btn--ghost btn--sm l7-undo',
      'aria-label': 'Deshacer el último paso',
      onClick: () => onUndo(),
    }, 'Deshacer');
    const resetBtn = h('button', {
      type: 'button',
      class: 'btn btn--ghost btn--sm l7-reset',
      'aria-label': 'Empezar de nuevo esta balanza',
      onClick: () => onReset(),
    }, 'Empezar de nuevo');

    const stepsList = h('ol', { class: 'l7-steps', 'aria-label': 'Pasos que hiciste' });

    const right = h('aside', { class: 'l7-right', 'aria-label': 'Operaciones' },
      h('div', { class: 'l7-group l7-group--sym', role: 'group', 'aria-label': 'Operaciones en los dos platillos' },
        h('h2', { class: 'l7-group__title' }, 'En los dos platillos'),
        h('div', { class: 'l7-group__ops' }, ops.both.btn, ops.divide.btn)),
      h('div', { class: 'l7-group l7-group--asym', role: 'group', 'aria-label': 'Operaciones en un solo platillo' },
        h('h2', { class: 'l7-group__title' }, 'Solo de un lado ',
          h('span', { class: 'l7-group__tag' }, 'cuidado')),
        h('div', { class: 'l7-group__ops l7-group__ops--two' }, ops.left.btn, ops.right.btn)),
      h('div', { class: 'l7-util' }, undoBtn, resetBtn),
      h('div', { class: 'l7-history' },
        h('h2', { class: 'l7-group__title' }, 'Tus pasos'),
        stepsList));

    root.append(h('div', { class: 'l7' },
      top, instruction,
      h('div', { class: 'l7-layout' }, left, right)));

    /* ---------- Mensajes ---------- */
    function say(tone, text) {
      feedback.className = `l7-feedback l7-feedback--${tone}`;
      feedback.replaceChildren(h('span', { class: 'l7-feedback__msg' }, text));
    }
    function clearFeedback() {
      feedback.className = 'l7-feedback';
      feedback.replaceChildren();
    }

    /* ---------- Animación de la viga (resorte) ---------- */
    function targetAngle() {
      const d = diffOf(st.eq, st.FX);
      if (fIsZero(d)) return 0;
      const mag = clamp(8 + Math.abs(fNum(d)) * 1.2, 8, MAX_ANGLE);
      return d.n > 0 ? -mag : mag; // más peso a la izquierda → baja la izquierda (giro antihorario)
    }

    function place(angle, sway = 0) {
      const r = (angle * Math.PI) / 180;
      const c = Math.cos(r);
      const s = Math.sin(r);
      if (Math.abs(angle) < 0.005) angle = 0; // evita "-0.00"
      beamEl.setAttribute('transform', `translate(${PIVOT_X} ${PIVOT_Y}) rotate(${angle.toFixed(2)})`);
      pans.a.setAttribute('transform', `translate(${(PIVOT_X - HOOK * c).toFixed(2)} ${(PIVOT_Y - HOOK * s).toFixed(2)})`);
      pans.b.setAttribute('transform', `translate(${(PIVOT_X + HOOK * c).toFixed(2)} ${(PIVOT_Y + HOOK * s).toFixed(2)})`);
      swayEls.a.setAttribute('transform', `rotate(${sway.toFixed(2)})`);
      swayEls.b.setAttribute('transform', `rotate(${sway.toFixed(2)})`);
    }

    ctx.onTick((dt) => {
      if (anim.settled || disposed) return;
      const reduce = reduceMq?.matches;
      if (reduce) {
        anim.angle = anim.target;
        anim.vel = 0;
      } else {
        const K = 70;   // rigidez del resorte
        const C = 8;    // amortiguación (rebote leve)
        anim.vel += (K * (anim.target - anim.angle) - C * anim.vel) * dt;
        anim.angle += anim.vel * dt;
      }
      const done = Math.abs(anim.target - anim.angle) < 0.03 && Math.abs(anim.vel) < 0.15;
      if (done) {
        anim.angle = anim.target;
        anim.vel = 0;
        anim.settled = true;
      }
      place(anim.angle, reduce || done ? 0 : clamp(-anim.vel * 0.1, -6, 6));
    });

    function setTarget(angle) {
      anim.target = angle;
      anim.settled = false;
      if (reduceMq?.matches) { anim.angle = angle; anim.vel = 0; place(angle); anim.settled = true; }
    }

    /* ---------- Render ---------- */
    function renderPans({ force = false } = {}) {
      const value = fmt(st.FX);
      const defs = [
        ['a', st.eq.A, { solved: st.solved, resultSide: false, value }],
        ['b', st.eq.B, { solved: st.solved, resultSide: true, value }],
      ];
      defs.forEach(([key, p, opts]) => {
        const sig = `${p.x.n}/${p.x.d}|${p.k.n}/${p.k.d}|${opts.solved ? 1 : 0}`;
        if (!force && sig === st.sig[key]) return;
        const animate = !force || st.sig[key] !== '';
        st.sig[key] = sig;
        itemsEls[key].innerHTML = panMarkup(p, opts, animate); // solo números calculados por el juego
      });
    }

    function renderEquation() {
      const balanced = isBalanced(st.eq, st.FX);
      const sideNodes = (p) => {
        const nodes = [];
        if (!fIsZero(p.x)) {
          nodes.push(h('span', { class: 'l7-eq__x' }, `${fEq(p.x, ONE) ? '' : fmt(p.x)}x`));
        }
        if (!fIsZero(p.k)) {
          if (nodes.length) nodes.push(h('span', { class: 'l7-eq__op' }, '+'));
          nodes.push(h('span', { class: 'l7-eq__n' }, fmt(p.k)));
        }
        if (!nodes.length) nodes.push(h('span', { class: 'l7-eq__n' }, '0'));
        return h('span', { class: 'l7-eq__side' }, nodes);
      };
      equation.classList.toggle('is-off', !balanced);
      equation.classList.toggle('is-solved', st.solved);
      equation.setAttribute('aria-label', `Ecuación: ${eqSpeak(st.eq, st.FX)}`);
      equation.replaceChildren(
        h('span', { class: 'l7-eq', 'aria-hidden': 'true' },
          sideNodes(st.eq.A),
          h('span', { class: 'l7-eq__sign' }, balanced ? '=' : '≠'),
          sideNodes(st.eq.B)));
    }

    function renderStatus() {
      const d = diffOf(st.eq, st.FX);
      const balanced = fIsZero(d);
      status.classList.toggle('is-off', !balanced);
      statusText.textContent = balanced
        ? 'Balanza equilibrada'
        : `Pesa más el lado ${d.n > 0 ? 'izquierdo' : 'derecho'}`;
    }

    function setOp(op, { label, sub, disabled }) {
      op.label.textContent = label;
      op.sub.textContent = sub;
      op.btn.disabled = disabled;
      op.btn.setAttribute('aria-label', `${label}. ${sub}`);
    }

    function renderOps() {
      const { A } = st.eq;
      const balanced = isBalanced(st.eq, st.FX);
      const locked = st.busy || !balanced;
      const lockedSub = st.busy ? '¡Un momento!' : 'Primero deshacé el último paso';
      const hasKilos = fPos(A.k);
      const canDivide = fNum(A.x) > 1;
      const n = kg(A.k);

      setOp(ops.both, {
        label: hasKilos ? `Quitar ${n} a ambos lados` : 'Quitar kilos a ambos lados',
        sub: locked ? lockedSub : hasKilos ? 'La balanza sigue equilibrada' : 'Ya no hay kilos sueltos con las cajas',
        disabled: locked || !hasKilos,
      });
      setOp(ops.divide, {
        label: canDivide ? `Dividir por ${fmt(A.x)} a ambos lados` : 'Dividir a ambos lados',
        sub: locked ? lockedSub : canDivide ? `${fmt(A.x)} cajas pasan a ser 1` : 'Hace falta más de una caja X',
        disabled: locked || !canDivide,
      });
      setOp(ops.left, {
        label: hasKilos ? `Quitar ${n} solo de la izquierda` : 'Quitar kilos solo de la izquierda',
        sub: locked ? lockedSub : hasKilos ? 'Mirá qué pasa con la balanza' : 'No hay kilos sueltos',
        disabled: locked || !hasKilos,
      });
      setOp(ops.right, {
        label: hasKilos ? `Quitar ${n} solo de la derecha` : 'Quitar kilos solo de la derecha',
        sub: locked ? lockedSub : hasKilos ? 'Mirá qué pasa con la balanza' : 'No hay kilos sueltos',
        disabled: locked || !hasKilos,
      });

      undoBtn.disabled = st.busy || st.history.length === 0;
      resetBtn.disabled = st.busy || st.history.length === 0;
      hintBtn.disabled = st.busy;
    }

    function renderSteps() {
      const shown = st.history.slice(-MAX_STEPS_SHOWN);
      const offset = st.history.length - shown.length;
      if (!shown.length) {
        stepsList.replaceChildren(h('li', { class: 'l7-step l7-step--empty' }, 'Todavía no hiciste ningún paso.'));
        return;
      }
      stepsList.replaceChildren(...shown.map((s, i) =>
        h('li', { class: `l7-step${s.asym ? ' l7-step--warn' : ''}` },
          h('span', { class: 'l7-step__n', 'aria-hidden': 'true' }, String(offset + i + 1)),
          h('span', { class: 'l7-step__t' }, s.text))));
    }

    function renderAll({ force = false } = {}) {
      renderPans({ force });
      renderEquation();
      renderStatus();
      renderOps();
      renderSteps();
      const desc = describe(st.eq, st.FX);
      svgWrap.setAttribute('aria-label', desc);
      live.textContent = desc;
      setTarget(targetAngle());
    }

    /** En pantallas angostas la balanza queda lejos de los botones: la traemos a la vista. */
    function ensureScaleVisible() {
      if (window.innerWidth >= 860) return;
      const r = scaleCard.getBoundingClientRect();
      if (r.top >= 0 && r.bottom <= window.innerHeight) return;
      scaleCard.scrollIntoView({ block: 'start', behavior: reduceMq?.matches ? 'auto' : 'smooth' });
    }

    function keepFocus() {
      const a = document.activeElement;
      if (a && a !== document.body && !a.disabled && root.contains(a)) return;
      const next = [ops.divide.btn, ops.both.btn, undoBtn, hintBtn].find((b) => !b.disabled);
      next?.focus({ preventScroll: true });
    }

    /* ---------- Ronda ---------- */
    function loadRound() {
      const r = rounds[st.round];
      st.X = r.X;
      st.FX = F(r.X);
      st.init = {
        A: { x: F(r.a), k: F(r.k) },
        B: { x: ZERO, k: F(r.a * r.X + r.k) },
      };
      st.eq = st.init;
      st.history = [];
      st.busy = false;
      st.solved = false;
      st.sig = { a: '', b: '' };

      roundLabel.textContent = `Ronda ${st.round + 1} de ${rounds.length}`;
      [...dots.children].forEach((dot, i) => {
        dot.classList.toggle('is-done', i < st.round);
        dot.classList.toggle('is-current', i === st.round);
      });

      clearFeedback();
      // Arranca con un pequeño vaivén que se asienta en equilibrio.
      anim.angle = st.round % 2 === 0 ? 6 : -6;
      anim.vel = 0;
      place(anim.angle);
      renderAll({ force: true });
      if (st.round > 0) ctx.renderer.pop(scaleCard);
    }

    /* ---------- Acciones ---------- */
    function doOp(kind) {
      if (st.busy || !isBalanced(st.eq, st.FX)) return;
      const before = st.eq;
      const n = kg(before.A.k);
      let after;
      let verb;
      let asym = false;

      if (kind === 'both') {
        if (!fPos(before.A.k)) return;
        after = opRemoveBoth(before);
        verb = `Quitaste ${n} a ambos lados`;
      } else if (kind === 'divide') {
        if (!(fNum(before.A.x) > 1)) return;
        after = opDivide(before);
        verb = `Dividiste todo por ${fmt(before.A.x)}`;
      } else if (kind === 'left') {
        if (!fPos(before.A.k)) return;
        after = opRemoveLeft(before);
        verb = `Quitaste ${n} solo de la izquierda`;
        asym = true;
      } else {
        if (!fPos(before.A.k)) return;
        after = opRemoveRight(before);
        verb = `Quitaste ${n} solo de la derecha`;
        asym = true;
      }

      st.eq = after;
      st.history.push({ snapshot: before, text: `${verb} → ${eqText(after, st.FX)}`, asym });

      if (asym) {
        // Un intento incorrecto real: una sola vez por operación asimétrica.
        ctx.fail();
        say('warm', '¡Se desequilibró! Lo que hacés de un lado, hacelo también del otro. Tocá «Deshacer» para volver.');
        renderAll();
        undoBtn.focus({ preventScroll: true });
        ensureScaleVisible();
        return;
      }

      if (isSolved(after, st.FX)) {
        win();
        return;
      }

      say('good', kind === 'both'
        ? `¡Muy bien! Quitaste ${n} de los dos lados y la balanza sigue equilibrada.`
        : `¡Bien! Dividiste los dos lados por ${fmt(before.A.x)} y la balanza sigue equilibrada.`);
      renderAll();
      ctx.renderer.pop(equation);
      keepFocus();
    }

    function onUndo() {
      if (st.busy || !st.history.length) return;
      const last = st.history.pop();
      st.eq = last.snapshot;
      if (last.asym) say('info', '¡Listo! La balanza volvió al equilibrio.');
      else say('info', 'Deshiciste el último paso.');
      renderAll();
      ctx.renderer.pop(equation);
      keepFocus();
      if (last.asym) ensureScaleVisible();
    }

    function onReset() {
      if (st.busy || !st.history.length) return;
      st.eq = st.init;
      st.history = [];
      say('info', 'Empezaste de nuevo. ¡La balanza está como al principio!');
      renderAll();
      ctx.renderer.pop(equation);
      keepFocus();
    }

    function onHint() {
      if (st.busy) return;
      const { A } = st.eq;
      let text;
      if (!isBalanced(st.eq, st.FX)) {
        text = 'Deshacé el último paso: lo que hacés de un lado, hacelo también del otro.';
      } else if (fPos(A.k)) {
        text = `Primero sacá los ${kg(A.k)} sueltos del platillo de las cajas, de los dos lados.`;
      } else if (fNum(A.x) > 1) {
        text = `Ahora hay ${fmt(A.x)} cajas X iguales. Dividí todo por ${fmt(A.x)}, de los dos lados, para dejar una sola.`;
      } else {
        text = 'Dejá la caja X sola en un platillo y mirá cuánto pesa del otro lado.';
      }
      // La pista NO cuenta como falla: no se llama a ctx.fail().
      ctx.hint(text);
      say('info', `Pista: ${text}`);
    }

    function win() {
      const isLast = st.round === rounds.length - 1;
      st.busy = true;
      st.solved = true;
      renderAll();
      ctx.renderer.pop(equation);
      ctx.renderer.pop(scaleCard);
      say('good', `¡Equilibrio perfecto! Cada caja X pesa ${kg(st.FX)}. Es decir, x = ${fmt(st.FX)}.`);
      live.textContent = `${describe(st.eq, st.FX)} ¡Lo lograste! Cada caja X pesa ${kilosSpeak(st.FX)}.`;

      later(() => {
        if (isLast) {
          ctx.success({
            message: '¡Cruzaste el Puente del Equilibrio! Ya sabés despejar la X haciendo lo mismo en los dos lados de la balanza.',
          });
        } else {
          st.round += 1;
          loadRound();
        }
      }, WIN_DELAY);
    }

    loadRound();
  },

  unmount() {
    disposed = true;
    timers.forEach((id) => clearTimeout(id));
    timers.clear();
  },
};
