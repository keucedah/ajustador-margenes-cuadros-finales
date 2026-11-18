/* =========================================================
   preview.js — Dibuja la vista previa en tiempo real con las
   guías y cotas de los márgenes.
   Desarrollado por Prof Kenfor Euceda
   ========================================================= */
(function () {
  'use strict';

  const PM = window.PM;
  const PAD_X = 24;     // espacio lateral alrededor de la hoja (px CSS)
  const PAD_TOP = 46;   // espacio para las cotas superiores
  const PAD_BOTTOM = 24;

  class Preview {
    constructor(canvas, container) {
      this.canvas = canvas;
      this.container = container;
      this.ctx = canvas.getContext('2d');
    }

    /**
     * @param {object} o
     *  src: canvas renderizado de la página original
     *  t: resultado de Engine.compute
     *  showOriginal, unit, zoom ('fit' | 'width')
     */
    draw(o) {
      const { src, t, unit } = o;
      const W = t.width, H = t.height;
      const dpr = window.devicePixelRatio || 1;

      // --- Tamaño de visualización ---
      const availW = Math.max(200, this.container.clientWidth - 2 * PAD_X - 4);
      const availH = Math.max(200, this.container.clientHeight - PAD_TOP - PAD_BOTTOM - 4);
      let d = availW / W; // px CSS por punto
      if (o.zoom === 'fit') d = Math.min(d, availH / H);

      const cssW = Math.round(W * d + 2 * PAD_X);
      const cssH = Math.round(H * d + PAD_TOP + PAD_BOTTOM);
      if (this.canvas.width !== Math.round(cssW * dpr) || this.canvas.height !== Math.round(cssH * dpr)) {
        this.canvas.width = Math.round(cssW * dpr);
        this.canvas.height = Math.round(cssH * dpr);
        this.canvas.style.width = cssW + 'px';
        this.canvas.style.height = cssH + 'px';
      }

      const ctx = this.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      // Coordenadas: 1 unidad = 1 punto PDF, origen en la esquina superior izquierda de la hoja
      const toPage = () => ctx.setTransform(dpr * d, 0, 0, dpr * d, dpr * PAD_X, dpr * PAD_TOP);
      toPage();

      // Hoja con sombra
      ctx.save();
      ctx.shadowColor = 'rgba(20,33,61,.28)';
      ctx.shadowBlur = 14 / d;
      ctx.shadowOffsetY = 3 / d;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();

      const s = o.showOriginal ? 1 : t.s;
      const tx = o.showOriginal ? 0 : t.tx;
      const ty = o.showOriginal ? 0 : t.ty;

      // Contenido (recortado a la hoja: lo que salga, se ve cortado igual que en el PDF)
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.clip();
      ctx.translate(tx, ty);
      ctx.scale(s, s);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(src, 0, 0, src.width, src.height, 0, 0, src.width / src.pmScale, src.height / src.pmScale);
      ctx.restore();

      if (t.blank) {
        this._label(ctx, W / 2, H / 2, 'Página en blanco (no se modifica)', '#64708a', d, 'center');
        return;
      }

      // Bordes del contenido en la vista mostrada
      const L = o.showOriginal ? t.origLeft : t.newLeft;
      const R = o.showOriginal ? t.origRight : t.newRight;
      const xL = L;
      const xR = W - R;
      const yT = o.showOriginal ? t.origTopY : t.newTop;
      const yB = o.showOriginal ? t.origBottomY : H - t.newBottom;

      const LEFT = '#1f5eff', RIGHT = '#e8590c', ERR = '#c0262d';

      // Zonas de margen sombreadas
      ctx.fillStyle = 'rgba(31,94,255,0.07)';
      if (xL > 0) ctx.fillRect(0, 0, Math.min(xL, W), H);
      ctx.fillStyle = 'rgba(232,89,12,0.07)';
      if (xR < W) ctx.fillRect(Math.max(xR, 0), 0, W - Math.max(xR, 0), H);

      // Zonas desbordadas
      if (!o.showOriginal && t.overflow) {
        ctx.fillStyle = 'rgba(192,38,45,0.18)';
        if (xL < 0) ctx.fillRect(0, 0, 6 / d, H);
        if (xR > W) ctx.fillRect(W - 6 / d, 0, 6 / d, H);
        if (yT < 0) ctx.fillRect(0, 0, W, 6 / d);
        if (yB > H) ctx.fillRect(0, H - 6 / d, W, 6 / d);
      }

      // Caja del contenido (punteada)
      ctx.save();
      ctx.lineWidth = 1 / d;
      ctx.setLineDash([3 / d, 3 / d]);
      ctx.strokeStyle = 'rgba(28,36,48,0.35)';
      ctx.strokeRect(xL, yT, xR - xL, yB - yT);
      ctx.restore();

      // Líneas guía verticales
      this._vline(ctx, xL, H, L < -0.5 ? ERR : LEFT, d);
      this._vline(ctx, xR, H, R < -0.5 ? ERR : RIGHT, d);

      // Cotas (flechas) arriba de la hoja
      const yDim = -22 / d;
      this._dimension(ctx, 0, xL, yDim, PM.fmt(L, unit), L < -0.5 ? ERR : LEFT, d, W);
      this._dimension(ctx, xR, W, yDim, PM.fmt(R, unit), R < -0.5 ? ERR : RIGHT, d, W);

      // Ancho del contenido
      const cw = xR - xL;
      if (cw * d > 120) {
        this._dimension(ctx, xL, xR, -8 / d, 'contenido ' + PM.fmt(cw, unit), '#64708a', d, W, true);
      }
    }

    _vline(ctx, x, H, color, d) {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5 / d;
      ctx.setLineDash([6 / d, 4 / d]);
      ctx.beginPath();
      ctx.moveTo(x, -30 / d);
      ctx.lineTo(x, H + 10 / d);
      ctx.stroke();
      ctx.restore();
    }

    _dimension(ctx, x1, x2, y, text, color, d, W, subtle) {
      const a = Math.min(x1, x2), b = Math.max(x1, x2);
      const len = (b - a) * d;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = (subtle ? 1 : 1.4) / d;
      if (len > 2) {
        ctx.beginPath();
        ctx.moveTo(a, y);
        ctx.lineTo(b, y);
        ctx.stroke();
        if (len > 14) {
          const ah = 5 / d;
          ctx.beginPath();
          ctx.moveTo(a, y); ctx.lineTo(a + ah, y - ah * 0.6); ctx.lineTo(a + ah, y + ah * 0.6); ctx.closePath();
          ctx.moveTo(b, y); ctx.lineTo(b - ah, y - ah * 0.6); ctx.lineTo(b - ah, y + ah * 0.6); ctx.closePath();
          ctx.fill();
        }
      }
      ctx.restore();

      // Etiqueta
      ctx.save();
      ctx.font = `${(subtle ? 11 : 12.5) / d}px "Segoe UI", system-ui, sans-serif`;
      const tw = ctx.measureText(text).width;
      let cx = (a + b) / 2;
      const half = tw / 2 + 6 / d;
      cx = PM.clamp(cx, -16 / d + half, W + 16 / d - half);
      const ly = y - (subtle ? 0 : 0);
      ctx.fillStyle = subtle ? 'rgba(255,255,255,0.92)' : '#fff';
      const bh = (subtle ? 15 : 18) / d;
      this._roundRect(ctx, cx - half, ly - bh / 2, half * 2, bh, 4 / d);
      ctx.fill();
      if (!subtle) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1 / d;
        ctx.stroke();
      }
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, cx, ly + 0.5 / d);
      ctx.restore();
    }

    _label(ctx, x, y, text, color, d, align) {
      ctx.save();
      ctx.font = `${13 / d}px "Segoe UI", system-ui, sans-serif`;
      ctx.fillStyle = color;
      ctx.textAlign = align;
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x, y);
      ctx.restore();
    }

    _roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
  }

  PM.Preview = Preview;
})();
