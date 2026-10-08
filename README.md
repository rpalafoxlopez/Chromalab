# ChromaLab 3D

Explorador de color en 3D con constructor de paletas, verificador de contraste WCAG, librería de paletas y generador de prompts para diseño con IA.

## Secciones

- **Explorer**: esfera de color 3D (Three.js).
- **Palettes**: constructor de paletas y exportación a JSON.
- **Contrast**: ratio de contraste y niveles AA/AAA.
- **Library**: paletas predefinidas.
- **Prompt**: "Crea tu Prompt", genera un prompt para diseño con IA a partir de tipo de pieza, tema, 3 a 4 colores y colores prohibidos.

## Estructura

```
index.html
css/styles.css
js/app.js
```

## Uso

No requiere build. Abre `index.html` en el navegador o publícalo con GitHub Pages (Settings > Pages > rama `main`, carpeta `/root`).

Depende de CDNs (Tailwind, Google Fonts, Three.js r128), por lo que necesita conexión a internet.
