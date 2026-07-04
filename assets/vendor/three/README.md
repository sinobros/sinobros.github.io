# Vendored Three.js

Pinned version: **r185 / 0.185.0** (latest stable at time of vendoring, per
`https://api.github.com/repos/mrdoob/three.js/releases/latest`).

Source: `https://unpkg.com/three@0.185.0/...` — downloaded once and committed
here. Do not add a runtime `<script>`/`import` that points at unpkg, jsdelivr,
or any other CDN for Three.js or its addons in any shipped page. All pages
must import only from these vendored paths (see the import map in
`baccarat-vr.html`).

To upgrade: re-run the same `curl` commands against a new pinned version,
re-verify addon import lines still resolve (see below), re-run
`node assets/js/games/baccarat-vr/engine.test.mjs`, and re-check the page in
a browser before committing the version bump as its own change.

## Files vendored and why

- `build/three.module.js` and `build/three.core.js` — the core library (r185+
  splits the module into these two files; `three.module.js` imports from
  `three.core.js` at a relative path, both must be vendored together).
- `examples/jsm/controls/OrbitControls.js` — desktop-only camera orbiting for
  non-headset verification (Phase 2+).
- `examples/jsm/webxr/VRButton.js` — the "Enter VR" button.
- `examples/jsm/webxr/XRControllerModelFactory.js`,
  `examples/jsm/webxr/XRHandModelFactory.js`, and their transitive
  dependencies (`examples/jsm/loaders/GLTFLoader.js`,
  `examples/jsm/libs/motion-controllers.module.js`,
  `examples/jsm/webxr/XRHandPrimitiveModel.js`,
  `examples/jsm/webxr/XRHandMeshModel.js`,
  `examples/jsm/utils/BufferGeometryUtils.js`,
  `examples/jsm/utils/SkeletonUtils.js`) — vendored for import-graph
  completeness, but see the important caveat below before using them.

## Important: do not use the CDN-backed model-fetching paths

`XRControllerModelFactory` and `XRHandModelFactory` (in "mesh" mode) do not
render procedural geometry — they fetch realistic controller/hand GLTF models
at runtime from `https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@...`
(see `DEFAULT_PROFILES_PATH` in `XRControllerModelFactory.js` and
`DEFAULT_HAND_PROFILE_PATH` in `XRHandMeshModel.js`). Calling
`factory.createControllerModel()` / `createHandModel(controller, 'mesh')`
as-is would violate this project's Decision #2 (no runtime CDN dependency)
and the "no downloaded 3D model assets" rule in Out of Scope, since vendoring
the actual model assets would mean pulling in the entire
`@webxr-input-profiles/assets` package.

This plan's game code therefore:
- Never calls the GLTF/mesh-fetching code paths.
- Uses simple procedural geometry (a small cone/box + a laser ray, built
  directly from primitives) for the controller visual instead of
  `XRControllerModelFactory`.
- Uses `XRHandModelFactory` only in its **`'sphere'`/`'box'` primitive mode**
  (via `XRHandPrimitiveModel`, no network fetch, no GLTFLoader involved), not
  its `'mesh'` mode.

The GLTFLoader/motion-controllers/mesh-model files are kept vendored (so the
addon's import graph resolves if referenced) but are dead code in this
project's actual render path. Do not wire `createControllerModel()` or hand
`'mesh'` mode into `main.js`/`input.js`.
