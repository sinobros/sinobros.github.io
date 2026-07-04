import * as THREE from "three";
import { VRButton } from "three/addons/webxr/VRButton.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createTable, TABLE_CENTER, PLAYER_ANCHOR } from "./table.js";
import { createRoom } from "./room.js";
import { SUITS, RANKS, CHIP_VALUES, createInitialState, placeBet, clearBets } from "./engine.js";
import { createCardMesh } from "./cards.js";
import { createChip } from "./chips.js";
import { createInputSystem } from "./input.js";
import { createUI, applyHoverScale, flashPress, tickPressFlash } from "./ui.js";

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

const room = createRoom();
scene.add(room.group);

const table = createTable();
scene.add(table.group);

const ui = createUI();
scene.add(ui.group);

const engineState = createInitialState();
ui.setSelectedChip(engineState.chip);

const inputSystem = createInputSystem();
const pressableMeshes = [ui.dealButton, ui.clearButton, ui.rulesButton, ...ui.chipMeshesByValue.values()];

Object.values(table.betZones).forEach((mesh) => {
  inputSystem.registerInteractive(mesh, "placeBet", mesh.userData.betSide, { side: mesh.userData.betSide });
});
ui.chipMeshesByValue.forEach((mesh, value) => {
  inputSystem.registerInteractive(mesh, "selectChip", `Chip ${value}`, { value });
});
inputSystem.registerInteractive(ui.dealButton, "deal", "Deal");
inputSystem.registerInteractive(ui.clearButton, "clearBets", "Clear Bets");
inputSystem.registerInteractive(ui.rulesButton, "toggleRules", "Rules");

function totalStake(state) {
  return state.bets.player + state.bets.tie + state.bets.banker;
}

function refreshUI() {
  const wager = totalStake(engineState);
  ui.setStatus({
    balance: engineState.balance,
    wager,
    status: engineState.inRound ? "Dealing" : "Place your bet",
  });
  ui.setDealEnabled(!engineState.inRound && wager > 0);
}

inputSystem.on("hoverStart", ({ mesh }) => applyHoverScale(mesh, true));
inputSystem.on("hoverEnd", ({ mesh }) => applyHoverScale(mesh, false));

inputSystem.on("select", ({ mesh, action, data }) => {
  flashPress(mesh);

  if (action === "selectChip") {
    engineState.chip = data.value;
    ui.setSelectedChip(data.value);
  } else if (action === "placeBet") {
    placeBet(engineState, data.side);
    refreshUI();
  } else if (action === "clearBets") {
    clearBets(engineState);
    refreshUI();
  } else if (action === "deal") {
    if (!engineState.inRound && totalStake(engineState) > 0) {
      // Full round animation arrives in Phase 8 -- for now this just proves
      // the betting flow end-to-end without playing/settling a round.
      console.log("[baccarat-vr] Deal pressed (round animation arrives in Phase 8)", {
        bets: { ...engineState.bets },
      });
    }
  } else if (action === "toggleRules") {
    ui.toggleRules();
  }
});

refreshUI();

function addDebugCardAndChipLayout(targetScene, tableParts) {
  const originX = tableParts.group.position.x;
  const originZ = tableParts.group.position.z;
  const baseY = table.group.position.y + 0.9;
  const cols = RANKS.length;
  const colSpacing = 0.075;
  const rowSpacing = 0.11;
  const startX = originX - ((cols - 1) * colSpacing) / 2;

  SUITS.forEach((suit, suitIndex) => {
    RANKS.forEach((rank, rankIndex) => {
      const card = createCardMesh(rank, suit);
      card.rotation.x = 0; // face up, for legibility review only
      card.position.set(
        startX + rankIndex * colSpacing,
        baseY,
        originZ - 0.6 - suitIndex * rowSpacing
      );
      targetScene.add(card);
    });
  });

  const backCard = createCardMesh("A", SUITS[0]);
  backCard.position.set(startX, baseY, originZ - 0.6 - SUITS.length * rowSpacing);
  targetScene.add(backCard);

  const chipStartX = originX - ((CHIP_VALUES.length - 1) * 0.09) / 2;
  CHIP_VALUES.forEach((value, i) => {
    const chip = createChip(value);
    chip.position.set(chipStartX + i * 0.09, baseY + 0.05, originZ - 0.6 - (SUITS.length + 1) * rowSpacing);
    targetScene.add(chip);
  });
}

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(TABLE_CENTER);
controls.enableDamping = true;
controls.update();

// Phase 5 debug layout: lays out all 52 faces + the back + one of each chip
// denomination for legibility verification. Gated behind ?debugCards=1 so it
// never renders on the shipped page.
if (new URLSearchParams(window.location.search).has("debugCards")) {
  addDebugCardAndChipLayout(scene, table);
  window.__debug = { camera, controls, scene, THREE, engineState, ui, inputSystem };
}

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

inputSystem.attachMouse(camera, renderer.domElement);

function render() {
  if (controls.enabled) controls.update();
  const now = performance.now();
  pressableMeshes.forEach((mesh) => tickPressFlash(mesh, now));
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(render);
