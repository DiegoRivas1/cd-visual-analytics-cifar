/**
 * panel_caracteristicas.js — histogramas pequeños de las 8 características
 * visuales, comparando el cluster seleccionado contra la distribución
 * global. Este panel es el aporte diferencial del proyecto frente a
 * DendroMap (ver informe, Sección "Puente hacia Visual Analytics").
 *
 * Siete características continuas se dibujan como histogramas (d3.bin). La
 * octava, tono_dominante, es categórica (12 sectores + acromática) y se
 * dibuja como barras por categoría con la lógica de categorias.js.
 */
(function (global) {
  "use strict";

  const VARS = [
    "brillo", "contraste", "saturacion", "entropia",
    "densidad_bordes", "unif_fondo", "energia_central",
  ];

  function crearPanelCaracteristicas({ contenedorSel, registros, estado }) {
    const contenedor = d3.select(contenedorSel);
    const porImgId = new Map(registros.map((r) => [r.img_id, r]));

    function hojasDe(nodo) {
      if (nodo.hoja) return [nodo];
      return hojasDe(nodo.izq).concat(hojasDe(nodo.der));
    }

    function dibujarHistograma(svg, valoresGlobal, valoresCluster, titulo) {
      const w = 160, h = 90, margen = { t: 18, r: 6, b: 16, l: 6 };
      const x = d3.scaleLinear()
        .domain(d3.extent(valoresGlobal))
        .range([margen.l, w - margen.r]);

      const bins = d3.bin().domain(x.domain()).thresholds(16)(valoresGlobal);
      const y = d3.scaleLinear()
        .domain([0, d3.max(bins, (b) => b.length) || 1])
        .range([h - margen.b, margen.t]);

      svg.attr("viewBox", `0 0 ${w} ${h}`);
      svg.selectAll("*").remove();

      svg.append("text")
        .attr("x", w / 2).attr("y", 10)
        .attr("text-anchor", "middle").attr("font-size", 9).attr("fill", "#555")
        .text(titulo);

      svg.selectAll("rect.global")
        .data(bins).enter().append("rect")
        .attr("class", "global")
        .attr("x", (b) => x(b.x0) + 1)
        .attr("y", (b) => y(b.length))
        .attr("width", (b) => Math.max(0, x(b.x1) - x(b.x0) - 1))
        .attr("height", (b) => y(0) - y(b.length))
        .attr("fill", "#ccc").attr("opacity", 0.7);

      if (valoresCluster && valoresCluster.length) {
        const binsCluster = d3.bin().domain(x.domain()).thresholds(16)(valoresCluster);
        const yc = d3.scaleLinear()
          .domain([0, d3.max(binsCluster, (b) => b.length) || 1])
          .range([h - margen.b, margen.t]);
        svg.selectAll("rect.cluster")
          .data(binsCluster).enter().append("rect")
          .attr("class", "cluster")
          .attr("x", (b) => x(b.x0) + 1)
          .attr("y", (b) => yc(b.length))
          .attr("width", (b) => Math.max(0, x(b.x1) - x(b.x0) - 1))
          .attr("height", (b) => yc(0) - yc(b.length))
          .attr("fill", "#d62728").attr("opacity", 0.75);
      }
    }

    /**
     * Barras por categoría para tono_dominante. Cluster y dataset se comparan
     * como PROPORCIONES en una misma escala vertical (a diferencia de los
     * histogramas continuos, que normalizan cada serie a su propio máximo).
     */
    function dibujarTono(svg, valoresGlobal, valoresCluster, titulo) {
      const w = 160, h = 100, margen = { t: 18, r: 6, b: 22, l: 6 };
      const cats = Categorias.CATEGORIAS_TONO;
      const pg = Categorias.proporcionesPorCategoria(valoresGlobal, cats);
      const pc = Categorias.proporcionesPorCategoria(valoresCluster, cats);

      const x = d3.scaleBand().domain(cats).range([margen.l, w - margen.r]).padding(0.12);
      const pMax = d3.max(pg.concat(pc), (d) => d.p) || 1;
      const y = d3.scaleLinear().domain([0, pMax]).range([h - margen.b, margen.t]);

      svg.attr("viewBox", `0 0 ${w} ${h}`);
      svg.selectAll("*").remove();

      svg.append("text")
        .attr("x", w / 2).attr("y", 10)
        .attr("text-anchor", "middle").attr("font-size", 9).attr("fill", "#555")
        .text(titulo);

      // dataset: contorno gris detrás
      svg.selectAll("rect.global-cat").data(pg).enter().append("rect")
        .attr("class", "global-cat")
        .attr("x", (d) => x(d.categoria)).attr("y", (d) => y(d.p))
        .attr("width", x.bandwidth()).attr("height", (d) => y(0) - y(d.p))
        .attr("fill", "#ddd").attr("stroke", "#999").attr("stroke-width", 0.6);

      // cluster: barra del matiz real, más angosta y por delante
      const ancho = x.bandwidth() * 0.62;
      svg.selectAll("rect.cluster-cat").data(pc).enter().append("rect")
        .attr("class", "cluster-cat")
        .attr("x", (d) => x(d.categoria) + (x.bandwidth() - ancho) / 2)
        .attr("y", (d) => y(d.p)).attr("width", ancho)
        .attr("height", (d) => y(0) - y(d.p))
        .attr("fill", (d) => Categorias.colorTono(d.categoria))
        .attr("stroke", "#222").attr("stroke-width", 0.5);

      svg.selectAll("text.etq-cat").data(cats).enter().append("text")
        .attr("class", "etq-cat")
        .attr("x", (c) => x(c) + x.bandwidth() / 2).attr("y", h - 10)
        .attr("text-anchor", "middle").attr("font-size", 6.5).attr("fill", "#666")
        .text((c) => Categorias.etiquetaTono(c));

      svg.append("text")
        .attr("x", w / 2).attr("y", h - 1)
        .attr("text-anchor", "middle").attr("font-size", 6).attr("fill", "#888")
        .text("sector de matiz (ac. = acromática) — proporción");
    }

    function dibujar() {
      const seleccion = estado.obtener().clusterSeleccionado;
      contenedor.selectAll("*").remove();

      if (!seleccion) {
        contenedor.append("p").attr("class", "panel-vacio")
          .text("Seleccioná un cluster en el treemap para ver su perfil de características.");
        return;
      }

      const idsCluster = new Set(hojasDe(seleccion).map((h) => h.img_id));
      contenedor.append("h3").text(`Cluster seleccionado — ${idsCluster.size} imágenes`);

      const celdas = contenedor.selectAll("div.celda-hist")
        .data(VARS).enter().append("div").attr("class", "celda-hist")
        .append("svg");

      celdas.each(function (v) {
        const valoresGlobal = registros.map((r) => r[v]).filter((x) => x != null);
        const valoresCluster = registros
          .filter((r) => idsCluster.has(r.img_id))
          .map((r) => r[v]).filter((x) => x != null);
        dibujarHistograma(d3.select(this), valoresGlobal, valoresCluster, v);
      });

      // 8vo panel: tono_dominante (categórica). Si el JSON exportado es de una
      // versión anterior y no trae el campo, se omite sin romper el resto.
      const tonoGlobal = registros.map((r) => r.tono_dominante).filter((x) => x != null);
      if (tonoGlobal.length > 0) {
        const tonoCluster = registros
          .filter((r) => idsCluster.has(r.img_id))
          .map((r) => r.tono_dominante).filter((x) => x != null);
        const celdaTono = contenedor.append("div").attr("class", "celda-hist").append("svg");
        dibujarTono(celdaTono, tonoGlobal, tonoCluster, "tono_dominante");
      }
    }

    estado.suscribir(() => dibujar());
    dibujar();
    return { dibujar };
  }

  global.crearPanelCaracteristicas = crearPanelCaracteristicas;
})(typeof window !== "undefined" ? window : globalThis);