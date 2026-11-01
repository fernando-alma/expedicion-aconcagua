/* ==========================================================
   level1.js — Nivel 1 · Campamento Base (1° grado)
   Sumas simples y conteo visual hasta 100.
   Mecánica: armar una mochila con exactamente N ganchos
   usando cajas (módulos de 1, 5 y 10) por clic o arrastre.
   ========================================================== */

import { h, fromHTML, randInt, pointInRect } from '../core/utils.js';
import { Assets } from '../ui/renderer.js';

const TOTAL_ROUNDS = 3;
const DRAG_THRESHOLD = 6;     // px de movimiento para diferenciar arrastre de clic
const WIN_DELAY = 700;        // ms antes de pasar a la ronda siguiente
const FRAME_COLS = 10;        // "marco de 10": casilleros por fila
const MAX_EXTRA = 30;         // cuánto se puede pasar del objetivo
const MAX_CAPACITY = 130;     // tope absoluto de ganchos en la mochila
const GHOST_W = 88;
const GHOST_H = 70;

const MODULES = {
  1:  { crate: '#F2C94C', cara: '#E0A81A' },
  5:  { crate: '#7ED9A5', cara: '#27AE60' },
  10: { crate: '#8CCBF2', cara: '#2D9CDB' },
};

const noun = (n) => (n === 1 ? 'gancho' : 'ganchos');

/** Ronda 1 siempre 14; las otras varían en cada partida. */
function buildRounds() {
  const r2 = randInt(20, 50);
  const r3 = randInt(Math.max(40, r2 + 5), 100);
  return [
    { target: 14, modules: [5, 1] },
    { target: r2, modules: [10, 5, 1] },
    { target: r3, modules: [10, 5, 1] },
  ];
}

/** Anida un SVG de Assets dentro de otro SVG (para el ícono del mapa). */
const nest = (svg, x, y, w, hgt) =>
  svg.replace('<svg ', `<svg x="${x}" y="${y}" width="${w}" height="${hgt}" `);

let cleanup = null;

export default {
  id: 1,
  grade: '1°',
  title: 'Campamento Base',
  subtitle: 'Armá la mochila contando ganchos',
  available: true,

  icon() {
    return `
<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mochila con ganchos">
  ${nest(Assets.backpack(), 22, 2, 76, 84)}
  ${nest(Assets.carabiner({ color: '#F2C94C' }), 4, 54, 28, 40)}
  ${nest(Assets.carabiner({ color: '#27AE60' }), 88, 54, 28, 40)}
</svg>`;
  },

  mount(root, ctx) {
    cleanup?.();
    cleanup = null;

    const { renderer } = ctx;
    const rounds = buildRounds();

    let alive = true;
    const timers = new Set();
    const ghosts = new Set();

    let roundIdx = 0;
    let target = 0;
    let modules = [];
    let limit = 0;
    let bag = [];
    let uid = 0;
    let locked = false;
    let wasOver = false;
    let prevTotal = 0;

    let drag = null;
    let ghost = null;
    let lastDragEnd = 0;

    const later = (fn, ms) => {
      const id = setTimeout(() => {
        timers.delete(id);
        if (alive) fn();
      }, ms);
      timers.add(id);
      return id;
    };

    const total = () => bag.reduce((acc, item) => acc + item.value, 0);

    /* ---------- Esqueleto del nivel ---------- */
    const els = {};

    els.roundLabel = h('span', { class: 'l1-rounds__label' });
    els.dots = h('span', { class: 'l1-rounds__dots', 'aria-hidden': 'true' },
      rounds.map(() => h('span', { class: 'l1-dot' })));
    els.rounds = h('div', { class: 'l1-rounds' }, els.roundLabel, els.dots);

    els.request = h('p', { class: 'l1-request' });

    els.num = h('span', { class: 'l1-counter__num' }, '0');
    els.of = h('span', { class: 'l1-counter__of' });
    els.counter = h('p', { class: 'l1-counter' },
      h('span', { class: 'l1-counter__label' }, 'Llevás'), els.num, els.of);

    els.bagList = h('ul', { class: 'l1-bag__list', 'aria-label': 'Módulos en la mochila' });
    els.bagEmpty = h('p', { class: 'l1-bag__empty' }, 'Todavía no hay cajas. Tocá una o arrastrala hasta acá.');
    els.clear = h('button', {
      type: 'button',
      class: 'btn btn--ghost btn--sm l1-clear',
      'aria-label': 'Vaciar la mochila',
      onClick: clearBag,
    }, 'Vaciar mochila');

    els.pack = h('section', { class: 'l1-pack', 'aria-label': 'Mochila' },
      h('div', { class: 'l1-pack__top' },
        h('div', { class: 'l1-pack__art', html: Assets.backpack() }),
        els.counter),
      h('div', { class: 'l1-bag' },
        h('h3', { class: 'l1-bag__title' }, 'En la mochila (tocá para sacar)'),
        els.bagList,
        els.bagEmpty,
        h('div', { class: 'l1-bag__actions' }, els.clear)));

    els.crates = h('div', { class: 'l1-inv__grid' });
    els.inv = h('section', { class: 'l1-inv', 'aria-label': 'Cajas de suministros' },
      h('h3', { class: 'l1-inv__title' }, 'Cajas de suministros'),
      h('p', { class: 'l1-inv__hint' }, 'Tocá una caja o arrastrala hasta la mochila.'),
      els.crates);

    els.grid = h('div', { class: 'l1-frame__grid', role: 'img' });
    els.frame = h('section', { class: 'l1-frame', 'aria-label': 'Marco de 10' },
      h('h3', { class: 'l1-frame__title' }, 'Contá los ganchos'),
      els.grid,
      h('p', { class: 'l1-frame__legend' }, 'Cada fila tiene 10 lugares.'));

    els.board = h('div', { class: 'l1-board' }, els.pack, els.inv, els.frame);
    els.msg = h('p', { class: 'l1-msg l1-msg--info', 'aria-live': 'polite' });

    els.wrap = h('div', { class: 'l1', 'aria-live': 'off' },
      els.rounds, els.request, els.board, els.msg);

    /* ---------- Render ---------- */
    function buildCrate(value) {
      const m = MODULES[value];
      const minis = [];
      for (let i = 0; i < value; i++) {
        minis.push(h('span', { class: 'l1-mini', html: Assets.carabiner({ color: m.cara }) }));
      }
      return h('button', {
        type: 'button',
        class: `l1-crate l1-crate--${value}`,
        'aria-label': `Agregar módulo de ${value} ${noun(value)} a la mochila`,
        dataset: { value },
        onClick: (e) => onCrateClick(e, value),
        onPointerdown: (e) => onCratePointerDown(e, value),
        onContextmenu: (e) => e.preventDefault(),
      },
        h('span', { class: 'l1-crate__art', 'aria-hidden': 'true', html: Assets.crate({ color: m.crate, label: `+${value}` }) }),
        h('span', { class: 'l1-crate__items', 'aria-hidden': 'true' }, minis),
        h('span', { class: 'l1-crate__name' }, `Módulo de ${value}`));
    }

    function renderBag(addedLast = false) {
      const chips = bag.map((item, i) => h('li', {},
        h('button', {
          type: 'button',
          class: `l1-chip l1-chip--${item.value}${addedLast && i === bag.length - 1 ? ' is-new' : ''}`,
          'aria-label': `Sacar el módulo de ${item.value} de la mochila`,
          dataset: { id: item.id },
          onClick: () => removeItem(item.id),
        },
          `+${item.value}`,
          h('span', { class: 'l1-chip__x', 'aria-hidden': 'true' }, '×'))));
      els.bagList.replaceChildren(...chips);
      els.bagEmpty.hidden = bag.length > 0;
      els.clear.disabled = bag.length === 0;
    }

    function renderFrame(t) {
      const rows = Math.ceil(Math.max(target, t) / FRAME_COLS);
      const colorAt = [];
      bag.forEach((item) => { for (let i = 0; i < item.value; i++) colorAt.push(item.value); });

      const rowNodes = [];
      for (let r = 0; r < rows; r++) {
        const cells = [];
        for (let c = 0; c < FRAME_COLS; c++) {
          const idx = r * FRAME_COLS + c;
          const filled = idx < t;
          const cls = ['l1-cell'];
          if (filled) {
            cls.push('is-filled', `l1-cell--${colorAt[idx]}`);
            if (idx >= target) cls.push('is-over');
            if (idx >= prevTotal) cls.push('is-new');
          } else if (idx >= target) {
            cls.push('is-spare');
          }
          if (idx === target - 1) cls.push('is-goal');

          const cell = h('span', { class: cls.join(' ') },
            filled ? fromHTML(Assets.carabiner({ color: MODULES[colorAt[idx]].cara })) : null);
          if (filled && idx >= prevTotal) cell.style.setProperty('--i', String(idx - prevTotal));
          cells.push(cell);
        }
        rowNodes.push(h('div', { class: 'l1-row' }, cells));
      }
      els.grid.replaceChildren(...rowNodes);
      els.grid.setAttribute('aria-label', `Marco de 10: ${t} de ${target} ${noun(target)}`);
    }

    function setMsg(text, tone, t) {
      els.msg.className = `l1-msg l1-msg--${tone}`;
      els.msg.replaceChildren(
        h('span', { class: 'sr-only' }, `Llevás ${t} de ${target}. `),
        text);
    }

    function describe(t, note) {
      if (t === target) return { tone: 'ok', text: `¡Exacto! Llevás ${target} ${noun(target)}.` };
      if (t > target) {
        return { tone: 'over', text: `¡Uy, te pasaste! Sacá algunas cajas de la mochila. (Sobran ${t - target}.)` };
      }
      if (t === 0) return { tone: 'info', text: note || 'Tocá una caja o arrastrala hasta la mochila.' };
      const missing = target - t;
      const missingText = missing === 1 ? 'Te falta 1' : `Te faltan ${missing}`;
      return { tone: 'info', text: `${note ? `${note} ` : ''}${missingText} para llegar a ${target}.` };
    }

    function update({ note, added = false } = {}) {
      const t = total();
      els.num.textContent = String(t);
      if (t !== prevTotal) renderer.pop(els.num);

      renderBag(added);
      renderFrame(t);

      els.pack.classList.toggle('is-over', t > target);
      els.pack.classList.toggle('is-exact', t === target);

      const over = t > target;
      if (over && !wasOver) ctx.fail(); // un único aviso por cada vez que se pasa
      wasOver = over;

      const d = describe(t, note);
      setMsg(d.text, d.tone, t);
      prevTotal = t;

      if (t === target) win();
    }

    /* ---------- Acciones ---------- */
    function addModule(value) {
      if (locked) return;
      if (total() + value > limit) {
        setMsg('¡La mochila no entra más! Sacá alguna caja.', 'over', total());
        renderer.pop(els.pack);
        return;
      }
      bag.push({ id: ++uid, value });
      update({ added: true });
    }

    function removeItem(id) {
      if (locked) return;
      const idx = bag.findIndex((item) => item.id === id);
      if (idx < 0) return;
      const hadFocus = document.activeElement?.classList?.contains('l1-chip');
      bag.splice(idx, 1);
      update();
      if (hadFocus) {
        const chips = els.bagList.querySelectorAll('.l1-chip');
        const next = chips[Math.min(idx, chips.length - 1)] || els.crates.querySelector('.l1-crate');
        next?.focus({ preventScroll: true });
      }
    }

    function clearBag() {
      if (locked || !bag.length) return;
      const hadFocus = document.activeElement === els.clear;
      bag = [];
      update({ note: 'Mochila vacía. ¡Probá de nuevo!' });
      if (hadFocus) els.crates.querySelector('.l1-crate')?.focus({ preventScroll: true });
    }

    function win() {
      locked = true;
      els.wrap.classList.add('is-won');
      renderer.pop(els.pack);
      renderer.pop(els.num);
      const last = roundIdx === TOTAL_ROUNDS - 1;
      later(() => {
        if (last) {
          ctx.success({
            message: 'Armaste tres mochilas con la cantidad justa de ganchos. ¡Contás como un verdadero montañista!',
          });
        } else {
          startRound(roundIdx + 1);
        }
      }, WIN_DELAY);
    }

    function startRound(i) {
      const focusedValue = root.contains(document.activeElement)
        ? document.activeElement.closest?.('.l1-crate')?.dataset.value
        : null;

      roundIdx = i;
      const cfg = rounds[i];
      target = cfg.target;
      modules = cfg.modules;
      limit = Math.min(MAX_CAPACITY, target + MAX_EXTRA);
      bag = [];
      locked = false;
      wasOver = false;
      prevTotal = 0;

      els.wrap.classList.remove('is-won');
      els.pack.classList.remove('is-over', 'is-exact', 'is-hover');

      els.roundLabel.textContent = `Ronda ${i + 1} de ${TOTAL_ROUNDS}`;
      [...els.dots.children].forEach((dot, n) => {
        dot.className = `l1-dot${n < i ? ' is-done' : n === i ? ' is-current' : ''}`;
      });

      els.request.replaceChildren(
        h('span', { class: 'l1-request__icon', 'aria-hidden': 'true', html: Assets.carabiner() }),
        h('span', {},
          'Armá una mochila con exactamente ',
          h('strong', { class: 'l1-request__n' }, String(target)),
          ` ${noun(target)}`));

      els.of.textContent = `de ${target}`;
      els.crates.replaceChildren(...modules.map(buildCrate));

      update();

      if (i > 0) {
        els.board.classList.remove('l1-enter');
        void els.board.offsetWidth;
        els.board.classList.add('l1-enter');
        const again = focusedValue && els.crates.querySelector(`[data-value="${focusedValue}"]`);
        (again || (focusedValue !== null && focusedValue !== undefined ? els.crates.querySelector('.l1-crate') : null))
          ?.focus({ preventScroll: true });
      }
    }

    /* ---------- Clic vs. arrastre ---------- */
    function onCrateClick(e, value) {
      // Un clic nativo justo después de soltar un arrastre se ignora (detail 0 = teclado)
      if (e.detail !== 0 && performance.now() - lastDragEnd < 150) return;
      addModule(value);
    }

    function onCratePointerDown(e, value) {
      if (locked || !e.isPrimary) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (drag) finishDrag(null, true);
      drag = {
        value,
        crateEl: e.currentTarget,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        active: false,
      };
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
      document.addEventListener('pointercancel', onPointerCancel);
    }

    function startGhost() {
      const m = MODULES[drag.value];
      ghost = h('div', { class: 'l1-ghost', 'aria-hidden': 'true' },
        fromHTML(Assets.crate({ color: m.crate, label: `+${drag.value}` })));
      document.body.append(ghost);
      ghosts.add(ghost);
      drag.crateEl.classList.add('is-dragging');
      els.wrap.classList.add('is-dragging-any');
    }

    function placeGhost(el, x, y, extra = 'scale(1.08) rotate(-4deg)') {
      el.style.transform = `translate3d(${x - GHOST_W / 2}px, ${y - GHOST_H / 2}px, 0) ${extra}`;
    }

    function onPointerMove(e) {
      if (!drag || e.pointerId !== drag.pointerId) return;
      if (!drag.active) {
        if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < DRAG_THRESHOLD) return;
        drag.active = true;
        startGhost();
      }
      placeGhost(ghost, e.clientX, e.clientY);
      els.pack.classList.toggle('is-hover', pointInRect(e.clientX, e.clientY, els.pack.getBoundingClientRect()));
    }

    function onPointerUp(e) {
      if (!drag || e.pointerId !== drag.pointerId) return;
      finishDrag(e, false);
    }

    function onPointerCancel(e) {
      if (!drag || e.pointerId !== drag.pointerId) return;
      finishDrag(e, true);
    }

    function removeGhostLater(g, crateEl) {
      later(() => {
        g.remove();
        ghosts.delete(g);
        crateEl?.classList.remove('is-dragging');
      }, 260);
    }

    function finishDrag(e, cancelled) {
      const d = drag;
      if (!d) return;
      drag = null;
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerCancel);
      if (!d.active) return; // fue un clic: lo resuelve el evento click

      lastDragEnd = performance.now();
      els.wrap.classList.remove('is-dragging-any');
      els.pack.classList.remove('is-hover');

      const g = ghost;
      ghost = null;
      if (!g) return;

      const packRect = els.pack.getBoundingClientRect();
      const hit = !cancelled && e && pointInRect(e.clientX, e.clientY, packRect);

      g.classList.add('is-leaving');
      if (hit) {
        const art = els.pack.querySelector('.l1-pack__art').getBoundingClientRect();
        placeGhost(g, art.left + art.width / 2, art.top + art.height / 2, 'scale(.25)');
        g.style.opacity = '0';
        removeGhostLater(g, d.crateEl);
        addModule(d.value);
      } else {
        // vuelve a su lugar
        const r = d.crateEl.getBoundingClientRect();
        placeGhost(g, r.left + r.width / 2, r.top + r.height / 2, 'scale(1)');
        removeGhostLater(g, d.crateEl);
      }
    }

    /* ---------- Arranque ---------- */
    root.replaceChildren(els.wrap);
    startRound(0);

    cleanup = () => {
      alive = false;
      timers.forEach((id) => clearTimeout(id));
      timers.clear();
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerCancel);
      ghosts.forEach((g) => g.remove());
      ghosts.clear();
      drag = null;
      ghost = null;
    };
  },

  unmount() {
    cleanup?.();
    cleanup = null;
  },
};
