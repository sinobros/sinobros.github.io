import * as THREE from "three";
import { CHIP_VALUES } from "./engine.js";

export const CHIP_RADIUS = 0.02;
export const CHIP_HEIGHT = 0.004;

// One theme color per denomination, reusing the site's gold/red/black
// palette (style.css --yellow/--red) so higher-value chips read as more
// "premium" the same way a real casino's rail does.
const CHIP_THEME = {
  10: { base: "#2a2a2a", text: "#ffffff", ring: "#555555" },
  25: { base: "#e51e47", text: "#ffe600", ring: "#ffe600" },
  50: { base: "#ffe600", text: "#1a0007", ring: "#e51e47" },
  100: { base: "#0a0a0a", text: "#ffe600", ring: "#ffe600" },
  500: { base: "#1a0007", text: "#ffe600", ring: "#ffe600" },
};

function roundedTheme(value) {
  return CHIP_THEME[value] ?? { base: "#333333", text: "#ffffff", ring: "#999999" };
}

function drawChipTopTexture(value) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const theme = roundedTheme(value);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2;

  ctx.fillStyle = theme.base;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Dashed ring, echoing the 2D chip rail's `border: 3px dashed var(--yellow)`.
  ctx.strokeStyle = theme.ring;
  ctx.lineWidth = size * 0.045;
  ctx.setLineDash([size * 0.06, size * 0.05]);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = theme.text;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${size * 0.28}px Poppins, sans-serif`;
  ctx.fillText(String(value), cx, cy + size * 0.02);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const topMaterialCache = new Map();
let sharedGeometryCache = null;
let sharedRimMaterial = null;

function getGeometry() {
  if (!sharedGeometryCache) {
    sharedGeometryCache = new THREE.CylinderGeometry(CHIP_RADIUS, CHIP_RADIUS, CHIP_HEIGHT, 32);
  }
  return sharedGeometryCache;
}

function getRimMaterial() {
  if (!sharedRimMaterial) {
    sharedRimMaterial = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });
  }
  return sharedRimMaterial;
}

function getTopMaterial(value) {
  if (!topMaterialCache.has(value)) {
    const texture = drawChipTopTexture(value);
    topMaterialCache.set(
      value,
      new THREE.MeshStandardMaterial({ map: texture, roughness: 0.4 })
    );
  }
  return topMaterialCache.get(value);
}

// Cylinder faces in Three.js order: [side, top, bottom]. Both flat faces get
// the same denomination texture so the chip reads correctly from any angle.
export function createChip(value) {
  const geometry = getGeometry();
  const topMaterial = getTopMaterial(value);
  const materials = [getRimMaterial(), topMaterial, topMaterial];
  const mesh = new THREE.Mesh(geometry, materials);
  mesh.userData.chipValue = value;
  return mesh;
}

// Greedy largest-denomination-first breakdown of `amount` into a physical
// stack, positioned at `position` (world space, base of the stack).
export function createChipStack(amount, position = new THREE.Vector3()) {
  const group = new THREE.Group();
  group.position.copy(position);

  const descending = [...CHIP_VALUES].sort((a, b) => b - a);
  let remaining = Math.round(amount);
  let stackIndex = 0;

  for (const value of descending) {
    while (remaining >= value) {
      const chip = createChip(value);
      chip.position.y = stackIndex * CHIP_HEIGHT + CHIP_HEIGHT / 2;
      group.add(chip);
      remaining -= value;
      stackIndex++;
    }
  }

  group.userData.chipCount = stackIndex;
  return group;
}
