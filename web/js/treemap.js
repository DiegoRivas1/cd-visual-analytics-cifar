/**
 * treemap.js — vista principal: treemap jerárquico zoomable, adaptado de
 * DendroMap (Bertucci et al., 2023). Usa layout.js (ya probado en
 * aislamiento) para la geometría; este módulo solo se ocupa de dibujar con
 * D3 y de manejar las interacciones (zoom, slider de k, hover).
 */
(function (global) {
  "use strict";

  function crearTreemap({ contenedorSel, arbol, atlasSrc, ladoAtlas, estado }) {
    const contenedor = d3.select(contenedorSel);
    const svg = contenedor.append("svg").attr("width", "100%").attr("height", "100%");
    const capa = svg.append("g");

    let nodoRaizVista = arbol; // nodo actualmente "enfocado" (tras hacer zoom)

    function dimensiones() {
      const el = contenedor.node();
      return { w: el.clientWidth, h: el.clientHeight };
    }

    function hojasDe(nodo) {
      if (nodo.hoja) return [nodo];
      return hojasDe(nodo.izq).concat(hojasDe(nodo.der));
    }

    function dibujar() {
      const { w, h } = dimensiones();
      svg.attr("viewBox", `0 0 ${w} ${h}`);
      const k = estado.obtener().k;
      const lado = estado.obtener().ladoMiniatura;

      const nodos = Layout.calcularLayout(nodoRaizVista, { x: 0, y: 0, w, h }, k);

      const grupos = capa.selectAll("g.cluster").data(nodos, (d) => d.nodo.id);

      grupos.exit().remove();

      const entrando = grupos.enter().append("g").attr("class", "cluster");
      entrando.append("rect").attr("class", "fondo-cluster");
      entrando.append("text").attr("class", "etiqueta-cluster");
      entrando.append("g").attr("class", "miniaturas");

      const todos = entrando.merge(grupos);

      todos
        .transition().duration(400)
        .attr("transform", (d) => `translate(${d.rect.x},${d.rect.y})`);

      todos.select("rect.fondo-cluster")
        .transition().duration(400)
        .attr("width", (d) => Math.max(0, d.rect.w))
        .attr("height", (d) => Math.max(0, d.rect.h));

      todos.select("text.etiqueta-cluster").attr("x", 6).attr("y", 14);

      // miniaturas: sampleadas con el mismo criterio probado en layout.test.js.
      // Se recorta el sprite con un <div> dentro de <foreignObject>, usando
      // background-position — el equivalente SVG de un recorte CSS simple,
      // más confiable que manipular <clipPath> a mano.
      todos.each(function (d) {
        const grupoMin = d3.select(this).select("g.miniaturas");
        const hojasVisibles = hojasDe(d.nodo);
        const idsOrdenados = hojasVisibles.map((h) => h.img_id);
        const muestra = Layout.muestrearImagenes(idsOrdenados, d.rect, lado);
        const mapaPorId = new Map(hojasVisibles.map((h) => [h.img_id, h]));
        const cols = Math.max(1, Math.floor(d.rect.w / lado));

        // etiqueta: tamaño, clase dominante y su pureza; "mixto" si es baja
        // (mismo umbral 0.6 que se usó para definir clusters mixtos en el EDA)
        const dom = hojasVisibles.length > 1
          ? Estadisticas.dominante(hojasVisibles.map((h) => h.clase)) : null;
        const grupo = d3.select(this);
        const etiqueta = grupo.select("text.etiqueta-cluster");
        etiqueta.text(null);
        etiqueta.append("tspan").text(d.nodo.n === 1 ? "1 imagen" : `${d.nodo.n} imágenes`);
        let resumen = d.nodo.n === 1 ? "Imagen individual." : `Cluster de ${d.nodo.n} imágenes.`;
        if (dom) {
          etiqueta.append("tspan").attr("class", "dominante")
            .text(` · ${dom.valor} ${Math.round(dom.p * 100)} %`);
          resumen += ` Clase dominante: ${dom.valor} (${Math.round(dom.p * 100)} %).`;
          if (dom.p < 0.6) {
            etiqueta.append("tspan").attr("class", "tag-mixto-svg").attr("dx", 7).text("MIXTO");
            resumen += " Cluster mixto (menos del 60 % de una sola clase).";
          }
        }
        if (!d.nodo.hoja) resumen += " Clic para acercarte.";
        const titulo = grupo.selectAll("title").data([resumen]);
        titulo.enter().insert("title", ":first-child").merge(titulo).text((t) => t);

        const sel = grupoMin.selectAll("foreignObject").data(muestra, (id) => id);
        sel.exit().remove();
        const ent = sel.enter().append("foreignObject")
          .attr("width", lado).attr("height", lado);
        ent.append("xhtml:div").attr("class", "miniatura");

        ent.merge(sel)
          .attr("x", (_, i) => 18 + (i % cols) * lado)
          .attr("y", (_, i) => 18 + Math.floor(i / cols) * lado)
          .select("div.miniatura")
          .style("width", lado + "px")
          .style("height", lado + "px")
          .style("background-image", `url(${atlasSrc})`)
          .style("background-size", `${ladoAtlas}px ${ladoAtlas}px`)
          .style("background-position", (id) => {
            const hoja = mapaPorId.get(id);
            if (!hoja || !hoja.sprite) return "0 0";
            return `-${hoja.sprite.x_px}px -${hoja.sprite.y_px}px`;
          })
          .style("opacity", (id) => {
            const hoja = mapaPorId.get(id);
            const filtros = estado.obtener().filtros;
            if (!hoja || !filtros || typeof pasaFiltros !== "function") return 1;
            return pasaFiltros(hoja, filtros) ? 1 : 0.12;
          });
      });

      todos
        .style("cursor", (d) => (d.nodo.hoja ? "default" : "pointer"))
        .on("click", (_ev, d) => {
          if (d.nodo.hoja) return;
          nodoRaizVista = d.nodo;
          estado.actualizar({ clusterSeleccionado: d.nodo });
        })
        .on("mouseenter", function () {
          d3.select(this).raise();
        });
    }

    function volverArriba() {
      nodoRaizVista = arbol;
      estado.actualizar({ clusterSeleccionado: null });
    }

    estado.suscribir(() => dibujar());
    window.addEventListener("resize", dibujar);
    dibujar();

    return { dibujar, volverArriba };
  }

  global.crearTreemap = crearTreemap;
})(typeof window !== "undefined" ? window : globalThis);
