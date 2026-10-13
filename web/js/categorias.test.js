/**
 * Pruebas en aislamiento de categorias.js — sin D3, sin navegador.
 * Ejecutar con: node web/js/categorias.test.js
 */
const C = require("./categorias.js");

let fallos = 0;
function assert(cond, msg) {
  if (!cond) { fallos++; console.error("FALLÓ:", msg); }
}
const cerca = (a, b, e = 1e-9) => Math.abs(a - b) < e;

// --- conteo y proporciones básicos ---
{
  const r = C.proporcionesPorCategoria([0, 0, 1, 3], [0, 1, 2, 3]);
  assert(r.length === 4, "debe devolver una entrada por categoría pedida");
  assert(r[0].n === 2 && cerca(r[0].p, 0.5), "categoría 0: 2 de 4 = 0.5");
  assert(r[1].n === 1 && cerca(r[1].p, 0.25), "categoría 1: 1 de 4 = 0.25");
  assert(r[2].n === 0 && r[2].p === 0, "categoría vacía debe dar n=0, p=0 (no omitirse)");
  assert(cerca(r.reduce((s, x) => s + x.p, 0), 1), "si todos los valores caen en alguna categoría, p suma 1");
}

// --- el orden de salida sigue el orden de `categorias`, no el de aparición ---
{
  const r = C.proporcionesPorCategoria([5, 5, 2], [5, 2]);
  assert(r[0].categoria === 5 && r[1].categoria === 2, "orden de salida = orden de categorias");
}

// --- lista vacía no divide por cero ---
{
  const r = C.proporcionesPorCategoria([], [0, 1]);
  assert(r.every((x) => x.n === 0 && x.p === 0), "sin valores: todo en 0, sin NaN");
}

// --- valores fuera de las categorías no se absorben en silencio ---
{
  const r = C.proporcionesPorCategoria([0, 99, 99, 1], [0, 1]);
  const suma = r.reduce((s, x) => s + x.p, 0);
  assert(cerca(suma, 0.5), "valores inesperados quedan fuera del conteo pero dentro del total (suma 0.5)");
}

// --- tono_dominante: acromática (-1) se cuenta como categoría propia ---
{
  const r = C.proporcionesPorCategoria([-1, -1, 4, 11], C.CATEGORIAS_TONO);
  assert(r.length === 13, "tono_dominante tiene 13 categorías: -1 más 0..11");
  assert(r[0].categoria === -1 && r[0].n === 2, "-1 debe contarse en la primera categoría");
  assert(r.find((x) => x.categoria === 11).n === 1, "el sector 11 existe y se cuenta");
}

// --- comparabilidad: cluster y dataset en la misma escala (ambos proporciones) ---
{
  const global = [0, 0, 0, 0, 1, 1, 1, 1];     // 50% / 50%
  const cluster = [1, 1];                       // 100% en la categoría 1
  const pg = C.proporcionesPorCategoria(global, [0, 1]);
  const pc = C.proporcionesPorCategoria(cluster, [0, 1]);
  assert(cerca(pg[1].p, 0.5) && cerca(pc[1].p, 1), "tamaños distintos, mismas unidades: proporciones comparables");
}

// --- colores y etiquetas ---
{
  assert(C.colorTono(-1) === "hsl(0, 0%, 55%)", "acromática = gris");
  assert(C.colorTono(0) === "hsl(15, 70%, 50%)", "sector 0 = matiz central 15°");
  assert(C.colorTono(11) === "hsl(345, 70%, 50%)", "sector 11 = matiz central 345°");
  assert(C.etiquetaTono(-1) === "ac." && C.etiquetaTono(7) === "7", "etiquetas del eje");
}

if (fallos === 0) { console.log("OK: todas las pruebas de categorias.js pasaron"); process.exit(0); }
console.error(`${fallos} prueba(s) fallaron`); process.exit(1);
