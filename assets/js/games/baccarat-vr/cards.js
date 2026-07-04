import * as THREE from "three";
import { SUITS, RANKS } from "./engine.js";

// One shared texture atlas for all 52 faces + a themed back, built once at
// module load. Individual card meshes get a cloned texture with repeat/
// offset pointing at their cell, instead of a unique canvas per card.
const CELL_W = 150;
const CELL_H = 210;
const COLS = RANKS.length; // 13
const BACK_ROW = SUITS.length; // spare row after the 4 suit rows
const ROWS = SUITS.length + 1; // 5

export const CARD_WIDTH = 0.063;
export const CARD_HEIGHT = 0.088;
export const CARD_THICKNESS = 0.0006;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCardFace(ctx, x, y, rank, suit) {
  ctx.save();
  ctx.translate(x, y);

  const pad = 4;
  roundRect(ctx, pad, pad, CELL_W - pad * 2, CELL_H - pad * 2, 10);
  ctx.fillStyle = "#f8f4e6";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#2a2a2a";
  ctx.stroke();

  const color = suit.color === "red" ? "#c8102e" : "#111111";
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  ctx.font = "bold 26px Poppins, sans-serif";
  ctx.fillText(rank, 14, 12);
  ctx.font = "20px Poppins, sans-serif";
  ctx.fillText(suit.glyph, 14, 40);

  ctx.save();
  ctx.translate(CELL_W - 14, CELL_H - 14);
  ctx.rotate(Math.PI);
  ctx.font = "bold 26px Poppins, sans-serif";
  ctx.fillText(rank, 0, 0);
  ctx.font = "20px Poppins, sans-serif";
  ctx.fillText(suit.glyph, 0, 28);
  ctx.restore();

  ctx.font = "bold 90px Poppins, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(suit.glyph, CELL_W / 2, CELL_H / 2 + 6);

  ctx.restore();
}

function drawCardBack(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);

  const pad = 4;
  roundRect(ctx, pad, pad, CELL_W - pad * 2, CELL_H - pad * 2, 10);
  ctx.fillStyle = "#1a0007";
  ctx.fill();

  ctx.save();
  roundRect(ctx, pad, pad, CELL_W - pad * 2, CELL_H - pad * 2, 10);
  ctx.clip();
  ctx.strokeStyle = "#2a0008";
  ctx.lineWidth = 6;
  for (let i = -CELL_H; i < CELL_W + CELL_H; i += 12) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i - CELL_H, CELL_H);
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = "rgba(255, 230, 0, 0.4)";
  ctx.lineWidth = 2;
  roundRect(ctx, pad + 10, pad + 10, CELL_W - pad * 2 - 20, CELL_H - pad * 2 - 20, 8);
  ctx.stroke();

  ctx.restore();
}

function buildAtlasTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = COLS * CELL_W;
  canvas.height = ROWS * CELL_H;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  SUITS.forEach((suit, suitIndex) => {
    RANKS.forEach((rank, rankIndex) => {
      drawCardFace(ctx, rankIndex * CELL_W, suitIndex * CELL_H, rank, suit);
    });
  });
  drawCardBack(ctx, 0, BACK_ROW * CELL_H);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function cellTexture(baseTexture, col, row) {
  const texture = baseTexture.clone();
  texture.repeat.set(1 / COLS, 1 / ROWS);
  texture.offset.set(col / COLS, 1 - (row + 1) / ROWS);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

let baseAtlasTexture = null;
let sharedGeometry = null;
let sharedEdgeMaterial = null;
let sharedBackMaterial = null;
const faceMaterialCache = new Map();

function getAtlas() {
  if (!baseAtlasTexture) baseAtlasTexture = buildAtlasTexture();
  return baseAtlasTexture;
}

function getSharedGeometry() {
  if (!sharedGeometry) {
    sharedGeometry = new THREE.BoxGeometry(CARD_WIDTH, CARD_THICKNESS, CARD_HEIGHT);
  }
  return sharedGeometry;
}

function getEdgeMaterial() {
  if (!sharedEdgeMaterial) {
    sharedEdgeMaterial = new THREE.MeshStandardMaterial({ color: 0xf0ece0 });
  }
  return sharedEdgeMaterial;
}

function getBackMaterial() {
  if (!sharedBackMaterial) {
    const backTexture = cellTexture(getAtlas(), 0, BACK_ROW);
    sharedBackMaterial = new THREE.MeshStandardMaterial({ map: backTexture });
  }
  return sharedBackMaterial;
}

function getFaceMaterial(rank, suit) {
  const suitIndex = SUITS.indexOf(suit);
  const rankIndex = RANKS.indexOf(rank);
  const key = `${rankIndex}-${suitIndex}`;
  if (!faceMaterialCache.has(key)) {
    const faceTexture = cellTexture(getAtlas(), rankIndex, suitIndex);
    faceMaterialCache.set(key, new THREE.MeshStandardMaterial({ map: faceTexture }));
  }
  return faceMaterialCache.get(key);
}

export function getCardAtlasTexture() {
  return getAtlas();
}

// Box faces in Three.js order: +x, -x, +y, -y, +z, -z. The card's printed
// face is mapped onto +y (top when lying flat) and the back onto -y
// (bottom); the four thin edges share one plain material. Spawns with
// rotation.x = Math.PI so the BACK faces up (a freshly dealt, face-down
// card) — flip animation is Phase 8's job, not this factory's.
export function createCardMesh(rank, suit) {
  const geometry = getSharedGeometry();
  const materials = [
    getEdgeMaterial(),
    getEdgeMaterial(),
    getFaceMaterial(rank, suit),
    getBackMaterial(),
    getEdgeMaterial(),
    getEdgeMaterial(),
  ];
  const mesh = new THREE.Mesh(geometry, materials);
  mesh.rotation.x = Math.PI;
  mesh.userData.rank = rank;
  mesh.userData.suit = suit;
  return mesh;
}
