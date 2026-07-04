import * as THREE from "three";
import { VRButton } from "three/addons/webxr/VRButton.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createTable, TABLE_CENTER, PLAYER_ANCHOR } from "./table.js";
import { createRoom } from "./room.js";
import { SUITS, RANKS, CHIP_VALUES, createInitialState, placeBet, clearBets, dealRound, handTotal } from "./engine.js";
import { createCardMesh } from "./cards.js";
import { createChip, createChipStack } from "./chips.js";
import { createInputSystem } from "./input.js";
import { createUI, applyHoverScale, flashPress, tickPressFlash, createHandTotalLabel } from "./ui.js";
import { tween, wait, tick, easeInOutQuad, easeOutQuad } from "./animate.js";

const DEAL_GAP_MS = 700;
const DEAL_ANIM_MS = 900;
const FLIP_ANIM_MS = 700;
const PAUSE_BEFORE_THIRD_MS = 900;
const PAUSE_BEFORE_RESULT_MS = 700;

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

const controllers = [inputSystem.attachController(renderer, 0), inputSystem.attachController(renderer, 1)];
controllers.forEach(({ controller }) => scene.add(controller));

function totalStake(state) {
  return state.bets.player + state.bets.tie + state.bets.banker;
}

let animating = false;
const betZoneChipStacks = { player: null, tie: null, banker: null };
const handMeshes = [];
const totalLabels = {
  player: createHandTotalLabel(),
  banker: createHandTotalLabel(),
};
totalLabels.player.mesh.position.copy(table.playerSeatWorldPosition).add(new THREE.Vector3(0, 0.12, -0.12));
totalLabels.banker.mesh.position.copy(table.bankerSeatWorldPosition).add(new THREE.Vector3(0, 0.12, -0.12));
scene.add(totalLabels.player.mesh, totalLabels.banker.mesh);

function refreshUI() {
  const wager = totalStake(engineState);
  ui.setStatus({
    balance: engineState.balance,
    wager,
    status: engineState.inRound ? "Dealing" : "Place your bet",
  });
  ui.setDealEnabled(!animating && !engineState.inRound && wager > 0);
}

function updateBetZoneChipStacks() {
  ["player", "tie", "banker"].forEach((side) => {
    const existing = betZoneChipStacks[side];
    if (existing) {
      scene.remove(existing);
      betZoneChipStacks[side] = null;
    }
    const amount = engineState.bets[side];
    if (amount > 0) {
      const worldPos = table.betZones[side].getWorldPosition(new THREE.Vector3());
      worldPos.y += 0.01;
      const stack = createChipStack(amount, worldPos);
      scene.add(stack);
      betZoneChipStacks[side] = stack;
    }
  });
}

function clearHandVisuals() {
  handMeshes.forEach((mesh) => scene.remove(mesh));
  handMeshes.length = 0;
  totalLabels.player.hide();
  totalLabels.banker.hide();
}

async function flyCardToSeat(mesh, fromPos, toPos, durationMs) {
  mesh.position.copy(fromPos);
  const midPoint = fromPos.clone().lerp(toPos, 0.5);
  midPoint.y += 0.12;
  await tween(mesh, { position: midPoint }, durationMs * 0.5, easeOutQuad);
  await tween(mesh, { position: toPos }, durationMs * 0.5, easeInOutQuad);
}

async function flashZoneHighlight(zoneMesh) {
  await tween(zoneMesh.material, { opacity: 0.5 }, 200, easeOutQuad);
  await wait(500);
  await tween(zoneMesh.material, { opacity: 0.06 }, 400, easeInOutQuad);
}

function formatOutcomeText(result) {
  const labelMap = { player: "Player wins", tie: "Tie", banker: "Banker wins" };
  const header = `${labelMap[result.outcome]} - ${result.playerTotal} vs ${result.bankerTotal}`;
  if (result.payoutLines.length === 0) return `${header} (no active bets)`;
  const sign = result.net >= 0 ? "+" : "";
  return `${header} - ${result.payoutLines.join(", ")} (net ${sign}${result.net})`;
}

async function settleChipStacks(outcome, originalBets) {
  const flights = ["player", "tie", "banker"].map(async (side) => {
    const amount = originalBets[side];
    const stack = betZoneChipStacks[side];
    if (amount <= 0 || !stack) return;

    const isWinner = side === outcome;
    // VR-only divergence from the 2D game (Decision #5): a Tie refunds the
    // Player/Banker stakes instead of sweeping them to the discard tray.
    const isRefunded = outcome === "tie" && side !== "tie";
    const destination = isWinner || isRefunded
      ? new THREE.Vector3(PLAYER_ANCHOR.x, 1.0, PLAYER_ANCHOR.z)
      : table.discardWorldPosition.clone();

    await tween(stack, { position: destination }, 600, easeInOutQuad);
    scene.remove(stack);
    betZoneChipStacks[side] = null;
  });
  await Promise.all(flights);
}

async function startRound() {
  if (animating || engineState.inRound) return;
  const stake = totalStake(engineState);
  if (stake <= 0) return;
  if (stake > engineState.balance) {
    ui.setStatus({ balance: engineState.balance, wager: stake, status: "Not enough Dragon Gold" });
    return;
  }

  animating = true;
  ui.setDealEnabled(false);

  const originalBets = { ...engineState.bets };
  const originalBalance = engineState.balance;
  const result = dealRound(engineState); // synchronous -- fully resolves the round now; this loop only replays it visually
  const midRoundBalance = originalBalance - stake;

  ui.setStatus({ balance: midRoundBalance, wager: stake, status: "Dealing" });
  clearHandVisuals();

  const seatMeshesByIndex = { player: [], banker: [] };
  const seatCardsSoFar = { player: [], banker: [] };
  const seatCounts = { player: 0, banker: 0 };

  for (const event of result.events) {
    if (event.type === "deal") {
      const index = seatCounts[event.seat]++;
      const mesh = createCardMesh(event.card.rank, event.card.suit);
      const seatPos = event.seat === "player" ? table.playerSeatWorldPosition : table.bankerSeatWorldPosition;
      const fanOffset = (index - 0.5) * 0.095;
      const targetPos = seatPos.clone().add(new THREE.Vector3(fanOffset, index * 0.0015, 0));
      scene.add(mesh);
      handMeshes.push(mesh);
      seatMeshesByIndex[event.seat][index] = mesh;
      seatCardsSoFar[event.seat].push(event.card);
      await flyCardToSeat(mesh, table.shoeWorldPosition, targetPos, DEAL_ANIM_MS);
      await wait(DEAL_GAP_MS);
    } else if (event.type === "reveal") {
      const mesh = seatMeshesByIndex[event.seat][event.cardIndex];
      await tween(mesh, { rotation: { x: 0 } }, FLIP_ANIM_MS, easeInOutQuad);
      totalLabels[event.seat].setTotal(handTotal(seatCardsSoFar[event.seat]));
      await wait(event.cardIndex === 0 ? 180 : 400);
    } else if (event.type === "thirdCard") {
      await wait(PAUSE_BEFORE_THIRD_MS);
      const index = seatCounts[event.seat]++;
      const mesh = createCardMesh(event.card.rank, event.card.suit);
      mesh.rotation.y = Math.PI / 2; // dealt sideways, per convention
      const seatPos = event.seat === "player" ? table.playerSeatWorldPosition : table.bankerSeatWorldPosition;
      const fanOffset = (index - 0.5) * 0.095;
      const targetPos = seatPos.clone().add(new THREE.Vector3(fanOffset, index * 0.0015, 0));
      scene.add(mesh);
      handMeshes.push(mesh);
      seatMeshesByIndex[event.seat][index] = mesh;
      seatCardsSoFar[event.seat].push(event.card);
      await flyCardToSeat(mesh, table.shoeWorldPosition, targetPos, DEAL_ANIM_MS);
    } else if (event.type === "settle") {
      await wait(PAUSE_BEFORE_RESULT_MS);
      ui.setStatus({ balance: engineState.balance, wager: 0, status: formatOutcomeText(result) });
      await Promise.all([
        flashZoneHighlight(table.betZones[result.outcome]),
        settleChipStacks(result.outcome, originalBets),
      ]);
    }
  }

  animating = false;
  ui.setDealEnabled(false); // wager is back to 0 after a round
}

inputSystem.on("hoverStart", ({ mesh }) => applyHoverScale(mesh, true));
inputSystem.on("hoverEnd", ({ mesh }) => applyHoverScale(mesh, false));

inputSystem.on("select", ({ mesh, action, data }) => {
  if (animating) return;
  flashPress(mesh);

  if (action === "selectChip") {
    engineState.chip = data.value;
    ui.setSelectedChip(data.value);
  } else if (action === "placeBet") {
    placeBet(engineState, data.side);
    updateBetZoneChipStacks();
    refreshUI();
  } else if (action === "clearBets") {
    clearBets(engineState);
    updateBetZoneChipStacks();
    refreshUI();
  } else if (action === "deal") {
    startRound();
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
  window.__debug = { camera, controls, scene, THREE, engineState, ui, inputSystem, table, startRound, SUITS };
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
  // Clear any hover left over from a controller so its highlighted mesh
  // doesn't stay stuck scaled-up after the session ends.
  controllers.forEach(({ sourceId }) => inputSystem.clearHover(sourceId));
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

let lastFrameTime = performance.now();

function render() {
  if (controls.enabled) controls.update();
  if (renderer.xr.isPresenting) {
    controllers.forEach(({ update }) => update());
  }
  const now = performance.now();
  const deltaMs = now - lastFrameTime;
  lastFrameTime = now;
  tick(deltaMs);
  pressableMeshes.forEach((mesh) => tickPressFlash(mesh, now));
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(render);
