/* СУПЕРЛЕСТНИЦА scrub — видео-кино, управляемое скроллом (приём Apple).
   Скролл страницы задаёт целевое время видео; rAF плавно доводит currentTime. */
(function () {
  'use strict';
  var video = document.getElementById('scrub');
  var pre = document.getElementById('pre');
  var pn = document.getElementById('pn'), pbi = document.getElementById('pbi');

  var DUR = 24; /* обновится по loadedmetadata */

  /* ---------- preloader по реальной загрузке ---------- */
  var loaded = false;
  function tryStart() {
    if (loaded) return;
    loaded = true;
    gsap.to(pre, { yPercent: -100, duration: 0.9, ease: 'power4.inOut',
      onComplete: function () { pre.remove(); ScrollTrigger.refresh(); } });
  }
  video.addEventListener('loadedmetadata', function () { DUR = video.duration || DUR; });
  video.addEventListener('canplaythrough', tryStart, { once: true });
  video.addEventListener('progress', function () {
    try {
      var b = video.buffered;
      if (b.length && DUR) {
        var pct = Math.min(100, Math.round(b.end(b.length - 1) / DUR * 100));
        pn.textContent = pct; gsap.set(pbi, { scaleX: pct / 100 });
      }
    } catch (e) {}
  });
  /* страховка: если браузер не отдаёт progress (кэш) */
  setTimeout(function () { pn.textContent = 100; gsap.set(pbi, { scaleX: 1 }); tryStart(); }, 6000);
  video.load();

  /* ---------- плавный скролл ---------- */
  var RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (window.Lenis && !RM) {
    var lenis = new Lenis({ lerp: 0.09 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }
  gsap.registerPlugin(ScrollTrigger);

  /* ---------- прогресс страницы -> целевое время видео ---------- */
  var target = 0, current = 0;
  ScrollTrigger.create({
    trigger: '#scroll', start: 'top top', end: 'bottom bottom',
    onUpdate: function (st) { target = st.progress; }
  });

  function tick() {
    current += (target - current) * 0.09;
    var t = Math.min(DUR - 0.05, Math.max(0, current * DUR));
    if (Math.abs(video.currentTime - t) > 0.03) {
      try { video.currentTime = t; } catch (e) {}
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  /* ---------- секции и HUD ---------- */
  var stages = ['Проём', 'Каркас', 'Ступени', 'Ограждение', 'Готово', 'Финал'];
  var hudStage = document.getElementById('hud-stage'), hudNum = document.getElementById('hud-num');
  ScrollTrigger.create({
    trigger: '#scroll', start: 'top top', end: 'bottom bottom',
    onUpdate: function (st) {
      var i = Math.min(stages.length - 1, Math.floor(st.progress * stages.length));
      var label = stages[i];
      if (hudStage.textContent !== label) {
        hudStage.textContent = label;
        hudNum.textContent = (i + 1 < 10 ? '0' : '') + (i + 1);
      }
    }
  });
  document.querySelectorAll('.sec .inner').forEach(function (el, idx) {
    var sec = el.closest('.sec');
    gsap.to(el, { opacity: 1, y: 0, duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: sec, start: 'top 62%' } });
    if (idx > 0 && idx < 6) {
      gsap.to(el, { opacity: 0, y: -40, duration: .7, ease: 'power2.in',
        scrollTrigger: { trigger: sec, start: 'bottom 45%' } });
    }
  });
  gsap.to('.hero h1 .ln span', { y: 0, duration: 1.05, stagger: .12, ease: 'power4.out', delay: .35 });
})();
