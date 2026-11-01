/* ==========================================================
   level3.js — Nivel 3 · Armado de Carpas (3° grado)
   ----------------------------------------------------------
   Objetivo: introducción visual a la multiplicación mediante
   organizaciones rectangulares (filas × columnas).

   Mecánica: terreno de 8 columnas × 6 filas. El juego pide
   "Hacé espacio para N montañistas". El jugador arrastra
   (Pointer Events: mouse y táctil) para sombrear un rectángulo.
   Al soltar se valida filas × columnas === N.
   Alternativa sin arrastre: steppers de Filas y Columnas + "Listo".

   3 rondas: 12 (spec), 18 y 24 montañistas. Todas resolubles
   en el terreno de 8 × 6.
   ========================================================== */

import { h, clamp } from '../core/utils.js';
import { Assets } from '../ui/renderer.js';

const COLS = 8;
const ROWS = 6;
const WIN_DELAY = 900;
const WRONG_DELAY = 600;

const ROUND_TARGETS = [12, 18, 24];

/* Pistas por ronda (se van rotando). */
const HINTS = {
  12: ['Pensá en filas iguales: 3 filas de 4 son 12.', 'Contá de a 4: 4, 8, 12. ¡Son 3 filas!'],
  18: ['Pensá en filas iguales: 3 filas de 6 son 18.', 'Contá de a 6: 6, 12, 18. ¡Son 3 filas!'],
  24: ['Pensá en filas iguales: 4 filas de 6 son 24.', 'Contá de a 8: 8, 16, 24. ¡Son 3 filas!'],
};

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

function cancel(id) {
  if (id == null) return;
  clearTimeout(id);
  timers.delete(id);
}

/* ---------- SVG propios ---------- */
const SVG_HIKER = `
<svg viewBox="0 0 40 48" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">
  <rect x="6" y="22" width="10" height="17" rx="5" fill="#F2C94C"/>
  <rect x="12" y="20" width="19" height="23" rx="9.5" fill="#2D9CDB"/>
  <rect x="12" y="20" width="19" height="23" rx="9.5" fill="#fff" opacity=".14"/>
  <circle cx="22" cy="12" r="8.5" fill="#FFD9B8"/>
  <path d="M12.5 11.5a9.5 9.5 0 0 1 19 0z" fill="#EB5757"/>
  <circle cx="22" cy="3.5" r="2.6" fill="#fff"/>
  <circle cx="25.3" cy="13.5" r="1.4" fill="#23405A"/>
</svg>`;

const SVG_BADGE = `
<svg viewBox="0 0 40 48" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">
  <rect x="6" y="22" width="10" height="17" rx="5" fill="#F2C94C"/>
  <rect x="12" y="20" width="19" height="23" rx="9.5" fill="#2D9CDB"/>
  <circle cx="22" cy="12" r="8.5" fill="#FFD9B8"/>
  <path d="M12.5 11.5a9.5 9.5 0 0 1 19 0z" fill="#EB5757"/>
  <circle cx="22" cy="3.5" r="2.6" fill="#fff"/>
  <circle cx="25.3" cy="13.5" r="1.4" fill="#23405A"/>
</svg>`;

/* ---------- Helpers de dominio ---------- */
const plural = (n, one, many) => (n === 1 ? one : many);
const filas = (n) => `${n} ${plural(n, 'fila', 'filas')}`;
const columnas = (n) => `${n} ${plural(n, 'columna', 'columnas')}`;
const lugares = (n) => `${n} ${plural(n, 'lugar', 'lugares')}`;

/** Todas las formas rectangulares r × c = target que entran en el terreno. */
function shapesFor(target) {
  const out = [];
  for (let r = 1; r <= ROWS; r++) {
    for (let c = 1; c <= COLS; c++) {
      if (r * c === target) out.push({ r, c });
    }
  }
  return out;
}

const inRect = (sel, r, c) => sel && r >= sel.r0 && r <= sel.r1 && c >= sel.c0 && c <= sel.c1;

/* ==========================================================
   NIVEL
   ========================================================== */
export default {
  id: 3,
  grade: '3°',
  title: 'Armado de Carpas',
  subtitle: 'Armá rectángulos para ubicar a los montañistas',
  available: true,

  icon() {
    return Assets.tent();
  },

  mount(root, ctx) {
    disposed = false;
    timers.clear();

    const state = {
      round: 0,
      sel: null,           // { r0, c0, r1, c1 } normalizado
      drag: null,          // { id, ar, ac, moved }
      busy: false,         // validando / celebrando
      wrongTimer: null,
      hintIndex: 0,
      found: [],           // [{ target, r, c }]
    };

    const target = () => ROUND_TARGETS[state.round];
    const dims = () => (state.sel
      ? { rows: state.sel.r1 - state.sel.r0 + 1, cols: state.sel.c1 - state.sel.c0 + 1 }
      : { rows: 0, cols: 0 });

    /* ---------- Cabecera: ronda + pista ---------- */
    const roundLabel = h('span', { class: 'l3-round__label' });
    const dots = h('span', { class: 'l3-dots', 'aria-hidden': 'true' },
      ROUND_TARGETS.map(() => h('span', { class: 'l3-dot' })));
    const hintBtn = h('button', {
      type: 'button',
      class: 'btn btn--accent btn--sm l3-hint',
      'aria-label': 'Pista: ver cómo pensar el rectángulo con filas iguales',
      onClick: () => onHint(),
    }, 'Pista');

    const top = h('div', { class: 'l3-top' },
      h('div', { class: 'l3-round' }, roundLabel, dots),
      hintBtn);

    /* ---------- Pedido ---------- */
    const goalNum = h('strong', { class: 'l3-goal__num' });
    const goal = h('div', { class: 'l3-goal' },
      h('span', { class: 'l3-goal__art', 'aria-hidden': 'true', html: SVG_BADGE }),
      h('h2', { class: 'l3-goal__text' }, 'Hacé espacio para ', goalNum, ' montañistas'));

    const instruction = h('p', { class: 'l3-instruction' },
      'Arrastrá sobre el terreno para sombrear un rectángulo de casilleros. ¡Cada casillero es un lugar!');

    /* ---------- Terreno ---------- */
    const cells = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = h('div', { class: 'l3-cell', dataset: { r, c } },
          h('span', { class: 'l3-cell__hiker', html: SVG_HIKER }),
          h('span', { class: 'l3-cell__tent', html: Assets.tent() }));
        cells.push(cell);
      }
    }
    const selBox = h('div', { class: 'l3-sel', hidden: true, 'aria-hidden': 'true' });
    const grid = h('div', { class: 'l3-grid' }, cells, selBox);
    const board = h('div', {
      class: 'l3-board',
      role: 'group',
      'aria-label': `Terreno de ${ROWS} filas por ${COLS} columnas. Arrastrá para elegir un rectángulo, o usá los controles de filas y columnas.`,
    }, grid);

    /* ---------- Cuenta en vivo ---------- */
    const rowsTxt = h('span', { class: 'l3-count__part l3-count__part--r' });
    const colsTxt = h('span', { class: 'l3-count__part l3-count__part--c' });
    const prodTxt = h('strong', { class: 'l3-count__prod' });
    const count = h('div', { class: 'l3-count', 'aria-live': 'polite', 'aria-atomic': 'true' },
      rowsTxt, h('span', { class: 'l3-count__op', 'aria-hidden': 'true' }, '×'), colsTxt,
      h('span', { class: 'l3-count__op', 'aria-hidden': 'true' }, '='), prodTxt);

    /* ---------- Steppers (alternativa sin arrastre) ---------- */
    function makeStepper(kind, label) {
      const out = h('output', { class: 'l3-stepper__val', 'aria-live': 'polite' }, '0');
      const minus = h('button', {
        type: 'button',
        class: 'l3-step l3-step--minus',
        'aria-label': `Una ${kind === 'r' ? 'fila' : 'columna'} menos`,
        onClick: () => nudge(kind, -1),
      }, h('span', { 'aria-hidden': 'true' }, '−'));
      const plus = h('button', {
        type: 'button',
        class: 'l3-step l3-step--plus',
        'aria-label': `Una ${kind === 'r' ? 'fila' : 'columna'} más`,
        onClick: () => nudge(kind, +1),
      }, h('span', { 'aria-hidden': 'true' }, '+'));
      const wrap = h('div', { class: `l3-stepper l3-stepper--${kind}`, role: 'group', 'aria-label': label },
        h('span', { class: 'l3-stepper__label' }, label), minus, out, plus);
      return { wrap, out, minus, plus };
    }
    const stepR = makeStepper('r', 'Filas');
    const stepC = makeStepper('c', 'Columnas');

    const doneBtn = h('button', {
      type: 'button',
      class: 'btn btn--secondary l3-done',
      onClick: () => onDone(),
    }, 'Listo');
    const clearBtn = h('button', {
      type: 'button',
      class: 'btn btn--ghost btn--sm l3-clear',
      onClick: () => onClear(),
    }, 'Borrar');

    const controls = h('div', { class: 'l3-controls', role: 'group', 'aria-label': 'Armar el rectángulo con botones' },
      h('p', { class: 'l3-controls__title' }, 'O armalo con botones'),
      h('div', { class: 'l3-steppers' }, stepR.wrap, stepC.wrap),
      h('div', { class: 'l3-actions' }, clearBtn, doneBtn));

    /* ---------- Mensajes ---------- */
    const feedback = h('div', { class: 'l3-feedback', role: 'status', 'aria-live': 'polite' });

    /* ---------- Colección ---------- */
    const collectionList = h('ul', { class: 'l3-collection__list' });
    const collection = h('section', { class: 'l3-collection', 'aria-label': 'Rectángulos que armaste' },
      h('h3', { class: 'l3-collection__title' }, 'Tus rectángulos'),
      collectionList);

    const side = h('div', { class: 'l3-side' }, count, controls, feedback, collection);
    const layout = h('div', { class: 'l3-layout' },
      h('div', { class: 'l3-main' }, board), side);

    root.replaceChildren(h('div', { class: 'l3' }, top, goal, instruction, layout));

    /* ---------- Mensajes ---------- */
    function say(tone, text) {
      feedback.className = `l3-feedback l3-feedback--${tone}`;
      feedback.replaceChildren(h('span', { class: 'l3-feedback__msg' }, text));
    }
    function clearFeedback() {
      feedback.className = 'l3-feedback';
      feedback.replaceChildren();
    }

    function renderCollection() {
      if (!state.found.length) {
        collectionList.replaceChildren(h('li', { class: 'l3-collection__empty' },
          'Acá van a aparecer los rectángulos que armes.'));
        return;
      }
      collectionList.replaceChildren(...state.found.map((f) =>
        h('li', { class: 'l3-chip' },
          h('span', { class: 'l3-chip__shape' }, `${f.r} × ${f.c}`),
          h('span', { class: 'l3-chip__eq' }, `= ${f.target}`))));
    }

    /* ---------- Render del terreno / cuenta / steppers ---------- */
    function render() {
      const { sel } = state;
      const { rows, cols } = dims();

      let i = 0;
      cells.forEach((cell, idx) => {
        const r = Math.floor(idx / COLS);
        const c = idx % COLS;
        const on = inRect(sel, r, c);
        if (on) cell.style.setProperty('--i', String(i++));
        cell.classList.toggle('is-sel', Boolean(on));
      });

      if (sel) {
        selBox.hidden = false;
        selBox.style.gridRow = `${sel.r0 + 1} / ${sel.r1 + 2}`;
        selBox.style.gridColumn = `${sel.c0 + 1} / ${sel.c1 + 2}`;
      } else {
        selBox.hidden = true;
      }

      count.classList.toggle('is-empty', !sel);
      rowsTxt.textContent = filas(rows);
      colsTxt.textContent = columnas(cols);
      prodTxt.textContent = String(rows * cols);

      stepR.out.textContent = String(rows);
      stepC.out.textContent = String(cols);
      const r0 = sel ? sel.r0 : 0;
      const c0 = sel ? sel.c0 : 0;
      const lock = state.busy;
      stepR.minus.disabled = lock || rows <= 1;
      stepR.plus.disabled = lock || rows >= ROWS - r0;
      stepC.minus.disabled = lock || cols <= 1;
      stepC.plus.disabled = lock || cols >= COLS - c0;
      clearBtn.disabled = lock || !sel;
      doneBtn.disabled = lock;
      hintBtn.disabled = lock;
    }

    function setBusy(value) {
      state.busy = value;
      board.classList.toggle('is-busy', value);
      render();
    }

    function resetSelection() {
      cancel(state.wrongTimer);
      state.wrongTimer = null;
      state.sel = null;
      selBox.classList.remove('is-wrong', 'is-right');
      board.classList.remove('is-wrong');
      render();
    }

    /* ---------- Rondas ---------- */
    function loadRound() {
      state.hintIndex = 0;
      state.drag = null;
      board.classList.remove('is-won');
      resetSelection();
      setBusy(false);

      goalNum.textContent = String(target());
      roundLabel.textContent = `Ronda ${state.round + 1} de ${ROUND_TARGETS.length}`;
      [...dots.children].forEach((dot, i) => {
        dot.classList.toggle('is-done', i < state.round);
        dot.classList.toggle('is-current', i === state.round);
      });

      clearFeedback();
      if (state.round > 0) {
        say('info', `Ahora llegaron ${target()} montañistas. ¿Qué rectángulo les da lugar a todos?`);
        ctx.renderer.pop(goal);
      }
    }

    /* ---------- Validación ---------- */
    function attempt() {
      const { rows, cols } = dims();
      const prod = rows * cols;
      const goalValue = target();

      if (prod === goalValue) {
        win(rows, cols);
        return;
      }

      ctx.fail();
      state.busy = true;
      board.classList.add('is-wrong');
      selBox.classList.add('is-wrong');
      const calc = `${rows} × ${cols} = ${prod}`;
      if (prod < goalValue) {
        say('warm', `Elegiste ${calc}. Todavía te ${plural(goalValue - prod, 'falta', 'faltan')} ${lugares(goalValue - prod)}.`);
      } else {
        say('warm', `Elegiste ${calc}. ¡${plural(prod - goalValue, 'Sobra', 'Sobran')} ${lugares(prod - goalValue)}! Probá con un rectángulo más chico.`);
      }
      render();
      state.wrongTimer = later(() => {
        state.wrongTimer = null;
        resetSelection();
        setBusy(false);
      }, WRONG_DELAY);
    }

    function win(rows, cols) {
      const goalValue = target();
      const isLast = state.round === ROUND_TARGETS.length - 1;

      setBusy(true);
      board.classList.add('is-won');
      selBox.classList.add('is-right');
      ctx.renderer.pop(board);
      ctx.renderer.pop(count);

      state.found.push({ target: goalValue, r: rows, c: cols });
      renderCollection();

      const others = shapesFor(goalValue).filter((s) => !(s.r === rows && s.c === cols));
      const extra = others.length
        ? ` También se puede con ${others.map((s) => `${s.r} × ${s.c}`).join(', ').replace(/, ([^,]*)$/, ' o $1')}.`
        : '';
      say('good', `¡Muy bien! ${filas(rows)} de ${cols} son ${goalValue}. ¡Ya armaste las carpas!${extra}`);

      later(() => {
        if (isLast) {
          ctx.success({
            message: '¡Armaste todas las carpas! Ahora sabés que filas × columnas te dice cuántos lugares hay en un rectángulo.',
          });
        } else {
          state.round += 1;
          loadRound();
        }
      }, WIN_DELAY);
    }

    /* ---------- Acciones ---------- */
    function onDone() {
      if (state.busy) return;
      if (!state.sel) {
        say('info', 'Primero armá un rectángulo en el terreno: arrastrá o usá los botones de filas y columnas.');
        return;
      }
      attempt();
    }

    function onClear() {
      if (state.busy) return;
      resetSelection();
      clearFeedback();
    }

    function onHint() {
      if (state.busy) return;
      const list = HINTS[target()];
      const text = list[state.hintIndex % list.length];
      state.hintIndex += 1;
      // La pista NO cuenta como falla: no se llama a ctx.fail().
      ctx.hint(text);
      say('info', `Pista: ${text}`);
    }

    function nudge(kind, delta) {
      if (state.busy) return;
      cancel(state.wrongTimer);
      let { sel } = state;
      if (!sel) {
        // Primer toque: aparece un casillero (1 × 1) en la esquina superior izquierda.
        sel = { r0: 0, c0: 0, r1: 0, c1: 0 };
        if (delta < 0) return;
      } else {
        sel = { ...sel };
        if (kind === 'r') sel.r1 = clamp(sel.r1 + delta, sel.r0, ROWS - 1);
        else sel.c1 = clamp(sel.c1 + delta, sel.c0, COLS - 1);
      }
      state.sel = sel;
      clearFeedback();
      render();
    }

    /* ---------- Drag-select (Pointer Events) ---------- */
    function cellFromPoint(x, y) {
      const first = cells[0].getBoundingClientRect();
      const last = cells[cells.length - 1].getBoundingClientRect();
      const w = (last.right - first.left) / COLS;
      const hgt = (last.bottom - first.top) / ROWS;
      return {
        r: clamp(Math.floor((y - first.top) / hgt), 0, ROWS - 1),
        c: clamp(Math.floor((x - first.left) / w), 0, COLS - 1),
      };
    }

    function rectBetween(a, b) {
      return {
        r0: Math.min(a.r, b.r), r1: Math.max(a.r, b.r),
        c0: Math.min(a.c, b.c), c1: Math.max(a.c, b.c),
      };
    }

    function onPointerDown(e) {
      if (state.busy && state.wrongTimer === null) return; // celebrando
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (state.drag) return;
      e.preventDefault();

      // Si había una selección equivocada esperando a borrarse, arrancamos de nuevo.
      cancel(state.wrongTimer);
      state.wrongTimer = null;
      if (state.busy) setBusy(false);
      selBox.classList.remove('is-wrong');
      board.classList.remove('is-wrong');

      const cell = cellFromPoint(e.clientX, e.clientY);
      state.drag = { id: e.pointerId, ar: cell.r, ac: cell.c, moved: false };
      try { board.setPointerCapture(e.pointerId); } catch { /* no crítico */ }
      board.classList.add('is-dragging');
      count.setAttribute('aria-live', 'off');
      state.sel = rectBetween({ r: cell.r, c: cell.c }, cell);
      clearFeedback();
      render();
    }

    function onPointerMove(e) {
      const d = state.drag;
      if (!d || e.pointerId !== d.id) return;
      const cell = cellFromPoint(e.clientX, e.clientY);
      if (cell.r !== d.ar || cell.c !== d.ac) d.moved = true;
      const next = rectBetween({ r: d.ar, c: d.ac }, cell);
      const s = state.sel;
      if (s && s.r0 === next.r0 && s.r1 === next.r1 && s.c0 === next.c0 && s.c1 === next.c1) return;
      state.sel = next;
      render();
    }

    function endDrag(e, commit) {
      const d = state.drag;
      if (!d || (e && e.pointerId !== d.id)) return;
      state.drag = null;
      try { board.releasePointerCapture(d.id); } catch { /* ya soltado */ }
      board.classList.remove('is-dragging');
      count.setAttribute('aria-live', 'polite');

      if (!commit) {
        resetSelection();
        return;
      }
      if (!d.moved) {
        // Un toque suelto: deja 1 casillero y invita a agrandar (no cuenta como intento).
        say('info', 'Arrastrá desde ese casillero para agrandar el rectángulo, o usá los botones + de Filas y Columnas.');
        render();
        return;
      }
      attempt();
    }

    const onPointerUp = (e) => endDrag(e, true);
    const onPointerCancel = (e) => endDrag(e, false);

    board.addEventListener('pointerdown', onPointerDown);
    board.addEventListener('pointermove', onPointerMove);
    board.addEventListener('pointerup', onPointerUp);
    board.addEventListener('pointercancel', onPointerCancel);

    renderCollection();
    loadRound();
  },

  unmount() {
    disposed = true;
    timers.forEach((id) => clearTimeout(id));
    timers.clear();
  },
};
