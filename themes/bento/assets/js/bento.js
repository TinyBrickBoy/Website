(function () {
  'use strict';
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fmt = function (s, v) { return String(s).replace('%s', v); };

  // ---------- Tipp-Animation ----------
  var typed = document.getElementById('typed');
  if (typed && !reduced) {
    var words = [];
    try { words = JSON.parse(typed.dataset.words || '[]'); } catch (e) {}
    if (words.length) {
      var w = 0, c = 0, del = false;
      (function type() {
        var word = words[w];
        typed.textContent = word.slice(0, c);
        if (!del && c < word.length) { c++; setTimeout(type, 70); }
        else if (!del) { del = true; setTimeout(type, 2000); }
        else if (c > 0) { c--; setTimeout(type, 30); }
        else { del = false; w = (w + 1) % words.length; setTimeout(type, 350); }
      })();
    }
  }

  // ---------- Scroll-Animationen ----------
  var tiles = document.querySelectorAll('.tile');
  if ('IntersectionObserver' in window && !reduced) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('visible');
        io.unobserve(e.target);
      });
    }, { threshold: 0.15 });
    tiles.forEach(function (el, i) { el.style.transitionDelay = (i % 4) * 70 + 'ms'; io.observe(el); });
  } else {
    tiles.forEach(function (el) { el.classList.add('visible'); });
  }

  // ---------- Hell/Dunkel ----------
  var toggle = document.getElementById('themeToggle');
  if (toggle) toggle.addEventListener('click', function () {
    var dark = document.documentElement.classList.toggle('dark');
    try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch (e) {}
  });

  // ---------- Mobiles Menü ----------
  var menuBtn = document.getElementById('menuBtn'), menu = document.getElementById('mobileMenu');
  function setMenu(open) {
    menu.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
  }
  if (menuBtn && menu) {
    menuBtn.addEventListener('click', function () { setMenu(menu.hidden); });
    menu.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); menuBtn.focus(); } });
  }

  // ---------- E-Mail kopieren ----------
  var copyBtn = document.getElementById('copyBtn');
  if (copyBtn) {
    var label = copyBtn.textContent;
    copyBtn.addEventListener('click', function () {
      var done = function (t) { copyBtn.textContent = t; setTimeout(function () { copyBtn.textContent = label; }, 2000); };
      if (!navigator.clipboard) return done(copyBtn.dataset.fail);
      navigator.clipboard.writeText(copyBtn.dataset.email).then(
        function () { done(copyBtn.dataset.done); },
        function () { done(copyBtn.dataset.fail); }
      );
    });
  }

  // ---------- Formular → Mailprogramm ----------
  var form = document.getElementById('contactForm');
  if (form) form.addEventListener('submit', function (e) {
    e.preventDefault();
    var note = document.getElementById('formNote'), d = form.dataset;
    note.hidden = false;
    if (!form.checkValidity()) {
      note.className = 'form-note is-error';
      note.textContent = d.invalid;
      return;
    }
    var name = form.elements.name.value.trim(), mail = form.elements.email.value.trim(), msg = form.elements.message.value.trim();
    var body = msg + '\n\n— ' + name + ' <' + mail + '>';
    note.className = 'form-note is-ok';
    note.textContent = fmt(d.ok, d.email);
    window.location.href = 'mailto:' + d.email + '?subject=' + encodeURIComponent(fmt(d.subject, name)) + '&body=' + encodeURIComponent(body);
  });
})();
