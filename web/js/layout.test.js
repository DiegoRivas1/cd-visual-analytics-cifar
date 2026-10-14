/**
 * Pruebas en aislamiento de layout.js — sin D3, sin DOM, sin navegador.
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


// --- rejilla: casos concretos ---
{
  const r = Layout.rejilla({ w: 100, h: 100 }, 32, 2, 10);
  assert(r.lado === 32 && r.paso === 34, "caso normal: lado 32, paso 34");
  assert(r.cols === 3 && r.filas === 3, "caben 3x3 (3*32+2*2=100 <= 100)");
  assert(r.max === 9, "max = cols * filas");
}
{
  const r = Layout.rejilla({ w: 20, h: 100 }, 32, 2, 10);
  assert(r.lado === 20 && r.cols === 1, "área más angosta que la miniatura: se achica a 20 y cabe 1 columna");
}
{
  assert(Layout.rejilla({ w: 8, h: 100 }, 32, 2, 10).max === 0, "si ni achicada llega al mínimo -> rejilla vacía");
  assert(Layout.rejilla({ w: 0, h: 50 }, 32, 2, 10).max === 0, "ancho 0 -> vacía");
  assert(Layout.rejilla({ w: -5, h: 50 }, 32, 2, 10).max === 0, "ancho negativo -> vacía, sin NaN");
}

// --- rejilla: PROPIEDAD — ninguna miniatura puede salirse del área, para cualquier tamaño ---
{
  let semilla = 12345;
  const azar = () => { semilla = (semilla * 1664525 + 1013904223) % 4294967296; return semilla / 4294967296; };
  let casos = 0;
  for (let t = 0; t < 600; t++) {
    const area = { w: azar() * 400 - 20, h: azar() * 400 - 20 };
    const lado = 16 + Math.floor(azar() * 40);
    const gap = Math.floor(azar() * 5);
    const r = Layout.rejilla(area, lado, gap, 10);
    for (let i = 0; i < r.max; i++) {
      const x = (i % r.cols) * r.paso;
      const y = Math.floor(i / r.cols) * r.paso;
      casos++;
      assert(x + r.lado <= area.w + 1e-9, `miniatura ${i} se sale por la derecha (area ${area.w.toFixed(1)}x${area.h.toFixed(1)}, lado ${lado}, gap ${gap})`);
      assert(y + r.lado <= area.h + 1e-9, `miniatura ${i} se sale por abajo (area ${area.w.toFixed(1)}x${area.h.toFixed(1)}, lado ${lado}, gap ${gap})`);
    }
  }
  assert(casos > 1000, "la prueba de propiedad debe haber evaluado muchas miniaturas, evaluó " + casos);
}

// --- muestrearHasta ---
{
  assert(Layout.muestrearHasta([1, 2, 3], 5).length === 3, "si caben todas, no recorta");
  assert(Layout.muestrearHasta([1, 2, 3], 0).length === 0, "cupo 0 -> vacío");
  const ids = Array.from({ length: 100 }, (_, i) => i);
  const m = Layout.muestrearHasta(ids, 10);
  assert(m.length === 10 && m[0] === 0 && m[1] === 10, "período 100/10 = 10, empezando en 0");
  assert(m[m.length - 1] >= 80, "la muestra cubre todo el cluster, no solo el comienzo");
}

// --- elegirEtiqueta ---
{
  const comp = [{ t: "68 imágenes", c: null }, { t: " · bird 79 %", c: "dominante" }, { t: " MIXTO", c: "tag" }];
  const med = [{ t: "68", c: null }, { t: " · bird 79%", c: "dominante" }];
  const corta = [{ t: "68", c: null }];
  const V = [comp, med, corta];
  const px = 7; // comp = 30 car, med = 13, corta = 2
  assert(Layout.elegirEtiqueta(V, 300, px) === comp, "ancho de sobra -> la completa");
  assert(Layout.elegirEtiqueta(V, 100, px) === med, "ancho medio -> la intermedia");
  assert(Layout.elegirEtiqueta(V, 20, px) === corta, "ancho justo -> la corta");
  assert(Layout.elegirEtiqueta(V, 10, px).length === 0, "no cabe ni la corta -> sin etiqueta, nunca desborda");
  assert(Layout.elegirEtiqueta(V, 14, px) === corta, "límite: 2 car * 7 = 14 cabe exacto");
  // la separación dx de un segmento también cuenta: 2 car + 14px/7 = 4 car = 28px
  const conDx = [[{ t: "ab", c: null }, { t: "cd", c: "x", dx: 14 }]];
  assert(Layout.elegirEtiqueta(conDx, 40, px).length === 0, "con dx: 6 car * 7 = 42 px no caben en 40");
  assert(Layout.elegirEtiqueta(conDx, 42, px) === conDx[0], "con dx: 42 px caben exacto en 42");
}

if (fallos === 0) {
  console.log("OK: todas las pruebas de layout.js pasaron");
  process.exit(0);
} else {
  console.error(`${fallos} prueba(s) fallaron`);
  process.exit(1);
}