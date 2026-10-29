import { Exercise } from '../types/exercise';
import library from '../../shared/exercise-library.json';

/**
 * The exercise library (task 3.2 / F11), loaded from shared/exercise-library.json — the same file the
 * backend seed migration is generated from, so the app's sensor settings always match the database rows.
 * Plans from the server reference exercises by slug, which is this `id`.
 */
type LibraryRow = (typeof library.exercises)[number] & {
  target_angle_deg?: number;
  return_angle_deg?: number;
  target_rotation_deg?: number;
};

function fromRow(row: LibraryRow): Exercise {
  return {
    id: row.slug,
    title: row.name,
    bodyArea: row.body_area,
    shortDescription: row.description,
    instructions: row.instructions,
    positioningTip: row.positioning_tip,
    sensorMode: row.sensor_mode as Exercise['sensorMode'],
    diagram: row.diagram as Exercise['diagram'],
    defaultSets: row.default_sets,
    targetReps: row.default_reps,
    targetAngleDeg: row.target_angle_deg,
    returnAngleDeg: row.return_angle_deg,
    targetRotationDeg: row.target_rotation_deg,
    estMinutes: row.est_minutes,
    difficulty: row.difficulty as Exercise['difficulty'],
    equipment: row.equipment,
    tags: row.tags,
    accentColor: row.accent_color,
  };
}

export const EXERCISES: Exercise[] = (library.exercises as LibraryRow[]).map(fromRow);

/** Body areas in a fixed, head-to-toe order for grouping and filter chips. */
export const BODY_AREAS = ['Shoulder', 'Elbow & Wrist', 'Back & Core', 'Hip', 'Knee', 'Ankle & Foot'].filter((a) =>
  EXERCISES.some((e) => e.bodyArea === a),
);

export function getExerciseById(id: string): Exercise | undefined {
  return EXERCISES.find((e) => e.id === id);
}

export function searchExercises(query: string, bodyArea: string | null): Exercise[] {
  const q = query.trim().toLowerCase();
  return EXERCISES.filter((e) => (bodyArea ? e.bodyArea === bodyArea : true)).filter((e) =>
    q ? [e.title, e.bodyArea, e.shortDescription, ...e.tags].join(' ').toLowerCase().includes(q) : true,
  );
}
