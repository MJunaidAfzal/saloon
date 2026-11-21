/* ==========================================================
   Aurelia Hair & Beauty Studio — interactions & animations
   ========================================================== */
(function () {
  'use strict';

  const body = document.body;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  /* ---------- smooth scroll (Lenis, with native fallback) ---------- */
  let lenis = null;
  if (window.Lenis && !reduceMotion) {
    lenis = new window.Lenis({
      duration: 1.2,
      easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true
    });
    lenis.stop();
    const raf = time => { lenis.raf(time); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
  const scrollY = () => (lenis ? lenis.scroll : window.scrollY);

  function scrollToTarget(target) {
    const offset = target === 0 ? 0 : -90;
    if (lenis) lenis.scrollTo(target, { offset, duration: 1.5 });
    else if (target === 0) window.scrollTo({ top: 0, behavior: 'smooth' });
    else target.scrollIntoView({ behavior: 'smooth' });
  }

  /* ---------- loader: golden arch draws, letters appear, doors open ---------- */
  const loader = $('#loader');
  const arch = $('#loaderArch');
  const pctEl = $('#loaderPct');
  const msgEl = $('#loaderMsg');
  const letters = $$('#loaderWord span');
  const ARCH = arch.getTotalLength();
  arch.style.strokeDasharray = ARCH;
  arch.style.strokeDashoffset = ARCH;
  const messages = [[0, 'Preparing your chair…'], [30, 'Warming the styling tools…'], [65, 'Adding the finishing touches…'], [96, 'Welcome to Aurelia']];
  const sources = new Set($$('img').map(i => i.currentSrc || i.src));
  sources.add('images/hero-model.webp');
  const total = sources.size;
  let loaded = 0, shown = 0, finished = false, lastMsg = '', lastTick = performance.now();
  const start = performance.now();
  const MIN_TIME = 2000;

  // keep references so the browser can't garbage-collect them before they report back
  const preloads = [...sources].map(src => {
    const im = new Image();
    im.onload = im.onerror = () => { loaded++; };
    im.src = src;
    return im;
  });

  function tickLoader() {
    const timeCap = Math.min(1, (performance.now() - start) / MIN_TIME);
    const target = Math.min(loaded / total, timeCap) * 100;
    // time-based easing, so progress stays smooth even if ticks arrive late
    const now = performance.now();
    shown += (target - shown) * (1 - Math.exp(-(now - lastTick) / 140));
    lastTick = now;
    if (target - shown < 0.4) shown = target;
    const p = Math.round(shown);
    arch.style.strokeDashoffset = ARCH - (ARCH * shown) / 100;
    pctEl.textContent = p;
    letters.forEach((el, i) => el.classList.toggle('on', shown >= (i / letters.length) * 100 + 4));
    const msg = messages.filter(m => p >= m[0]).pop()[1];
    if (msg !== lastMsg) { msgEl.textContent = msg; lastMsg = msg; }
    if (shown >= 99.9 && !finished) { clearInterval(loaderTimer); finishLoading(); }
  }
  // interval (not rAF) so the loader also completes in background tabs
  const loaderTimer = setInterval(tickLoader, 30);
  setTimeout(() => { loaded = total; }, 7000);

  function finishLoading() {
    finished = true;
    setTimeout(() => {
      loader.classList.add('done');
      body.classList.remove('is-loading');
      setTimeout(() => {
        body.classList.add('ready');
        if (lenis) lenis.start();
      }, 450);
      setTimeout(() => { loader.remove(); preloads.length = 0; }, 2000);
    }, 450);
  }

  /* ---------- reveal on scroll ---------- */
  const revealIO = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      revealIO.unobserve(e.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  $$('.reveal').forEach(el => revealIO.observe(el));

  /* ---------- counters ---------- */
  function countUp(el) {
    if (el.dataset.done) return;
    el.dataset.done = 1;
    const end = parseFloat(el.dataset.count);
    const dec = parseInt(el.dataset.decimals || 0, 10);
    const t0 = performance.now();
    const step = now => {
      const p = Math.min(1, (now - t0) / 2200);
      const v = end * (1 - Math.pow(1 - p, 4));
      el.textContent = dec ? v.toFixed(dec) : Math.round(v);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  const countIO = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting && body.classList.contains('ready')) { countUp(e.target); countIO.unobserve(e.target); }
    });
  }, { threshold: 0.6 });
  $$('[data-count]').forEach(el => countIO.observe(el));

  /* ---------- scroll-driven UI ---------- */
  const progress = $('#progress');
  const sticky = $('#sticky');
  const totop = $('#totop');
  const ring = $('#totopRing');
  const hero = $('.hero');
  const heroWord = $('[data-hero-parallax]');
  const parallaxEls = $$('[data-parallax]');
  const parallaxImgs = $$('[data-parallax-img]');
  let ticking = false;

  function onScroll() {
    const y = scrollY();
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? Math.min(1, y / max) : 0;
    progress.style.transform = `scaleX(${p})`;
    ring.style.strokeDashoffset = 132 - 132 * p;
    sticky.classList.toggle('show', y > hero.offsetHeight * 0.75);
    totop.classList.toggle('show', y > window.innerHeight * 0.8);

    if (!reduceMotion) {
      if (heroWord && y < hero.offsetHeight) heroWord.style.transform = `translate3d(0,${y * parseFloat(heroWord.dataset.heroParallax)}px,0)`;
      const vh = window.innerHeight;
      parallaxEls.forEach(el => {
        const r = el.parentElement.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        // never move further than the extra bleed the layer has, so no gaps show
        const limit = Math.max(0, (el.offsetHeight - r.height) / 2 - 2);
        const raw = (r.top + r.height / 2 - vh / 2) * parseFloat(el.dataset.parallax);
        el.style.transform = `translate3d(0,${Math.max(-limit, Math.min(limit, raw))}px,0)`;
      });
      parallaxImgs.forEach(img => {
        const r = img.parentElement.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        const prog = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
        img.style.transform = `translate3d(0,${-prog * 13}%,0)`;
      });
    }
    ticking = false;
  }
  const requestTick = () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } };
  if (lenis) lenis.on('scroll', requestTick);
  window.addEventListener('scroll', requestTick, { passive: true });
  window.addEventListener('resize', requestTick);
  onScroll();

  /* ---------- mobile menu + anchor links ---------- */
  const mmenu = $('#mmenu');
  const burgers = $$('.burger');
  function closeMenu() {
    mmenu.classList.remove('open');
    burgers.forEach(b => b.setAttribute('aria-expanded', 'false'));
    if (lenis) lenis.start(); else body.style.overflow = '';
  }
  function openMenu() {
    mmenu.classList.add('open');
    burgers.forEach(b => b.setAttribute('aria-expanded', 'true'));
    if (lenis) lenis.stop(); else body.style.overflow = 'hidden';
  }
  burgers.forEach(b => b.addEventListener('click', openMenu));
  $('#mmenuClose').addEventListener('click', closeMenu);
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && mmenu.classList.contains('open')) closeMenu(); });

  $$('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (id === '#') return e.preventDefault();
      const target = id === '#top' ? 0 : $(id);
      if (target === null) return;
      e.preventDefault();
      if (mmenu.classList.contains('open')) closeMenu();
      scrollToTarget(target);
    });
  });

  /* ---------- price menu tabs ---------- */
  $$('.cats button').forEach(btn => btn.addEventListener('click', () => {
    $$('.cats button').forEach(b => { b.classList.toggle('on', b === btn); b.setAttribute('aria-selected', b === btn); });
    $$('.list').forEach(l => l.classList.toggle('on', l.dataset.list === btn.dataset.cat));
    if (lenis && lenis.resize) lenis.resize();
  }));

  /* ---------- testimonial switcher (click or auto-play) ---------- */
  const quotes = $$('.tst__item');
  const avBtns = $$('#tstAvs button');
  const who = $('#tstWho');
  let current = avBtns.findIndex(b => b.classList.contains('on'));
  let autoTimer;
  function showReview(btnIndex) {
    const b = avBtns[btnIndex];
    const q = +b.dataset.q;     // each client photo is linked to their own quote
    quotes.forEach((el, i) => el.classList.toggle('on', i === q));
    avBtns.forEach((x, i) => x.classList.toggle('on', i === btnIndex));
    who.style.opacity = 0;
    setTimeout(() => {
      who.innerHTML = `<b>${b.dataset.name}</b><small>${b.dataset.place}</small>`;
      who.style.opacity = 1;
    }, 250);
    current = btnIndex;
  }
  function restartAuto() {
    clearInterval(autoTimer);
    if (!reduceMotion) autoTimer = setInterval(() => showReview((current + 1) % avBtns.length), 6500);
  }
  avBtns.forEach((b, i) => b.addEventListener('click', () => { showReview(i); restartAuto(); }));
  restartAuto();

  /* ---------- booking form ---------- */
  const bform = $('#bform');
  const bnote = $('#bnote');
  bform.addEventListener('submit', e => {
    e.preventDefault();
    let ok = true;
    $$('[required]', bform).forEach(f => {
      const bad = !f.value.trim();
      f.classList.toggle('err', bad);
      if (bad) ok = false;
    });
    if (!ok) { bnote.classList.remove('ok'); bnote.textContent = 'Please add your name, phone, service and preferred date.'; return; }
    bnote.classList.add('ok');
    bnote.textContent = 'Thank you — our concierge will confirm your reservation within the hour.';
    bform.reset();
  });
  $$('[required]', bform).forEach(f => f.addEventListener('input', () => f.classList.remove('err')));

  /* ---------- newsletter ---------- */
  const news = $('#news');
  news.addEventListener('submit', e => {
    e.preventDefault();
    const inp = $('input', news);
    if (!/^\S+@\S+\.\S+$/.test(inp.value)) { inp.focus(); return; }
    news.classList.add('ok');
    inp.value = '';
    inp.placeholder = 'Thank you for subscribing';
  });
})();
