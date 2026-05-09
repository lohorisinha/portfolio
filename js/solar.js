/**
 * solar.js
 * ─────────────────────────────────────────────────────
 * Three.js 3D solar system for the hero section.
 *
 * KEY THINGS TO CUSTOMISE:
 *   planetDefs  → add/remove/rename planets, change
 *                 colors, orbit radius, and speed.
 *   SUN_*       → sun size and pulse strength.
 *   STAR_COUNT  → more = denser sky, heavier GPU.
 *   CAM_*       → default camera position and zoom limits.
 *
 * Requires Three.js r128 loaded before this file.
 * ─────────────────────────────────────────────────────
 */

(function () {

  /* ── Config ──────────────────────────────────────── */

  const STAR_COUNT    = 2400;
  const SUN_RADIUS    = 2.8;
  const SUN_PULSE_MIN = 0.9;
  const SUN_PULSE_MAX = 1.02;

  // Camera defaults
  const CAM_THETA   = 0.48;   // horizontal start angle
  const CAM_PHI     = 0.44;   // vertical start angle
  const CAM_RADIUS  = 42;     // distance from origin
  const CAM_MIN     = 14;     // min zoom
  const CAM_MAX     = 65;     // max zoom

  /**
   * Planet definitions.
   * Add a new object here to add a new planet.
   *
   * name   : label shown in 3D and on hover
   * color  : hex int for surface color
   * emissive : hex int for inner glow color
   * radius : sphere size (Three.js units)
   * orbit  : orbit radius from the sun
   * speed  : radians per frame (higher = faster orbit)
   * phase  : starting angle in radians
   */
  const planetDefs = [
    { name: 'PROJECTS', color: 0xc8b0f0, emissive: 0x8860c0, radius: 1.10, orbit:  9.0, speed: 0.0040, phase: 0.4 },
    { name: 'SKILLS',   color: 0xa8e6c4, emissive: 0x50b870, radius: 0.95, orbit: 13.5, speed: 0.0027, phase: 1.9 },
    { name: 'ABOUT',    color: 0xf5c8a0, emissive: 0xe08050, radius: 1.00, orbit: 17.5, speed: 0.0018, phase: 3.6 },
    { name: 'CONTACT',  color: 0xa8d4f5, emissive: 0x5090d0, radius: 0.88, orbit: 22.0, speed: 0.0012, phase: 5.2 },
  ];


  /* ── DOM refs ────────────────────────────────────── */

  const canvas    = document.getElementById('solarCanvas');
  const returnBtn = document.getElementById('returnBtn');
  const tooltip   = document.getElementById('tooltip');
  const hero      = document.getElementById('hero');

  const W = () => hero.clientWidth;
  const H = () => hero.clientHeight;


  /* ── Renderer ────────────────────────────────────── */

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(W(), H());


  /* ── Scene + Camera ──────────────────────────────── */

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, W() / H(), 0.1, 800);

  const defaultCamPos = new THREE.Vector3(0, 20, CAM_RADIUS);
  camera.position.copy(defaultCamPos);
  camera.lookAt(0, 0, 0);

  // Orbit state (spherical coords)
  let orbitTheta  = CAM_THETA,  targetTheta  = CAM_THETA;
  let orbitPhi    = CAM_PHI,    targetPhi    = CAM_PHI;
  let orbitRadius = CAM_RADIUS, targetRadius = CAM_RADIUS;

  // Fly-to state
  let flying        = false;
  let focusedPlanet = null;
  let targetCamPos  = defaultCamPos.clone();
  let targetCamLook = new THREE.Vector3(0, 0, 0);


  /* ── Lighting ────────────────────────────────────── */

  scene.add(new THREE.AmbientLight(0xfff4e0, 0.28));

  const sunLight = new THREE.PointLight(0xfffbe6, 2.4, 140);
  sunLight.position.set(0, 0, 0);
  scene.add(sunLight);

  const rimLight = new THREE.PointLight(0xb8a8ff, 0.5, 90);
  rimLight.position.set(-25, 8, -15);
  scene.add(rimLight);


  /* ── Stars ───────────────────────────────────────── */

  // Soft glowing point texture baked to canvas
  function makeStarTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0,   'rgba(255, 255, 255, 1)');
    g.addColorStop(0.3, 'rgba(220, 210, 255, 0.8)');
    g.addColorStop(1,   'rgba(200, 180, 255, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(16, 16, 16, 0, Math.PI * 2);
    ctx.fill();
    return new THREE.CanvasTexture(c);
  }

  const starGeo  = new THREE.BufferGeometry();
  const starPos  = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    // Distribute uniformly across a sphere shell
    const r     = 150 + Math.random() * 200;
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    starPos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    starPos[i * 3 + 2] = r * Math.cos(phi);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));

  const starMat = new THREE.PointsMaterial({
    map: makeStarTexture(),
    size: 1.1,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);


  /* ── Sun ─────────────────────────────────────────── */

  const sunGeo = new THREE.SphereGeometry(SUN_RADIUS, 64, 64);
  const sunMat = new THREE.MeshStandardMaterial({
    color: 0xfff5b0,
    emissive: 0xffd060,
    emissiveIntensity: 1.0,
    roughness: 0.5,
    metalness: 0.0,
  });
  const sun = new THREE.Mesh(sunGeo, sunMat);
  scene.add(sun);

  // Soft volumetric glow around the sun
  function makeSunGlowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0,   'rgba(255, 240, 120, 0.4)');
    g.addColorStop(0.4, 'rgba(255, 210,  80, 0.15)');
    g.addColorStop(1,   'rgba(255, 180,  60, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  const glowSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: makeSunGlowTexture(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  glowSprite.scale.set(12, 12, 1);
  scene.add(glowSprite);


  /* ── Planets ─────────────────────────────────────── */

  /**
   * Bake a radial-gradient sphere texture to canvas.
   * Gives each planet a lit appearance without real normals.
   */
  function makePlanetTexture(col) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const r = (col >> 16) & 0xff;
    const g = (col >>  8) & 0xff;
    const b =  col        & 0xff;
    const grad = ctx.createRadialGradient(45, 40, 4, 64, 64, 64);
    grad.addColorStop(0,   `rgba(${Math.min(r + 60, 255)}, ${Math.min(g + 60, 255)}, ${Math.min(b + 60, 255)}, 1)`);
    grad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 1)`);
    grad.addColorStop(1,   `rgba(${Math.max(r - 40, 0)}, ${Math.max(g - 40, 0)}, ${Math.max(b - 40, 0)}, 1)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(64, 64, 64, 0, Math.PI * 2);
    ctx.fill();
    return new THREE.CanvasTexture(c);
  }

  /** Bake a text label to canvas for use as a billboard sprite. */
  function makeLabelTexture(name) {
    const c = document.createElement('canvas');
    c.width = 320; c.height = 72;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 320, 72);
    ctx.font = '700 20px Syne, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(200, 160, 255, 0.8)';
    ctx.shadowBlur = 14;
    ctx.fillText(name, 160, 42);
    return new THREE.CanvasTexture(c);
  }

  const planets = planetDefs.map(pd => {
    // Orbit guide ring
    const orbitPts = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      orbitPts.push(new THREE.Vector3(Math.cos(a) * pd.orbit, 0, Math.sin(a) * pd.orbit));
    }
    const orbitLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(orbitPts),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.06 })
    );
    scene.add(orbitLine);

    // Sphere mesh
    const geo  = new THREE.SphereGeometry(pd.radius, 48, 48);
    const tex  = makePlanetTexture(pd.color);
    const mat  = new THREE.MeshStandardMaterial({
      map: tex,
      emissive: new THREE.Color(pd.emissive),
      emissiveIntensity: 0.2,
      roughness: 0.65,
      metalness: 0.0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);

    // Billboarded name label
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeLabelTexture(pd.name),
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      })
    );
    sprite.scale.set(4, 0.9, 1);
    scene.add(sprite);

    return {
      mesh,
      sprite,
      mat,
      name:       pd.name,
      orbit:      pd.orbit,
      speed:      pd.speed,
      baseRadius: pd.radius,
      angle:      pd.phase,
      paused:     false,
    };
  });


  /* ── Mouse / Orbit controls ──────────────────────── */

  let isDragging = false;
  let lastMX = 0, lastMY = 0;
  let mouseX = 0, mouseY = 0; // normalised device coords (-1..1)

  canvas.addEventListener('mousedown', e => {
    isDragging = true;
    lastMX = e.clientX;
    lastMY = e.clientY;
  });

  window.addEventListener('mouseup', () => { isDragging = false; });

  canvas.addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect();
    mouseX =  ((e.clientX - r.left) / r.width)  * 2 - 1;
    mouseY = -((e.clientY - r.top)  / r.height) * 2 + 1;

    if (isDragging && !flying) {
      const dx = e.clientX - lastMX;
      const dy = e.clientY - lastMY;
      targetTheta -= dx * 0.005;
      targetPhi   -= dy * 0.005;
      targetPhi = Math.max(0.12, Math.min(Math.PI * 0.46, targetPhi));
      lastMX = e.clientX;
      lastMY = e.clientY;
    }

    // Tooltip follows cursor
    tooltip.style.left = e.clientX + 'px';
    tooltip.style.top  = (e.clientY - 36) + 'px';
  });

  canvas.addEventListener('wheel', e => {
    if (flying) return;
    targetRadius = Math.max(CAM_MIN, Math.min(CAM_MAX, targetRadius + e.deltaY * 0.035));
    e.preventDefault();
  }, { passive: false });


  /* ── Click: sun + planet fly-in ──────────────────── */

  const raycaster = new THREE.Raycaster();

  canvas.addEventListener('click', () => {
    if (isDragging) return;
    const m = new THREE.Vector2(mouseX, mouseY);
    raycaster.setFromCamera(m, camera);

    // Sun click
    if (raycaster.intersectObject(sun).length > 0) {
      console.log('Hello World');
      return;
    }

    // Planet click → fly-in
    const hits = raycaster.intersectObjects(planets.map(p => p.mesh));
    if (hits.length > 0) {
      const idx = planets.findIndex(p => p.mesh === hits[0].object);
      if (idx >= 0) {
        const p = planets[idx];
        flying = true;
        focusedPlanet = idx;
        const pp  = p.mesh.position.clone();
        const off = new THREE.Vector3(0, p.baseRadius * 1.5, p.baseRadius * 4 + 2.8);
        targetCamPos  = pp.clone().add(off);
        targetCamLook = pp.clone();
        returnBtn.style.display = 'block';
        planets.forEach((pl, i) => { pl.paused = (i === idx); });
      }
    }
  });

  returnBtn.addEventListener('click', () => {
    flying        = false;
    focusedPlanet = null;
    targetCamPos  = defaultCamPos.clone();
    targetCamLook = new THREE.Vector3(0, 0, 0);
    returnBtn.style.display = 'none';
    planets.forEach(pl => { pl.paused = false; });
  });


  /* ── Camera update helpers ───────────────────────── */

  function updateOrbitCamera() {
    camera.position.x = orbitRadius * Math.sin(orbitPhi) * Math.sin(orbitTheta);
    camera.position.y = orbitRadius * Math.cos(orbitPhi);
    camera.position.z = orbitRadius * Math.sin(orbitPhi) * Math.cos(orbitTheta);
    camera.lookAt(0, 0, 0);
  }
  updateOrbitCamera();


  /* ── Render loop ─────────────────────────────────── */

  let clock = 0;

  function animate() {
    requestAnimationFrame(animate);
    clock += 0.016;

    // Smooth orbit drag
    orbitTheta  += (targetTheta  - orbitTheta)  * 0.07;
    orbitPhi    += (targetPhi    - orbitPhi)    * 0.07;
    orbitRadius += (targetRadius - orbitRadius) * 0.07;
    if (!flying) updateOrbitCamera();

    // Smooth fly-in
    if (flying) {
      camera.position.lerp(targetCamPos, 0.035);
      camera.lookAt(targetCamLook);
    }

    // Sun continuous pulse
    const pulse = SUN_PULSE_MIN + (SUN_PULSE_MAX - SUN_PULSE_MIN) * (0.5 + 0.5 * Math.sin(clock * 1.8));
    sun.scale.setScalar(pulse);
    sunMat.emissiveIntensity = 0.88 + 0.18 * Math.sin(clock * 1.8);
    sunLight.intensity       = 2.0  + 0.40 * Math.sin(clock * 1.8);
    glowSprite.scale.setScalar(10 + 2.5 * Math.sin(clock * 1.8));
    sun.rotation.y += 0.003;

    // Hover raycasting
    raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);
    const hovHits = raycaster.intersectObjects(planets.map(p => p.mesh));
    const hitMesh = hovHits.length > 0 ? hovHits[0].object : null;
    let hovName   = null;

    // Planet positions + hover effects
    planets.forEach(p => {
      if (!p.paused) p.angle += p.speed;
      p.mesh.position.set(
        Math.cos(p.angle) * p.orbit,
        0,
        Math.sin(p.angle) * p.orbit
      );
      p.sprite.position.set(
        p.mesh.position.x,
        p.mesh.position.y + p.baseRadius + 0.95,
        p.mesh.position.z
      );
      p.mesh.rotation.y += 0.005;

      const isHov = (p.mesh === hitMesh);
      if (isHov) hovName = p.name;

      const targetScale = isHov ? 1.22 : 1.0;
      p.mesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
      p.mat.emissiveIntensity += ((isHov ? 0.48 : 0.2) - p.mat.emissiveIntensity) * 0.1;
    });

    // Tooltip + cursor
    if (hovName) {
      tooltip.textContent  = hovName;
      tooltip.style.display = 'block';
      canvas.style.cursor   = 'pointer';
    } else {
      tooltip.style.display = 'none';
      canvas.style.cursor   = raycaster.intersectObject(sun).length > 0 ? 'pointer' : 'default';
    }

    // Star parallax (moves slower than planets)
    stars.rotation.y = orbitTheta * 0.035;
    stars.rotation.x = orbitPhi   * 0.035;

    renderer.render(scene, camera);
  }

  animate();


  /* ── Resize handler ──────────────────────────────── */

  window.addEventListener('resize', () => {
    renderer.setSize(W(), H());
    camera.aspect = W() / H();
    camera.updateProjectionMatrix();
  });

})();
