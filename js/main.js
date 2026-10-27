/* СУПЕРЛЕСТНИЦА — 3D-сцена: лестница собирается по скроллу.
   Three.js r128 (глобал), GSAP ScrollTrigger, Lenis. Без внешних ассетов. */
(function () {
  'use strict';
  var RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- WebGL guard ---------- */
  function webglOK() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) { return false; }
  }
  if (!webglOK()) { document.body.classList.add('nogl'); return; }

  gsap.registerPlugin(ScrollTrigger);

  /* ---------- сцена ---------- */
  var canvas = document.getElementById('gl');
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0B0C0E);
  scene.fog = new THREE.Fog(0x0B0C0E, 9, 30);

  var camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 60);

  /* свет: тёплая студия + контровой холодный */
  scene.add(new THREE.AmbientLight(0xffffff, 0.28));
  var key = new THREE.DirectionalLight(0xffd9b0, 1.05);
  key.position.set(-6, 9, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = key.shadow.camera.bottom = -10;
  key.shadow.camera.right = key.shadow.camera.top = 10;
  scene.add(key);
  var rim = new THREE.DirectionalLight(0x5f7bff, 0.5);
  rim.position.set(7, 4, -6);
  scene.add(rim);
  var glow = new THREE.PointLight(0xff4d00, 0, 7, 2); /* загорается с прогрессом */
  scene.add(glow);

  /* пол */
  var floor = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 0.9, metalness: 0.1 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -3;
  floor.receiveShadow = true;
  scene.add(floor);

  /* ---------- материалы ---------- */
  var wood = new THREE.MeshStandardMaterial({ color: 0xa8714a, roughness: 0.55, metalness: 0.05 });
  var woodDark = new THREE.MeshStandardMaterial({ color: 0x7c5233, roughness: 0.6, metalness: 0.05 });
  var steel = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.35, metalness: 0.85 });
  var steelDark = new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.45, metalness: 0.8 });

  /* ---------- лестница ---------- */
  var N = 16;                 /* ступеней */
  var SW = 0.95, SR = 0.26;   /* глубина и высота ступени */
  var W = 1.15;               /* ширина марша */
  var stair = new THREE.Group();
  stair.position.y = -2.2;
  scene.add(stair);

  var steps = [];
  for (var i = 0; i < N; i++) {
    var g = new THREE.Group();
    g.position.set(0, i * SR, i * SW);
    /* проступь */
    var tread = new THREE.Mesh(new THREE.BoxGeometry(W, 0.075, SW), wood);
    tread.position.y = SR;
    tread.castShadow = tread.receiveShadow = true;
    g.add(tread);
    /* подступёнок */
    var riser = new THREE.Mesh(new THREE.BoxGeometry(W, SR, 0.05), woodDark);
    riser.position.set(0, SR / 2, -SW / 2);
    riser.castShadow = true;
    g.add(riser);
    /* косоуры: две стальные балки по бокам */
    var s1 = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.24, SW), steel);
    s1.position.set(-W / 2 + 0.03, SR - 0.12, 0);
    var s2 = s1.clone(); s2.position.x = W / 2 - 0.03;
    s1.castShadow = s2.castShadow = true;
    g.add(s1); g.add(s2);
    g.userData.t = 0;          /* 0..1: анимация появления */
    g.scale.set(0.001, 0.001, 0.001);
    stair.add(g);
    steps.push(g);
  }

  /* опорные столбы низа и верха */
  var post1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.4, 0.1), steelDark);
  post1.position.set(-W / 2 + 0.03, 1.2, 0.05);
  var post2 = post1.clone(); post2.position.set(W / 2 - 0.03, 1.2, 0.05);
  stair.add(post1); stair.add(post2);
  post1.scale.set(0.001, 0.001, 0.001); post2.scale.set(0.001, 0.001, 0.001);

  /* балясины (правый край) */
  var bal = [];
  for (var b = 0; b < N; b += 2) {
    var rod = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, SR * 2.6, 8), steel);
    rod.position.set(W / 2 - 0.03, SR * 2.9, b * SW);
    rod.castShadow = true;
    rod.scale.set(0.001, 0.001, 0.001);
    stair.add(rod); bal.push(rod);
  }

  /* поручень: труба поверх балясин, растёт по drawRange */
  var railPts = [];
  for (var r = 0; r <= N; r++) railPts.push(new THREE.Vector3(W / 2 - 0.03, r * SR + SR * 2.75 + 0.13, r * SW));
  var railCurve = new THREE.CatmullRomCurve3(railPts);
  var railGeom = new THREE.TubeGeometry(railCurve, 140, 0.026, 10, false);
  var rail = new THREE.Mesh(railGeom, steel);
  rail.castShadow = true;
  rail.geometry.setDrawRange(0, 0);
  stair.add(rail);
  var railIdxCount = railGeom.index ? railGeom.index.count : railGeom.attributes.position.count;

  /* пылинки в луче света */
  var dustN = 260, dustPos = new Float32Array(dustN * 3);
  for (var d = 0; d < dustN; d++) {
    dustPos[d * 3] = (Math.random() - 0.5) * 14;
    dustPos[d * 3 + 1] = Math.random() * 7 - 2;
    dustPos[d * 3 + 2] = (Math.random() - 0.5) * 16;
  }
  var dustGeom = new THREE.BufferGeometry();
  dustGeom.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  var dust = new THREE.Points(dustGeom, new THREE.PointsMaterial({
    color: 0xffd9b0, size: 0.022, transparent: true, opacity: 0.5, depthWrite: false
  }));
  scene.add(dust);

  /* ---------- траектория камеры ---------- */
  var camPos = [
    [3.4, -0.6, -4.6], [4.4, 0.6, 0.4], [3.8, 2.0, 4.6],
    [1.4, 2.6, 7.2], [-1.6, 3.0, 8.0], [-4.0, 2.6, 7.0],
    [-5.2, 1.4, 4.4], [-5.6, 0.4, 1.4], [-5.8, -0.4, -1.6]
  ];
  var camLook = [
    [0, -1.4, 0.5], [0, 0, 1.2], [0, 0.8, 2.6], [0.3, 1.2, 4.0],
    [0.3, 1.4, 5.0], [0.2, 1.2, 5.2], [0, 0.6, 4.4], [0, -0.2, 3.0], [0, -0.9, 1.6]
  ];
  var posCurve = new THREE.CatmullRomCurve3(camPos.map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); }));
  var lookCurve = new THREE.CatmullRomCurve3(camLook.map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); }));
  var camOffset = new THREE.Vector3(3.4, -0.6, -4.6); /* старт до прелоадера */
  camera.position.copy(camOffset);
  camera.lookAt(0, -1.4, 0.5);

  /* ---------- скролл ---------- */
  var lenis = null;
  if (window.Lenis && !RM) {
    lenis = new Lenis({ lerp: 0.09 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  var P = { v: 0 }; /* общий прогресс 0..1 */
  ScrollTrigger.create({
    trigger: '#scroll', start: 'top top', end: 'bottom bottom', scrub: true,
    onUpdate: function (st) { P.v = st.progress; }
  });

  /* секции: fade по мере прохода */
  document.querySelectorAll('.sec .inner').forEach(function (el, idx) {
    var sec = el.closest('.sec');
    gsap.to(el, {
      opacity: 1, y: 0, duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: sec, start: 'top 62%' }
    });
    if (idx > 0 && idx < 6) {
      gsap.to(el, {
        opacity: 0, y: -40, duration: .7, ease: 'power2.in',
        scrollTrigger: { trigger: sec, start: 'bottom 45%' }
      });
    }
  });

  /* hero: построчный reveal */
  gsap.to('.hero h1 .ln span', { y: 0, duration: 1.05, stagger: .12, ease: 'power4.out', delay: .35 });

  /* HUD стадии */
  var stages = ['Проект', 'Каркас', 'Ступени', 'Ограждение', 'Монтаж', 'Готово'];
  var hudStage = document.getElementById('hud-stage');
  ScrollTrigger.create({
    trigger: '#scroll', start: 'top top', end: 'bottom bottom',
    onUpdate: function (st) {
      var i = Math.min(stages.length - 1, Math.floor(st.progress * stages.length));
      var label = stages[i];
      if (hudStage.textContent !== label) hudStage.textContent = label;
    }
  });

  /* ---------- рендер ---------- */
  var clock = new THREE.Clock();
  var lerp = function (a, b, t) { return a + (b - a) * t; };

  function tick() {
    var p = P.v;
    var t = clock.getElapsedTime();

    /* камера по кривой */
    var cp = posCurve.getPointAt(Math.min(p, 1));
    var cl = lookCurve.getPointAt(Math.min(p, 1));
    camera.position.lerp(cp, 0.08);
    var lookV = camera.userData.look || (camera.userData.look = cl.clone());
    lookV.lerp(cl, 0.08);
    camera.lookAt(lookV);

    /* ступени: появляются последовательно, чуть с запасом */
    var buildP = Math.min(p * 1.18, 1);
    var visibleN = buildP * (N + 2);
    steps.forEach(function (g, i) {
      var target = i < visibleN ? 1 : 0;
      var u = g.userData;
      u.t = lerp(u.t, target, 0.09);
      var s = u.t;
      /* лёгкий овер-шут */
      var e = s < 1 ? s * (1 + (1 - s) * 0.25) : 1;
      g.scale.set(Math.max(s, 0.001), Math.max(s, 0.001), Math.max(s, 0.001));
    });
    post1.scale.setScalar(Math.max(Math.min(1, visibleN / 1.5), 0.001));
    post2.scale.setScalar(post1.scale.x);
    bal.forEach(function (rod, j) {
      var target = (j * 2) < visibleN - 1 ? 1 : 0;
      var s = lerp(rod.scale.x, target, 0.12);
      rod.scale.set(Math.max(s, 0.001), Math.max(s, 0.001), Math.max(s, 0.001));
    });

    /* поручень растёт следом за ступенями */
    rail.geometry.setDrawRange(0, Math.floor(railIdxCount * Math.min(buildP * 1.05, 1)));

    /* оранжевый акцентный свет крепчает к финалу */
    var topStep = steps[Math.max(0, Math.min(N - 1, Math.floor(visibleN) - 1))];
    glow.intensity = p * 2.2;
    glow.position.set(0, (topStep ? topStep.position.y : 0) + 2, (topStep ? topStep.position.z : 0) + 1);

    /* пыль дрейфует */
    dust.rotation.y = t * 0.015;
    dust.position.y = Math.sin(t * 0.18) * 0.12;

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  addEventListener('resize', function () {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  /* ---------- preloader ---------- */
  var pn = document.getElementById('pn'), pbi = document.getElementById('pbi'), pre = document.getElementById('pre');
  var c = { v: 0 };
  gsap.to(c, {
    v: 100, duration: RM ? 0.15 : 1.4, ease: 'power2.inOut',
    onUpdate: function () { pn.textContent = Math.round(c.v); gsap.set(pbi, { scaleX: c.v / 100 }); },
    onComplete: function () {
      gsap.to(pre, { yPercent: -100, duration: 0.9, ease: 'power4.inOut', onComplete: function () { pre.remove(); } });
      ScrollTrigger.refresh();
    }
  });

  tick();
})();
