import * as THREE from "./vendor/three.module.min.js";

const canvas = document.getElementById("ts-scene");
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const narrowViewportQuery = window.matchMedia("(max-width: 48rem)");
const MAX_RENDERED_TABS = 32;
const DESKTOP_DPR_CAP = 1.5;
const NARROW_DPR_CAP = 1.25;
const SCENE_BUDGET = Object.freeze({
  drawCalls: 20,
  triangles: 30000,
  geometries: 10,
  textures: 0,
  materials: 5,
  postPasses: 0,
});

const palettes = {
  night: {
    background: 0x15120f,
    bodyPrimary: 0x625b52,
    bodySecondary: 0x27231f,
    bodyAlternate: 0x474139,
    trim: 0xc1b6a5,
    signal: 0xf05a3b,
    signalEmissive: 0x5e160c,
    groundContact: 0x050403,
    skyLight: 0xffe3c2,
    groundLight: 0x16110d,
    keyLight: 0xffd2a3,
    fillLight: 0x7793a1,
  },
  white: {
    background: 0xf2eee4,
    bodyPrimary: 0x847b70,
    bodySecondary: 0xc9c1b4,
    bodyAlternate: 0xa49a8c,
    trim: 0x433d36,
    signal: 0xd84c31,
    signalEmissive: 0x2a0602,
    groundContact: 0x5b5248,
    skyLight: 0xffffff,
    groundLight: 0xb8ab99,
    keyLight: 0xfff4dc,
    fillLight: 0x91a6ad,
  },
};

let renderer;
let scene;
let camera;
let orbitTilt;
let orbit;
let bodyInstances;
let faceInstances;
let activeTab;
let tabGeometry;
let faceGeometry;
let railGeometry;
let tickGeometry;
let contactGeometry;
let rail;
let ticks;
let contact;
let materials;
let hemisphereLight;
let keyLight;
let fillLight;
let instanceCount = 0;
let logicalTabCount = 0;
let activeInstanceIndex = 0;
let targetRotation = 0;
let frameRequest = 0;
let lastFrameTime = 0;
let hasRendered = false;
let disposed = false;
let currentState = normalizeState(window.TabScrollSceneState);

if (canvas) {
  try {
    init();
  } catch (_error) {
    showFallback();
  }
}

function init() {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.shadowMap.enabled = false;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(31, 1, 0.1, 60);
  camera.position.set(0, 3.25, 18);
  camera.lookAt(0, -0.15, 0);

  orbitTilt = new THREE.Group();
  orbitTilt.rotation.x = 0.07;
  orbitTilt.rotation.z = -0.035;
  scene.add(orbitTilt);

  orbit = new THREE.Group();
  orbitTilt.add(orbit);

  createMaterialKit();
  createLights();
  rebuildOrbit(getRequestedInstanceCount(currentState));
  applyPalette(currentState.theme);
  updateSelection(currentState.activeIndex, currentState.totalTabs, true);
  resize();

  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("pagehide", dispose, { once: true });
  document.addEventListener("visibilitychange", handleVisibilityChange);
  canvas.addEventListener("webglcontextlost", handleContextLost, false);

  if (typeof reducedMotionQuery.addEventListener === "function") {
    reducedMotionQuery.addEventListener("change", handleMotionPreferenceChange);
    narrowViewportQuery.addEventListener("change", resize);
  }

  window.TabScrollBackdrop = {
    setState,
    getDiagnostics,
    dispose,
  };

  setState(currentState);
}

function createMaterialKit() {
  materials = {
    bodyPrimary: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.48,
      roughness: 0.46,
      vertexColors: true,
    }),
    bodySecondary: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.12,
      roughness: 0.83,
    }),
    trim: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.35,
      roughness: 0.58,
    }),
    emissiveSignal: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x000000,
      emissiveIntensity: 0.32,
      metalness: 0.2,
      roughness: 0.5,
    }),
    groundContact: new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    }),
  };
}

function createLights() {
  hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x111111, 1.7);
  keyLight = new THREE.DirectionalLight(0xffffff, 3.1);
  keyLight.position.set(-5.5, 8, 9);
  fillLight = new THREE.DirectionalLight(0xffffff, 1.2);
  fillLight.position.set(7, -1.5, 5);
  scene.add(hemisphereLight, keyLight, fillLight);
}

function createTabShape() {
  const shape = new THREE.Shape();
  shape.moveTo(-1.3, -0.58);
  shape.lineTo(1.3, -0.58);
  shape.lineTo(1.3, 0.14);
  shape.quadraticCurveTo(1.13, 0.18, 1.02, 0.52);
  shape.quadraticCurveTo(0.94, 0.68, 0.72, 0.68);
  shape.lineTo(-0.74, 0.68);
  shape.quadraticCurveTo(-0.98, 0.68, -1.05, 0.49);
  shape.quadraticCurveTo(-1.14, 0.2, -1.3, 0.14);
  shape.closePath();
  return shape;
}

function rebuildOrbit(nextInstanceCount) {
  clearOrbit();
  instanceCount = nextInstanceCount;

  if (!instanceCount) {
    renderOnce();
    return;
  }

  const tabShape = createTabShape();
  tabGeometry = new THREE.ExtrudeGeometry(tabShape, {
    depth: 0.18,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.055,
    bevelThickness: 0.045,
    curveSegments: 7,
    steps: 1,
  });
  tabGeometry.center();

  faceGeometry = new THREE.ShapeGeometry(tabShape, 7);
  faceGeometry.center();

  bodyInstances = new THREE.InstancedMesh(tabGeometry, materials.bodyPrimary, instanceCount);
  bodyInstances.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  bodyInstances.frustumCulled = false;

  faceInstances = new THREE.InstancedMesh(faceGeometry, materials.bodySecondary, instanceCount);
  faceInstances.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  faceInstances.frustumCulled = false;

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  for (let index = 0; index < instanceCount; index += 1) {
    setOrbitTransform(dummy, index, instanceCount, 0, 1);
    bodyInstances.setMatrixAt(index, dummy.matrix);
    color.set(index % 3 === 0 ? palettes.night.bodyAlternate : palettes.night.bodyPrimary);
    bodyInstances.setColorAt(index, color);

    setOrbitTransform(dummy, index, instanceCount, 0.105, 0.82);
    dummy.scale.y *= 0.76;
    dummy.updateMatrix();
    faceInstances.setMatrixAt(index, dummy.matrix);
  }

  bodyInstances.instanceMatrix.needsUpdate = true;
  bodyInstances.instanceColor.needsUpdate = true;
  faceInstances.instanceMatrix.needsUpdate = true;

  activeTab = new THREE.Mesh(tabGeometry, materials.emissiveSignal);
  activeTab.renderOrder = 2;

  const pathPoints = Array.from({ length: 48 }, (_, index) =>
    getOrbitPosition((index / 48) * Math.PI * 2, 7.62)
  );
  const path = new THREE.CatmullRomCurve3(pathPoints, true, "catmullrom", 0.42);
  railGeometry = new THREE.TubeGeometry(path, 96, 0.018, 5, true);
  rail = new THREE.Mesh(railGeometry, materials.trim);

  tickGeometry = new THREE.BoxGeometry(0.035, 0.32, 0.035);
  ticks = new THREE.InstancedMesh(tickGeometry, materials.trim, instanceCount);
  ticks.instanceMatrix.setUsage(THREE.StaticDrawUsage);

  for (let index = 0; index < instanceCount; index += 1) {
    const angle = getOrbitAngle(index, instanceCount);
    const position = getOrbitPosition(angle, 7.82);
    dummy.position.copy(position);
    dummy.rotation.set(0, Math.PI / 2 - angle, Math.sin(angle * 2) * 0.12);
    dummy.scale.set(1, index % 4 === 0 ? 1.45 : 0.72, 1);
    dummy.updateMatrix();
    ticks.setMatrixAt(index, dummy.matrix);
  }

  ticks.instanceMatrix.needsUpdate = true;

  contactGeometry = new THREE.CircleGeometry(3.8, 64);
  contact = new THREE.Mesh(contactGeometry, materials.groundContact);
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = -2.5;
  contact.scale.set(1.9, 0.72, 1);

  orbit.add(contact, rail, ticks, bodyInstances, faceInstances, activeTab);
}

function clearOrbit() {
  if (!orbit) {
    return;
  }

  orbit.clear();

  for (const geometry of [tabGeometry, faceGeometry, railGeometry, tickGeometry, contactGeometry]) {
    geometry?.dispose();
  }

  tabGeometry = undefined;
  faceGeometry = undefined;
  railGeometry = undefined;
  tickGeometry = undefined;
  contactGeometry = undefined;
  bodyInstances = undefined;
  faceInstances = undefined;
  activeTab = undefined;
  rail = undefined;
  ticks = undefined;
  contact = undefined;
}

function getOrbitAngle(index, count) {
  return (index / Math.max(count, 1)) * Math.PI * 2;
}

function getOrbitPosition(angle, radius) {
  return new THREE.Vector3(
    Math.cos(angle) * radius,
    Math.sin(angle * 2 + 0.35) * 0.92,
    Math.sin(angle) * radius
  );
}

function setOrbitTransform(object, index, count, radialOffset, scale) {
  const angle = getOrbitAngle(index, count);
  object.position.copy(getOrbitPosition(angle, 7.5 + radialOffset));
  object.rotation.set(
    Math.sin(angle) * 0.065,
    Math.PI / 2 - angle,
    Math.sin(angle * 2 + 0.4) * 0.11
  );
  object.scale.setScalar(scale);
  object.updateMatrix();
}

function setState(nextState) {
  if (disposed || !renderer) {
    return;
  }

  const normalized = normalizeState(nextState);
  const nextCount = getRequestedInstanceCount(normalized);
  const themeChanged = normalized.theme !== currentState.theme;
  const countChanged = nextCount !== instanceCount;
  const firstResolvedState = currentState.loading && !normalized.loading;

  currentState = normalized;
  logicalTabCount = normalized.totalTabs;

  if (countChanged) {
    rebuildOrbit(nextCount);
  }

  if (themeChanged || countChanged) {
    applyPalette(normalized.theme);
  }

  updateSelection(
    normalized.activeIndex,
    normalized.totalTabs,
    firstResolvedState || reducedMotionQuery.matches
  );
}

function normalizeState(value = {}) {
  const totalTabs = Number.isFinite(value?.totalTabs)
    ? Math.max(0, Math.floor(value.totalTabs))
    : 0;
  const activeIndex = Number.isFinite(value?.activeIndex)
    ? Math.max(0, Math.min(Math.floor(value.activeIndex), Math.max(0, totalTabs - 1)))
    : 0;

  return {
    activeIndex,
    totalTabs,
    theme: value?.theme === "white" ? "white" : "night",
    loading: value?.loading !== false,
  };
}

function getRequestedInstanceCount(value) {
  if (value.loading) {
    return 12;
  }

  return Math.min(value.totalTabs, MAX_RENDERED_TABS);
}

function getMappedInstanceIndex(activeIndex, totalTabs) {
  if (instanceCount <= 1 || totalTabs <= 1) {
    return 0;
  }

  return Math.round((activeIndex / (totalTabs - 1)) * (instanceCount - 1));
}

function updateSelection(activeIndex, totalTabs, snap) {
  if (!instanceCount || !activeTab) {
    renderOnce();
    return;
  }

  activeInstanceIndex = getMappedInstanceIndex(activeIndex, totalTabs);
  setOrbitTransform(activeTab, activeInstanceIndex, instanceCount, -0.03, 1.045);

  const activeAngle = getOrbitAngle(activeInstanceIndex, instanceCount);
  const baseTarget = activeAngle - Math.PI / 2;
  targetRotation = getNearestEquivalentAngle(baseTarget, orbit.rotation.y);

  if (snap) {
    orbit.rotation.y = targetRotation;
    renderOnce();
    return;
  }

  requestFrame();
}

function getNearestEquivalentAngle(angle, reference) {
  let candidate = angle;

  while (candidate - reference > Math.PI) {
    candidate -= Math.PI * 2;
  }

  while (candidate - reference < -Math.PI) {
    candidate += Math.PI * 2;
  }

  return candidate;
}

function applyPalette(themeName) {
  const palette = palettes[themeName] || palettes.night;
  scene.background = new THREE.Color(palette.background);
  scene.fog = new THREE.Fog(palette.background, 11, 29);

  materials.bodyPrimary.color.set(palette.bodyPrimary);
  materials.bodySecondary.color.set(palette.bodySecondary);
  materials.trim.color.set(palette.trim);
  materials.emissiveSignal.color.set(palette.signal);
  materials.emissiveSignal.emissive.set(palette.signalEmissive);
  materials.groundContact.color.set(palette.groundContact);
  materials.groundContact.opacity = themeName === "white" ? 0.08 : 0.21;

  hemisphereLight.color.set(palette.skyLight);
  hemisphereLight.groundColor.set(palette.groundLight);
  keyLight.color.set(palette.keyLight);
  fillLight.color.set(palette.fillLight);

  if (bodyInstances?.instanceColor) {
    const color = new THREE.Color();

    for (let index = 0; index < instanceCount; index += 1) {
      color.set(index % 3 === 0 ? palette.bodyAlternate : palette.bodyPrimary);
      bodyInstances.setColorAt(index, color);
    }

    bodyInstances.instanceColor.needsUpdate = true;
  }

  requestFrame();
}

function getDprCap() {
  return narrowViewportQuery.matches ? NARROW_DPR_CAP : DESKTOP_DPR_CAP;
}

function resize() {
  if (!renderer || !camera || disposed) {
    return;
  }

  const width = Math.max(1, window.innerWidth || canvas.clientWidth || 1);
  const height = Math.max(1, window.innerHeight || canvas.clientHeight || 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, getDprCap()));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.fov = width < 640 ? 39 : 31;
  camera.updateProjectionMatrix();
  renderOnce();
}

function requestFrame() {
  if (frameRequest || document.hidden || disposed) {
    return;
  }

  frameRequest = window.requestAnimationFrame(animate);
}

function animate(time) {
  frameRequest = 0;

  if (disposed || document.hidden) {
    return;
  }

  const deltaSeconds = lastFrameTime ? Math.min((time - lastFrameTime) / 1000, 0.05) : 1 / 60;
  lastFrameTime = time;

  if (reducedMotionQuery.matches) {
    orbit.rotation.y = targetRotation;
    renderOnce();
    return;
  }

  const difference = targetRotation - orbit.rotation.y;
  const blend = 1 - Math.exp(-8.2 * deltaSeconds);

  if (Math.abs(difference) <= 0.0007) {
    orbit.rotation.y = targetRotation;
    lastFrameTime = 0;
    renderOnce();
    return;
  }

  orbit.rotation.y += difference * blend;
  renderer.render(scene, camera);
  markSceneReady();
  requestFrame();
}

function renderOnce() {
  if (!renderer || !scene || !camera || disposed || document.hidden) {
    return;
  }

  renderer.render(scene, camera);
  markSceneReady();
}

function markSceneReady() {
  if (hasRendered) {
    return;
  }

  hasRendered = true;
  document.body.classList.add("scene-ready");
}

function showFallback() {
  document.body.classList.remove("scene-ready");
  document.body.classList.add("scene-unavailable");
}

function handleContextLost(event) {
  event.preventDefault();
  showFallback();
  dispose();
}

function handleMotionPreferenceChange() {
  orbit.rotation.y = targetRotation;
  renderOnce();
}

function handleVisibilityChange() {
  if (document.hidden) {
    if (frameRequest) {
      window.cancelAnimationFrame(frameRequest);
      frameRequest = 0;
    }
    lastFrameTime = 0;
    return;
  }

  requestFrame();
}

function getDiagnostics() {
  const renderInfo = renderer?.info?.render || {};
  const memoryInfo = renderer?.info?.memory || {};

  return {
    ready: Boolean(hasRendered && renderer && !disposed),
    logicalTabCount,
    instanceCount,
    activeInstanceIndex,
    drawCalls: renderInfo.calls || 0,
    triangles: renderInfo.triangles || 0,
    geometries: memoryInfo.geometries || 0,
    textures: memoryInfo.textures || 0,
    materialCount: materials ? Object.keys(materials).length : 0,
    pixelRatio: renderer?.getPixelRatio?.() || 0,
    dprCap: getDprCap(),
    postPasses: 0,
    shadows: false,
    renderingAtRest: frameRequest === 0,
    budget: SCENE_BUDGET,
  };
}

function dispose() {
  if (disposed) {
    return;
  }

  disposed = true;

  if (frameRequest) {
    window.cancelAnimationFrame(frameRequest);
    frameRequest = 0;
  }

  window.removeEventListener("resize", resize);
  document.removeEventListener("visibilitychange", handleVisibilityChange);

  if (typeof reducedMotionQuery.removeEventListener === "function") {
    reducedMotionQuery.removeEventListener("change", handleMotionPreferenceChange);
    narrowViewportQuery.removeEventListener("change", resize);
  }

  clearOrbit();

  for (const material of Object.values(materials || {})) {
    material.dispose();
  }

  renderer?.dispose();
}
