/**
 * Pruebas en aislamiento de layout.js  sin D3, sin DOM, sin navegador.
 * Ejecutar con: node web/js/layout.test.js
 */
const Layout = require("./layout.js");

function hoja(n, extra) {
  return Object.assign({ n, hoja: true }, extra || {});
}
function interno(izq, der) {
  return { n: izq.n + der.n, hoja: false, izq, der };
}

let fallos = 0;
function assert(cond, msg) {
  if (!cond) {
    fallos++;
    console.error("FALLÓ:", msg);
  }
}
function cerca(a, b, eps = 1e-6) {
  return Math.abs(a - b) < eps;
}

// --- particionar: proporción correcta y sin huecos ni solapes ---
{
  const a = hoja(6), b = hoja(4);
  const rect = { x: 0, y: 0, w: 100, h: 90 }; // horizontal -> dice
  const { izq, der } = Layout.particionar(rect, a, b);
  assert(cerca(izq.w, 60), "partición horizontal: 60% para el hijo con 6/10");
  assert(cerca(der.w, 40), "partición horizontal: 40% para el hijo con 4/10");
  assert(cerca(izq.h, 90) && cerca(der.h, 90), "la altura no cambia al dicer");
  assert(cerca(izq.x, 0) && cerca(der.x, izq.w), "no debe haber huecos ni solapes en x");
}

// --- particionar vertical (slice) cuando el rectángulo es más alto que ancho ---
{
  const a = hoja(3), b = hoja(1);
  const rect = { x: 0, y: 0, w: 50, h: 100 };
  const { izq, der } = Layout.particionar(rect, a, b);
  assert(cerca(izq.h, 75), "partición vertical: 75% para 3/4");
  assert(cerca(der.h, 25), "partición vertical: 25% para 1/4");
  assert(cerca(izq.w, 50) && cerca(der.w, 50), "el ancho no cambia al slice");
}

// --- conPadding nunca da tamaño negativo ---
{
  const r = Layout.conPadding({ x: 0, y: 0, w: 5, h: 5 }, 10);
  assert(r.w === 0 && r.h === 0, "conPadding no debe dar tamaños negativos");
}

// --- nodosVisiblesParaK: k=1 devuelve solo la raíz ---
{
  const arbol = interno(hoja(6), hoja(4));
  const vis = Layout.nodosVisiblesParaK(arbol, 1);
  assert(vis.length === 1 && vis[0] === arbol, "k=1 debe devolver solo la raíz");
}

// --- nodosVisiblesParaK: expande siempre el nodo más grande primero ---
{
  // árbol: raíz(10) = A(7) + B(3); A = A1(5)+A2(2)
  const a1 = hoja(5), a2 = hoja(2);
  const A = interno(a1, a2);
  const B = hoja(3);
  const raiz = interno(A, B);

  const vis2 = Layout.nodosVisiblesParaK(raiz, 2);
  assert(vis2.length === 2 && vis2.includes(A) && vis2.includes(B),
    "k=2 debe abrir la raíz una vez: {A, B}");

  const vis3 = Layout.nodosVisiblesParaK(raiz, 3);
  assert(vis3.length === 3 && vis3.includes(a1) && vis3.includes(a2) && vis3.includes(B),
    "k=3 debe expandir A (el más grande) en vez de B: {A1, A2, B}");
}

// --- nodosVisiblesParaK: pedir más k que hojas disponibles no revienta ---
{
  const arbol = interno(hoja(1), hoja(1));
  const vis = Layout.nodosVisiblesParaK(arbol, 50);
  assert(vis.length === 2, "no debe generar más nodos que hojas existentes");
}

// --- calcularLayout: cobertura razonable (el padding reduce el área a propósito,
// así se revela la jerarquía detrás; no debe ser exactamente igual al total) ---
{
  const a1 = hoja(5), a2 = hoja(2), B = hoja(3);
  const A = interno(a1, a2);
  const raiz = interno(A, B);
  const rect = { x: 0, y: 0, w: 200, h: 100 };

  const resultado = Layout.calcularLayout(raiz, rect, 3);
  assert(resultado.length === 3, "calcularLayout con k=3 debe devolver 3 nodos");
  const areaTotal = resultado.reduce((s, r) => s + Math.max(0, r.rect.w) * Math.max(0, r.rect.h), 0);
  const areaRect = rect.w * rect.h;
  assert(areaTotal <= areaRect + 1e-6, "el área cubierta no puede superar al rectángulo (con padding)");
  assert(areaTotal > 0.5 * areaRect,
    "pérdida de área por padding fuera de rango: A se divide en 2 niveles " +
    "(padding compuesto) y B en 1, así que <50% de pérdida total es razonable " +
    "pero una caída mayor indicaría padding aplicado de más en algún nivel");

  // ningún par de rectángulos de nodos distintos debe solaparse
  function solapan(r1, r2) {
    return r1.x < r2.x + r2.w && r1.x + r1.w > r2.x && r1.y < r2.y + r2.h && r1.y + r1.h > r2.y;
  }
  for (let i = 0; i < resultado.length; i++) {
    for (let j = i + 1; j < resultado.length; j++) {
      assert(!solapan(resultado[i].rect, resultado[j].rect), `los nodos ${i} y ${j} no deben solaparse`);
    }
  }
}

// --- muestrearImagenes: si caben todas, no recorta ---
{
  const ids = [1, 2, 3, 4];
  const m = Layout.muestrearImagenes(ids, { w: 100, h: 100 }, 20); // 5x5=25 caben
  assert(m.length === 4, "si caben todas las imágenes, no debe recortar");
}

// --- muestrearImagenes: si no caben, respeta el período y el máximo ---
{
  const ids = Array.from({ length: 150 }, (_, i) => i);
  const m = Layout.muestrearImagenes(ids, { w: 30, h: 30 }, 30); // 1x1 = 1 cabe
  assert(m.length === 1, "con espacio para 1 miniatura, debe devolver exactamente 1");

  const m2 = Layout.muestrearImagenes(ids, { w: 150, h: 30 }, 30); // 5x1=5 caben, periodo=30
  assert(m2.length === 5, "con espacio para 5, debe devolver exactamente 5");
  assert(m2[0] === 0 && m2[1] === 30, "debe samplear con el período calculado (150/5=30)");
}

if (fallos === 0) {
  console.log("OK: todas las pruebas de layout.js pasaron (" + "11 grupos" + ")");
  process.exit(0);
} else {
  console.error(`${fallos} prueba(s) fallaron`);
  process.exit(1);
}
