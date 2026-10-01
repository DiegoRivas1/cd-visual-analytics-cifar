# cd-visual-analytics-cifar

Análisis exploratorio de datasets de imágenes como base para una herramienta de
Visual Analytics inspirada en **DendroMap** (Bertucci et al., 2023).

**Paper base:** DendroMap: Visual Exploration of Large-Scale Image Datasets for
Machine Learning with Treemaps IEEE TVCG 29(1), 2023.
**Demo de referencia:** https://div-lab.github.io/dendromap/

## Idea

DendroMap muestra **dónde** están los grupos de un dataset de imágenes.
Este proyecto investiga **por qué** se forman, añadiendo ocho características
visuales cuantificables (brillo, contraste, saturación, entropía, densidad de
bordes, tono dominante, uniformidad de fondo, energía central) a la estructura
de clustering jerárquico, y lo complementa con un cruce externo (CIFAR-10H)
para estudiar la ambigüedad humana. El resultado alimenta una aplicación web
(`web/`) que reproduce el treemap zoomable de DendroMap y le agrega un panel
de características — el aporte diferencial del proyecto.

## Estructura

```
cd-visual-analytics-cifar/
├── data/
│   ├── raw/          # CIFAR-10/100 y CIFAR-10H (no versionados)
│   └── processed/    # caché: features, embeddings, dendrograma
├── notebooks/
│   └── 01_eda_cifar.ipynb
├── src/
│   ├── features.py    # extracción de características visuales (probable en aislamiento)
│   └── export_web.py  # exporta dendrograma + sprite + metadatos para web/
├── report/
│   ├── informe.tex
│   └── figures/        # figuras generadas por el notebook
└── web/                 # aplicación de Visual Analytics (D3.js)
    ├── index.html
    ├── css/estilos.css
    ├── js/
    │   ├── layout.js               # algoritmo de treemap, sin D3 — probable en aislamiento
    │   ├── layout.test.js          # pruebas de layout.js (node layout.test.js)
    │   ├── treemap.js               # vista jerárquica zoomable (usa D3 + layout.js)
    │   ├── panel_caracteristicas.js # histogramas del cluster seleccionado vs. global
    │   ├── filtros.js               # sliders de rango por característica
    │   ├── enlace.js                # estado compartido (brushing and linking)
    │   └── main.js                  # orquestación: carga datos y arma la app
    └── data/            # generado por src/export_web.py — no versionado
        ├── dendrograma.json
        ├── metadatos.json
        └── sprites/atlas.png
```

## Uso análisis en Python

Entorno virtual recomendado (ver notas de CUDA más abajo si usás GPU):

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt

# PyTorch con CUDA (ajustar cu128 a tu versión de CUDA si corresponde)
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128

python -m src.features     # pruebas del módulo de características, en aislamiento
python -m src.export_web   # pruebas del exportador web, con datos sintéticos

python -m ipykernel install --user --name cd-va-cifar --display-name "Python (cd-va-cifar)"
jupyter lab notebooks/01_eda_cifar.ipynb
```

Abrí el notebook con el kernel **"Python (cd-va-cifar)"**. El notebook descarga
los datasets automáticamente a `data/raw/` si no los encuentra, y cachea los
pasos costosos (características, embeddings, dendrograma) en `data/processed/`.

## Uso de aplicación web

La última celda del notebook (Sección 15) exporta `web/data/*`. Una vez
generados esos archivos:

```bash
cd web
python -m http.server 8000
# abrir http://localhost:8000
```

No abras `index.html` directamente haciendo doble clic `fetch()` no funciona
sobre `file://`, necesita un servidor, aunque sea local.

Controles de la interfaz: slider de **k** (nivel de abstracción del treemap,
igual que en DendroMap), tamaño de miniatura, filtros por rango por cada una de
las 8 características, y click en un cluster para hacer zoom al seleccionar
uno, el panel de la derecha compara su perfil de características contra la
distribución global del dataset.

## Datos

| Dataset | Origen | Uso |
|---|---|---|
| CIFAR-10 | https://www.cs.toronto.edu/~kriz/cifar.html | principal |
| CIFAR-100 | idem | validación con mayor diversidad de clases |
| CIFAR-10H | https://github.com/jcpeterson/cifar-10h | cruce externo: ambigüedad humana |

Ninguno se versiona en Git (carpeta `data/`), ni los artefactos generados para
la web (`web/data/`).

## Informe

```bash
cd report && pdflatex informe.tex && pdflatex informe.tex
```
