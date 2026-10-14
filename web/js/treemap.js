/**
 * treemap.js — vista principal: treemap jerárquico zoomable, adaptado de
 * DendroMap (Bertucci et al., 2023). La geometría (partición del espacio,
 * rejilla de miniaturas, ajuste de etiquetas) vive en layout.js, que se prueba
 * en aislamiento; este módulo solo dibuja con D3 y maneja las interacciones.
 *
 * Garantías visuales:
 *   - Nada se sale de su tarjeta: la rejilla se calcula sobre el área útil
 *     (descontando márgenes y cabecera) y, además, todo el contenido de cada
 *     tarjeta está recortado por un clipPath.
 *   - La etiqueta elige la variante más completa que cabe en el ancho.
 *   - Las miniaturas se ESCALAN desde el atlas (no se recorta una ventana de
 *     tamaño variable), así el slider de tamaño no muestra imágenes vecinas.
 */
(function (global) {
  "use strict";

  const MARGEN = 10;        // px entre el marco y el contenido
  const CABECERA = 28;      // px reservados para la etiqueta
  const SEPARACION = 3;     // px entre miniaturas
  const LADO_MINIMO = 10;   // por debajo no se dibujan miniaturas
  const PX_POR_CARACTER = 6.9; // ancho estimado de la fuente monoespaciada de 11 px
  const UMBRAL_MIXTO = 0.6; // mismo criterio que el EDA

  function crearTreemap({ contenedorSel, arbol, atlasSrc, ladoAtlas, ladoNativo = 32, estado }) {
    const contenedor = d3.select(contenedorSel);
    const svg = contenedor.append("svg").attr("width", "100%").attr("height", "100%");
    const capa = svg.append("g");

    let nodoRaizVista = arbol; // nodo actualmente "enfocado" (tras hacer zoom)

    function dimensiones() {
      const el = contenedor.node();
      return { w: el.clientWidth, h: el.clientHeight };
    }

    function hojasDe(nodo) {
      const salida = [];
      const pila = [nodo];
      while (pila.length) {
        const n = pila.pop();
        if (n.hoja) salida.push(n);
        else { pila.push(n.der); pila.push(n.izq); }
      }
      return salida;
    }

    function variantesEtiqueta(n, dom) {
      const textoN = n === 1 ? "1 imagen" : `${n} imágenes`;
      if (!dom) return [[{ t: textoN, c: null }], [{ t: String(n), c: null }]];
      const pct = Math.round(dom.p * 100);
      const base = [{ t: textoN, c: null }, { t: ` · ${dom.valor} ${pct} %`, c: "dominante" }];
      const marca = dom.p < UMBRAL_MIXTO ? [{ t: "MIXTO", c: "tag-mixto-svg", dx: 8 }] : [];
      return [
        base.concat(marca),
        base,
        [{ t: String(n), c: null }, { t: ` · ${dom.valor} ${pct}%`, c: "dominante" }],
        [{ t: String(n), c: null }],
      ];
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
      entrando.append("clipPath").attr("id", (d) => `clip-cluster-${d.nodo.id}`).append("rect");
      entrando.append("rect").attr("class", "fondo-cluster").attr("rx", 10).attr("ry", 10);
      const contenido = entrando.append("g").attr("class", "contenido")
        .attr("clip-path", (d) => `url(#clip-cluster-${d.nodo.id})`);
      contenido.append("text").attr("class", "etiqueta-cluster");
      contenido.append("g").attr("class", "miniaturas");

      const todos = entrando.merge(grupos);

      todos.transition().duration(450).ease(d3.easeCubicOut)
        .attr("transform", (d) => `translate(${d.rect.x},${d.rect.y})`);

      todos.select("rect.fondo-cluster").transition().duration(450).ease(d3.easeCubicOut)
        .attr("width", (d) => Math.max(0, d.rect.w))
        .attr("height", (d) => Math.max(0, d.rect.h));

      // El recorte se anima con la MISMA duración y curva que el marco, así en
      // ningún instante se ve contenido fuera del marco mientras este crece
      // (la rejilla ya está calculada para el tamaño final).
      todos.select("clipPath rect")
        .attr("x", 0.5).attr("y", 0.5)
        .transition().duration(450).ease(d3.easeCubicOut)
        .attr("width", (d) => Math.max(0, d.rect.w - 1))
        .attr("height", (d) => Math.max(0, d.rect.h - 1));

      todos.each(function (d) {
        const grupo = d3.select(this);
        const hojasVisibles = hojasDe(d.nodo);
        const dom = hojasVisibles.length > 1
          ? Estadisticas.dominante(hojasVisibles.map((x) => x.clase)) : null;
        const mixto = !!(dom && dom.p < UMBRAL_MIXTO);
        grupo.classed("mixto", mixto);

        // --- etiqueta: la variante más completa que cabe en el ancho ---
        const etiqueta = grupo.select("text.etiqueta-cluster").attr("x", MARGEN).attr("y", 19);
        etiqueta.text(null);
        const segmentos = Layout.elegirEtiqueta(variantesEtiqueta(d.nodo.n, dom), d.rect.w - 2 * MARGEN, PX_POR_CARACTER);
        for (const seg of segmentos) {
          etiqueta.append("tspan").attr("class", seg.c).attr("dx", seg.dx || null).text(seg.t);
        }

        // --- tooltip del cluster (completo, aunque la etiqueta se haya acortado) ---
        let resumen = d.nodo.n === 1 ? "Imagen individual." : `Cluster de ${d.nodo.n} imágenes.`;
        if (dom) {
          resumen += ` Clase dominante: ${dom.valor} (${Math.round(dom.p * 100)} %).`;
          if (mixto) resumen += " Cluster mixto (ninguna clase supera el 60 %).";
        }
        if (!d.nodo.hoja) resumen += " Clic para acercarte.";
        const titulo = grupo.selectAll("title").data([resumen]);
        titulo.enter().insert("title", ":first-child").merge(titulo).text((t) => t);

        // --- miniaturas: rejilla dentro del área útil, escaladas desde el atlas ---
        const util = { w: d.rect.w - 2 * MARGEN, h: d.rect.h - CABECERA - MARGEN };
        const rej = Layout.rejilla(util, lado, SEPARACION, LADO_MINIMO);
        const ids = hojasVisibles.map((x) => x.img_id);
        const muestra = Layout.muestrearHasta(ids, rej.max);
        const porId = new Map(hojasVisibles.map((x) => [x.img_id, x]));
        const factor = rej.lado / ladoNativo;
        const filtros = estado.obtener().filtros;

        const grupoMin = grupo.select("g.miniaturas");
        const sel = grupoMin.selectAll("foreignObject").data(muestra, (id) => id);
        sel.exit().remove();
        const ent = sel.enter().append("foreignObject");
        ent.append("xhtml:div").attr("class", "miniatura")
          .style("animation-delay", (_, i) => `${(i % 24) * 14}ms`);

        ent.merge(sel)
          .attr("width", rej.lado).attr("height", rej.lado)
          .attr("x", (_, i) => MARGEN + (i % rej.cols) * rej.paso)
          .attr("y", (_, i) => CABECERA + Math.floor(i / rej.cols) * rej.paso)
          .select("div.miniatura")
          .attr("title", (id) => (porId.get(id) ? porId.get(id).clase : null))
          .style("width", rej.lado + "px")
          .style("height", rej.lado + "px")
          .style("background-image", `url(${atlasSrc})`)
          .style("background-size", `${ladoAtlas * factor}px ${ladoAtlas * factor}px`)
          .style("background-position", (id) => {
            const hoja = porId.get(id);
            if (!hoja || !hoja.sprite) return "0 0";
            return `${-hoja.sprite.x_px * factor}px ${-hoja.sprite.y_px * factor}px`;
          })
          .classed("fuera-de-filtro", (id) => {
            const hoja = porId.get(id);
            if (!hoja || !filtros || typeof pasaFiltros !== "function") return false;
            return !pasaFiltros(hoja, filtros);
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