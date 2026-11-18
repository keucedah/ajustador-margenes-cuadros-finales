/* =========================================================
   exporter.js — Genera el PDF final con pdf-lib.
   El contenido original de cada página se envuelve en una
   matriz de transformación (q … cm … Q). No se rasteriza ni se
   reescribe nada: textos, tablas, imágenes y códigos de barras
   quedan exactamente como estaban, solo cambia su posición.
   Desarrollado por Prof Kenfor Euceda
   ========================================================= */
(function () {
  'use strict';

  const PM = window.PM;

  /** Claves de anotaciones que contienen pares de coordenadas x,y. */
  const ANNOT_COORD_KEYS = ['Rect', 'QuadPoints', 'L', 'Vertices'];

  function transformAnnotations(doc, page, plan) {
    const { PDFName, PDFArray, PDFDict, PDFNumber } = PDFLib;
    const annots = page.node.Annots();
    if (!annots) return;
    for (let i = 0; i < annots.size(); i++) {
      const annot = annots.lookup(i);
      if (!(annot instanceof PDFDict)) continue;
      for (const key of ANNOT_COORD_KEYS) {
        const arr = annot.lookup(PDFName.of(key));
        if (!(arr instanceof PDFArray)) continue;
        const out = [];
        let ok = true;
        for (let k = 0; k < arr.size(); k++) {
          const num = arr.lookup(k);
          if (!(num instanceof PDFNumber)) { ok = false; break; }
          const v = num.asNumber();
          out.push(k % 2 === 0 ? plan.s * v + plan.ux : plan.s * v + plan.uy);
        }
        if (ok) annot.set(PDFName.of(key), doc.context.obj(out));
      }
    }
  }

  function transformContent(page, plan) {
    const { pushGraphicsState, popGraphicsState, concatTransformationMatrix } = PDFLib;
    page.node.normalize();
    page.getContentStream();
    const start = page.createContentStream(
      pushGraphicsState(),
      concatTransformationMatrix(plan.s, 0, 0, plan.s, plan.ux, plan.uy)
    );
    const end = page.createContentStream(popGraphicsState());
    page.node.wrapContentStreams(page.doc.context.register(start), page.doc.context.register(end));
  }

  PM.Exporter = {
    /**
     * @param {Uint8Array} bytes  PDF original
     * @param {Array} plans       índice 0..n-1 → { s, ux, uy, identity }
     */
    async exportPdf(bytes, plans, onProgress) {
      const { PDFDocument } = PDFLib;
      const doc = await PDFDocument.load(bytes, { updateMetadata: false });
      const pages = doc.getPages();
      for (let i = 0; i < pages.length; i++) {
        const plan = plans[i];
        if (plan && !plan.identity) {
          transformContent(pages[i], plan);
          transformAnnotations(doc, pages[i], plan);
        }
        if (onProgress) onProgress(i + 1, pages.length);
      }
      return doc.save({ useObjectStreams: true });
    }
  };
})();
