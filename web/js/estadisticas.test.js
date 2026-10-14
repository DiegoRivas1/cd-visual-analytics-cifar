/**
 * Pruebas en aislamiento de estadisticas.js — sin D3, sin navegador.
 * Ejecutar con: node web/js/estadisticas.test.js
 */
const E = require("./estadisticas.js");

let fallos = 0;
function assert(cond, msg) {
  if (!cond) { fallos++; console.error("FALLÓ:", msg); }
}
const cerca = (a, b, e = 1e-9) => Math.abs(a - b) < e;

// --- posición y dispersión ---
assert(cerca(E.media([1, 2, 3, 4]), 2.5), "media de [1,2,3,4] = 2.5");
assert(cerca(E.mediana([1, 2, 3, 4]), 2.5), "mediana par = promedio de los dos centrales");
assert(cerca(E.mediana([5, 1, 3]), 3), "mediana impar, sin depender del orden de entrada");
assert(cerca(E.varianza([1, 2, 3, 4]), 5 / 3), "varianza MUESTRAL (n-1) de [1,2,3,4] = 5/3");
assert(Number.isNaN(E.varianza([7])), "varianza con un solo dato no está definida");
assert(Number.isNaN(E.media([])), "media de lista vacía = NaN, no 0");

// --- d de Cohen ---
assert(cerca(E.cohenD([1, 2, 3], [3, 4, 5]), -2), "d de [1,2,3] vs [3,4,5] = -2 (medias 2 y 4, sd combinada 1)");
assert(cerca(E.cohenD([3, 4, 5], [1, 2, 3]), 2), "el signo se invierte al intercambiar los grupos");
assert(cerca(E.cohenD([1, 2, 3], [1, 2, 3]), 0), "grupos idénticos -> d = 0");
assert(E.cohenD([1], [1, 2, 3]) === null, "un grupo con 1 dato -> null (no NaN)");
assert(E.cohenD([2, 2, 2], [2, 2, 2]) === null, "dispersión nula -> null (evita dividir por cero)");

// --- niveles de efecto (convención de Cohen) ---
assert(E.nivelEfecto(0.1) === 0 && E.nivelEfecto(-0.19) === 0, "|d|<0.2 -> despreciable");
assert(E.nivelEfecto(0.2) === 1 && E.nivelEfecto(-0.49) === 1, "0.2<=|d|<0.5 -> pequeño");
assert(E.nivelEfecto(0.5) === 2 && E.nivelEfecto(0.79) === 2, "0.5<=|d|<0.8 -> medio");
assert(E.nivelEfecto(0.8) === 3 && E.nivelEfecto(-2) === 3, "|d|>=0.8 -> grande");
assert(E.nivelEfecto(null) === -1 && E.etiquetaEfecto(null) === "sin dato", "null -> sin dato");
assert(E.etiquetaEfecto(0.45) === "diferencia pequeña", "d=0.45 es pequeño según Cohen, no medio");

// --- histograma en proporción ---
{
  const h = E.histograma([0, 0.5, 1], [0, 1], 2);
  assert(h.length === 2, "2 casilleros");
  assert(h[0].n === 1 && h[1].n === 2, "0 -> casillero 0; 0.5 y 1 -> casillero 1 (el máximo entra en el último)");
  assert(cerca(h[0].p + h[1].p, 1), "las proporciones suman 1 si todo cae en el dominio");
  assert(cerca(h[0].x0, 0) && cerca(h[1].x1, 1), "los bordes cubren exactamente el dominio");
}
{
  const h = E.histograma([0.5, 5, -3], [0, 1], 2);
  assert(cerca(h.reduce((s, b) => s + b.p, 0), 1 / 3), "valores fuera del dominio no se cuentan pero sí entran al total");
}
{
  const h = E.histograma([], [0, 1], 4);
  assert(h.every((b) => b.n === 0 && b.p === 0), "lista vacía: todo 0, sin NaN");
}
{
  const h = E.histograma([2, 2, 2], [2, 2], 3);
  assert(h.reduce((s, b) => s + b.n, 0) === 3, "dominio de ancho cero no pierde datos ni revienta");
}

// --- comparabilidad entre grupos de tamaño distinto ---
{
  const g = E.histograma([0.1, 0.1, 0.9, 0.9], [0, 1], 2);
  const c = E.histograma([0.9], [0, 1], 2);
  assert(cerca(g[1].p, 0.5) && cerca(c[1].p, 1), "tamaños distintos, misma unidad: proporciones comparables");
}

// --- distancia de variación total ---
assert(cerca(E.distanciaTV([0.5, 0.5], [0.5, 0.5]), 0), "distribuciones iguales -> 0");
assert(cerca(E.distanciaTV([1, 0], [0, 1]), 1), "distribuciones disjuntas -> 1");
assert(cerca(E.distanciaTV([0.5, 0.5], [1, 0]), 0.5), "caso intermedio -> 0.5");

// --- niveles de la distancia de variación total (umbrales orientativos) ---
assert(E.nivelTV(0.05) === 0 && E.nivelTV(0.1) === 1, "0.1 es el límite entre casi igual y algo distinta");
assert(E.nivelTV(0.24) === 1 && E.nivelTV(0.25) === 2, "0.25 es el límite siguiente");
assert(E.nivelTV(0.49) === 2 && E.nivelTV(0.5) === 3 && E.nivelTV(1) === 3, "0.5 o más -> muy distinta");
assert(E.nivelTV(null) === -1 && E.etiquetaTV(NaN) === "sin dato", "null/NaN -> sin dato");
assert(E.etiquetaTV(0.3) === "distribución bastante distinta", "etiqueta de nivel 2");

// --- valor dominante ---
{
  const d = E.dominante(["horse", "horse", "deer"]);
  assert(d.valor === "horse" && d.n === 2 && cerca(d.p, 2 / 3), "dominante = horse, 2 de 3");
  assert(E.dominante([]) === null, "lista vacía -> null");
  assert(E.dominante(["a", "b"]).valor === "a", "con empate gana el primero que apareció");
}

// --- formato ---
assert(E.fmt(NaN) === "—" && E.fmt(null) === "—", "NaN/null se muestran como —");
assert(E.fmt(0.12345, 2) === "0.12", "fmt respeta los decimales");
assert(E.fmtSigno(0.451) === "+0.45" && E.fmtSigno(-0.321) === "−0.32", "signo explícito, con − tipográfico");
assert(E.fmtSigno(null) === "—", "fmtSigno(null) = —");

if (fallos === 0) { console.log("OK: todas las pruebas de estadisticas.js pasaron"); process.exit(0); }
console.error(`${fallos} prueba(s) fallaron`); process.exit(1);
