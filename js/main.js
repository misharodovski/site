/* =========================================================
   ИСТАЯ КУЗНИЦА — интерактив и анимации (без зависимостей)
   ========================================================= */
(function () {
  'use strict';

  var doc = document, body = doc.body, root = doc.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var CFG = window.IK_CONFIG || {};

  /* ---------- 1. Прелоадер ---------- */
  (function preloader() {
    var seen = false;
    try { seen = sessionStorage.getItem('ik_seen') === '1'; sessionStorage.setItem('ik_seen', '1'); } catch (e) {}
    var minTime = reduceMotion ? 0 : (seen ? 500 : 1700);
    var start = performance.now(), done = false;
    function finish() {
      if (done) return; done = true;
      var wait = Math.max(0, minTime - (performance.now() - start));
      setTimeout(function () {
        body.classList.remove('is-loading');
        body.classList.add('is-loaded');
        setTimeout(function () { var p = $('#preloader'); if (p) p.remove(); }, 1200);
      }, wait);
    }
    if (doc.readyState === 'complete') finish(); else window.addEventListener('load', finish);
    setTimeout(finish, 4500); // страховка при медленной сети
  })();

  /* ---------- 2. Год в подвале ---------- */
  var y = $('#year'); if (y) y.textContent = new Date().getFullYear();

  /* ---------- 3. Шапка: фон и скрытие при прокрутке ---------- */
  var header = $('#header'), lastY = window.scrollY;
  function onHeaderScroll() {
    var sy = window.scrollY;
    header.classList.toggle('is-scrolled', sy > 40);
    if (!body.classList.contains('is-locked')) {
      header.classList.toggle('is-hidden', sy > lastY && sy > 400);
    }
    lastY = sy;
  }
  window.addEventListener('scroll', onHeaderScroll, { passive: true });
  onHeaderScroll();

  /* ---------- 4. Мобильное меню ---------- */
  var burger = $('#burger'), mobileMenu = $('#mobile-menu');
  function setMenu(open) {
    burger.setAttribute('aria-expanded', open);
    burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    mobileMenu.classList.toggle('is-open', open);
    mobileMenu.setAttribute('aria-hidden', !open);
    body.classList.toggle('is-locked', open);
    if (open) header.classList.remove('is-hidden');
  }
  burger.addEventListener('click', function () { setMenu(burger.getAttribute('aria-expanded') !== 'true'); });
  $$('a', mobileMenu).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
  doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && mobileMenu.classList.contains('is-open')) setMenu(false); });

  /* ---------- 5. Активный пункт меню ---------- */
  var navLinks = $$('.nav__link');
  var spy = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var id = en.target.id;
      navLinks.forEach(function (l) { l.classList.toggle('is-active', l.getAttribute('href') === '#' + id); });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('[data-section], #philosophy').forEach(function (s) { spy.observe(s); });

  /* ---------- 6. Появление элементов при прокрутке ---------- */
  var reveals = $$('[data-reveal]');
  // Небольшая задержка «лесенкой» для соседних элементов
  reveals.forEach(function (el) {
    var sibs = $$(':scope > [data-reveal]', el.parentElement);
    var i = sibs.indexOf(el);
    if (i > 0) el.style.setProperty('--d', Math.min(i * 0.09, 0.6) + 's');
  });
  if ('IntersectionObserver' in window && !reduceMotion) {
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); onRevealed(en.target); ro.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach(function (el) { ro.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-in'); onRevealed(el); });
  }

  function onRevealed(el) {
    var c = $('[data-count]', el);
    if (c) countUp(c);
    if (el.classList.contains('step')) setTimeout(function () { el.classList.add('is-lit'); }, 300);
  }

  /* ---------- 7. Счётчики ---------- */
  function countUp(el) {
    var target = +el.dataset.count, dur = 1800, t0 = null;
    if (reduceMotion || target === 0) { el.textContent = target; return; }
    function tick(t) {
      if (!t0) t0 = t;
      var p = clamp((t - t0) / dur, 0, 1), e = 1 - Math.pow(1 - p, 4);
      el.textContent = Math.round(target * e);
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ---------- 8. Бегущая строка: дублируем контент для бесшовности ---------- */
  var track = $('.marquee__track');
  if (track) track.innerHTML += track.innerHTML;

  /* ---------- 9. Цитата: слова «загораются» по мере прокрутки ---------- */
  var quote = $('#quoteText'), words = [];
  if (quote) {
    quote.innerHTML = quote.textContent.trim().split(/\s+/).map(function (w) { return '<span class="w">' + w + '</span>'; }).join(' ');
    words = $$('.w', quote);
    if (reduceMotion) words.forEach(function (w) { w.classList.add('is-on'); });
  }

  /* ---------- 10. Параллакс, прогресс процесса, цитата ---------- */
  var parallaxEls = reduceMotion ? [] : $$('[data-parallax]');
  var heroMedia = $('#heroMedia'), hero = $('.hero');
  var processSec = $('#process'), processBar = $('#processProgress');
  var ticking = false;
  var mouse = { x: 0, y: 0, tx: 0, ty: 0 };

  function onScrollFrame() {
    ticking = false;
    var vh = window.innerHeight;

    parallaxEls.forEach(function (el) {
      var r = el.parentElement.getBoundingClientRect();
      if (r.bottom < -100 || r.top > vh + 100) return;
      var speed = parseFloat(el.dataset.parallax) || 0.1;
      var lim = r.height * 0.09;
      var offset = clamp((r.top + r.height / 2 - vh / 2) * -speed, -lim, lim);
      el.style.transform = 'translate3d(0,' + offset.toFixed(1) + 'px,0)' + (el.closest('.philosophy__bg') ? ' translateX(-50%)' : '');
    });

    if (processSec && processBar) {
      var pr = processSec.getBoundingClientRect();
      var p = clamp((vh * 0.8 - pr.top) / (pr.height * 0.8), 0, 1);
      processBar.style.transform = 'scaleX(' + p.toFixed(3) + ')';
    }

    if (quote && words.length && !reduceMotion) {
      var qr = quote.getBoundingClientRect();
      var qp = clamp((vh * 0.85 - qr.top) / (vh * 0.5), 0, 1);
      var n = Math.round(qp * words.length);
      words.forEach(function (w, i) { w.classList.toggle('is-on', i < n); });
    }
  }
  function requestFrame() { if (!ticking) { ticking = true; requestAnimationFrame(onScrollFrame); } }
  window.addEventListener('scroll', requestFrame, { passive: true });
  window.addEventListener('resize', requestFrame);
  onScrollFrame();

  // Параллакс героя от мыши и прокрутки
  if (!reduceMotion && heroMedia) {
    if (finePointer) {
      hero.addEventListener('mousemove', function (e) {
        mouse.tx = (e.clientX / window.innerWidth - 0.5);
        mouse.ty = (e.clientY / window.innerHeight - 0.5);
      });
    }
    var portraitMq = window.matchMedia('(max-width: 1024px) and (orientation: portrait)');
    (function heroLoop() {
      mouse.x += (mouse.tx - mouse.x) * 0.06;
      mouse.y += (mouse.ty - mouse.y) * 0.06;
      var sy = window.scrollY;
      if (portraitMq.matches) { heroMedia.style.transform = ''; }
      else if (sy < window.innerHeight * 1.2) {
        heroMedia.style.transform = 'translate3d(' + (mouse.x * -18).toFixed(2) + 'px,' + (mouse.y * -12 + sy * 0.28).toFixed(2) + 'px,0)';
      }
      requestAnimationFrame(heroLoop);
    })();
  }

  /* ---------- 11. Огонь и искры в герое ---------- */
  var heroImg = $('#heroImg'), canvas = $('#sparks');
  // Точки на исходной фотографии (доли ширины/высоты): раскалённая заготовка и пламя
  var PT_METAL = { u: 0.40, v: 0.70 }, PT_METAL_A = { u: 0.27, v: 0.69 }, PT_METAL_B = { u: 0.55, v: 0.72 };
  var PT_FIRE = { u: 0.175, v: 0.64 };

  // Переводим точку фотографии в координаты героя с учётом object-fit: cover
  function mapPoint(pt) {
    var hr = hero.getBoundingClientRect();
    var mr = heroImg.getBoundingClientRect();
    var nw = heroImg.naturalWidth || 1460, nh = heroImg.naturalHeight || 794;
    var W = heroImg.clientWidth, H = heroImg.clientHeight;
    var s = Math.max(W / nw, H / nh);
    var pos = getComputedStyle(heroImg).objectPosition.split(' ');
    var px = parseFloat(pos[0]) / 100, py = parseFloat(pos[1] || '50') / 100;
    var rw = nw * s, rh = nh * s;
    var ox = (W - rw) * px, oy = (H - rh) * py;
    // учитываем текущий transform: scale изображения
    var k = mr.width / W || 1;
    var cx = mr.left + mr.width / 2, cy = mr.top + mr.height / 2;
    var x = mr.left + (ox + pt.u * rw) * k, yy = mr.top + (oy + pt.v * rh) * k;
    // корректировка на центр масштабирования уже учтена через mr
    return { x: x - hr.left, y: yy - hr.top, cx: cx, cy: cy };
  }

  function placeGlows() {
    if (!heroImg || !heroMedia) return;
    var mr = heroMedia.getBoundingClientRect(), hr = hero.getBoundingClientRect();
    var m = mapPoint(PT_METAL), f = mapPoint(PT_FIRE);
    var gm = $('#glowMetal'), gf = $('#glowFire');
    gm.style.left = (m.x - (mr.left - hr.left)) + 'px'; gm.style.top = (m.y - (mr.top - hr.top)) + 'px';
    gf.style.left = (f.x - (mr.left - hr.left)) + 'px'; gf.style.top = (f.y - (mr.top - hr.top)) + 'px';
  }
  if (heroImg) {
    if (heroImg.complete) placeGlows(); else heroImg.addEventListener('load', placeGlows);
    window.addEventListener('resize', placeGlows);
    setTimeout(placeGlows, 3300); // после окончания стартового зума
  }

  var sparks = null;
  if (canvas && !reduceMotion) sparks = initSparks();

  function initSparks() {
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, parts = [], running = true, lastStrike = 0, nextStrike = 1800;
    var isMobile = window.innerWidth < 700;
    var MAX = isMobile ? 160 : 360;

    function resize() {
      W = hero.clientWidth; H = hero.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize(); window.addEventListener('resize', resize);

    function lerpPt(a, b, t) { return { u: a.u + (b.u - a.u) * t, v: a.v + (b.v - a.v) * t }; }

    // Тлеющие угольки — медленно поднимаются
    function ember() {
      var fromFire = Math.random() < 0.35;
      var p = mapPoint(fromFire ? PT_FIRE : lerpPt(PT_METAL_A, PT_METAL_B, Math.random()));
      parts.push({
        x: p.x + rand(-12, 12), y: p.y + rand(-6, 6), px: 0, py: 0,
        vx: rand(-0.25, 0.35), vy: rand(-1.1, -0.35), g: -0.004, drag: 0.995,
        life: 0, max: rand(120, 260), r: rand(0.6, 1.7), wob: rand(0, 6.28), type: 'ember'
      });
    }
    // Искры от удара молота — быстрые, с шлейфом и гравитацией
    function burst(x, y, n, power) {
      for (var i = 0; i < n && parts.length < MAX; i++) {
        var a = rand(-Math.PI * 0.95, -Math.PI * 0.05) + (Math.random() < 0.2 ? Math.PI * 0.2 : 0);
        var sp = rand(2, 9) * (power || 1);
        parts.push({ x: x, y: y, px: x, py: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0.16, drag: 0.975, life: 0, max: rand(30, 80), r: rand(0.7, 1.6), type: 'spark' });
      }
    }
    function strike() {
      var p = mapPoint(lerpPt(PT_METAL_A, PT_METAL_B, rand(0.25, 0.6)));
      burst(p.x, p.y, isMobile ? 28 : 55, 1);
      var gm = $('#glowMetal');
      if (gm) { gm.animate([{ opacity: 1, filter: 'brightness(2.2)' }, { opacity: 1, filter: 'brightness(1)' }], { duration: 700, easing: 'ease-out' }); }
    }
    hero.addEventListener('click', function (e) {
      if (e.target.closest('a,button')) return;
      var hr = hero.getBoundingClientRect();
      burst(e.clientX - hr.left, e.clientY - hr.top, 40, 0.9);
    });

    var io = new IntersectionObserver(function (en) { running = en[0].isIntersecting; if (running) loop(); }, { threshold: 0 });
    io.observe(hero);
    doc.addEventListener('visibilitychange', function () { running = !doc.hidden; if (running) loop(); });

    var raf = null, lastT = 0;
    function loop(t) {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    }
    function frame(t) {
      raf = null;
      if (!running) return;
      if (!body.classList.contains('is-loaded')) { raf = requestAnimationFrame(frame); return; }
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';

      if (parts.length < MAX && Math.random() < (isMobile ? 0.35 : 0.6)) ember();
      if (t - lastStrike > nextStrike) { strike(); lastStrike = t; nextStrike = rand(2200, 4200); }

      for (var i = parts.length - 1; i >= 0; i--) {
        var p = parts[i];
        p.px = p.x; p.py = p.y;
        p.vx *= p.drag; p.vy = p.vy * p.drag + p.g;
        if (p.type === 'ember') { p.wob += 0.05; p.vx += Math.sin(p.wob) * 0.012; }
        p.x += p.vx; p.y += p.vy; p.life++;
        var k = 1 - p.life / p.max;
        if (k <= 0 || p.y > H + 20 || p.x < -20 || p.x > W + 20) { parts.splice(i, 1); continue; }

        var heat = p.type === 'spark' ? k : k * (0.6 + 0.4 * Math.sin(p.life * 0.3 + p.wob));
        var col = 'rgba(255,' + Math.round(120 + 110 * heat) + ',' + Math.round(40 + 80 * heat * heat) + ',';
        if (p.type === 'spark') {
          ctx.strokeStyle = col + (0.9 * k).toFixed(3) + ')';
          ctx.lineWidth = p.r;
          ctx.beginPath(); ctx.moveTo(p.px - p.vx * 1.5, p.py - p.vy * 1.5); ctx.lineTo(p.x, p.y); ctx.stroke();
        } else {
          ctx.fillStyle = col + (0.85 * heat).toFixed(3) + ')';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
          ctx.fillStyle = col + (0.12 * heat).toFixed(3) + ')';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 4, 0, 6.283); ctx.fill();
        }
      }
      ctx.globalCompositeOperation = 'source-over';
      raf = requestAnimationFrame(frame);
    }
    loop();
    return { burst: burst };
  }

  /* Искры в любом месте страницы (например, после отправки формы) */
  function domBurst(x, y, n) {
    if (reduceMotion) return;
    for (var i = 0; i < n; i++) {
      var s = doc.createElement('span');
      s.className = 'spark-burst';
      body.appendChild(s);
      var a = rand(0, Math.PI * 2), d = rand(40, 160);
      var anim = s.animate([
        { transform: 'translate(' + x + 'px,' + y + 'px) scale(1)', opacity: 1 },
        { transform: 'translate(' + (x + Math.cos(a) * d) + 'px,' + (y + Math.sin(a) * d + 40) + 'px) scale(.2)', opacity: 0 }
      ], { duration: rand(600, 1100), easing: 'cubic-bezier(.16,1,.3,1)' });
      anim.onfinish = (function (el) { return function () { el.remove(); }; })(s);
    }
  }

  /* ---------- 12. Кастомный курсор ---------- */
  if (finePointer && !reduceMotion) {
    var cursor = $('.cursor'), dot = $('.cursor__dot'), ring = $('.cursor__ring');
    var cx = -100, cy = -100, rx = -100, ry = -100;
    doc.addEventListener('mousemove', function (e) { cx = e.clientX; cy = e.clientY; cursor.classList.remove('is-hidden'); });
    doc.addEventListener('mouseleave', function () { cursor.classList.add('is-hidden'); });
    doc.addEventListener('mouseover', function (e) {
      cursor.classList.toggle('is-hover', !!e.target.closest('a, button, .card, .work, input, textarea, select, label, [role="button"], [data-open]'));
    });
    (function cursorLoop() {
      rx += (cx - rx) * 0.18; ry += (cy - ry) * 0.18;
      dot.style.transform = 'translate3d(' + cx + 'px,' + cy + 'px,0)';
      ring.style.transform = 'translate3d(' + rx.toFixed(1) + 'px,' + ry.toFixed(1) + 'px,0)';
      requestAnimationFrame(cursorLoop);
    })();
  }

  /* ---------- 13. Модальные окна ---------- */
  var lastFocus = null;
  function openModal(m) {
    lastFocus = doc.activeElement;
    m.hidden = false;
    body.classList.add('is-locked');
    var c = $('.modal__close', m); if (c) c.focus({ preventScroll: true });
  }
  function closeModal(m) {
    m.hidden = true;
    body.classList.remove('is-locked');
    var v = $('video', m); if (v) v.pause();
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  }
  $$('.modal').forEach(function (m) {
    $$('[data-close]', m).forEach(function (b) { b.addEventListener('click', function () { closeModal(m); }); });
  });
  doc.addEventListener('keydown', function (e) {
    var open = $('.modal:not([hidden])');
    if (!open) return;
    if (e.key === 'Escape') closeModal(open);
    if (open.id === 'lightbox') {
      if (e.key === 'ArrowRight') lbShow(lbIndex + 1);
      if (e.key === 'ArrowLeft') lbShow(lbIndex - 1);
    }
    if (e.key === 'Tab') { // простая «ловушка» фокуса
      var f = $$('a[href], button, video[controls]', open).filter(function (x) { return x.offsetParent !== null; });
      if (!f.length) return;
      if (e.shiftKey && doc.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && doc.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });

  /* ---------- 15. Галерея работ ---------- */
  var WORKS = window.IK_WORKS || [];
  var CAT = {}; WORKS.forEach(function (c) { CAT[c.slug] = c; });
  function workSrc(slug, f, thumb) { return 'img/works/' + slug + '/' + f + (thumb ? '-t' : '') + '.jpg'; }
  // «Все работы»: чередуем категории, чтобы сетка не начиналась с десятков заборов подряд
  // и открываем подборку лучшими кадрами — обложками категорий
  var ALL = (function () {
    var out = [], max = 0;
    WORKS.forEach(function (c) { c.items.forEach(function (it) { if (it[0] === c.cover) out.push({ c: c, it: it }); }); });
    WORKS.forEach(function (c) { max = Math.max(max, c.items.length); });
    for (var i = 0; i < max; i++) WORKS.forEach(function (c) { var it = c.items[i]; if (it && it[0] !== c.cover) out.push({ c: c, it: it }); });
    return out;
  })();

  var grid = $('#worksGrid'), filters = $('#worksFilters'), moreBtn = $('#worksMore');
  var PAGE = window.innerWidth < 700 ? 12 : 20;
  var curList = ALL, shown = 0;

  // Счётчики на карточках направлений
  $$('[data-count-cat]').forEach(function (b) { var c = CAT[b.dataset.countCat]; if (c) b.textContent = c.items.length; });

  var workIO = ('IntersectionObserver' in window && !reduceMotion) ? new IntersectionObserver(function (en) {
    en.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); workIO.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -5% 0px' }) : null;

  function renderMore() {
    var frag = doc.createDocumentFragment(), end = Math.min(curList.length, shown + PAGE);
    for (var i = shown; i < end; i++) {
      var w = curList[i], b = doc.createElement('button');
      b.type = 'button'; b.className = 'work'; b.dataset.i = i; b.dataset.title = w.c.title;
      b.setAttribute('aria-label', 'Открыть фото: ' + w.c.title);
      var img = doc.createElement('img');
      img.loading = 'lazy'; img.decoding = 'async'; img.alt = w.c.title;
      img.width = 640; img.height = Math.round(640 * w.it[2] / w.it[1]);
      img.src = workSrc(w.c.slug, w.it[0], true);
      b.appendChild(img); frag.appendChild(b);
      if (workIO) workIO.observe(b); else b.classList.add('is-in');
    }
    grid.appendChild(frag);
    shown = end;
    moreBtn.hidden = shown >= curList.length;
    if (!moreBtn.hidden) moreBtn.firstChild.nodeValue = 'Показать ещё (' + (curList.length - shown) + ') ';
  }
  function setFilter(slug) {
    curList = slug === 'all' ? ALL : CAT[slug].items.map(function (it) { return { c: CAT[slug], it: it }; });
    $$('.chip', filters).forEach(function (ch) { ch.setAttribute('aria-selected', ch.dataset.cat === slug ? 'true' : 'false'); });
    grid.innerHTML = ''; shown = 0; renderMore();
  }
  if (grid && WORKS.length) {
    var chips = [{ slug: 'all', title: 'Все работы', n: ALL.length }].concat(WORKS.map(function (c) { return { slug: c.slug, title: c.title, n: c.items.length }; }));
    chips.forEach(function (c) {
      var ch = doc.createElement('button');
      ch.type = 'button'; ch.className = 'chip'; ch.dataset.cat = c.slug; ch.setAttribute('role', 'tab');
      ch.innerHTML = c.title + '<sup>' + c.n + '</sup>';
      ch.addEventListener('click', function () { setFilter(c.slug); });
      filters.appendChild(ch);
    });
    setFilter('all');
    moreBtn.addEventListener('click', renderMore);
    grid.addEventListener('click', function (e) {
      var b = e.target.closest('.work'); if (!b) return;
      lbOpen(curList, +b.dataset.i);
    });
    // Карточки направлений: фильтруем галерею и прокручиваем к ней
    $$('.projects [data-cat]').forEach(function (card) {
      card.addEventListener('click', function (e) {
        e.preventDefault();
        setFilter(card.dataset.cat);
        var top = $('#works').getBoundingClientRect().top + window.scrollY - 60;
        window.scrollTo({ top: top, behavior: reduceMotion ? 'auto' : 'smooth' });
      });
    });
  }

  /* ---------- 16. Лайтбокс ---------- */
  var lightbox = $('#lightbox'), lbImg = $('#lbImg'), lbBox = lbImg && lbImg.parentElement;
  var lbList = [], lbIndex = 0;
  function lbShow(i) {
    if (!lbList.length) return;
    lbIndex = (i + lbList.length) % lbList.length;
    var w = lbList[lbIndex], src = workSrc(w.c.slug, w.it[0], false);
    lbBox.classList.add('is-loading');
    var pre = new Image();
    pre.onload = pre.onerror = function () {
      if (lbList[lbIndex] !== w) return;
      lbImg.src = src; lbImg.alt = w.c.title; lbBox.classList.remove('is-loading');
    };
    pre.src = src;
    $('#lbTitle').textContent = w.c.title;
    $('#lbText').textContent = w.c.text || '';
    $('#lbCount').textContent = (lbIndex + 1) + ' / ' + lbList.length;
    // заранее грузим соседние кадры
    [lbIndex + 1, lbIndex - 1].forEach(function (k) {
      var n = lbList[(k + lbList.length) % lbList.length]; (new Image()).src = workSrc(n.c.slug, n.it[0], false);
    });
  }
  function lbOpen(list, i) { lbList = list; lbImg.removeAttribute('src'); lbShow(i); openModal(lightbox); }
  if (lightbox) {
    $('#lbPrev').addEventListener('click', function () { lbShow(lbIndex - 1); });
    $('#lbNext').addEventListener('click', function () { lbShow(lbIndex + 1); });
    // свайпы на телефоне
    var sx = null, sy0 = 0;
    lightbox.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; sy0 = e.touches[0].clientY; }, { passive: true });
    lightbox.addEventListener('touchend', function (e) {
      if (sx === null) return;
      var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy0; sx = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) lbShow(lbIndex + (dx < 0 ? 1 : -1));
    });
    // превью в «Материалах» тоже открывают лайтбокс
    $$('[data-open]').forEach(function (im) {
      im.addEventListener('click', function () {
        var p = im.dataset.open.split(':'), c = CAT[p[0]]; if (!c) return;
        var list = c.items.map(function (it) { return { c: c, it: it }; });
        var idx = 0; list.forEach(function (x, k) { if (x.it[0] === p[1]) idx = k; });
        lbOpen(list, idx);
      });
    });
  }

  /* ---------- 17. Карта (виджет Яндекс Карт, ключ не нужен) ---------- */
  (function mapInit() {
    var m = CFG.map || {}, frame = $('#mapFrame');
    if (!frame || !m.lat) return;
    var ll = m.lon + ',' + m.lat;
    if (m.address) $('#mapAddress').textContent = m.address;
    $('#routeYandex').href = 'https://yandex.ru/maps/?rtext=~' + m.lat + ',' + m.lon + '&rtt=auto';
    $('#route2gis').href = 'https://2gis.ru/routeSearch/rsType/car/to/' + m.lon + ',' + m.lat;
    $('#routeGoogle').href = 'https://www.google.com/maps/dir/?api=1&destination=' + m.lat + ',' + m.lon;
    function load() {
      if (load.done) return; load.done = true;
      var f = doc.createElement('iframe');
      f.src = 'https://yandex.ru/map-widget/v1/?ll=' + ll + '&z=' + (m.zoom || 16) + '&pt=' + ll + ',pm2orl&l=map';
      f.title = 'Мастерская на карте'; f.loading = 'lazy'; f.allowFullscreen = true;
      f.referrerPolicy = 'strict-origin-when-cross-origin';
      frame.appendChild(f);
      f.addEventListener('load', function () { var ph = $('#mapLoad'); if (ph) ph.remove(); });
    }
    $('#mapLoad').addEventListener('click', load);
    if ('IntersectionObserver' in window) {
      var mio = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { load(); mio.disconnect(); } }, { rootMargin: '300px 0px' });
      mio.observe(frame);
    }
  })();

  /* Видео */
  var videoModal = $('#videoModal'), video = $('#videoEl'), vFallback = $('#videoFallback');
  var sources = $$('source', video), failed = 0;
  sources.forEach(function (s) {
    s.addEventListener('error', function () { failed++; if (failed >= sources.length) vFallback.hidden = false; });
  });
  $('#videoBtn').addEventListener('click', function () {
    openModal(videoModal);
    if (video.preload === 'none') { video.preload = 'auto'; video.load(); }
    var pr = video.play(); if (pr && pr.catch) pr.catch(function () {});
  });

  /* ---------- 14. Форма заявки ---------- */
  var form = $('#leadForm');
  if (form) {
    var status = $('#formStatus'), phone = form.elements.phone, sel = form.elements.type;
    var ts = $('#formTs'); if (ts) ts.value = Math.floor(Date.now() / 1000);

    sel.addEventListener('change', function () { sel.classList.toggle('has-value', !!sel.value); });

    // Яндекс SmartCaptcha — подгружаем, только когда пользователь начал заполнять форму
    var captcha = { ready: false, id: null, onToken: null };
    var captchaKey = (CFG.smartCaptchaKey || '').trim();
    function loadCaptcha() {
      if (!captchaKey || loadCaptcha.done) return; loadCaptcha.done = true;
      window.ikCaptchaLoaded = function () {
        if (!window.smartCaptcha) return;
        captcha.id = window.smartCaptcha.render('captchaBox', {
          sitekey: captchaKey, invisible: true, hl: 'ru', shieldPosition: 'bottom-left',
          callback: function (token) { if (captcha.onToken) captcha.onToken(token); }
        });
        captcha.ready = true;
      };
      var sc = doc.createElement('script');
      sc.src = 'https://smartcaptcha.yandexcloud.net/captcha.js?render=onload&onload=ikCaptchaLoaded';
      sc.defer = true;
      doc.head.appendChild(sc);
    }
    form.addEventListener('focusin', loadCaptcha);

    // Маска телефона +7 (___) ___-__-__
    function formatPhone(v) {
      // если символ ввели перед префиксом «+7 (», убираем префикс, чтобы не задвоить семёрку
      if (v.indexOf('+7') > 0) v = v.replace('+7', '');
      var d = v.replace(/\D/g, '');
      if (!d) return '';
      if (d[0] === '8') d = '7' + d.slice(1);
      if (d[0] !== '7') d = '7' + d;
      d = d.slice(0, 11);
      var out = '+7';
      if (d.length > 1) out += ' (' + d.slice(1, 4);
      if (d.length >= 4) out += ')';
      if (d.length > 4) out += ' ' + d.slice(4, 7);
      if (d.length > 7) out += '-' + d.slice(7, 9);
      if (d.length > 9) out += '-' + d.slice(9, 11);
      return out;
    }
    phone.addEventListener('input', function () { phone.value = formatPhone(phone.value); });
    phone.addEventListener('focus', function () {
      if (!phone.value) {
        phone.value = '+7 (';
        setTimeout(function () { var l = phone.value.length; try { phone.setSelectionRange(l, l); } catch (e) {} }, 0);
      }
    });
    phone.addEventListener('blur', function () { if (phone.value.replace(/\D/g, '').length <= 1) phone.value = ''; });

    function setErr(el, on) {
      var box = el.closest('.field') || el.closest('.check');
      if (box) box.classList.toggle('is-error', on);
    }
    $$('input, textarea', form).forEach(function (el) {
      el.addEventListener('input', function () { setErr(el, false); });
      el.addEventListener('change', function () { setErr(el, false); });
    });

    function validate() {
      var ok = true, first = null;
      var name = form.elements.name, email = form.elements.email, agree = form.elements.agree;
      function bad(el) { setErr(el, true); ok = false; if (!first) first = el; }
      if (name.value.trim().length < 2) bad(name);
      if (phone.value.replace(/\D/g, '').length !== 11) bad(phone);
      if (email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value)) bad(email);
      if (!agree.checked) bad(agree);
      if (first) first.focus();
      return ok;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      status.className = 'form__status'; status.textContent = '';
      if (!validate()) {
        status.classList.add('is-err');
        status.textContent = form.elements.agree.checked ? 'Проверьте, пожалуйста, выделенные поля.' : 'Проверьте поля и подтвердите согласие на обработку данных.';
        return;
      }
      if (location.protocol === 'file:') {
        status.classList.add('is-err');
        status.textContent = 'Форма заработает после размещения сайта на сервере с поддержкой PHP.';
        return;
      }
      // Статический хостинг (GitHub Pages) не выполняет send.php — предлагаем связаться напрямую
      if (CFG.formEnabled === false || /\.github\.io$/i.test(location.hostname)) {
        status.classList.add('is-err');
        status.innerHTML = 'Онлайн-заявки временно не принимаются. Позвоните нам: <a href="tel:+79991234567">+7 (999) 123-45-67</a> или напишите на <a href="mailto:info@istaya-kuznica.ru">info@istaya-kuznica.ru</a>.';
        return;
      }
      var btn = $('.form__submit', form), txt = $('.form__submit-text', form), old = txt.textContent;
      btn.disabled = true; txt.textContent = 'Отправляем…';

      // Невидимая SmartCaptcha: сначала получаем токен, потом отправляем
      if (captcha.ready) {
        captcha.onToken = function (token) { $('#captchaToken').value = token; send(); };
        try { window.smartCaptcha.execute(captcha.id); } catch (err) { send(); }
      } else {
        send();
      }

      function send() {
        fetch(form.getAttribute('action'), { method: 'POST', body: new FormData(form), headers: { 'X-Requested-With': 'fetch' } })
          .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
          .then(function (res) {
            if (res && res.ok) {
              status.classList.add('is-ok');
              status.textContent = 'Спасибо! Заявка отправлена — мастер свяжется с вами в ближайшее время.';
              form.classList.add('is-sent');
              var r = btn.getBoundingClientRect();
              domBurst(r.left + r.width / 2, r.top + r.height / 2, 34);
              form.reset();
            } else {
              status.classList.add('is-err');
              status.textContent = (res && res.error) || 'Не удалось отправить заявку. Позвоните нам или напишите на почту.';
              btn.disabled = false;
            }
          })
          .catch(function () {
            status.classList.add('is-err');
            status.textContent = 'Нет связи с сервером. Попробуйте ещё раз или позвоните нам.';
            btn.disabled = false;
          })
          .then(function () {
            txt.textContent = old;
            if (captcha.ready) { try { window.smartCaptcha.reset(captcha.id); } catch (err) {} }
          });
      }
    });
  }
})();
