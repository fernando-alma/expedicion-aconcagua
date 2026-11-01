# Expedición Aconcagua

Videojuego didáctico de matemática para alumnos de 1° a 7° grado (Educación Primaria, Argentina).
SPA estática en **HTML5 + CSS3 + Vanilla JS (ES modules)**. Sin frameworks, sin backend, sin imágenes externas (todo SVG inline).

## Estado del MVP

| Nivel | Grado | Tema | Estado |
|------:|:-----:|------|--------|
| 1 | 1° | Campamento Base: sumas y conteo hasta 100 | Jugable |
| 2 | 2° | Almacén del Refugio: valor posicional | Jugable |
| 3 | 3° | Armado de Carpas: multiplicación en grillas | Jugable |
| 4 | 4° | Racionamiento: fracciones | Jugable |
| 5 | 5° | Zona de Rescate: área y perímetro | Jugable |
| 6 | 6° | Análisis Climático: enteros | Jugable |
| 7 | 7° | Puente del Equilibrio: ecuaciones | Jugable |

## Probar en local

Los ES modules no funcionan abriendo `index.html` con doble clic (`file://`). Levantá un servidor estático:

```bash
cd expedicion-aconcagua
python3 -m http.server 8080
# o: npx serve .
```

Abrí http://localhost:8080

## Publicar en GitHub Pages

1. Subí esta carpeta a un repositorio de GitHub (la raíz del repo debe contener `index.html`).
2. En el repo: **Settings → Pages → Build and deployment → Deploy from a branch**.
3. Elegí la rama `main` y la carpeta `/ (root)`. Guardá.
4. A los pocos minutos el juego queda en `https://<usuario>.github.io/<repo>/`.

## Arquitectura

```
index.html            Punto de entrada (contenedor #game-container)
css/main.css          Variables, tipografía, reset, layout
css/ui.css            Botones, modales, HUD, animaciones (shake-error)
css/levels.css        Estilos de los minijuegos (prefijos .l1- … .l7-)
js/core/app.js        Router por hash, game loop (rAF), contexto de nivel
js/core/state.js      Progreso y puntaje en localStorage
js/core/utils.js      Helpers: random, colisiones, DOM (h), formato es-AR
js/ui/renderer.js     Transiciones, modales, toasts, HUD y librería de SVGs
js/levels/levelN.js   Un minijuego por archivo
```

### Contrato de un nivel

```js
export default {
  id: 3, grade: '3°', title: '…', subtitle: '…',
  available: true,             // false → "Próximamente"
  icon() { return '<svg…>'; }, // para el mapa
  mount(root, ctx) { … },      // dibuja el minijuego en root
  unmount() { … },             // limpieza (listeners, timeouts)
};
```

`ctx` ofrece `success({ points?, stars?, message? })`, `fail()` (sacude el contenedor 400 ms),
`hint(texto)`, `onTick(fn)` (game loop), `goMap()`, `renderer`, `utils` y `state`.
Las estrellas se calculan solo: 3 sin fallos, 2 con hasta 2 fallos, 1 con más.

### Rutas

`#` título · `#map` mapa de niveles · `#level-N` nivel.

### Progreso guardado

`localStorage["expedicion-aconcagua:v1"]` → `{ level, completed, score, … }`.
Para reiniciar: botón "Empezar de nuevo" en el título, o borrar esa clave.

## Cómo agregar un nivel nuevo

1. Crear `js/levels/levelN.js` siguiendo el contrato de arriba, con `available: true`.
2. Importarlo y sumarlo a `LEVELS` en `js/core/app.js`.
3. Agregar sus estilos (prefijo `lN-`) en `css/levels.css`.
4. Subir `TOTAL_LEVELS` en `js/core/state.js`.
