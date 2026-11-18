/* =========================================================
   app.js — Controlador principal de la interfaz.
   Desarrollado por Prof Kenfor Euceda
   ========================================================= */
(function () {
  'use strict';

  const PM = window.PM;
  const $ = PM.$;

  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  // ---------- Estado ----------
  const state = {
    fileName: '',
    bytes: null,        // bytes originales (para exportar)
    analyzer: null,
    page: 1,
    unit: 'mm',
    step: PM.UNITS.mm.defStep,
    left: 0,            // en puntos
    right: 0,           // en puntos
    anchor: 'left',     // último margen fijado por el usuario (modo desplazar)
    mode: 'shift',      // 'shift' | 'fit'
    vAnchor: 'top',
    reference: 'common',
    threshold: 240,
    zoom: 'fit',
    showOriginal: false,
    busy: false
  };

  // ---------- Elementos ----------
  const el = {
    fileInput: $('#fileInput'),
    fileName: $('#fileName'),
    btnExport: $('#btnExport'),
    unit: $('#unit'),
    step: $('#step'),
    leftInput: $('#leftInput'),
    rightInput: $('#rightInput'),
    leftRange: $('#leftRange'),
    rightRange: $('#rightRange'),
    leftOrig: $('#leftOrig'),
    rightOrig: $('#rightOrig'),
    linkHint: $('#linkHint'),
    btnCenter: $('#btnCenter'),
    btnReset: $('#btnReset'),
    vAnchorRow: $('#vAnchorRow'),
    vAnchor: $('#vAnchor'),
    reference: $('#reference'),
    threshold: $('#threshold'),
    thresholdOut: $('#thresholdOut'),
    prevPage: $('#prevPage'),
    nextPage: $('#nextPage'),
    pageInput: $('#pageInput'),
    pageCount: $('#pageCount'),
    zoom: $('#zoom'),
    btnCompare: $('#btnCompare'),
    canvasWrap: $('#canvasWrap'),
    dropzone: $('#dropzone'),
    canvas: $('#previewCanvas'),
    badgeOriginal: $('#badgeOriginal'),
    metrics: $('#metrics'),
    status: $('#status'),
    overlay: $('#overlay'),
    overlayText: $('#overlayText'),
    progressBar: $('#progressBar'),
    toast: $('#toast')
  };

  const preview = new PM.Preview(el.canvas, el.canvasWrap);

  // ---------- Avisos y progreso ----------
  let toastTimer;
  function toast(msg, isError) {
    el.toast.textContent = msg;
    el.toast.classList.toggle('error', !!isError);
    el.toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.add('hidden'), isError ? 7000 : 3500);
  }
  function showOverlay(text) {
    el.overlayText.textContent = text;
    el.progressBar.style.width = '0%';
    el.overlay.classList.remove('hidden');
  }
  function progress(done, total, label) {
    el.progressBar.style.width = Math.round((done / total) * 100) + '%';
    if (label) el.overlayText.textContent = `${label} ${done} de ${total}…`;
  }
  function hideOverlay() { el.overlay.classList.add('hidden'); }

  // ---------- Cálculo ----------
  function settings() {
    return {
      mode: state.mode,
      left: state.left,
      right: state.right,
      anchor: state.anchor,
      vAnchor: state.vAnchor,
      reference: state.reference
    };
  }

  /** Página que define la transformación común: la visible (o la primera con contenido). */
  function basePage() {
    const a = state.analyzer;
    if (a.bounds[state.page]) return state.page;
    for (let n = 1; n <= a.numPages; n++) if (a.bounds[n]) return n;
    return null;
  }

  function planFor(n) {
    const a = state.analyzer;
    const set = settings();
    const inf = a.info[n];
    let sol = null;
    if (state.reference === 'common') {
      // Misma transformación en todas las páginas: el documento se mueve como un bloque
      const bp = basePage();
      if (bp) sol = PM.Engine.solve(a.info[bp], a.bounds[bp], set);
    } else {
      sol = PM.Engine.solve(inf, a.bounds[n], set);
    }
    const t = sol
      ? PM.Engine.evaluate(inf, a.bounds[n], sol.s, sol.tx, set)
      : PM.Engine.evaluate(inf, null, 1, 0, set);
    return { inf, t };
  }

  /** En modo desplazar, el margen no fijado se deduce del fijado. */
  function syncLinked() {
    if (!state.analyzer || state.mode !== 'shift') return;
    const bp = basePage();
    if (!bp) return;
    const inf = state.analyzer.info[bp];
    const b = state.analyzer.bounds[bp];
    const cw = b.right - b.left;
    if (state.anchor === 'left') state.right = inf.width - cw - state.left;
    else state.left = inf.width - cw - state.right;
  }

  function setMargin(side, pt) {
    if (!state.analyzer || !isFinite(pt)) return;
    pt = Math.max(0, pt);
    state[side] = pt;
    state.anchor = side;
    syncLinked();
    if (state.mode === 'shift') {
      // El margen enlazado tampoco puede quedar negativo
      const other = side === 'left' ? 'right' : 'left';
      if (state[other] < 0) {
        state[side] += state[other];
        state[other] = 0;
      }
    }
    refreshControls(side);
    scheduleRender();
  }

  // ---------- Interfaz ----------
  function buildStepOptions() {
    const u = PM.UNITS[state.unit];
    el.step.innerHTML = u.steps
      .map((s) => `<option value="${s}" ${s === u.defStep ? 'selected' : ''}>${s} ${u.label}</option>`)
      .join('');
    state.step = u.defStep;
    document.querySelectorAll('.unit-tag').forEach((t) => (t.textContent = u.label));
  }

  function refreshControls(skipInputOf) {
    if (!state.analyzer) return;
    const inf = state.analyzer.info[state.page];
    const u = state.unit;
    const maxVal = PM.round(PM.fromPt(inf.width * 0.6, u), u);
    const stepVal = PM.UNITS[u].steps[0];

    for (const side of ['left', 'right']) {
      const v = PM.round(PM.fromPt(state[side], u), u);
      const input = el[side + 'Input'];
      const range = el[side + 'Range'];
      if (skipInputOf !== side || document.activeElement !== input) input.value = v;
      range.max = maxVal;
      range.step = stepVal;
      range.value = v;
    }
  }

  function setEnabled(on) {
    const ids = ['leftInput', 'rightInput', 'leftRange', 'rightRange', 'btnCenter', 'btnReset',
      'btnExport', 'prevPage', 'nextPage', 'pageInput', 'btnCompare'];
    ids.forEach((k) => (el[k].disabled = !on));
    document.querySelectorAll('.step-btn').forEach((b) => (b.disabled = !on));
  }

  function updatePager() {
    const n = state.analyzer ? state.analyzer.numPages : 0;
    el.pageCount.textContent = n;
    el.pageInput.max = n;
    el.pageInput.value = state.page;
    el.prevPage.disabled = !n || state.page <= 1;
    el.nextPage.disabled = !n || state.page >= n;
  }

  function metricRow(label, value) {
    return `<div><dt>${label}</dt><dd>${value}</dd></div>`;
  }

  function renderMetrics(t) {
    const u = state.unit;
    const a = state.analyzer;
    const rows = [];
    rows.push(metricRow('Página', `${state.page} de ${a.numPages}`));
    rows.push(metricRow('Tamaño', `${PM.fmt(t.width, u)} × ${PM.fmt(t.height, u)}`));
    rows.push(metricRow('Formato', PM.paperName(t.width, t.height)));
    if (t.blank) {
      rows.push(metricRow('Contenido', 'Página en blanco'));
    } else {
      const arrow = '<span class="arrow">→</span>';
      rows.push(metricRow('Margen izquierdo', `${PM.fmt(t.origLeft, u)}${arrow}<span class="new-left">${PM.fmt(t.newLeft, u)}</span>`));
      rows.push(metricRow('Margen derecho', `${PM.fmt(t.origRight, u)}${arrow}<span class="new-right">${PM.fmt(t.newRight, u)}</span>`));
      rows.push(metricRow('Ancho del contenido', `${PM.fmt(t.origWidth, u)}${arrow}${PM.fmt(t.newWidth, u)}`));
      rows.push(metricRow('Desplazamiento horizontal', PM.fmtSigned(t.newLeft - t.origLeft, u)));
      rows.push(metricRow('Escala', `${(t.s * 100).toFixed(1)} %`));
      rows.push(metricRow('Margen superior', PM.fmt(t.newTop, u)));
      rows.push(metricRow('Margen inferior', PM.fmt(t.newBottom, u)));
    }
    el.metrics.innerHTML = rows.join('');

    el.leftOrig.textContent = t.blank ? '' : `original: ${PM.fmt(t.origLeft, u)}`;
    el.rightOrig.textContent = t.blank ? '' : `original: ${PM.fmt(t.origRight, u)}`;
  }

  function renderStatus(t) {
    let cls, html;
    if (t.blank) {
      cls = 'status-idle';
      html = 'Esta página está en blanco; se conservará tal cual.';
    } else if (t.overflow) {
      cls = 'status-err';
      html = `<strong>Parte del contenido quedaría fuera de la hoja</strong> (lado ${t.overflowSides.join(', ')}). ` +
        'Reduzca el margen opuesto o use el modo <em>Fijar ambos márgenes</em>.';
    } else if (t.warnings.length) {
      cls = 'status-warn';
      html = `<strong>Sin pérdida de contenido.</strong><ul>${t.warnings.map((w) => `<li>${w}</li>`).join('')}</ul>`;
    } else {
      cls = 'status-ok';
      html = t.identity
        ? '<strong>Sin cambios.</strong> Ajuste los márgenes con los botones, el control deslizante o escribiendo el valor.'
        : '<strong>✓ Todo el contenido queda dentro de la hoja</strong>, a su tamaño original (100 %).';
    }
    el.status.className = 'status ' + cls;
    el.status.innerHTML = html;
  }

  // ---------- Dibujo en tiempo real ----------
  let rafPending = false;
  let renderToken = 0;
  function scheduleRender() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      renderNow();
    });
  }

  async function renderNow() {
    if (!state.analyzer) return;
    const token = ++renderToken;
    const n = state.page;
    const src = await state.analyzer.render(n);
    if (token !== renderToken) return; // llegó otro dibujo más reciente
    const { t } = planFor(n);
    preview.draw({ src, t, unit: state.unit, zoom: state.zoom, showOriginal: state.showOriginal });
    renderMetrics(t);
    renderStatus(t);
  }

  // ---------- Carga del documento ----------
  async function loadFile(file) {
    if (!file) return;
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      toast('El archivo seleccionado no es un PDF.', true);
      return;
    }
    if (!window.pdfjsLib || !window.PDFLib) {
      toast('No se pudieron cargar las librerías. Revise su conexión a Internet.', true);
      return;
    }
    showOverlay('Abriendo documento…');
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      // Verificar desde ya que pdf-lib podrá guardar el documento
      try {
        await PDFLib.PDFDocument.load(bytes, { updateMetadata: false });
      } catch (err) {
        throw new Error(/encrypt/i.test(err.message)
          ? 'El PDF está protegido con contraseña o restricciones de edición. Quite la protección y vuelva a intentarlo.'
          : 'El PDF no se pudo leer para su edición: ' + err.message);
      }
      // pdf.js se queda con el buffer que recibe, por eso se le pasa una copia
      const pdf = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
      const analyzer = new PM.Analyzer(pdf);
      for (let n = 1; n <= pdf.numPages; n++) await analyzer.pageInfo(n);
      await analyzer.analyzeAll(state.threshold, (d, tot) => progress(d, tot, 'Analizando página'));

      if (state.analyzer) state.analyzer.pdf.destroy();
      state.analyzer = analyzer;
      state.bytes = bytes;
      state.fileName = file.name;
      state.page = 1;
      el.fileName.textContent = file.name;
      el.fileName.title = file.name;
      el.dropzone.classList.add('hidden');
      el.canvas.hidden = false;
      setEnabled(true);
      resetMargins();
      updatePager();
      toast(`Documento cargado: ${pdf.numPages} página(s).`);
    } catch (err) {
      console.error(err);
      toast(err.message || 'No se pudo abrir el PDF.', true);
    } finally {
      hideOverlay();
    }
  }

  /** Coloca los controles en los márgenes actuales (sin cambios). */
  function resetMargins() {
    if (!state.analyzer) return;
    const bp = basePage();
    if (bp) {
      const b = state.analyzer.bounds[bp];
      state.left = b.left;
      state.right = state.analyzer.info[bp].width - b.right;
    } else {
      state.left = 0;
      state.right = 0;
    }
    state.anchor = 'left';
    refreshControls();
    scheduleRender();
  }

  function centerContent() {
    if (!state.analyzer) return;
    const bp = basePage();
    if (!bp) return;
    const b = state.analyzer.bounds[bp];
    if (state.mode === 'shift') {
      const m = (state.analyzer.info[bp].width - (b.right - b.left)) / 2;
      state.left = state.right = Math.max(0, m);
    } else {
      state.left = state.right = (state.left + state.right) / 2;
    }
    state.anchor = 'left';
    refreshControls();
    scheduleRender();
  }

  async function reanalyze() {
    if (!state.analyzer) return;
    showOverlay('Analizando…');
    try {
      state.analyzer.cache.clear();
      await state.analyzer.analyzeAll(state.threshold, (d, tot) => progress(d, tot, 'Analizando página'));
      syncLinked();
      refreshControls();
      scheduleRender();
    } finally {
      hideOverlay();
    }
  }

  function goToPage(n) {
    if (!state.analyzer) return;
    const target = PM.clamp(Math.round(n) || 1, 1, state.analyzer.numPages);
    if (state.reference === 'common') {
      // La transformación del documento no cambia: solo se muestran
      // los márgenes que resultan en la nueva página.
      const { t } = planFor(target);
      state.page = target;
      if (!t.blank) {
        state.left = t.newLeft;
        state.right = t.newRight;
      }
    } else {
      state.page = target;
      syncLinked();
    }
    refreshControls();
    updatePager();
    scheduleRender();
  }

  // ---------- Exportar ----------
  async function exportPdf() {
    if (!state.analyzer || state.busy) return;
    const a = state.analyzer;
    const plans = [];
    const bad = [];
    let changed = 0;
    for (let n = 1; n <= a.numPages; n++) {
      const { inf, t } = planFor(n);
      if (t.overflow) bad.push(n);
      if (!t.identity) changed++;
      plans.push(Object.assign(PM.Engine.toUserSpace(inf, t), { identity: t.identity }));
    }
    if (bad.length) {
      const list = bad.length > 12 ? bad.slice(0, 12).join(', ') + '…' : bad.join(', ');
      toast(`No se descargó: el contenido quedaría fuera de la hoja en la(s) página(s) ${list}.`, true);
      goToPage(bad[0]);
      return;
    }
    if (!changed) {
      toast('No hay cambios que aplicar: los márgenes son los originales.');
      return;
    }

    state.busy = true;
    showOverlay('Generando PDF…');
    try {
      const out = await PM.Exporter.exportPdf(state.bytes, plans, (d, tot) => progress(d, tot, 'Procesando página'));
      const base = state.fileName.replace(/\.pdf$/i, '');
      PM.downloadBlob(new Blob([out], { type: 'application/pdf' }), `${base}_margenes.pdf`);
      toast(`PDF generado: ${changed} página(s) ajustada(s).`);
    } catch (err) {
      console.error(err);
      toast('Error al generar el PDF: ' + err.message, true);
    } finally {
      state.busy = false;
      hideOverlay();
    }
  }

  // ---------- Eventos ----------
  el.fileInput.addEventListener('change', (e) => {
    loadFile(e.target.files[0]);
    e.target.value = '';
  });

  ['dragenter', 'dragover'].forEach((ev) =>
    el.canvasWrap.addEventListener(ev, (e) => {
      e.preventDefault();
      el.canvasWrap.classList.add('dragover');
    }));
  ['dragleave', 'drop'].forEach((ev) =>
    el.canvasWrap.addEventListener(ev, (e) => {
      e.preventDefault();
      el.canvasWrap.classList.remove('dragover');
    }));
  el.canvasWrap.addEventListener('drop', (e) => loadFile(e.dataTransfer.files[0]));
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());

  for (const side of ['left', 'right']) {
    el[side + 'Input'].addEventListener('input', (e) => {
      const v = parseFloat(String(e.target.value).replace(',', '.'));
      if (isFinite(v)) setMargin(side, PM.toPt(v, state.unit));
    });
    el[side + 'Input'].addEventListener('blur', () => refreshControls());
    el[side + 'Range'].addEventListener('input', (e) => {
      setMargin(side, PM.toPt(parseFloat(e.target.value), state.unit));
    });
  }

  // Botones +/− (mantener presionado para repetir)
  document.querySelectorAll('.step-btn').forEach((btn) => {
    let delay, repeat;
    const stepOnce = () => {
      const side = btn.dataset.side;
      const dir = Number(btn.dataset.dir);
      const cur = PM.fromPt(state[side], state.unit);
      const next = Math.round((cur + dir * state.step) / state.step) * state.step;
      setMargin(side, PM.toPt(next, state.unit));
    };
    const stop = () => { clearTimeout(delay); clearInterval(repeat); };
    btn.addEventListener('pointerdown', (e) => {
      if (btn.disabled) return;
      e.preventDefault();
      stepOnce();
      delay = setTimeout(() => (repeat = setInterval(stepOnce, 60)), 400);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, stop));
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); stepOnce(); }
    });
  });

  el.unit.addEventListener('change', () => {
    state.unit = el.unit.value;
    buildStepOptions();
    refreshControls();
    scheduleRender();
  });
  el.step.addEventListener('change', () => (state.step = parseFloat(el.step.value)));

  document.querySelectorAll('input[name="mode"]').forEach((r) =>
    r.addEventListener('change', () => {
      state.mode = r.value;
      el.vAnchorRow.classList.toggle('hidden', state.mode !== 'fit');
      el.linkHint.classList.toggle('hidden', state.mode !== 'shift');
      syncLinked();
      refreshControls();
      scheduleRender();
    }));

  el.vAnchor.addEventListener('change', () => { state.vAnchor = el.vAnchor.value; scheduleRender(); });
  el.reference.addEventListener('change', () => {
    state.reference = el.reference.value;
    syncLinked();
    refreshControls();
    scheduleRender();
  });

  el.threshold.addEventListener('input', () => (el.thresholdOut.textContent = el.threshold.value));
  el.threshold.addEventListener('change', () => {
    state.threshold = parseInt(el.threshold.value, 10);
    reanalyze();
  });

  el.btnCenter.addEventListener('click', centerContent);
  el.btnReset.addEventListener('click', resetMargins);
  el.btnExport.addEventListener('click', exportPdf);

  el.prevPage.addEventListener('click', () => goToPage(state.page - 1));
  el.nextPage.addEventListener('click', () => goToPage(state.page + 1));
  el.pageInput.addEventListener('change', () => goToPage(parseInt(el.pageInput.value, 10)));

  el.zoom.addEventListener('change', () => { state.zoom = el.zoom.value; scheduleRender(); });

  el.btnCompare.addEventListener('click', () => {
    state.showOriginal = !state.showOriginal;
    el.btnCompare.classList.toggle('active', state.showOriginal);
    el.btnCompare.textContent = state.showOriginal ? 'Ver ajustado' : 'Ver original';
    el.badgeOriginal.classList.toggle('hidden', !state.showOriginal);
    scheduleRender();
  });

  window.addEventListener('resize', PM.debounce(scheduleRender, 120));

  // Atajos: flechas cambian de página cuando no se está escribiendo
  document.addEventListener('keydown', (e) => {
    if (!state.analyzer || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if (e.key === 'PageDown') goToPage(state.page + 1);
    if (e.key === 'PageUp') goToPage(state.page - 1);
  });

  buildStepOptions();

  // Acceso para pruebas automatizadas
  PM._state = state;
  PM._loadFile = loadFile;
  PM._planFor = planFor;
})();
