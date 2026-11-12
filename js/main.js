/* =========================================================
   ИСТАЯ КУЗНИЦА — логика сайта
   Настройки — в js/config.js, список фото — в js/works.js
   ========================================================= */
(function () {
  'use strict';

  var CFG = window.IK_CONFIG || {};
  var C = CFG.contacts || {};
  var WORKS = window.IK_WORKS || [];
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Сколько направлений показывать крупными карточками, остальные — кнопками */
  var MAIN_CATS = ['ograzhdeniya', 'lestnitsy', 'navesy', 'balkony', 'reshetki', 'mebel', 'fonari', 'mangaly'];
  var PAGE = 24;

  /* ================== КОНТАКТЫ ================== */
  var ICONS = {
    tg: '<svg viewBox="0 0 24 24"><path d="M21.9 4.3l-3.2 15c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.4-5 9.1-8.2c.4-.4-.1-.6-.6-.2L6.2 13l-4.8-1.5c-1-.3-1-1 .2-1.5l18.8-7.2c.9-.3 1.6.2 1.5 1.5z"/></svg>',
    wa: '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1112 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 01-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.7.3-.2.3-.9.9-.9 2.2s1 2.6 1.1 2.7c.1.2 1.9 2.9 4.6 4 1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3z"/></svg>',
    max: '<svg viewBox="0 0 24 24"><path d="M12 2C6.5 2 2 6.2 2 11.5c0 2.3.9 4.4 2.3 6L3.5 22l4.3-1.8c1.3.5 2.7.8 4.2.8 5.5 0 10-4.2 10-9.5S17.5 2 12 2zm4.6 12.8h-1.9V10l-2.1 3.4h-1.2L9.3 10v4.8H7.4V7.2h1.8l2.8 4.5 2.8-4.5h1.8v7.6z"/></svg>',
    vk: '<svg viewBox="0 0 24 24"><path d="M12.8 17.5C6.6 17.5 3.1 13.3 3 6.3h3.1c.1 5.2 2.4 7.3 4.2 7.8V6.3h2.9v4.4c1.8-.2 3.7-2.2 4.3-4.4h2.9a8.6 8.6 0 01-3.9 5.6 9 9 0 014.6 5.6h-3.2a5.6 5.6 0 00-4.7-4v4h-.4z"/></svg>'
  };

  function messengerLinks(text) {
    var list = [];
    var t = text ? encodeURIComponent(text) : '';
    if (C.telegram) list.push({ k: 'tg', name: 'Telegram', href: 'https://t.me/' + C.telegram.replace(/^@/, '') });
    if (C.whatsapp) list.push({ k: 'wa', name: 'WhatsApp', href: 'https://wa.me/' + C.whatsapp.replace(/\D/g, '') + (t ? '?text=' + t : '') });
    if (C.max) list.push({ k: 'max', name: 'MAX', href: C.max });
    if (C.vk) list.push({ k: 'vk', name: 'ВКонтакте', href: C.vk });
    return list;
  }

  function applyContacts() {
    $$('[data-c="phone"]').forEach(function (a) {
      if (!C.phone) { a.hidden = true; return; }
      a.href = 'tel:' + C.phone;
      if (!a.classList.contains('fab')) a.textContent = C.phoneDisplay || C.phone;
    });
    $$('[data-c="email"]').forEach(function (a) {
      if (!C.email) { a.hidden = true; return; }
      a.href = 'mailto:' + C.email; a.textContent = C.email;
    });
    $$('[data-c-row="email"]').forEach(function (r) { if (!C.email) r.hidden = true; });
    $$('[data-c="city"]').forEach(function (e) { if (C.city) e.textContent = C.city; });
    $$('[data-c="hours"]').forEach(function (e) { if (C.hours) e.textContent = C.hours; });

    var html = messengerLinks().map(function (m) {
      return '<a class="msg msg--' + m.k + '" href="' + m.href + '" target="_blank" rel="noopener">' + ICONS[m.k] + m.name + '</a>';
    }).join('');
    $$('[data-messengers]').forEach(function (box) { box.innerHTML = html; });

    var y = $('#year'); if (y) y.textContent = new Date().getFullYear();
  }

  /* Разметка для поисковиков (Яндекс, Google) */
  function addSchema() {
    var data = {
      '@context': 'https://schema.org',
      '@type': 'HomeAndConstructionBusiness',
      name: 'Истая Кузница',
      description: 'Художественная ковка под заказ: ворота, заборы, перила, навесы, решётки, кованый декор. Донецк и вся ДНР.',
      url: location.origin + location.pathname,
      image: location.origin + location.pathname.replace(/[^/]*$/, '') + 'img/og.jpg',
      address: { '@type': 'PostalAddress', addressLocality: 'Донецк', addressRegion: 'Донецкая Народная Республика', addressCountry: 'RU' },
      areaServed: { '@type': 'AdministrativeArea', name: 'Донецкая Народная Республика' },
      geo: { '@type': 'GeoCoordinates', latitude: (CFG.map || {}).lat, longitude: (CFG.map || {}).lon }
    };
    if (C.phone) data.telephone = C.phone;
    if (C.email) data.email = C.email;
    var s = document.createElement('script');
    s.type = 'application/ld+json';
    s.textContent = JSON.stringify(data);
    document.head.appendChild(s);
  }

  /* Яндекс Метрика */
  function addMetrika() {
    var id = CFG.metrikaId;
    if (!id) return;
    (function (m, e, t, r, i, k, a) {
      m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
      m[i].l = 1 * new Date();
      k = e.createElement(t); a = e.getElementsByTagName(t)[0];
      k.async = 1; k.src = r; a.parentNode.insertBefore(k, a);
    })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym');
    window.ym(id, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: true });
  }
  function goal(name) { try { if (CFG.metrikaId && window.ym) window.ym(CFG.metrikaId, 'reachGoal', name); } catch (e) {} }

  /* ================== ШАПКА И МЕНЮ ================== */
  function initHeader() {
    var header = $('#header');
    var onScroll = function () { header.classList.toggle('is-scrolled', window.scrollY > 30); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    var burger = $('#burger'), menu = $('#mobileMenu');
    var setMenu = function (open) {
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
      menu.hidden = !open;
      document.body.style.overflow = open ? 'hidden' : '';
      header.classList.toggle('is-scrolled', open || window.scrollY > 30);
    };
    burger.addEventListener('click', function () { setMenu(menu.hidden); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) setMenu(false); });
    window.addEventListener('resize', function () { if (window.innerWidth > 1180 && !menu.hidden) setMenu(false); });

    // подсветка текущего раздела в меню
    if ('IntersectionObserver' in window) {
      var links = $$('.nav a');
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          links.forEach(function (l) { l.classList.toggle('is-active', l.getAttribute('href') === '#' + en.target.id); });
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      links.forEach(function (l) { var s = $(l.getAttribute('href')); if (s) io.observe(s); });
    }
  }

  /* ================== ПОЯВЛЕНИЕ ПРИ ПРОКРУТКЕ ================== */
  var revealIO = null;
  function observeReveal(root) {
    var els = $$('[data-reveal]:not(.is-in)', root);
    if (!('IntersectionObserver' in window) || reduceMotion) { els.forEach(function (e) { e.classList.add('is-in'); }); return; }
    if (!revealIO) {
      revealIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('is-in'); revealIO.unobserve(en.target); }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: .05 });
    }
    els.forEach(function (e, i) { e.style.transitionDelay = Math.min(i % 4, 3) * 70 + 'ms'; revealIO.observe(e); });
  }

  /* ================== ИСКРЫ В ГЕРОЕ ================== */
  function initSparks() {
    var cv = $('#sparks');
    if (!cv || reduceMotion || !cv.getContext) return;
    var ctx = cv.getContext('2d'), W, H, dpr, parts = [], running = true, raf;
    var resize = function () {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = cv.offsetWidth; H = cv.offsetHeight;
      cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    var spawn = function () {
      return {
        x: W * (0.45 + Math.random() * 0.55), y: H + 10,
        vx: (Math.random() - 0.6) * 0.9, vy: -(1.2 + Math.random() * 2.6),
        life: 0, max: 120 + Math.random() * 160, r: 0.6 + Math.random() * 1.8
      };
    };
    var count = window.innerWidth < 640 ? 35 : 70;
    var tick = function () {
      if (!running) return;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      while (parts.length < count) { var p0 = spawn(); p0.life = Math.random() * p0.max; p0.y = H * Math.random(); parts.push(p0); }
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        p.life++; p.x += p.vx + Math.sin((p.life + i * 13) / 22) * 0.35; p.y += p.vy; p.vy *= 0.997;
        var k = 1 - p.life / p.max;
        if (k <= 0 || p.y < -20) { parts[i] = spawn(); continue; }
        var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5);
        g.addColorStop(0, 'rgba(255,214,150,' + (0.95 * k) + ')');
        g.addColorStop(0.35, 'rgba(255,140,50,' + (0.5 * k) + ')');
        g.addColorStop(1, 'rgba(255,90,20,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 5, 0, 6.283); ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    resize(); window.addEventListener('resize', resize);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) {
        running = en[0].isIntersecting;
        cancelAnimationFrame(raf);
        if (running) raf = requestAnimationFrame(tick);
      }).observe(cv);
    } else { tick(); }
  }

  /* ================== ДАННЫЕ ГАЛЕРЕИ ================== */
  function src(slug, f, thumb) { return 'img/works/' + slug + '/' + f + (thumb ? '-t' : '') + '.jpg'; }
  /* превью 640px + полное фото 1600px: браузер сам берёт нужное, чтобы не было «мыла» на чётких экранах */
  function srcset(slug, f) { return src(slug, f, true) + ' 640w, ' + src(slug, f, false) + ' 1600w'; }
  var bySlug = {};
  WORKS.forEach(function (c) { bySlug[c.slug] = c; });
  var totalPhotos = WORKS.reduce(function (n, c) { return n + c.items.length; }, 0);

  // «Все» — чередуем направления, чтобы лента была разнообразной
  var allMixed = (function () {
    var out = [], max = Math.max.apply(null, WORKS.map(function (c) { return c.items.length; }).concat([0]));
    for (var i = 0; i < max; i++) {
      WORKS.forEach(function (c) { if (c.items[i]) out.push({ slug: c.slug, f: c.items[i][0] }); });
    }
    return out;
  })();
  function listFor(slug) {
    if (slug === 'all') return allMixed;
    return (bySlug[slug] ? bySlug[slug].items : []).map(function (it) { return { slug: slug, f: it[0] }; });
  }

  /* ================== УСЛУГИ ================== */
  function initServices() {
    $$('[data-total-works]').forEach(function (e) { e.textContent = (Math.floor(totalPhotos / 50) * 50) + '+'; });
    $$('[data-total-cats]').forEach(function (e) { e.textContent = WORKS.length; });

    var grid = $('#servicesGrid'), more = $('#servicesMore');
    var main = MAIN_CATS.map(function (s) { return bySlug[s]; }).filter(Boolean);
    grid.innerHTML = main.map(function (c) {
      return '<button type="button" class="svc" data-reveal data-go="' + c.slug + '" aria-label="Смотреть работы: ' + c.title + '">' +
        '<img src="' + src(c.slug, c.cover, true) + '" srcset="' + srcset(c.slug, c.cover) + '" sizes="(max-width: 640px) 89vw, (max-width: 1180px) 60vw, 45vw" alt="' + c.title + ' — работа мастерской" loading="lazy" width="480" height="640">' +
        '<span class="svc__count">' + c.items.length + ' фото</span>' +
        '<span class="svc__body"><span><span class="svc__title">' + c.title + '</span><span class="svc__text">' + c.text + '</span></span>' +
        '<span class="svc__go"><i class="arrow"></i></span></span></button>';
    }).join('');

    var rest = WORKS.filter(function (c) { return MAIN_CATS.indexOf(c.slug) < 0; });
    more.innerHTML = rest.length ? '<span class="muted" style="align-self:center;margin-right:6px">А ещё:</span>' + rest.map(function (c) {
      return '<button type="button" class="chip" data-go="' + c.slug + '">' + c.title + ' <sup>' + c.items.length + '</sup></button>';
    }).join('') : '';

    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-go]');
      if (!b) return;
      setFilter(b.getAttribute('data-go'));
      $('#works').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
    });

    // список в форме заявки
    var sel = $('#formType');
    WORKS.forEach(function (c) { var o = document.createElement('option'); o.textContent = c.title; sel.appendChild(o); });
    ['Комплексный проект', 'Ремонт / реставрация', 'Другое'].forEach(function (t) { var o = document.createElement('option'); o.textContent = t; sel.appendChild(o); });
  }

  /* ================== ГАЛЕРЕЯ ================== */
  var current = 'all', shown = 0, list = [];
  var grid = $('#worksGrid'), filtersBox = $('#filters'), moreBtn = $('#worksMore');

  function renderFilters() {
    var items = [{ slug: 'all', title: 'Все работы', n: totalPhotos }].concat(WORKS.map(function (c) { return { slug: c.slug, title: c.title, n: c.items.length }; }));
    filtersBox.innerHTML = items.map(function (c) {
      return '<button type="button" class="chip' + (c.slug === current ? ' is-active' : '') + '" role="tab" aria-selected="' + (c.slug === current) + '" data-f="' + c.slug + '">' + c.title + ' <sup>' + c.n + '</sup></button>';
    }).join('');
  }
  function setFilter(slug) {
    if (slug !== 'all' && !bySlug[slug]) slug = 'all';
    current = slug; list = listFor(slug); shown = 0; grid.innerHTML = '';
    $$('.chip', filtersBox).forEach(function (b) {
      var on = b.getAttribute('data-f') === slug;
      b.classList.toggle('is-active', on); b.setAttribute('aria-selected', on);
      if (on && b.scrollIntoView) b.parentNode.scrollTo({ left: b.offsetLeft - 16, behavior: 'smooth' });
    });
    renderMore();
  }
  function renderMore() {
    var frag = document.createDocumentFragment();
    var next = list.slice(shown, shown + PAGE);
    next.forEach(function (it, i) {
      var idx = shown + i, cat = bySlug[it.slug];
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'work'; b.setAttribute('data-i', idx);
      b.setAttribute('data-label', cat.title);
      b.setAttribute('aria-label', 'Открыть фото: ' + cat.title);
      b.style.animationDelay = (i % PAGE) * 25 + 'ms';
      var img = new Image();
      img.loading = 'lazy'; img.decoding = 'async'; img.alt = cat.title + ' — работа мастерской «Истая Кузница»';
      img.onload = function () { img.classList.add('is-loaded'); };
      var big = grid.children.length + i;            // каждая 7-я плитка — крупная (2×2)
      img.sizes = big % 7 === 0 ? '(max-width: 640px) 134vw, (max-width: 900px) 89vw, 67vw' : '(max-width: 640px) 67vw, (max-width: 900px) 44vw, 33vw';
      img.srcset = srcset(it.slug, it.f);
      img.src = src(it.slug, it.f, true);
      b.appendChild(img); frag.appendChild(b);
    });
    grid.appendChild(frag);
    shown += next.length;
    moreBtn.hidden = shown >= list.length;
    moreBtn.textContent = 'Показать ещё ' + Math.min(PAGE, list.length - shown) + ' из ' + (list.length - shown);
  }
  function initGallery() {
    renderFilters();
    filtersBox.addEventListener('click', function (e) { var b = e.target.closest('[data-f]'); if (b) setFilter(b.getAttribute('data-f')); });
    moreBtn.addEventListener('click', renderMore);
    grid.addEventListener('click', function (e) { var b = e.target.closest('.work'); if (b) openLB(+b.getAttribute('data-i'), b); });
    setFilter('all');
  }

  /* ================== ЛАЙТБОКС ================== */
  var lb = $('#lightbox'), lbImg = $('#lbImg'), lbBox = $('.lightbox__img'), lbIdx = 0, lbOpener = null;
  function showLB(i) {
    lbIdx = (i + list.length) % list.length;
    var it = list[lbIdx], cat = bySlug[it.slug];
    lbBox.classList.add('is-loading');
    var full = src(it.slug, it.f, false);
    var pre = new Image();
    pre.onload = pre.onerror = function () { if (list[lbIdx] === it) { lbImg.src = full; lbBox.classList.remove('is-loading'); } };
    pre.src = full;
    lbImg.alt = cat.title + ' — фото ' + (lbIdx + 1);
    $('#lbTitle').textContent = cat.title;
    $('#lbCount').textContent = (lbIdx + 1) + ' / ' + list.length;
    $('#lbWant').setAttribute('data-cat', cat.title);
    [1, -1].forEach(function (d) { var n = list[(lbIdx + d + list.length) % list.length]; if (n) (new Image()).src = src(n.slug, n.f, false); });
  }
  function openLB(i, opener) {
    lbOpener = opener || null;
    lb.hidden = false; document.body.style.overflow = 'hidden';
    showLB(i); $('.lightbox__close', lb).focus();
  }
  function closeLB() {
    lb.hidden = true; document.body.style.overflow = ''; lbImg.removeAttribute('src');
    if (lbOpener) lbOpener.focus({ preventScroll: true });
  }
  function initLightbox() {
    $('#lbPrev').addEventListener('click', function () { showLB(lbIdx - 1); });
    $('#lbNext').addEventListener('click', function () { showLB(lbIdx + 1); });
    lb.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) closeLB(); });
    $('#lbWant').addEventListener('click', function (e) {
      e.preventDefault();
      var t = this.getAttribute('data-cat'); closeLB();
      var sel = $('#formType'); $$('option', sel).forEach(function (o) { if (o.textContent === t) sel.value = o.value || o.textContent; });
      var it = list[lbIdx], msg = $('#leadForm [name=message]');
      if (it && !msg.value) msg.value = 'Хочу похожее, как на фото: ' + location.origin + location.pathname.replace(/[^/]*$/, '') + src(it.slug, it.f, false);
      $('#contacts').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
      setTimeout(function () { $('#leadForm [name=name]').focus({ preventScroll: true }); }, 600);
    });
    document.addEventListener('keydown', function (e) {
      if (lb.hidden) return;
      if (e.key === 'Escape') closeLB();
      else if (e.key === 'ArrowLeft') showLB(lbIdx - 1);
      else if (e.key === 'ArrowRight') showLB(lbIdx + 1);
      else if (e.key === 'Tab') { // удерживаем фокус внутри окна
        var f = $$('button, a[href]', lb).filter(function (x) { return x.offsetParent; });
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    var x0 = null, y0 = null;
    lb.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) showLB(lbIdx + (dx < 0 ? 1 : -1));
      else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) closeLB();
      x0 = null;
    });
  }

  /* ================== КАРТА ================== */
  function initMap() {
    var btn = $('#mapLoad'), frame = $('#mapFrame'), m = CFG.map || {};
    if (!btn) return;
    var load = function () {
      if (frame.querySelector('iframe')) return;
      var ll = m.lon + '%2C' + m.lat;
      var ifr = document.createElement('iframe');
      ifr.src = 'https://yandex.ru/map-widget/v1/?ll=' + ll + '&z=' + (m.zoom || 10) + '&pt=' + ll + '%2Cpm2orl&l=map';
      ifr.title = 'Карта: г. Донецк'; ifr.loading = 'lazy'; ifr.allowFullscreen = true;
      frame.appendChild(ifr); btn.remove();
    };
    btn.addEventListener('click', load);
  }

  /* ================== ФОРМА ================== */
  function initForm() {
    var form = $('#leadForm'), status = $('#formStatus'), btn = $('.form__submit', form), btnText = $('.form__submit-text', form);
    var ts = $('#formTs'); ts.value = Math.floor(Date.now() / 1000);
    var phone = form.elements.phone;

    // мягкая маска телефона: +7 (XXX) XXX-XX-XX
    phone.addEventListener('input', function () {
      var d = phone.value.replace(/\D/g, '');
      if (!d) { phone.value = ''; return; }
      if (d[0] === '8') d = '7' + d.slice(1);
      if (d[0] === '9' && d.length <= 10) d = '7' + d;          // 949… без кода → +7 949…
      if (d[0] !== '7') { phone.value = '+' + d.slice(0, 15); return; } // другие коды (например +380) — без маски
      d = d.slice(0, 11);
      var r = '+' + d[0];
      if (d.length > 1) r += ' (' + d.slice(1, 4);
      if (d.length >= 4) r += ')';
      if (d.length > 4) r += ' ' + d.slice(4, 7);
      if (d.length > 7) r += '-' + d.slice(7, 9);
      if (d.length > 9) r += '-' + d.slice(9, 11);
      phone.value = r;
    });
    phone.addEventListener('focus', function () { if (!phone.value) phone.value = '+7 '; });
    phone.addEventListener('blur', function () { if (phone.value.replace(/\D/g, '').length <= 1) phone.value = ''; });

    function setStatus(t, ok) { status.textContent = t; status.className = 'form__status' + (ok === true ? ' is-ok' : ok === false ? ' is-err' : ''); }
    function mark(el, bad) { (el.closest('.field') || el.closest('.check')).classList.toggle('is-invalid', bad); }
    $$('input, textarea', form).forEach(function (el) { el.addEventListener('input', function () { mark(el, false); }); el.addEventListener('change', function () { mark(el, false); }); });

    function validate() {
      var ok = true, first = null;
      var name = form.elements.name, agree = form.elements.agree;
      var bad = function (el) { mark(el, true); ok = false; first = first || el; };
      if (name.value.trim().length < 2) bad(name);
      if (phone.value.replace(/\D/g, '').length < 11) bad(phone);
      if (!agree.checked) bad(agree);
      if (!ok) {
        setStatus(!agree.checked && name.value.trim().length >= 2 && phone.value.replace(/\D/g, '').length >= 11
          ? 'Отметьте согласие на обработку персональных данных.' : 'Проверьте имя и номер телефона.', false);
        first.focus();
      }
      return ok;
    }

    function leadText() {
      var f = form.elements, lines = ['Заявка с сайта «Истая Кузница»', 'Имя: ' + f.name.value.trim(), 'Телефон: ' + f.phone.value.trim()];
      if (f.type.value) lines.push('Что нужно: ' + f.type.value);
      if (f.city.value.trim()) lines.push('Город: ' + f.city.value.trim());
      if (f.message.value.trim()) lines.push('Комментарий: ' + f.message.value.trim());
      return lines.join('\n');
    }

    // запасной вариант — отправка через мессенджер (если на хостинге нет PHP)
    var dlg = $('#sendVia');
    function openSendVia() {
      var text = leadText();
      $('#sendViaText').textContent = text;
      try { navigator.clipboard && navigator.clipboard.writeText(text); } catch (e) {}
      var links = messengerLinks(text).filter(function (m) { return m.k === 'tg' || m.k === 'wa' || m.k === 'max'; });
      var html = links.map(function (m) { return '<a class="btn btn--ghost" href="' + m.href + '" target="_blank" rel="noopener">' + m.name + '</a>'; }).join('');
      if (C.phone) html += '<a class="btn btn--fire" href="tel:' + C.phone + '">Позвонить ' + (C.phoneDisplay || C.phone) + '</a>';
      if (C.email) html += '<a class="btn btn--ghost" href="mailto:' + C.email + '?subject=' + encodeURIComponent('Заявка с сайта') + '&body=' + encodeURIComponent(text) + '">Отправить на почту</a>';
      $('#sendViaBtns').innerHTML = html;
      dlg.hidden = false;
      $('.dialog__close', dlg).focus();
    }
    dlg.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) dlg.hidden = true; });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !dlg.hidden) dlg.hidden = true; });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      setStatus('');
      if (!validate()) return;
      var endpoint = CFG.formEndpoint;
      if (!endpoint || location.protocol === 'file:' || /github\.io$/.test(location.hostname)) { openSendVia(); goal('lead_messenger'); return; }

      btn.classList.add('is-loading'); btnText.textContent = 'Отправляем…';
      var ctrl = window.AbortController ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 20000);
      fetch(endpoint, { method: 'POST', body: new FormData(form), headers: { 'Accept': 'application/json' }, signal: ctrl ? ctrl.signal : undefined })
        .then(function (r) {
          var ct = r.headers.get('content-type') || '';
          if (ct.indexOf('json') < 0) throw new Error('nophp');
          return r.json();
        })
        .then(function (res) {
          if (res && res.ok) {
            form.reset(); ts.value = Math.floor(Date.now() / 1000);
            setStatus('Спасибо! Заявка отправлена — мы перезвоним в ближайшее время.', true);
            goal('lead_form');
          } else {
            setStatus((res && res.error) || 'Не удалось отправить. Попробуйте ещё раз или позвоните нам.', false);
          }
        })
        .catch(function (err) {
          if (err && err.message === 'nophp') { openSendVia(); goal('lead_messenger'); return; }
          setStatus('Нет связи с сервером. Проверьте интернет или позвоните нам' + (C.phoneDisplay ? ': ' + C.phoneDisplay : '.'), false);
        })
        .then(function () { clearTimeout(timer); btn.classList.remove('is-loading'); btnText.textContent = 'Отправить заявку'; });
    });

    // цели метрики на звонки и мессенджеры
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href]'); if (!a) return;
      var h = a.getAttribute('href');
      if (h.indexOf('tel:') === 0) goal('click_phone');
      else if (/t\.me|wa\.me|max\.ru|vk\.com/.test(h)) goal('click_messenger');
    });
  }

  /* ================== ЗАПУСК ================== */
  applyContacts();
  addSchema();
  initHeader();
  initSparks();
  initServices();
  initGallery();
  initLightbox();
  initMap();
  initForm();
  observeReveal(document);
  addMetrika();
})();
