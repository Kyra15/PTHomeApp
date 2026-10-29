/**
 * A "tilt" exercise is measured with the accelerometer: the user holds the
 * phone in their hand and moves their arm/limb so the phone's orientation
 * changes relative to gravity (e.g. raising an arm from the side up to
 * shoulder height). Progress is the angle between the phone's *current*
 * orientation and the orientation it was in during calibration.
 *
 * A "rotation" exercise is measured with the gyroscope: the user makes a
 * circular motion (shoulder circles, wrist circles, ankle circles). We
 * integrate the total angular speed over time, so the app doesn't need to
 * know or guess which physical axis the circle happens around.
 */
export type SensorMode = 'tilt' | 'rotation';

export type DiagramKind =
  | 'raise-front'
  | 'raise-side'
  | 'circle-shoulder'
  | 'circle-wrist'
  /** Generic angle gauge for exercises without a dedicated figure (knee, hip, ankle, back…). */
  | 'dial';

export type BodyArea = 'Shoulder' | 'Elbow & Wrist' | 'Hip' | 'Knee' | 'Ankle & Foot' | 'Back & Core' | string;

export interface Exercise {
  /** The library slug (same as public.exercises.slug), e.g. "shoulder-flexion". */
  id: string;
  title: string;
  bodyArea: BodyArea;
  /** Where/how to hold the phone (shown on the pre-exercise screen, F05). */
  positioningTip: string;
  defaultSets: number;
  estMinutes: number;
  difficulty: 'easy' | 'moderate' | 'hard';
  equipment: string;
  tags: string[];
  shortDescription: string;
  /** Plain-language, step-by-step instructions. Also used for spoken guidance. */
  instructions: string[];
  sensorMode: SensorMode;
  diagram: DiagramKind;
  /** Number of complete reps to finish the exercise. */
  targetReps: number;
  /**
   * Degrees of motion that counts as "fully done" for one direction of a
   * tilt exercise (e.g. arm all the way up).
   */
  targetAngleDeg?: number;
  /** Degrees the phone must return to before a rep is counted as complete. */
  returnAngleDeg?: number;
  /** Total accumulated rotation (degrees) that counts as one lap for a rotation exercise. */
  targetRotationDeg?: number;
  accentColor: string;
}

export type EnginePhase =
  | 'checking-sensors'
  | 'sensors-unavailable'
  | 'intro'
  | 'calibrating'
  | 'active'
  | 'paused'
  | 'rest'
  | 'finished';

/** What a finished (or ended-early) session produced — shown on the summary and POSTed to exercise_logs. */
export interface SessionSummary {
  exerciseId: string;
  completed: boolean;
  repsCompleted: number;
  setsCompleted: number;
  targetSets: number;
  targetReps: number;
  /** Seconds of active exercising (pauses and rests excluded). */
  durationSeconds: number;
  /** Peak tilt (degrees from the start position) reached on each counted rep; empty for rotation exercises. */
  romPerRep: number[];
  avgRomDeg: number | null;
  peakRomDeg: number | null;
  /** Achieved sensor rates for this session (task 2.4 evaluation data). */
  accelHz: number | null;
  gyroHz: number | null;
  requestedHz: number;
  pauses: number;
}

export type TiltLeg = 'outbound' | 'inbound';
