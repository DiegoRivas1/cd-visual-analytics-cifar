"""
Exportador de datos para la aplicación web (D3.js).

Convierte lo que ya existe en el notebook (matriz de linkage Z, submuestra
`dsub`, imágenes originales) en tres artefactos que consume `web/`:

  1. web/data/dendrograma.json  — árbol binario completo (formato anidado),
     para que el treemap pueda hacer zoom a cualquier nivel k, tal como
     describe el paper de DendroMap (Sección 4.2).
  2. web/data/metadatos.json    — un registro por imagen de la submuestra,
     con sus características visuales y su posición en el sprite.
  3. web/data/sprites/atlas.png — todas las miniaturas en una sola imagen
     (atlas), para no hacer miles de peticiones HTTP individuales.

Diseñado para probarse en aislamiento con datos sintéticos antes de
ejecutarse sobre las 10 000 imágenes reales:

    python -m src.export_web          # corre las pruebas con datos falsos

Desde el notebook se usa así (ver notebooks/01_eda_cifar.ipynb, Sección 13):

    from src import export_web
    export_web.exportar_todo(Z, dsub, IMAGENES, IDX_SUB, RUTA_WEB_DATA)
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np

try:
    from PIL import Image
except ImportError:  # Pillow es requisito nuevo; se valida en requirements.txt
    Image = None

VARS_NUM = [
    "brillo", "contraste", "saturacion", "entropia",
    "densidad_bordes", "unif_fondo", "energia_central",
]


# --------------------------------------------------------------------------
# 1. Árbol del dendrograma -> JSON anidado
# --------------------------------------------------------------------------

def construir_arbol(Z: np.ndarray, registros: list[dict]) -> dict:
    """
    Convierte una matriz de linkage de scipy (formato estándar: cada fila
    es [idx_hijo_izq, idx_hijo_der, distancia, num_hojas_bajo_este_nodo])
    en un árbol binario anidado, listo para volcar a JSON.

    `registros[i]` debe traer los campos de la hoja i (img_id, clase y las
    VARS_NUM), en el mismo orden que las filas usadas para construir Z.
    """
    n_hojas = len(registros)
    if Z.shape[0] != n_hojas - 1:
        raise ValueError(
            f"Z tiene {Z.shape[0]} fusiones pero se esperaban {n_hojas - 1} "
            f"para {n_hojas} hojas. ¿Z y `registros` no corresponden al mismo conjunto?"
        )

    nodos: dict[int, dict] = {}
    for i, reg in enumerate(registros):
        nodos[i] = {"id": int(i), "hoja": True, "n": 1, **reg}

    for i in range(Z.shape[0]):
        a, b, dist, _cnt = Z[i]
        a, b = int(a), int(b)
        if a not in nodos or b not in nodos:
            raise KeyError(
                f"Fusión {i} referencia el nodo {a} o {b}, que ya fue consumido. "
                f"¿Z tiene índices repetidos o fuera de orden?"
            )
        izq, der = nodos.pop(a), nodos.pop(b)
        nid = n_hojas + i
        nodos[nid] = {
            "id": int(nid),
            "hoja": False,
            "n": izq["n"] + der["n"],
            "dist": float(dist),
            "izq": izq,
            "der": der,
        }

    if len(nodos) != 1:
        raise ValueError(
            f"Tras procesar todas las fusiones quedaron {len(nodos)} raíces "
            "sueltas; se esperaba exactamente 1. Revisa que Z sea una matriz "
            "de linkage válida y completa."
        )
    (raiz,) = nodos.values()
    return raiz


# --------------------------------------------------------------------------
# 2. Sprite atlas
# --------------------------------------------------------------------------

def construir_sprite(imagenes: np.ndarray, lado: int = 32) -> tuple["Image.Image", list[dict]]:
    """
    Empaqueta un arreglo (N, H, W, 3) uint8 en una sola imagen cuadrícula.
    Devuelve la imagen PIL y, por cada entrada, su posición {col, fila,
    x_px, y_px} dentro del atlas, para usar con CSS background-position
    en el navegador.
    """
    if Image is None:
        raise ImportError("Pillow no está instalado. Agrega 'Pillow>=10.0' a requirements.txt")

    n = len(imagenes)
    lado_grid = math.ceil(math.sqrt(n))
    atlas = Image.new("RGB", (lado_grid * lado, lado_grid * lado))

    posiciones = []
    for i, img in enumerate(imagenes):
        col, fila = i % lado_grid, i // lado_grid
        tile = Image.fromarray(img.astype(np.uint8))
        if tile.size != (lado, lado):
            tile = tile.resize((lado, lado))
        atlas.paste(tile, (col * lado, fila * lado))
        posiciones.append({
            "col": col, "fila": fila,
            "x_px": col * lado, "y_px": fila * lado,
        })
    return atlas, posiciones


# --------------------------------------------------------------------------
# 3. Metadatos por imagen
# --------------------------------------------------------------------------

def construir_metadatos(dsub, posiciones_sprite: list[dict], lado: int) -> list[dict]:
    """
    `dsub` es el DataFrame de la submuestra (debe traer img_id, clase,
    cluster_k8, cluster_k18 y las VARS_NUM). El orden de las filas debe
    coincidir con `posiciones_sprite` (mismo orden usado en construir_sprite).
    """
    if len(dsub) != len(posiciones_sprite):
        raise ValueError(
            f"dsub tiene {len(dsub)} filas pero posiciones_sprite tiene "
            f"{len(posiciones_sprite)}. Deben construirse sobre el mismo orden."
        )
    registros = []
    cols_dsub = set(dsub.columns)
    for i, (_, fila) in enumerate(dsub.iterrows()):
        reg = {
            "img_id": int(fila["img_id"]),
            "clase": str(fila["clase"]),
            "sprite": posiciones_sprite[i],
        }
        for v in VARS_NUM:
            reg[v] = round(float(fila[v]), 4)
        for extra in ("cluster_k8", "cluster_k18", "entropia_humana", "consenso"):
            if extra in cols_dsub and pd_notna(fila.get(extra)):
                reg[extra] = round(float(fila[extra]), 4) if extra != "cluster_k8" and extra != "cluster_k18" else int(fila[extra])
        registros.append(reg)
    return {"lado_miniatura": lado, "registros": registros}


def pd_notna(x):
    """Evita importar pandas solo para esta comprobación."""
    try:
        return x == x and x is not None  # NaN != NaN
    except Exception:
        return x is not None


# --------------------------------------------------------------------------
# 4. Orquestador
# --------------------------------------------------------------------------

def exportar_todo(Z, dsub, imagenes_submuestra, ruta_salida, lado_miniatura: int = 32,
                   nombre_dendrograma: str = "dendrograma.json",
                   nombre_metadatos: str = "metadatos.json",
                   nombre_sprite: str = "sprites/atlas.png") -> None:
    """
    Genera los tres artefactos en `ruta_salida` (normalmente web/data/).

    `imagenes_submuestra` debe ser el arreglo (N, 32, 32, 3) correspondiente,
    en el mismo orden de filas que `dsub` y que las hojas usadas para
    construir `Z` (típicamente IMAGENES[IDX_SUB] en el notebook).
    """
    ruta_salida = Path(ruta_salida)
    (ruta_salida / "sprites").mkdir(parents=True, exist_ok=True)

    # El sprite se construye PRIMERO: el árbol del dendrograma necesita la
    # posición {x_px, y_px} de cada hoja para que treemap.js pueda recortar
    # la miniatura correcta directamente del atlas, sin tener que cruzar con
    # metadatos.json en tiempo de ejecución.
    print("construyendo sprite atlas...")
    atlas, posiciones = construir_sprite(imagenes_submuestra, lado=lado_miniatura)
    atlas.save(ruta_salida / nombre_sprite, optimize=True)
    print(f"  guardado: {ruta_salida / nombre_sprite}  ({atlas.size[0]}x{atlas.size[1]} px)")

    if len(posiciones) != len(dsub):
        raise ValueError(
            f"imagenes_submuestra tiene {len(posiciones)} imágenes pero dsub "
            f"tiene {len(dsub)} filas. Deben venir en el mismo orden y longitud "
            "(típicamente IMAGENES[IDX_SUB] y dsub)."
        )

    registros_hoja = []
    for i, (_, fila) in enumerate(dsub.iterrows()):
        reg = {
            "img_id": int(fila["img_id"]), "clase": str(fila["clase"]),
            "sprite": posiciones[i],
        }
        for v in VARS_NUM:
            reg[v] = round(float(fila[v]), 4)
        registros_hoja.append(reg)

    print("construyendo árbol del dendrograma...")
    arbol = construir_arbol(Z, registros_hoja)
    with open(ruta_salida / nombre_dendrograma, "w", encoding="utf-8") as f:
        json.dump(arbol, f)
    print(f"  guardado: {ruta_salida / nombre_dendrograma}")

    print("construyendo metadatos...")
    metadatos = construir_metadatos(dsub, posiciones, lado_miniatura)
    with open(ruta_salida / nombre_metadatos, "w", encoding="utf-8") as f:
        json.dump(metadatos, f)
    print(f"  guardado: {ruta_salida / nombre_metadatos}")

    print("listo.")


# --------------------------------------------------------------------------
# Pruebas en aislamiento, con datos sintéticos (sin CIFAR, sin GPU)
# --------------------------------------------------------------------------

def _pruebas() -> None:
    import pandas as pd
    from scipy.cluster.hierarchy import linkage

    rng = np.random.default_rng(42)
    n = 20
    emb = rng.normal(size=(n, 4))
    Z = linkage(emb, method="ward")

    dsub = pd.DataFrame({
        "img_id": np.arange(n),
        "clase": rng.choice(["gato", "perro", "ave"], size=n),
        "cluster_k8": rng.integers(0, 8, size=n),
        "cluster_k18": rng.integers(0, 18, size=n),
    })
    for v in VARS_NUM:
        dsub[v] = rng.random(n)

    # --- construir_arbol ---
    arbol = construir_arbol(Z, dsub[["img_id", "clase"] + VARS_NUM].to_dict("records"))
    assert arbol["n"] == n, "la raíz debe contener todas las hojas"
    assert arbol["hoja"] is False, "la raíz no debe ser una hoja (salvo n=1)"

    def contar_hojas(nodo):
        if nodo["hoja"]:
            return 1
        return contar_hojas(nodo["izq"]) + contar_hojas(nodo["der"])
    assert contar_hojas(arbol) == n, "el número de hojas del árbol debe coincidir con n"

    # el árbol debe ser serializable a JSON sin errores
    texto = json.dumps(arbol)
    assert len(texto) > 0

    # Z mal formada debe fallar con un mensaje claro, no un traceback oscuro
    try:
        construir_arbol(Z[:-1], dsub[["img_id", "clase"] + VARS_NUM].to_dict("records"))
        raise AssertionError("debía fallar con Z truncada")
    except ValueError:
        pass

    # --- construir_sprite ---
    if Image is not None:
        imgs = rng.integers(0, 256, size=(n, 32, 32, 3), dtype=np.uint8)
        atlas, posiciones = construir_sprite(imgs, lado=32)
        assert len(posiciones) == n
        lado_grid = math.ceil(math.sqrt(n))
        assert atlas.size == (lado_grid * 32, lado_grid * 32)
        assert posiciones[0] == {"col": 0, "fila": 0, "x_px": 0, "y_px": 0}

        # --- construir_metadatos ---
        meta = construir_metadatos(dsub, posiciones, lado=32)
        assert meta["lado_miniatura"] == 32
        assert len(meta["registros"]) == n
        assert "sprite" in meta["registros"][0]
        assert "cluster_k8" in meta["registros"][0]

        # longitudes desalineadas deben fallar explícitamente
        try:
            construir_metadatos(dsub, posiciones[:-1], lado=32)
            raise AssertionError("debía fallar con listas de longitud distinta")
        except ValueError:
            pass

        # --- exportar_todo de punta a punta: la regresión que motivó esto ---
        # (bug real: las hojas del árbol llegaban SIN "sprite", por lo que el
        # treemap mostraba siempre la misma miniatura — la del índice 0 — en
        # todos los clusters. Esta prueba falla si eso vuelve a pasar.)
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            exportar_todo(Z, dsub, imgs, tmp, lado_miniatura=32)
            with open(Path(tmp) / "dendrograma.json") as f:
                arbol_exportado = json.load(f)

            def hojas(nodo):
                if nodo["hoja"]:
                    return [nodo]
                return hojas(nodo["izq"]) + hojas(nodo["der"])

            todas_hojas = hojas(arbol_exportado)
            assert len(todas_hojas) == n, "el árbol exportado debe tener n hojas"
            for h in todas_hojas:
                assert "sprite" in h, (
                    "REGRESIÓN: una hoja del árbol no tiene 'sprite' — el "
                    "treemap mostraría la miniatura equivocada (o siempre la "
                    "misma) para esta imagen"
                )
                assert "x_px" in h["sprite"] and "y_px" in h["sprite"]

            # las posiciones de sprite entre las hojas deben ser casi todas
            # distintas (no todas 0,0 — que sería exactamente el bug original)
            posiciones_unicas = {(h["sprite"]["x_px"], h["sprite"]["y_px"]) for h in todas_hojas}
            assert len(posiciones_unicas) == n, (
                "REGRESIÓN: todas las hojas comparten la(s) misma(s) posición(es) "
                "de sprite — señal de que 'sprite' nunca se asignó por imagen"
            )

        print("OK: todas las pruebas de export_web.py pasaron (incluye sprite + regresión de posiciones)")
    else:
        print("OK: pruebas de export_web.py pasaron (Pillow no instalado, se omitió sprite)")


if __name__ == "__main__":
    _pruebas()