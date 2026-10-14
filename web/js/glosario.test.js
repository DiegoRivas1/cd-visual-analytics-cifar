/**
 * Pruebas del glosario. Ejecutar con: node web/js/glosario.test.js
 * Incluye una comprobación cruzada con src/features.py: el glosario debe
 * describir exactamente las características que Python calcula.
 */
const fs = require("fs");
const path = require("path");
const { GLOSARIO, NOMBRES_SECTOR } = require("./glosario.js");

let fallos = 0;
function assert(cond, msg) { if (!cond) { fallos++; console.error("FALLÓ:", msg); } }

// --- cobertura cruzada con Python ---
const py = fs.readFileSync(path.join(__dirname, "..", "..", "src", "features.py"), "utf8");
const bloque = py.slice(py.indexOf("CARACTERISTICAS = {"));
const enPython = [...bloque.slice(0, bloque.indexOf("}")).matchAll(/"([a-z_]+)":/g)].map((m) => m[1]);
assert(enPython.length === 8, `features.py debería definir 8 características y encontré ${enPython.length}`);
for (const v of enPython) assert(v in GLOSARIO, `falta la entrada del glosario para "${v}" (definida en features.py)`);
for (const v of Object.keys(GLOSARIO)) assert(enPython.includes(v), `el glosario tiene "${v}", que features.py no calcula`);

// --- campos obligatorios ---
const obligatorios = ["nombre", "corto", "rango", "queMide", "comoSeCalcula"];
for (const [v, g] of Object.entries(GLOSARIO)) {
  for (const c of obligatorios) assert(typeof g[c] === "string" && g[c].trim().length > 0, `${v}: falta "${c}"`);
  if (v !== "tono_dominante") {
    assert(g.alto && g.bajo, `${v}: una característica continua necesita "alto" y "bajo" para la frase dinámica`);
  }
}

// --- sectores de tono: -1 y 0..11 ---
for (const k of [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
  assert(typeof NOMBRES_SECTOR[k] === "string", `falta el nombre del sector ${k}`);
}

if (fallos === 0) { console.log("OK: todas las pruebas del glosario pasaron (8 características)"); process.exit(0); }
console.error(`${fallos} prueba(s) fallaron`); process.exit(1);
