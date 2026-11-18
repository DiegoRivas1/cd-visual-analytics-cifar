/**
 * enlace.js  estado compartido de la aplicación y mecanismo de
 * "brushing and linking": cualquier módulo puede cambiar el estado
 * (seleccionar un cluster, mover un filtro) y todos los demás módulos
 * suscritos se enteran y se redibujan.
 */
(function (global) {
  "use strict";

  function crearEstado() {
    const estado = {
      k: 8, // nivel de clusters visibles en el treemap
      ladoMiniatura: 32,
      clusterSeleccionado: null, // nodo del árbol actualmente enfocado (zoom)
      filtros: {}, // { nombreVariable: [min, max] }
      previa: null, // vista previa momentánea (mouse sobre una barra de histograma), misma forma que una selección
      selecciones: [], // barras fijadas con clic (hasta 4, cada una con su color): { slot, variable, nombre, lo, hi, ultimo } o { slot, variable, categoria, nombre }
    };
    const suscriptores = [];

    function suscribir(fn) {
      suscriptores.push(fn);
    }

    function actualizar(cambios) {
      Object.assign(estado, cambios);
      for (const fn of suscriptores) fn(estado);
    }

    function obtener() {
      return estado;
    }

    return { suscribir, actualizar, obtener };
  }

  global.Enlace = { crearEstado };
})(typeof window !== "undefined" ? window : globalThis);