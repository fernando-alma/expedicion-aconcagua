/* ==========================================================
   state.js — Estado y progreso del jugador (localStorage)
   ----------------------------------------------------------
   Forma del estado persistido:
   {
     version: 1,
     started: boolean,          // ya pasó por la pantalla de título
     level: number,             // nivel más alto desbloqueado (1..7)
     completed: { [id]: { stars, points, plays, at } },
     score: number,             // suma de los mejores puntajes por nivel
     createdAt: number
   }
   ========================================================== */

export const TOTAL_LEVELS = 7;
const STORAGE_KEY = 'expedicion-aconcagua:v1';
const SCHEMA_VERSION = 1;

const defaultState = () => ({
  version: SCHEMA_VERSION,
  started: false,
  level: 1,
  completed: {},
  score: 0,
  createdAt: Date.now(),
});

/* ---------- Persistencia segura ---------- */
function readStorage() {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // modo privado o storage bloqueado
  }
}

function writeStorage(value) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
    return true;
  } catch {
    return false;
  }
}

/** Valida y repara cualquier cosa que venga de localStorage. */
function sanitize(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== 'object') return base;

  const completed = {};
  if (raw.completed && typeof raw.completed === 'object') {
    for (const [id, entry] of Object.entries(raw.completed)) {
      const n = Number(id);
      if (!Number.isInteger(n) || n < 1 || n > TOTAL_LEVELS || !entry) continue;
      completed[n] = {
        stars: Math.min(3, Math.max(1, Number(entry.stars) || 1)),
        points: Math.max(0, Number(entry.points) || 0),
        plays: Math.max(1, Number(entry.plays) || 1),
        at: Number(entry.at) || Date.now(),
      };
    }
  }

  const highestDone = Math.max(0, ...Object.keys(completed).map(Number));
  const level = Math.min(
    TOTAL_LEVELS,
    Math.max(Number(raw.level) || 1, Math.min(TOTAL_LEVELS, highestDone + 1))
  );

  return {
    ...base,
    started: Boolean(raw.started),
    level,
    completed,
    score: Object.values(completed).reduce((acc, c) => acc + c.points, 0),
    createdAt: Number(raw.createdAt) || base.createdAt,
  };
}

function load() {
  const raw = readStorage();
  if (!raw) return defaultState();
  try {
    return sanitize(JSON.parse(raw));
  } catch {
    return defaultState();
  }
}

/* ---------- Store ---------- */
let state = load();
const listeners = new Set();

function commit() {
  writeStorage(JSON.stringify(state));
  listeners.forEach((fn) => fn(state));
}

export const State = {
  TOTAL_LEVELS,

  /** Copia de solo lectura del estado actual. */
  get() {
    return structuredClone(state);
  },

  /** true si nunca se jugó (pantalla de título con "Empezar"). */
  isNewPlayer() {
    return !state.started && Object.keys(state.completed).length === 0;
  },

  markStarted() {
    if (state.started) return;
    state.started = true;
    commit();
  },

  /** Nivel más alto desbloqueado. */
  get unlockedLevel() {
    return state.level;
  },

  get score() {
    return state.score;
  },

  isUnlocked(id) {
    return id >= 1 && id <= state.level;
  },

  isCompleted(id) {
    return Boolean(state.completed[id]);
  },

  getResult(id) {
    return state.completed[id] ? { ...state.completed[id] } : null;
  },

  totalStars() {
    return Object.values(state.completed).reduce((acc, c) => acc + c.stars, 0);
  },

  completedCount() {
    return Object.keys(state.completed).length;
  },

  /**
   * Registra la victoria de un nivel. Guarda el mejor resultado
   * (repetir un nivel nunca baja el puntaje) y avanza `level`.
   */
  completeLevel(id, { stars = 3, points = 100 } = {}) {
    const prev = state.completed[id];
    state.completed[id] = {
      stars: Math.max(prev?.stars ?? 0, stars),
      points: Math.max(prev?.points ?? 0, points),
      plays: (prev?.plays ?? 0) + 1,
      at: Date.now(),
    };
    if (id >= state.level && id < TOTAL_LEVELS) state.level = id + 1;
    state.score = Object.values(state.completed).reduce((acc, c) => acc + c.points, 0);
    state.started = true;
    commit();
    return this.getResult(id);
  },

  /** Borra todo el progreso. */
  reset() {
    state = defaultState();
    commit();
  },

  /** Se llama cada vez que cambia el estado. Devuelve la función para desuscribirse. */
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export default State;
