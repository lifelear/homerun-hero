// Physics
export const GRAVITY = 9.81;
export const AIR_DENSITY = 1.225;
export const DRAG_COEFFICIENT = 0.3;
export const MAGNUS_COEFFICIENT = 0.000045;

// Baseball
export const BALL_RADIUS = 0.0366; // meters
export const BALL_MASS = 0.145; // kg
export const BALL_CROSS_SECTION = Math.PI * BALL_RADIUS * BALL_RADIUS;
export const BALL_VISUAL_SCALE = 3.0; // scale up for visibility

// Field dimensions (meters)
export const MOUND_DISTANCE = 18.44; // 60'6"
export const BASE_DISTANCE = 27.43; // 90'
export const FENCE_CENTER = 121.92; // ~400ft
export const FENCE_LEFT = 100.58; // ~330ft
export const FENCE_RIGHT = 100.58; // ~330ft
export const FENCE_HEIGHT = 2.44; // ~8ft
export const FOUL_ANGLE = 45; // degrees from center

// Strike zone (meters, from ground)
export const STRIKE_ZONE = {
  xMin: -0.22,
  xMax: 0.22,
  yMin: 0.50,
  yMax: 1.05,
  zMin: -0.15,
  zMax: 0.30,
};

// Hitting thresholds (world-space meters on the zone face)
// These are base values, scaled by HIT_TOLERANCE at runtime
export const CONTACT_PERFECT = 0.05;
export const CONTACT_GOOD = 0.12;
export const CONTACT_WEAK = 0.20;
export const CONTACT_FOUL = 0.30;

// Difficulty: multiplier on contact thresholds (1.0 = default, 2.0 = 2x easier, 0.5 = harder)
export let HIT_TOLERANCE = 4.0;
export function setHitTolerance(v) { HIT_TOLERANCE = v; }

// Timing
export const TIMING_IDEAL_Z = 0; // sweet spot = at the plate
export const TIMING_WINDOW = 3.0; // generous Z range (~0.1s at pitch speed)

// Exit velocity (base values, hit-physics applies 2.25x multiplier)
export const MAX_EXIT_VELO = 30.0; // m/s → ×2.25 = 67.5 m/s (~151 mph)
export const MIN_EXIT_VELO = 12.0; // m/s → ×2.25 = 27 m/s (~60 mph)

// ── Baseball Rules ──────────────────────────────────────────────
export const MAX_STRIKES = 3;   // 三振出局
export const MAX_BALLS = 4;     // 四壞保送
export const MAX_OUTS = 3;      // 三出局換局

// Game
export const PHYSICS_DT = 1 / 120;

// Conversion
export const MS_TO_MPH = 2.23694;
export const M_TO_FT = 3.28084;
export const RPM_TO_RADS = (2 * Math.PI) / 60;
export const MPH_TO_MS = 0.44704;
