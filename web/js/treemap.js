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

    // ---- dock fijo (columna derecha): resumen del cluster o ficha de la imagen bajo el mouse ----
    const DK_LADO = 30, DK_MAX = 180, DK_FILAS = 3, DK_CLASES = 6;
    const VARS_IMG = ["brillo", "contraste", "saturacion", "entropia", "densidad_bordes", "unif_fondo", "energia_central"];
    const todasHojas = hojasDe(arbol);
    const rangosImg = {};
    for (const v of VARS_IMG) rangosImg[v] = d3.extent(todasHojas, (x) => x[v]);
    const dock = d3.select("body").append("div").attr("class", "dock-vista").attr("aria-hidden", "true");
    let temporizador = null;

    function anclarDock() {
      const p = document.getElementById("panel-caracteristicas");
      const det = document.getElementById("dialogo-detalle");
      const r = p ? p.getBoundingClientRect() : { left: window.innerWidth - 320, width: 310 };
      // con el panel de detalle abierto, el dock se mueve a su costado (sobre el treemap)
      if (det && det.open) dock.style("left", `${Math.max(8, r.left - 300)}px`).style("width", "290px");
      else dock.style("left", `${r.left + 10}px`).style("width", `${r.width - 20}px`);
    }

    function ocultarDock() {
      clearTimeout(temporizador);
      dock.classed("visible", false);
    }

    function fondoAtlas(hoja, lado) {
      const factor = lado / ladoNativo;
      return {
        "background-image": `url(${atlasSrc})`,
        "background-size": `${ladoAtlas * factor}px ${ladoAtlas * factor}px`,
        "background-position": hoja && hoja.sprite ? `${-hoja.sprite.x_px * factor}px ${-hoja.sprite.y_px * factor}px` : "0 0",
      };
    }

    function mostrarCluster(d) {
      const hojas = hojasDe(d.nodo);
      if (hojas.length < 2) return;
      const n = hojas.length;
      const dom = Estadisticas.dominante(hojas.map((x) => x.clase));
      const conteo = d3.rollups(hojas, (v) => v.length, (x) => x.clase).sort((p, q) => q[1] - p[1]);
      anclarDock();
      dock.selectAll("*").remove();

      const cab = dock.append("div").attr("class", "vp-cab");
      cab.append("strong").text(`${n} imágenes`);
      if (dom && dom.p < UMBRAL_MIXTO) cab.append("span").attr("class", "tag-mixto").text("mixto");

      const clases = dock.append("div").attr("class", "vp-clases");
      for (const [clase, c] of conteo.slice(0, DK_CLASES)) {
        const f = clases.append("div").attr("class", "vp-fila");
        f.append("span").text(clase);
        f.append("span").attr("class", "vp-barra").append("i").style("width", `${(100 * c) / n}%`);
        f.append("span").attr("class", "vp-pct").text(`${Math.round((100 * c) / n)} %`);
      }
      if (conteo.length > DK_CLASES) clases.append("div").attr("class", "vp-mas").text(`+ ${conteo.length - DK_CLASES} clases más`);

      // las imágenes se deslizan de izquierda a derecha: así se ven también las que no caben
      const porId = new Map(hojas.map((x) => [x.img_id, x]));
      const muestra = Layout.muestrearHasta(hojas.map((x) => x.img_id), DK_MAX);
      const porFila = Math.ceil(muestra.length / DK_FILAS);
      for (let f = 0; f < DK_FILAS; f++) {
        const ids = muestra.slice(f * porFila, (f + 1) * porFila);
        if (!ids.length) continue;
        const pista = dock.append("div").attr("class", "vp-carril").append("div").attr("class", "vp-pista")
          .style("--dur", `${Math.max(8, ids.length * (0.55 + 0.12 * f))}s`);
        for (const id of ids.concat(ids)) {
          const el = pista.append("div").attr("class", "vp-img");
          for (const [k, v] of Object.entries(fondoAtlas(porId.get(id), DK_LADO))) el.style(k, v);
        }
      }
      dock.append("div").attr("class", "vp-pie").text(
        (n > muestra.length ? `Muestra de ${muestra.length} de ${n} imágenes` : `Las ${n} imágenes`) +
        (d.nodo.hoja ? "" : " · clic para acercarte"));
      dock.classed("visible", true);
    }

    function mostrarImagen(hoja) {
      if (!hoja) return;
      clearTimeout(temporizador);
      anclarDock();
      dock.selectAll("*").remove();
      const cab = dock.append("div").attr("class", "vp-img-cab");
      const grande = cab.append("div").attr("class", "vp-grande");
      for (const [k, v] of Object.entries(fondoAtlas(hoja, 96))) grande.style(k, v);
      const t = cab.append("div");
      t.append("strong").text(hoja.clase);
      t.append("div").attr("class", "vp-pie").text(`imagen #${hoja.img_id}`);

      const tabla = dock.append("div").attr("class", "vp-valores");
      for (const v of VARS_IMG) {
        const [lo, hi] = rangosImg[v];
        const fila = tabla.append("div").attr("class", "vp-fila vp-fila-val");
        fila.append("span").text(Glosario.GLOSARIO[v].nombre);
        fila.append("span").attr("class", "vp-barra").append("i").style("width", `${(100 * (hoja[v] - lo)) / (hi - lo || 1)}%`);
        fila.append("span").attr("class", "vp-pct").text(hoja[v].toFixed(2));
      }
      const tono = hoja.tono_dominante;
      const nombreTono = Glosario.NOMBRES_SECTOR[tono];
      tabla.append("div").attr("class", "vp-tono").text(
        `Tono dominante: ${Categorias.etiquetaTono(tono) === "ac." ? "acromático" : "sector " + tono}${nombreTono ? " · " + nombreTono : ""}`);
      dock.append("div").attr("class", "vp-pie").text("La barra ubica el valor dentro del rango de todo el dataset.");
      dock.classed("visible", true);
    }

    // ---- resaltado desde un histograma ----
    function pasaResaltado(hoja, r) {
      if (!r) return true;
      const x = hoja[r.variable];
      if (x == null) return false;
      if (r.categoria != null) return x === r.categoria;
      return x >= r.lo && (x < r.hi || (r.ultimo && x <= r.hi));
    }

    function dibujarChip() {
      contenedor.select(".chip-resaltado").remove();
      const e = estado.obtener();
      const r = e.previa || e.resaltado;
      if (!r) return;
      const cuantas = todasHojas.filter((x) => pasaResaltado(x, r)).length;
      const chip = contenedor.append("div").attr("class", "chip-resaltado" + (e.previa ? " chip-previa" : ""));
      chip.append("span").text(`${e.previa ? "Vista previa" : "Resaltando"} · ${r.nombre} · ${cuantas} imágenes (${Math.round((100 * cuantas) / todasHojas.length)} %)`);
      if (!e.previa) {
        chip.append("button").attr("type", "button").attr("aria-label", "Quitar resaltado").text("×")
          .on("click", () => estado.actualizar({ resaltado: null }));
      }
    }

    // actualización liviana: solo cambia qué miniaturas se atenúan (sin recalcular el layout)
    const hojaPorId = new Map(todasHojas.map((x) => [x.img_id, x]));
    function atenuar() {
      const e = estado.obtener();
      const r = e.previa || e.resaltado;
      contenedor.selectAll("div.miniatura").classed("fuera-de-filtro", (id) => {
        const hoja = hojaPorId.get(id);
        if (!hoja) return false;
        if (!pasaResaltado(hoja, r)) return true;
        return !!(e.filtros && typeof pasaFiltros === "function" && !pasaFiltros(hoja, e.filtros));
      });
      dibujarChip();
    }

    function dibujar() {
      ocultarDock();
      dibujarChip();
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

        // --- miniaturas: rejilla dentro del área útil, escaladas desde el atlas ---
        const util = { w: d.rect.w - 2 * MARGEN, h: d.rect.h - CABECERA - MARGEN };
        const rej = Layout.rejilla(util, lado, SEPARACION, LADO_MINIMO);
        const ids = hojasVisibles.map((x) => x.img_id);
        const muestra = Layout.muestrearHasta(ids, rej.max);
        const porId = new Map(hojasVisibles.map((x) => [x.img_id, x]));
        const factor = rej.lado / ladoNativo;
        const filtros = estado.obtener().filtros;
        const resaltado = estado.obtener().previa || estado.obtener().resaltado;

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
            if (!hoja) return false;
            if (!pasaResaltado(hoja, resaltado)) return true;
            if (!filtros || typeof pasaFiltros !== "function") return false;
            return !pasaFiltros(hoja, filtros);
          })
          .on("mouseenter", (_ev, id) => mostrarImagen(porId.get(id)))
          .on("mouseleave", () => { clearTimeout(temporizador); temporizador = setTimeout(() => mostrarCluster(d), 60); });
      });

      todos
        .style("cursor", (d) => (d.nodo.hoja ? "default" : "pointer"))
        .on("click", (_ev, d) => {
          if (d.nodo.hoja) return;
          nodoRaizVista = d.nodo;
          estado.actualizar({ clusterSeleccionado: d.nodo });
        })
        .on("mouseenter", function (_ev, d) {
          d3.select(this).raise();
          clearTimeout(temporizador);
          temporizador = setTimeout(() => mostrarCluster(d), 260);
        })
        .on("mouseleave", ocultarDock);
    }

    function volverArriba() {
      nodoRaizVista = arbol;
      estado.actualizar({ clusterSeleccionado: null, resaltado: null });
    }

    let previaAnterior = estado.obtener().previa;
    estado.suscribir(() => {
      const p = estado.obtener().previa;
      if (p !== previaAnterior) { previaAnterior = p; atenuar(); return; }
      dibujar();
    });
    // también cuando cambia el tamaño del contenedor (p. ej. al abrir el panel de detalle)
    let pendiente = null, anchoPrevio = 0;
    new ResizeObserver(() => {
      const w = contenedor.node().clientWidth;
      if (w === anchoPrevio) return;
      anchoPrevio = w;
      clearTimeout(pendiente);
      pendiente = setTimeout(dibujar, 60);
    }).observe(contenedor.node());
    dibujar();

    return { dibujar, volverArriba };
  }

  global.crearTreemap = crearTreemap;
})(typeof window !== "undefined" ? window : globalThis);