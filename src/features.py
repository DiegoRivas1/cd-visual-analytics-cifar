"""
Extraccion de caracteristicas visuales cuantificables para imagenes CIFAR.

Disenado para probarse de forma aislada:
    python -m src.features          # ejecuta las pruebas internas

Todas las funciones operan sobre un arreglo uint8 de forma (H, W, 3) en orden
RGB, o sobre un lote (N, H, W, 3). Los valores devueltos estan normalizados a
rangos interpretables y documentados en el informe.
"""

from __future__ import annotations

import numpy as np

# --------------------------------------------------------------------------
# Utilidades base
# --------------------------------------------------------------------------

_LUMA = np.array([0.299, 0.587, 0.114], dtype=np.float32)


def a_float(img: np.ndarray) -> np.ndarray:
    """Convierte uint8 [0,255] a float32 [0,1] sin copiar si ya es float."""
    if img.dtype == np.uint8:
        return img.astype(np.float32) / 255.0
    return img.astype(np.float32)


def luminancia(img: np.ndarray) -> np.ndarray:
    """Luminancia perceptual (Rec. 601). Entrada (..., 3) -> salida (...)."""
    return a_float(img) @ _LUMA


def rgb_a_hsv(img: np.ndarray) -> np.ndarray:
    """RGB -> HSV vectorizado. H en [0,1), S y V en [0,1]. Sin dependencias."""
    x = a_float(img)
    r, g, b = x[..., 0], x[..., 1], x[..., 2]
    mx = x.max(axis=-1)
    mn = x.min(axis=-1)
    dif = mx - mn

    h = np.zeros_like(mx)
    seguro = dif > 1e-8
    # cada rama se evalua solo donde el maximo corresponde a ese canal
    idx = seguro & (mx == r)
    h[idx] = ((g[idx] - b[idx]) / dif[idx]) % 6
    idx = seguro & (mx == g)
    h[idx] = ((b[idx] - r[idx]) / dif[idx]) + 2
    idx = seguro & (mx == b)
    h[idx] = ((r[idx] - g[idx]) / dif[idx]) + 4
    h = h / 6.0

    s = np.zeros_like(mx)
    s[mx > 1e-8] = dif[mx > 1e-8] / mx[mx > 1e-8]

    return np.stack([h, s, mx], axis=-1)


# --------------------------------------------------------------------------
# Caracteristicas individuales
# --------------------------------------------------------------------------

def brillo(img: np.ndarray) -> float:
    """Media del canal V (HSV). Rango [0, 1]."""
    return float(rgb_a_hsv(img)[..., 2].mean())


def contraste(img: np.ndarray) -> float:
    """Desviacion estandar de la luminancia (contraste RMS). Rango [0, ~0.5]."""
    return float(luminancia(img).std())


def saturacion(img: np.ndarray) -> float:
    """Media del canal S (HSV). Rango [0, 1]."""
    return float(rgb_a_hsv(img)[..., 1].mean())


def entropia(img: np.ndarray, bins: int = 256) -> float:
    """Entropia de Shannon del histograma de grises, en bits. Rango [0, 8]."""
    gris = (luminancia(img) * 255).astype(np.uint8)
    conteo = np.bincount(gris.ravel(), minlength=bins).astype(np.float64)
    p = conteo[conteo > 0] / conteo.sum()
    return float(-(p * np.log2(p)).sum())


def densidad_bordes(img: np.ndarray, umbral: float = 0.1) -> float:
    """
    Proporcion de pixeles cuyo gradiente Sobel supera el umbral. Rango [0, 1].
    Implementacion propia (sin OpenCV) para que el modulo no tenga dependencias
    pesadas y pueda probarse de forma aislada.
    """
    g = luminancia(img)
    kx = np.array([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]], dtype=np.float32)
    ky = kx.T
    gx = _convolucion2d(g, kx)
    gy = _convolucion2d(g, ky)
    magnitud = np.sqrt(gx ** 2 + gy ** 2)
    return float((magnitud > umbral).mean())


def _convolucion2d(a: np.ndarray, k: np.ndarray) -> np.ndarray:
    """Convolucion 2D valida con padding replicado, via stride tricks."""
    pad = k.shape[0] // 2
    ap = np.pad(a, pad, mode="edge")
    vistas = np.lib.stride_tricks.sliding_window_view(ap, k.shape)
    return np.einsum("ijkl,kl->ij", vistas, k)


def tono_dominante(img: np.ndarray, sectores: int = 12) -> int:
    """
    Sector de tono mas frecuente, considerando solo pixeles con saturacion
    suficiente (evita que grises dominen el histograma). Devuelve [0, sectores-1],
    o -1 si la imagen es esencialmente acromatica.
    """
    hsv = rgb_a_hsv(img)
    h, s = hsv[..., 0], hsv[..., 1]
    validos = s > 0.15
    if validos.sum() < 0.05 * s.size:
        return -1
    idx = np.floor(h[validos] * sectores).astype(int) % sectores
    return int(np.bincount(idx, minlength=sectores).argmax())


def uniformidad_fondo(img: np.ndarray, ancho: int = 4) -> float:
    """
    Desviacion estandar de la luminancia en la banda perimetral. Valores bajos
    sugieren fondo uniforme (estudio, cielo despejado); altos, fondo complejo.
    """
    g = luminancia(img)
    mascara = np.ones(g.shape, dtype=bool)
    mascara[ancho:-ancho, ancho:-ancho] = False
    return float(g[mascara].std())


def energia_central(img: np.ndarray, lado: int = 16) -> float:
    """
    Razon entre la varianza de la region central y la varianza global.
    Proxy del tamano aparente del objeto: valores altos indican que la
    estructura se concentra en el centro.
    """
    g = luminancia(img)
    h, w = g.shape
    y0, x0 = (h - lado) // 2, (w - lado) // 2
    centro = g[y0:y0 + lado, x0:x0 + lado]
    var_global = g.var()
    if var_global < 1e-8:
        return 0.0
    return float(centro.var() / var_global)


# --------------------------------------------------------------------------
# API de lote
# --------------------------------------------------------------------------

CARACTERISTICAS = {
    "brillo": brillo,
    "contraste": contraste,
    "saturacion": saturacion,
    "entropia": entropia,
    "densidad_bordes": densidad_bordes,
    "tono_dominante": tono_dominante,
    "unif_fondo": uniformidad_fondo,
    "energia_central": energia_central,
}


def extraer_lote(imagenes: np.ndarray, verbose: bool = True) -> dict:
    """
    Aplica todas las caracteristicas a un lote (N, H, W, 3).
    Devuelve un dict columna -> np.ndarray de longitud N, listo para DataFrame.
    """
    n = len(imagenes)
    salida = {nombre: np.empty(n, dtype=np.float32) for nombre in CARACTERISTICAS}
    for i, img in enumerate(imagenes):
        for nombre, fn in CARACTERISTICAS.items():
            salida[nombre][i] = fn(img)
        if verbose and (i + 1) % 5000 == 0:
            print(f"  procesadas {i + 1}/{n}")
    salida["tono_dominante"] = salida["tono_dominante"].astype(np.int8)
    return salida


# --------------------------------------------------------------------------
# Pruebas en aislamiento
# --------------------------------------------------------------------------

def _pruebas() -> None:
    rng = np.random.default_rng(42)

    negro = np.zeros((32, 32, 3), dtype=np.uint8)
    blanco = np.full((32, 32, 3), 255, dtype=np.uint8)
    rojo = np.zeros((32, 32, 3), dtype=np.uint8)
    rojo[..., 0] = 255
    ruido = rng.integers(0, 256, (32, 32, 3), dtype=np.uint8)

    # Tablero de bloques de 4 px. Un tablero de 1 px NO sirve como prueba:
    # el kernel Sobel se cancela sobre una alternancia de periodo 2 y devuelve
    # densidad casi nula, aunque la imagen sea visualmente muy texturizada.
    tablero = np.zeros((32, 32, 3), dtype=np.uint8)
    for _i in range(0, 32, 4):
        for _j in range(0, 32, 4):
            if (_i // 4 + _j // 4) % 2 == 0:
                tablero[_i:_i + 4, _j:_j + 4] = 255

    assert abs(brillo(negro) - 0.0) < 1e-6, "brillo de imagen negra debe ser 0"
    assert abs(brillo(blanco) - 1.0) < 1e-6, "brillo de imagen blanca debe ser 1"
    assert contraste(blanco) < 1e-6, "imagen uniforme no tiene contraste"
    assert saturacion(rojo) > 0.99, "rojo puro debe estar saturado"
    assert saturacion(blanco) < 1e-6, "blanco no tiene saturacion"
    assert entropia(blanco) < 1e-6, "imagen uniforme tiene entropia nula"
    assert entropia(ruido) > 7.0, f"ruido uniforme deberia acercarse a 8 bits"
    assert densidad_bordes(blanco) < 1e-6, "imagen uniforme no tiene bordes"
    assert densidad_bordes(tablero) > 0.5, "tablero debe tener muchos bordes"
    assert tono_dominante(blanco) == -1, "blanco es acromatico"
    assert tono_dominante(rojo) == 0, "rojo puro cae en el sector 0"
    assert abs(energia_central(blanco)) < 1e-6

    # coherencia RGB->HSV contra una referencia conocida
    hsv = rgb_a_hsv(rojo)
    assert abs(hsv[0, 0, 0] - 0.0) < 1e-6 and abs(hsv[0, 0, 2] - 1.0) < 1e-6

    # API de lote
    lote = np.stack([negro, blanco, rojo, ruido])
    cols = extraer_lote(lote, verbose=False)
    assert all(len(v) == 4 for v in cols.values())
    assert set(cols) == set(CARACTERISTICAS)

    print("OK: todas las pruebas de features.py pasaron")
    for nombre in CARACTERISTICAS:
        print(f"  {nombre:>16}: {np.round(cols[nombre], 3)}")


if __name__ == "__main__":
    _pruebas()
