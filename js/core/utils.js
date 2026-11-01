/* ==========================================================
   utils.js — Funciones helper (random, colisiones, DOM, formato)
   ========================================================== */

/* ---------- Aleatorio ---------- */
export const randInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

export const pick = (arr) => arr[randInt(0, arr.length - 1)];

export const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/* ---------- Matemática chica ---------- */
export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
export const sum = (arr) => arr.reduce((acc, n) => acc + n, 0);
export const gcd = (a, b) => (b === 0 ? Math.abs(a) : gcd(b, a % b));

/* ---------- Colisiones ---------- */
/** Rects con forma { left, top, right, bottom } (compatible con DOMRect). */
export const rectsCollide = (a, b) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

export const pointInRect = (x, y, rect) =>
  x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;

export const elementsCollide = (elA, elB) =>
  rectsCollide(elA.getBoundingClientRect(), elB.getBoundingClientRect());

export const distance = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

/* ---------- Tiempo ---------- */
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const debounce = (fn, wait = 150) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
};

/* ---------- Formato (es-AR) ---------- */
export const formatARS = (n) => '$' + Number(n).toLocaleString('es-AR');
export const formatNumber = (n) => Number(n).toLocaleString('es-AR');

/* ---------- DOM ---------- */
/**
 * Hyperscript mínimo para crear elementos HTML sin innerHTML.
 *   h('button', { class: 'btn', onClick: fn, dataset: { id: 1 } }, 'Hola')
 * Los hijos pueden ser strings, nodos, arrays o null/false (se ignoran).
 */
export function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class' || key === 'className') node.className = value;
    else if (key === 'style' && typeof value === 'object') {
      for (const [prop, val] of Object.entries(value)) {
        // Las custom properties (--x) requieren setProperty; Object.assign no las aplica.
        if (prop.startsWith('--')) node.style.setProperty(prop, val);
        else node.style[prop] = val;
      }
    }
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'html') node.innerHTML = value;
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, value);
  }
  appendChildren(node, children);
  return node;
}

function appendChildren(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

/** Convierte un string de HTML/SVG en su primer elemento. */
export function fromHTML(markup) {
  const tpl = document.createElement('template');
  tpl.innerHTML = markup.trim();
  return tpl.content.firstElementChild;
}

/** Vacía un elemento de forma segura. */
export const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

/** Escapa texto para insertarlo dentro de strings de HTML/SVG. */
export const escapeHTML = (str) =>
  String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let uidCounter = 0;
export const uid = (prefix = 'id') => `${prefix}-${++uidCounter}`;
