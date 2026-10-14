/**
 * glosario.js — textos que explican cada característica en la ventana de
 * detalle. Cada definición corresponde a lo que calcula src/features.py.
 *
 *   nombre         título legible
 *   corto          una línea para la tarjeta pequeña
 *   rango          valores posibles
 *   queMide        qué propiedad de la imagen captura
 *   comoSeCalcula  el cálculo, en lenguaje llano
 *   alto / bajo    qué significa un valor alto / bajo (frase que continúa a
 *                  "este cluster tiende a tener ...")
 *   nota           aclaración opcional para evitar malas lecturas
 */
(function (global) {
  "use strict";

  const GLOSARIO = {
    brillo: {
      nombre: "Brillo",
      corto: "Qué tan clara u oscura es la imagen",
      rango: "0 (negro) a 1 (máxima claridad)",
      queMide: "La claridad promedio de la imagen: si en general es clara u oscura.",
      comoSeCalcula: "Se convierte la imagen de RGB a HSV y se promedia el canal V (valor) de los 1 024 píxeles.",
      alto: "mayor brillo (imágenes más claras)",
      bajo: "menor brillo (imágenes más oscuras)",
    },
    contraste: {
      nombre: "Contraste",
      corto: "Cuánto varía la luz dentro de la imagen",
      rango: "0 (imagen plana) a cerca de 0.5",
      queMide: "Qué tan distintas son entre sí las zonas claras y las oscuras de una misma imagen.",
      comoSeCalcula: "Desviación estándar de la luminancia (0.299 R + 0.587 G + 0.114 B) sobre todos los píxeles.",
      alto: "mayor contraste (zonas muy claras y muy oscuras a la vez)",
      bajo: "menor contraste (imágenes planas, de tonos parecidos)",
      nota: "No es lo mismo que el brillo: una imagen puede ser clara y plana, u oscura y con mucho contraste.",
    },
    saturacion: {
      nombre: "Saturación",
      corto: "Qué tan vivos son los colores",
      rango: "0 (grises) a 1 (colores puros)",
      queMide: "La intensidad del color: colores vivos frente a colores apagados o grisáceos.",
      comoSeCalcula: "Se promedia el canal S (saturación) de HSV sobre todos los píxeles.",
      alto: "mayor saturación (colores más vivos)",
      bajo: "menor saturación (colores apagados o grises)",
      nota: "El blanco y el negro tienen saturación cero aunque sean muy brillantes u oscuros.",
    },
    entropia: {
      nombre: "Entropía",
      corto: "Cuánta variedad de tonos hay",
      rango: "0 a 8 bits",
      queMide: "La riqueza de tonos de gris. Una imagen con casi un solo tono tiene entropía baja; una con muchos tonos repartidos, alta.",
      comoSeCalcula: "Entropía de Shannon del histograma de 256 niveles de gris: −Σ p·log₂(p).",
      alto: "mayor entropía (muchos tonos repartidos, textura rica)",
      bajo: "menor entropía (pocos tonos, como un cielo despejado o un fondo liso)",
      nota: "Aquí la entropía describe los píxeles de la imagen. No tiene relación con la entropía de los votos humanos de CIFAR-10H.",
    },
    densidad_bordes: {
      nombre: "Densidad de bordes",
      corto: "Cuánto detalle y estructura hay",
      rango: "0 a 1 (proporción de píxeles)",
      queMide: "Qué parte de la imagen son bordes: contornos y cambios bruscos entre zonas.",
      comoSeCalcula: "Proporción de píxeles cuyo gradiente de Sobel (sobre la luminancia) supera el umbral 0.1.",
      alto: "mayor densidad de bordes (mucho detalle y estructura)",
      bajo: "menor densidad de bordes (superficies lisas)",
    },
    unif_fondo: {
      nombre: "Uniformidad de fondo",
      corto: "Qué tan variado es el borde de la imagen",
      rango: "0 (fondo uniforme) a cerca de 0.5",
      queMide: "Cuán complejo es el fondo, tomando el marco exterior de la imagen como aproximación (el objeto suele estar en el centro).",
      comoSeCalcula: "Desviación estándar de la luminancia en la banda perimetral de 4 píxeles de ancho.",
      alto: "fondo más variado o complejo (follaje, calle, escenas cargadas)",
      bajo: "fondo más uniforme (cielo, agua, fondo liso)",
      nota: "Ojo con el nombre: es una desviación estándar, así que un valor ALTO significa fondo MENOS uniforme.",
    },
    energia_central: {
      nombre: "Energía central",
      corto: "Si el detalle está en el centro o repartido",
      rango: "0 a cerca de 4 (1 = repartido por igual)",
      queMide: "Un indicador indirecto del tamaño del objeto: si la variación visual se concentra en el centro o se reparte por toda la imagen.",
      comoSeCalcula: "Varianza del bloque central de 16×16 píxeles dividida por la varianza de toda la imagen.",
      alto: "mayor energía central (la variación se concentra en el centro)",
      bajo: "menor energía central (la variación está en los bordes o repartida)",
      nota: "Es una aproximación: no detecta objetos, solo compara el centro con el total.",
    },
    tono_dominante: {
      nombre: "Tono dominante",
      corto: "De qué color es predominantemente",
      rango: "12 sectores de color (0 a 11) y «acromática»",
      queMide: "El color que más aparece en la imagen, agrupado en 12 sectores de 30° sobre el círculo de matices.",
      comoSeCalcula: "Se toma el matiz (H de HSV) de los píxeles con saturación mayor a 0.15 y se elige el sector más frecuente. Si menos del 5 % de los píxeles tiene color, la imagen se marca acromática.",
      alto: "",
      bajo: "",
      nota: "Es una variable categórica: por eso se compara con barras por sector y no con un histograma.",
    },
  };

  /** Nombre aproximado de cada sector de tono (0..11) y de la categoría -1. */
  const NOMBRES_SECTOR = {
    "-1": "acromática (sin color predominante)",
    0: "rojo–naranja", 1: "naranja–amarillo", 2: "amarillo–verde", 3: "verde lima",
    4: "verde", 5: "verde–cian", 6: "cian", 7: "azul claro",
    8: "azul–violeta", 9: "violeta", 10: "magenta", 11: "rosa–rojo",
  };

  const Glosario = { GLOSARIO, NOMBRES_SECTOR };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = Glosario;
  } else {
    global.Glosario = Glosario;
  }
})(typeof window !== "undefined" ? window : globalThis);
