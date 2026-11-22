import RAPIER from "@dimforge/rapier3d-compat";

export const initializePhysics = () => RAPIER.init();

const radius = .18;
const halfHeight = .42;
const skin = .012;

export function createCharacterPhysics({floors, obstacles, doors, eyeHeight}) {
  const world = new RAPIER.World({x: 0, y: -9.81, z: 0});
  for (const {x, z, w, d, top} of floors) {
    world.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, .12, d / 2).setTranslation(x, top - .12, z));
  }
  for (const {x, z, w, d} of obstacles) {
    world.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, 2.2, d / 2).setTranslation(x, 1.32, z));
  }
  const leaves = doors.map((door) => ({
    door,
    collider: world.createCollider(RAPIER.ColliderDesc.cuboid((door.width - .04) / 2, (door.height - .05) / 2, .089))
  }));
  const player = world.createCollider(RAPIER.ColliderDesc.capsule(halfHeight, radius));
  const controller = world.createCharacterController(skin);
  controller.enableAutostep(.22, .12, false);
  controller.enableSnapToGround(.24);
  const eyeOffset = eyeHeight - halfHeight - radius;
  let fallSpeed = 0;
  let grounded = false;

  function sync(position) {
    player.setTranslation({x: position.x, y: position.y - eyeOffset + skin, z: position.z});
    fallSpeed = 0;
    grounded = false;
  }

  return {
    sync,
    move(position, dx, dz, delta) {
      if (delta <= 0 || (grounded && !dx && !dz)) return false;
      for (const {door, collider} of leaves) {
        const {position, rotation} = door.leafPose();
        collider.setTranslation(position);
        collider.setRotation(rotation);
      }
      // Refresh spatial queries after rotating the door colliders.
      world.timestep = delta;
      world.step();
      fallSpeed = Math.min(7, fallSpeed + 9.81 * delta);
      const start = player.translation();
      controller.computeColliderMovement(player, {x: dx, y: -fallSpeed * delta, z: dz});
      const shift = controller.computedMovement();
      const x = start.x + shift.x;
      const y = start.y + shift.y;
      const z = start.z + shift.z;
      player.setTranslation({x, y, z});
      grounded = controller.computedGrounded();
      if (grounded) fallSpeed = 0;
      const eyeY = y + eyeOffset - skin;
      if (Math.abs(position.x - x) + Math.abs(position.y - eyeY) + Math.abs(position.z - z) < .0001) return false;
      position.set(x, eyeY, z);
      return true;
    },
    free() {
      world.removeCharacterController(controller);
      world.free();
    }
  };
}
