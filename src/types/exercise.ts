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
  | 'circle-wrist';

export interface Exercise {
  id: string;
  title: string;
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
  | 'finished';

export type TiltLeg = 'outbound' | 'inbound';
