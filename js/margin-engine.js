/* =========================================================
   margin-engine.js — Calcula la transformación de cada página.
   Solo se usan traslación y escala UNIFORME (mismo factor en
   X y en Y), por lo que nada se deforma.
   Coordenadas de "vista": puntos PDF, origen arriba-izquierda,
   y hacia abajo (como se ve la página, ya girada).
   Desarrollado por Prof Kenfor Euceda
   ========================================================= */
(function () {
  'use strict';

  const PM = window.PM;
  const TOL = 0.5; // tolerancia en puntos (≈0.18 mm)

  const Engine = {
    /**
     * Transformación para que ESTA página tenga los márgenes pedidos.
     *   x' = s·x + tx     y' = s·y + ty
     */
    solve(inf, b, settings) {
      if (!b) return null;
      const W = inf.width;
      let s = 1, tx;
      if (settings.mode === 'fit') {
        const cw = b.right - b.left;
        const avail = W - settings.left - settings.right;
        s = cw > 0 ? Math.max(avail, 1) / cw : 1;
        tx = settings.left - s * b.left;
      } else {
        tx = settings.anchor === 'right'
          ? (W - settings.right) - b.right
          : settings.left - b.left;
      }
      return { s, tx };
    },

    /** Desplazamiento vertical que conserva el ancla elegida al escalar. */
    verticalOffset(b, s, settings) {
      const anchorY = settings.vAnchor === 'center' ? (b.top + b.bottom) / 2 : b.top;
      return anchorY * (1 - s);
    },

    /** Aplica (s, tx) a una página y calcula métricas y advertencias. */
    evaluate(inf, b, s, tx, settings) {
      const W = inf.width;
      const H = inf.height;
      if (!b) {
        return { s: 1, tx: 0, ty: 0, width: W, height: H, identity: true, blank: true, warnings: [], overflow: false, overflowSides: [] };
      }
      const ty = Math.abs(s - 1) < 1e-9 ? 0 : this.verticalOffset(b, s, settings);
      const res = {
        s, tx, ty,
        width: W,
        height: H,
        origLeft: b.left,
        origRight: W - b.right,
        origWidth: b.right - b.left,
        origTopY: b.top,
        origBottomY: b.bottom,
        newLeft: s * b.left + tx,
        newRight: W - (s * b.right + tx),
        newTop: s * b.top + ty,
        newBottom: H - (s * b.bottom + ty),
        newWidth: s * (b.right - b.left),
        identity: Math.abs(s - 1) < 1e-6 && Math.abs(tx) < 0.01 && Math.abs(ty) < 0.01,
        blank: false,
        warnings: [],
        overflowSides: []
      };
      if (res.newLeft < -TOL) res.overflowSides.push('izquierdo');
      if (res.newRight < -TOL) res.overflowSides.push('derecho');
      if (res.newTop < -TOL) res.overflowSides.push('superior');
      if (res.newBottom < -TOL) res.overflowSides.push('inferior');
      res.overflow = res.overflowSides.length > 0;

      if (Math.abs(s - 1) > 1e-4) {
        const pct = (s * 100).toFixed(1);
        res.warnings.push(s < 1
          ? `El contenido se reduce al ${pct} % (proporcional, sin deformar).`
          : `El contenido se amplía al ${pct} % (proporcional, sin deformar).`);
        if (s < 0.85) {
          res.warnings.push('Reducción mayor al 15 %: verifique que los códigos de barras sigan leyéndose con su lector.');
        }
      }
      return res;
    },

    /**
     * Convierte la transformación de vista al espacio de usuario del PDF.
     * La vista se relaciona con el usuario por V(p) = M·p + E (M ortogonal),
     * así que p' = s·p + U  con  U = Mᵀ·((s−1)·E + t).
     */
    toUserSpace(inf, t) {
      const [a, b, c, d, e, f] = inf.transform;
      const w1 = (t.s - 1) * e + t.tx;
      const w2 = (t.s - 1) * f + t.ty;
      return { s: t.s, ux: a * w1 + b * w2, uy: c * w1 + d * w2 };
    }
  };

  PM.Engine = Engine;
})();
