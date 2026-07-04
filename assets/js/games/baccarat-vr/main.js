import * as THREE from "three";
import { VRButton } from "three/addons/webxr/VRButton.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const canvasWrap = document.getElementById("baccarat-vr-canvas-wrap");
const vrButtonSlot = document.getElementById("vr-button-slot");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(
  60,
  canvasWrap.clientWidth / canvasWrap.clientHeight,
  0.01,
  100
);
camera.position.set(0, 1.5, 0.9);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.xr.enabled = true;
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(canvasWrap.clientWidth, canvasWrap.clientHeight);
canvasWrap.appendChild(renderer.domElement);

vrButtonSlot.appendChild(
  VRButton.createButton(renderer, {
    optionalFeatures: ["local-floor", "bounded-floor", "hand-tracking"],
  })
);

const ambient = new THREE.AmbientLight(0xffffff, 0.6);
const directional = new THREE.DirectionalLight(0xffffff, 0.8);
directional.position.set(1, 2, 1);
scene.add(ambient, directional);

// Placeholder so there is something to confirm renders before the real table (Phase 4) exists.
const placeholder = new THREE.Mesh(
  new THREE.BoxGeometry(1.2, 0.05, 0.8),
  new THREE.MeshStandardMaterial({ color: 0x0a0a0a })
);
placeholder.position.set(0, 0.85, -0.6);
scene.add(placeholder);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.85, -0.6);
controls.enableDamping = true;
controls.update();

renderer.xr.addEventListener("sessionstart", () => {
  controls.enabled = false;
});
renderer.xr.addEventListener("sessionend", () => {
  controls.enabled = true;
});

function resize() {
  const width = canvasWrap.clientWidth;
  const height = canvasWrap.clientHeight;
  if (width === 0 || height === 0) return;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

window.addEventListener("resize", resize);
new ResizeObserver(resize).observe(canvasWrap);

function render() {
  if (controls.enabled) controls.update();
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(render);
