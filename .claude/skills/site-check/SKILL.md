---
name: site-check
description: Визуальная и техническая проверка сайта «Истая Кузница» после правок — локальный сервер, скриншоты ПК/мобильного, горизонтальный скролл, ошибки консоли, битые картинки. Использовать после любых изменений вёрстки, стилей, JS или фото.
---

# Проверка сайта

1. Сервер: `.claude/launch.json`, конфигурация `site` (`python -m http.server 8080`) — запуск через preview_start
   или Playwright MCP из `.mcp.json`. PHP локально нет, форма не отправляется — это ожидаемо.
2. Размеры: 1440×900, 1024×768, 375×812. В консоли страницы:
   ```js
   ({ hScroll: document.documentElement.scrollWidth > innerWidth,
      broken: [...document.images].filter(i => i.complete && i.src && !i.naturalWidth).map(i => i.src),
      works: (window.IK_WORKS || []).reduce((n, c) => n + c.items.length, 0) })
   ```
   плюс ошибки консоли (onlyErrors).
3. Пройдите секции `#about`, `#projects`, `#works`, `#process`, `#contacts`, `#map` (перед `scrollTo` задайте
   `document.documentElement.style.scrollBehavior = 'auto'`) и проверьте:
   - «живое железо»: побеги по краям только при ширине ≥ 1100 px, извиваются при прокрутке, концы светятся;
     разделители `.iron-divider` прорисовываются при прокрутке;
   - галерея: фильтры, «Показать ещё», лайтбокс (←/→/Esc, подпись не обрезана);
   - карта: тёмная, без рекламной плашки, маршруты Яндекс/2ГИС/Google.
4. Первый скриншот после `location.reload()` во встроенном браузере бывает чёрным — сделайте второй.
5. В конце верните окно: `resize_window` preset `desktop`.
