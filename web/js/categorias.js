/**
 * categorias.js — lógica pura (sin D3, sin DOM) para comparar una variable
 * categórica entre un cluster y el dataset completo. Se usa para
 * `tono_dominante`: 12 sectores de matiz (0..11) más -1 = acromática.
 *
 * A diferencia de los histogramas continuos (d3.bin), aquí se cuenta por
 * categoría y se normaliza a PROPORCIÓN. Por eso las barras del cluster y las
 * del dataset sí son comparables entre sí en una misma escala vertical.
 *
 * Se prueba en aislamiento: node web/js/categorias.test.js
 */
(function (global) {
  "use strict";

  /** Categorías de tono_dominante, en orden de visualización: acromática y 12 sectores. */
  const CATEGORIAS_TONO = [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  /**
   * Devuelve, por cada categoría dada, { categoria, n, p }:
   * n = cuántos valores caen en ella, p = n / total (0 si no hay valores).
   * Los valores fuera de `categorias` se ignoran del conteo pero NO del
   * total, para que las proporciones sumen <= 1 y un valor inesperado
   * quede a la vista en vez de absorberse en silencio.
   */
  function proporcionesPorCategoria(valores, categorias) {
    const total = valores.length;
    const conteo = new Map(categorias.map((c) => [c, 0]));
    for (const v of valores) {
      if (conteo.has(v)) conteo.set(v, conteo.get(v) + 1);
    }
    return categorias.map((c) => ({
      categoria: c,
      n: conteo.get(c),
      p: total > 0 ? conteo.get(c) / total : 0,
    }));
  }

  /**
   * Color CSS de una categoría de tono: el sector s cubre [30*s, 30*s+30)
   * grados de matiz, así que se pinta con el matiz central. -1 (acromática)
   * se pinta gris neutro.
   */
  function colorTono(categoria) {
    if (categoria === -1) return "hsl(0, 0%, 55%)";
    return `hsl(${categoria * 30 + 15}, 70%, 50%)`;
  }

  /** Etiqueta corta para el eje: "ac." para acromática, el número de sector si no. */
  function etiquetaTono(categoria) {
    return categoria === -1 ? "ac." : String(categoria);
  }

  const Categorias = { CATEGORIAS_TONO, proporcionesPorCategoria, colorTono, etiquetaTono };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = Categorias;
  } else {
    global.Categorias = Categorias;
  }
})(typeof window !== "undefined" ? window : globalThis);
