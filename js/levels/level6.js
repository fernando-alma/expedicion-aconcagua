/* ==========================================================
   level6.js — Nivel 6 · Análisis Climático (6° grado)
   ----------------------------------------------------------
   Objetivo: números enteros negativos. Leer un gráfico de barras
   con una línea del 0 °C (las barras positivas crecen hacia arriba
   y las negativas hacia abajo) y comparar / ordenar enteros.

   3 rondas, cada una con una pregunta que trabaja el orden:
     1) Lun −15, Mar −5, Mié 2, Jue −1 → ¿qué día hará MÁS calor?
     2) 5 días, todas negativas y distintas → ¿más calor?
        (la trampa: la más cercana al cero es la más cálida)
     3) 5 días, mezcla de negativas y positivas → ¿MÁS frío?
   ========================================================== */

import { h, fromHTML, randInt, shuffle, clamp } from '../core/utils.js';

const TOTAL_ROUNDS = 3;
const WIN_DELAY = 1400;       // ms antes de pasar a la ronda siguiente
const STEP = 5;               // graduación del eje vertical (°C)

const MINUS = '−';       // signo menos tipográfico
const NBSP = ' ';

/* ---------- Formato ---------- */
const fmt = (n) => (n < 0 ? `${MINUS}${Math.abs(n)}` : String(n));
const deg = (n) => `${fmt(n)}${NBSP}°C`;
const spoken = (n) => {
  const a = Math.abs(n);
  const unit = a === 1 ? 'grado' : 'grados';
  return n < 0 ? `menos ${a} ${unit}` : `${a} ${unit}`;
};

const DAYS = [
  { full: 'Lunes', short: 'Lun' },
  { full: 'Martes', short: 'Mar' },
  { full: 'Miércoles', short: 'Mié' },
  { full: 'Jueves', short: 'Jue' },
  { full: 'Viernes', short: 'Vie' },
];

/* ---------- Escala de color: azul (frío) → amarillo / naranja (cálido) ---------- */
const COLOR_STOPS = [
  [-20, [63, 111, 208]],
  [-10, [45, 156, 219]],
  [-1, [143, 203, 234]],
  [1, [247, 220, 122]],
  [10, [242, 153, 74]],
];

function tempColor(t) {
  const x = clamp(t, COLOR_STOPS[0][0], COLOR_STOPS[COLOR_STOPS.length - 1][0]);
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const [t0, c0] = COLOR_STOPS[i];
    const [t1, c1] = COLOR_STOPS[i + 1];
    if (x <= t1) {
      const k = (x - t0) / (t1 - t0);
      const rgb = c0.map((v, j) => Math.round(v + (c1[j] - v) * k));
      return `rgb(${rgb.join(',')})`;
    }
  }
  return 'rgb(242,153,74)';
}

/* ---------- Íconos de clima (SVG propios, sin <defs>/ids) ---------- */
const SVG_SUN = `
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">
  <g stroke="#F2C94C" stroke-width="2.2" stroke-linecap="round">
    <path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M18.7 5.3 17 7M7 17l-1.7 1.7"/>
  </g>
  <circle cx="12" cy="12" r="5.2" fill="#F2C94C"/>
  <circle cx="10.4" cy="10.4" r="1.6" fill="#fff" opacity=".6"/>
</svg>`;

const SVG_CLOUD = `
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">
  <path d="M7 18.5a4.2 4.2 0 0 1-.4-8.4 5.6 5.6 0 0 1 10.8 1.4 3.5 3.5 0 0 1-.4 7z" fill="#B9D6EA"/>
  <path d="M7 18.5a4.2 4.2 0 0 1-.4-8.4 5.6 5.6 0 0 1 5.4-3.6c-3.2 1.6-3.4 7.2-1.6 12z" fill="#fff" opacity=".45"/>
</svg>`;

const SVG_SNOW = `
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">
  <g stroke="#6FB6E6" stroke-width="2.2" stroke-linecap="round">
    <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/>
    <path d="M9.6 4.6 12 6.6l2.4-2M9.6 19.4 12 17.4l2.4 2" stroke-width="1.6"/>
  </g>
</svg>`;

const weatherIcon = (t) => (t > 0 ? SVG_SUN : t <= -10 ? SVG_SNOW : SVG_CLOUD);

/* ---------- Ícono del mapa ---------- */
const THERMOMETER_ICON = `
<svg viewBox="0 0 96 80" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Termómetro">
  <rect x="37" y="2" width="22" height="56" rx="11" fill="#2D9CDB"/>
  <circle cx="48" cy="62" r="16" fill="#2D9CDB"/>
  <rect x="41" y="6" width="14" height="52" rx="7" fill="#fff"/>
  <circle cx="48" cy="62" r="11" fill="#fff"/>
  <rect x="44.5" y="24" width="7" height="38" rx="3.5" fill="#EB5757"/>
  <circle cx="48" cy="62" r="7.5" fill="#EB5757"/>
  <circle cx="45.5" cy="59" r="2.2" fill="#fff" opacity=".55"/>
  <path d="M64 12h8M64 22h8M64 32h8M64 42h8" stroke="#9DB4C6" stroke-width="3" stroke-linecap="round"/>
  <path d="M17 40v22M7.5 45.5l19 11M7.5 56.5l19-11" stroke="#8CCBF2" stroke-width="3.2" stroke-linecap="round"/>
  <g stroke="#F2C94C" stroke-width="2.6" stroke-linecap="round">
    <path d="M80 4v3M80 25v3M69 15.5h3M88 15.5h3M72.2 7.7l2.1 2.1M85.7 21.2l2.1 2.1M87.8 7.7l-2.1 2.1M74.3 21.2l-2.1 2.1"/>
  </g>
  <circle cx="80" cy="15.5" r="6.2" fill="#F2C94C"/>
</svg>`;

/* ==========================================================
   GENERACIÓN DE RONDAS
   ========================================================== */
function distinct(count, min, max, taken = new Set()) {
  const out = [];
  while (out.length < count) {
    const n = randInt(min, max);
    if (!taken.has(n)) { taken.add(n); out.push(n); }
  }
  return out;
}

function buildRounds() {
  // Ronda 2: cinco temperaturas negativas, todas distintas.
  const negatives = distinct(5, -20, -1);

  // Ronda 3: mezcla de negativas y positivas (al menos 1 de cada), distintas y sin 0.
  const posCount = randInt(1, 2);
  const mixed = shuffle([
    ...distinct(posCount, 1, 7),
    ...distinct(5 - posCount, -14, -1),
  ]);

  return [
    { ask: 'hot', days: DAYS.slice(0, 4), temps: [-15, -5, 2, -1] },
    { ask: 'hot', days: DAYS, temps: negatives },
    { ask: 'cold', days: DAYS, temps: mixed },
  ];
}

/** Eje vertical con margen para las etiquetas; siempre incluye el 0. */
function axisFor(temps) {
  const lo = Math.min(...temps, 0);
  const hi = Math.max(...temps, 0);
  const min = lo < 0 ? Math.floor((lo - 3) / STEP) * STEP : 0;
  const max = Math.max(STEP, Math.ceil((hi + 3) / STEP) * STEP);
  const ticks = [];
  for (let t = min; t <= max; t += STEP) ticks.push(t);
  return { min, max, range: max - min, ticks };
}

/* ==========================================================
   MENSAJES
   ========================================================== */
const sortedAsc = (temps) => [...temps].sort((a, b) => a - b);

function winMessage(ask, t, temps) {
  const others = temps.filter((x) => x !== t);
  if (ask === 'hot') {
    if (t > 0 && others.every((x) => x < 0)) {
      return `¡Sí! ${deg(t)} es mayor que todas las temperaturas bajo cero.`;
    }
    if (t > 0) {
      return `¡Sí! ${deg(t)} está más arriba que todas las demás en la recta numérica.`;
    }
    return `¡Sí! ${deg(t)} es la que está más cerca del cero, así que es la más alta de todas.`;
  }
  if (t < 0) {
    return `¡Sí! ${deg(t)} es la que está más lejos del cero, hacia abajo: es la más baja, ¡la más fría!`;
  }
  return `¡Sí! ${deg(t)} es la más baja de todas, así que es la más fría.`;
}

/** Mensaje amable que enseña por qué la barra elegida no es la buscada. */
function missMessage(ask, c, temps) {
  const asc = sortedAsc(temps);
  if (ask === 'hot') {
    const d = asc.find((x) => x > c); // la siguiente más alta
    if (c < 0 && d < 0) {
      return `Fijate: ${deg(c)} está más lejos del cero que ${deg(d)}, así que hace MÁS frío. Buscá una temperatura que esté más cerca del cero o sobre él.`;
    }
    if (c < 0) {
      return `Fijate: ${deg(c)} está bajo cero y ${deg(d)} está sobre el cero, así que ${deg(d)} hace más calor. Buscá una temperatura más alta.`;
    }
    return `Fijate: ${deg(d)} es mayor que ${deg(c)}, así que hace más calor. Buscá una temperatura más alta.`;
  }
  const d = [...asc].reverse().find((x) => x < c); // la siguiente más baja
  if (c > 0 && d > 0) {
    return `Fijate: ${deg(d)} es menor que ${deg(c)}, así que hace MÁS frío. Buscá una temperatura más baja.`;
  }
  if (c > 0) {
    return `Fijate: ${deg(c)} está sobre el cero y ${deg(d)} está bajo cero, así que ${deg(d)} hace MÁS frío. Buscá una temperatura más baja.`;
  }
  return `Fijate: ${deg(d)} está más lejos del cero que ${deg(c)}, así que hace MÁS frío. Buscá una temperatura que esté todavía más abajo del cero.`;
}

const HINT_TEXT = 'En la recta numérica, cuanto más a la derecha (o más arriba), mayor es el número.';

/* ==========================================================
   TERMÓMETRO LATERAL (decorativo)
   ========================================================== */
function thermoSVG(t, axis) {
  const level = (v) => 100 - clamp((v - axis.min) / axis.range, 0, 1) * 92;
  const top = level(t);
  const zero = level(0);
  const color = tempColor(t);
  return `
<svg viewBox="0 0 56 130" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">
  <rect x="21" y="2" width="14" height="104" rx="7" fill="#9CCDEA"/>
  <circle cx="28" cy="110" r="16" fill="#9CCDEA"/>
  <rect x="24" y="5" width="8" height="100" rx="4" fill="#fff"/>
  <circle cx="28" cy="110" r="12" fill="#fff"/>
  <rect x="25.5" y="${top.toFixed(1)}" width="5" height="${(112 - top).toFixed(1)}" rx="2.5" fill="${color}"/>
  <circle cx="28" cy="110" r="8.5" fill="${color}"/>
  <path d="M38 ${zero.toFixed(1)}h10" stroke="#5B7A93" stroke-width="2.4" stroke-linecap="round"/>
  <text x="50" y="${(zero + 3.5).toFixed(1)}" font-family="Fredoka One, sans-serif" font-size="10" fill="#5B7A93">0</text>
</svg>`;
}

/* ==========================================================
   NIVEL
   ========================================================== */
let cleanup = null;

export default {
  id: 6,
  grade: '6°',
  title: 'Análisis Climático',
  subtitle: 'Leé el gráfico de temperaturas',
  available: true,

  icon() {
    return THERMOMETER_ICON;
  },

  mount(root, ctx) {
    cleanup?.();
    cleanup = null;

    const { renderer } = ctx;
    const rounds = buildRounds();

    let alive = true;
    const timers = new Set();
    const later = (fn, ms) => {
      const id = setTimeout(() => {
        timers.delete(id);
        if (alive) fn();
      }, ms);
      timers.add(id);
      return id;
    };

    const state = {
      round: 0,
      cfg: null,
      axis: null,
      answer: 0,
      tried: new Set(),
      busy: false,
      cols: [],
    };

    /* ---------- Cabecera: ronda + pista ---------- */
    const roundLabel = h('span', { class: 'l6-round__label' });
    const dots = h('span', { class: 'l6-dots', 'aria-hidden': 'true' },
      rounds.map(() => h('span', { class: 'l6-dot' })));
    const hintBtn = h('button', {
      type: 'button',
      class: 'btn btn--accent btn--sm l6-hint',
      'aria-label': 'Pista: cómo comparar números con la recta numérica',
      onClick: () => onHint(),
    }, 'Pista');

    const top = h('div', { class: 'l6-top' },
      h('div', { class: 'l6-round' }, roundLabel, dots),
      hintBtn);

    /* ---------- Pregunta y mensajes ---------- */
    const question = h('h2', { class: 'l6-question' });
    const feedback = h('div', {
      class: 'l6-feedback l6-feedback--idle',
      role: 'status',
      'aria-live': 'polite',
      'aria-atomic': 'true',
    });

    /* ---------- Gráfico ---------- */
    const chart = h('div', { class: 'l6-chart' });
    const chartCard = h('section', { class: 'l6-card', 'aria-label': 'Gráfico de temperaturas pronosticadas' },
      h('h3', { class: 'l6-card__title' },
        h('span', { class: 'l6-card__icon', 'aria-hidden': 'true', html: SVG_CLOUD }),
        'Temperaturas pronosticadas'),
      chart);

    /* ---------- Lateral: termómetro + recta numérica ---------- */
    const readerArt = h('div', { class: 'l6-reader__art' });
    const readerText = h('div', { class: 'l6-reader__text' });
    const reader = h('div', { class: 'l6-reader', 'aria-hidden': 'true' }, readerArt, readerText);

    const lineBody = h('div', { class: 'l6-line__body' });
    const line = h('section', { class: 'l6-line', hidden: true, 'aria-label': 'Recta numérica con las temperaturas' },
      h('h3', { class: 'l6-line__title' }, 'Recta numérica'),
      lineBody,
      h('div', { class: 'l6-line__ends', 'aria-hidden': 'true' },
        h('span', {}, '← menor'), h('span', {}, 'mayor →')));

    const side = h('aside', { class: 'l6-side' }, reader, line);

    root.append(h('div', { class: 'l6' },
      top, question, feedback,
      h('div', { class: 'l6-layout' }, chartCard, side)));

    /* ---------- Mensajes ---------- */
    function say(tone, text, extra = null, srPrefix = null) {
      feedback.className = `l6-feedback l6-feedback--${tone}`;
      feedback.replaceChildren(h('span', { class: 'l6-feedback__msg' },
        srPrefix && h('span', { class: 'sr-only' }, srPrefix),
        text, extra));
    }

    /* ---------- Termómetro lateral ---------- */
    function showReader(i) {
      const t = state.cfg.temps[i];
      readerArt.replaceChildren(fromHTML(thermoSVG(t, state.axis)));
      readerText.replaceChildren(
        h('span', { class: 'l6-reader__day' }, state.cfg.days[i].full),
        h('span', { class: 'l6-reader__temp' }, deg(t)),
        h('span', { class: 'l6-reader__cap' }, t < 0 ? 'Bajo cero' : 'Sobre cero'));
    }
    function idleReader() {
      readerArt.replaceChildren(fromHTML(thermoSVG(state.axis.min + state.axis.range * 0.5, state.axis)));
      readerText.replaceChildren(
        h('span', { class: 'l6-reader__idle' }, 'Pasá el mouse o enfocá una barra para ver su termómetro.'));
    }

    /* ---------- Recta numérica ---------- */
    function buildLine() {
      const { axis, cfg } = state;
      const pct = (v) => `${(((v - axis.min) / axis.range) * 100).toFixed(2)}%`;

      const ticks = axis.ticks.map((v) => h('span', {
        class: `l6-line__tick${v === 0 ? ' is-zero' : ''}`,
        style: { left: pct(v) },
      }, h('span', { class: 'l6-line__tick-label' }, fmt(v))));

      const order = cfg.temps.map((t, i) => ({ t, i })).sort((a, b) => a.t - b.t);
      const dotsEls = order.map(({ t, i }, rank) => h('span', {
        class: `l6-line__dot l6-line__dot--lvl${rank % 2}`,
        style: { left: pct(t), '--l6-c': tempColor(t) },
        title: `${cfg.days[i].full}: ${deg(t)}`,
      }, h('span', { class: 'l6-line__dot-label' }, fmt(t))));

      lineBody.replaceChildren(h('div', { class: 'l6-line__track' },
        h('span', { class: 'l6-line__axis' }), ticks, dotsEls));
    }

    /* ---------- Gráfico de barras ---------- */
    function buildChart() {
      const { axis, cfg } = state;
      const n = cfg.temps.length;
      const pctTop = (v) => `${(((axis.max - v) / axis.range) * 100).toFixed(3)}%`;
      const zeroTop = ((axis.max / axis.range) * 100).toFixed(3);

      // Eje vertical (etiquetas cada 5 °C)
      const axisEl = h('div', { class: 'l6-axis', 'aria-hidden': 'true' },
        h('span', { class: 'l6-axis__unit' }, '°C'),
        axis.ticks.map((v) => h('span', {
          class: `l6-axis__tick${v === 0 ? ' is-zero' : ''}`,
          style: { top: pctTop(v) },
        }, fmt(v))));

      // Fondo: zonas sobre / bajo cero + líneas de guía
      const lines = h('div', { class: 'l6-lines', 'aria-hidden': 'true' },
        h('span', { class: 'l6-zone l6-zone--above', style: { top: '0', height: `${zeroTop}%` } }),
        h('span', { class: 'l6-zone l6-zone--below', style: { top: `${zeroTop}%`, bottom: '0' } }),
        axis.ticks.map((v) => h('span', {
          class: `l6-gridline${v === 0 ? ' is-zero' : ''}`,
          style: { top: pctTop(v) },
        })),
        h('span', { class: 'l6-zero-tag' }, '0 °C'));

      // Columnas: cada una es un <button> con su barra y su día
      state.cols = cfg.temps.map((t, i) => {
        const day = cfg.days[i];
        const pos = t > 0;
        const barTop = pos ? pctTop(t) : pctTop(0);
        const barH = `${((Math.abs(t) / axis.range) * 100).toFixed(3)}%`;

        const bar = h('span', {
          class: `l6-bar l6-bar--${pos ? 'pos' : 'neg'}`,
          style: { top: barTop, height: barH, '--i': i },
          'aria-hidden': 'true',
        },
          h('span', { class: 'l6-bar__fill' }),
          h('span', { class: 'l6-val' }, deg(t)));

        const btn = h('button', {
          type: 'button',
          class: 'l6-col no-scale',
          style: { '--l6-c': tempColor(t) },
          'aria-label': `${day.full}, ${spoken(t)}`,
          onClick: () => choose(i),
          onPointerenter: () => showReader(i),
          onFocus: () => showReader(i),
          onPointerleave: () => { if (!state.busy) idleReader(); },
          onBlur: () => { if (!state.busy) idleReader(); },
        },
          h('span', { class: 'l6-col__plot', 'aria-hidden': 'true' }, bar),
          h('span', { class: 'l6-day', 'aria-hidden': 'true' },
            h('span', { class: 'l6-day__icon', html: weatherIcon(t) }),
            h('span', { class: 'l6-day__name' },
              h('span', { class: 'l6-day__full' }, day.full),
              h('span', { class: 'l6-day__short' }, day.short))));

        return { btn, bar, t };
      });

      const cols = h('div', { class: 'l6-cols', style: { '--n': n } }, state.cols.map((c) => c.btn));
      const board = h('div', { class: 'l6-board' }, lines, cols);

      chart.className = `l6-chart l6-chart--n${n}`;
      chart.replaceChildren(axisEl, board);
      chart.classList.remove('l6-enter');
      void chart.offsetWidth;
      chart.classList.add('l6-enter');
    }

    /* ---------- Rondas ---------- */
    function startRound(i) {
      const hadFocus = root.contains(document.activeElement)
        && document.activeElement !== document.body;

      state.round = i;
      state.cfg = rounds[i];
      state.axis = axisFor(state.cfg.temps);
      const best = state.cfg.ask === 'hot' ? Math.max(...state.cfg.temps) : Math.min(...state.cfg.temps);
      state.answer = state.cfg.temps.indexOf(best);
      state.tried = new Set();
      state.busy = false;
      hintBtn.disabled = false;

      roundLabel.textContent = `Ronda ${i + 1} de ${TOTAL_ROUNDS}`;
      [...dots.children].forEach((dot, n) => {
        dot.className = `l6-dot${n < i ? ' is-done' : n === i ? ' is-current' : ''}`;
      });

      const hot = state.cfg.ask === 'hot';
      question.replaceChildren(
        h('span', { class: 'l6-question__icon', 'aria-hidden': 'true', html: hot ? SVG_SUN : SVG_SNOW }),
        h('span', {},
          '¿Qué día hará ',
          h('strong', { class: `l6-question__key l6-question__key--${hot ? 'hot' : 'cold'}` }, hot ? 'MÁS calor' : 'MÁS frío'),
          '? Tocá su barra.'));

      buildChart();
      buildLine();
      line.hidden = true;
      idleReader();

      const questionText = `Ronda ${i + 1}. ¿Qué día hará ${hot ? 'más calor' : 'más frío'}? `;
      say('idle', 'Mirá bien cada número antes de elegir una barra.', null, questionText);

      if (i > 0) {
        renderer.pop(chartCard);
        if (hadFocus) state.cols[0].btn.focus({ preventScroll: true });
      }
    }

    /* ---------- Acciones ---------- */
    function choose(i) {
      if (state.busy || state.tried.has(i)) return;
      if (i === state.answer) win(i);
      else miss(i);
    }

    function miss(i) {
      const { cfg } = state;
      state.tried.add(i);
      const col = state.cols[i];
      col.btn.disabled = true;
      col.btn.classList.add('is-tried');
      col.btn.setAttribute('aria-label',
        `${cfg.days[i].full}, ${spoken(cfg.temps[i])}. Ya la probaste`);

      ctx.fail();
      say('warm', missMessage(cfg.ask, cfg.temps[i], cfg.temps));

      // Si el botón con foco quedó deshabilitado, pasar el foco a la siguiente barra activa.
      const hadFocus = document.activeElement === col.btn || document.activeElement === document.body;
      if (hadFocus) {
        const order = state.cols.map((_, k) => k);
        const next = [...order.slice(i + 1), ...order.slice(0, i)].find((k) => !state.cols[k].btn.disabled);
        if (next !== undefined) state.cols[next].btn.focus({ preventScroll: true });
      }
    }

    function win(i) {
      const { cfg } = state;
      const isLast = state.round === rounds.length - 1;
      state.busy = true;
      hintBtn.disabled = true;

      state.cols.forEach((c, k) => {
        c.btn.disabled = true;
        if (k === i) c.btn.classList.add('is-correct');
        else if (!state.tried.has(k)) c.btn.classList.add('is-idle');
      });
      const chosen = state.cols[i];
      chosen.btn.setAttribute('aria-label', `${cfg.days[i].full}, ${spoken(cfg.temps[i])}. ¡Correcta!`);
      renderer.pop(chosen.bar);
      showReader(i);

      const chain = sortedAsc(cfg.temps).map(fmt).join(' < ');
      say('good', winMessage(cfg.ask, cfg.temps[i], cfg.temps),
        h('span', { class: 'l6-feedback__chain' },
          h('span', {}, 'De la más fría a la más cálida: '),
          h('span', { class: 'l6-feedback__chain-nums' }, chain)));

      later(() => {
        if (isLast) {
          ctx.success({
            message: '¡Leíste los tres pronósticos! Ya sabés que, entre los negativos, el más cercano al cero es el mayor, y que todo número positivo le gana a cualquier negativo.',
          });
        } else {
          startRound(state.round + 1);
        }
      }, WIN_DELAY);
    }

    function onHint() {
      if (state.busy) return;
      // La pista NO cuenta como falla: no se llama a ctx.fail().
      ctx.hint(HINT_TEXT);
      line.hidden = false;
      say('info', `Pista: ${HINT_TEXT}`);
      renderer.pop(line);
    }

    startRound(0);

    cleanup = () => {
      alive = false;
      timers.forEach((id) => clearTimeout(id));
      timers.clear();
    };
  },

  unmount() {
    cleanup?.();
    cleanup = null;
  },
};
