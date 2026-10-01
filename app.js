/* ============================================================
   ҰБТ Даярлық — қосымша логикасы
   Сервер жоқ, авторизация жоқ. Прогресс тек осы құрылғыда
   (localStorage) сақталады. Барлық сабақ әрқашан ашық.
   ============================================================ */
(function () {
  'use strict';

  var CFG = window.CONFIG || {};
  var COURSES = (window.COURSES = window.COURSES || {});
  var RES = (window.RESOURCES = window.RESOURCES || {});
  var SUBJECTS = CFG.subjects || [];
  var app = document.getElementById('app');

  var DAY_NAMES = { 'дс': 'Дүйсенбі', 'сс': 'Сейсенбі', 'ср': 'Сәрсенбі', 'бс': 'Бейсенбі', 'жм': 'Жұма', 'сб': 'Сенбі', 'жс': 'Жексенбі' };
  var MONTHS = ['қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым', 'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан'];
  var ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];
  var DAY_MS = 864e5;

  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var usingKeyboard = false; // фокусты тек пернетақта қолданушысына қайтарамыз
  document.addEventListener('keydown', function (e) { if (e.key === 'Tab' || e.key === 'Enter' || e.key === ' ') usingKeyboard = true; }, true);
  document.addEventListener('pointerdown', function () { usingKeyboard = false; }, true);
  var TODAY = startOfToday();

  /* ---------- Көмекші функциялар ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function pad(n) { n = String(n); return n.length < 2 ? '0' + n : n; }
  function icon(name, cls) {
    return '<svg class="ic' + (cls ? ' ' + cls : '') + '" aria-hidden="true" focusable="false"><use href="#i-' + name + '"></use></svg>';
  }
  function safeUrl(u) {
    u = String(u || '').trim();
    return /^(https?:\/\/|assets\/|\.\/|mailto:|tg:)/i.test(u) ? u : '';
  }
  function isoDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fmtDay(d) { return d.getDate() + ' ' + MONTHS[d.getMonth()]; }
  function fmtRange(a, b) {
    if (a.getMonth() === b.getMonth()) return a.getDate() + ' — ' + b.getDate() + ' ' + MONTHS[b.getMonth()];
    return fmtDay(a) + ' — ' + fmtDay(b);
  }
  function fmtStamp(ts) {
    if (typeof ts !== 'number') return '';
    var d = new Date(ts);
    return fmtDay(d) + ', ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function fmtSize(bytes) {
    if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + ' КБ';
    return (bytes / 1024 / 1024).toFixed(1).replace('.', ',') + ' МБ';
  }
  function sameDay(a, b) { return a.getTime() === b.getTime(); }
  function startOfToday() {
    // Тексеру үшін: ?today=2026-11-20 — басқа күнді «бүгін» деп алады
    var q = /[?&]today=(\d{4})-(\d{2})-(\d{2})/.exec(location.search);
    if (q) return new Date(+q[1], +q[2] - 1, +q[3]);
    var t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }
  function relDay(date) {
    var diff = Math.round((date - TODAY) / DAY_MS);
    if (diff <= 0) return 'Бүгін';
    if (diff === 1) return 'Ертең';
    return diff + ' күннен кейін';
  }
  function find(arr, fn) { for (var i = 0; i < arr.length; i++) if (fn(arr[i])) return arr[i]; return null; }
  function smooth() { return reduceMotion ? 'auto' : 'smooth'; }

  /* ---------- Сақтау (тек осы құрылғыда) ---------- */
  var KEY = 'ubt-prep-v1';
  var state = load();
  function load() {
    var base = { name: '', last: '', progress: {} };
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || '{}');
      if (raw && typeof raw === 'object') {
        if (typeof raw.name === 'string') base.name = raw.name;
        if (typeof raw.last === 'string') base.last = raw.last;
        if (raw.progress && typeof raw.progress === 'object') base.progress = raw.progress;
      }
    } catch (e) { /* жеке режим немесе бүлінген дерек */ }
    return base;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* орын жоқ — елемейміз */ }
  }
  function prog(cid, n) {
    var k = cid + ':' + n;
    var p = state.progress[k];
    if (!p || typeof p !== 'object') p = state.progress[k] = { video: false, sent: {} };
    if (!p.sent || typeof p.sent !== 'object') p.sent = {};
    return p;
  }

  /* ---------- Пән деректері ---------- */
  function subjectMeta(id) { return find(SUBJECTS, function (s) { return s.id === id; }); }
  function readySubjects() { return SUBJECTS.filter(function (s) { return s.ready && COURSES[s.id]; }); }

  function lessonsOf(c) {
    if (c._lessons) return c._lessons;
    var control = {};
    (c.controlLessons || []).forEach(function (n) { control[n] = true; });
    var out = [];
    c.quarters.forEach(function (q) {
      q.sections.forEach(function (s, si) {
        s.rows.forEach(function (r) {
          var dm = String(r[1]).split('.');
          var dd = +dm[0], mm = +dm[1];
          var year = mm >= 8 ? c.startYear : c.startYear + 1;
          out.push({
            course: c.id,
            n: r[0],
            date: new Date(year, mm - 1, dd),
            day: DAY_NAMES[r[2]] || r[2] || '',
            topic: r[3],
            prep: r[4],
            q: q.n,
            part: si,
            control: !!control[r[0]],
            ent: /ЕНТ|ҰБТ/.test(r[3]),
            practice: /^Практика/i.test(r[3])
          });
        });
      });
    });
    out.sort(function (a, b) { return a.n - b.n; });
    c._lessons = out;
    return out;
  }
  function quarterRange(lessons, qn) {
    var ls = lessons.filter(function (l) { return l.q === qn; });
    return ls.length ? fmtRange(ls[0].date, ls[ls.length - 1].date) : '';
  }
  function categoriesFor(cid, n) {
    var r = (RES[cid] || {})[n];
    return (r && r.categories && r.categories.length) ? r.categories : (CFG.categories || []);
  }
  function sentCount(cid, n) {
    var sent = prog(cid, n).sent;
    return categoriesFor(cid, n).filter(function (c) { return sent[c.id]; }).length;
  }
  function isDone(cid, n) {
    var cats = categoriesFor(cid, n);
    return cats.length > 0 && sentCount(cid, n) === cats.length;
  }
  function nextLesson(lessons) {
    return find(lessons, function (l) { return l.date >= TODAY; });
  }
  function nextAcrossSubjects() {
    var best = null;
    readySubjects().forEach(function (s) {
      var l = nextLesson(lessonsOf(COURSES[s.id]));
      if (l && (!best || l.date < best.date)) best = l;
    });
    return best;
  }
  function lessonByRoute(hash) {
    var m = /^#\/([a-z0-9-]+)\/(\d+)$/i.exec(hash || '');
    if (!m || !COURSES[m[1]]) return null;
    return find(lessonsOf(COURSES[m[1]]), function (l) { return l.n === +m[2]; });
  }

  /* ---------- Ортақ HTML бөліктері ---------- */
  function tagsHTML(l) {
    var t = '';
    if (l.control) t += '<span class="tag tag-control">Бақылау</span>';
    if (l.ent) t += '<span class="tag tag-ent">ҰБТ</span>';
    if (l.practice) t += '<span class="tag tag-practice">Практика</span>';
    return t;
  }
  function flagHTML(l, nxt) {
    if (!nxt || nxt.course !== l.course || nxt.n !== l.n) return '';
    var today = sameDay(l.date, TODAY);
    return '<span class="flag">' + icon('bolt') + (today ? 'Бүгін' : 'Келесі сабақ') + '</span>';
  }
  function ticksHTML(cid, n) {
    var cats = categoriesFor(cid, n);
    var sent = prog(cid, n).sent;
    var k = 0;
    var cells = cats.map(function (c) { if (sent[c.id]) k++; return '<i class="' + (sent[c.id] ? 'on' : '') + '"></i>'; }).join('');
    return '<span class="ticks" role="img" aria-label="' + cats.length + ' санаттың ' + k + '-і жіберілді">' + cells + '</span>';
  }
  function crumbs(items) {
    return '<nav class="crumbs" aria-label="Бет жолы">' + items.map(function (it, i) {
      var sep = i ? '<span class="sep" aria-hidden="true">/</span>' : '';
      return sep + (it.href ? '<a href="' + it.href + '">' + esc(it.label) + '</a>' : '<span aria-current="page">' + esc(it.label) + '</span>');
    }).join('') + '</nav>';
  }
  function setTitle(t) {
    var base = CFG.siteTitle || 'ҰБТ Даярлық';
    document.title = t ? t + ' · ' + base : base;
  }

  /* ---------- Шапка мен төменгі бөлік ---------- */
  function renderChrome(activeId, isLesson) {
    var mark = document.getElementById('brandMark');
    var name = document.getElementById('brandName');
    if (CFG.brandMark) mark.textContent = CFG.brandMark;
    if (CFG.brandName) name.textContent = CFG.brandName;
    document.getElementById('brand').setAttribute('aria-label', (CFG.siteTitle || 'ҰБТ Даярлық') + ' — басты бет');

    document.getElementById('nav').innerHTML = SUBJECTS.map(function (s) {
      if (!s.ready || !COURSES[s.id]) {
        return '<button type="button" class="nav-link is-soon" data-act="soon" data-title="' + esc(s.title) + '" aria-label="' + esc(s.title) + ' — жақында">' +
          esc(s.title) + '<span class="nav-soon" aria-hidden="true">жақында</span></button>';
      }
      var cur = activeId === s.id ? (isLesson ? ' aria-current="true"' : ' aria-current="page"') : '';
      return '<a class="nav-link" href="#/' + s.id + '"' + cur + '>' + esc(s.title) + '</a>';
    }).join('');

    var link = safeUrl(CFG.teacherLink);
    document.getElementById('footer').innerHTML =
      '<div class="ftr-brand"><span class="brand-mark">' + esc(CFG.brandMark || 'ҰБТ') + '</span>' + esc(CFG.siteTitle || '') +
        (CFG.teacher ? ' · ' + esc(CFG.teacher) : '') + '</div>' +
      '<p>Барлық сабақ әрқашан ашық. Нәтижең тек осы құрылғыда сақталады.</p>' +
      (link ? '<a href="' + esc(link) + '" target="_blank" rel="noopener">Ұстазға жазу</a>' : '<span></span>');
  }

  /* ---------- Toast ---------- */
  var toastTimer = null;
  var toastIcons = { success: 'check', error: 'alert', info: 'info' };
  function toast(msg, type, action) {
    type = type || 'success';
    var zone = document.getElementById('toastZone');
    clearTimeout(toastTimer);
    zone.innerHTML = '<div class="toast is-' + type + (action ? '' : ' no-action') + '">' +
      '<span class="t-ic">' + icon(toastIcons[type] || 'info') + '</span><span>' + esc(msg) + '</span>' +
      (action ? '<button type="button" class="toast-act" data-act="toast-action">' + esc(action.label) + '</button>' : '') + '</div>';
    toast.action = action ? action.fn : null;
    toastTimer = setTimeout(hideToast, action ? 6000 : 3800);
  }
  function hideToast() {
    var el = document.querySelector('#toastZone .toast');
    if (!el) return;
    el.classList.add('is-out');
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, reduceMotion ? 0 : 170);
    toast.action = null;
  }

  /* ============================================================
     БАСТЫ БЕТ
     ============================================================ */
  function renderHome() {
    renderChrome('');
    setTitle('');
    var ready = readySubjects();
    var total = 0, quarters = 0, years = {};
    ready.forEach(function (s) {
      var c = COURSES[s.id];
      total += lessonsOf(c).length;
      quarters = Math.max(quarters, c.quarters.length);
      years[c.year] = true;
    });
    var first = ready[0] ? COURSES[ready[0].id] : null;
    var nxt = nextAcrossSubjects();
    var last = lessonByRoute(state.last);

    var resume = '';
    if (last && (!nxt || last.course !== nxt.course || last.n !== nxt.n)) {
      resume = '<a class="resume" href="#/' + last.course + '/' + last.n + '">' + icon('refresh', 'ic-sm') +
        '<span>Соңғы ашқаның:</span><b>' + pad(last.n) + ' · ' + esc(last.topic) + '</b></a>';
    }

    var hero =
      '<section class="hero" aria-labelledby="hero-title">' +
        '<div class="hero-copy">' +
          '<p class="eyebrow">' + esc(ready.map(function (s) { return s.title; }).join(' · ')) + ' · ' + esc(Object.keys(years).join(', ')) + '</p>' +
          '<h1 class="display" id="hero-title" tabindex="-1">' + total + ' сабақ.<br>Бір мақсат — <span class="hl">ҰБТ.</span></h1>' +
          '<p class="lead">Бейнені көр, тапсырманы орында, суретін ұстазға жібер. Барлық сабақ әрқашан ашық.</p>' +
        '</div>' +
        nextCardHTML(nxt, first) +
        '<div class="hero-more">' +
          ((first && nxt) || resume ? '<div class="hero-actions">' +
            (first && nxt ? '<a class="btn btn-outline" href="#/' + first.id + '">Барлық сабақтар' + icon('arrow-right', 'ic-go') + '</a>' : '') +
            resume + '</div>' : '') +
          '<ul class="stats" aria-label="Қысқаша">' +
            '<li><b>' + total + '</b><span>сабақ</span></li>' +
            '<li><b>' + quarters + '</b><span>тоқсан</span></li>' +
            '<li><b>' + (first && first.daysLabel ? first.daysLabel.split('·').length : 2) + '</b><span>сабақ аптасына</span></li>' +
          '</ul>' +
        '</div>' +
      '</section>';

    var subjects = SUBJECTS.map(subjectCardHTML).join('');

    var steps =
      '<ol class="steps">' +
        '<li class="step s-blue"><div class="step-top"><span class="step-no">1</span>' + icon('video') + '</div>' +
          '<h3>Бейнесабақты көр</h3><p>Әр сабақта бейне, қосымша ресурстар және дайындық тақырыбы бар.</p></li>' +
        '<li class="step s-lime"><div class="step-top"><span class="step-no">2</span>' + icon('notebook') + '</div>' +
          '<h3>Тапсырманы орында</h3><p>Конспект жаз, практиканы және ҰБТ есептерін шығар.</p></li>' +
        '<li class="step s-pink"><div class="step-top"><span class="step-no">3</span>' + icon('send') + '</div>' +
          '<h3>Суретін жібер</h3><p>Суретке түсір де, «Бөлісу» бас: Telegram не WhatsApp-ты өзің таңдайсың. Сосын ✅ қойылады.</p></li>' +
      '</ol>';

    app.innerHTML =
      '<div class="wrap page">' + hero +
        '<section class="block" aria-labelledby="subj-title"><div class="block-head"><h2 class="h2" id="subj-title">Пәндер</h2></div>' +
          '<div class="subj-grid">' + subjects + '</div></section>' +
        '<section class="block" aria-labelledby="how-title"><div class="block-head"><h2 class="h2" id="how-title">Қалай жұмыс істейді</h2>' +
          '<p>Үш қадам — әр сабақ сайын.</p></div>' + steps + '</section>' +
      '</div>';
  }

  function nextCardHTML(l, first) {
    if (!l) {
      if (!first) return '';
      return '<article class="next next-end q2 on-lime" aria-labelledby="next-title">' +
        '<p class="eyebrow">Оқу жылы аяқталды</p>' +
        '<h2 class="h3" id="next-title">Жарайсың! Барлық сабақ ашық күйінде қалады.</h2>' +
        '<p>Кез келген тақырыпты қайта қарап, ҰБТ-ға дейін қайтала.</p>' +
        '<a class="btn btn-cta btn-block" href="#/' + first.id + '">Сабақтарға өту' + icon('arrow-right', 'ic-go') + '</a></article>';
    }
    var c = COURSES[l.course];
    var k = sentCount(l.course, l.n), total = categoriesFor(l.course, l.n).length;
    return '<article class="next q' + l.q + (l.q === 2 ? ' on-lime' : '') + '" aria-labelledby="next-title">' +
      '<div class="next-top"><span class="eyebrow">Келесі сабақ' + (readySubjects().length > 1 ? ' · ' + esc(c.title) : '') + '</span>' +
        '<span class="flag">' + icon('bolt') + relDay(l.date) + '</span></div>' +
      '<p class="next-date"><time datetime="' + isoDate(l.date) + '">' + fmtDay(l.date) + '</time>' +
        '<span>' + esc(l.day) + ' · ' + pad(l.n) + '-сабақ · ' + l.q + '-тоқсан</span></p>' +
      '<h2 class="next-title" id="next-title">' + esc(l.topic) + '</h2>' +
      '<div class="prep-card">' + icon('book') + '<div><p class="prep-l">Дайындық' + (c.prepTime ? ' · ' + esc(c.prepTime) : '') + '</p>' +
        '<p class="prep-t">' + esc(l.prep) + '</p></div></div>' +
      '<a class="btn btn-cta btn-block" href="#/' + l.course + '/' + l.n + '">Сабаққа өту' + icon('arrow-right', 'ic-go') + '</a>' +
      (k ? '<p class="next-progress">' + k + ' / ' + total + ' ✅ жіберілді</p>' : '') +
      '</article>';
  }

  function subjectCardHTML(s) {
    var ic = '<span class="subj-ic">' + icon(s.icon || 'book') + '</span>';
    if (!s.ready || !COURSES[s.id]) {
      return '<div class="subj is-soon" aria-label="' + esc(s.title) + ' — жақында">' +
        '<div class="subj-top">' + ic + '<span class="pill pill-line">' + icon('clock', 'ic-sm') + 'Жақында</span></div>' +
        '<h3>' + esc(s.title) + '</h3><p>' + esc(s.tagline || 'Сабақтар жақында қосылады') + '</p></div>';
    }
    var c = COURSES[s.id];
    var ls = lessonsOf(c);
    var done = ls.filter(function (l) { return isDone(s.id, l.n); }).length;
    var map = c.quarters.map(function (q) {
      var cnt = ls.filter(function (l) { return l.q === q.n; }).length;
      return '<i class="q' + q.n + '" style="flex:' + cnt + ';background:var(--q)" title="' + q.n + '-тоқсан · ' + cnt + ' сабақ"></i>';
    }).join('');
    return '<article class="subj is-live">' +
      '<div class="subj-top">' + ic + '<div class="subj-chips"><span class="pill">' + ls.length + ' сабақ</span><span class="pill">' + c.quarters.length + ' тоқсан</span></div></div>' +
      '<h3><a class="subj-link" href="#/' + s.id + '">' + esc(s.title) + '</a></h3>' +
      '<p>' + esc(s.tagline || '') + '</p>' +
      '<div class="yearmap" role="img" aria-label="Тоқсандар бойынша сабақ саны">' + map + '</div>' +
      '<div class="subj-foot"><span class="num">' + done + ' / ' + ls.length + ' сабақ орындалды</span><span class="subj-go" aria-hidden="true">' + icon('arrow-right') + '</span></div>' +
      '</article>';
  }

  /* ============================================================
     ПӘН БЕТІ
     ============================================================ */
  var filter = 'all';
  var returnTo = null; // сабақтан қайтқанда карточкаға айналдыру

  function filterDefs(c, lessons) {
    var defs = [{ key: 'all', label: 'Барлығы', test: function () { return true; } }];
    c.quarters.forEach(function (q) {
      defs.push({ key: 'q' + q.n, label: q.n + '-тоқсан', q: q.n, test: function (l) { return l.q === q.n; } });
    });
    defs.push({ key: 'control', label: 'Бақылау', test: function (l) { return l.control; } });
    defs.push({ key: 'ent', label: 'ҰБТ тапсырмалары', test: function (l) { return l.ent; } });
    defs.forEach(function (d) { d.count = lessons.filter(d.test).length; });
    return defs;
  }

  function renderCourse(id) {
    var c = COURSES[id];
    renderChrome(id, false);
    setTitle(c.title);
    var lessons = lessonsOf(c);
    var defs = filterDefs(c, lessons);
    if (!find(defs, function (d) { return d.key === filter; })) filter = 'all';
    var nxt = nextLesson(lessons);
    var done = lessons.filter(function (l) { return isDone(id, l.n); }).length;
    var pct = lessons.length ? done / lessons.length : 0;

    var chips = defs.map(function (d) {
      var dot = d.q ? '<span class="fchip-dot q' + d.q + '" style="background:var(--q)" aria-hidden="true"></span>' : '';
      return '<button type="button" class="fchip" data-filter="' + d.key + '" aria-pressed="' + (filter === d.key) + '">' +
        dot + esc(d.label) + '<span class="fchip-n" aria-label="' + d.count + ' сабақ">' + d.count + '</span></button>';
    }).join('');

    var rules = (c.rules || []).map(function (r, i) {
      var key = /Бақылау/.test(r);
      return '<li' + (key ? ' class="is-key"' : '') + '><span class="rule-n">' + pad(i + 1) + '</span><p>' + esc(r) + '</p></li>';
    }).join('');

    var cta = nxt
      ? '<a class="btn btn-cta" href="#/' + id + '/' + nxt.n + '">' + (sameDay(nxt.date, TODAY) ? 'Бүгінгі сабақ' : 'Келесі сабақ') + ' · ' + pad(nxt.n) + icon('arrow-right', 'ic-go') + '</a>'
      : '';

    app.innerHTML =
      '<div class="wrap page">' +
        crumbs([{ label: 'Басты бет', href: '#/' }, { label: c.title }]) +
        '<section class="course-head">' +
          '<div class="ch-copy">' +
            '<p class="eyebrow">ҰБТ · ' + esc(c.year) + '</p>' +
            '<h1 class="h1" tabindex="-1">' + esc(c.title) + '</h1>' +
            '<p class="lead">' + lessons.length + ' сабақ · ' + c.quarters.length + ' тоқсан · ' + esc(c.daysLabel || '') + '</p>' +
            cta +
          '</div>' +
          '<div class="progress-card">' +
            '<p class="eyebrow">Сенің нәтижең</p>' +
            '<p class="pc-big"><b id="pcDone">' + done + ' / ' + lessons.length + '</b><span>сабақ толық орындалды</span></p>' +
            '<div class="bar" role="progressbar" aria-label="Толық орындалған сабақтар" aria-valuemin="0" aria-valuemax="' + lessons.length + '" aria-valuenow="' + done + '"><i style="--p:0" data-p="' + pct + '"></i></div>' +
            '<p class="pc-note">Сабақ толық орындалады, егер ' + (CFG.categories || []).length + ' санаттың бәріне ✅ қойылса.</p>' +
          '</div>' +
        '</section>' +
        '<div class="filters-sentinel" aria-hidden="true"></div>' +
        '<div class="filters"><div class="filters-row" role="group" aria-label="Сабақтарды сүзу">' + chips + '</div></div>' +
        '<p class="vh" role="status" id="filterStatus"></p>' +
        '<div id="courseList">' + courseListHTML(c, lessons, defs, nxt) + '</div>' +
        '<section class="block" aria-labelledby="rules-title">' +
          '<div class="block-head"><h2 class="h2" id="rules-title">' + esc(c.rulesTitle || 'Дайындық ережелері') + '</h2></div>' +
          '<ol class="rules">' + rules + '</ol>' +
          '<div class="info-grid">' +
            (c.howTo ? '<div class="info-card">' + icon('book', 'ic-lg') + '<div><h3>Қалай пайдалану керек</h3><p>' + esc(c.howTo) + '</p></div></div>' : '') +
            (c.breaks || c.holidays ? '<div class="info-card is-pink">' + icon('calendar', 'ic-lg') + '<div><h3>Каникул және мерекелер</h3><p>' + esc(c.breaks || '') + ' ' + esc(c.holidays || '') + '</p></div></div>' : '') +
          '</div>' +
        '</section>' +
      '</div>';

    animateBars();
    watchSticky();
  }

  function courseListHTML(c, lessons, defs, nxt) {
    var def = find(defs, function (d) { return d.key === filter; }) || defs[0];
    var html = c.quarters.map(function (q) {
      var qLessons = lessons.filter(function (l) { return l.q === q.n; });
      var qDone = qLessons.filter(function (l) { return isDone(c.id, l.n); }).length;
      var multi = q.sections.length > 1;
      var parts = q.sections.map(function (s, si) {
        var items = qLessons.filter(function (l) { return l.part === si && def.test(l); });
        if (!items.length) return '';
        var total = qLessons.filter(function (l) { return l.part === si; }).length;
        return '<div class="part">' +
          '<div class="part-head"><h3>' + (multi ? '<small>' + (si + 1) + '-бөлім · </small>' : '') + esc(s.title) + '</h3>' +
          '<span>' + (items.length === total ? total + ' сабақ' : items.length + ' / ' + total + ' сабақ') + '</span></div>' +
          '<div class="lessons">' + items.map(function (l) { return lessonCardHTML(l, nxt); }).join('') + '</div></div>';
      }).join('');
      if (!parts) return '';
      return '<section class="quarter" id="q-' + q.n + '" aria-labelledby="qt-' + q.n + '">' +
        '<header class="q-band q' + q.n + '">' +
          '<span class="q-roman" aria-hidden="true">' + (ROMAN[q.n] || q.n) + '</span>' +
          '<p class="q-kicker">' + q.n + '-тоқсан · ' + quarterRange(lessons, q.n) + '</p>' +
          '<h2 class="h2" id="qt-' + q.n + '">' + esc(q.title) + '</h2>' +
          '<div class="q-meta"><span class="pill">' + qLessons.length + ' сабақ</span><span class="pill num">' + qDone + ' / ' + qLessons.length + ' ✅</span></div>' +
        '</header>' + parts + '</section>';
    }).join('');
    if (!html) {
      html = '<div class="empty empty-filter"><span class="empty-ic">' + icon('list') + '</span>' +
        '<b>Бұл сүзгіде сабақ жоқ</b><span>Басқа сүзгіні таңда немесе барлық сабақты көрсет.</span>' +
        '<button type="button" class="btn btn-outline btn-sm" data-filter="all">Барлығын көрсету</button></div>';
    }
    return html;
  }

  function lessonCardHTML(l, nxt) {
    var cid = l.course;
    var done = isDone(cid, l.n);
    var isNext = nxt && nxt.n === l.n;
    var k = sentCount(cid, l.n), total = categoriesFor(cid, l.n).length;
    var tags = flagHTML(l, nxt) + tagsHTML(l);
    return '<article class="lcard q' + l.q + (done ? ' is-done' : '') + (isNext ? ' is-next' : '') + '" id="l-' + l.n + '">' +
      '<div class="lc-top"><span class="lc-num" aria-hidden="true">' + pad(l.n) + '</span>' +
        '<span class="lc-date"><time datetime="' + isoDate(l.date) + '">' + fmtDay(l.date) + '</time> · ' + esc(l.day) + '</span></div>' +
      (tags ? '<div class="lc-tags">' + tags + '</div>' : '') +
      '<h4 class="lc-title"><a class="lc-link" href="#/' + cid + '/' + l.n + '"><span class="vh">' + pad(l.n) + '-сабақ: </span>' + esc(l.topic) + '</a></h4>' +
      '<p class="lc-prep"><b>Дайындық:</b> ' + esc(l.prep) + '</p>' +
      '<div class="lc-foot">' + ticksHTML(cid, l.n) +
        '<span class="lc-status">' + (done ? '✅ Орындалды' : k + ' / ' + total) + '</span>' + icon('arrow-right', 'lc-go') + '</div>' +
      '</article>';
  }

  function applyFilter(key) {
    var m = /^#\/([a-z0-9-]+)$/i.exec(location.hash);
    var c = m && COURSES[m[1]];
    if (!c) return;
    filter = key;
    var lessons = lessonsOf(c);
    var defs = filterDefs(c, lessons);
    var def = find(defs, function (d) { return d.key === key; }) || defs[0];
    Array.prototype.forEach.call(document.querySelectorAll('.fchip'), function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-filter') === key));
    });
    document.getElementById('courseList').innerHTML = courseListHTML(c, lessons, defs, nextLesson(lessons));
    var st = document.getElementById('filterStatus');
    if (st) st.textContent = def.label + ': ' + def.count + ' сабақ';
    // Тізім басынан төмен тұрсақ — тізім басына ораламыз
    var sentinel = document.querySelector('.filters-sentinel');
    if (sentinel) {
      var top = sentinel.getBoundingClientRect().top + window.pageYOffset - 64;
      if (window.pageYOffset > top) window.scrollTo({ top: top, behavior: smooth() });
    }
    var chip = document.querySelector('.fchip[data-filter="' + key + '"]');
    if (chip && chip.scrollIntoView) chip.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: smooth() });
  }

  var stickyObs = null;
  function watchSticky() {
    if (stickyObs) { stickyObs.disconnect(); stickyObs = null; }
    var s = document.querySelector('.filters-sentinel');
    var f = document.querySelector('.filters');
    if (!s || !f || !window.IntersectionObserver) return;
    stickyObs = new IntersectionObserver(function (entries) {
      f.classList.toggle('is-stuck', !entries[0].isIntersecting && entries[0].boundingClientRect.top < 80);
    }, { rootMargin: '-65px 0px 0px 0px', threshold: 0 });
    stickyObs.observe(s);
  }

  function animateBars() {
    var bars = document.querySelectorAll('.bar i[data-p]');
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        Array.prototype.forEach.call(bars, function (b) { b.style.setProperty('--p', b.getAttribute('data-p')); });
      });
    });
  }

  /* ============================================================
     САБАҚ БЕТІ
     ============================================================ */
  var ui = {}; // "пән:нөмір:санат" -> { photo: {file, url, size}, status, error, copied }

  function ukey(l, catId) { return l.course + ':' + l.n + ':' + catId; }
  function uiFor(l, catId) {
    var k = ukey(l, catId);
    return ui[k] || (ui[k] = { status: 'idle' });
  }

  function videoHTML(v, topic) {
    v = String(v || '').trim();
    if (!v) {
      return '<div class="empty is-video"><span class="empty-ic">' + icon('play') + '</span>' +
        '<b>Бейнесабақ жақында қосылады</b><span>Ұстаз бейнені жүктегенде, ол осы жерде ашылады.</span></div>';
    }
    var title = 'Бейнесабақ: ' + esc(topic);
    var yt = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/.exec(v) || (/^[\w-]{11}$/.test(v) ? [null, v] : null);
    if (yt) {
      return '<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/' + yt[1] + '?rel=0&amp;playsinline=1" title="' + title + '" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>';
    }
    var dr = /drive\.google\.com\/(?:file\/d\/|open\?id=)([\w-]+)/.exec(v);
    if (dr) {
      return '<div class="video"><iframe src="https://drive.google.com/file/d/' + dr[1] + '/preview" title="' + title + '" loading="lazy" allow="autoplay; fullscreen"></iframe></div>';
    }
    var url = safeUrl(v);
    if (url && /\.(mp4|webm|m4v|mov)(\?|#|$)/i.test(url)) {
      return '<div class="video"><video controls playsinline preload="metadata" src="' + esc(url) + '" aria-label="' + title + '"></video></div>';
    }
    if (url) {
      return '<a class="res-a" href="' + esc(url) + '" target="_blank" rel="noopener"><span class="res-kind">Бейне</span>' +
        '<span class="res-t">Бейнесабақты ашу</span>' + icon('external') + '</a>';
    }
    return videoHTML('', topic);
  }

  function extraHTML(list) {
    list = (list || []).filter(function (e) { return e && e.title && safeUrl(e.url); });
    if (!list.length) {
      return '<div class="empty is-row"><span class="empty-ic">' + icon('layers') + '</span>' +
        '<b>Қосымша ресурстар жақында қосылады</b><span>Конспект, кесте және пайдалы сілтемелер осында болады.</span></div>';
    }
    return '<ul class="res-list">' + list.map(function (e) {
      var url = safeUrl(e.url);
      var ext = /^https?:/i.test(url);
      var kind = e.kind || (/\.pdf(\?|#|$)/i.test(url) ? 'PDF' : ext ? 'Сайт' : 'Файл');
      return '<li><a class="res-a" href="' + esc(url) + '"' + (ext ? ' target="_blank" rel="noopener"' : ' target="_blank"') + '>' +
        '<span class="res-kind">' + esc(kind) + '</span><span class="res-t">' + esc(e.title) + '</span>' +
        icon(ext ? 'external' : 'download') + '</a></li>';
    }).join('') + '</ul>';
  }

  function tasksHTML(list) {
    list = (list || []).filter(function (t) { return t && (t.title || t.text); });
    if (!list.length) {
      return '<div class="empty is-row"><span class="empty-ic">' + icon('list') + '</span>' +
        '<b>Тапсырмалар жақында қосылады</b><span>Ұстаз тапсырма қосқанда, оны осы жерден көресің.</span></div>';
    }
    return '<ol class="task-list">' + list.map(function (t, i) {
      var url = safeUrl(t.url);
      return '<li class="task"><span class="task-n">' + (i + 1) + '</span><div>' +
        '<h3>' + esc(t.title || (i + 1) + '-тапсырма') + '</h3>' +
        (t.text ? '<p>' + esc(t.text) + '</p>' : '') +
        (url ? '<a class="link-btn" href="' + esc(url) + '" target="_blank" rel="noopener">Тапсырманы ашу' + icon('external', 'ic-sm') + '</a>' : '') +
        '</div></li>';
    }).join('') + '</ol>';
  }

  function renderLesson(cid, n) {
    var c = COURSES[cid];
    var lessons = lessonsOf(c);
    var l = find(lessons, function (x) { return x.n === n; });
    if (!l) return renderNotFound();
    renderChrome(cid, true);
    setTitle(pad(n) + ' · ' + l.topic);
    state.last = '#/' + cid + '/' + n;
    save();

    var r = (RES[cid] || {})[n] || {};
    var cats = categoriesFor(cid, n);
    var p = prog(cid, n);
    var nxt = nextLesson(lessons);
    var prev = find(lessons, function (x) { return x.n === n - 1; });
    var next = find(lessons, function (x) { return x.n === n + 1; });
    var hasVideo = !!String(r.video || '').trim();
    var k = sentCount(cid, n);
    var tl = safeUrl(CFG.teacherLink);

    var chips = '<span class="pill pill-ink">' + pad(n) + '-сабақ</span><span class="pill">' + l.q + '-тоқсан</span>' + flagHTML(l, nxt) + tagsHTML(l);

    app.innerHTML =
      '<div class="wrap wrap-narrow page">' +
        crumbs([{ label: 'Басты бет', href: '#/' }, { label: c.title, href: '#/' + cid }, { label: pad(n) + '-сабақ' }]) +
        '<section class="lhead q' + l.q + '" aria-labelledby="lesson-title">' +
          '<div class="lh-chips">' + chips + '</div>' +
          '<p class="lh-date">' + icon('calendar') + '<span><time datetime="' + isoDate(l.date) + '">' + fmtDay(l.date) + '</time> · ' + esc(l.day) + '</span></p>' +
          '<h1 class="h1" id="lesson-title" tabindex="-1">' + esc(l.topic) + '</h1>' +
          '<div class="prep-card">' + icon('book') + '<div><p class="prep-l">Дайындық' + (c.prepTime ? ' · ' + esc(c.prepTime) : '') + '</p><p class="prep-t">' + esc(l.prep) + '</p></div></div>' +
          '<div class="lh-foot"><span class="pill num" id="headCount">' + k + ' / ' + cats.length + ' ✅</span>' +
            '<span class="pill" id="headVideo">' + icon(p.video ? 'check' : 'play', 'ic-sm') + (p.video ? 'Бейне көрілді' : 'Бейне көрілмеді') + '</span></div>' +
        '</section>' +

        '<div class="lsteps">' +
          '<section class="lstep" id="s-video" aria-labelledby="st-1">' +
            '<div class="lstep-head">' + stepNo(1, p.video) + '<h2 class="h3" id="st-1">Бейнесабақ</h2>' +
              '<button type="button" class="toggle" data-act="video" aria-pressed="' + !!p.video + '"' + (hasVideo || p.video ? '' : ' disabled title="Бейне әлі қосылмаған"') + '>' +
                '<span class="tg-box">' + icon('check') + '</span>Көрдім</button></div>' +
            videoHTML(r.video, l.topic) +
          '</section>' +

          '<section class="lstep" aria-labelledby="st-2">' +
            '<div class="lstep-head">' + stepNo(2) + '<h2 class="h3" id="st-2">Қосымша ресурстар</h2></div>' +
            extraHTML(r.extra) +
          '</section>' +

          '<section class="lstep" aria-labelledby="st-3">' +
            '<div class="lstep-head">' + stepNo(3) + '<h2 class="h3" id="st-3">Тапсырмалар</h2></div>' +
            tasksHTML(r.tasks) +
          '</section>' +

          '<section class="lstep" id="submit" aria-labelledby="st-4">' +
            '<div class="lstep-head">' + stepNo(4, k === cats.length && cats.length > 0, 'stepNo4') + '<h2 class="h3" id="st-4">Жұмысыңды жібер</h2>' +
              '<span class="count-pill' + (k === cats.length && k ? ' is-full' : '') + '" id="countPill">' + k + ' / ' + cats.length + ' ✅</span></div>' +
            '<div class="field" id="nameField">' +
              '<label for="stuName">Аты-жөнің</label>' +
              '<input class="input" id="stuName" type="text" autocomplete="name" autocapitalize="words" enterkeyhint="done" maxlength="60" placeholder="Мысалы: Айдана Серікова" value="' + esc(state.name) + '" aria-describedby="nameHint nameErr">' +
              '<p class="field-hint" id="nameHint">' + icon('user') + 'Бір рет жаз — осы құрылғыда есте сақталады.</p>' +
              '<p class="field-err" id="nameErr">' + icon('alert') + 'Алдымен аты-жөніңді жаз</p>' +
            '</div>' +
            '<div class="how-send"><ol>' +
              '<li><span>Әр санатқа суретті таңда — камера не галерея.</span></li>' +
              '<li><span><b>«Бөлісу»</b> бас та, Telegram не WhatsApp-ты өзің таңда.</span></li>' +
              '<li><span>Жіберілген соң санатқа ✅ қойылады.</span></li>' +
            '</ol></div>' +
            '<div class="cats" id="cats">' + cats.map(function (cat) { return catHTML(l, cat); }).join('') + '</div>' +
            (tl ? '<div class="contact"><p>Сұрағың бар ма?</p><a class="btn btn-outline btn-sm" href="' + esc(tl) + '" target="_blank" rel="noopener">' + icon('message') + 'Ұстазға жазу</a></div>' : '') +
          '</section>' +
        '</div>' +

        '<nav class="pager" aria-label="Сабақтар арасында">' +
          (prev ? '<a class="pager-a" href="#/' + cid + '/' + prev.n + '"><span class="pager-l">' + icon('arrow-left', 'ic-sm') + 'Алдыңғы</span><span class="pager-t">' + pad(prev.n) + ' · ' + esc(prev.topic) + '</span></a>' : '<span class="pager-gap"></span>') +
          (next ? '<a class="pager-a is-next" href="#/' + cid + '/' + next.n + '"><span class="pager-l">Келесі' + icon('arrow-right', 'ic-sm') + '</span><span class="pager-t">' + pad(next.n) + ' · ' + esc(next.topic) + '</span></a>' : '') +
        '</nav>' +
      '</div>';
  }

  function stepNo(n, done, id) {
    return '<span class="lstep-n' + (done ? ' is-done' : '') + '"' + (id ? ' id="' + id + '"' : '') + ' aria-hidden="true">' + (done ? icon('check') : n) + '</span>';
  }

  /* ---------- Жіберу санаты ---------- */
  function catHTML(l, cat) {
    var u = uiFor(l, cat.id);
    var sentAt = prog(l.course, l.n).sent[cat.id];
    var sent = !!sentAt;
    var ph = u.photo;
    var st = u.status;
    var fid = 'f-' + cat.id;
    var input = '<input class="vh" type="file" accept="image/*" id="' + fid + '" data-pick="' + esc(cat.id) + '">';
    var body = '';

    if (st === 'compressing') {
      body = '<div class="drop is-loading" aria-busy="true"><span class="drop-ic"><span class="spinner"></span></span>' +
        '<b>Сурет дайындалуда…</b><span>Бір сәт күте тұр</span></div>';
    } else if (ph) {
      body = shotHTML(cat, ph);
      if (st === 'fallback') {
        body += '<div class="note">' + icon('info') + '<div><b>Сурет құрылғыңа жүктелді' + (u.copied ? ', мәтін көшірілді.' : '.') + '</b> ' +
          'Telegram не WhatsApp-ты ашып, ұстазға суретті және мәтінді жібер. Сосын «Жібердім ✅» бас.' +
          '<div class="share-text">' + esc(u.text || '') + '</div></div></div>' +
          '<div class="cat-actions">' +
            '<button type="button" class="btn btn-ink btn-block" data-act="confirm" data-cat="' + esc(cat.id) + '">Жібердім ✅</button>' +
            '<div class="cat-actions-row">' +
              '<button type="button" class="btn btn-outline btn-sm" data-act="copy" data-cat="' + esc(cat.id) + '">' + icon('copy') + 'Мәтінді көшіру</button>' +
              '<button type="button" class="btn btn-outline btn-sm" data-act="download" data-cat="' + esc(cat.id) + '">' + icon('download') + 'Қайта жүктеу</button>' +
            '</div></div>';
      } else {
        var sharing = st === 'sharing';
        body += '<div class="cat-actions">' +
          '<button type="button" class="btn ' + (sent && !sharing ? 'btn-outline' : 'btn-cta') + ' btn-block' + (sharing ? ' is-loading' : '') + '" data-act="share" data-cat="' + esc(cat.id) + '"' + (sharing ? ' disabled aria-busy="true"' : '') + '>' +
            (sharing ? '<span class="spinner"></span>Бөлісу терезесі ашық…' : icon('share') + (sent ? 'Қайта бөлісу' : 'Бөлісу')) + '</button>' +
          input + '<label for="' + fid + '" class="btn btn-outline btn-sm btn-block">' + icon('image') + 'Басқа сурет</label>' +
          '</div>';
      }
    } else if (sent) {
      body = '<div class="sent-box"><span class="sent-ic" aria-hidden="true">' + icon('check') + '</span><div><b>Жіберілді</b>' +
        (typeof sentAt === 'number' ? '<span>' + fmtStamp(sentAt) + '</span>' : '') + '</div></div>' +
        input + '<label for="' + fid + '" class="btn btn-outline btn-sm btn-block">' + icon('camera') + 'Қайта жіберу</label>';
    } else {
      if (st === 'error') body += '<div class="note is-error" role="alert">' + icon('alert') + '<div>' + esc(u.error) + '</div></div>';
      body += input + '<label for="' + fid + '" class="drop"><span class="drop-ic">' + icon('camera') + '</span>' +
        '<b>Суретті таңда</b><span>Камера немесе галерея</span></label>';
    }

    var foot = sent
      ? '<div class="cat-foot"><span class="small muted">' + (ph ? 'Жіберілді' + (typeof sentAt === 'number' ? ' · ' + fmtStamp(sentAt) : '') : '') + '</span>' +
        '<button type="button" class="link-btn is-quiet" data-act="unmark" data-cat="' + esc(cat.id) + '">Белгіні алып тастау</button></div>'
      : '';

    var badge = sent ? '<span class="cat-check" role="img" aria-label="Жіберілді">✅</span>'
      : (st === 'fallback' ? '<span class="cat-badge">Растау керек</span>' : '');

    return '<article class="cat' + (sent ? ' is-done' : '') + (st === 'error' ? ' is-error' : '') + '" id="cat-' + esc(cat.id) + '" aria-labelledby="ct-' + esc(cat.id) + '">' +
      '<div class="cat-head"><span class="cat-ic">' + icon(cat.icon || 'image') + '</span>' +
        '<div><h3 id="ct-' + esc(cat.id) + '">' + esc(cat.title) + '</h3>' + (cat.hint ? '<p>' + esc(cat.hint) + '</p>' : '') + '</div>' + badge + '</div>' +
      body + foot + '</article>';
  }

  function shotHTML(cat, ph) {
    var media = ph.url
      ? '<img src="' + ph.url + '" alt="«' + esc(cat.title) + '» санатына таңдалған сурет">'
      : '<div class="shot-file">' + icon('file', 'ic-lg') + '<span>' + esc(ph.file.name) + '</span></div>';
    return '<figure class="shot">' + media +
      '<button type="button" class="icon-btn" data-act="remove" data-cat="' + esc(cat.id) + '" aria-label="Суретті алып тастау">' + icon('x') + '</button>' +
      '<figcaption>' + icon('check') + 'Дайын · ' + fmtSize(ph.size) + '</figcaption></figure>';
  }

  function currentLesson() { return lessonByRoute(location.hash); }
  function catById(l, id) { return find(categoriesFor(l.course, l.n), function (c) { return c.id === id; }); }

  function refreshCat(l, catId, focusAct) {
    var cat = catById(l, catId);
    var el = document.getElementById('cat-' + catId);
    if (!cat || !el) return;
    var active = document.activeElement;
    var hadFocus = el.contains(active);
    var act = focusAct || (hadFocus && active.getAttribute('data-act'));
    var tmp = document.createElement('div');
    tmp.innerHTML = catHTML(l, cat);
    var fresh = tmp.firstChild;
    el.parentNode.replaceChild(fresh, el);
    if ((hadFocus || focusAct) && usingKeyboard) {
      var target = (act && fresh.querySelector('[data-act="' + act + '"]:not(:disabled)')) ||
        fresh.querySelector('[data-act="share"]:not(:disabled), input[type="file"], button:not(:disabled)');
      if (target) target.focus({ preventScroll: true });
    }
    refreshCounts(l);
  }

  function refreshCounts(l) {
    var total = categoriesFor(l.course, l.n).length;
    var k = sentCount(l.course, l.n);
    var full = total > 0 && k === total;
    var pill = document.getElementById('countPill');
    if (pill) { pill.textContent = k + ' / ' + total + ' ✅'; pill.classList.toggle('is-full', full); }
    var head = document.getElementById('headCount');
    if (head) head.textContent = k + ' / ' + total + ' ✅';
    var no = document.getElementById('stepNo4');
    if (no) { no.classList.toggle('is-done', full); no.innerHTML = full ? icon('check') : '4'; }
  }

  /* ---------- Суретті сығу (~1600 px, JPEG) ---------- */
  function compress(file) {
    return new Promise(function (resolve, reject) {
      var src = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        try {
          var max = 1600;
          var w = img.naturalWidth, h = img.naturalHeight;
          var sc = Math.min(1, max / Math.max(w, h));
          w = Math.max(1, Math.round(w * sc));
          h = Math.max(1, Math.round(h * sc));
          var cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          var ctx = cv.getContext('2d');
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          URL.revokeObjectURL(src);
          cv.toBlob(function (b) { b ? resolve(b) : reject(new Error('toBlob')); }, 'image/jpeg', 0.82);
        } catch (e) { URL.revokeObjectURL(src); reject(e); }
      };
      img.onerror = function () { URL.revokeObjectURL(src); reject(new Error('decode')); };
      img.src = src;
    });
  }

  function makeFile(blob, name, type) {
    try { return new File([blob], name, { type: type, lastModified: Date.now() }); }
    catch (e) { blob.name = name; return blob; }
  }

  function fileName(l, catId) {
    return l.course + '-' + pad(l.n) + '-' + catId + '.jpg';
  }

  function onPick(input) {
    var l = currentLesson();
    var f = input.files && input.files[0];
    if (!l || !f) return;
    var catId = input.getAttribute('data-pick');
    var u = uiFor(l, catId);
    input.value = '';
    if (f.type && !/^image\//i.test(f.type)) {
      u.status = 'error';
      u.error = 'Бұл сурет емес. JPG не PNG суретін таңда.';
      refreshCat(l, catId);
      toast('Тек сурет таңдауға болады', 'error');
      return;
    }
    u.status = 'compressing';
    refreshCat(l, catId);
    compress(f).then(function (blob) {
      setPhoto(u, makeFile(blob, fileName(l, catId), 'image/jpeg'), true);
    }, function () {
      // Браузер ашпаған формат (мысалы HEIC) — түпнұсқасын жібереміз
      setPhoto(u, f, false);
    }).then(function () {
      u.status = 'idle';
      refreshCat(l, catId, 'share');
      toast('Сурет дайын — енді «Бөлісу» бас', 'info');
    });
  }

  function setPhoto(u, file, previewable) {
    if (u.photo && u.photo.url) URL.revokeObjectURL(u.photo.url);
    u.photo = { file: file, size: file.size, url: previewable ? URL.createObjectURL(file) : '' };
    u.error = '';
  }

  function shareText(l, cat, name) {
    var c = COURSES[l.course];
    return 'Аты-жөні: ' + name + '\n' +
      'Пән: ' + c.title + '\n' +
      'Сабақ: ' + pad(l.n) + ' · ' + l.topic + '\n' +
      'Санат: ' + cat.title;
  }

  function markSent(l, catId) {
    prog(l.course, l.n).sent[catId] = Date.now();
    save();
    uiFor(l, catId).status = 'idle';
  }

  function nameError(on) {
    var f = document.getElementById('nameField');
    var inp = document.getElementById('stuName');
    if (!f || !inp) return;
    f.classList.toggle('has-error', on);
    if (on) inp.setAttribute('aria-invalid', 'true'); else inp.removeAttribute('aria-invalid');
  }

  function onShare(catId) {
    var l = currentLesson();
    var cat = l && catById(l, catId);
    if (!l || !cat) return;
    var u = uiFor(l, catId);
    if (!u.photo || u.status === 'sharing') return;

    var nameEl = document.getElementById('stuName');
    var name = (nameEl ? nameEl.value : state.name).replace(/\s+/g, ' ').trim();
    state.name = name;
    save();
    if (!name) {
      nameError(true);
      toast('Алдымен аты-жөніңді жаз', 'error');
      if (nameEl) {
        nameEl.scrollIntoView({ block: 'center', behavior: smooth() });
        nameEl.focus({ preventScroll: true });
      }
      return;
    }

    var text = shareText(l, cat, name);
    var title = COURSES[l.course].title + ' · ' + pad(l.n) + '-сабақ · ' + cat.title;
    var data = { files: [u.photo.file], title: title, text: text };
    var can = false;
    try { can = !!(navigator.share && navigator.canShare && navigator.canShare(data)); } catch (e) { can = false; }
    if (!can) { fallbackShare(l, cat, text); return; }

    // navigator.share батырманы басқан сәтте бірден шақырылуы керек (iOS талабы)
    var pending;
    try { pending = navigator.share(data); } catch (e) { fallbackShare(l, cat, text); return; }
    u.status = 'sharing';
    refreshCat(l, catId);
    pending.then(function () {
      markSent(l, catId);
      refreshCat(l, catId, 'share');
      toast('«' + cat.title + '» жіберілді ✅', 'success');
    }, function (err) {
      u.status = 'idle';
      if (err && err.name === 'AbortError') {
        refreshCat(l, catId, 'share');
        toast('Бөлісу тоқтатылды — ✅ қойылмады', 'info');
        return;
      }
      fallbackShare(l, cat, text);
    });
  }

  function downloadFile(file) {
    var url = URL.createObjectURL(file);
    var a = document.createElement('a');
    a.href = url;
    a.download = file.name || 'surat.jpg';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.parentNode.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  function fallbackShare(l, cat, text) {
    var u = uiFor(l, cat.id);
    downloadFile(u.photo.file);
    u.text = text;
    copyText(text).then(function (ok) {
      u.copied = ok;
      u.status = 'fallback';
      refreshCat(l, cat.id, 'confirm');
      toast(ok ? 'Сурет жүктелді, мәтін көшірілді' : 'Сурет жүктелді. Мәтінді төменнен көшір', 'info');
    });
  }

  /* ============================================================
     «ЖАҚЫНДА» ЖӘНЕ 404
     ============================================================ */
  function renderSoon(s) {
    renderChrome(s.id, false);
    setTitle(s.title);
    var first = readySubjects()[0];
    app.innerHTML = '<div class="wrap page">' +
      crumbs([{ label: 'Басты бет', href: '#/' }, { label: s.title }]) +
      '<section class="state-page"><span class="empty-ic">' + icon(s.icon || 'clock') + '</span>' +
        '<p class="eyebrow">Жақында</p><h1 class="h1" tabindex="-1">' + esc(s.title) + '</h1>' +
        '<p>Сабақтар кестесі дайын болғанда, осы жерде пайда болады. Әзірге басқа пәнмен айналыс!</p>' +
        (first ? '<a class="btn btn-cta" href="#/' + first.id + '">' + esc(first.title) + 'ға өту' + icon('arrow-right', 'ic-go') + '</a>' : '') +
      '</section></div>';
  }

  function renderNotFound() {
    renderChrome('');
    setTitle('Бет табылмады');
    app.innerHTML = '<div class="wrap page"><section class="state-page"><span class="empty-ic">' + icon('flag') + '</span>' +
      '<p class="eyebrow">404</p><h1 class="h1" tabindex="-1">Бет табылмады</h1>' +
      '<p>Сілтеме қате болуы мүмкін. Басты беттен қайта бастап көр.</p>' +
      '<a class="btn btn-cta" href="#/">Басты бетке' + icon('arrow-right', 'ic-go') + '</a></section></div>';
  }

  /* ============================================================
     ОҚИҒАЛАР
     ============================================================ */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-filter]');
    if (t) { applyFilter(t.getAttribute('data-filter')); return; }

    t = e.target.closest('[data-skip]');
    if (t) {
      e.preventDefault();
      var h = app.querySelector('h1') || app;
      h.focus();
      return;
    }

    t = e.target.closest('[data-act]');
    if (!t) return;
    var act = t.getAttribute('data-act');
    var catId = t.getAttribute('data-cat');
    var l = currentLesson();

    if (act === 'soon') { toast((t.getAttribute('data-title') || 'Пән') + ' жақында қосылады', 'info'); return; }
    if (act === 'toast-action') { var fn = toast.action; hideToast(); if (fn) fn(); return; }
    if (!l) return;

    if (act === 'share') { onShare(catId); return; }

    if (act === 'video') {
      var p = prog(l.course, l.n);
      p.video = !p.video;
      save();
      t.setAttribute('aria-pressed', String(p.video));
      var no = t.parentNode.querySelector('.lstep-n');
      if (no) { no.classList.toggle('is-done', p.video); no.innerHTML = p.video ? icon('check') : '1'; }
      var hv = document.getElementById('headVideo');
      if (hv) hv.innerHTML = icon(p.video ? 'check' : 'play', 'ic-sm') + (p.video ? 'Бейне көрілді' : 'Бейне көрілмеді');
      if (!p.video && !String(((RES[l.course] || {})[l.n] || {}).video || '').trim()) t.disabled = true;
      toast(p.video ? 'Бейне көрілді деп белгіленді' : 'Белгі алынды', p.video ? 'success' : 'info');
      return;
    }

    if (act === 'confirm') {
      markSent(l, catId);
      refreshCat(l, catId);
      toast('Белгі қойылды ✅', 'success');
      return;
    }

    if (act === 'unmark') {
      var sent = prog(l.course, l.n).sent;
      var was = sent[catId];
      delete sent[catId];
      save();
      refreshCat(l, catId);
      var lessonAt = l;
      toast('Белгі алынды', 'info', {
        label: 'Қайтару',
        fn: function () {
          prog(lessonAt.course, lessonAt.n).sent[catId] = was || Date.now();
          save();
          if (currentLesson() === lessonAt) refreshCat(lessonAt, catId);
          toast('Белгі қайтарылды ✅', 'success');
        }
      });
      return;
    }

    if (act === 'remove') {
      var u = uiFor(l, catId);
      if (u.photo && u.photo.url) URL.revokeObjectURL(u.photo.url);
      u.photo = null;
      u.status = 'idle';
      refreshCat(l, catId);
      var inp = document.getElementById('f-' + catId);
      if (inp) inp.focus({ preventScroll: true });
      toast('Сурет алынды', 'info');
      return;
    }

    if (act === 'copy') {
      var u2 = uiFor(l, catId);
      copyText(u2.text || '').then(function (ok) { toast(ok ? 'Мәтін көшірілді' : 'Көшіру мүмкін болмады — мәтінді қолмен белгіле', ok ? 'success' : 'error'); });
      return;
    }

    if (act === 'download') {
      var u3 = uiFor(l, catId);
      if (u3.photo) { downloadFile(u3.photo.file); toast('Сурет қайта жүктелді', 'info'); }
    }
  });

  document.addEventListener('change', function (e) {
    var inp = e.target.closest && e.target.closest('[data-pick]');
    if (inp) onPick(inp);
  });

  document.addEventListener('input', function (e) {
    if (e.target.id === 'stuName') {
      state.name = e.target.value;
      save();
      if (e.target.value.trim()) nameError(false);
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.id === 'stuName') e.target.blur();
  });

  /* ============================================================
     МАРШРУТ (хэш: #/, #/informatika, #/informatika/7)
     ============================================================ */
  var firstRender = true;
  var prevHash = '';

  function route() {
    TODAY = startOfToday();
    var h = location.hash || '#/';
    var m = /^#\/?([a-z0-9-]*)(?:\/(\d+))?\/?$/i.exec(h);
    var from = lessonByRoute(prevHash);
    prevHash = h;
    var scrollTarget = null;

    if (!m) renderNotFound();
    else if (!m[1]) renderHome();
    else {
      var s = subjectMeta(m[1]);
      var c = COURSES[m[1]];
      if (s && s.ready && c) {
        if (m[2]) renderLesson(m[1], +m[2]);
        else {
          renderCourse(m[1]);
          if (from && from.course === m[1]) scrollTarget = document.getElementById('l-' + from.n);
        }
      } else if (s && !m[2]) renderSoon(s);
      else renderNotFound();
    }

    if (scrollTarget) {
      scrollTarget.scrollIntoView({ block: 'center' });
    } else if (!firstRender) {
      window.scrollTo(0, 0);
    }
    if (!firstRender) {
      var focusEl = scrollTarget ? scrollTarget.querySelector('.lc-link') : app.querySelector('h1');
      if (focusEl) focusEl.focus({ preventScroll: true });
    }
    firstRender = false;
  }

  /* Дайын деп белгіленген, бірақ index.html-ге қосылмаған пән файлдарын жүктеу */
  function loadSubjects() {
    var missing = SUBJECTS.filter(function (s) { return s.ready && !COURSES[s.id]; });
    if (!missing.length) return Promise.resolve();
    return Promise.all(missing.map(function (s) {
      return new Promise(function (resolve) {
        var sc = document.createElement('script');
        sc.src = 'data/' + s.id + '.js';
        sc.onload = sc.onerror = function () { resolve(); };
        document.head.appendChild(sc);
      });
    }));
  }

  window.addEventListener('hashchange', route);
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  loadSubjects().then(route);
})();
