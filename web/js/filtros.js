/**
 * filtros.js  sliders de rango por característica visual. Al mover un
 * filtro se actualiza el estado compartido; el treemap y el panel de
 * características reaccionan (vía enlace.js) atenuando las imágenes que
 * quedan fuera del rango.
 */
(function (global) {
  "use strict";

  const VARS = [
    "brillo", "contraste", "saturacion", "entropia",
    "densidad_bordes", "unif_fondo", "energia_central",
  ];

  function crearFiltros({ contenedorSel, registros, estado }) {
    const contenedor = d3.select(contenedorSel);

    const rangosGlobales = {};
    for (const v of VARS) {
      rangosGlobales[v] = d3.extent(registros, (r) => r[v]);
    }

    const filtrosIniciales = {};
    for (const v of VARS) filtrosIniciales[v] = rangosGlobales[v];
    estado.actualizar({ filtros: filtrosIniciales });

    const grupos = contenedor.selectAll("div.filtro")
      .data(VARS).enter().append("div").attr("class", "filtro");

    grupos.append("label").text((v) => v);

    const sliders = {}; // v -> { min: selection, max: selection }

    grupos.each(function (v) {
      const [min, max] = rangosGlobales[v];
      const grupo = d3.select(this);
      const valorTexto = grupo.append("span").attr("class", "valor-filtro");

      function actualizarTexto(lo, hi) {
        valorTexto.text(`${lo.toFixed(2)} – ${hi.toFixed(2)}`);
      }
      actualizarTexto(min, max);

      const paso = (max - min) / 100 || 0.01;
      const sliderMin = grupo.append("input")
        .attr("type", "range").attr("min", min).attr("max", max)
        .attr("step", paso).property("value", min);
      const sliderMax = grupo.append("input")
        .attr("type", "range").attr("min", min).attr("max", max)
        .attr("step", paso).property("value", max);

      sliders[v] = { min: sliderMin, max: sliderMax };

      function emitir() {
        let lo = parseFloat(sliderMin.property("value"));
        let hi = parseFloat(sliderMax.property("value"));
        if (lo > hi) [lo, hi] = [hi, lo];
        actualizarTexto(lo, hi);
        const filtros = Object.assign({}, estado.obtener().filtros, { [v]: [lo, hi] });
        estado.actualizar({ filtros });
      }

      sliderMin.on("input", emitir);
      sliderMax.on("input", emitir);
    });

    contenedor.append("button")
      .attr("class", "boton-reset")
      .text("Restablecer filtros")
      .on("click", () => {
        for (const v of VARS) {
          const [min, max] = rangosGlobales[v];
          sliders[v].min.property("value", min);
          sliders[v].max.property("value", max);
          sliders[v].min.dispatch("input");
        }
      });

    return { rangosGlobales };
  }

  /** Devuelve true si un registro cae dentro de todos los filtros activos. */
  function pasaFiltros(registro, filtros) {
    for (const v of VARS) {
      const rango = filtros[v];
      if (!rango) continue;
      const x = registro[v];
      if (x == null || x < rango[0] || x > rango[1]) return false;
    }
    return true;
  }

  global.crearFiltros = crearFiltros;
  global.pasaFiltros = pasaFiltros;
})(typeof window !== "undefined" ? window : globalThis);