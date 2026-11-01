/* ==========================================================
   level4.js — Nivel 4 · Racionamiento de Supervivencia (4° grado)
   ----------------------------------------------------------
   Objetivo: fracciones, relación parte-todo y reparto equitativo.
   El jugador reparte el agua de las cantimploras entre los
   expedicionarios con botones +1/4, +1/2 (y +1 en la ronda 3).
   Toda el agua se maneja en CUARTOS (enteros): 1 cantimplora = 4.
   Así no hay errores de coma flotante.

   3 rondas:
     1) 4 expedicionarios · 3 cantimploras → 3/4 cada uno (spec)
     2) 6 expedicionarios · 3 cantimploras → 1/2 cada uno
     3) 4 expedicionarios · 5 cantimploras → 1 1/4 cada uno
   ========================================================== */

import { h, clear } from '../core/utils.js';

const WIN_DELAY = 900;
const CUP_CAP = 8; // el vaso muestra hasta 8 cuartos (2 cantimploras)

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

/* ---------- Rondas ---------- */
const ROUNDS = [
  {
    people: 4, bottles: 3, adds: [1, 2],
    intro: 'Hay 4 expedicionarios y 3 cantimploras llenas. Repartí toda el agua en partes iguales.',
    hint: '3 cantimploras son 12 cuartitos. Repartí 12 cuartitos entre 4 personas: ¿cuántos le tocan a cada uno?',
    win: '12 cuartitos entre 4 personas son 3 cuartitos para cada uno: 3/4.',
  },
  {
    people: 6, bottles: 3, adds: [1, 2],
    intro: 'Ahora son 6 expedicionarios y siguen siendo 3 cantimploras. ¿Qué parte le toca a cada uno?',
    hint: 'Siguen siendo 12 cuartitos, pero ahora hay 6 personas. ¿Cuántos cuartitos le tocan a cada una? Y fijate: ¿esa cantidad se puede escribir con otra fracción?',
    win: '12 cuartitos entre 6 personas son 2 cuartitos para cada una. ¡2/4 es lo mismo que 1/2!',
  },
  {
    people: 4, bottles: 5, adds: [1, 2, 4],
    intro: 'Llegaron 5 cantimploras para los 4 expedicionarios. Ahora hay un botón nuevo: +1 entero.',
    hint: '5 cantimploras son 20 cuartitos. Repartí 20 cuartitos entre 4 personas. Acordate: 4 cuartitos forman 1 entero.',
    win: '20 cuartitos entre 4 personas son 5 cuartitos para cada uno: 1 entero y 1/4.',
  },
];

/* ---------- Expedicionarios ---------- */
const PEOPLE = [
  { name: 'Sofi', hat: '#2D9CDB', band: '#1F82BD', skin: '#FFD9B8' },
  { name: 'Tomi', hat: '#27AE60', band: '#1E8F4E', skin: '#F2B98F' },
  { name: 'Lola', hat: '#F2C94C', band: '#D9A91F', skin: '#D99A6C', ink: '#5A4506' },
  { name: 'Beni', hat: '#EB5757', band: '#C93F3F', skin: '#FFD9B8' },
  { name: 'Juli', hat: '#9B6BDF', band: '#7C4FC0', skin: '#E8AE86' },
  { name: 'Mati', hat: '#F2994A', band: '#D9792A', skin: '#C98B5E' },
];

const personSvg = ({ hat, band, skin }) => `
<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">
  <circle cx="32" cy="38" r="20" fill="${skin}"/>
  <path d="M10 37C10 20 20 12 32 12s22 8 22 25z" fill="${hat}"/>
  <path d="M18 34c1-9 6-16 14-18" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".3"/>
  <rect x="8" y="32" width="48" height="10" rx="5" fill="${band}"/>
  <path d="M17 37h6M29 37h6M41 37h6" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".35"/>
  <circle cx="32" cy="9" r="6.5" fill="#fff"/>
  <circle cx="30" cy="7.2" r="2" fill="#DCEFFB"/>
  <circle cx="24.5" cy="48" r="2.7" fill="#23405A"/>
  <circle cx="39.5" cy="48" r="2.7" fill="#23405A"/>
  <circle cx="25.4" cy="47" r=".9" fill="#fff"/>
  <circle cx="40.4" cy="47" r=".9" fill="#fff"/>
  <path d="M26.5 54.5q5.5 4.6 11 0" fill="none" stroke="#23405A" stroke-width="2.6" stroke-linecap="round"/>
  <circle cx="18.5" cy="52" r="3.4" fill="#EB5757" opacity=".22"/>
  <circle cx="45.5" cy="52" r="3.4" fill="#EB5757" opacity=".22"/>
</svg>`;

/* ---------- Fracciones (todo en cuartos) ---------- */
function partsOf(q) {
  const whole = Math.floor(q / 4);
  const r = q % 4;
  const num = r === 2 ? 1 : r; // 2/4 se simplifica a 1/2
  const den = r === 2 ? 2 : 4;
  return { whole, r, num, den };
}

/** Texto visible: "0", "1/4", "1/2", "1", "1 1/4"… */
function fracText(q) {
  const { whole, r, num, den } = partsOf(q);
  if (!whole && !r) return '0';
  return [whole || '', r ? `${num}/${den}` : ''].filter(Boolean).join(' ');
}

/** Texto para lectores de pantalla: "tres cuartos", "1 y un cuarto"… */
function fracSpeech(q) {
  const { whole, r } = partsOf(q);
  const words = { 1: 'un cuarto', 2: 'un medio', 3: 'tres cuartos' };
  if (!whole && !r) return 'cero';
  if (!r) return `${whole} ${whole === 1 ? 'entero' : 'enteros'}`;
  return whole ? `${whole} y ${words[r]}` : words[r];
}

/** Nodo con la fracción escrita bien: entero + numerador/denominador apilados. */
function fracNode(q, extraClass = '') {
  const { whole, r, num, den } = partsOf(q);
  const node = h('span', {
    class: `l4-frac ${extraClass}`.trim(),
    role: 'img',
    'aria-label': fracSpeech(q),
  });
  if (!whole && !r) {
    node.append(h('span', { class: 'l4-frac__whole', 'aria-hidden': 'true' }, '0'));
    return node;
  }
  if (whole) node.append(h('span', { class: 'l4-frac__whole', 'aria-hidden': 'true' }, String(whole)));
  if (r) {
    node.append(h('span', { class: 'l4-frac__stack', 'aria-hidden': 'true' },
      h('span', { class: 'l4-frac__num' }, String(num)),
      h('span', { class: 'l4-frac__den' }, String(den))));
  }
  return node;
}

const addLabel = (amt) => ({
  1: { btn: '+1/4', speech: 'un cuarto' },
  2: { btn: '+1/2', speech: 'un medio' },
  4: { btn: '+1', speech: 'una cantimplora entera' },
}[amt]);

/* ==========================================================
   NIVEL
   ========================================================== */
export default {
  id: 4,
  grade: '4°',
  title: 'Racionamiento de Supervivencia',
  subtitle: 'Repartí el agua en partes iguales',
  available: true,

  icon() {
    return `
<svg viewBox="0 0 96 80" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Cantimploras">
  <g transform="translate(6 4) scale(.7)">
    <rect x="20" y="2" width="20" height="12" rx="5" fill="#23405A" opacity=".5"/>
    <rect x="8" y="14" width="44" height="82" rx="16" fill="#fff" stroke="#2D9CDB" stroke-width="4"/>
    <rect x="12" y="38" width="36" height="54" rx="12" fill="#2D9CDB" opacity=".85"/>
  </g>
  <g transform="translate(48 14) scale(.62)">
    <rect x="20" y="2" width="20" height="12" rx="5" fill="#23405A" opacity=".5"/>
    <rect x="8" y="14" width="44" height="82" rx="16" fill="#fff" stroke="#27AE60" stroke-width="4"/>
    <rect x="12" y="58" width="36" height="34" rx="12" fill="#27AE60" opacity=".85"/>
  </g>
  <path d="M42 62c3-5 6-5 9 0" fill="none" stroke="#F2C94C" stroke-width="4" stroke-linecap="round"/>
</svg>`;
  },

  mount(root, ctx) {
    disposed = false;
    timers.clear();

    const state = {
      round: 0,
      shares: [],      // cuartos que recibió cada expedicionario
      busy: false,
      people: [],      // refs al DOM de cada tarjeta
      bottles: [],     // refs al DOM de cada cantimplora
    };

    const cfg = () => ROUNDS[state.round];
    const totalQ = () => cfg().bottles * 4;
    const given = () => state.shares.reduce((a, b) => a + b, 0);
    const reserve = () => totalQ() - given();

    /* ---------- Cabecera: ronda + pista ---------- */
    const roundLabel = h('span', { class: 'l4-round__label' });
    const dots = h('span', { class: 'l4-dots', 'aria-hidden': 'true' },
      ROUNDS.map(() => h('span', { class: 'l4-dot' })));
    const hintBtn = h('button', {
      type: 'button',
      class: 'btn btn--accent btn--sm l4-hint',
      'aria-label': 'Pista: ver cómo pensar el reparto en cuartitos',
      onClick: () => onHint(),
    }, 'Pista');

    const top = h('div', { class: 'l4-top' },
      h('div', { class: 'l4-round' }, roundLabel, dots),
      hintBtn);

    const instruction = h('p', { class: 'l4-instruction' });

    /* ---------- Reserva de cantimploras ---------- */
    const reserveChip = h('span', { class: 'l4-reserve__chip' });
    const bottlesRow = h('div', { class: 'l4-bottles', role: 'group', 'aria-label': 'Cantimploras de la reserva' });
    const reservePanel = h('section', { class: 'l4-reserve', 'aria-label': 'Reserva de agua' },
      h('div', { class: 'l4-reserve__head' },
        h('h2', { class: 'l4-reserve__title' }, 'Reserva de agua'),
        reserveChip),
      bottlesRow);

    /* ---------- Expedicionarios ---------- */
    const peopleGrid = h('div', { class: 'l4-people' });

    /* ---------- Mensajes y acciones ---------- */
    const feedbackVis = h('span', { class: 'l4-feedback__msg', 'aria-hidden': 'true' });
    const feedbackSr = h('span', { class: 'sr-only' });
    const feedback = h('div', { class: 'l4-feedback', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' },
      feedbackVis, feedbackSr);

    const resetBtn = h('button', {
      type: 'button',
      class: 'btn btn--ghost btn--sm l4-reset',
      'aria-label': 'Devolver todo el agua a la reserva y empezar de nuevo',
      onClick: () => onResetAll(),
    }, 'Devolver todo');

    const footer = h('div', { class: 'l4-footer' }, feedback, resetBtn);

    root.append(h('div', { class: 'l4' }, top, instruction, reservePanel, peopleGrid, footer));

    /* ---------- Mensajes ---------- */
    function say(tone, text, speech = text) {
      feedback.className = `l4-feedback l4-feedback--${tone}`;
      feedbackVis.textContent = text;
      feedbackSr.textContent = speech;
    }

    /* ---------- Construcción de la ronda ---------- */
    function buildBottles() {
      clear(bottlesRow);
      state.bottles = [];
      for (let i = 0; i < cfg().bottles; i++) {
        const water = h('span', { class: 'l4-water' });
        const label = h('span', { class: 'l4-bottle__label' });
        const el = h('div', { class: 'l4-bottle' },
          h('span', { class: 'l4-bottle__cap', 'aria-hidden': 'true' }),
          h('span', { class: 'l4-bottle__body', 'aria-hidden': 'true' }, water),
          label);
        bottlesRow.append(el);
        state.bottles.push({ el, water, label });
      }
    }

    function buildPeople() {
      clear(peopleGrid);
      state.people = [];
      const { people, adds } = cfg();
      peopleGrid.style.setProperty('--l4-cols', String(people));
      peopleGrid.classList.toggle('l4-people--six', people === 6);

      for (let i = 0; i < people; i++) {
        const p = PEOPLE[i];
        const water = h('span', { class: 'l4-cup__water' });
        const cup = h('span', { class: 'l4-cup', 'aria-hidden': 'true' },
          h('span', { class: 'l4-cup__ticks' }),
          h('span', { class: 'l4-cup__whole' }, h('i', {}, '1')),
          water);
        const fracBox = h('div', { class: 'l4-person__frac' });
        const tag = h('span', { class: 'l4-person__tag', 'aria-hidden': 'true' });

        const addBtns = adds.map((amt) => {
          const lab = addLabel(amt);
          const btn = h('button', {
            type: 'button',
            class: `l4-add l4-add--${amt}`,
            'aria-label': `Darle ${lab.speech} de agua a ${p.name}`,
            'aria-disabled': 'false',
            onClick: () => onGive(i, amt),
          }, lab.btn);
          return { amt, btn };
        });
        const subBtn = h('button', {
          type: 'button',
          class: 'l4-sub',
          'aria-label': `Sacarle un cuarto de agua a ${p.name} y devolverlo a la reserva`,
          onClick: () => onTake(i),
        }, '−1/4');

        const el = h('article', {
          class: `l4-person${adds.length > 2 ? ' l4-person--whole' : ''}`,
          role: 'group',
          'aria-label': p.name,
          style: { '--l4-c': p.hat, '--l4-ink': p.ink || '#fff', '--l4-i': String(i) },
        },
          tag,
          h('div', { class: 'l4-person__head' },
            h('span', { class: 'l4-person__char', 'aria-hidden': 'true', html: personSvg(p) }),
            h('h3', { class: 'l4-person__name' }, p.name)),
          h('div', { class: 'l4-person__mid' }, cup, fracBox),
          h('div', { class: 'l4-person__btns' }, addBtns.map((a) => a.btn), subBtn));

        peopleGrid.append(el);
        state.people.push({ el, water, fracBox, tag, addBtns, subBtn, name: p.name });
      }
    }

    /* ---------- Render (actualiza en el lugar, sin reconstruir) ---------- */
    function render() {
      const R = reserve();
      const used = totalQ() - R;

      // Cantimploras: se vacían de a una, en orden.
      state.bottles.forEach((b, i) => {
        const left = 4 - Math.min(4, Math.max(0, used - 4 * i));
        b.water.style.height = `${(left / 4) * 100}%`;
        b.el.classList.toggle('is-empty', left === 0);
        b.label.textContent = left === 0 ? 'vacía' : left === 4 ? 'llena' : fracText(left);
        b.el.setAttribute('role', 'img');
        b.el.setAttribute('aria-label',
          `Cantimplora ${i + 1}: ${left === 0 ? 'vacía' : left === 4 ? 'llena' : fracSpeech(left)}`);
      });

      reserveChip.replaceChildren(
        h('span', { class: 'l4-reserve__chip-cap' }, 'Quedan'),
        fracNode(R, 'l4-frac--sm'));
      reserveChip.classList.toggle('is-empty', R === 0);

      // Expedicionarios
      state.people.forEach((p, i) => {
        const q = state.shares[i];
        p.water.style.height = `${(Math.min(q, CUP_CAP) / CUP_CAP) * 100}%`;
        p.fracBox.replaceChildren(fracNode(q));
        if (partsOf(q).r === 2) {
          const { whole } = partsOf(q);
          p.fracBox.append(h('small', { class: 'l4-person__eq', 'aria-hidden': 'true' },
            `= ${whole ? whole + ' ' : ''}2/4`));
        }
        p.addBtns.forEach(({ amt, btn }) => {
          btn.setAttribute('aria-disabled', R < amt || state.busy ? 'true' : 'false');
        });
        p.subBtn.setAttribute('aria-disabled', q < 1 || state.busy ? 'true' : 'false');
      });

      hintBtn.disabled = state.busy;
      resetBtn.disabled = state.busy;
    }

    function clearMarks() {
      state.people.forEach((p) => {
        p.el.classList.remove('is-more', 'is-less');
        p.tag.textContent = '';
      });
    }

    function loadRound() {
      const c = cfg();
      state.shares = Array.from({ length: c.people }, () => 0);
      state.busy = false;

      roundLabel.textContent = `Ronda ${state.round + 1} de ${ROUNDS.length}`;
      [...dots.children].forEach((dot, i) => {
        dot.classList.toggle('is-done', i < state.round);
        dot.classList.toggle('is-current', i === state.round);
      });

      instruction.textContent = c.intro;
      buildBottles();
      buildPeople();
      render();
      const extra = c.adds.includes(4) ? 'Tocá +1/4, +1/2 o +1 para darles agua.' : 'Tocá +1/4 o +1/2 para darles agua.';
      say('info', extra);
      if (state.round > 0) ctx.renderer.pop(reserveChip);
    }

    /* ---------- Acciones ---------- */
    function onGive(i, amt) {
      if (state.busy) return;
      const p = state.people[i];
      const R = reserve();
      const lab = addLabel(amt).btn;

      if (R < amt) {
        if (R === 0) {
          say('warm', 'La reserva ya está vacía. Si querés cambiar el reparto, sacá agua con −1/4.');
        } else {
          say('warm',
            `Para ${lab} no alcanza el agua: en la reserva quedan ${fracText(R)}. Probá con una porción más chica.`,
            `Para dar ${fracSpeech(amt)} no alcanza el agua: en la reserva quedan ${fracSpeech(R)}. Probá con una porción más chica.`);
        }
        return;
      }

      state.shares[i] += amt;
      clearMarks();
      render();
      ctx.renderer.pop(p.fracBox);

      const left = reserve();
      if (left > 0) {
        say('info',
          `${p.name} tiene ${fracText(state.shares[i])}. En la reserva quedan ${fracText(left)}.`,
          `${p.name} tiene ${fracSpeech(state.shares[i])}. En la reserva quedan ${fracSpeech(left)}.`);
      } else {
        checkShares();
      }
    }

    function onTake(i) {
      if (state.busy) return;
      const p = state.people[i];
      if (state.shares[i] < 1) {
        say('warm', `${p.name} todavía no tiene agua para devolver.`);
        return;
      }
      state.shares[i] -= 1;
      clearMarks();
      render();
      ctx.renderer.pop(reserveChip);
      say('info',
        `Devolviste 1/4 a la reserva. ${p.name} tiene ${fracText(state.shares[i])}.`,
        `Devolviste un cuarto a la reserva. ${p.name} tiene ${fracSpeech(state.shares[i])}.`);
    }

    function onResetAll() {
      if (state.busy) return;
      const had = given() > 0;
      state.shares = state.shares.map(() => 0);
      clearMarks();
      render();
      if (had) {
        ctx.renderer.pop(reserveChip);
        say('info', 'Todo el agua volvió a la reserva. ¡Empezá de nuevo!');
      } else {
        say('info', 'Todavía no repartiste nada. Tocá +1/4 o +1/2 para empezar.');
      }
    }

    function onHint() {
      if (state.busy) return;
      // La pista NO cuenta como falla: no se llama a ctx.fail().
      const text = cfg().hint;
      ctx.hint(text);
      say('info', `Pista: ${text}`);
    }

    /* Se evalúa solo cuando la reserva queda en 0. */
    function checkShares() {
      const first = state.shares[0];
      const even = state.shares.every((q) => q === first);
      if (even) {
        win();
        return;
      }

      ctx.fail();
      const max = Math.max(...state.shares);
      const min = Math.min(...state.shares);
      state.people.forEach((p, i) => {
        const more = state.shares[i] === max;
        const less = state.shares[i] === min;
        p.el.classList.toggle('is-more', more);
        p.el.classList.toggle('is-less', less);
        p.tag.textContent = more ? 'tiene más' : less ? 'tiene menos' : '';
      });
      say('warm', 'Hay quienes tienen más que otros. ¿Podés repartir parejo? Sacá agua con −1/4 o tocá "Devolver todo".',
        'Hay quienes tienen más que otros. ¿Podés repartir parejo? Sacá agua con menos un cuarto o tocá Devolver todo.');
    }

    function win() {
      const isLast = state.round === ROUNDS.length - 1;
      state.busy = true;
      clearMarks();
      render();
      state.people.forEach((p) => p.el.classList.add('is-done'));
      state.people.forEach((p) => ctx.renderer.pop(p.fracBox));
      say('good', `¡Parejo! ${cfg().win}`);

      later(() => {
        if (isLast) {
          ctx.success({
            message: '¡Repartiste toda el agua en partes iguales! Ya sabés usar fracciones para compartir sin que a nadie le falte.',
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
