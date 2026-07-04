import * as THREE from "three";

// Theme colors mirrored from style.css / assets/css/pages/baccarat.css so the
// VR table reads as the same site (see MASTER-PLAN-baccarat-webxr.md,
// "Confirmed Ground Truth").
const COLOR_FELT = "#0a0a0a";
const COLOR_FELT_LIGHT = "#141414";
const COLOR_YELLOW = "#ffe600";
const COLOR_RED = "#e51e47";

export const TABLE_FELT_HEIGHT = 0.82;
export const TABLE_RADIUS = 1.2;

// The felt is a cylinder of this thickness centered on TABLE_FELT_HEIGHT, so
// its actual top surface sits half a thickness above that value. Anything
// meant to sit visibly on the table (bet zone overlays, shoe/discard
// markers) must use FELT_TOP_Y, not TABLE_FELT_HEIGHT directly, or it ends
// up embedded in/under the felt mesh and invisible from above.
const FELT_THICKNESS = 0.06;
const FELT_TOP_Y = TABLE_FELT_HEIGHT + FELT_THICKNESS / 2;

// World-space anchor points used by main.js (camera/reference-space setup),
// input.js (raycast origin), and animate.js (card/chip flight targets).
export const TABLE_CENTER = new THREE.Vector3(0, TABLE_FELT_HEIGHT, -1.0);
export const PLAYER_ANCHOR = new THREE.Vector3(0, 0, 0.35);
export const PLAYER_ANCHOR_FORWARD = new THREE.Vector3(0, 0, -1);

// x values are the world-space left/right position of each zone's clickable
// overlay mesh. They must match where that zone's label actually lands on
// the felt texture — since the felt canvas is drawn in array order (index 0
// first) and CylinderGeometry's cap UVs plus the 90-degree draw-space
// rotation above end up mirroring left/right, index 0 (player) renders on
// the world +x side and index 2 (banker) on the world -x side. Confirmed
// visually via preview_screenshot; don't "correct" this to (-0.55, 0, 0.55)
// without re-checking the render, or the label and hit target will split.
const ZONE_DEFS = [
  { side: "player", label: "PLAYER", payout: "1 : 1", x: 0.55 },
  { side: "tie", label: "TIE", payout: "8 : 1", x: 0 },
  { side: "banker", label: "BANKER", payout: "0.95 : 1", x: -0.55 },
];

function createFeltTexture() {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  // CylinderGeometry's cap UVs are (cosTheta, sinTheta)-based (see
  // three.core.js CylinderGeometry.generateCap), which swaps the canvas'
  // horizontal axis onto world Z (depth) instead of world X (left/right).
  // Rotating the whole draw space 90 degrees up front compensates, so the
  // Player/Tie/Banker bands below end up laid out left-to-right and the
  // text upright as seen from the player anchor, without having to hand-fix
  // every coordinate below.
  ctx.translate(size / 2, size / 2);
  ctx.rotate(Math.PI / 2);
  ctx.translate(-size / 2, -size / 2);

  ctx.fillStyle = COLOR_FELT;
  ctx.fillRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;
  const radiusPx = size / 2;

  const gradient = ctx.createRadialGradient(cx, cy, radiusPx * 0.1, cx, cy, radiusPx);
  gradient.addColorStop(0, COLOR_FELT_LIGHT);
  gradient.addColorStop(1, COLOR_FELT);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, radiusPx, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 230, 0, 0.18)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy, radiusPx * 0.92, 0, Math.PI * 2);
  ctx.stroke();

  // Three zone bands (Player / Tie / Banker), matching the 2D bet-panel order.
  const bandWidth = size / 3;
  ZONE_DEFS.forEach((zone, i) => {
    const bandX = i * bandWidth;
    if (i > 0) {
      ctx.strokeStyle = "rgba(229, 30, 71, 0.35)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(bandX, size * 0.15);
      ctx.lineTo(bandX, size * 0.85);
      ctx.stroke();
    }

    const textX = bandX + bandWidth / 2;
    ctx.textAlign = "center";
    ctx.fillStyle = COLOR_YELLOW;
    ctx.font = "bold 64px Poppins, sans-serif";
    ctx.fillText(zone.label, textX, size * 0.62);
    ctx.font = "600 34px Poppins, sans-serif";
    ctx.fillStyle = "rgba(255, 230, 0, 0.75)";
    ctx.fillText(`Pays ${zone.payout}`, textX, size * 0.7);
  });

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255, 230, 0, 0.4)";
  ctx.font = "600 28px Poppins, sans-serif";
  ctx.fillText("DRAGON'S LAIR BACCARAT", cx, size * 0.28);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createBetZoneMeshes() {
  const zones = {};
  const zoneWidth = (TABLE_RADIUS * 2 * 0.85) / 3;
  const zoneDepth = TABLE_RADIUS * 1.1;

  ZONE_DEFS.forEach((zone) => {
    const geometry = new THREE.PlaneGeometry(zoneWidth * 0.92, zoneDepth * 0.6);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffe600,
      emissive: 0xffe600,
      emissiveIntensity: 0.08,
      transparent: true,
      opacity: 0.06,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(zone.x, FELT_TOP_Y + 0.002, 0.05);
    mesh.userData.betSide = zone.side;
    zones[zone.side] = mesh;
  });

  return zones;
}

export function createTable() {
  const group = new THREE.Group();
  group.position.copy(TABLE_CENTER).setY(0);

  const feltTexture = createFeltTexture();
  const feltGeometry = new THREE.CylinderGeometry(TABLE_RADIUS, TABLE_RADIUS, 0.06, 64);
  const feltMaterial = [
    new THREE.MeshStandardMaterial({ color: 0x1a0007 }), // side
    new THREE.MeshStandardMaterial({ map: feltTexture }), // top
    new THREE.MeshStandardMaterial({ color: 0x050505 }), // bottom
  ];
  const felt = new THREE.Mesh(feltGeometry, feltMaterial);
  felt.position.y = TABLE_FELT_HEIGHT;
  group.add(felt);

  const railGeometry = new THREE.TorusGeometry(TABLE_RADIUS + 0.03, 0.05, 16, 64);
  const railMaterial = new THREE.MeshStandardMaterial({ color: 0xe51e47, roughness: 0.5 });
  const rail = new THREE.Mesh(railGeometry, railMaterial);
  rail.rotation.x = Math.PI / 2;
  rail.position.y = TABLE_FELT_HEIGHT;
  group.add(rail);

  const legGeometry = new THREE.CylinderGeometry(0.18, 0.24, TABLE_FELT_HEIGHT - 0.03, 24);
  const legMaterial = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.6 });
  const leg = new THREE.Mesh(legGeometry, legMaterial);
  leg.position.y = (TABLE_FELT_HEIGHT - 0.03) / 2;
  group.add(leg);

  const betZones = createBetZoneMeshes();
  Object.values(betZones).forEach((mesh) => group.add(mesh));

  const shoeMarker = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.1, 0.18),
    new THREE.MeshStandardMaterial({ color: 0x2a0008, emissive: 0xe51e47, emissiveIntensity: 0.15 })
  );
  shoeMarker.position.set(0.75, FELT_TOP_Y + 0.05, -0.65);
  group.add(shoeMarker);

  const discardMarker = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.02, 0.22),
    new THREE.MeshStandardMaterial({ color: 0x141414 })
  );
  discardMarker.position.set(-0.75, FELT_TOP_Y + 0.01, -0.65);
  group.add(discardMarker);

  // Temporary lighting ends here -- room.js (Phase 6) supplies the real
  // themed lighting for the scene; this file no longer adds its own.

  return {
    group,
    betZones,
    shoeMarker,
    discardMarker,
    shoeWorldPosition: shoeMarker.position.clone().add(group.position),
    discardWorldPosition: discardMarker.position.clone().add(group.position),
  };
}
