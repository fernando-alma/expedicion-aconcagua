/* ==========================================================
   level2.js — Nivel 2 · El Almacén del Refugio (2° grado)
   ----------------------------------------------------------
   Objetivo: sistema decimal (valor posicional) y descomposición
   aditiva. El jugador arma el precio de un producto poniendo
   billetes de $100, billetes de $10 y monedas de $1 en una
   bandeja con tres columnas (centenas, decenas, unidades).

   3 rondas: la 1 siempre es el mapa a $345; las otras dos son
   productos del refugio con precios de 3 cifras (sin ceros).
   ========================================================== */

import { h, fromHTML, clear, formatARS, randInt, shuffle } from '../core/utils.js';

const MAP_PRICE = 345;
const MAX_PER_DENOM = 20; // tope por columna para que la bandeja no crezca sin fin
const WIN_DELAY = 800;

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

/* ---------- Denominaciones: una por columna de la bandeja ---------- */
const DENOMS = [
  {
    value: 100, key: 'c', shape: 'bill', title: 'Centenas', label: '$100',
    noun: 'billete', nounPlural: 'billetes',
    addLabel: 'Agregar un billete de 100 pesos',
    removeLabel: 'Sacar un billete de 100 pesos de la bandeja',
    svg: (A) => A.bill({ value: 100 }),
  },
  {
    value: 10, key: 'd', shape: 'bill', title: 'Decenas', label: '$10',
    noun: 'billete', nounPlural: 'billetes',
    addLabel: 'Agregar un billete de 10 pesos',
    removeLabel: 'Sacar un billete de 10 pesos de la bandeja',
    svg: (A) => A.bill({ value: 10 }),
  },
  {
    value: 1, key: 'u', shape: 'coin', title: 'Unidades', label: '$1',
    noun: 'moneda', nounPlural: 'monedas',
    addLabel: 'Agregar una moneda de 1 peso',
    removeLabel: 'Sacar una moneda de 1 peso de la bandeja',
    svg: (A) => A.coin({ label: '$1' }),
  },
];

/* ---------- Productos (SVG propios, sin <defs>/ids) ---------- */
const SVG_MAP = `
<svg viewBox="0 0 120 96" xmlns="http://www.w3.org/2000/svg" focusable="false">
  <path d="M10 26 40 16l40 10 30-10v62L80 88 40 78 10 88z" fill="#23405A" opacity=".1" transform="translate(0 4)"/>
  <path d="M10 22 40 12l40 10 30-10v62L80 84 40 74 10 84z" fill="#FDF3CF"/>
  <path d="M10 22 40 12v62L10 84z" fill="#fff" opacity=".4"/>
  <path d="M40 12v62M80 22v62" stroke="#D9A91F" stroke-width="2" opacity=".45"/>
  <path d="M18 62l14-22 11 13 13-22 16 28" fill="none" stroke="#2D9CDB" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M52 68c10 7 22-5 34 1" fill="none" stroke="#EB5757" stroke-width="3" stroke-dasharray="1 7" stroke-linecap="round"/>
  <path d="M92 32l12 12m0-12L92 44" stroke="#EB5757" stroke-width="5" stroke-linecap="round"/>
</svg>`;

const SVG_GORRO = `
<svg viewBox="0 0 120 96" xmlns="http://www.w3.org/2000/svg" focusable="false">
  <path d="M22 62c0-32 16-48 38-48s38 16 38 48z" fill="#2D9CDB"/>
  <path d="M38 62c0-20 6-34 14-42M60 62V16M82 62c0-20-6-34-14-42" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".28"/>
  <rect x="14" y="58" width="92" height="26" rx="13" fill="#1F82BD"/>
  <path d="M30 62v18M46 62v18M62 62v18M78 62v18M94 62v18" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".3"/>
  <circle cx="60" cy="13" r="10" fill="#F2C94C"/>
  <circle cx="57" cy="10" r="3" fill="#fff" opacity=".6"/>
</svg>`;

const SVG_LINTERNA = `
<svg viewBox="0 0 120 96" xmlns="http://www.w3.org/2000/svg" focusable="false">
  <path d="M80 40 114 22v52L80 56z" fill="#F2C94C" opacity=".45"/>
  <rect x="12" y="38" width="52" height="30" rx="14" fill="#27AE60"/>
  <rect x="12" y="38" width="52" height="30" rx="14" fill="#fff" opacity=".1"/>
  <rect x="58" y="30" width="26" height="46" rx="10" fill="#1E8F4E"/>
  <rect x="66" y="36" width="12" height="34" rx="6" fill="#F2C94C"/>
  <rect x="26" y="45" width="14" height="9" rx="4.5" fill="#F2C94C"/>
</svg>`;

const PRODUCTS = {
  mapa: { name: 'Mapa de la montaña', svg: () => SVG_MAP },
  gorro: { name: 'Gorro de lana', svg: () => SVG_GORRO },
  linterna: { name: 'Linterna', svg: () => SVG_LINTERNA },
  cantimplora: { name: 'Cantimplora', svg: (A) => A.bottle({ level: 0.85, color: '#EB5757' }) },
};

/* ---------- Helpers de dominio ---------- */
const digitsOf = (price) => ({
  c: Math.floor(price / 100),
  d: Math.floor(price / 10) % 10,
  u: price % 10,
});

const billetes = (n, v) => `${n} ${n === 1 ? 'billete' : 'billetes'} de $${v}`;
const monedas = (n) => `${n} ${n === 1 ? 'moneda' : 'monedas'} de $1`;

function buildRounds() {
  const used = new Set([MAP_PRICE]);
  const extra = [];
  while (extra.length < 2) {
    const p = randInt(1, 9) * 100 + randInt(1, 9) * 10 + randInt(1, 9);
    if (!used.has(p)) { used.add(p); extra.push(p); }
  }
  const keys = shuffle(['gorro', 'linterna', 'cantimplora']).slice(0, 2);
  return [
    { key: 'mapa', price: MAP_PRICE },
    { key: keys[0], price: extra[0] },
    { key: keys[1], price: extra[1] },
  ];
}

/* ==========================================================
   NIVEL
   ========================================================== */
export default {
  id: 2,
  grade: '2°',
  title: 'El Almacén del Refugio',
  subtitle: 'Armá el precio con billetes y monedas',
  available: true,

  icon() {
    return `
<svg viewBox="0 0 96 80" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Almacén del refugio">
  <rect x="10" y="36" width="76" height="40" rx="10" fill="#F2C94C"/>
  <rect x="10" y="36" width="76" height="40" rx="10" fill="#fff" opacity=".15"/>
  <path d="M6 36 16 8h64l10 28z" fill="#EB5757"/>
  <path d="M28 8 24 36h12l2-28zM56 8l2 28h12l-4-28z" fill="#fff" opacity=".85"/>
  <path d="M6 36q10 12 21 0t21 0 21 0 21 0z" fill="#C93F3F"/>
  <circle cx="48" cy="58" r="12" fill="#D9A91F"/>
  <circle cx="48" cy="56" r="11" fill="#FDF3CF"/>
  <text x="48" y="62" text-anchor="middle" font-family="Fredoka One, sans-serif" font-size="16" fill="#9A7410">$</text>
</svg>`;
  },

  mount(root, ctx) {
    disposed = false;
    timers.clear();

    const { Assets } = ctx.renderer;
    const rounds = buildRounds();
    const state = {
      round: 0,
      counts: { 100: 0, 10: 0, 1: 0 },
      busy: false,
    };

    const current = () => {
      const r = rounds[state.round];
      return { ...r, ...digitsOf(r.price), product: PRODUCTS[r.key] };
    };
    const total = () => 100 * state.counts[100] + 10 * state.counts[10] + state.counts[1];

    /* ---------- Cabecera: ronda + pista ---------- */
    const roundLabel = h('span', { class: 'l2-round__label' });
    const dots = h('span', { class: 'l2-dots', 'aria-hidden': 'true' },
      rounds.map(() => h('span', { class: 'l2-dot' })));
    const hintBtn = h('button', {
      type: 'button',
      class: 'btn btn--accent btn--sm l2-hint',
      'aria-label': 'Pista: ver cómo se arma el precio con centenas, decenas y unidades',
      onClick: () => onHint(),
    }, 'Pista');

    const top = h('div', { class: 'l2-top' },
      h('div', { class: 'l2-round' }, roundLabel, dots),
      hintBtn);

    const instruction = h('p', { class: 'l2-instruction' },
      'Tocá los botones para poner billetes y monedas en la bandeja. ¡Juntá el precio justo!');

    /* ---------- Producto ---------- */
    const productArt = h('div', { class: 'l2-product__art', 'aria-hidden': 'true' });
    const productName = h('h2', { class: 'l2-product__name' });
    const priceValue = h('span', { class: 'l2-price__value' });
    const product = h('div', { class: 'l2-product' },
      productArt,
      h('div', { class: 'l2-product__info' },
        h('p', { class: 'l2-product__kicker' }, 'Quiero comprar'),
        productName,
        h('p', { class: 'l2-price' },
          h('span', { class: 'l2-price__cap' }, 'Precio'),
          priceValue)));

    /* ---------- Bandeja: tres columnas ---------- */
    const cols = DENOMS.map((d) => {
      const stack = h('div', { class: `l2-stack l2-stack--${d.shape}` });
      const count = h('span', { class: 'l2-col__count' });
      const col = h('div', {
        class: `l2-col l2-col--${d.key}`,
        role: 'group',
        'aria-label': `${d.title}: ${d.nounPlural} de ${d.label}`,
      },
        h('h3', { class: 'l2-col__title' }, d.title, h('span', { class: 'l2-col__value' }, d.label)),
        stack,
        count);
      return { d, stack, count, col };
    });

    const trayBox = h('div', { class: 'l2-tray' },
      h('p', { class: 'l2-tray__title' }, 'Tu bandeja'),
      h('div', { class: 'l2-tray__cols' }, cols.map((c) => c.col)));

    const totalEl = h('div', { class: 'l2-total', 'aria-live': 'polite', 'aria-atomic': 'true' });
    const decompLine = h('div', { class: 'l2-decomp__line' });
    const decomp = h('div', { class: 'l2-decomp' },
      h('p', { class: 'l2-decomp__cap' }, 'Tu cuenta'),
      decompLine);

    const left = h('section', { class: 'l2-left', 'aria-label': 'Producto y bandeja' },
      product, trayBox, totalEl, decomp);

    /* ---------- Generadores ---------- */
    const genButtons = DENOMS.map((d) => h('button', {
      type: 'button',
      class: `l2-gen l2-gen--${d.key}`,
      'aria-label': d.addLabel,
      onClick: () => addOne(d),
    },
      h('span', { class: 'l2-gen__art', 'aria-hidden': 'true', html: d.svg(Assets) }),
      h('span', { class: 'l2-gen__text' },
        h('span', { class: 'l2-gen__value' }, d.label),
        h('span', { class: 'l2-gen__kind' }, d.shape === 'bill' ? 'Billete' : 'Moneda')),
      h('span', { class: 'l2-gen__plus', 'aria-hidden': 'true' }, '+')));

    const buyBtn = h('button', {
      type: 'button',
      class: 'btn btn--secondary btn--lg l2-buy',
      onClick: () => onBuy(),
    }, 'Comprar');

    const emptyBtn = h('button', {
      type: 'button',
      class: 'btn btn--ghost l2-empty',
      onClick: () => onEmpty(),
    }, 'Vaciar bandeja');

    const feedback = h('div', { class: 'l2-feedback', role: 'status', 'aria-live': 'polite' });

    const right = h('aside', { class: 'l2-right', 'aria-label': 'Billetes y monedas' },
      h('h2', { class: 'l2-gen__heading' }, 'Tocá para agregar'),
      h('div', { class: 'l2-gens' }, genButtons),
      h('div', { class: 'l2-actions' }, buyBtn, emptyBtn),
      feedback);

    root.append(h('div', { class: 'l2' },
      top, instruction,
      h('div', { class: 'l2-layout' }, left, right)));

    /* ---------- Mensajes ---------- */
    function say(tone, text) {
      feedback.className = `l2-feedback l2-feedback--${tone}`;
      feedback.replaceChildren(h('span', { class: 'l2-feedback__msg' }, text));
    }
    function clearFeedback() {
      feedback.className = 'l2-feedback';
      feedback.replaceChildren();
    }

    function setBusy(value) {
      state.busy = value;
      [...genButtons, buyBtn, emptyBtn, hintBtn].forEach((b) => { b.disabled = value; });
    }

    /* ---------- Render de la bandeja ---------- */
    function renderTray(newValue = null) {
      const { price } = current();
      const t = total();

      cols.forEach(({ d, stack, count }) => {
        const n = state.counts[d.value];
        clear(stack);
        stack.classList.toggle('l2-stack--dense', d.shape === 'bill' && n > 8);

        if (n === 0) {
          stack.append(h('span', { class: 'l2-col__empty' }, 'Vacío'));
        }
        for (let i = 0; i < n; i++) {
          const isNew = newValue === d.value && i === n - 1;
          stack.append(h('button', {
            type: 'button',
            class: `l2-item l2-item--${d.shape}${isNew ? ' l2-item--new' : ''}`,
            'aria-label': d.removeLabel,
            title: 'Tocá para sacar',
            onClick: () => removeOne(d),
          }, h('span', { class: 'l2-item__art', 'aria-hidden': 'true', html: d.svg(Assets) })));
        }
        count.textContent = n ? `${n} ${n === 1 ? d.noun : d.nounPlural}` : '';
      });

      totalEl.replaceChildren('En la bandeja: ', h('strong', {}, formatARS(t)));
      const over = t > price;
      totalEl.classList.toggle('l2-total--over', over);
      emptyBtn.classList.toggle('l2-empty--alert', over);

      const part = (key, n, v) => h('span', { class: `l2-decomp__part l2-decomp__part--${key}` }, `${n} × $${v}`);
      const op = (s) => h('span', { class: 'l2-decomp__op' }, s);
      decompLine.replaceChildren(
        part('c', state.counts[100], 100), op('+'),
        part('d', state.counts[10], 10), op('+'),
        part('u', state.counts[1], 1), op('='),
        h('span', { class: 'l2-decomp__total' }, formatARS(t)));
    }

    /* ---------- Ronda ---------- */
    function loadRound() {
      const r = current();
      state.counts = { 100: 0, 10: 0, 1: 0 };
      setBusy(false);

      roundLabel.textContent = `Compra ${state.round + 1} de ${rounds.length}`;
      [...dots.children].forEach((dot, i) => {
        dot.classList.toggle('is-done', i < state.round);
        dot.classList.toggle('is-current', i === state.round);
      });

      product.classList.remove('l2-product--bought');
      productArt.replaceChildren(fromHTML(r.product.svg(Assets)));
      productName.textContent = r.product.name;
      priceValue.textContent = formatARS(r.price);

      clearFeedback();
      renderTray();
      if (state.round > 0) ctx.renderer.pop(product);
    }

    /* ---------- Acciones ---------- */
    function addOne(d) {
      if (state.busy) return;
      if (state.counts[d.value] >= MAX_PER_DENOM) {
        say('warm', `Ya pusiste ${MAX_PER_DENOM} ${d.nounPlural} de ${d.label}. Sacá alguno o vaciá la bandeja.`);
        return;
      }
      state.counts[d.value] += 1;
      clearFeedback();
      renderTray(d.value);
      ctx.renderer.pop(totalEl);
    }

    function removeOne(d) {
      if (state.busy || state.counts[d.value] === 0) return;
      state.counts[d.value] -= 1;
      clearFeedback();
      renderTray();
      ctx.renderer.pop(totalEl);

      // Mantener el foco útil para quien navega con teclado.
      const colRef = cols.find((c) => c.d === d);
      const items = colRef.stack.querySelectorAll('.l2-item');
      const target = items.length ? items[items.length - 1] : genButtons[DENOMS.indexOf(d)];
      target?.focus({ preventScroll: true });
    }

    function onEmpty() {
      if (state.busy) return;
      const had = total() > 0;
      state.counts = { 100: 0, 10: 0, 1: 0 };
      renderTray();
      if (had) say('info', 'Bandeja vacía. ¡Empezá de nuevo!');
      else clearFeedback();
    }

    function onHint() {
      if (state.busy) return;
      const { price, c, d, u } = current();
      // La pista NO cuenta como falla: no se llama a ctx.fail().
      ctx.hint(`${price} = ${c * 100} + ${d * 10} + ${u}`);
      say('info',
        `Pista: ${price} = ${c * 100} + ${d * 10} + ${u}. Son ${billetes(c, 100)}, ${billetes(d, 10)} y ${monedas(u)}.`);
    }

    function onBuy() {
      if (state.busy) return;
      const { price, c, d, u } = current();
      const t = total();

      if (t === 0) {
        // Todavía no hubo un intento real: no se cuenta como falla.
        say('info', 'Primero tocá los botones para poner billetes y monedas en la bandeja.');
        return;
      }

      const exact = state.counts[100] === c && state.counts[10] === d && state.counts[1] === u;
      if (t === price && exact) {
        win();
        return;
      }

      ctx.fail();
      if (t > price) {
        say('warm', '¡Uy, te pasaste! Vaciá la bandeja y probá de nuevo.');
      } else if (t < price) {
        say('warm', `Todavía te falta plata. ¿Cuánto te falta? Te faltan ${formatARS(price - t)}.`);
      } else {
        say('warm',
          `¡El total está bien! Ahora armalo con ${billetes(c, 100)}, ${d} de $10 y ${monedas(u)}.`);
      }
    }

    function win() {
      const { price, c, d, u } = current();
      const isLast = state.round === rounds.length - 1;

      setBusy(true);
      product.classList.add('l2-product--bought');
      ctx.renderer.pop(product);
      ctx.renderer.pop(trayBox);
      say('good', `¡Muy bien! ${price} = ${c * 100} + ${d * 10} + ${u}. ¡Comprado!`);

      later(() => {
        if (isLast) {
          ctx.success({
            message: '¡Compraste todo para la expedición! Ya sabés armar cualquier precio con centenas, decenas y unidades.',
          });
        } else {
          state.round += 1;
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
