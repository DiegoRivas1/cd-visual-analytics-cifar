/**
 * panel_caracteristicas.js — panel derecho: perfil de características del
 * cluster seleccionado frente al dataset completo. Es el aporte diferencial
 * del proyecto frente a DendroMap.
 *
 *   - Siete características continuas se dibujan como histogramas en
 *     PROPORCIÓN (misma escala vertical para cluster y dataset).
 *   - tono_dominante (categórica) se dibuja como barras por sector.
 *   - Cada tarjeta muestra cuánto distingue esa característica al cluster
 *     (d de Cohen frente al resto) y las tarjetas se ordenan por ese valor.
 *   - Clic en una tarjeta abre una ventana con el gráfico ampliado y su
 *     explicación (textos en glosario.js, cálculos en estadisticas.js).
 */
(function (global) {
  "use strict";

  const VARS_CONT = [
    "brillo", "contraste", "saturacion", "entropia",
    "densidad_bordes", "unif_fondo", "energia_central",
  ];
  const VAR_CAT = "tono_dominante";
  const N_BINS = 16;
  const UMBRAL_MIXTO = 0.6; // pureza por debajo de la cual el cluster se marca "mixto" (igual que en el EDA)

  function crearPanelCaracteristicas({ contenedorSel, registros, estado, dialogoSel = "#dialogo-detalle" }) {
    const contenedor = d3.select(contenedorSel);
    const dialogo = d3.select(dialogoSel);
    const total = registros.length;
    let ordenarPorRelevancia = true;
    let nodoDibujado = undefined;

    const variablesContinuas = VARS_CONT.filter((v) => registros.some((r) => r[v] != null));
    const dominios = {};
    for (const v of variablesContinuas) dominios[v] = d3.extent(registros, (r) => r[v]);

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

    /** Todo lo que se necesita para dibujar y explicar cada característica. */
    function calcular(ids) {
      const res = [];
      for (const v of variablesContinuas) {
        const g = [], c = [], r = [];
        for (const reg of registros) {
          const x = reg[v];
          if (x == null) continue;
          g.push(x);
          (ids.has(reg.img_id) ? c : r).push(x);
        }
        res.push({
          v, tipo: "cont", g, c, r, dominio: dominios[v],
          mediaC: Estadisticas.media(c), mediaG: Estadisticas.media(g),
          medianaC: Estadisticas.mediana(c), medianaG: Estadisticas.mediana(g),
          sdC: Estadisticas.desviacion(c), sdG: Estadisticas.desviacion(g),
          d: Estadisticas.cohenD(c, r),
        });
      }
      const tg = [], tc = [];
      for (const reg of registros) {
        const x = reg[VAR_CAT];
        if (x == null) continue;
        tg.push(x);
        if (ids.has(reg.img_id)) tc.push(x);
      }
      if (tg.length) {
        const cats = Categorias.CATEGORIAS_TONO;
        const pg = Categorias.proporcionesPorCategoria(tg, cats);
        const pc = Categorias.proporcionesPorCategoria(tc, cats);
        res.push({
          v: VAR_CAT, tipo: "cat", g: tg, c: tc, pg, pc,
          tv: Estadisticas.distanciaTV(pg.map((x) => x.p), pc.map((x) => x.p)),
        });
      }
      return res;
    }

    function ordenar(lista) {
      if (!ordenarPorRelevancia) return lista;
      const peso = (a) => (a.d == null ? -1 : Math.abs(a.d));
      const cont = lista.filter((a) => a.tipo === "cont").sort((a, b) => peso(b) - peso(a));
      return cont.concat(lista.filter((a) => a.tipo === "cat"));
    }

    // ------------------------------------------------------------------
    // Gráficos (se usan en la tarjeta pequeña y en la ventana ampliada)
    // ------------------------------------------------------------------

    function graficoContinuo(svg, a, o) {
      const w = o.ancho, h = o.alto, det = o.detallado;
      const g = Glosario.GLOSARIO[a.v];
      const m = det ? { t: 22, r: 18, b: 52, l: 58 } : { t: 8, r: 4, b: 18, l: 4 };
      const x = d3.scaleLinear().domain(a.dominio).range([m.l, w - m.r]);
      const hg = Estadisticas.histograma(a.g, a.dominio, N_BINS);
      const hc = Estadisticas.histograma(a.c, a.dominio, N_BINS);
      const pMax = d3.max(hg.concat(hc), (b) => b.p) || 1;
      const y = d3.scaleLinear().domain([0, pMax]).nice().range([h - m.b, m.t]);

      svg.attr("viewBox", `0 0 ${w} ${h}`).attr("role", "img")
        .attr("aria-label", `Distribución de ${g.nombre}: cluster frente al dataset completo`);
      svg.selectAll("*").remove();

      if (det) {
        svg.append("g").attr("class", "rejilla").selectAll("line").data(y.ticks(5)).join("line")
          .attr("x1", m.l).attr("x2", w - m.r).attr("y1", (t) => y(t)).attr("y2", (t) => y(t));
      }

      const ancho = (b) => Math.max(0, x(b.x1) - x(b.x0) - 1);
      svg.append("g").selectAll("rect").data(hg).join("rect").attr("class", "barra-global")
        .attr("x", (b) => x(b.x0) + 0.5).attr("y", (b) => y(b.p))
        .attr("width", ancho).attr("height", (b) => y(0) - y(b.p));
      svg.append("g").selectAll("rect").data(hc).join("rect").attr("class", "barra-cluster")
        .attr("x", (b) => x(b.x0) + 0.5).attr("y", (b) => y(b.p))
        .attr("width", ancho).attr("height", (b) => y(0) - y(b.p));

      const marca = (valor, clase, texto, fila) => {
        if (Number.isNaN(valor)) return;
        const xx = x(valor);
        svg.append("line").attr("class", `media ${clase}`)
          .attr("x1", xx).attr("x2", xx).attr("y1", det ? m.t : 2).attr("y2", h - m.b);
        if (det) {
          const derecha = xx > w * 0.7;
          svg.append("text").attr("class", `etq-media ${clase}`)
            .attr("x", xx + (derecha ? -5 : 5)).attr("y", m.t + 11 + fila * 14)
            .attr("text-anchor", derecha ? "end" : "start").text(texto);
        }
      };
      marca(a.mediaG, "global", "media del dataset", 1);
      marca(a.mediaC, "cluster", "media del cluster", 0);

      if (det) {
        svg.append("g").attr("class", "eje").attr("transform", `translate(0,${h - m.b})`)
          .call(d3.axisBottom(x).ticks(8).tickSizeOuter(0));
        svg.append("g").attr("class", "eje").attr("transform", `translate(${m.l},0)`)
          .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(".1~%")).tickSizeOuter(0));
        svg.append("text").attr("class", "titulo-eje").attr("x", (m.l + w - m.r) / 2).attr("y", h - 8)
          .attr("text-anchor", "middle").text(`${g.nombre} (${g.rango})`);
        svg.append("text").attr("class", "titulo-eje").attr("transform", "rotate(-90)")
          .attr("x", -(m.t + h - m.b) / 2).attr("y", 14).attr("text-anchor", "middle")
          .text("% de imágenes en cada casillero");
        // información al pasar el mouse sobre cada casillero
        svg.append("g").selectAll("rect").data(hg).join("rect").attr("class", "zona-hover")
          .attr("x", (b) => x(b.x0)).attr("y", m.t).attr("width", (b) => Math.max(0, x(b.x1) - x(b.x0)))
          .attr("height", h - m.b - m.t)
          .append("title").text((b, i) =>
            `${Estadisticas.fmt(b.x0, 2)} – ${Estadisticas.fmt(b.x1, 2)}\n` +
            `Cluster: ${(hc[i].p * 100).toFixed(1)} % (${hc[i].n} imágenes)\n` +
            `Dataset: ${(b.p * 100).toFixed(1)} % (${b.n} imágenes)`);
      } else {
        svg.append("text").attr("class", "etq-eje").attr("x", m.l).attr("y", h - 5)
          .attr("text-anchor", "start").text(Estadisticas.fmt(a.dominio[0], 2));
        svg.append("text").attr("class", "etq-eje").attr("x", w - m.r).attr("y", h - 5)
          .attr("text-anchor", "end").text(Estadisticas.fmt(a.dominio[1], 2));
      }
    }

    function graficoTono(svg, a, o) {
      const w = o.ancho, h = o.alto, det = o.detallado;
      const m = det ? { t: 22, r: 18, b: 64, l: 58 } : { t: 8, r: 4, b: 26, l: 4 };
      const cats = Categorias.CATEGORIAS_TONO;
      const x = d3.scaleBand().domain(cats).range([m.l, w - m.r]).padding(0.14);
      const pMax = d3.max(a.pg.concat(a.pc), (d) => d.p) || 1;
      const y = d3.scaleLinear().domain([0, pMax]).nice().range([h - m.b, m.t]);

      svg.attr("viewBox", `0 0 ${w} ${h}`).attr("role", "img")
        .attr("aria-label", "Proporción de imágenes por sector de color: cluster frente al dataset completo");
      svg.selectAll("*").remove();

      if (det) {
        svg.append("g").attr("class", "rejilla").selectAll("line").data(y.ticks(5)).join("line")
          .attr("x1", m.l).attr("x2", w - m.r).attr("y1", (t) => y(t)).attr("y2", (t) => y(t));
      }
      svg.append("g").selectAll("rect").data(a.pg).join("rect").attr("class", "barra-global-cat")
        .attr("x", (d) => x(d.categoria)).attr("y", (d) => y(d.p))
        .attr("width", x.bandwidth()).attr("height", (d) => y(0) - y(d.p));
      const ancho = x.bandwidth() * 0.62;
      svg.append("g").selectAll("rect").data(a.pc).join("rect").attr("class", "barra-cluster-cat")
        .attr("x", (d) => x(d.categoria) + (x.bandwidth() - ancho) / 2).attr("y", (d) => y(d.p))
        .attr("width", ancho).attr("height", (d) => y(0) - y(d.p))
        .style("fill", (d) => Categorias.colorTono(d.categoria));

      svg.append("g").selectAll("text").data(cats).join("text").attr("class", "etq-eje")
        .attr("x", (c) => x(c) + x.bandwidth() / 2).attr("y", h - m.b + (det ? 16 : 11))
        .attr("text-anchor", "middle").style("font-size", det ? "11px" : null)
        .text((c) => Categorias.etiquetaTono(c));

      if (det) {
        svg.append("g").attr("class", "eje").attr("transform", `translate(${m.l},0)`)
          .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(".0%")).tickSizeOuter(0));
        svg.append("text").attr("class", "titulo-eje").attr("x", (m.l + w - m.r) / 2).attr("y", h - 10)
          .attr("text-anchor", "middle").text("Sector de matiz (ac. = acromática)");
        svg.append("text").attr("class", "titulo-eje").attr("transform", "rotate(-90)")
          .attr("x", -(m.t + h - m.b) / 2).attr("y", 14).attr("text-anchor", "middle")
          .text("% de imágenes");
        svg.append("g").selectAll("rect").data(a.pg).join("rect").attr("class", "zona-hover")
          .attr("x", (d) => x(d.categoria)).attr("y", m.t).attr("width", x.bandwidth())
          .attr("height", h - m.b - m.t)
          .append("title").text((d, i) =>
            `${Glosario.NOMBRES_SECTOR[d.categoria]}\n` +
            `Cluster: ${(a.pc[i].p * 100).toFixed(1)} %\nDataset: ${(d.p * 100).toFixed(1)} %`);
      }
    }

    function dibujarGrafico(svg, a, o) {
      if (a.tipo === "cat") graficoTono(svg, a, o);
      else graficoContinuo(svg, a, o);
    }

    // ------------------------------------------------------------------
    // Tarjetas
    // ------------------------------------------------------------------

    function insignia(sel, a) {
      if (a.tipo === "cont") {
        const n = Estadisticas.nivelEfecto(a.d);
        const flecha = a.d == null ? "" : a.d > 0 ? "▲ " : "▼ ";
        sel.append("span").attr("class", `insignia efecto-${n}`)
          .attr("title", `${Estadisticas.etiquetaEfecto(a.d)} frente al resto del dataset (d de Cohen)`)
          .text(a.d == null ? "sin dato" : flecha + Estadisticas.fmtSigno(a.d));
      } else {
        const n = Estadisticas.nivelTV(a.tv);
        sel.append("span").attr("class", `insignia efecto-${n}`)
          .attr("title", `${Estadisticas.etiquetaTV(a.tv)} (distancia de variación total; 0 = iguales, 1 = disjuntas)`)
          .text("Δ " + Estadisticas.fmt(a.tv, 2));
      }
    }

    function leyenda(sel, categorica) {
      const l = sel.append("div").attr("class", "leyenda");
      l.append("span").attr("class", "muestra muestra-cluster");
      l.append("span").text(categorica ? "Cluster (color del sector)" : "Cluster seleccionado");
      l.append("span").attr("class", "muestra muestra-global");
      l.append("span").text("Dataset completo");
    }

    function dibujar(conservarScroll) {
      const alto = conservarScroll ? contenedor.node().scrollTop : 0;
      const sel = estado.obtener().clusterSeleccionado;
      nodoDibujado = sel;
      contenedor.selectAll("*").remove();

      if (!sel) {
        contenedor.append("p").attr("class", "panel-vacio")
          .text("Seleccioná un cluster en el treemap para ver su perfil de características.");
        const guia = contenedor.append("ol").attr("class", "guia");
        guia.append("li").text("Clic en un cluster del treemap para acercarte a él.");
        guia.append("li").text("Acá aparece qué características lo distinguen del resto del dataset.");
        guia.append("li").text("Clic en cualquier gráfica para ampliarla y ver qué significa.");
        return;
      }

      const hojas = hojasDe(sel);
      const ids = new Set(hojas.map((h) => h.img_id));
      const dom = Estadisticas.dominante(hojas.map((h) => h.clase));

      const cab = contenedor.append("div").attr("class", "panel-cab");
      cab.append("h3").text(`Cluster seleccionado — ${ids.size} imágenes`);
      const meta = cab.append("p").attr("class", "meta");
      meta.append("span").text(`${((100 * ids.size) / total).toFixed(1)} % de la submuestra`);
      if (dom && ids.size > 1) {
        meta.append("span").text(` · clase dominante: ${dom.valor} (${Math.round(dom.p * 100)} %)`);
        if (dom.p < UMBRAL_MIXTO) meta.append("span").attr("class", "tag-mixto").text("mixto");
      }
      leyenda(cab, false);
      const lab = cab.append("label").attr("class", "interruptor");
      lab.append("input").attr("type", "checkbox").attr("id", "orden-relevancia")
        .property("checked", ordenarPorRelevancia)
        .on("change", function () {
          ordenarPorRelevancia = this.checked;
          dibujar(true);
        });
      lab.append("span").text("Ordenar por la característica que más lo distingue");

      const lista = ordenar(calcular(ids));
      const tarjetas = contenedor.append("div").attr("class", "tarjetas")
        .selectAll("button").data(lista, (a) => a.v).join("button")
        .attr("type", "button").attr("class", "tarjeta")
        .attr("aria-label", (a) => `Ampliar: ${Glosario.GLOSARIO[a.v].nombre}`)
        .on("click", (_ev, a) => abrirDetalle(a));

      tarjetas.each(function (a) {
        const t = d3.select(this);
        const g = Glosario.GLOSARIO[a.v];
        const cabT = t.append("span").attr("class", "tarjeta-cab");
        cabT.append("span").attr("class", "tarjeta-nombre").text(g.nombre);
        insignia(cabT, a);
        const svg = t.append("svg").attr("class", "grafico-mini");
        dibujarGrafico(svg, a, { ancho: 300, alto: a.tipo === "cat" ? 112 : 100, detallado: false });
        const pie = t.append("span").attr("class", "tarjeta-pie");
        pie.append("span").attr("class", "corto").text(g.corto);
        pie.append("span").attr("class", "ampliar").text("Ampliar ⤢");
      });

      contenedor.node().scrollTop = alto;
    }

    // ------------------------------------------------------------------
    // Ventana de detalle
    // ------------------------------------------------------------------

    function seccion(sel, titulo, texto) {
      const s = sel.append("section");
      s.append("h3").text(titulo);
      if (texto) s.append("p").text(texto);
      return s;
    }

    function fraseCont(a, g) {
      if (a.d == null) return "No hay datos suficientes para comparar este cluster con el resto del dataset.";
      if (Math.abs(a.d) < 0.2) {
        return `En ${g.nombre.toLowerCase()} este cluster no se distingue del resto del dataset ` +
          `(d = ${Estadisticas.fmtSigno(a.d)}, ${Estadisticas.etiquetaEfecto(a.d)}).`;
      }
      return `Este cluster tiende a tener ${a.d > 0 ? g.alto : g.bajo} que el resto del dataset ` +
        `(d = ${Estadisticas.fmtSigno(a.d)}, ${Estadisticas.etiquetaEfecto(a.d)}).`;
    }

    function tablaCont(sel, a) {
      const t = sel.append("table").attr("class", "tabla-stats");
      const cab = t.append("thead").append("tr");
      cab.append("th").text("");
      cab.append("th").text(`Cluster (${a.c.length})`);
      cab.append("th").text(`Dataset completo (${a.g.length})`);
      const cuerpo = t.append("tbody");
      const fila = (nombre, c, gl) => {
        const r = cuerpo.append("tr");
        r.append("th").text(nombre);
        r.append("td").text(Estadisticas.fmt(c, 3));
        r.append("td").text(Estadisticas.fmt(gl, 3));
      };
      fila("Media", a.mediaC, a.mediaG);
      fila("Mediana", a.medianaC, a.medianaG);
      fila("Desviación estándar", a.sdC, a.sdG);
    }

    function detalleCat(sel, a) {
      const dif = a.pg.map((d, i) => ({ c: d.categoria, pc: a.pc[i].p, pg: d.p, dif: a.pc[i].p - d.p }));
      const sube = dif.slice().sort((p, q) => q.dif - p.dif).filter((d) => d.dif > 0.05).slice(0, 3);
      const nombre = (c) => `${Categorias.etiquetaTono(c) === "ac." ? "Acromática" : "Sector " + c} · ${Glosario.NOMBRES_SECTOR[c]}`;
      const pct = (p) => `${(p * 100).toFixed(0)} %`;
      const s = seccion(sel, "En este cluster",
        a.tv < 0.1
          ? "La distribución de colores del cluster es casi igual a la del dataset completo."
          : "Los sectores de color donde el cluster se distingue del dataset:");
      if (a.tv >= 0.1 && sube.length) {
        const ul = s.append("ul").attr("class", "lista-sectores");
        for (const d of sube) {
          ul.append("li").text(`${nombre(d.c)}: ${pct(d.pc)} del cluster frente a ${pct(d.pg)} del dataset (+${Math.round(d.dif * 100)} puntos)`);
        }
      }
      s.append("p").attr("class", "dato")
        .text(`Distancia entre distribuciones: ${Estadisticas.fmt(a.tv, 2)} (${Estadisticas.etiquetaTV(a.tv)}). ` +
          "Escala de 0 (iguales) a 1 (disjuntas); los umbrales de la etiqueta son orientativos.");
    }

    function abrirDetalle(a) {
      const nodo = dialogo.node();
      if (!nodo) return;
      const g = Glosario.GLOSARIO[a.v];
      dialogo.selectAll("*").remove();

      const marco = dialogo.append("div").attr("class", "dlg-marco");
      const cab = marco.append("header").attr("class", "dlg-cab");
      cab.append("h2").attr("id", "dlg-titulo").text(g.nombre);
      cab.append("button").attr("type", "button").attr("class", "dlg-cerrar")
        .attr("aria-label", "Cerrar").text("×").on("click", () => nodo.close());

      const cuerpo = marco.append("div").attr("class", "dlg-cuerpo");
      const izq = cuerpo.append("div").attr("class", "dlg-grafico");
      leyenda(izq, a.tipo === "cat");
      const svg = izq.append("svg").attr("class", "grafico-grande");
      dibujarGrafico(svg, a, { ancho: 640, alto: a.tipo === "cat" ? 360 : 340, detallado: true });
      izq.append("p").attr("class", "ayuda-hover").text("Pasá el mouse sobre una barra para ver los valores exactos.");

      const der = cuerpo.append("div").attr("class", "dlg-texto");
      seccion(der, "Qué mide", g.queMide);
      seccion(der, "Cómo se calcula", g.comoSeCalcula);
      if (a.tipo === "cont") {
        seccion(der, "Cómo leer el gráfico",
          `Si las barras del cluster están más a la derecha que las del dataset, el cluster tiene ${g.alto}; ` +
          `si están más a la izquierda, ${g.bajo}. Las líneas punteadas marcan las medias. ` +
          "Ambas series están en porcentaje, así que las alturas son comparables.");
        const s = seccion(der, "En este cluster", fraseCont(a, g));
        tablaCont(s, a);
        s.append("p").attr("class", "dato")
          .text("La d de Cohen compara el cluster con el resto del dataset (sin incluir al cluster). " +
            "Convención: menos de 0.2 despreciable, 0.2 a 0.5 pequeña, 0.5 a 0.8 media, más de 0.8 grande.");
      } else {
        seccion(der, "Cómo leer el gráfico",
          "Cada barra de color es la proporción de imágenes del cluster en ese sector de matiz. " +
          "El contorno gris es la proporción del dataset completo. Una barra de color mucho más alta que su contorno " +
          "indica un color que el cluster tiene de más.");
        detalleCat(der, a);
      }
      if (g.nota) seccion(der, "Para tener en cuenta", g.nota);

      nodo.showModal();
    }

    if (dialogo.node()) {
      // clic fuera del marco (sobre el fondo) cierra la ventana
      dialogo.on("click.cerrar", (ev) => {
        if (ev.target === dialogo.node()) dialogo.node().close();
      });
    }

    // el panel solo depende del cluster seleccionado: no se redibuja al mover
    // filtros o sliders (así tampoco se pierde la posición del scroll)
    estado.suscribir((e) => {
      if (e.clusterSeleccionado !== nodoDibujado) dibujar();
    });
    dibujar();
    return { dibujar };
  }

  global.crearPanelCaracteristicas = crearPanelCaracteristicas;
})(typeof window !== "undefined" ? window : globalThis);
