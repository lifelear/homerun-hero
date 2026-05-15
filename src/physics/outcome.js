import { FENCE_CENTER, FENCE_LEFT, FENCE_RIGHT, FENCE_HEIGHT, M_TO_FT } from '../constants.js';

/**
 * Get the fence distance at a given angle from center field.
 * angle: 0 = center, positive = right field, negative = left field
 */
function fenceDistanceAt(angleDeg) {
  const t = Math.abs(angleDeg) / 45; // 0 at center, 1 at foul line
  // Interpolate from center distance to corner distance
  const cornerDist = angleDeg >= 0 ? FENCE_RIGHT : FENCE_LEFT;
  return FENCE_CENTER * (1 - t) + cornerDist * t;
}

export function determineOutcome(ballFlight, launchAngle, exitSpeed, contactQuality) {
  // If ball hasn't landed yet, project where it will land
  let dist, landing;
  if (ballFlight.landingPosition) {
    landing = ballFlight.landingPosition;
    dist = ballFlight.getDistance();
  } else {
    // Estimate landing from current trajectory
    // Simple projection: use current position + extrapolate
    const pos = ballFlight.position;
    const vel = ballFlight.velocity;
    // Time to hit ground: solve pos.y + vel.y*t - 0.5*g*t^2 = 0
    const g = 9.81;
    const a = -0.5 * g;
    const b = vel.y;
    const c = pos.y;
    const disc = b * b - 4 * a * c;
    let tRemain = 1.0;
    if (disc > 0) {
      tRemain = Math.max(0, (-b - Math.sqrt(disc)) / (2 * a));
    }
    const landX = pos.x + vel.x * tRemain;
    const landZ = pos.z + vel.z * tRemain;
    landing = { x: landX, y: 0, z: landZ };
    dist = Math.sqrt(landX * landX + landZ * landZ);
  }
  const distFt = dist * M_TO_FT;

  // Spray angle (degrees from center, negative = left field, positive = right field)
  const sprayAngle = Math.atan2(landing.x, -landing.z) * (180 / Math.PI);

  // Foul ball check
  if (Math.abs(sprayAngle) > 45) {
    return { type: 'FOUL', label: '界外球', distanceFt: distFt };
  }

  // Check if ball cleared the fence (home run)
  const fenceDist = fenceDistanceAt(sprayAngle);
  const fenceReached = dist >= fenceDist;
  const heightAtFence = ballFlight.maxHeight > FENCE_HEIGHT;

  if (fenceReached && heightAtFence && launchAngle > 10) {
    return {
      type: 'HOME_RUN',
      label: '全壘打！',
      distanceFt: Math.round(distFt),
    };
  }

  // Ground ball (low launch angle)
  if (launchAngle < 10) {
    if (exitSpeed > 40 && contactQuality > 0.7 && Math.random() < 0.2) {
      return { type: 'SINGLE', label: '內野安打！', distanceFt: Math.round(distFt) };
    }
    return { type: 'OUT', label: '滾地出局', distanceFt: Math.round(distFt) };
  }

  // Pop-up / high fly ball
  if (launchAngle > 40) {
    return { type: 'OUT', label: '高飛出局', distanceFt: Math.round(distFt) };
  }

  // Fly ball / line drive outcomes based on distance
  if (dist < 50) {
    if (launchAngle > 22 || exitSpeed < 38) {
      return { type: 'OUT', label: Math.random() < 0.5 ? '飛球出局' : '平飛出局', distanceFt: Math.round(distFt) };
    }
    return { type: 'SINGLE', label: '一壘安打！', distanceFt: Math.round(distFt) };
  }

  if (dist < 75) {
    if (Math.random() < 0.5) {
      return { type: 'OUT', label: '飛球出局', distanceFt: Math.round(distFt) };
    }
    return { type: 'SINGLE', label: '一壘安打！', distanceFt: Math.round(distFt) };
  }

  if (dist < 100) {
    if (launchAngle > 32 && exitSpeed < 42) {
      return { type: 'OUT', label: '飛球出局', distanceFt: Math.round(distFt) };
    }
    if (exitSpeed > 42) {
      return { type: 'DOUBLE', label: '二壘安打！', distanceFt: Math.round(distFt) };
    }
    return { type: 'SINGLE', label: '一壘安打！', distanceFt: Math.round(distFt) };
  }

  if (dist < fenceDist * 0.95) {
    if (exitSpeed > 44) {
      return { type: 'TRIPLE', label: '三壘安打！', distanceFt: Math.round(distFt) };
    }
    return { type: 'DOUBLE', label: '二壘安打！', distanceFt: Math.round(distFt) };
  }

  // Off the wall
  return { type: 'DOUBLE', label: '打到牆壁！二壘安打！', distanceFt: Math.round(distFt) };
}
