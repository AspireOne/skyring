export interface GameConfig {
  readonly SIM_HZ: number;
  readonly SNAPSHOT_HZ: number;
  readonly INTERP_DELAY_MS: number;
  readonly DOME_RADIUS: number;
  readonly GROUND_Y: number;
  readonly BOUNDARY_RESTITUTION: number;
  readonly SPAWN_ALTITUDE: number;
  readonly SPAWN_SEPARATION: number;
  readonly MIN_SPEED: number;
  readonly MAX_SPEED: number;
  readonly THROTTLE_ACCEL: number;
  readonly PITCH_RATE: number;
  readonly ROLL_RATE: number;
  readonly YAW_RATE: number;
  readonly VELOCITY_ALIGN: number;
  readonly GRAVITY: number;
  readonly PLANE_COLLISION_RADIUS: number;
  readonly PLANE_COLLISION_RESTITUTION: number;
  readonly BULLET_SPEED: number;
  readonly BULLET_LIFETIME: number;
  readonly FIRE_COOLDOWN: number;
  readonly AMMO_MAX: number;
  readonly AMMO_REGEN_PER_SEC: number;
  readonly AMMO_PER_SHOT: number;
  readonly PLANE_HIT_RADIUS: number;
  readonly HIT_IMPULSE: number;
  readonly RECOIL_IMPULSE: number;
  readonly STUMBLE_DURATION: number;
  readonly STUMBLE_SPIN: number;
  readonly RING_RADIUS: number;
  readonly RING_DWELL: number;
  readonly RING_WARNING: number;
  readonly RING_POINTS_PER_SEC: number;
  readonly RING_CENTER_TIE_EPS: number;
  readonly RING_MIN_TELEPORT_DIST: number;
  readonly MATCH_DURATION: number;
  readonly COUNTDOWN: number;
  readonly SUDDEN_DEATH_RING_RADIUS: number;
}

export const DEFAULT_GAME_CONFIG: Readonly<GameConfig> = Object.freeze({
  SIM_HZ: 60,
  SNAPSHOT_HZ: 30,
  INTERP_DELAY_MS: 100,
  DOME_RADIUS: 700,
  GROUND_Y: 0,
  BOUNDARY_RESTITUTION: 0.8,
  SPAWN_ALTITUDE: 150,
  SPAWN_SEPARATION: 250,
  MIN_SPEED: 40,
  MAX_SPEED: 140,
  THROTTLE_ACCEL: 60,
  PITCH_RATE: 1.6,
  ROLL_RATE: 2.6,
  YAW_RATE: 0.8,
  VELOCITY_ALIGN: 3,
  GRAVITY: 0,
  PLANE_COLLISION_RADIUS: 12,
  PLANE_COLLISION_RESTITUTION: 0.9,
  BULLET_SPEED: 400,
  BULLET_LIFETIME: 1.2,
  FIRE_COOLDOWN: 0.12,
  AMMO_MAX: 20,
  AMMO_REGEN_PER_SEC: 4,
  AMMO_PER_SHOT: 1,
  PLANE_HIT_RADIUS: 12,
  HIT_IMPULSE: 220,
  RECOIL_IMPULSE: 25,
  STUMBLE_DURATION: 0.6,
  STUMBLE_SPIN: 4,
  RING_RADIUS: 90,
  RING_DWELL: 22,
  RING_WARNING: 4,
  RING_POINTS_PER_SEC: 1,
  RING_CENTER_TIE_EPS: 8,
  RING_MIN_TELEPORT_DIST: 300,
  MATCH_DURATION: 240,
  COUNTDOWN: 3,
  SUDDEN_DEATH_RING_RADIUS: 70,
});

type ConfigKey = keyof GameConfig;

const POSITIVE_KEYS = [
  'SIM_HZ',
  'SNAPSHOT_HZ',
  'INTERP_DELAY_MS',
  'DOME_RADIUS',
  'SPAWN_ALTITUDE',
  'SPAWN_SEPARATION',
  'MIN_SPEED',
  'MAX_SPEED',
  'THROTTLE_ACCEL',
  'PITCH_RATE',
  'ROLL_RATE',
  'YAW_RATE',
  'VELOCITY_ALIGN',
  'PLANE_COLLISION_RADIUS',
  'BULLET_SPEED',
  'BULLET_LIFETIME',
  'FIRE_COOLDOWN',
  'AMMO_MAX',
  'AMMO_REGEN_PER_SEC',
  'AMMO_PER_SHOT',
  'PLANE_HIT_RADIUS',
  'HIT_IMPULSE',
  'RECOIL_IMPULSE',
  'STUMBLE_DURATION',
  'STUMBLE_SPIN',
  'RING_RADIUS',
  'RING_DWELL',
  'RING_WARNING',
  'RING_POINTS_PER_SEC',
  'RING_CENTER_TIE_EPS',
  'RING_MIN_TELEPORT_DIST',
  'MATCH_DURATION',
  'COUNTDOWN',
  'SUDDEN_DEATH_RING_RADIUS',
] as const satisfies readonly ConfigKey[];

const UNIT_INTERVAL_KEYS = [
  'BOUNDARY_RESTITUTION',
  'PLANE_COLLISION_RESTITUTION',
] as const satisfies readonly ConfigKey[];

function assertFinite(config: GameConfig): void {
  for (const [key, value] of Object.entries(config)) {
    if (!Number.isFinite(value)) {
      throw new RangeError(`${key} must be finite.`);
    }
  }
}

function assertPositive(config: GameConfig): void {
  for (const key of POSITIVE_KEYS) {
    if (config[key] <= 0) {
      throw new RangeError(`${key} must be greater than zero.`);
    }
  }
}

function validateGameConfig(config: GameConfig): void {
  assertFinite(config);
  assertPositive(config);

  if (
    !Number.isInteger(config.SIM_HZ) ||
    !Number.isInteger(config.SNAPSHOT_HZ)
  ) {
    throw new RangeError('SIM_HZ and SNAPSHOT_HZ must be integers.');
  }

  if (config.SNAPSHOT_HZ > config.SIM_HZ) {
    throw new RangeError('SNAPSHOT_HZ cannot exceed SIM_HZ.');
  }

  for (const key of UNIT_INTERVAL_KEYS) {
    if (config[key] <= 0 || config[key] > 1) {
      throw new RangeError(`${key} must be in the range (0, 1].`);
    }
  }

  if (config.SIM_HZ % config.SNAPSHOT_HZ !== 0) {
    throw new RangeError('SNAPSHOT_HZ must divide SIM_HZ exactly.');
  }

  if (config.MIN_SPEED >= config.MAX_SPEED) {
    throw new RangeError('MIN_SPEED must be less than MAX_SPEED.');
  }

  if (config.RING_WARNING >= config.RING_DWELL) {
    throw new RangeError('RING_WARNING must be shorter than RING_DWELL.');
  }

  if (config.AMMO_PER_SHOT > config.AMMO_MAX) {
    throw new RangeError('AMMO_PER_SHOT cannot exceed AMMO_MAX.');
  }

  if (config.RING_CENTER_TIE_EPS >= config.SUDDEN_DEATH_RING_RADIUS) {
    throw new RangeError(
      'RING_CENTER_TIE_EPS must be smaller than the sudden-death ring.',
    );
  }

  if (config.SUDDEN_DEATH_RING_RADIUS > config.RING_RADIUS) {
    throw new RangeError('SUDDEN_DEATH_RING_RADIUS cannot exceed RING_RADIUS.');
  }

  if (config.RING_RADIUS >= config.DOME_RADIUS) {
    throw new RangeError('RING_RADIUS must fit inside DOME_RADIUS.');
  }

  if (
    config.SPAWN_ALTITUDE <= config.GROUND_Y + config.PLANE_COLLISION_RADIUS ||
    config.SPAWN_ALTITUDE >= config.GROUND_Y + config.DOME_RADIUS
  ) {
    throw new RangeError(
      'SPAWN_ALTITUDE must be safely inside the playable dome.',
    );
  }

  const spawnRadius = Math.hypot(
    config.SPAWN_SEPARATION,
    config.SPAWN_ALTITUDE,
  );
  if (spawnRadius >= config.DOME_RADIUS - config.PLANE_COLLISION_RADIUS) {
    throw new RangeError('Spawn points must sit safely inside the dome.');
  }
}

export function createGameConfig(
  overrides: Partial<GameConfig> = {},
): Readonly<GameConfig> {
  const config: GameConfig = { ...DEFAULT_GAME_CONFIG, ...overrides };
  validateGameConfig(config);

  return Object.freeze(config);
}

export function secondsToTicks(seconds: number, simHz: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new RangeError('seconds must be finite and greater than zero.');
  }

  if (!Number.isInteger(simHz) || simHz <= 0) {
    throw new RangeError('simHz must be a positive integer.');
  }

  return Math.max(1, Math.round(seconds * simHz));
}
