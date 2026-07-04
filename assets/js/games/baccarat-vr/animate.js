// Tiny promise-based tween/wait helpers driven off the render loop's clock
// (main.js calls tick(deltaMs) once per frame) -- no setTimeout, so this
// stays frame-accurate once an XR session is active (Phase 9+).

const activeTweens = new Set();
const activeWaits = new Set();

export function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function easeOutQuad(t) {
  return 1 - (1 - t) * (1 - t);
}

// Tweens any combination of object properties (THREE.Vector3-like fields
// such as `position`/`scale`, THREE.Euler-like fields such as `rotation`,
// or plain numeric properties) to the given target values.
export function tween(obj, targetProps, durationMs, easing = easeInOutQuad) {
  return new Promise((resolve) => {
    const startProps = {};
    Object.keys(targetProps).forEach((key) => {
      const current = obj[key];
      startProps[key] = typeof current?.clone === "function" ? current.clone() : current;
    });
    activeTweens.add({
      obj,
      startProps,
      targetProps,
      durationMs: Math.max(durationMs, 1),
      easing,
      elapsed: 0,
      resolve,
    });
  });
}

export function wait(ms) {
  return new Promise((resolve) => {
    activeWaits.add({ remaining: Math.max(ms, 0), resolve });
  });
}

function applyTween(entry, e) {
  const { obj, startProps, targetProps } = entry;
  Object.keys(targetProps).forEach((key) => {
    const start = startProps[key];
    const target = targetProps[key];
    if (start && typeof start.lerp === "function") {
      obj[key].copy(start.clone().lerp(target, e));
    } else if (start && typeof start === "object") {
      Object.keys(target).forEach((axis) => {
        obj[key][axis] = start[axis] + (target[axis] - start[axis]) * e;
      });
    } else {
      obj[key] = start + (target - start) * e;
    }
  });
}

export function tick(deltaMs) {
  activeTweens.forEach((entry) => {
    entry.elapsed += deltaMs;
    const raw = Math.min(entry.elapsed / entry.durationMs, 1);
    applyTween(entry, entry.easing(raw));
    if (raw >= 1) {
      activeTweens.delete(entry);
      entry.resolve();
    }
  });

  activeWaits.forEach((entry) => {
    entry.remaining -= deltaMs;
    if (entry.remaining <= 0) {
      activeWaits.delete(entry);
      entry.resolve();
    }
  });
}
