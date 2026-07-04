import * as THREE from "three";
import { VRButton } from "three/addons/webxr/VRButton.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createTable, TABLE_CENTER, PLAYER_ANCHOR } from "./table.js";

const EYE_HEIGHT = 1.5;

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
camera.position.set(PLAYER_ANCHOR.x, EYE_HEIGHT, PLAYER_ANCHOR.z);

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

const table = createTable();
scene.add(table.group);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(TABLE_CENTER);
controls.enableDamping = true;
controls.update();

renderer.xr.addEventListener("sessionstart", () => {
  controls.enabled = false;

  // Offset the XR reference space so the headset's tracked floor origin lands
  // at PLAYER_ANCHOR instead of the scene's world origin (0,0,0). Forward is
  // already -Z for both the WebXR convention and PLAYER_ANCHOR_FORWARD, so no
  // rotation offset is needed here.
  const baseReferenceSpace = renderer.xr.getReferenceSpace();
  if (baseReferenceSpace) {
    const transform = new XRRigidTransform(
      { x: -PLAYER_ANCHOR.x, y: -PLAYER_ANCHOR.y, z: -PLAYER_ANCHOR.z },
      { x: 0, y: 0, z: 0, w: 1 }
    );
    renderer.xr.setReferenceSpace(baseReferenceSpace.getOffsetReferenceSpace(transform));
  }
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
