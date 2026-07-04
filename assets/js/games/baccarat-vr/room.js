import * as THREE from "three";

// Lightweight Dragon's Lair atmosphere (MVP-level immersion, per
// MASTER-PLAN-baccarat-webxr.md Decision #7 / Phase 6). Full set-dressing
// (chandeliers, background tables, signage) is deliberately deferred to
// Phase 13 -- this phase only needs to stop the scene reading as a gray
// test room, cheaply.

const ROOM_RADIUS = 6;
const ROOM_HEIGHT = 4;

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

export function createRoom() {
  const group = new THREE.Group();

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(ROOM_RADIUS, 48),
    new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.95 })
  );
  floor.rotation.x = -Math.PI / 2;
  group.add(floor);

  // Cheap lava-glow accent: one emissive ring under/around the table, no
  // extra dynamic light needed to sell the effect.
  const lava = new THREE.Mesh(
    new THREE.RingGeometry(1.5, 2.8, 48),
    new THREE.MeshBasicMaterial({
      color: 0xff4500,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    })
  );
  lava.rotation.x = -Math.PI / 2;
  lava.position.set(0, 0.01, -1.0);
  group.add(lava);

  const walls = new THREE.Mesh(
    new THREE.CylinderGeometry(ROOM_RADIUS, ROOM_RADIUS, ROOM_HEIGHT, 32, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 1, side: THREE.BackSide })
  );
  walls.position.y = ROOM_HEIGHT / 2;
  group.add(walls);

  const ceiling = new THREE.Mesh(
    new THREE.CircleGeometry(ROOM_RADIUS, 32),
    new THREE.MeshStandardMaterial({ color: 0x030303, side: THREE.BackSide })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = ROOM_HEIGHT;
  group.add(ceiling);

  // Warm gold ambient + ember-red point light near the table, matching
  // style.css's --yellow/--red instead of neutral white lighting.
  const ambient = new THREE.AmbientLight(0xffddaa, 0.4);
  const emberLight = new THREE.PointLight(0xff5522, 1.4, 7, 2);
  emberLight.position.set(0, 0.6, -1.0);
  const goldDirectional = new THREE.DirectionalLight(0xffe600, 0.55);
  goldDirectional.position.set(1, 3, 1.5);
  group.add(ambient, emberLight, goldDirectional);

  const dealer = createDealerSilhouette();
  dealer.position.set(0, 0, -1.95);
  group.add(dealer);

  return { group, lava, emberLight };
}
