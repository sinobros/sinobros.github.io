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
    return interactives.get(hits[0].object.uuid) || null;
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

  return {
    on,
    registerInteractive,
    unregisterInteractive,
    pickAndHover,
    selectAt,
    clearHover,
    attachMouse,
  };
}
