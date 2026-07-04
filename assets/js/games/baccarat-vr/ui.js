import * as THREE from "three";
import { CHIP_VALUES } from "./engine.js";
import { createChip, CHIP_HEIGHT } from "./chips.js";

const COLOR_YELLOW = "#ffe600";
const COLOR_RED = "#e51e47";
const COLOR_DARK = "#0a0a0a";

const RULES_TEXT = [
  "Bet on the Player, the Banker, or a Tie. Two cards are dealt to each side. Card values: A = 1, 2-9 = face value, 10/J/Q/K = 0. Only the last digit of each total counts (15 = 5, 18 = 8).",
  "If either hand totals 8 or 9 on the first two cards, that is a natural and both stand. Otherwise the Player draws a third card on totals of 0-5 and stands on 6-7. The Banker's third-card rule depends on its total and the Player's third card. Closest to 9 wins.",
  "Player and Banker bets pay 1 : 1 (Banker keeps a 5% commission). Tie pays 8 : 1. In this VR table, Tie also returns Player and Banker stakes (the 2D game does not -- see engine.js).",
];

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function makeCanvasEntry(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { canvas, ctx, texture };
}

function createButtonMesh({ width, height, depth, label, primary }) {
  const geometry = new THREE.BoxGeometry(width, depth, height);
  const entry = makeCanvasEntry(512, 256);
  drawButtonLabel(entry, label, primary, false);

  const topMaterial = new THREE.MeshStandardMaterial({ map: entry.texture });
  const sideMaterial = new THREE.MeshStandardMaterial({
    color: primary ? 0xffe600 : 0x0a0a0a,
  });
  const materials = [sideMaterial, sideMaterial, topMaterial, sideMaterial, sideMaterial, sideMaterial];
  const mesh = new THREE.Mesh(geometry, materials);
  mesh.userData.labelEntry = entry;
  mesh.userData.baseScale = new THREE.Vector3(1, 1, 1);
  mesh.userData.primary = primary;
  mesh.userData.disabled = false;
  return mesh;
}

function drawButtonLabel(entry, label, primary, disabled) {
  const { ctx, canvas, texture } = entry;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = disabled ? "#1a1a1a" : primary ? COLOR_YELLOW : COLOR_DARK;
  ctx.fillRect(0, 0, w, h);

  if (!primary) {
    ctx.strokeStyle = disabled ? "#333333" : COLOR_RED;
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, w - 16, h - 16);
  }

  ctx.fillStyle = disabled ? "#555555" : primary ? "#1a0007" : COLOR_YELLOW;
  ctx.font = "bold 64px Poppins, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, w / 2, h / 2);

  texture.needsUpdate = true;
}

function createStatusBoardMesh() {
  const width = 0.56;
  const height = 0.32;
  const geometry = new THREE.PlaneGeometry(width, height);
  const entry = makeCanvasEntry(1024, 576);
  const material = new THREE.MeshStandardMaterial({
    map: entry.texture,
    side: THREE.DoubleSide,
    emissive: 0x111111,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.entry = entry;
  return mesh;
}

function drawStatusBoard(entry, { balance, wager, status, best }) {
  const { ctx, canvas, texture } = entry;
  const w = canvas.width;
  const h = canvas.height;

  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = COLOR_RED;
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, w - 8, h - 8);

  ctx.textAlign = "left";
  ctx.fillStyle = COLOR_YELLOW;
  ctx.font = "600 38px Poppins, sans-serif";
  ctx.fillText("DRAGON GOLD", 44, 80);

  ctx.font = "bold 96px Poppins, sans-serif";
  ctx.fillText(String(balance), 44, 175);

  ctx.font = "600 34px Poppins, sans-serif";
  ctx.fillText(`WAGER  ${wager}`, 44, 260);

  if (typeof best === "number") {
    ctx.textAlign = "right";
    ctx.font = "600 28px Poppins, sans-serif";
    ctx.fillStyle = "rgba(255, 230, 0, 0.6)";
    ctx.fillText(`BEST ${best}`, w - 40, 80);
  }

  ctx.textAlign = "left";
  ctx.fillStyle = COLOR_YELLOW;
  ctx.font = "600 40px Poppins, sans-serif";
  wrapText(ctx, status, 44, 340, w - 88, 48);

  texture.needsUpdate = true;
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text).split(" ");
  let line = "";
  let cursorY = y;
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, cursorY);
      line = word;
      cursorY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, cursorY);
}

function createRulesPanelMesh() {
  const width = 0.7;
  const height = 0.5;
  const geometry = new THREE.PlaneGeometry(width, height);
  const entry = makeCanvasEntry(1024, 730);
  const { ctx, canvas, texture } = entry;
  const w = canvas.width;
  const h = canvas.height;

  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = COLOR_RED;
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, w - 8, h - 8);

  ctx.fillStyle = COLOR_YELLOW;
  ctx.font = "800 48px Poppins, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("HOW TO PLAY", 40, 70);

  ctx.font = "400 32px Poppins, sans-serif";
  ctx.globalAlpha = 0.9;
  let y = 140;
  RULES_TEXT.forEach((paragraph) => {
    y = wrapTextReturnY(ctx, paragraph, 40, y, w - 80, 42);
    y += 30;
  });
  ctx.globalAlpha = 1;

  texture.needsUpdate = true;

  const material = new THREE.MeshStandardMaterial({ map: texture, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.visible = false;
  return mesh;
}

function wrapTextReturnY(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let cursorY = y;
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, cursorY);
      line = word;
      cursorY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, cursorY);
  return cursorY + lineHeight;
}

// Builds every in-world UI mesh. Positions are relative to the world origin
// (same space as table.js's TABLE_CENTER/PLAYER_ANCHOR), chosen so
// everything sits within comfortable seated-player reach in front of the
// player anchor at (0, 0, 0.35).
export function createUI() {
  const group = new THREE.Group();

  const statusBoard = createStatusBoardMesh();
  statusBoard.position.set(0, 1.55, -1.75);
  statusBoard.rotation.x = 0.25;
  group.add(statusBoard);

  const dealButton = createButtonMesh({ width: 0.22, height: 0.12, depth: 0.05, label: "DEAL", primary: true });
  dealButton.position.set(0.35, 1.02, -0.35);
  group.add(dealButton);

  const clearButton = createButtonMesh({ width: 0.24, height: 0.12, depth: 0.05, label: "CLEAR", primary: false });
  clearButton.position.set(0, 1.02, -0.35);
  group.add(clearButton);

  const rulesButton = createButtonMesh({ width: 0.18, height: 0.1, depth: 0.05, label: "RULES", primary: false });
  rulesButton.position.set(-0.35, 1.02, -0.35);
  group.add(rulesButton);

  const muteButton = createButtonMesh({ width: 0.14, height: 0.08, depth: 0.05, label: "SOUND", primary: false });
  muteButton.position.set(-0.35, 1.02, -0.2);
  group.add(muteButton);

  const rulesPanel = createRulesPanelMesh();
  rulesPanel.position.set(0, 1.5, -0.55);
  rulesPanel.rotation.x = 0.15;
  group.add(rulesPanel);

  const chipRailGroup = new THREE.Group();
  chipRailGroup.position.set(0, 1.0, -0.12);
  group.add(chipRailGroup);

  const chipSpacing = 0.11;
  const chipStartX = -((CHIP_VALUES.length - 1) * chipSpacing) / 2;
  const chipMeshesByValue = new Map();
  CHIP_VALUES.forEach((value, i) => {
    const chip = createChip(value);
    chip.position.set(chipStartX + i * chipSpacing, CHIP_HEIGHT / 2, 0);
    chip.userData.chipValue = value;
    chip.userData.baseY = chip.position.y;
    chipRailGroup.add(chip);
    chipMeshesByValue.set(value, chip);
  });

  function setSelectedChip(value) {
    chipMeshesByValue.forEach((chip, chipValue) => {
      const selected = chipValue === value;
      chip.position.y = chip.userData.baseY + (selected ? 0.012 : 0);
      chip.material.forEach((m) => {
        m.emissive.set(selected ? 0xffe600 : 0x000000);
        m.emissiveIntensity = selected ? 0.4 : 0;
      });
    });
  }

  function setDealEnabled(enabled) {
    dealButton.userData.disabled = !enabled;
    drawButtonLabel(dealButton.userData.labelEntry, "DEAL", true, !enabled);
  }

  function setStatus(status) {
    drawStatusBoard(statusBoard.userData.entry, status);
  }

  function toggleRules(forceState) {
    rulesPanel.visible = typeof forceState === "boolean" ? forceState : !rulesPanel.visible;
    return rulesPanel.visible;
  }

  function setMuteLabel(muted) {
    drawButtonLabel(muteButton.userData.labelEntry, muted ? "MUTED" : "SOUND", false, false);
  }

  return {
    group,
    statusBoard,
    dealButton,
    muteButton,
    setMuteLabel,
    clearButton,
    rulesButton,
    rulesPanel,
    chipRailGroup,
    chipMeshesByValue,
    setSelectedChip,
    setDealEnabled,
    setStatus,
    toggleRules,
  };
}

// Shared hover/press feedback usable by any registered interactive mesh
// (buttons, chips, bet zones alike), driven by input.js's hoverStart/
// hoverEnd/select events -- see main.js for the wiring.
export function applyHoverScale(mesh, hovered) {
  const base = mesh.userData.baseScale || new THREE.Vector3(1, 1, 1);
  const factor = hovered ? 1.08 : 1;
  mesh.scale.set(base.x * factor, base.y * factor, base.z * factor);
}

export function flashPress(mesh) {
  const base = mesh.userData.baseScale || new THREE.Vector3(1, 1, 1);
  mesh.scale.set(base.x * 1.18, base.y * 1.18, base.z * 1.18);
  mesh.userData.pressFlashUntil = performance.now() + 120;
}

export function tickPressFlash(mesh, now) {
  if (mesh.userData.pressFlashUntil && now > mesh.userData.pressFlashUntil) {
    mesh.userData.pressFlashUntil = null;
    mesh.scale.copy(mesh.userData.baseScale || new THREE.Vector3(1, 1, 1));
  }
}

// Small upright plaque showing a hand's running total, hidden until the
// first reveal for that seat (mirrors the 2D game's renderTotals()).
export function createHandTotalLabel() {
  const geometry = new THREE.PlaneGeometry(0.16, 0.09);
  const entry = makeCanvasEntry(256, 144);
  const material = new THREE.MeshStandardMaterial({
    map: entry.texture,
    transparent: true,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.visible = false;
  mesh.userData.entry = entry;

  function setTotal(total) {
    const { ctx, canvas, texture } = entry;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(10, 10, 10, 0.85)";
    roundRect(ctx, 4, 4, canvas.width - 8, canvas.height - 8, 14);
    ctx.fill();
    ctx.strokeStyle = COLOR_RED;
    ctx.lineWidth = 4;
    roundRect(ctx, 4, 4, canvas.width - 8, canvas.height - 8, 14);
    ctx.stroke();
    ctx.fillStyle = COLOR_YELLOW;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 84px Poppins, sans-serif";
    ctx.fillText(String(total), canvas.width / 2, canvas.height / 2 + 4);
    texture.needsUpdate = true;
    mesh.visible = true;
  }

  function hide() {
    mesh.visible = false;
  }

  return { mesh, setTotal, hide };
}
