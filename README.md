# Ajustador de Márgenes PDF

Aplicación web para **ajustar los márgenes laterales (izquierdo y derecho)** de documentos PDF,
con vista previa en tiempo real, **sin perder ni distorsionar** texto, tablas ni códigos de barras.

Desarrollado por **Prof Kenfor Euceda**.

---

## Características

- Vista previa de cada página con guías y cotas de los márgenes.
- Botones **−** / **+** (mantener presionado para repetir), control deslizante y campo numérico.
- Unidades: mm, cm, pulgadas y puntos.
- Métricas en vivo: margen original → nuevo, ancho del contenido, desplazamiento, escala, márgenes superior e inferior.
- Botón **Ver original** para comparar el antes y el después.
- Dos modos:
  - **Márgenes independientes** (predeterminado): cada margen se ajusta por separado; al cambiar uno, el otro no se mueve.
    El contenido se adapta con una escala **proporcional** (igual en ancho y alto), sin deformarse.
  - **Mover el bloque (100 %)**: el contenido conserva su tamaño exacto y solo se desplaza; los márgenes quedan enlazados.
- Aplicar **igual en todo el documento** o **según el contenido de cada página**.
- Soporta páginas giradas y de distintos tamaños (Carta, Oficio, A4, etc.).
- Todo se procesa **en el navegador**: el PDF nunca se sube a ningún servidor.

## ¿Por qué no se pierde ni se deforma nada?

El PDF **no se convierte a imagen**. La aplicación envuelve el contenido original de cada página en una
instrucción de posición del propio formato PDF (`q … cm … Q`). Así:

- Textos, fuentes, tablas, imágenes y **códigos de barras** quedan exactamente igual, solo en otra posición.
- El texto sigue siendo seleccionable y buscable.
- Los enlaces y campos de formulario se mueven junto con el contenido.
- Si algún elemento fuera a quedar fuera de la hoja, la descarga **se bloquea** y se indica la página.

## Estructura

```
pdf-margenes/
├── index.html            Interfaz
├── css/
│   └── styles.css        Estilos
└── js/
    ├── utils.js          Unidades, formato y utilidades
    ├── analyzer.js       Renderiza páginas y detecta los márgenes reales del contenido
    ├── margin-engine.js  Calcula el desplazamiento / escala de cada página
    ├── preview.js        Dibuja la vista previa con guías y medidas
    ├── exporter.js       Genera el PDF final (pdf-lib)
    └── app.js            Controlador de la interfaz
```

Librerías (cargadas desde CDN, no requieren instalación):
- [pdf.js](https://mozilla.github.io/pdf.js/) 3.11.174: vista previa y detección del contenido.
- [pdf-lib](https://pdf-lib.js.org/) 1.17.1: modificación del PDF.

## Publicar en GitHub Pages

1. Cree un repositorio nuevo en GitHub (por ejemplo `ajustador-margenes-pdf`).
2. Suba **todo el contenido** de esta carpeta (`index.html`, `css/`, `js/`, `README.md`) a la raíz del repositorio.
3. En el repositorio vaya a **Settings → Pages**.
4. En *Build and deployment*, elija **Deploy from a branch**, rama `main` y carpeta `/ (root)`. Guarde.
5. En uno o dos minutos la aplicación estará disponible en
   `https://SU-USUARIO.github.io/ajustador-margenes-pdf/`.

También puede abrir `index.html` directamente en el navegador (necesita Internet para cargar las librerías).

## Uso

1. Pulse **Abrir PDF** o arrastre el archivo al visor.
2. Ajuste el **margen izquierdo** y/o el **margen derecho**; la vista previa se actualiza al instante.
3. Revise las **métricas** (incluida la escala del contenido) y el **estado** (verde = todo dentro de la hoja).
4. Pulse **Descargar PDF ajustado**. Se descarga como `nombre_margenes.pdf`.

### Consejos

- En **Márgenes independientes**, si el contenido se reduce más del 15 %, la aplicación lo advierte para que verifique la lectura de los códigos de barras.
- Si necesita el contenido exactamente al 100 %, use **Mover el bloque**.
- Si un elemento muy claro (marca de agua, fondo gris suave) no se detecta como contenido, suba la **sensibilidad de detección**.
- Los PDF protegidos con contraseña deben desprotegerse antes de usarlos.

---

Desarrollado por **Prof Kenfor Euceda**
