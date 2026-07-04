import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// Full Dragon's Lair room build-out (Phase 13 polish), upgrading Phase 6's
// lightweight atmosphere now that the game loop is proven. All procedural
// primitives + canvas textures, no downloaded models (Out of Scope). Static
// geometry (floor/walls/ceiling/chandeliers/background tables/bar/
// stanchions) is merged into a single draw call via mergeGeometries;
// only the handful of pieces that actually change per frame (slot
// screens) stay as separate small meshes.

const ROOM_RADIUS = 6;
const ROOM_HEIGHT = 4;
const COLOR_YELLOW = "#ffe600";
const COLOR_RED = "#e51e47";

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function makeTexture(size, draw, repeat) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  draw(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat, repeat);
  }
  return texture;
}

function createCarpetTexture() {
  return makeTexture(256, (ctx, s) => {
    ctx.fillStyle = "#0a0006";
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = "rgba(229, 30, 71, 0.35)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(s / 2, 0);
    ctx.lineTo(s, s / 2);
    ctx.lineTo(s / 2, s);
    ctx.lineTo(0, s / 2);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 230, 0, 0.18)";
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, 6, 0, Math.PI * 2);
    ctx.fill();
  }, ROOM_RADIUS * 2);
}

function createWainscotTexture() {
  return makeTexture(512, (ctx, s) => {
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, s, s);
    const panelBandTop = s * 0.55;
    ctx.fillStyle = "#141414";
    ctx.fillRect(0, panelBandTop, s, s - panelBandTop);
    ctx.strokeStyle = "rgba(255, 230, 0, 0.15)";
    ctx.lineWidth = 3;
    for (let x = 0; x < s; x += s / 4) {
      ctx.strokeRect(x + 8, panelBandTop + 10, s / 4 - 16, s - panelBandTop - 20);
    }
    ctx.strokeStyle = "rgba(229, 30, 71, 0.4)";
    ctx.beginPath();
    ctx.moveTo(0, panelBandTop);
    ctx.lineTo(s, panelBandTop);
    ctx.stroke();
  }, 12);
}

function createCofferedCeilingTexture() {
  return makeTexture(256, (ctx, s) => {
    ctx.fillStyle = "#030303";
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = "rgba(255, 230, 0, 0.12)";
    ctx.lineWidth = 4;
    ctx.strokeRect(6, 6, s - 12, s - 12);
    ctx.strokeStyle = "rgba(255, 230, 0, 0.06)";
    ctx.lineWidth = 2;
    ctx.strokeRect(24, 24, s - 48, s - 48);
  }, 8);
}

function createSignTexture() {
  return makeTexture(1024, (ctx, s) => {
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, s, s * 0.4);
    ctx.strokeStyle = COLOR_YELLOW;
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, s - 20, s * 0.4 - 20);
    ctx.fillStyle = COLOR_YELLOW;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "900 140px Poppins, sans-serif";
    ctx.fillText("SINOBROS", s / 2, s * 0.2);
  });
}

function createDealerSilhouette() {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: 0x050505,
    roughness: 0.85,
    emissive: 0x1a0007,
    emissiveIntensity: 0.25,
  });

  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.9, 12), material);
  legs.position.y = 0.45;

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.16, 0.6, 12), material);
  torso.position.y = 0.9 + 0.3;

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 16), material);
  head.position.y = 0.9 + 0.6 + 0.11;

  group.add(legs, torso, head);
  return group;
}

// One small background table (simplified version of table.js's real one) --
// just enough geometry to read as "another table" from a distance.
function addBackgroundTable(geometries, materials, x, z) {
  const feltGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.06, 24);
  feltGeo.translate(x, 0.78, z);
  geometries.push(feltGeo);
  materials.push(new THREE.MeshStandardMaterial({ color: 0x0a1f14, roughness: 0.9 }));

  const railGeo = new THREE.TorusGeometry(0.83, 0.03, 8, 24);
  railGeo.rotateX(Math.PI / 2);
  railGeo.translate(x, 0.78, z);
  geometries.push(railGeo);
  materials.push(new THREE.MeshStandardMaterial({ color: 0xe51e47, roughness: 0.6 }));

  const legGeo = new THREE.CylinderGeometry(0.12, 0.16, 0.75, 16);
  legGeo.translate(x, 0.375, z);
  geometries.push(legGeo);
  materials.push(new THREE.MeshStandardMaterial({ color: 0x0a0a0a }));
}

function addChandelier(geometries, materials, x, z) {
  const ringGeo = new THREE.TorusGeometry(0.35, 0.03, 8, 24);
  ringGeo.translate(x, ROOM_HEIGHT - 0.6, z);
  geometries.push(ringGeo);
  materials.push(new THREE.MeshStandardMaterial({
    color: 0x1a0007,
    emissive: 0xffe600,
    emissiveIntensity: 0.6,
  }));

  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const bulbGeo = new THREE.SphereGeometry(0.045, 8, 8);
    bulbGeo.translate(x + Math.cos(angle) * 0.35, ROOM_HEIGHT - 0.6, z + Math.sin(angle) * 0.35);
    geometries.push(bulbGeo);
    materials.push(new THREE.MeshStandardMaterial({
      color: 0xffe600,
      emissive: 0xffe600,
      emissiveIntensity: 1.2,
    }));
  }
}

function addStanchion(geometries, materials, x, z) {
  const postGeo = new THREE.CylinderGeometry(0.025, 0.03, 0.9, 8);
  postGeo.translate(x, 0.45, z);
  geometries.push(postGeo);
  materials.push(new THREE.MeshStandardMaterial({ color: 0x2a1a00, metalness: 0.6, roughness: 0.3 }));

  const capGeo = new THREE.SphereGeometry(0.045, 8, 8);
  capGeo.translate(x, 0.9, z);
  geometries.push(capGeo);
  materials.push(new THREE.MeshStandardMaterial({ color: 0xffe600, metalness: 0.7, roughness: 0.2 }));
}

function createSlotMachine(x, z, rotationY) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotationY;

  const cabinet = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 1.3, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x1a0007, roughness: 0.7 })
  );
  cabinet.position.y = 0.65;
  group.add(cabinet);

  const screenEntry = makeTexture(128, (ctx, s) => {
    ctx.fillStyle = "#ff4500";
    ctx.fillRect(0, 0, s, s);
  });
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.36, 0.5),
    new THREE.MeshBasicMaterial({ map: screenEntry })
  );
  screen.position.set(0, 0.95, 0.26);
  group.add(screen);
  group.userData.screenTexture = screenEntry;
  group.userData.screenMaterial = screen.material;

  return group;
}

export function createRoom() {
  const group = new THREE.Group();

  const staticGeometries = [];
  const staticMaterials = [];

  const floorGeo = new THREE.CircleGeometry(ROOM_RADIUS, 48);
  floorGeo.rotateX(-Math.PI / 2);
  staticGeometries.push(floorGeo);
  staticMaterials.push(new THREE.MeshStandardMaterial({ map: createCarpetTexture(), roughness: 0.95 }));

  const wallsGeo = new THREE.CylinderGeometry(ROOM_RADIUS, ROOM_RADIUS, ROOM_HEIGHT, 32, 1, true);
  wallsGeo.translate(0, ROOM_HEIGHT / 2, 0);
  staticGeometries.push(wallsGeo);
  staticMaterials.push(
    new THREE.MeshStandardMaterial({ map: createWainscotTexture(), roughness: 1, side: THREE.BackSide })
  );

  const ceilingGeo = new THREE.CircleGeometry(ROOM_RADIUS, 32);
  ceilingGeo.rotateX(Math.PI / 2);
  ceilingGeo.translate(0, ROOM_HEIGHT, 0);
  staticGeometries.push(ceilingGeo);
  staticMaterials.push(
    new THREE.MeshStandardMaterial({ map: createCofferedCeilingTexture(), side: THREE.BackSide })
  );

  // Background dressing at distance.
  addBackgroundTable(staticGeometries, staticMaterials, 3.2, -2.5);
  addBackgroundTable(staticGeometries, staticMaterials, -3.4, -1.8);

  const barGeo = new THREE.BoxGeometry(2.4, 0.95, 0.6);
  barGeo.translate(-4.2, 0.475, 1.5);
  staticGeometries.push(barGeo);
  staticMaterials.push(new THREE.MeshStandardMaterial({ color: 0x1a0007, roughness: 0.5 }));

  const backBarGeo = new THREE.BoxGeometry(2.4, 1.6, 0.25);
  backBarGeo.translate(-4.2, 0.8, 1.9);
  staticGeometries.push(backBarGeo);
  staticMaterials.push(new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.6 }));

  addChandelier(staticGeometries, staticMaterials, -1.2, -2.2);
  addChandelier(staticGeometries, staticMaterials, 1.2, -2.2);

  // Rope stanchions near the player, marking the play area.
  const stanchionPositions = [
    [-0.9, 0.9],
    [0.9, 0.9],
    [-1.0, -0.2],
    [1.0, -0.2],
  ];
  stanchionPositions.forEach(([x, z]) => addStanchion(staticGeometries, staticMaterials, x, z));

  const mergedGeometry = mergeGeometries(staticGeometries, true);
  const staticMesh = new THREE.Mesh(mergedGeometry, staticMaterials);
  group.add(staticMesh);

  // "SINOBROS" sign -- a single static plane, kept separate from the merge
  // only because it needs its own simple material (no other reason).
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 1.05),
    new THREE.MeshBasicMaterial({ map: createSignTexture() })
  );
  sign.position.set(0, 3.1, -ROOM_RADIUS + 0.05);
  group.add(sign);

  // Slot-machine silhouettes with slowly-cycling emissive screens -- these
  // are the only props that change per frame, so they stay unmerged.
  const slotMachines = [
    createSlotMachine(4.0, 0.5, -Math.PI / 2),
    createSlotMachine(4.0, -0.5, -Math.PI / 2),
    createSlotMachine(4.0, -1.5, -Math.PI / 2),
  ];
  slotMachines.forEach((m) => group.add(m));

  // Cheap lava-glow accent under the table -- unmerged since Phase 6 already
  // exposes it as a distinct ref for main.js.
  const lava = new THREE.Mesh(
    new THREE.RingGeometry(1.5, 2.8, 48),
    new THREE.MeshBasicMaterial({ color: 0xff4500, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
  );
  lava.rotation.x = -Math.PI / 2;
  lava.position.set(0, 0.01, -1.0);
  group.add(lava);

  const ambient = new THREE.AmbientLight(0xffddaa, 0.4);
  const emberLight = new THREE.PointLight(0xff5522, 1.4, 7, 2);
  emberLight.position.set(0, 0.6, -1.0);
  const goldDirectional = new THREE.DirectionalLight(0xffe600, 0.55);
  goldDirectional.position.set(1, 3, 1.5);
  group.add(ambient, emberLight, goldDirectional);

  const dealer = createDealerSilhouette();
  dealer.position.set(0, 0, -1.95);
  group.add(dealer);

  let slotCycleElapsed = 0;
  let slotHue = 0;
  function tick(deltaMs) {
    slotCycleElapsed += deltaMs;
    if (slotCycleElapsed < 250) return; // throttle -- this is ambience, not a real display
    slotCycleElapsed = 0;
    slotHue = (slotHue + 25) % 360;
    slotMachines.forEach((machine, i) => {
      const { screenTexture, screenMaterial } = machine.userData;
      const ctx = screenTexture.image.getContext("2d");
      ctx.fillStyle = `hsl(${(slotHue + i * 60) % 360}, 90%, 45%)`;
      ctx.fillRect(0, 0, screenTexture.image.width, screenTexture.image.height);
      screenTexture.needsUpdate = true;
      screenMaterial.needsUpdate = true;
    });
  }

  return { group, lava, emberLight, tick, drawCallCount: 3 + slotMachines.length };
}
