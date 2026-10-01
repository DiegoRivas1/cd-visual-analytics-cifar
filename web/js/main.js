/**
 * main.js — carga los datos exportados por Python y arma la aplicación:
 * estado compartido + treemap + panel de características + filtros.
 */
(async function () {
  "use strict";

  const estado = Enlace.crearEstado();

  let arbol, metadatos;
  try {
    [arbol, metadatos] = await Promise.all([
      fetch("data/dendrograma.json").then((r) => {
        if (!r.ok) throw new Error(`dendrograma.json: HTTP ${r.status}`);
        return r.json();
      }),
      fetch("data/metadatos.json").then((r) => {
        if (!r.ok) throw new Error(`metadatos.json: HTTP ${r.status}`);
        return r.json();
      }),
    ]);
  } catch (err) {
    document.getElementById("app").innerHTML = `
      <div class="error-carga">
        <h2>No se pudieron cargar los datos</h2>
        <p>${err.message}</p>
        <p>¿Corriste <code>python -m src.export_web</code> o la celda de
        exportación del notebook? ¿Estás sirviendo la carpeta <code>web/</code>
        con un servidor local (no abriendo el .html directo, por las
        restricciones de <code>fetch</code> sobre <code>file://</code>)?</p>
        <p>Ejemplo: <code>cd web && python -m http.server 8000</code> y abrir
        <code>http://localhost:8000</code>.</p>
      </div>`;
    console.error(err);
    return;
  }

  const registros = metadatos.registros;
  const ladoMiniatura = metadatos.lado_miniatura;
  // el atlas es cuadrado de lado = ceil(sqrt(n)) * ladoMiniatura; lo
  // calculamos aquí para no tener que guardarlo aparte en el JSON.
  const ladoGrid = Math.ceil(Math.sqrt(registros.length));
  const ladoAtlas = ladoGrid * ladoMiniatura;

  estado.actualizar({ ladoMiniatura });

  const panel = crearPanelCaracteristicas({
    contenedorSel: "#panel-caracteristicas",
    registros,
    estado,
  });

  const filtros = crearFiltros({
    contenedorSel: "#panel-filtros",
    registros,
    estado,
  });

  const treemap = crearTreemap({
    contenedorSel: "#treemap",
    arbol,
    atlasSrc: "data/sprites/atlas.png",
    ladoAtlas,
    estado,
  });

  // --- controles de la barra lateral: slider de k, tamaño de miniatura, volver ---
  const sliderK = document.getElementById("slider-k");
  const valorK = document.getElementById("valor-k");
  sliderK.addEventListener("input", () => {
    const k = parseInt(sliderK.value, 10);
    valorK.textContent = k;
    estado.actualizar({ k });
  });

  const sliderLado = document.getElementById("slider-lado");
  sliderLado.addEventListener("input", () => {
    estado.actualizar({ ladoMiniatura: parseInt(sliderLado.value, 10) });
  });

  document.getElementById("boton-volver").addEventListener("click", () => {
    treemap.volverArriba();
  });

  document.getElementById("total-imagenes").textContent = registros.length;
})();