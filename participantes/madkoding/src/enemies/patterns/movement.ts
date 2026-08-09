// ─── Movement Helpers shared by enemy patterns ───────────────────────────────

import * as THREE from 'three';
import type { Projectile } from '../../weapons/Projectile';

export function dodgeLasers(pos: THREE.Vector3, projectiles: Projectile[] | undefined, speed: number, dt: number): void {
  if (!projectiles) return;
  for (const proj of projectiles) {
    if (!proj.active) continue;
    if (pos.distanceTo(proj.position) < 3) {
      const away = pos.clone().sub(proj.position).normalize();
      pos.x += away.x * speed * dt;
      pos.y += away.y * speed * dt;
      break;
    }
  }
}

// Fly forward (toward +Z, past the player) at constant speed with a lateral
// weave. Enemies overfly the player instead of hovering at a standoff point.
export function overfly(
  pos: THREE.Vector3,
  playerPos: THREE.Vector3,
  speed: number,
  dt: number,
  phase: number,
  weaveAmpX = 4,
  weaveAmpY = 2.5,
): void {
  // Constant forward speed toward the player (increasing Z).
  pos.z += speed * dt;
  // Lateral sinusoidal weave so they don't fly in a straight boring line.
  const t = pos.z * 0.05 + phase;
  pos.x = playerPos.x + Math.sin(t) * weaveAmpX;
  pos.y = playerPos.y + Math.cos(t * 0.7) * weaveAmpY;
}
