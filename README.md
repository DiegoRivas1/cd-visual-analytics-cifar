# cd-visual-analytics-cifar

Análisis exploratorio de datasets de imágenes como base para una herramienta de
Visual Analytics inspirada en **DendroMap** (Bertucci et al., 2023).

**Paper base:** DendroMap: Visual Exploration of Large-Scale Image Datasets for
Machine Learning with Treemaps — IEEE TVCG 29(1), 2023.
**Demo de referencia:** https://div-lab.github.io/dendromap/

## Idea

DendroMap muestra **dónde** están los grupos de un dataset de imágenes.
Este proyecto investiga **por qué** se forman, añadiendo características visuales
cuantificables (brillo, contraste, saturación, entropía, bordes, fondo) a la
estructura de clustering jerárquico.

## Estructura

```
cd-visual-analytics-cifar/
├── data/
│   ├── raw/          # CIFAR-10/100 y CIFAR-10H (no versionados)
│   └── processed/    # caché: features, embeddings, dendrograma
├── notebooks/
│   └── 01_eda_cifar.ipynb
├── src/
│   └── features.py   # extracción de características (probable en aislamiento)
├── report/
│   ├── informe.tex
│   └── figures/      # figuras generadas por el notebook
└── web/              # (etapa 2) herramienta D3.js
```

## Uso

```bash
# 1. Entorno virtual
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# 2. Dependencias base
python -m pip install --upgrade pip
pip install -r requirements.txt

# 3. PyTorch con CUDA 12.8 (RTX 3060) — índice aparte
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128

# 4. Verificar que la GPU se ve
python -c "import torch; print(torch.__version__, torch.cuda.is_available(), torch.cuda.get_device_name(0))"

# 5. Pruebas del módulo de características en aislamiento
python -m src.features

# 6. Registrar el venv como kernel de Jupyter
python -m ipykernel install --user --name cd-va-cifar --display-name "Python (cd-va-cifar)"

# 7. Abrir el notebook
jupyter lab notebooks\01_eda_cifar.ipynb
```

El notebook descarga los datasets automáticamente a `data/raw/`.

## Datos

| Dataset | Origen | Uso |
|---|---|---|
| CIFAR-10 | https://www.cs.toronto.edu/~kriz/cifar.html | principal |
| CIFAR-100 | idem | validación con mayor diversidad de clases |
| CIFAR-10H | https://github.com/jcpeterson/cifar-10h | cruce externo: ambigüedad humana |

Ninguno se versiona en Git.

## Informe

```bash
cd report && pdflatex informe.tex && pdflatex informe.tex
```
