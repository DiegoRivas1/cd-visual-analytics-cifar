/**
 * layout.js  algoritmo de treemap jerárquico adaptado de DendroMap
 * (Bertucci et al., 2023, Sección 4.2 "DendroMap Visualization").
 *
 * Sin dependencias de D3 ni del DOM: toma un nodo de árbol binario
 * { n: <num_imagenes>, izq: nodo|null, der: nodo|null, hoja: bool, ... }
 * y un rectángulo disponible, y devuelve las coordenadas de cada nodo
 * visible. Se prueba en aislamiento con `node layout.test.js` antes de
 * usarse desde treemap.js.
 *
 * Funciona tanto en Node (module.exports) como en el navegador (window.Layout).
 */
(function (global) {
  "use strict";

  const PADDING = 10; // px, igual que el paper (Sección 4.2, paso 4)

  /**
   * Reparte un rectángulo {x, y, w, h} entre los dos hijos de un nodo,
   * siguiendo el algoritmo slice-dice modificado del paper:
   *   1. Dice si el rectángulo es horizontal (w > h), slice si es vertical.
   *   2. La proporción de la partición es n_hijo / n_total.
   *   3. Se añade padding para revelar la jerarquía detrás.
   *
   * No hace ajuste "fit to image size" (paso 3 del paper) porque ese ajuste
   * depende del tamaño de miniatura elegido en la UI; se aplica después,
   * en treemap.js, sobre el rectángulo ya calculado aquí.
   */
  function particionar(rect, nodoIzq, nodoDer) {
    const nTotal = nodoIzq.n + nodoDer.n;
    const ratio = nodoIzq.n / nTotal;
    const horizontal = rect.w >= rect.h; // "dice" si es horizontal

    if (horizontal) {
      const wIzq = rect.w * ratio;
      return {
        izq: { x: rect.x, y: rect.y, w: wIzq, h: rect.h },
        der: { x: rect.x + wIzq, y: rect.y, w: rect.w - wIzq, h: rect.h },
      };
    } else {
      const hIzq = rect.h * ratio;
      return {
        izq: { x: rect.x, y: rect.y, w: rect.w, h: hIzq },
        der: { x: rect.x, y: rect.y + hIzq, w: rect.w, h: rect.h - hIzq },
      };
    }
  }

  /** Resta el padding de un rectángulo, sin dejarlo con tamaño negativo. */
  function conPadding(rect, pad) {
    const w = Math.max(0, rect.w - 2 * pad);
    const h = Math.max(0, rect.h - 2 * pad);
    return { x: rect.x + pad, y: rect.y + pad, w, h };
  }

  /**
   * Recorre el árbol en anchura (breadth-first) y detiene el recorrido
   * apenas se han "abierto" k nodos — exactamente el criterio del paper
   * (Sección 4.2, "Adjusting the number of clusters") para decidir cuántos
   * clusters mostrar cuando el usuario mueve el slider de k.
   *
   * Devuelve la lista de nodos "frontera": los que se deben dibujar como
   * hojas visuales del treemap (aunque internamente tengan hijos).
   */
  function nodosVisiblesParaK(raiz, k) {
    if (k <= 1 || raiz.hoja) return [raiz];
    let frontera = [raiz];
    while (frontera.length < k) {
      // Expande el nodo más grande que todavía tenga hijos (igual que el
      // recorrido breadth-first del paper, que expande por orden de creación
      // del dendrograma; usamos tamaño como criterio estable y determinista).
      let idx = -1;
      let mejorN = -1;
      for (let i = 0; i < frontera.length; i++) {
        const nd = frontera[i];
        if (!nd.hoja && nd.n > mejorN) {
          mejorN = nd.n;
          idx = i;
        }
      }
      if (idx === -1) break; // ya no hay nada más que expandir
      const nd = frontera[idx];
      frontera.splice(idx, 1, nd.izq, nd.der);
    }
    return frontera;
  }

  /**
   * Calcula recursivamente el layout completo para los nodos visibles con
   * un k dado, dentro de un rectángulo. Devuelve un arreglo plano de
   * { nodo, rect } — uno por cada nodo de `nodosVisiblesParaK`.
   */
  function calcularLayout(raiz, rectDisponible, k) {
    const objetivo = new Set(nodosVisiblesParaK(raiz, k));
    const resultado = [];

    function recorrer(nodo, rect) {
      if (objetivo.has(nodo) || nodo.hoja) {
        resultado.push({ nodo, rect: conPadding(rect, 0) });
        return;
      }
      const partes = particionar(rect, nodo.izq, nodo.der);
      recorrer(nodo.izq, conPadding(partes.izq, PADDING / 2));
      recorrer(nodo.der, conPadding(partes.der, PADDING / 2));
    }

    recorrer(raiz, rectDisponible);
    return resultado;
  }

  /**
   * Dado un rectángulo y el tamaño de una miniatura, calcula cuántas
   * miniaturas entran por fila/columna y con qué período debe samplearse
   * la lista de imágenes del cluster para no exceder ese cupo — réplica
   * directa de la fórmula del paper (Sección 4.2, "Organizing images
   * within the clusters"): periodo = floor(total / maxVisible).
   */
  function muestrearImagenes(idsImagen, rect, ladoMiniatura) {
    const cols = Math.max(1, Math.floor(rect.w / ladoMiniatura));
    const filas = Math.max(1, Math.floor(rect.h / ladoMiniatura));
    const maxVisible = cols * filas;
    const total = idsImagen.length;
    if (total <= maxVisible) return idsImagen.slice();

    const periodo = Math.max(1, Math.floor(total / maxVisible));
    const muestra = [];
    for (let i = 0; i < total && muestra.length < maxVisible; i += periodo) {
      muestra.push(idsImagen[i]);
    }
    return muestra;
  }

  const Layout = { particionar, conPadding, nodosVisiblesParaK, calcularLayout, muestrearImagenes, PADDING };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = Layout;
  } else {
    global.Layout = Layout;
  }
})(typeof window !== "undefined" ? window : globalThis);
