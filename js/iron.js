/* =========================================================
   ИСТАЯ КУЗНИЦА — «живое железо»
   1) Кованые побеги по краям экрана: два переплетённых прута извиваются,
      как змеи, при прокрутке (волна бежит вдоль прута, скорость прокрутки
      усиливает изгиб), растут вместе с прокруткой и выпускают завитки
      с листьями; на конце — раскалённое «жало», которое остывает.
   2) Орнаментальные разделители секций прорисовываются по мере прокрутки.
   Без зависимостей. При «уменьшить движение» — статичная отрисовка.
   ========================================================= */
(function () {
  'use strict';

  var doc = document, win = window;
  var NS = 'http://www.w3.org/2000/svg';
  var reduceMotion = win.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

  function el(name, attrs, parent) {
    var e = doc.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  /* Завиток-«C-скролл» с листом; ось X направлена наружу от стебля */
  var CURL = 'M0 0 C 14 -2, 30 -12, 32 -28 C 34 -42, 20 -50, 11 -44 C 3 -39, 6 -27, 15 -28 C 21 -29, 22 -36, 17 -38';
  var CURL_SMALL = 'M0 0 C 9 4, 20 4, 24 -5 C 27 -13, 19 -18, 14 -13 C 10 -9, 14 -4, 18 -6';
  var LEAF = 'M6 -2 C 12 -12, 24 -14, 30 -8 C 24 -2, 14 2, 6 -2 Z';

  /* =========================================================
     1. Боковые побеги
     ========================================================= */
  var host = doc.querySelector('.iron-rails');
  var mqShow = win.matchMedia('(min-width: 1100px)');
  var rails = [];

  function buildRail(side) {
    var svg = el('svg', { class: 'iron-rail iron-rail--' + side, preserveAspectRatio: 'none' }, host);
    var defs = el('defs', {}, svg);
    var gid = 'ironHot-' + side;
    var g = el('radialGradient', { id: gid }, defs);
    el('stop', { offset: '0', 'stop-color': '#fff1c9' }, g);
    el('stop', { offset: '.35', 'stop-color': '#ff9a3d', 'stop-opacity': '.85' }, g);
    el('stop', { offset: '1', 'stop-color': '#ff5a14', 'stop-opacity': '0' }, g);

    var shade = el('path', { class: 'iron-rail__stem iron-rail__stem--shade' }, svg);
    var rodA = el('path', { class: 'iron-rail__stem' }, svg);
    var rodB = el('path', { class: 'iron-rail__stem iron-rail__stem--thin' }, svg);
    var hot = el('path', { class: 'iron-rail__hot' }, svg);
    var curls = [];
    for (var i = 0; i < 14; i++) {
      var cg = el('g', { class: 'iron-rail__curl' }, svg);
      var big = i % 3 !== 2;
      var cp = el('path', { d: big ? CURL : CURL_SMALL, pathLength: '1' }, cg);
      var lf = big ? el('path', { d: LEAF, class: 'iron-rail__leaf' }, cg) : null;
      curls.push({ g: cg, p: cp, leaf: lf });
    }
    var glow = el('circle', { r: '16', fill: 'url(#' + gid + ')', class: 'iron-rail__glow' }, svg);
    var tip = el('circle', { r: '2.6', class: 'iron-rail__tip' }, svg);
    return { side: side, svg: svg, shade: shade, rodA: rodA, rodB: rodB, hot: hot, curls: curls, glow: glow, tip: tip };
  }

  var W = 0, H = 0, state = { phase: 0, vel: 0, amp: 0, lastY: win.scrollY, t: 0, grow: 0 };

  function layout() {
    W = Math.round(clamp((win.innerWidth - 1240) / 2, 56, 120));
    H = win.innerHeight;
    rails.forEach(function (r) {
      r.svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      r.svg.style.width = W + 'px';
    });
  }

  // x-координата прута в точке y экрана
  function rodX(y, cx, A, lambda, ph, shift) {
    var th = (y / lambda) * Math.PI * 2 - ph + shift;
    return cx + A * Math.sin(th) + A * 0.22 * Math.sin(th * 2.3 + 1.1);
  }

  function drawRail(r, grow, ph, A) {
    var left = r.side === 'left';
    var cx = left ? W * 0.42 : W * 0.58;
    var lambda = 300;
    // левый растёт сверху вниз, правый — снизу вверх
    var len = H * grow;
    var y0 = left ? -20 : H + 20, dir = left ? 1 : -1;
    var headY = y0 + dir * len;
    var step = 7, dA = '', dB = '', dHot = '', n = Math.ceil(len / step) + 1;
    var hotFrom = Math.max(0, len - 110);
    var hx = cx, hy = y0;
    for (var i = 0; i <= n; i++) {
      var s = Math.min(i * step, len);
      var y = y0 + dir * s;
      // у конца прут сужает амплитуду — «жало» смотрит вдоль направления роста
      var taper = clamp((len - s) / 90, 0.25, 1);
      var xa = rodX(y, cx, A * taper, lambda, ph, 0);
      var xb = rodX(y, cx, A * 0.62 * taper, lambda, ph, Math.PI);
      dA += (i ? 'L' : 'M') + xa.toFixed(1) + ' ' + y.toFixed(1);
      dB += (i ? 'L' : 'M') + xb.toFixed(1) + ' ' + y.toFixed(1);
      if (s >= hotFrom) dHot += (dHot ? 'L' : 'M') + xa.toFixed(1) + ' ' + y.toFixed(1);
      hx = xa; hy = y;
      if (s >= len) break;
    }
    r.rodA.setAttribute('d', dA);
    r.shade.setAttribute('d', dA);
    r.rodB.setAttribute('d', dB);
    r.hot.setAttribute('d', dHot);
    r.tip.setAttribute('cx', hx.toFixed(1)); r.tip.setAttribute('cy', hy.toFixed(1));
    r.glow.setAttribute('cx', hx.toFixed(1)); r.glow.setAttribute('cy', hy.toFixed(1));

    // завитки сидят на гребнях волны и «едут» вместе с ней
    var k = lambda / (Math.PI * 2);
    var nStart = Math.ceil((-60 / k - ph - Math.PI / 2) / Math.PI);
    for (var c = 0; c < r.curls.length; c++) {
      var m = nStart + c;
      var yc = k * (Math.PI / 2 + m * Math.PI + ph);
      var cu = r.curls[c];
      var dist = left ? (headY - yc) : (yc - headY); // сколько прут уже прошёл за завиток
      var inside = left ? (yc > y0 && yc < headY) : (yc < y0 && yc > headY);
      if (!inside || yc < -60 || yc > H + 60) { cu.g.style.display = 'none'; continue; }
      cu.g.style.display = '';
      var unfurl = clamp(dist / 140, 0, 1);
      var xc = rodX(yc, cx, A, lambda, ph, 0);
      var out = (Math.abs(m) % 2 === 0) ? 1 : -1; // гребень справа или слева от оси
      var sc = 0.55 + 0.45 * unfurl;
      var flipY = left ? 1 : -1;
      cu.g.setAttribute('transform', 'translate(' + xc.toFixed(1) + ' ' + yc.toFixed(1) + ') scale(' + (out * sc).toFixed(3) + ' ' + (flipY * sc).toFixed(3) + ')');
      cu.p.style.strokeDashoffset = (1 - unfurl).toFixed(3);
      if (cu.leaf) cu.leaf.style.opacity = clamp(unfurl * 1.6 - 0.6, 0, 1).toFixed(2);
    }
  }

  function frame(now) {
    raf = 0;
    var sy = win.scrollY;
    var max = Math.max(1, doc.documentElement.scrollHeight - H);
    var progress = clamp(sy / max, 0, 1);
    var dy = sy - state.lastY; state.lastY = sy;

    // скорость прокрутки → «извивание»
    state.vel += (dy - state.vel) * 0.18;
    var targetAmp = 7 + clamp(Math.abs(state.vel) * 0.35, 0, 9);
    state.amp += (targetAmp - state.amp) * 0.08;
    // фаза: бежит от прокрутки и чуть-чуть сама по себе (дыхание)
    state.phase += dy * 0.012 + (reduceMotion ? 0 : 0.004);
    // рост: к низу страницы побег проходит весь экран
    var targetGrow = 0.22 + 0.8 * progress;
    state.grow += (targetGrow - state.grow) * (reduceMotion ? 1 : 0.07);

    for (var i = 0; i < rails.length; i++) drawRail(rails[i], state.grow, state.phase, state.amp);

    var settling = Math.abs(targetGrow - state.grow) > 0.001 || Math.abs(targetAmp - state.amp) > 0.05;
    if (!reduceMotion && !doc.hidden && active) raf = requestAnimationFrame(frame);
    else if (settling) raf = requestAnimationFrame(frame);
  }

  var raf = 0, active = false;
  function kick() { if (!raf && active) raf = requestAnimationFrame(frame); }

  function setActive() {
    active = !!host && mqShow.matches;
    if (host) host.classList.toggle('is-on', active);
    if (active) {
      if (!rails.length) { rails.push(buildRail('left'), buildRail('right')); }
      layout(); state.grow = 0; kick();
    }
  }

  if (host) {
    setActive();
    if (mqShow.addEventListener) mqShow.addEventListener('change', setActive); else mqShow.addListener(setActive);
    win.addEventListener('resize', function () { if (active) { layout(); kick(); } });
    win.addEventListener('scroll', kick, { passive: true });
    doc.addEventListener('visibilitychange', kick);
  }

  /* =========================================================
     2. Орнаментальные разделители
     ========================================================= */
  var DIV_PATHS = [
    // длинная волна от центра к краю
    'M548 40 C 500 40, 470 58, 420 58 C 360 58, 340 22, 280 22 C 220 22, 200 52, 140 52 C 100 52, 80 40, 50 40',
    // концевой завиток
    'M50 40 C 30 40, 20 56, 32 64 C 42 70, 54 60, 48 52 C 44 47, 38 50, 39 54',
    // завитки у центра
    'M548 40 C 540 26, 520 18, 504 24 C 490 30, 494 46, 506 46 C 514 46, 516 38, 510 35',
    'M470 50 C 476 64, 494 70, 502 62 C 508 55, 500 48, 494 52',
    'M340 33 C 330 18, 312 12, 302 20 C 294 27, 300 36, 308 33',
    'M210 44 C 214 58, 228 64, 236 58 C 242 52, 236 45, 230 48'
  ];
  var DIV_LEAVES = [
    'M420 58 C 428 68, 442 70, 450 64 C 442 58, 430 56, 420 58 Z',
    'M280 22 C 272 12, 258 10, 250 16 C 258 22, 270 24, 280 22 Z',
    'M140 52 C 132 62, 118 64, 110 58 C 118 52, 130 50, 140 52 Z'
  ];

  function buildDivider(host) {
    var svg = el('svg', { viewBox: '0 0 1200 80', preserveAspectRatio: 'xMidYMid meet', class: 'iron-divider__svg' }, host);
    [0, 1].forEach(function (mirror) {
      var g = el('g', mirror ? { transform: 'translate(1200 0) scale(-1 1)' } : {}, svg);
      DIV_PATHS.forEach(function (d, i) { el('path', { d: d, pathLength: '1', class: 'iron-divider__line' + (i === 0 ? ' iron-divider__line--main' : ''), style: '--i:' + i }, g); });
      DIV_LEAVES.forEach(function (d, i) { el('path', { d: d, class: 'iron-divider__leaf', style: '--i:' + i }, g); });
    });
    // центральный мотив
    var c = el('g', { class: 'iron-divider__center' }, svg);
    el('path', { d: 'M600 16 L 616 40 L 600 64 L 584 40 Z', pathLength: '1', class: 'iron-divider__line' }, c);
    el('path', { d: 'M600 26 L 608 40 L 600 54 L 592 40 Z', class: 'iron-divider__core' }, c);
    el('circle', { cx: 600, cy: 40, r: 30, class: 'iron-divider__glow' }, c);
    return svg;
  }

  var dividers = Array.prototype.slice.call(doc.querySelectorAll('.iron-divider'));
  dividers.forEach(function (d) { buildDivider(d); });

  function onDividers() {
    dTick = false;
    var vh = win.innerHeight;
    dividers.forEach(function (d) {
      var r = d.getBoundingClientRect();
      if (r.bottom < -50 || r.top > vh + 50) return;
      // 0 — разделитель только показался снизу, 1 — дошёл до ~40% экрана
      var f = reduceMotion ? 1 : clamp((vh - r.top) / (vh * 0.6), 0, 1);
      d.style.setProperty('--draw', f.toFixed(3));
      d.classList.toggle('is-hot', f > 0.05 && f < 0.98);
      d.classList.toggle('is-done', f >= 0.98);
    });
  }
  var dTick = false;
  function reqDiv() { if (!dTick) { dTick = true; requestAnimationFrame(onDividers); } }
  if (dividers.length) {
    win.addEventListener('scroll', reqDiv, { passive: true });
    win.addEventListener('resize', reqDiv);
    onDividers();
  }
})();
