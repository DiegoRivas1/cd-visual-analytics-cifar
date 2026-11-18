/**
 * tema.js — selector de estilo visual. El tema se guarda en localStorage
 * (si el navegador lo permite) y se aplica como data-tema en <html>.
 */
(function () {
  "use strict";
  const TEMAS = ["aurora", "herbario", "brasa", "plano"];
  const CLAVE = "cifar-tema";

  function leer() {
    try { const t = localStorage.getItem(CLAVE); return TEMAS.includes(t) ? t : "aurora"; } catch (_) { return "aurora"; }
  }
  function aplicar(t) {
    document.documentElement.dataset.tema = t;
    try { localStorage.setItem(CLAVE, t); } catch (_) { /* sin almacenamiento: no pasa nada */ }
    document.querySelectorAll(".selector-tema button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.tema === t)));
  }

  document.documentElement.dataset.tema = leer(); // antes de pintar, para evitar el parpadeo
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".selector-tema button").forEach((b) => b.addEventListener("click", () => aplicar(b.dataset.tema)));
    aplicar(leer());
  });
})();
