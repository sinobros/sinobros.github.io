import * as THREE from "three";

// Unified input system: any input source (desktop mouse now, XR controller
// rays in Phase 9, XR hand pinch in Phase 11) casts a ray and calls
// pickAndHover()/selectAt() with its own sourceId. All sources funnel into
// the same hoverStart/hoverEnd/select events, so ui.js and main.js never
// need to know which input source triggered them.
export function createInputSystem() {
  const raycaster = new THREE.Raycaster();
  const interactives = new Map(); // mesh.uuid -> { mesh, action, hoverLabel, data }
  const hoverStateBySource = new Map(); // sourceId -> currently hovered mesh
  const listeners = { hoverStart: [], hoverEnd: [], select: [] };

  function on(event, callback) {
    listeners[event].push(callback);
    return () => {
      const i = listeners[event].indexOf(callback);
      if (i !== -1) listeners[event].splice(i, 1);
    };
  }

  function emit(event, payload) {
    listeners[event].slice().forEach((cb) => cb(payload));
  }

  function registerInteractive(mesh, action, hoverLabel, data = {}) {
    interactives.set(mesh.uuid, { mesh, action, hoverLabel, data });
  }

  function unregisterInteractive(mesh) {
    interactives.delete(mesh.uuid);
  }

  function pick(origin, direction) {
    raycaster.set(origin, direction);
    const meshes = Array.from(interactives.values(), (e) => e.mesh);
    const hits = raycaster.intersectObjects(meshes, false);
    if (hits.length === 0) return null;
    const entry = interactives.get(hits[0].object.uuid);
    if (!entry) return null;
    return { ...entry, distance: hits[0].distance };
  }

  function updateHover(sourceId, entry) {
    const prevMesh = hoverStateBySource.get(sourceId) || null;
    const nextMesh = entry ? entry.mesh : null;
    if (prevMesh === nextMesh) return entry;
    if (prevMesh) emit("hoverEnd", { sourceId, mesh: prevMesh });
    hoverStateBySource.set(sourceId, nextMesh);
    if (nextMesh) {
      emit("hoverStart", {
        sourceId,
        mesh: nextMesh,
        action: entry.action,
        hoverLabel: entry.hoverLabel,
        data: entry.data,
      });
    }
    return entry;
  }

  function pickAndHover(sourceId, origin, direction) {
    return updateHover(sourceId, pick(origin, direction));
  }

  function selectAt(sourceId, origin, direction) {
    const entry = pick(origin, direction);
    if (entry) emit("select", { sourceId, mesh: entry.mesh, action: entry.action, data: entry.data });
    return entry;
  }

  function clearHover(sourceId) {
    const prevMesh = hoverStateBySource.get(sourceId) || null;
    if (prevMesh) emit("hoverEnd", { sourceId, mesh: prevMesh });
    hoverStateBySource.delete(sourceId);
  }

  // Desktop mouse path: NDC raycast from the camera through the pointer.
  function attachMouse(camera, domElement) {
    const pointerNDC = new THREE.Vector2();

    function toNDC(event) {
      const rect = domElement.getBoundingClientRect();
      pointerNDC.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNDC.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    function currentRay() {
      raycaster.setFromCamera(pointerNDC, camera);
      return { origin: raycaster.ray.origin.clone(), direction: raycaster.ray.direction.clone() };
    }

    function onMove(event) {
      toNDC(event);
      const { origin, direction } = currentRay();
      const entry = pickAndHover("mouse", origin, direction);
      domElement.style.cursor = entry ? "pointer" : "auto";
    }

    function onClick(event) {
      toNDC(event);
      const { origin, direction } = currentRay();
      selectAt("mouse", origin, direction);
    }

    function onLeave() {
      clearHover("mouse");
      domElement.style.cursor = "auto";
    }

    domElement.addEventListener("pointermove", onMove);
    domElement.addEventListener("click", onClick);
    domElement.addEventListener("pointerleave", onLeave);

    return () => {
      domElement.removeEventListener("pointermove", onMove);
      domElement.removeEventListener("click", onClick);
      domElement.removeEventListener("pointerleave", onLeave);
    };
  }

  // XR controller path (Quest Touch etc.): a visible laser ray + reticle,
  // raycasting every frame from the controller's target-ray space against
  // the exact same interactives list the mouse path uses. `selectstart`
  // fires the same select() this module's mouse path fires, per the plan's
  // "unified event surface" goal -- no engine/UI code changes for this.
  const DEFAULT_RAY_LENGTH = 3;

  function computeControllerRay(controller) {
    const origin = controller.getWorldPosition(new THREE.Vector3());
    const direction = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(controller.getWorldQuaternion(new THREE.Quaternion()));
    return { origin, direction };
  }

  function createControllerVisual() {
    const rayGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -1),
    ]);
    const line = new THREE.Line(
      rayGeometry,
      new THREE.LineBasicMaterial({ color: 0xffe600, transparent: true, opacity: 0.85 })
    );
    line.scale.z = DEFAULT_RAY_LENGTH;

    const reticle = new THREE.Mesh(
      new THREE.SphereGeometry(0.008, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffe600 })
    );
    reticle.position.z = -DEFAULT_RAY_LENGTH;

    const grip = new THREE.Mesh(
      new THREE.ConeGeometry(0.012, 0.05, 8),
      new THREE.MeshStandardMaterial({ color: 0x1a0007, emissive: 0xe51e47, emissiveIntensity: 0.3 })
    );
    grip.rotation.x = -Math.PI / 2;
    grip.position.z = -0.02;

    const group = new THREE.Group();
    group.add(line, reticle, grip);
    return { group, line, reticle };
  }

  function pulseHaptic(controller, intensity, durationMs) {
    const inputSource = controller.userData.inputSource;
    const actuator = inputSource?.gamepad?.hapticActuators?.[0];
    if (actuator && typeof actuator.pulse === "function") {
      actuator.pulse(intensity, durationMs);
    }
  }

  function attachController(renderer, index) {
    const controller = renderer.xr.getController(index);
    const sourceId = `controller-${index}`;
    const visual = createControllerVisual();
    controller.add(visual.group);

    controller.addEventListener("connected", (event) => {
      controller.userData.inputSource = event.data;
    });
    controller.addEventListener("disconnected", () => {
      controller.userData.inputSource = null;
      clearHover(sourceId);
    });
    controller.addEventListener("selectstart", () => {
      const { origin, direction } = computeControllerRay(controller);
      const entry = selectAt(sourceId, origin, direction);
      if (entry) pulseHaptic(controller, 0.7, 40);
    });

    const unsubscribeHover = on("hoverStart", ({ sourceId: sid }) => {
      if (sid === sourceId) pulseHaptic(controller, 0.25, 20);
    });

    function update() {
      const { origin, direction } = computeControllerRay(controller);
      const entry = pickAndHover(sourceId, origin, direction);
      const length = entry ? Math.max(entry.distance, 0.05) : DEFAULT_RAY_LENGTH;
      visual.line.scale.z = length;
      visual.reticle.position.z = -length;
    }

    function dispose() {
      unsubscribeHover();
      clearHover(sourceId);
    }

    return { controller, sourceId, update, dispose };
  }

  return {
    on,
    registerInteractive,
    unregisterInteractive,
    pickAndHover,
    selectAt,
    clearHover,
    attachMouse,
    attachController,
  };
}
