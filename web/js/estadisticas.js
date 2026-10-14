/**
 * estadisticas.js — cálculos puros (sin D3, sin DOM) que usan el panel de
 * características y el treemap. Se prueban en aislamiento:
 *     node web/js/estadisticas.test.js
 */
(function (global) {
  "use strict";

  function media(a) {
    if (!a.length) return NaN;
    let s = 0;
    for (const x of a) s += x;
    return s / a.length;
  }

  function mediana(a) {
    if (!a.length) return NaN;
    const b = a.slice().sort((x, y) => x - y);
    const m = b.length >> 1;
    return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2;
  }

  /** Varianza muestral (n-1). Con menos de 2 datos no está definida -> NaN. */
  function varianza(a) {
    if (a.length < 2) return NaN;
    const m = media(a);
    let s = 0;
    for (const x of a) s += (x - m) * (x - m);
    return s / (a.length - 1);
  }

  function desviacion(a) {
    return Math.sqrt(varianza(a));
  }

  /**
   * d de Cohen entre dos grupos, con desviación estándar combinada (la misma
   * definición que se usó en el EDA). Positivo = `a` tiene valores mayores.
   * Devuelve null si no se puede calcular (menos de 2 datos por grupo o
   * dispersión nula), en vez de NaN/Infinity, para que la interfaz lo muestre
   * como "sin dato" y no como un número engañoso.
   */
  function cohenD(a, b) {
    if (a.length < 2 || b.length < 2) return null;
    const sp = Math.sqrt(
      ((a.length - 1) * varianza(a) + (b.length - 1) * varianza(b)) /
        (a.length + b.length - 2)
    );
    if (!(sp > 0)) return null;
    return (media(a) - media(b)) / sp;
  }

  /** Convención de Cohen: 0.2 pequeño, 0.5 medio, 0.8 grande. */
  function nivelEfecto(d) {
    if (d == null) return -1;
    const m = Math.abs(d);
    if (m < 0.2) return 0;
    if (m < 0.5) return 1;
    if (m < 0.8) return 2;
    return 3;
  }

  const ETIQUETAS_EFECTO = [
    "diferencia despreciable", "diferencia pequeña", "diferencia media", "diferencia grande",
  ];

  function etiquetaEfecto(d) {
    const n = nivelEfecto(d);
    return n < 0 ? "sin dato" : ETIQUETAS_EFECTO[n];
  }

  /**
   * Histograma en PROPORCIÓN sobre un dominio fijo [lo, hi] con nBins casilleros
   * iguales. El valor hi cae en el último casillero. Los valores fuera del
   * dominio no se cuentan pero sí entran en el total, así las proporciones
   * nunca suman más de 1 y un valor inesperado queda a la vista.
   */
  function histograma(valores, dominio, nBins) {
    const lo = dominio[0];
    const hi = dominio[1];
    const ancho = hi - lo || 1;
    const conteos = new Array(nBins).fill(0);
    for (const v of valores) {
      if (v < lo || v > hi) continue;
      let i = Math.floor(((v - lo) / ancho) * nBins);
      if (i >= nBins) i = nBins - 1;
      conteos[i]++;
    }
    const total = valores.length;
    return conteos.map((n, i) => ({
      x0: lo + (i * ancho) / nBins,
      x1: lo + ((i + 1) * ancho) / nBins,
      n,
      p: total ? n / total : 0,
    }));
  }

  /** Distancia de variación total entre dos distribuciones discretas (0 a 1). */
  function distanciaTV(pa, pb) {
    let s = 0;
    for (let i = 0; i < pa.length; i++) s += Math.abs(pa[i] - pb[i]);
    return s / 2;
  }

  /**
   * Nivel (0..3) y etiqueta para la distancia de variación total entre dos
   * distribuciones. A diferencia de la d de Cohen no hay una convención
   * estándar, así que estos umbrales son orientativos y se declaran como tales
   * en la interfaz.
   */
  function nivelTV(tv) {
    if (tv == null || Number.isNaN(tv)) return -1;
    if (tv < 0.1) return 0;
    if (tv < 0.25) return 1;
    if (tv < 0.5) return 2;
    return 3;
  }

  const ETIQUETAS_TV = [
    "distribución casi igual", "distribución algo distinta",
    "distribución bastante distinta", "distribución muy distinta",
  ];

  function etiquetaTV(tv) {
    const n = nivelTV(tv);
    return n < 0 ? "sin dato" : ETIQUETAS_TV[n];
  }

  /** Valor más frecuente y su proporción. Con empate gana el que apareció primero. */
  function dominante(valores) {
    if (!valores.length) return null;
    const cuenta = new Map();
    for (const v of valores) cuenta.set(v, (cuenta.get(v) || 0) + 1);
    let mejor = null;
    let mejorN = -1;
    for (const [k, n] of cuenta) {
      if (n > mejorN) { mejorN = n; mejor = k; }
    }
    return { valor: mejor, n: mejorN, p: mejorN / valores.length };
  }

  /** Número a texto, con "—" para NaN/null. */
  function fmt(x, dec) {
    if (x == null || Number.isNaN(x)) return "—";
    return x.toFixed(dec == null ? 3 : dec);
  }

  /** Igual que fmt pero con signo explícito (+0.45 / −0.32). */
  function fmtSigno(x, dec) {
    if (x == null || Number.isNaN(x)) return "—";
    const t = Math.abs(x).toFixed(dec == null ? 2 : dec);
    return (x < 0 ? "−" : "+") + t;
  }

  const Estadisticas = {
    media, mediana, varianza, desviacion, cohenD, nivelEfecto, etiquetaEfecto,
    histograma, distanciaTV, nivelTV, etiquetaTV, dominante, fmt, fmtSigno,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = Estadisticas;
  } else {
    global.Estadisticas = Estadisticas;
  }
})(typeof window !== "undefined" ? window : globalThis);
