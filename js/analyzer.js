/* =========================================================
   analyzer.js — Renderiza páginas con pdf.js y detecta
   dónde empieza y termina el contenido (márgenes reales).
   Desarrollado por Prof Kenfor Euceda
   ========================================================= */
(function () {
  'use strict';

  const PM = window.PM;

  /** Lado mayor (en píxeles) con el que se renderiza cada página. */
  const RENDER_LONG_SIDE = 1800;

  class Analyzer {
    /** @param {PDFDocumentProxy} pdf documento abierto con pdf.js */
    constructor(pdf) {
      this.pdf = pdf;
      this.numPages = pdf.numPages;
      this.info = [];     // índice 1..n → { page, width, height, transform, rotation }
      this.bounds = [];   // índice 1..n → { left, right, top, bottom } en puntos (vista) o null
      this.cache = new Map();
      this.maxCache = 6;
    }

    /** Datos geométricos de la página tal como se ve (con rotación y CropBox). */
    async pageInfo(n) {
      if (this.info[n]) return this.info[n];
      const page = await this.pdf.getPage(n);
      const vp = page.getViewport({ scale: 1 });
      this.info[n] = {
        page,
        width: vp.width,
        height: vp.height,
        transform: vp.transform.slice(), // usuario PDF → vista (y hacia abajo)
        rotation: vp.rotation
      };
      return this.info[n];
    }

    /** Renderiza la página a un canvas (con caché LRU). */
    async render(n) {
      if (this.cache.has(n)) {
        const c = this.cache.get(n);
        this.cache.delete(n);
        this.cache.set(n, c);
        return c;
      }
      const inf = await this.pageInfo(n);
      const scale = PM.clamp(RENDER_LONG_SIDE / Math.max(inf.width, inf.height), 0.5, 5);
      const vp = inf.page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(vp.width);
      canvas.height = Math.ceil(vp.height);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await inf.page.render({ canvasContext: ctx, viewport: vp }).promise;
      canvas.pmScale = scale;

      this.cache.set(n, canvas);
      while (this.cache.size > this.maxCache) {
        this.cache.delete(this.cache.keys().next().value);
      }
      return canvas;
    }

    /**
     * Busca el rectángulo que contiene todos los píxeles "no blancos".
     * Devuelve el resultado en puntos PDF, en coordenadas de la vista.
     */
    detect(canvas, threshold) {
      const w = canvas.width;
      const h = canvas.height;
      const data = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
      let minX = w, maxX = -1, minY = h, maxY = -1;

      for (let y = 0; y < h; y++) {
        const row = y * w * 4;
        let rowHas = false;
        for (let x = 0; x < w; x++) {
          const p = row + x * 4;
          if (data[p] < threshold || data[p + 1] < threshold || data[p + 2] < threshold) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            rowHas = true;
          }
        }
        if (rowHas) {
          if (y < minY) minY = y;
          maxY = y;
        }
      }
      if (maxX < 0) return null; // página en blanco

      const s = canvas.pmScale;
      return { left: minX / s, right: (maxX + 1) / s, top: minY / s, bottom: (maxY + 1) / s };
    }

    /** Analiza todas las páginas. */
    async analyzeAll(threshold, onProgress) {
      for (let n = 1; n <= this.numPages; n++) {
        const canvas = await this.render(n);
        this.bounds[n] = this.detect(canvas, threshold);
        if (onProgress) onProgress(n, this.numPages);
      }
    }
  }

  PM.Analyzer = Analyzer;
})();
