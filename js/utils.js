/* =========================================================
   utils.js — Utilidades generales (unidades, formato, DOM)
   Desarrollado por Prof Kenfor Euceda
   ========================================================= */
(function () {
  'use strict';

  const PM = (window.PM = window.PM || {});

  /** 1 punto PDF = 1/72 de pulgada. */
  PM.UNITS = {
    mm: { pt: 72 / 25.4, dec: 1, steps: [0.1, 0.5, 1, 5], defStep: 0.5, label: 'mm' },
    cm: { pt: 72 / 2.54, dec: 2, steps: [0.01, 0.05, 0.1, 0.5], defStep: 0.05, label: 'cm' },
    in: { pt: 72, dec: 3, steps: [0.01, 0.025, 0.05, 0.25], defStep: 0.025, label: 'in' },
    pt: { pt: 1, dec: 1, steps: [0.5, 1, 5, 10], defStep: 1, label: 'pt' }
  };

  PM.toPt = (value, unit) => value * PM.UNITS[unit].pt;
  PM.fromPt = (pt, unit) => pt / PM.UNITS[unit].pt;

  PM.round = (value, unit) => {
    const f = Math.pow(10, PM.UNITS[unit].dec);
    return Math.round(value * f) / f;
  };

  PM.fmt = (pt, unit, withUnit = true) => {
    const v = PM.fromPt(pt, unit);
    const s = v.toFixed(PM.UNITS[unit].dec);
    return withUnit ? `${s} ${PM.UNITS[unit].label}` : s;
  };

  PM.fmtSigned = (pt, unit) => {
    const v = PM.fromPt(pt, unit);
    const s = Math.abs(v).toFixed(PM.UNITS[unit].dec);
    const sign = v > 0.0001 ? '+' : v < -0.0001 ? '−' : '';
    return `${sign}${s} ${PM.UNITS[unit].label}`;
  };

  PM.clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  PM.$ = (sel) => document.querySelector(sel);
  PM.$$ = (sel) => Array.from(document.querySelectorAll(sel));

  PM.debounce = (fn, ms) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  };

  /** Nombre del tamaño de papel (tolerancia ±3 pt, cualquier orientación). */
  PM.paperName = (w, h) => {
    const sizes = [
      ['Carta', 612, 792],
      ['Oficio / Legal', 612, 1008],
      ['A4', 595.28, 841.89],
      ['A3', 841.89, 1190.55],
      ['A5', 419.53, 595.28],
      ['Media carta', 396, 612],
      ['Tabloide', 792, 1224]
    ];
    for (const [name, a, b] of sizes) {
      if ((Math.abs(w - a) < 3 && Math.abs(h - b) < 3) || (Math.abs(w - b) < 3 && Math.abs(h - a) < 3)) {
        return name + (w > h ? ' (horizontal)' : '');
      }
    }
    return 'Personalizado';
  };

  PM.downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };
})();
