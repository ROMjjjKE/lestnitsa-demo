/* СУПЕРЛЕСТНИЦА v2 — реалистичный интерьер: лестница собирается по скроллу.
   Three.js r128 + GSAP ScrollTrigger + Lenis. Все текстуры процедурные (canvas), ноль внешних ассетов.
   Ключи реализма: ACESFilmic-тон, PMREM-окружение (отражения на металле/дереве),
   текстуры дерева/штукатурки/досок, мягкие тени, тёплый вечерний свет из окна. */
(function () {
  'use strict';
  var dbg = document.createElement('div');
  dbg.id = 'dbg'; dbg.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:999;background:#700;color:#fff;font:12px monospace;padding:6px;display:none;white-space:pre-wrap';
  document.body.appendChild(dbg);
  window.addEventListener('error', function (e) {
    dbg.style.display = 'block';
    dbg.textContent = 'JS ERROR: ' + (e.message || 'unknown') + ' @ line ' + (e.lineno || '?');
  });
  if (typeof THREE === 'undefined') { dbg.style.display='block'; dbg.textContent='THREE не загрузился (CDN)'; }
  var RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function webglOK() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) { return false; }
  }
  if (!webglOK()) { document.body.classList.add('nogl'); return; }
  gsap.registerPlugin(ScrollTrigger);

  /* ============ рендерер: киношный тон ============ */
  var canvas = document.getElementById('gl');
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x16130f);
  scene.fog = new THREE.Fog(0x16130f, 12, 42);

  var camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 80);

  /* ============ окружение (PMREM): мягкие отражения ============ */
  var pmrem = new THREE.PMREMGenerator(renderer);
  var envScene = new THREE.Scene();
  function envPanel(color, intensity, w, h, x, y, z, rx, ry) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity) }));
    m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, 0); m.material.side = THREE.DoubleSide;
    envScene.add(m);
  }
  envPanel(0xbfd4ff, 5.0, 6, 4, 0, 3, -6);          /* холодное окно */
  envPanel(0xffd9a0, 2.6, 4, 2, -5, 2.4, 0, 0, Math.PI / 2); /* тёплая лампа слева */
  envPanel(0xffffff, 0.8, 12, 12, 0, 8, 0, Math.PI / 2);      /* мягкий потолок */
  envPanel(0x2a2015, 1.0, 12, 12, 0, -4, 0, -Math.PI / 2);    /* тёмный пол */
  envPanel(0x8a7a66, 0.7, 12, 6, 6, 2, 0, 0, -Math.PI / 2);  /* стена */
  scene.environment = pmrem.fromScene(envScene, 0.05).texture;

  /* ============ процедурные текстуры ============ */
  function cnv(w, h, fn) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    fn(c.getContext('2d'), w, h);
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }
  /* древесина: волокна + прожилки */
  var woodTex = cnv(512, 512, function (ctx, w, h) {
    ctx.fillStyle = '#8a5a36'; ctx.fillRect(0, 0, w, h);
    for (var y = 0; y < h; y += 2) {
      var n = Math.sin(y * 0.055) * 14 + Math.sin(y * 0.21) * 6 + (Math.random() - 0.5) * 9;
      var tone = 138 + Math.sin(y * 0.03) * 26 + Math.random() * 16;
      ctx.fillStyle = 'rgba(' + (tone + 10) + ',' + (tone * 0.66) + ',' + (tone * 0.42) + ',0.55)';
      ctx.fillRect(0, y + n * 0.4, w, 2);
    }
    for (var i = 0; i < 26; i++) { /* тёмные прожилки */
      ctx.strokeStyle = 'rgba(52,30,16,' + (0.14 + Math.random() * 0.2) + ')';
      ctx.lineWidth = 0.7 + Math.random() * 1.8;
      ctx.beginPath();
      var x0 = Math.random() * w;
      ctx.moveTo(x0, -10);
      ctx.bezierCurveTo(x0 + (Math.random() - 0.5) * 60, h * 0.33, x0 + (Math.random() - 0.5) * 60, h * 0.66, x0 + (Math.random() - 0.5) * 40, h + 10);
      ctx.stroke();
    }
  });
  var woodRough = cnv(256, 256, function (ctx, w, h) {
    ctx.fillStyle = '#9a9a9a'; ctx.fillRect(0, 0, w, h);
    for (var i = 0; i < 900; i++) {
      ctx.fillStyle = 'rgba(' + (120 + Math.random() * 90) + ',0,0,' + (0.05 + Math.random() * 0.1) + ')';
      ctx.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 30, 1.5);
    }
  });
  /* штукатурка стен */
  var plasterTex = cnv(512, 512, function (ctx, w, h) {
    ctx.fillStyle = '#5a5248'; ctx.fillRect(0, 0, w, h);
    for (var i = 0; i < 5200; i++) {
      var g = 60 + Math.random() * 36;
      ctx.fillStyle = 'rgba(' + g + ',' + (g - 5) + ',' + (g - 12) + ',' + (0.05 + Math.random() * 0.09) + ')';
      ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2.4, 1 + Math.random() * 2.4);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    for (var j = 0; j < 340; j++) ctx.fillRect(Math.random() * w, Math.random() * h, 1.6, 1.6);
  });
  plasterTex.repeat.set(4, 2);
  /* половые доски */
  var floorTex = cnv(512, 512, function (ctx, w, h) {
    var plank = h / 8;
    for (var p = 0; p < 8; p++) {
      var tone = 96 + Math.random() * 30;
      ctx.fillStyle = 'rgb(' + tone + ',' + (tone * 0.74) + ',' + (tone * 0.5) + ')';
      ctx.fillRect(0, p * plank, w, plank);
      for (var s = 0; s < 46; s++) { /* волокна доски */
        ctx.strokeStyle = 'rgba(58,38,22,' + (0.06 + Math.random() * 0.12) + ')';
        ctx.lineWidth = 1;
        ctx.beginPath();
        var yy = p * plank + Math.random() * plank;
        ctx.moveTo(0, yy); ctx.lineTo(w, yy + (Math.random() - 0.5) * 6);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(28,16,8,0.85)'; ctx.fillRect(0, p * plank, w, 2); /* шов */
      var seam = Math.random() * w; ctx.fillRect(seam, p * plank, 2, plank);  /* стык торцов */
    }
  });
  floorTex.repeat.set(5, 5);

  /* ============ материалы ============ */
  var woodMat = new THREE.MeshStandardMaterial({ map: woodTex, roughnessMap: woodRough, roughness: 0.62, metalness: 0.04, envMapIntensity: 0.7 });
  var woodDarkMat = new THREE.MeshStandardMaterial({ map: woodTex, color: 0x8a6a4a, roughness: 0.7, metalness: 0.03, envMapIntensity: 0.4 });
  var steelMat = new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.38, metalness: 0.9, envMapIntensity: 1.0 }); /* матовый чёрный металл */
  var plasterMat = new THREE.MeshStandardMaterial({ map: plasterTex, roughness: 0.95, metalness: 0, envMapIntensity: 0.25 });
  var floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.55, metalness: 0.05, envMapIntensity: 0.55 });

  /* ============ комната ============ */
  var ROOM = new THREE.Group(); scene.add(ROOM);
  function box(w, h, d, mat, x, y, z) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = m.receiveShadow = true;
    ROOM.add(m); return m;
  }
  var FX = 9, FZ0 = -7, FZ1 = 15, FY = 0; /* пол: x [-9,9], z [-7,15] */
  var floor = new THREE.Mesh(new THREE.PlaneGeometry(2 * FX, FZ1 - FZ0), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, FY, (FZ0 + FZ1) / 2);
  floor.receiveShadow = true; ROOM.add(floor);

  var WH = 7.2; /* высота стен */
  var wallFar = new THREE.Mesh(new THREE.PlaneGeometry(2 * FX, WH), plasterMat);
  wallFar.position.set(0, WH / 2, FZ1); wallFar.receiveShadow = true; ROOM.add(wallFar);
  var wallLeft = new THREE.Mesh(new THREE.PlaneGeometry(FZ1 - FZ0, WH), plasterMat);
  wallLeft.rotation.y = Math.PI / 2; wallLeft.position.set(-FX, WH / 2, (FZ0 + FZ1) / 2);
  wallLeft.receiveShadow = true; ROOM.add(wallLeft);

  /* плинтус */
  box(2 * FX, 0.14, 0.05, new THREE.MeshStandardMaterial({ color: 0x2e2a24, roughness: 0.8 }), 0, 0.07, FZ1 - 0.03);
  box(0.05, 0.14, FZ1 - FZ0, new THREE.MeshStandardMaterial({ color: 0x2e2a24, roughness: 0.8 }), -FX + 0.03, 0.07, (FZ0 + FZ1) / 2);

  /* окно на дальней стене */
  var winMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x9db8d8).multiplyScalar(2.1) });
  var win = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.7), winMat);
  win.position.set(-3.4, 2.5, FZ1 - 0.06); ROOM.add(win);
  box(0.09, 1.86, 0.1, steelMat, -3.4, 2.5, FZ1 - 0.1);           /* вертикаль рамы */
  box(2.58, 0.09, 0.1, steelMat, -3.4, 3.4, FZ1 - 0.1);            /* верх рамы */
  box(2.58, 0.09, 0.1, steelMat, -3.4, 1.6, FZ1 - 0.1);            /* низ рамы */
  box(2.58, 0.06, 0.18, steelMat, -3.4, 0.75, FZ1 - 0.14);         /* подоконник */

  /* дверь на левой стене */
  var doorMat = new THREE.MeshStandardMaterial({ map: woodTex, color: 0x7a5c40, roughness: 0.6, envMapIntensity: 0.4 });
  var door = box(0.12, 2.25, 1.05, doorMat, -FX + 0.07, 1.125, 3.4);
  door.rotation.x = 0;
  var knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 14),
    new THREE.MeshStandardMaterial({ color: 0xc9a86a, roughness: 0.25, metalness: 1, envMapIntensity: 1.4 }));
  knob.position.set(-FX + 0.16, 1.12, 3.86); ROOM.add(knob);
  box(0.05, 2.4, 0.06, steelMat, -FX + 0.08, 1.2, 2.85);            /* наличник */
  box(0.05, 2.4, 0.06, steelMat, -FX + 0.08, 1.2, 3.95);

  /* картина на левой стене */
  var artTex = cnv(128, 96, function (ctx, w, h) {
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#c8b28a'); g.addColorStop(0.6, '#8a5f3c'); g.addColorStop(1, '#3c2a1c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,220,160,0.5)'; ctx.beginPath(); ctx.arc(w * 0.7, h * 0.28, 10, 0, 7); ctx.fill();
  });
  var art = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.66),
    new THREE.MeshStandardMaterial({ map: artTex, roughness: 0.85 }));
  art.rotation.y = Math.PI / 2; art.position.set(-FX + 0.05, 3.0, -2.6); ROOM.add(art);
  box(0.04, 0.76, 1.02, steelMat, -FX + 0.045, 3.0, -2.6);

  /* ============ второй этаж: плита с проёмом + перила площадки ============ */
  var TOP_Y = 4.55; /* отметка пола 2 этажа */
  var slabMat = new THREE.MeshStandardMaterial({ map: floorTex, color: 0xcbb59a, roughness: 0.6, envMapIntensity: 0.5 });
  box(2 * FX - 2.6, 0.22, 2.6, slabMat, 3.3, TOP_Y, FZ1 - 1.3);            /* плита справа от проёма */
  box(2.6, 0.22, 6.0, slabMat, 0, TOP_Y, FZ1 - 4.6);                        /* плита за проёмом */
  box(2 * FX, 0.22, FZ1 - 12.0, slabMat, 0, TOP_Y, 3.4 - 6.0);              /* плита над стартом (высоко над головой) */
  /* перила проёма */
  var holeRailPts = [];
  for (var q = 0; q <= 10; q++) holeRailPts.push(new THREE.Vector3(1.15, TOP_Y + 1.02, (FZ1 - 1.3) - 2.6 + (q / 10) * 2.6));
  var holeRail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(holeRailPts), 60, 0.035, 10, false), woodMat);
  holeRail.castShadow = true; ROOM.add(holeRail);
  for (var hp = 0; hp <= 5; hp++) {
    var hr = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.0, 8), steelMat);
    hr.position.set(1.15, TOP_Y + 0.5, (FZ1 - 1.3) - 2.6 + (hp / 5) * 2.6);
    hr.castShadow = true; ROOM.add(hr);
  }

  /* ============ лестница ============ */
  var N = 16, SW = 0.95, SR = 0.26, W = 1.15;
  var stair = new THREE.Group();
  stair.position.set(0, 0.22, -2.4); /* старт от пола, марш к проёму */
  scene.add(stair);

  var steps = [];
  for (var i = 0; i < N; i++) {
    var g = new THREE.Group();
    g.position.set(0, i * SR, i * SW);
    var tread = new THREE.Mesh(new THREE.BoxGeometry(W, 0.08, SW), woodMat);
    tread.position.y = SR; tread.castShadow = tread.receiveShadow = true; g.add(tread);
    var riser = new THREE.Mesh(new THREE.BoxGeometry(W, SR, 0.05), woodDarkMat);
    riser.position.set(0, SR / 2, -SW / 2); riser.castShadow = true; g.add(riser);
    var s1 = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.26, SW), steelMat);
    s1.position.set(-W / 2 + 0.035, SR - 0.13, 0);
    var s2 = s1.clone(); s2.position.x = W / 2 - 0.035;
    s1.castShadow = s2.castShadow = true; g.add(s1); g.add(s2);
    g.userData.t = 0;
    g.scale.set(0.001, 0.001, 0.001);
    stair.add(g); steps.push(g);
  }
  var post1 = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2.6, 0.09), steelMat);
  post1.position.set(-W / 2 + 0.035, 1.3, 0.06);
  var post2 = post1.clone(); post2.position.x = W / 2 - 0.035;
  stair.add(post1); stair.add(post2);
  post1.scale.set(0.001, 0.001, 0.001); post2.scale.set(0.001, 0.001, 0.001);

  var bal = [];
  for (var b = 0; b < N; b += 2) {
    var rod = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, SR * 2.7, 8), steelMat);
    rod.position.set(W / 2 - 0.035, SR * 2.95, b * SW);
    rod.castShadow = true; rod.scale.set(0.001, 0.001, 0.001);
    stair.add(rod); bal.push(rod);
  }
  var railPts = [];
  for (var r = 0; r <= N; r++) railPts.push(new THREE.Vector3(W / 2 - 0.035, r * SR + SR * 2.75 + 0.13, r * SW));
  var railGeom = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPts), 140, 0.032, 10, false);
  var rail = new THREE.Mesh(railGeom, woodMat);
  rail.castShadow = true; rail.geometry.setDrawRange(0, 0);
  stair.add(rail);
  var railIdxCount = railGeom.index ? railGeom.index.count : railGeom.attributes.position.count;

  /* ============ свет ============ */
  scene.add(new THREE.AmbientLight(0x8fa3c0, 0.34));
  var sun = new THREE.DirectionalLight(0xaec4e8, 1.15); /* вечерний свет из окна */
  sun.position.set(-3.4, 2.5, FZ1 - 0.4);
  sun.target.position.set(1.2, 0.6, -0.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -12;
  sun.shadow.camera.right = sun.shadow.camera.top = 12;
  sun.shadow.camera.far = 30; sun.shadow.bias = -0.0004;
  scene.add(sun); scene.add(sun.target);
  var lamp = new THREE.PointLight(0xffb46a, 1.5, 9, 2); /* тёплая лампа-бра у лестницы */
  lamp.position.set(-1.6, 3.1, 1.4);
  lamp.castShadow = true; lamp.shadow.mapSize.set(1024, 1024);
  scene.add(lamp);
  var topLamp = new THREE.PointLight(0xffc88a, 1.0, 8, 2); /* лампа на площадке 2 этажа */
  topLamp.position.set(0, TOP_Y + 2.0, FZ1 - 2.4);
  scene.add(topLamp);

  /* пылинки в лучах */
  var dustN = 220, dustPos = new Float32Array(dustN * 3);
  for (var d = 0; d < dustN; d++) {
    dustPos[d * 3] = (Math.random() - 0.5) * 10;
    dustPos[d * 3 + 1] = Math.random() * 6.4;
    dustPos[d * 3 + 2] = (Math.random() - 0.5) * 18 + 3;
  }
  var dustGeom = new THREE.BufferGeometry();
  dustGeom.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  var dust = new THREE.Points(dustGeom, new THREE.PointsMaterial({
    color: 0xd8c8a8, size: 0.02, transparent: true, opacity: 0.42, depthWrite: false
  }));
  scene.add(dust);

  /* ============ камера: лестница в верхней 2/3 кадра ============ */
  var camPos = [
    [2.6, 1.35, -4.6], [3.4, 1.9, 0.2], [3.1, 2.5, 4.6],
    [1.6, 3.4, 8.6], [-0.8, 4.5, 11.4], [-2.8, 4.9, 12.6],
    [-4.4, 4.2, 10.2], [-5.0, 2.9, 6.0], [-5.2, 1.9, 2.2]
  ];
  /* lookAt ДЕСЯТКИ ниже объектов -> объекты в кадре выше; здесь смотрим на низ марша + запас вверх */
  var camLook = [
    [0.2, 1.15, 0.6], [0.2, 2.05, 2.2], [0.2, 2.85, 4.4], [0.2, 3.5, 6.6],
    [0.3, 4.0, 8.4], [0.4, 4.15, 9.2], [0.3, 3.7, 8.0], [0.2, 3.0, 6.2], [0.2, 2.3, 4.0]
  ];
  var posCurve = new THREE.CatmullRomCurve3(camPos.map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); }));
  var lookCurve = new THREE.CatmullRomCurve3(camLook.map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); }));
  camera.position.set(2.6, 1.35, -4.6);
  camera.lookAt(0.2, 1.15, 0.6);
  camera.userData.look = new THREE.Vector3(0.2, 1.15, 0.6);

  /* ============ скролл ============ */
  var lenis = null;
  if (window.Lenis && !RM) {
    lenis = new Lenis({ lerp: 0.09 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }
  var P = { v: 0 };
  ScrollTrigger.create({
    trigger: '#scroll', start: 'top top', end: 'bottom bottom', scrub: true,
    onUpdate: function (st) { P.v = st.progress; }
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
  var stages = ['Проект', 'Каркас', 'Ступени', 'Ограждение', 'Монтаж', 'Готово'];
  var hudStage = document.getElementById('hud-stage');
  ScrollTrigger.create({
    trigger: '#scroll', start: 'top top', end: 'bottom bottom',
    onUpdate: function (st) {
      var i = Math.min(stages.length - 1, Math.floor(st.progress * stages.length));
      if (hudStage.textContent !== stages[i]) hudStage.textContent = stages[i];
    }
  });

  /* ============ рендер ============ */
  var clock = new THREE.Clock();
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  function tick() {
    var p = P.v, t = clock.getElapsedTime();
    var cp = posCurve.getPointAt(Math.min(p, 1));
    var cl = lookCurve.getPointAt(Math.min(p, 1));
    camera.position.lerp(cp, 0.08);
    camera.userData.look.lerp(cl, 0.08);
    camera.lookAt(camera.userData.look);

    var buildP = Math.min(p * 1.18, 1);
    var visibleN = buildP * (N + 2);
    steps.forEach(function (g, i) {
      var target = i < visibleN ? 1 : 0;
      g.userData.t = lerp(g.userData.t, target, 0.09);
      var s = g.userData.t;
      g.scale.set(Math.max(s, 0.001), Math.max(s, 0.001), Math.max(s, 0.001));
    });
    post1.scale.setScalar(Math.max(Math.min(1, visibleN / 1.5), 0.001));
    post2.scale.setScalar(post1.scale.x);
    bal.forEach(function (rod, j) {
      var s = lerp(rod.scale.x, (j * 2) < visibleN - 1 ? 1 : 0, 0.12);
      rod.scale.set(Math.max(s, 0.001), Math.max(s, 0.001), Math.max(s, 0.001));
    });
    rail.geometry.setDrawRange(0, Math.floor(railIdxCount * Math.min(buildP * 1.05, 1)));

    lamp.intensity = 1.3 + Math.sin(t * 2.1) * 0.07; /* лёгкое дыхание лампы */
    dust.rotation.y = t * 0.012;
    dust.position.y = Math.sin(t * 0.18) * 0.1;

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  addEventListener('resize', function () {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

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
