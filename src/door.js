import * as THREE from "three";

export function createDoor(parent, {box, group, cylinder, shape}, {
  x, z, y = 0, width = 1.24, height = 2.72, rotation = 0, swing = 1,
  color = 0x634d3b, casing = 0x3d3028, initialOpen = false
}) {
  const frame = group(parent, x, y, z);
  frame.rotation.y = rotation;
  const wood = new THREE.Color(color);
  const trim = wood.clone().multiplyScalar(.67);
  const panel = wood.clone().multiplyScalar(1.13);
  const metal = 0xb59050;
  for (const side of [-1, 1]) {
    box(frame, casing, .129, height + .12, .28, side * (width / 2 + .067), (height + .12) / 2, 0);
    box(frame, trim, .043, height + .08, .32, side * (width / 2 + .095), (height + .08) / 2, 0);
  }
  box(frame, casing, width + .27, .15, .29, 0, height + .065, 0);
  box(frame, trim, width + .31, .039, .33, 0, height + .134, 0);
  const pivot = group(frame, -width / 2, 0, 0);
  const leaf = group(pivot, width / 2, 0, 0);
  box(leaf, color, width - .04, height - .05, .14, 0, height / 2, 0);
  for (const side of [-1, 1]) {
    for (const [level, panelHeight] of [[.23,.28],[.67,.39]]) {
      box(leaf, trim, width * .77, height * panelHeight, .032, 0, height * level, .074 * side);
      box(leaf, panel, width * .66, height * panelHeight - .084, .029, 0, height * level, .093 * side);
    }
    const knobX = width * .365;
    const knobY = height * .45;
    box(leaf, trim, .089, .23, .014, knobX, knobY - .039, .084 * side);
    const stem = cylinder(leaf, metal, .026, .034, .079, knobX, knobY, side * .125);
    stem.rotation.x = Math.PI / 2;
    shape(leaf, new THREE.SphereGeometry(.055, 12, 8), metal, knobX, knobY, side * .178);
  }
  for (const level of [.22, .76]) cylinder(pivot, metal, .028, .028, .13, .005, height * level, .019);

  frame.updateWorldMatrix(true, false);
  const position = frame.getWorldPosition(new THREE.Vector3());
  const heading = frame.getWorldQuaternion(new THREE.Quaternion());
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(heading);
  const sideX = forward.z;
  const sideZ = -forward.x;
  const leafPosition = new THREE.Vector3();
  const leafRotation = new THREE.Quaternion();
  let open = initialOpen;
  let progress = initialOpen ? 1 : 0;
  const angle = () => swing * 1.56 * progress * progress * (3 - 2 * progress);
  pivot.rotation.y = angle();

  function localPoint(x, z) {
    const dx = x - position.x;
    const dz = z - position.z;
    return [dx * sideX + dz * sideZ + width / 2, dx * forward.x + dz * forward.z];
  }

  return {
    x: position.x, z: position.z, width, height, marker: position.y + height * .56, obstacle: 0,
    leafPose() {
      leaf.updateWorldMatrix(true, false);
      leafPosition.set(0, height / 2, 0).applyMatrix4(leaf.matrixWorld);
      leaf.getWorldQuaternion(leafRotation);
      return {position: leafPosition, rotation: leafRotation};
    },
    get open() { return open; },
    get moving() { return progress !== Number(open); },
    setOpen(value, instant = false) {
      if (value === open) return false;
      open = value;
      if (instant) {
        progress = Number(open);
        pivot.rotation.y = angle();
      }
      return true;
    },
    tick(delta) {
      if (progress === Number(open)) return false;
      progress = THREE.MathUtils.clamp(progress + delta * (open ? 1.63 : -1.87), 0, 1);
      pivot.rotation.y = angle();
      return true;
    },
    blocks(x, z) {
      const [across, depth] = localPoint(x, z);
      const turn = pivot.rotation.y;
      const leafX = across * Math.cos(turn) - depth * Math.sin(turn);
      const leafZ = across * Math.sin(turn) + depth * Math.cos(turn);
      return leafX > -.15 && leafX < width + .15 && Math.abs(leafZ) < .22;
    },
    canClose(x, z) {
      const [across, depth] = localPoint(x, z);
      return across < -.20 || across > width + .21 || depth * -swing < -.26 || depth * -swing > width + .20;
    }
  };
}
