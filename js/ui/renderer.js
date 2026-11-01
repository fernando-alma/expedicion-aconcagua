/* ==========================================================
   renderer.js — Transiciones, inyección de HTML, modales, HUD
   y librería de SVGs inline (sin imágenes externas → sin 404).
   ========================================================== */

import { h, clear, fromHTML, sleep, randInt, escapeHTML } from '../core/utils.js';

/* ==========================================================
   ASSETS — SVGs inline. Cada función devuelve un string SVG.
   Regla: sin <defs>/ids para que se puedan repetir en el DOM
   sin colisiones.
   ========================================================== */
export const Assets = {
  mountain({ flag = true } = {}) {
    return `
<svg viewBox="0 0 320 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Montaña">
  <path d="M10 210 120 52l52 70 38-48 100 136z" fill="#2D9CDB"/>
  <path d="M120 52l-34 46 24-8 20 20 18-16 22 30z" fill="#fff"/>
  <path d="M120 52l52 70-18-16-18 16-20-20 24-8z" fill="#DCEFFB" opacity=".7"/>
  <path d="M210 74l50 70-30-14-18 14-20-24z" fill="#1F82BD" opacity=".35"/>
  <path d="M0 214c40-18 80-22 130-12 60 12 110 0 190-6v28H0z" fill="#27AE60"/>
  ${flag ? `<path d="M120 52V22" stroke="#23405A" stroke-width="3" stroke-linecap="round"/>
  <path d="M121 22l26 8-26 8z" fill="#EB5757"/>` : ''}
</svg>`;
  },

  backpack({ fill = '#2D9CDB' } = {}) {
    return `
<svg viewBox="0 0 200 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mochila">
  <path d="M70 34c0-18 12-28 30-28s30 10 30 28" fill="none" stroke="#1F82BD" stroke-width="9" stroke-linecap="round"/>
  <rect x="26" y="28" width="148" height="176" rx="52" fill="${fill}"/>
  <rect x="26" y="28" width="148" height="176" rx="52" fill="#fff" opacity=".08"/>
  <path d="M26 92c0-34 30-56 74-56s74 22 74 56z" fill="#fff" opacity=".18"/>
  <rect x="52" y="116" width="96" height="62" rx="26" fill="#1F82BD"/>
  <rect x="52" y="116" width="96" height="62" rx="26" fill="#fff" opacity=".12"/>
  <rect x="84" y="130" width="32" height="12" rx="6" fill="#F2C94C"/>
  <rect x="8" y="104" width="22" height="74" rx="11" fill="#1F82BD"/>
  <rect x="170" y="104" width="22" height="74" rx="11" fill="#1F82BD"/>
</svg>`;
  },

  carabiner({ color = '#F2C94C' } = {}) {
    return `
<svg viewBox="0 0 40 56" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mosquetón">
  <rect x="7" y="5" width="26" height="46" rx="13" fill="none" stroke="${color}" stroke-width="7"/>
  <rect x="7" y="5" width="26" height="46" rx="13" fill="none" stroke="#fff" stroke-width="2" opacity=".35"/>
  <path d="M29 18v16" stroke="#23405A" stroke-width="3" stroke-linecap="round" opacity=".35"/>
</svg>`;
  },

  /** Caja de suministros (para módulos de mosquetones, etc.) */
  crate({ color = '#F2C94C', label = '' } = {}) {
    return `
<svg viewBox="0 0 120 96" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Caja de suministros">
  <rect x="6" y="14" width="108" height="76" rx="18" fill="${color}"/>
  <rect x="6" y="14" width="108" height="76" rx="18" fill="#fff" opacity=".12"/>
  <rect x="6" y="14" width="108" height="24" rx="12" fill="#23405A" opacity=".16"/>
  <rect x="48" y="24" width="24" height="10" rx="5" fill="#23405A" opacity=".28"/>
  ${label ? `<text x="60" y="73" text-anchor="middle" font-family="Fredoka One, sans-serif" font-size="30" fill="#23405A">${escapeHTML(label)}</text>` : ''}
</svg>`;
  },

  coin({ label = '$1' } = {}) {
    return `
<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Moneda de ${escapeHTML(label)}">
  <circle cx="32" cy="32" r="29" fill="#D9A91F"/>
  <circle cx="32" cy="30" r="27" fill="#F2C94C"/>
  <circle cx="32" cy="30" r="20" fill="none" stroke="#fff" stroke-width="3" opacity=".55"/>
  <text x="32" y="38" text-anchor="middle" font-family="Fredoka One, sans-serif" font-size="22" fill="#9A7410">${escapeHTML(label)}</text>
</svg>`;
  },

  bill({ value = 100, color } = {}) {
    const palette = { 100: '#2D9CDB', 10: '#27AE60', 50: '#9B6BDF', 20: '#F2994A' };
    const fill = color || palette[value] || '#2D9CDB';
    return `
<svg viewBox="0 0 160 84" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Billete de $${value}">
  <rect x="3" y="6" width="154" height="74" rx="16" fill="#23405A" opacity=".12"/>
  <rect x="3" y="2" width="154" height="74" rx="16" fill="${fill}"/>
  <rect x="12" y="11" width="136" height="56" rx="10" fill="none" stroke="#fff" stroke-width="3" opacity=".5"/>
  <circle cx="80" cy="39" r="22" fill="#fff" opacity=".28"/>
  <text x="80" y="49" text-anchor="middle" font-family="Fredoka One, sans-serif" font-size="30" fill="#fff">$${value}</text>
  <circle cx="26" cy="22" r="5" fill="#fff" opacity=".6"/>
  <circle cx="134" cy="56" r="5" fill="#fff" opacity=".6"/>
</svg>`;
  },

  tent({ color = '#EB5757' } = {}) {
    return `
<svg viewBox="0 0 120 90" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Carpa">
  <path d="M8 82 60 10l52 72z" fill="${color}"/>
  <path d="M60 10 34 82h-26z" fill="#fff" opacity=".18"/>
  <path d="M60 36 40 82h40z" fill="#23405A" opacity=".45"/>
  <path d="M60 10v-6" stroke="#23405A" stroke-width="3" stroke-linecap="round"/>
</svg>`;
  },

  bottle({ level = 1, color = '#2D9CDB' } = {}) {
    const fillH = Math.round(70 * Math.max(0, Math.min(1, level)));
    return `
<svg viewBox="0 0 60 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Cantimplora">
  <rect x="20" y="2" width="20" height="12" rx="5" fill="#23405A" opacity=".5"/>
  <rect x="8" y="14" width="44" height="82" rx="16" fill="#fff" stroke="${color}" stroke-width="4"/>
  <rect x="12" y="${92 - fillH}" width="36" height="${fillH}" rx="12" fill="${color}" opacity=".85"/>
</svg>`;
  },

  scale() {
    return `
<svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Balanza">
  <rect x="146" y="40" width="28" height="130" rx="12" fill="#1F82BD"/>
  <rect x="96" y="164" width="128" height="26" rx="13" fill="#2D9CDB"/>
  <rect x="30" y="32" width="260" height="14" rx="7" fill="#F2C94C"/>
  <circle cx="160" cy="39" r="14" fill="#D9A91F"/>
</svg>`;
  },

  flag() {
    return `
<svg viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Bandera">
  <path d="M10 6v54" stroke="#23405A" stroke-width="5" stroke-linecap="round"/>
  <path d="M12 8c10-6 16 6 30 0v26c-14 6-20-6-30 0z" fill="#EB5757"/>
</svg>`;
  },

  star({ filled = true } = {}) {
    return `
<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M24 3l6.3 13.6 14.7 1.7-10.9 10.1 3 14.6L24 35.6 10.9 43l3-14.6L3 18.3l14.7-1.7z"
        fill="${filled ? '#F2C94C' : '#D8E8F4'}" stroke="${filled ? '#D9A91F' : '#BBD3E4'}" stroke-width="2.5" stroke-linejoin="round"/>
</svg>`;
  },

  lock() {
    return `
<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Bloqueado">
  <path d="M15 22v-6a9 9 0 0 1 18 0v6" fill="none" stroke="#9DB4C6" stroke-width="5" stroke-linecap="round"/>
  <rect x="9" y="21" width="30" height="22" rx="8" fill="#9DB4C6"/>
  <circle cx="24" cy="31" r="3.5" fill="#fff"/>
</svg>`;
  },
};

/* ==========================================================
   PANTALLAS
   ========================================================== */
const getContainer = () => document.getElementById('game-container');
let mountToken = 0;

/**
 * Limpia #game-container e inyecta una pantalla nueva con transición.
 * `content` puede ser un Node, un array de Nodes o un string HTML.
 * Devuelve el elemento <section class="screen"> inyectado.
 */
async function mountScreen(content, { className = '' } = {}) {
  const container = getContainer();
  const token = ++mountToken;

  const old = container.firstElementChild;
  if (old) {
    old.classList.add('screen-leave');
    await sleep(160);
    if (token !== mountToken) return null; // llegó otra navegación
  }

  clear(container);
  const screen = h('section', { class: `screen screen-enter ${className}`.trim() });
  if (typeof content === 'string') screen.innerHTML = content;
  else screen.append(...[].concat(content).filter((c) => c !== null && c !== undefined && c !== false));
  container.append(screen);
  container.scrollTop = 0;
  window.scrollTo({ top: 0 });
  return screen;
}

/* ==========================================================
   ANIMACIONES DE FEEDBACK
   ========================================================== */
const shakeTimers = new WeakMap();

/** Error amable: sacude el contenedor 400ms (sin texto agresivo). */
function shake(el) {
  if (!el) return;
  clearTimeout(shakeTimers.get(el));
  el.classList.remove('shake-error');
  void el.offsetWidth; // fuerza reflow para reiniciar la animación
  el.classList.add('shake-error');
  shakeTimers.set(el, setTimeout(() => el.classList.remove('shake-error'), 400));
}

/** Pulso positivo para acertijos parciales. */
function pop(el) {
  if (!el) return;
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
  setTimeout(() => el.classList.remove('pop'), 350);
}

const CONFETTI_COLORS = ['#2D9CDB', '#27AE60', '#F2C94C', '#EB5757', '#9B6BDF', '#F2994A'];

function confetti(parent, amount = 40) {
  const layer = h('div', { class: 'confetti', 'aria-hidden': 'true' });
  for (let i = 0; i < amount; i++) {
    layer.append(h('span', {
      class: 'confetti__piece',
      style: {
        '--x': `${randInt(0, 100)}%`,
        '--c': CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        '--d': `${(randInt(0, 600) / 1000 + 0.9).toFixed(2)}s`,
        '--delay': `${(randInt(0, 400) / 1000).toFixed(2)}s`,
        '--r': `${randInt(-360, 360)}deg`,
      },
    }));
  }
  parent.append(layer);
  setTimeout(() => layer.remove(), 2600);
}

/* ==========================================================
   MODALES
   ========================================================== */
let activeModal = null;

function closeModal() {
  if (!activeModal) return;
  const { overlay, onKey, previousFocus } = activeModal;
  activeModal = null;
  document.removeEventListener('keydown', onKey);
  overlay.classList.add('modal-overlay--leaving');
  setTimeout(() => overlay.remove(), 200);
  previousFocus?.focus?.();
}

/**
 * showModal({
 *   icon: string SVG | Node,
 *   title, message,
 *   stars: 0..3 (si se pasa, muestra estrellas animadas),
 *   tone: 'success' | 'info',
 *   confetti: boolean,
 *   dismissible: boolean,
 *   actions: [{ label, variant: 'primary'|'secondary'|'accent'|'ghost', onClick }]
 * })
 */
function showModal({
  icon = null,
  title = '',
  message = '',
  stars = null,
  tone = 'info',
  confetti: withConfetti = false,
  dismissible = false,
  actions = [],
} = {}) {
  if (activeModal) closeModal();

  const root = document.getElementById('modal-root');
  const previousFocus = document.activeElement;

  const iconNode = icon
    ? h('div', { class: 'modal__icon' }, typeof icon === 'string' ? fromHTML(icon) : icon)
    : null;

  const starsNode = stars === null ? null : h(
    'div', { class: 'modal__stars', role: 'img', 'aria-label': `${stars} de 3 estrellas` },
    [1, 2, 3].map((n) => h('span', {
      class: `modal__star ${n <= stars ? 'is-on' : ''}`,
      style: { '--i': n },
      html: Assets.star({ filled: n <= stars }),
    }))
  );

  const buttons = actions.map((action, idx) => h('button', {
    type: 'button',
    class: `btn btn--${action.variant || (idx === 0 ? 'primary' : 'ghost')}`,
    onClick: () => {
      closeModal();
      action.onClick?.();
    },
  }, action.label));

  const card = h('div', {
    class: `modal modal--${tone}`,
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': title || 'Mensaje',
  },
    iconNode,
    title && h('h2', { class: 'modal__title' }, title),
    message && h('p', { class: 'modal__message' }, message),
    starsNode,
    buttons.length ? h('div', { class: 'modal__actions' }, buttons) : null
  );

  const overlay = h('div', { class: 'modal-overlay' }, card);
  if (dismissible) {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  }

  const onKey = (e) => {
    if (e.key === 'Escape' && dismissible) closeModal();
    if (e.key === 'Tab') { // focus trap mínimo
      const focusables = card.querySelectorAll('button');
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  document.addEventListener('keydown', onKey);

  root.append(overlay);
  activeModal = { overlay, onKey, previousFocus };
  if (withConfetti) confetti(overlay);
  card.querySelector('button')?.focus({ preventScroll: true });

  return { el: card, close: closeModal };
}

/* ==========================================================
   TOASTS (mensajes breves y amables)
   ========================================================== */
function toast(message, { duration = 2400, tone = 'info' } = {}) {
  const root = document.getElementById('toast-root');
  const node = h('div', { class: `toast toast--${tone}`, role: 'status' }, message);
  root.append(node);
  setTimeout(() => {
    node.classList.add('toast--leaving');
    setTimeout(() => node.remove(), 250);
  }, duration);
  return node;
}

/* ==========================================================
   HUD
   ========================================================== */
function renderHud({ score = 0, stars = 0, label = '', onHome = null } = {}) {
  const hud = document.getElementById('hud');
  hud.hidden = false;
  clear(hud);
  hud.append(
    h('button', {
      type: 'button',
      class: 'hud__home',
      'aria-label': 'Volver al mapa de la expedición',
      onClick: () => onHome?.(),
    },
      h('span', { class: 'hud__logo', html: Assets.mountain({ flag: false }) }),
      h('span', { class: 'hud__brand' }, 'Expedición Aconcagua')
    ),
    h('div', { class: 'hud__stats' },
      label && h('span', { class: 'hud__pill hud__pill--level' }, label),
      h('span', { class: 'hud__pill hud__pill--stars', title: 'Estrellas' },
        h('span', { class: 'hud__icon', html: Assets.star() }), String(stars)),
      h('span', { class: 'hud__pill hud__pill--score', title: 'Puntos' },
        h('span', { class: 'hud__icon', html: Assets.coin({ label: '' }) }), String(score))
    )
  );
}

function hideHud() {
  const hud = document.getElementById('hud');
  hud.hidden = true;
  clear(hud);
}

export const Renderer = {
  Assets,
  mountScreen,
  shake,
  pop,
  confetti,
  showModal,
  closeModal,
  toast,
  renderHud,
  hideHud,
};

export default Renderer;
